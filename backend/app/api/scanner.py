from fastapi import APIRouter, Depends, BackgroundTasks, HTTPException
from sqlalchemy.orm import Session
from typing import List
import json
from datetime import datetime, timezone

from ..database import get_db
from ..models import ScanJob, User
from ..schemas import ScanRequest, ScanJobResponse, TopologyRequest
from ..api.auth import get_current_user
from ..core.scanner import (
    scan_network, scan_network_nmap, scan_multiple_ranges,
    get_local_network_ranges,
    run_ping, run_traceroute, run_dns_lookup, run_port_scan
)
from ..core.topology import parse_ip_ranges, estimate_host_count, discover_topology

router = APIRouter(prefix="/scanner", tags=["scanner"])

# In-memory progress tracking
scan_progress: dict = {}
topology_progress: dict = {}


def run_scan_job(job_id: int, ip_range_raw: str, scan_type: str, db_url: str,
                 run_topology: bool = False,
                 snmp_communities: list = None,
                 use_traceroute: bool = True):
    """Background task: parse ranges → scan → optional topology → save."""
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from ..models import ScanJob

    engine = create_engine(db_url, connect_args={"check_same_thread": False})
    SessionLocal = sessionmaker(bind=engine)
    db = SessionLocal()

    try:
        job = db.query(ScanJob).filter(ScanJob.id == job_id).first()
        if not job:
            return

        job.status = "running"
        db.commit()

        def progress_cb(pct: int, msg: str):
            scan_progress[job_id] = {"progress": pct, "message": msg}
            try:
                j = db.query(ScanJob).filter(ScanJob.id == job_id).first()
                if j:
                    j.progress = pct
                    db.commit()
            except Exception:
                pass

        # Parse ranges (supports multi-range input)
        ranges = parse_ip_ranges(ip_range_raw)
        if not ranges:
            raise ValueError(f"Could not parse range: {ip_range_raw}")

        progress_cb(2, f"Ranges to scan: {', '.join(ranges)}")

        # Scan (single or multiple ranges)
        if len(ranges) == 1:
            if scan_type == "nmap":
                devices = scan_network_nmap(ranges[0], progress_cb)
            else:
                devices = scan_network(ranges[0], progress_cb)
        else:
            devices = scan_multiple_ranges(ranges, scan_type, progress_cb)

        topology_result = None

        # Optional topology discovery
        if run_topology and devices:
            progress_cb(97, f"Starting topology discovery ({len(devices)} devices)...")

            def topo_progress(pct: int, msg: str):
                # Scale 97-99
                scaled = 97 + int(pct / 100 * 2)
                scan_progress[job_id] = {"progress": scaled, "message": f"[Topología] {msg}"}

            topology_result = discover_topology(
                devices,
                snmp_communities=snmp_communities or ["public", "private"],
                use_traceroute=use_traceroute,
                use_nmap_lldp=True,
                progress_callback=topo_progress,
            )

        # Combine results
        payload = {
            "devices": devices,
            "topology": topology_result,
            "ranges_scanned": ranges,
        }

        job = db.query(ScanJob).filter(ScanJob.id == job_id).first()
        job.status = "completed"
        job.progress = 100
        job.results = json.dumps(payload)
        job.completed_at = datetime.now(timezone.utc)
        db.commit()

        topo_info = f" + {topology_result['stats']['total_connections']} connections" if topology_result else ""
        scan_progress[job_id] = {
            "progress": 100,
            "message": f"Completed: {len(devices)} devices across {len(ranges)} range(s){topo_info}"
        }

    except Exception as e:
        try:
            job = db.query(ScanJob).filter(ScanJob.id == job_id).first()
            if job:
                job.status = "failed"
                job.error_message = str(e)
                db.commit()
        except Exception:
            pass
        scan_progress[job_id] = {"progress": 0, "message": f"Error: {e}"}
    finally:
        db.close()


def run_topology_job(job_id: int, devices: list, snmp_communities: list,
                     use_traceroute: bool, db_url: str):
    """Background task: run topology discovery on existing device list."""
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from ..models import ScanJob

    engine = create_engine(db_url, connect_args={"check_same_thread": False})
    SessionLocal = sessionmaker(bind=engine)
    db = SessionLocal()

    try:
        def progress_cb(pct: int, msg: str):
            topology_progress[job_id] = {"progress": pct, "message": msg}

        result = discover_topology(
            devices,
            snmp_communities=snmp_communities,
            use_traceroute=use_traceroute,
            use_nmap_lldp=True,
            progress_callback=progress_cb,
        )

        topology_progress[job_id] = {
            "progress": 100,
            "message": f"Completed: {result['stats']['total_connections']} connections",
            "result": result,
            "status": "completed",
        }
    except Exception as e:
        topology_progress[job_id] = {
            "progress": 0,
            "message": f"Error: {e}",
            "status": "failed",
        }
    finally:
        db.close()


# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.get("/network-ranges")
async def get_network_ranges(current_user: User = Depends(get_current_user)):
    """Auto-detect local network ranges."""
    ranges = get_local_network_ranges()
    return {"ranges": ranges}


@router.post("/parse-ranges")
async def parse_ranges(request: dict, current_user: User = Depends(get_current_user)):
    """Parse and validate a multi-range input string before scanning."""
    raw = request.get("input", "")
    ranges = parse_ip_ranges(raw)
    host_count = estimate_host_count(ranges)
    return {
        "ranges": ranges,
        "count": len(ranges),
        "estimated_hosts": host_count,
        "valid": len(ranges) > 0,
    }


@router.post("/start", response_model=ScanJobResponse)
async def start_scan(
    request: ScanRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Validate ranges
    ranges = parse_ip_ranges(request.ip_range)
    if not ranges:
        raise HTTPException(status_code=400, detail=f"Invalid IP range: {request.ip_range}")

    # Store normalized range string in the job
    display_range = ", ".join(ranges)

    job = ScanJob(
        ip_range=display_range,
        status="pending",
        progress=0,
        owner_id=current_user.id
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    from ..config import get_settings
    settings = get_settings()

    background_tasks.add_task(
        run_scan_job,
        job.id,
        request.ip_range,
        request.scan_type,
        settings.database_url,
        request.run_topology,
        request.snmp_communities,
        request.use_traceroute,
    )

    return job


@router.post("/topology")
async def run_topology(
    request: TopologyRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user)
):
    """
    Run topology discovery on a list of already-scanned devices.
    Returns a job ID to poll for progress.
    """
    import time
    job_id = int(time.time() * 1000) % 1000000  # simple pseudo-ID

    from ..config import get_settings
    settings = get_settings()

    topology_progress[job_id] = {"progress": 0, "message": "Starting...", "status": "running"}

    background_tasks.add_task(
        run_topology_job,
        job_id,
        request.devices,
        request.snmp_communities or ["public", "private"],
        request.use_traceroute,
        settings.database_url,
    )

    return {"job_id": job_id, "status": "running"}


@router.get("/topology/{job_id}")
async def get_topology_result(
    job_id: int,
    current_user: User = Depends(get_current_user)
):
    """Poll topology discovery progress/results."""
    data = topology_progress.get(job_id)
    if not data:
        raise HTTPException(status_code=404, detail="Topology job not found")
    return data


@router.get("/jobs", response_model=List[ScanJobResponse])
async def list_jobs(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return (db.query(ScanJob)
            .filter(ScanJob.owner_id == current_user.id)
            .order_by(ScanJob.created_at.desc())
            .limit(20)
            .all())


@router.get("/jobs/{job_id}", response_model=ScanJobResponse)
async def get_job(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    job = db.query(ScanJob).filter(ScanJob.id == job_id, ScanJob.owner_id == current_user.id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.get("/jobs/{job_id}/progress")
async def get_job_progress(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    job = db.query(ScanJob).filter(ScanJob.id == job_id, ScanJob.owner_id == current_user.id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    mem_progress = scan_progress.get(job_id, {})

    # Parse results to count devices
    devices_count = 0
    topology_conns = 0
    try:
        raw = json.loads(job.results or "{}")
        if isinstance(raw, dict):
            devices_count = len(raw.get("devices", []))
            topo = raw.get("topology")
            if topo:
                topology_conns = topo.get("stats", {}).get("total_connections", 0)
        elif isinstance(raw, list):
            devices_count = len(raw)
    except Exception:
        pass

    return {
        "status": job.status,
        "progress": mem_progress.get("progress", job.progress),
        "message": mem_progress.get("message", ""),
        "results_count": devices_count,
        "topology_connections": topology_conns,
    }


@router.delete("/jobs/{job_id}")
async def delete_job(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    job = db.query(ScanJob).filter(ScanJob.id == job_id, ScanJob.owner_id == current_user.id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    db.delete(job)
    db.commit()
    return {"message": "Deleted"}


# ─── Network tools ───────────────────────────────────────────────────────────

@router.post("/tools/ping")
async def tool_ping(request: dict, current_user: User = Depends(get_current_user)):
    host = request.get("host", "")
    count = min(int(request.get("count", 4)), 10)
    if not host:
        raise HTTPException(status_code=400, detail="Host required")
    return run_ping(host, count)


@router.post("/tools/traceroute")
async def tool_traceroute(request: dict, current_user: User = Depends(get_current_user)):
    host = request.get("host", "")
    if not host:
        raise HTTPException(status_code=400, detail="Host required")
    return run_traceroute(host)


@router.post("/tools/dns")
async def tool_dns(request: dict, current_user: User = Depends(get_current_user)):
    host = request.get("host", "")
    if not host:
        raise HTTPException(status_code=400, detail="Host required")
    return run_dns_lookup(host)


@router.post("/tools/portscan")
async def tool_portscan(request: dict, current_user: User = Depends(get_current_user)):
    host = request.get("host", "")
    ports = request.get("ports", "1-1024")
    if not host:
        raise HTTPException(status_code=400, detail="Host required")
    return run_port_scan(host, ports)
