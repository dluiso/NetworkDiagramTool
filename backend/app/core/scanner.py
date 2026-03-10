import subprocess
import socket
import ipaddress
import platform
import re
import json
import os
import concurrent.futures
import asyncio
from typing import Dict, List, Optional, Tuple
from datetime import datetime

# Add nmap to PATH on Windows
if platform.system().lower() == "windows":
    nmap_paths = [
        r"C:\Program Files (x86)\Nmap",
        r"C:\Program Files\Nmap",
    ]
    for p in nmap_paths:
        if os.path.exists(p) and p not in os.environ.get("PATH", ""):
            os.environ["PATH"] = p + os.pathsep + os.environ.get("PATH", "")


# MAC vendor OUI prefix lookup (partial list of common vendors)
MAC_VENDORS = {
    "00:00:0c": "Cisco", "00:01:42": "Cisco", "00:01:43": "Cisco",
    "00:04:96": "Extreme Networks", "00:0f:bb": "Dell",
    "00:10:18": "Broadcom", "00:11:43": "Dell",
    "00:14:22": "Dell", "00:17:a4": "Cisco",
    "00:18:71": "Cisco", "00:1a:2b": "HP",
    "00:1b:78": "Apple", "00:1c:b3": "Apple",
    "00:1d:4f": "Apple", "00:21:70": "Dell",
    "00:23:ae": "Cisco", "00:25:b3": "HP",
    "00:26:b9": "Dell", "00:50:56": "VMware",
    "00:50:ba": "D-Link", "00:60:2f": "Cisco",
    "00:60:70": "Cisco", "00:80:5f": "HP",
    "00:90:27": "Intel", "00:a0:c9": "Intel",
    "00:d0:59": "Ambit", "08:00:09": "HP",
    "08:00:20": "Sun", "08:00:69": "Silicon Graphics",
    "0c:29": "VMware", "18:03:73": "Apple",
    "18:65:90": "Apple", "1c:1b:0d": "HP",
    "20:89:84": "Juniper", "24:b6:57": "Apple",
    "28:6e:d4": "Apple", "2c:27:d7": "HP",
    "30:10:b3": "Dell", "34:40:b5": "HP",
    "38:2c:4a": "HP", "3c:07:54": "Apple",
    "40:6c:8f": "Apple", "44:ac:60": "Apple",
    "48:5b:39": "Cisco", "4c:32:75": "Apple",
    "50:06:04": "Apple", "50:7b:9d": "Apple",
    "54:1f:d5": "Apple", "58:b0:35": "Apple",
    "5c:35:3b": "Apple", "60:33:4b": "Apple",
    "64:5a:04": "Apple", "68:5b:35": "Cisco",
    "6c:40:08": "Apple", "70:cd:60": "Apple",
    "74:e1:b6": "Apple", "78:31:c1": "Apple",
    "7c:d1:c3": "Cisco", "80:e6:50": "Apple",
    "84:38:35": "Apple", "88:1d:fc": "Apple",
    "8c:2d:aa": "Apple", "90:27:e4": "Apple",
    "90:72:40": "Apple", "94:de:80": "Apple",
    "98:01:a7": "Apple", "9c:e6:5e": "Apple",
    "a0:99:9b": "Apple", "a4:5e:60": "Apple",
    "a8:20:66": "Apple", "ac:bc:32": "Apple",
    "b0:34:95": "Apple", "b4:18:d1": "Apple",
    "b8:09:8a": "Apple", "bc:52:b7": "Apple",
    "c0:3f:d5": "Apple", "c4:2c:03": "Apple",
    "c8:2a:14": "Apple", "cc:29:f5": "Apple",
    "d0:23:db": "Apple", "d4:9a:20": "Apple",
    "d8:00:4d": "Apple", "dc:2b:2a": "Apple",
    "e0:ac:cb": "Apple", "e4:25:e7": "Apple",
    "e8:04:0b": "Apple", "ec:35:86": "Apple",
    "f0:18:98": "Apple", "f4:31:c3": "Apple",
    "f8:1e:df": "Apple", "fc:f8:ae": "Cisco",
}


def get_mac_vendor(mac: str) -> str:
    if not mac:
        return "Unknown"
    mac_lower = mac.lower().replace("-", ":").replace(".", ":")
    # Try 6-char, 8-char prefix
    for length in [8, 5, 2]:  # 00:11:22, 00:11, 00
        prefix = mac_lower[:length + (length // 2)]
        for k, v in MAC_VENDORS.items():
            if mac_lower.startswith(k.lower()):
                return v
    return "Unknown"


def ping_host(ip: str, timeout_ms: int = 500) -> bool:
    """Ping a single host. Returns True if alive."""
    system = platform.system().lower()
    if system == "windows":
        cmd = ["ping", "-n", "1", "-w", str(timeout_ms), str(ip)]
    else:
        cmd = ["ping", "-c", "1", "-W", "1", str(ip)]
    try:
        result = subprocess.run(cmd, capture_output=True, timeout=3)
        return result.returncode == 0
    except Exception:
        return False


def get_hostname(ip: str) -> str:
    """Reverse DNS lookup."""
    try:
        return socket.gethostbyaddr(ip)[0]
    except Exception:
        return ""


def get_arp_table() -> Dict[str, str]:
    """Parse ARP table to get IP→MAC mappings."""
    entries = {}
    try:
        result = subprocess.run(["arp", "-a"], capture_output=True, text=True, timeout=10)
        output = result.stdout
        # Windows format: 192.168.1.1          aa-bb-cc-dd-ee-ff     dynamic
        # Linux format:  192.168.1.1    ether   aa:bb:cc:dd:ee:ff   C   eth0
        for line in output.splitlines():
            # Match IP address
            ip_match = re.search(r'(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})', line)
            # Match MAC address (both formats)
            mac_match = re.search(r'([0-9a-fA-F]{2}[:\-][0-9a-fA-F]{2}[:\-][0-9a-fA-F]{2}[:\-][0-9a-fA-F]{2}[:\-][0-9a-fA-F]{2}[:\-][0-9a-fA-F]{2})', line)
            if ip_match and mac_match:
                ip = ip_match.group(1)
                mac = mac_match.group(1).replace("-", ":").upper()
                if not mac.startswith("FF:FF"):  # skip broadcast
                    entries[ip] = mac
    except Exception:
        pass
    return entries


def scan_ports(ip: str, ports: List[int] = None) -> List[int]:
    """Scan common ports to help classify the device."""
    if ports is None:
        ports = [21, 22, 23, 25, 53, 80, 110, 135, 139, 143, 161,
                 443, 445, 515, 548, 554, 3306, 3389, 5900, 8080, 8443, 9100]
    open_ports = []
    for port in ports:
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(0.3)
            if sock.connect_ex((ip, port)) == 0:
                open_ports.append(port)
            sock.close()
        except Exception:
            pass
    return open_ports


def classify_device(
    hostname: str,
    open_ports: List[int],
    mac_vendor: str = "",
    ip: str = ""
) -> str:
    """
    Classify device type based on available info.
    Returns: desktop | server | switch | router | printer | ap_wifi | phone | unknown
    """
    hostname_lower = (hostname or "").lower()
    vendor_lower = (mac_vendor or "").lower()
    ip_last = int(ip.split(".")[-1]) if ip and ip.count(".") == 3 else -1

    # --- Hostname patterns ---
    if any(x in hostname_lower for x in ["switch", "-sw-", "_sw_", "sw-", "sw_", "catalyst", "procurve"]):
        return "switch"
    if any(x in hostname_lower for x in ["router", "-rt-", "_rt_", "rt-", "rt_", "gateway", "gw-", "gw_", "mikrotik", "ubnt"]):
        return "router"
    if any(x in hostname_lower for x in ["ap-", "ap_", "-ap", "_ap", "wap", "wifi", "wireless", "unifi", "access-point"]):
        return "ap_wifi"
    if any(x in hostname_lower for x in ["srv", "server", "dc-", "dc_", "nas", "fileserver", "webserver", "mail", "backup"]):
        return "server"
    if any(x in hostname_lower for x in ["printer", "print", "mfp", "copier", "kyocera", "ricoh", "konica", "xerox", "epson-", "canon-", "hp-"]):
        return "printer"
    # IP Phone / VoIP hostname patterns
    if any(x in hostname_lower for x in ["phone", "voip", "sip-", "cisco-ip", "polycom", "yealink", "grandstream", "snom", "aastra", "avaya", "tel-"]):
        return "phone"

    # --- Port-based detection ---
    # Printer: JetDirect 9100, LPD 515
    if 9100 in open_ports or 515 in open_ports:
        return "printer"
    # VoIP / SIP phone: 5060 (SIP), 5061 (SIP-TLS), 1720 (H.323)
    if any(p in open_ports for p in [5060, 5061, 1720]):
        return "phone"
    # SNMP only (network equipment) + no web → switch/router
    if 161 in open_ports and 80 not in open_ports and 443 not in open_ports:
        return "switch"
    # RDP → Windows desktop/server
    if 3389 in open_ports:
        if any(x in hostname_lower for x in ["srv", "server", "dc"]):
            return "server"
        return "desktop"
    # SSH + HTTP/HTTPS → likely server
    if 22 in open_ports and (80 in open_ports or 443 in open_ports):
        return "server"
    # Telnet + SNMP → network equipment
    if 23 in open_ports and 161 in open_ports:
        return "switch"
    # VNC → desktop
    if 5900 in open_ports:
        return "desktop"

    # --- IP-based heuristics ---
    if ip_last == 1 or ip_last == 254:
        return "router"  # .1 and .254 are usually gateways

    # --- Vendor-based detection ---
    # VoIP vendors (check before generic network vendors)
    if any(x in vendor_lower for x in ["polycom", "yealink", "grandstream", "snom", "aastra", "gigaset", "mitel"]):
        return "phone"
    if any(x in vendor_lower for x in ["cisco", "juniper", "extreme", "arista", "netgear", "d-link", "tp-link", "zyxel", "ubiquiti"]):
        if any(x in vendor_lower for x in ["cisco", "juniper", "extreme", "arista"]):
            return "switch"
        return "ap_wifi"
    if any(x in vendor_lower for x in ["hewlett", "hp", "kyocera", "ricoh", "canon", "epson", "lexmark", "brother", "konica"]):
        if 9100 in open_ports or 515 in open_ports:
            return "printer"
    if any(x in vendor_lower for x in ["vmware", "proxmox"]):
        return "server"

    return "desktop"


def get_local_network_ranges() -> List[str]:
    """Detect local network ranges using ipconfig/ip addr."""
    ranges = []
    try:
        system = platform.system().lower()
        if system == "windows":
            result = subprocess.run(["ipconfig"], capture_output=True, text=True, timeout=10)
            output = result.stdout
            # Find IPv4 addresses and subnet masks
            ips = re.findall(r'IPv4 Address[^:]*:\s*([\d.]+)', output)
            masks = re.findall(r'Subnet Mask[^:]*:\s*([\d.]+)', output)
            for ip, mask in zip(ips, masks):
                if not ip.startswith("127."):
                    try:
                        network = ipaddress.IPv4Network(f"{ip}/{mask}", strict=False)
                        ranges.append(str(network))
                    except Exception:
                        pass
        else:
            result = subprocess.run(["ip", "addr", "show"], capture_output=True, text=True, timeout=10)
            for match in re.finditer(r'inet\s+([\d.]+/\d+)', result.stdout):
                cidr = match.group(1)
                if not cidr.startswith("127."):
                    try:
                        network = ipaddress.IPv4Network(cidr, strict=False)
                        ranges.append(str(network))
                    except Exception:
                        pass
    except Exception:
        pass

    if not ranges:
        ranges = ["192.168.1.0/24"]
    return ranges


def scan_network(ip_range: str, progress_callback=None) -> List[dict]:
    """
    Full network scan: ping sweep → ARP → hostname → ports → classify.
    Returns list of device dicts.
    """
    devices = []

    try:
        network = ipaddress.ip_network(ip_range, strict=False)
    except ValueError:
        return []

    hosts = list(network.hosts())
    total = len(hosts)
    if total > 512:
        hosts = hosts[:512]  # Safety limit

    if progress_callback:
        progress_callback(5, f"Starting ping sweep on {ip_range} ({len(hosts)} hosts)...")

    # Step 1: Ping sweep
    alive_ips = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=50) as executor:
        future_to_ip = {executor.submit(ping_host, str(ip)): str(ip) for ip in hosts}
        completed = 0
        for future in concurrent.futures.as_completed(future_to_ip):
            ip = future_to_ip[future]
            completed += 1
            try:
                if future.result():
                    alive_ips.append(ip)
            except Exception:
                pass
            if progress_callback and completed % 10 == 0:
                pct = 5 + int((completed / len(hosts)) * 40)
                progress_callback(pct, f"Ping sweep: {completed}/{len(hosts)} — {len(alive_ips)} active")

    if progress_callback:
        progress_callback(50, f"Ping sweep complete. {len(alive_ips)} active hosts found. Gathering details...")

    # Step 2: Get ARP table
    arp_table = get_arp_table()

    # Step 3: For each alive host, get details
    def enrich_host(ip: str) -> dict:
        hostname = get_hostname(ip)
        mac = arp_table.get(ip, "")
        vendor = get_mac_vendor(mac) if mac else ""
        open_ports = scan_ports(ip)
        device_type = classify_device(hostname, open_ports, vendor, ip)
        return {
            "ip": ip,
            "hostname": hostname or ip,
            "mac": mac,
            "vendor": vendor,
            "device_type": device_type,
            "open_ports": open_ports,
            "status": "online",
            "custom_name": "",
            "custom_type": "",
            "notes": "",
        }

    with concurrent.futures.ThreadPoolExecutor(max_workers=20) as executor:
        future_to_ip = {executor.submit(enrich_host, ip): ip for ip in alive_ips}
        completed = 0
        for future in concurrent.futures.as_completed(future_to_ip):
            completed += 1
            try:
                device = future.result()
                devices.append(device)
            except Exception:
                pass
            if progress_callback:
                pct = 50 + int((completed / max(len(alive_ips), 1)) * 45)
                progress_callback(pct, f"Enriching device data: {completed}/{len(alive_ips)}")

    if progress_callback:
        progress_callback(98, f"Scan complete. {len(devices)} devices found.")

    # Sort by IP
    devices.sort(key=lambda d: ipaddress.ip_address(d["ip"]))
    return devices


def _find_nmap_executable() -> Optional[str]:
    """Locate nmap executable on Windows by checking common install paths."""
    if platform.system().lower() != "windows":
        return None
    candidates = [
        r"C:\Program Files\Nmap\nmap.exe",
        r"C:\Program Files (x86)\Nmap\nmap.exe",
        os.path.join(os.environ.get("LOCALAPPDATA", ""), "Programs", "Nmap", "nmap.exe"),
        os.path.join(os.environ.get("PROGRAMFILES", ""), "Nmap", "nmap.exe"),
        os.path.join(os.environ.get("PROGRAMFILES(X86)", ""), "Nmap", "nmap.exe"),
    ]
    for path in candidates:
        if path and os.path.isfile(path):
            return path
    # Also try shutil.which after PATH manipulation
    import shutil
    return shutil.which("nmap") or shutil.which("nmap.exe")


# Optional nmap integration
def scan_network_nmap(ip_range: str, progress_callback=None) -> List[dict]:
    """Use nmap for enhanced scanning if available."""
    try:
        import nmap

        # On Windows, find nmap.exe explicitly and pass it to PortScanner
        nmap_path = _find_nmap_executable()
        if nmap_path:
            search_path = (nmap_path,)
            nm = nmap.PortScanner(nmap_search_path=search_path)
        else:
            nm = nmap.PortScanner()

        if progress_callback:
            progress_callback(10, "Starting nmap scan...")

        nm.scan(hosts=ip_range, arguments="-sV -O --host-timeout 30s -T4")

        if progress_callback:
            progress_callback(70, "Processing nmap results...")

        devices = []
        for host in nm.all_hosts():
            if nm[host].state() == "up":
                hostname = nm[host].hostname() or host
                mac = nm[host]["addresses"].get("mac", "")
                vendor = nm[host].get("vendor", {}).get(mac, "") if mac else ""
                open_ports = [p for p in nm[host].get("tcp", {}).keys()]
                device_type = classify_device(hostname, open_ports, vendor, host)

                devices.append({
                    "ip": host,
                    "hostname": hostname,
                    "mac": mac,
                    "vendor": vendor,
                    "device_type": device_type,
                    "open_ports": open_ports,
                    "status": "online",
                    "custom_name": "",
                    "custom_type": "",
                    "notes": "",
                    "os_info": str(nm[host].get("osmatch", [{}])[0].get("name", "")) if nm[host].get("osmatch") else "",
                })

        if progress_callback:
            progress_callback(98, f"Nmap complete. {len(devices)} devices found.")

        return devices

    except ImportError:
        if progress_callback:
            progress_callback(5, "Nmap not available — falling back to built-in scanner...")
        return scan_network(ip_range, progress_callback)
    except Exception as e:
        err_msg = str(e)
        if "nmap program was not found" in err_msg or "not found in path" in err_msg.lower():
            nmap_path = _find_nmap_executable()
            if nmap_path:
                friendly = f"Nmap found at {nmap_path} but could not be launched. Try running the backend as administrator — using built-in scanner."
            else:
                friendly = "Nmap executable not found. Ensure nmap is installed (https://nmap.org/download) and its folder is in PATH — using built-in scanner."
        else:
            friendly = f"Nmap error: {e} — using built-in scanner."
        if progress_callback:
            progress_callback(5, friendly)
        return scan_network(ip_range, progress_callback)


def scan_multiple_ranges(ip_ranges: List[str], scan_type: str = "basic", progress_callback=None) -> List[dict]:
    """
    Scan multiple IP ranges and merge results (deduplicating by IP).
    ip_ranges: list of CIDR strings (already parsed by parse_ip_ranges)
    """
    all_devices: Dict[str, dict] = {}  # ip → device
    total_ranges = len(ip_ranges)

    for idx, ip_range in enumerate(ip_ranges):
        range_pct_start = int((idx / total_ranges) * 95)
        range_pct_end   = int(((idx + 1) / total_ranges) * 95)

        def range_progress(pct: int, msg: str):
            # Scale pct within this range's slice
            scaled = range_pct_start + int((pct / 100) * (range_pct_end - range_pct_start))
            if progress_callback:
                prefix = f"[{idx+1}/{total_ranges}] {ip_range}: "
                progress_callback(scaled, prefix + msg)

        if progress_callback:
            progress_callback(range_pct_start, f"Scanning range {idx+1}/{total_ranges}: {ip_range}")

        try:
            if scan_type == "nmap":
                devices = scan_network_nmap(ip_range, range_progress)
            else:
                devices = scan_network(ip_range, range_progress)

            for d in devices:
                ip = d["ip"]
                if ip not in all_devices:
                    all_devices[ip] = d
                    # Track which range found this device
                    all_devices[ip]["source_range"] = ip_range
        except Exception as e:
            if progress_callback:
                progress_callback(range_pct_end, f"Error en {ip_range}: {e}")

    if progress_callback:
        progress_callback(98, f"Multi-range scan complete: {len(all_devices)} unique devices across {total_ranges} ranges")

    result = list(all_devices.values())
    result.sort(key=lambda d: ipaddress.ip_address(d["ip"]))
    return result


def run_ping(host: str, count: int = 4) -> dict:
    """Run ping and return parsed results."""
    system = platform.system().lower()
    if system == "windows":
        cmd = ["ping", "-n", str(count), host]
    else:
        cmd = ["ping", "-c", str(count), host]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        return {"output": result.stdout + result.stderr, "success": result.returncode == 0}
    except Exception as e:
        return {"output": str(e), "success": False}


def run_traceroute(host: str) -> dict:
    """Run traceroute/tracert."""
    system = platform.system().lower()
    cmd = ["tracert", "-d", "-h", "20", host] if system == "windows" else ["traceroute", "-n", "-m", "20", host]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
        return {"output": result.stdout + result.stderr, "success": result.returncode == 0}
    except Exception as e:
        return {"output": str(e), "success": False}


def run_dns_lookup(host: str) -> dict:
    """DNS lookup using nslookup."""
    try:
        result = subprocess.run(["nslookup", host], capture_output=True, text=True, timeout=15)
        # Also try Python socket
        try:
            ip = socket.gethostbyname(host)
            hostname = socket.gethostbyaddr(ip)[0] if re.match(r'\d+\.\d+\.\d+\.\d+', host) else ""
        except Exception:
            ip = ""
            hostname = ""
        return {
            "output": result.stdout + result.stderr,
            "ip": ip,
            "hostname": hostname,
            "success": True
        }
    except Exception as e:
        return {"output": str(e), "success": False}


def run_port_scan(host: str, ports_str: str = "1-1024") -> dict:
    """Scan a port range on a host."""
    try:
        # Parse port range
        ports = []
        for part in ports_str.split(","):
            part = part.strip()
            if "-" in part:
                start, end = part.split("-", 1)
                ports.extend(range(int(start), min(int(end) + 1, 65536)))
            else:
                ports.append(int(part))

        ports = ports[:500]  # Safety limit
        open_ports = scan_ports(host, ports)
        return {
            "host": host,
            "scanned": len(ports),
            "open_ports": open_ports,
            "output": f"Puertos abiertos en {host}: {', '.join(map(str, open_ports)) or 'ninguno'}",
            "success": True
        }
    except Exception as e:
        return {"output": str(e), "success": False, "open_ports": []}
