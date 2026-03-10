"""
Topology Discovery Module
=========================
Detects how network devices are connected using multiple strategies:

1. Subnet Inference    - always available, no config needed
2. Traceroute Hops     - reveals routing hierarchy
3. SNMP MAC Table      - exact switch port → device mapping
4. LLDP via SNMP       - neighbor discovery (Ubiquiti, TP-Link, etc.)
5. CDP via SNMP        - Cisco neighbor discovery
6. nmap LLDP/CDP scripts - alternative discovery path
"""

import subprocess
import socket
import ipaddress
import platform
import re
import os
import json
import concurrent.futures
from typing import Dict, List, Optional, Tuple, Set


# ─── SNMP OIDs ───────────────────────────────────────────────────────────────

# Bridge / MAC-address table (standard IEEE 802.1D)
OID_DOT1D_TP_FDB_PORT      = "1.3.6.1.2.1.17.4.3.1.2"   # MAC → bridge port index
OID_DOT1D_BASE_PORT_IFIDX  = "1.3.6.1.2.1.17.1.4.1.2"   # bridge port → ifIndex
OID_IF_DESCR               = "1.3.6.1.2.1.2.2.1.2"       # ifIndex → interface name
OID_IF_PHYS_ADDR           = "1.3.6.1.2.1.2.2.1.6"       # ifIndex → MAC

# LLDP (IEEE 802.1AB)
OID_LLDP_REM_SYS_NAME      = "1.0.8802.1.1.2.1.4.1.1.9"  # remote system name
OID_LLDP_REM_SYS_DESC      = "1.0.8802.1.1.2.1.4.1.1.10"
OID_LLDP_REM_MGMT_ADDR     = "1.0.8802.1.1.2.1.4.2.1.4"  # remote mgmt IP
OID_LLDP_REM_PORT_DESC     = "1.0.8802.1.1.2.1.4.1.1.8"
OID_LLDP_LOC_SYS_NAME      = "1.0.8802.1.1.2.1.3.3.0"    # local system name

# CDP (Cisco Discovery Protocol) - Cisco private MIB
OID_CDP_CACHE_ADDR         = "1.3.6.1.4.1.9.9.23.1.2.1.1.4"  # neighbor IP
OID_CDP_CACHE_DEVICE_ID    = "1.3.6.1.4.1.9.9.23.1.2.1.1.6"  # neighbor hostname
OID_CDP_CACHE_PLATFORM     = "1.3.6.1.4.1.9.9.23.1.2.1.1.8"  # neighbor model
OID_CDP_CACHE_IF_INDEX     = "1.3.6.1.4.1.9.9.23.1.2.1.1.2"  # local port

# sysDescr for vendor detection
OID_SYS_DESCR              = "1.3.6.1.2.1.1.1.0"
OID_SYS_NAME               = "1.3.6.1.2.1.1.5.0"


def _snmpwalk(ip: str, community: str, oid: str, timeout: int = 3) -> List[Tuple[str, str]]:
    """
    Run snmpwalk and return list of (oid_suffix, value) tuples.
    Works on Windows (if net-snmp installed) and Linux.
    """
    results = []
    try:
        cmd = ["snmpwalk", "-v2c", f"-c{community}", "-Onq", "-OQ", ip, oid]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout + 2)
        for line in result.stdout.splitlines():
            line = line.strip()
            if "=" in line:
                parts = line.split("=", 1)
                if len(parts) == 2:
                    key = parts[0].strip()
                    val = parts[1].strip()
                    # Extract suffix after the base OID
                    suffix = key.replace(f".{oid}", "").replace(oid, "").lstrip(".")
                    results.append((suffix, val))
    except (subprocess.TimeoutExpired, FileNotFoundError):
        pass
    except Exception:
        pass
    return results


def _snmpget(ip: str, community: str, oid: str, timeout: int = 2) -> Optional[str]:
    """Run snmpget for a single OID."""
    try:
        cmd = ["snmpget", "-v2c", f"-c{community}", "-Onq", "-OQ", ip, oid]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout + 1)
        if result.returncode == 0 and "=" in result.stdout:
            return result.stdout.split("=", 1)[1].strip().strip('"')
    except Exception:
        pass
    return None


def _snmp_available() -> bool:
    """Check if snmpwalk is available on this system."""
    try:
        subprocess.run(["snmpwalk", "--version"], capture_output=True, timeout=2)
        return True
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return False


# ─── TRACEROUTE TOPOLOGY ─────────────────────────────────────────────────────

def traceroute_hops(target: str, max_hops: int = 10) -> List[str]:
    """
    Run traceroute and return list of intermediate hop IPs.
    Returns ordered list: [hop1_ip, hop2_ip, ..., target]
    """
    system = platform.system().lower()
    hops = []
    try:
        if system == "windows":
            cmd = ["tracert", "-d", "-h", str(max_hops), "-w", "1000", target]
        else:
            cmd = ["traceroute", "-n", "-m", str(max_hops), "-w", "1", target]

        result = subprocess.run(cmd, capture_output=True, text=True, timeout=max_hops * 3 + 5)

        for line in result.stdout.splitlines():
            # Extract IPs from traceroute output
            ips = re.findall(r'\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b', line)
            for ip in ips:
                if ip not in hops and ip != "0.0.0.0":
                    # Skip private "Request timed out" placeholders
                    if not line.strip().startswith("*"):
                        hops.append(ip)
                        break
    except Exception:
        pass
    return hops


def build_traceroute_topology(devices: List[dict], gateway_ip: str = "") -> List[dict]:
    """
    Traceroute from scan host to each device to discover routing path.
    Returns list of proposed connections with confidence scores.
    """
    connections = []
    device_ips = {d["ip"] for d in devices}

    # Only trace to routers and switches first (faster)
    infra_devices = [d for d in devices if d["device_type"] in ("router", "switch")]
    if not infra_devices:
        infra_devices = devices[:min(10, len(devices))]  # limit tracing

    seen_pairs: Set[tuple] = set()

    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as ex:
        future_to_ip = {ex.submit(traceroute_hops, d["ip"]): d["ip"] for d in infra_devices}
        for future in concurrent.futures.as_completed(future_to_ip):
            target = future_to_ip[future]
            try:
                hops = future.result()
                # Build path connections
                path = [h for h in hops if h in device_ips]
                for i in range(len(path) - 1):
                    pair = tuple(sorted([path[i], path[i + 1]]))
                    if pair not in seen_pairs:
                        seen_pairs.add(pair)
                        connections.append({
                            "source": path[i],
                            "target": path[i + 1],
                            "type": "ethernet",
                            "method": "traceroute",
                            "confidence": 0.8,
                        })
            except Exception:
                pass

    return connections


# ─── SUBNET INFERENCE ────────────────────────────────────────────────────────

def infer_topology_by_subnet(devices: List[dict]) -> List[dict]:
    """
    Infer connections based on subnet membership and device type hierarchy.
    Strategy:
      - Router connects to all switches in same subnet
      - Switch connects to all endpoints (desktop/server/printer/AP) in same subnet
      - If no switch found, router connects directly to endpoints
      - APs connect to switch (or router)
      - Multiple switches: connect via uplink (assumed daisy-chain or to router)
    """
    connections = []
    seen_pairs: Set[tuple] = set()

    def add_conn(src: str, tgt: str, conn_type: str = "ethernet", method: str = "subnet-inference", confidence: float = 0.6):
        pair = tuple(sorted([src, tgt]))
        if pair not in seen_pairs and src != tgt:
            seen_pairs.add(pair)
            connections.append({
                "source": src,
                "target": tgt,
                "type": conn_type,
                "method": method,
                "confidence": confidence,
            })

    # Group devices by /24 subnet
    subnet_groups: Dict[str, List[dict]] = {}
    for d in devices:
        try:
            net = str(ipaddress.ip_network(f"{d['ip']}/24", strict=False))
            subnet_groups.setdefault(net, []).append(d)
        except Exception:
            pass

    for subnet, group in subnet_groups.items():
        routers  = [d for d in group if d["device_type"] == "router"]
        switches = [d for d in group if d["device_type"] == "switch"]
        aps      = [d for d in group if d["device_type"] == "ap_wifi"]
        servers  = [d for d in group if d["device_type"] == "server"]
        printers = [d for d in group if d["device_type"] == "printer"]
        desktops = [d for d in group if d["device_type"] in ("desktop", "unknown")]
        endpoints = servers + printers + desktops

        # Inter-router connections (multi-subnet): connect routers to each other
        # (handled below when multiple subnets share a router)

        if routers and switches:
            # Router → each switch
            for r in routers:
                for sw in switches:
                    add_conn(r["ip"], sw["ip"], "ethernet", "subnet-inference", 0.75)
            # Distribute endpoints to nearest switch by IP distance
            def ip_num(ip: str) -> int:
                parts = ip.split(".")
                return sum(int(p) << (8 * (3 - i)) for i, p in enumerate(parts))
            for ep in endpoints:
                nearest_sw = min(switches, key=lambda sw: abs(ip_num(sw["ip"]) - ip_num(ep["ip"])))
                add_conn(nearest_sw["ip"], ep["ip"], "ethernet", "subnet-inference", 0.65)
            # APs → nearest switch
            for ap in aps:
                nearest_sw = min(switches, key=lambda sw: abs(ip_num(sw["ip"]) - ip_num(ap["ip"])))
                add_conn(nearest_sw["ip"], ap["ip"], "ethernet", "subnet-inference", 0.70)

        elif routers and not switches:
            # Direct router → endpoints
            for r in routers:
                for ep in endpoints:
                    add_conn(r["ip"], ep["ip"], "ethernet", "subnet-inference", 0.60)
                for ap in aps:
                    add_conn(r["ip"], ap["ip"], "ethernet", "subnet-inference", 0.65)

        elif switches and not routers:
            # Switchless router subnet — switches connect to each other (uplink) or standalone
            for i in range(1, len(switches)):
                add_conn(switches[0]["ip"], switches[i]["ip"], "ethernet", "subnet-inference", 0.55)
            for sw in switches:
                for ep in endpoints:
                    add_conn(sw["ip"], ep["ip"], "ethernet", "subnet-inference", 0.60)
                for ap in aps:
                    add_conn(sw["ip"], ap["ip"], "ethernet", "subnet-inference", 0.65)

        elif not routers and not switches:
            # Flat network — try to find an implicit gateway (.1 or .254)
            gateway = None
            for d in group:
                last_octet = int(d["ip"].split(".")[-1])
                if last_octet in (1, 254):
                    gateway = d
                    break
            # Also try APs as uplink hubs
            if aps:
                for ap in aps:
                    for ep in endpoints:
                        add_conn(ap["ip"], ep["ip"], "wifi", "subnet-inference", 0.50)
            if gateway:
                for d in group:
                    if d["ip"] != gateway["ip"]:
                        add_conn(gateway["ip"], d["ip"], "ethernet", "subnet-inference", 0.45)

    # Cross-subnet: connect routers that share IP prefixes (e.g. /24 boundaries in a /16)
    all_routers = [d for d in devices if d["device_type"] == "router"]
    if len(all_routers) > 1:
        # Connect routers that are in adjacent /24 subnets (likely WAN uplink)
        for i in range(len(all_routers)):
            for j in range(i + 1, len(all_routers)):
                r1, r2 = all_routers[i], all_routers[j]
                # If same /16 prefix, likely connected
                net1 = ipaddress.ip_address(r1["ip"])
                net2 = ipaddress.ip_address(r2["ip"])
                if int(net1) >> 16 == int(net2) >> 16:
                    add_conn(r1["ip"], r2["ip"], "wan", "subnet-inference", 0.55)

    return connections


# ─── SNMP TOPOLOGY ───────────────────────────────────────────────────────────

def discover_snmp_lldp(ip: str, community: str = "public") -> List[dict]:
    """
    Query LLDP neighbor table via SNMP.
    Works with: Ubiquiti, TP-Link TL-SG series, HP ProCurve, Cisco (also supports LLDP).
    Returns list of neighbor info dicts.
    """
    neighbors = []
    if not _snmp_available():
        return neighbors

    # Get local system name
    local_name = _snmpget(ip, community, OID_LLDP_LOC_SYS_NAME) or ip

    # Walk LLDP remote system names
    name_entries = _snmpwalk(ip, community, OID_LLDP_REM_SYS_NAME)
    mgmt_entries  = dict(_snmpwalk(ip, community, OID_LLDP_REM_MGMT_ADDR))
    port_entries  = dict(_snmpwalk(ip, community, OID_LLDP_REM_PORT_DESC))

    for suffix, remote_name in name_entries:
        # suffix format: <time_mark>.<local_portnum>.<remote_index>
        parts = suffix.split(".")
        local_port = parts[1] if len(parts) >= 2 else "?"

        # Try to get remote management IP
        remote_ip = ""
        for mgmt_key, mgmt_val in mgmt_entries.items():
            if f".{local_port}." in mgmt_key:
                # Extract IP from OID suffix (last 4 octets)
                ip_match = re.search(r'(\d+\.\d+\.\d+\.\d+)', mgmt_key)
                if ip_match:
                    remote_ip = ip_match.group(1)
                    break

        remote_port = port_entries.get(suffix, "")
        remote_name_clean = remote_name.strip('"').strip()

        neighbors.append({
            "local_ip": ip,
            "local_name": local_name,
            "local_port": local_port,
            "remote_ip": remote_ip,
            "remote_name": remote_name_clean,
            "remote_port": remote_port,
            "protocol": "LLDP",
        })

    return neighbors


def discover_snmp_cdp(ip: str, community: str = "public") -> List[dict]:
    """
    Query CDP neighbor table via SNMP (Cisco devices).
    """
    neighbors = []
    if not _snmp_available():
        return neighbors

    local_name = _snmpget(ip, community, OID_SYS_NAME) or ip

    device_entries  = dict(_snmpwalk(ip, community, OID_CDP_CACHE_DEVICE_ID))
    addr_entries    = dict(_snmpwalk(ip, community, OID_CDP_CACHE_ADDR))
    platform_entries = dict(_snmpwalk(ip, community, OID_CDP_CACHE_PLATFORM))

    for suffix, device_id in device_entries.items():
        # suffix: <ifIndex>.<cdpCacheEntryIndex>
        parts = suffix.split(".")
        if_index = parts[0] if parts else "?"

        remote_ip = addr_entries.get(suffix, "")
        # CDP addr is hex-encoded: extract IP
        if remote_ip:
            hex_match = re.findall(r'[0-9A-Fa-f]{2}', remote_ip.replace(":", ""))
            if len(hex_match) >= 4:
                try:
                    remote_ip = ".".join(str(int(h, 16)) for h in hex_match[-4:])
                except Exception:
                    remote_ip = ""

        platform_str = platform_entries.get(suffix, "").strip('"')
        device_id_clean = device_id.strip('"').strip()

        neighbors.append({
            "local_ip": ip,
            "local_name": local_name,
            "local_port": if_index,
            "remote_ip": remote_ip,
            "remote_name": device_id_clean,
            "remote_platform": platform_str,
            "protocol": "CDP",
        })

    return neighbors


def discover_snmp_mac_table(ip: str, community: str = "public") -> Dict[str, List[str]]:
    """
    Read the switch MAC address table to know which MAC is on which port.
    Returns dict: {port_name: [mac1, mac2, ...]}
    """
    port_macs: Dict[str, List[str]] = {}
    if not _snmp_available():
        return port_macs

    # MAC → bridge port index
    fdb_entries = dict(_snmpwalk(ip, community, OID_DOT1D_TP_FDB_PORT))
    # bridge port → ifIndex
    port_to_ifidx = dict(_snmpwalk(ip, community, OID_DOT1D_BASE_PORT_IFIDX))
    # ifIndex → interface description
    if_descr = dict(_snmpwalk(ip, community, OID_IF_DESCR))

    for mac_suffix, port_idx in fdb_entries.items():
        # mac_suffix is MAC in dotted-decimal: 0.26.184.x.x.x
        try:
            octets = mac_suffix.split(".")
            if len(octets) == 6:
                mac = ":".join(f"{int(o):02X}" for o in octets)
            else:
                continue
        except Exception:
            continue

        # Resolve port name
        ifidx = port_to_ifidx.get(port_idx.strip(), "")
        port_name = if_descr.get(ifidx.strip(), f"port-{port_idx}").strip().strip('"')

        port_macs.setdefault(port_name, []).append(mac)

    return port_macs


# ─── NMAP LLDP/CDP DISCOVERY ─────────────────────────────────────────────────

def discover_nmap_lldp(ip: str) -> List[dict]:
    """
    Use nmap lldp-discovery script to find LLDP neighbors.
    Works passively — listens for LLDP frames (needs root/admin).
    """
    neighbors = []
    try:
        result = subprocess.run(
            ["nmap", "-sU", "-p", "161", "--script=lldp-discovery", ip],
            capture_output=True, text=True, timeout=20
        )
        output = result.stdout

        # Parse nmap lldp-discovery output
        current = {}
        for line in output.splitlines():
            line = line.strip()
            if "System Name:" in line:
                current["remote_name"] = line.split(":", 1)[1].strip()
            elif "Management Address:" in line:
                addr = line.split(":", 1)[1].strip()
                ip_match = re.search(r'\d+\.\d+\.\d+\.\d+', addr)
                if ip_match:
                    current["remote_ip"] = ip_match.group()
            elif "Port Description:" in line:
                current["remote_port"] = line.split(":", 1)[1].strip()
            elif "System Description:" in line:
                current["remote_desc"] = line.split(":", 1)[1].strip()

        if current:
            current.update({"local_ip": ip, "protocol": "LLDP-nmap"})
            neighbors.append(current)

    except (subprocess.TimeoutExpired, FileNotFoundError):
        pass
    return neighbors


# ─── MAIN TOPOLOGY DISCOVERY ────────────────────────────────────────────────

def discover_topology(
    devices: List[dict],
    snmp_communities: List[str] = None,
    use_traceroute: bool = True,
    use_nmap_lldp: bool = True,
    progress_callback=None,
) -> dict:
    """
    Full topology discovery combining all available methods.

    Returns:
      {
        "connections": [...],          # all proposed connections
        "neighbor_data": [...],        # raw LLDP/CDP neighbor info
        "mac_tables": {...},           # SNMP MAC tables per switch
        "methods_used": [...],
        "stats": {...},
      }
    """
    if snmp_communities is None:
        snmp_communities = ["public", "private", "community"]

    all_connections: List[dict] = []
    neighbor_data: List[dict] = []
    mac_tables: Dict[str, dict] = {}
    methods_used = []

    device_by_ip  = {d["ip"]: d for d in devices}
    device_by_mac = {d["mac"].upper(): d for d in devices if d.get("mac")}

    total_steps = (
        1 +                                    # subnet inference
        (len(devices[:8]) if use_traceroute else 0) +  # traceroute
        len([d for d in devices if d["device_type"] in ("switch", "router")]) +  # SNMP
        1                                      # finalize
    )
    current_step = 0

    def progress(msg: str):
        nonlocal current_step
        current_step += 1
        if progress_callback:
            pct = min(95, int((current_step / max(total_steps, 1)) * 95))
            progress_callback(pct, msg)

    # ── Step 1: Subnet inference (always) ────────────────────────────────────
    progress("Analyzing subnets and inferring connections...")
    subnet_conns = infer_topology_by_subnet(devices)
    for c in subnet_conns:
        all_connections.append(c)
    methods_used.append("subnet-inference")
    progress(f"Subnet inference: {len(subnet_conns)} proposed connections")

    # ── Step 2: Traceroute (reveals routing path) ────────────────────────────
    if use_traceroute and len(devices) > 0:
        progress("Running traceroute to detect routing hierarchy...")
        try:
            tr_conns = build_traceroute_topology(devices)
            # Merge: traceroute has higher confidence than subnet inference
            existing_pairs = {tuple(sorted([c["source"], c["target"]])): i
                              for i, c in enumerate(all_connections)}
            for c in tr_conns:
                pair = tuple(sorted([c["source"], c["target"]]))
                if pair in existing_pairs:
                    # Upgrade confidence
                    all_connections[existing_pairs[pair]]["confidence"] = max(
                        all_connections[existing_pairs[pair]]["confidence"],
                        c["confidence"]
                    )
                    all_connections[existing_pairs[pair]]["method"] += "+traceroute"
                else:
                    all_connections.append(c)
            methods_used.append("traceroute")
            progress(f"Traceroute complete: {len(tr_conns)} connections confirmed")
        except Exception as e:
            progress(f"Traceroute skipped: {e}")

    # ── Step 3: SNMP on switches/routers ────────────────────────────────────
    infra = [d for d in devices if d["device_type"] in ("switch", "router")]
    snmp_ok = _snmp_available()

    if infra:
        for device in infra:
            ip = device["ip"]
            found_community = None

            for community in snmp_communities:
                # Quick test: can we reach SNMP?
                sysname = _snmpget(ip, community, OID_SYS_NAME, timeout=2)
                if sysname:
                    found_community = community
                    break

            if not found_community:
                if snmp_ok:
                    progress(f"SNMP: {ip} not responding (invalid community)")
                continue

            progress(f"SNMP: querying {ip} (community={found_community})...")

            # Detect protocol support: try LLDP first, then CDP
            lldp_neighbors = discover_snmp_lldp(ip, found_community)
            cdp_neighbors  = discover_snmp_cdp(ip, found_community)
            all_neighbors  = lldp_neighbors + cdp_neighbors

            if all_neighbors:
                methods_used.append(f"snmp-lldp/cdp@{ip}")
                for nb in all_neighbors:
                    neighbor_data.append(nb)
                    remote_ip = nb.get("remote_ip", "")
                    if remote_ip and remote_ip in device_by_ip:
                        # Direct match: confirmed connection
                        pair = tuple(sorted([ip, remote_ip]))
                        existing = {tuple(sorted([c["source"], c["target"]])): i
                                    for i, c in enumerate(all_connections)}
                        if pair in existing:
                            all_connections[existing[pair]]["confidence"] = 0.98
                            all_connections[existing[pair]]["method"] = f"snmp-{nb['protocol'].lower()}"
                        else:
                            all_connections.append({
                                "source": ip,
                                "target": remote_ip,
                                "type": "ethernet",
                                "method": f"snmp-{nb['protocol'].lower()}",
                                "confidence": 0.98,
                                "label": f"{nb.get('local_port','')}↔{nb.get('remote_port','')}".strip("↔"),
                            })
                progress(f"SNMP {nb['protocol']}: {len(all_neighbors)} neighbors on {ip}")

            # MAC address table → map MACs to switch
            mac_table = discover_snmp_mac_table(ip, found_community)
            if mac_table:
                mac_tables[ip] = mac_table
                methods_used.append(f"snmp-mactable@{ip}")

                for port_name, macs in mac_table.items():
                    for mac in macs:
                        end_device = device_by_mac.get(mac.upper())
                        if end_device and end_device["ip"] != ip:
                            pair = tuple(sorted([ip, end_device["ip"]]))
                            existing = {tuple(sorted([c["source"], c["target"]])): i
                                        for i, c in enumerate(all_connections)}
                            if pair in existing:
                                all_connections[existing[pair]]["confidence"] = 0.95
                                all_connections[existing[pair]]["method"] = "snmp-mactable"
                                all_connections[existing[pair]]["label"] = port_name
                            else:
                                all_connections.append({
                                    "source": ip,
                                    "target": end_device["ip"],
                                    "type": "ethernet",
                                    "method": "snmp-mactable",
                                    "confidence": 0.95,
                                    "label": port_name,
                                })

    # ── Step 4: nmap LLDP (if snmpwalk not available) ───────────────────────
    if use_nmap_lldp and not snmp_ok and infra:
        progress("snmpwalk not available, trying nmap LLDP...")
        for device in infra[:5]:  # limit
            nmap_nb = discover_nmap_lldp(device["ip"])
            for nb in nmap_nb:
                neighbor_data.append(nb)
                remote_ip = nb.get("remote_ip", "")
                if remote_ip and remote_ip in device_by_ip:
                    all_connections.append({
                        "source": device["ip"],
                        "target": remote_ip,
                        "type": "ethernet",
                        "method": "nmap-lldp",
                        "confidence": 0.90,
                    })
        if nmap_nb:
            methods_used.append("nmap-lldp")

    # ── Step 5: Deduplicate and sort by confidence ───────────────────────────
    progress("Consolidando resultados...")
    seen: Dict[tuple, int] = {}
    final_connections = []
    for c in all_connections:
        pair = tuple(sorted([c["source"], c["target"]]))
        if pair not in seen:
            seen[pair] = len(final_connections)
            final_connections.append(c)
        else:
            # Keep higher confidence
            existing_idx = seen[pair]
            if c["confidence"] > final_connections[existing_idx]["confidence"]:
                final_connections[existing_idx] = c

    final_connections.sort(key=lambda x: x["confidence"], reverse=True)

    if progress_callback:
        progress_callback(100, f"Topology complete: {len(final_connections)} connections, {len(neighbor_data)} LLDP/CDP neighbors")

    return {
        "connections": final_connections,
        "neighbor_data": neighbor_data,
        "mac_tables": mac_tables,
        "methods_used": list(set(methods_used)),
        "stats": {
            "total_connections": len(final_connections),
            "high_confidence": len([c for c in final_connections if c["confidence"] >= 0.9]),
            "medium_confidence": len([c for c in final_connections if 0.6 <= c["confidence"] < 0.9]),
            "low_confidence": len([c for c in final_connections if c["confidence"] < 0.6]),
            "lldp_cdp_neighbors": len(neighbor_data),
        },
    }


# ─── MULTI-RANGE PARSER ──────────────────────────────────────────────────────

def parse_ip_ranges(ranges_input: str) -> List[str]:
    """
    Parse flexible IP range input into list of CIDR strings.

    Supports:
      - Single CIDR:            192.168.1.0/24
      - Comma-separated CIDRs:  10.0.1.0/24, 10.0.2.0/24
      - Range with dash:        10.0.1.0-10.0.20.255
      - Range shorthand:        192.168.1.0-50  (last octet range)
      - Multiple lines
    """
    result = []
    # Normalize separators
    raw = ranges_input.replace("\n", ",").replace(";", ",").replace(" ", ",")
    parts = [p.strip() for p in raw.split(",") if p.strip()]

    for part in parts:
        # CIDR notation
        if "/" in part:
            try:
                net = ipaddress.ip_network(part, strict=False)
                result.append(str(net))
                continue
            except ValueError:
                pass

        # Full range: 10.0.1.0-10.0.20.255
        if "-" in part:
            dash_parts = part.split("-", 1)
            start_str = dash_parts[0].strip()
            end_str   = dash_parts[1].strip()

            # Shorthand: 192.168.1.1-50 (end is just last octet)
            if "." not in end_str:
                base = ".".join(start_str.split(".")[:3])
                end_str = f"{base}.{end_str}"

            try:
                start_addr = ipaddress.ip_address(start_str)
                end_addr   = ipaddress.ip_address(end_str)
                # summarize_address_range returns minimal list of CIDRs
                for net in ipaddress.summarize_address_range(start_addr, end_addr):
                    result.append(str(net))
                continue
            except ValueError:
                pass

        # Plain IP address (scan as /32)
        try:
            ipaddress.ip_address(part)
            result.append(f"{part}/32")
            continue
        except ValueError:
            pass

    # Deduplicate while preserving order
    seen = set()
    unique = []
    for r in result:
        if r not in seen:
            seen.add(r)
            unique.append(r)

    return unique


def estimate_host_count(ranges: List[str]) -> int:
    """Estimate total number of hosts to scan."""
    total = 0
    for r in ranges:
        try:
            net = ipaddress.ip_network(r, strict=False)
            total += max(net.num_addresses - 2, 1)
        except Exception:
            pass
    return min(total, 4096)  # safety cap
