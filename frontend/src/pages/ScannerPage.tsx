import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Play, RefreshCw, Plus, X, CheckCircle2, Settings2,
  GitBranch, Import, Eye, Network
} from 'lucide-react';
import { scannerApi, TopologyConnection, TopologyResult } from '../api/scanner';
import { projectsApi } from '../api/projects';
import { Device, DeviceType } from '../types';
import { DeviceIcon, DEVICE_LABELS } from '../components/shared/DeviceIcon';
import { TopologyReview } from '../components/Scanner/TopologyReview';
import { Modal } from '../components/shared/Modal';
import toast from 'react-hot-toast';

// ─── Range input ──────────────────────────────────────────────────────────────
function RangeInput({ ranges, onChange, autoRanges, disabled }: {
  ranges: string[];
  onChange: (r: string[]) => void;
  autoRanges: string[];
  disabled: boolean;
}) {
  const [preview, setPreview] = useState<{ ranges: string[]; estimated_hosts: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const update = (i: number, v: string) => { const n = [...ranges]; n[i] = v; onChange(n); };
  const add    = () => onChange([...ranges, '']);
  const remove = (i: number) => onChange(ranges.filter((_, j) => j !== i));
  const addAuto = (r: string) => { if (!ranges.includes(r)) onChange([...ranges.filter(x => x), r]); };

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const joined = ranges.filter(r => r.trim()).join(',');
    if (!joined) { setPreview(null); return; }
    timer.current = setTimeout(async () => {
      try { setPreview(await scannerApi.parseRanges(joined)); }
      catch { setPreview(null); }
    }, 600);
  }, [ranges]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="label mb-0">IP Ranges</label>
        <button onClick={add} disabled={disabled}
          className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1">
          <Plus size={12} /> Add range
        </button>
      </div>

      {ranges.map((r, i) => (
        <div key={i} className="flex gap-2">
          <input
            className="input font-mono flex-1"
            placeholder={i === 0
              ? "192.168.1.0/24"
              : "10.0.20.0/24  or  10.0.1.0-10.0.5.255  or  10.0.1.1-50"}
            value={r}
            onChange={e => update(i, e.target.value)}
            disabled={disabled}
          />
          {ranges.length > 1 && (
            <button onClick={() => remove(i)} disabled={disabled}
              className="text-slate-500 hover:text-red-400 p-2">
              <X size={14} />
            </button>
          )}
        </div>
      ))}

      {autoRanges.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1">
          <span className="text-xs text-slate-500 self-center">Auto-detected:</span>
          {autoRanges.map(r => (
            <button key={r} onClick={() => addAuto(r)} disabled={disabled}
              className={`text-xs px-2 py-0.5 rounded font-mono transition-colors ${
                ranges.includes(r)
                  ? 'bg-brand-900/40 text-brand-400 border border-brand-700'
                  : 'bg-surface-700 text-slate-400 hover:bg-surface-600 border border-surface-600'
              }`}>{r}</button>
          ))}
        </div>
      )}

      {preview && (
        <div className={`text-xs px-3 py-2 rounded-lg border ${
          preview.ranges.length > 0
            ? 'bg-green-900/20 border-green-800 text-green-400'
            : 'bg-red-900/20 border-red-800 text-red-400'
        }`}>
          {preview.ranges.length > 0
            ? <>✓ {preview.ranges.length} range(s) · ~{preview.estimated_hosts.toLocaleString()} hosts
                {preview.ranges.length > 1 &&
                  <span className="text-slate-400 ml-2">[{preview.ranges.slice(0,4).join(', ')}{preview.ranges.length > 4 ? '...' : ''}]</span>}
              </>
            : '✗ Invalid range — use format: 192.168.1.0/24 or 10.0.1.0-10.0.5.255'}
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function ScannerPage() {
  const navigate = useNavigate();
  const [ranges, setRanges]             = useState<string[]>(['']);
  const [scanType, setScanType]         = useState<'basic' | 'nmap'>('basic');
  const [runTopology, setRunTopology]   = useState(true);
  const [snmpCommunities, setSnmpCommunities] = useState('public,private');
  const [useTraceroute, setUseTraceroute]     = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [autoRanges, setAutoRanges]     = useState<string[]>([]);
  const [scanning, setScanning]         = useState(false);
  const [progress, setProgress]         = useState({ pct: 0, msg: '', topo: 0 });
  const [devices, setDevices]           = useState<any[]>([]);
  const [topology, setTopology]         = useState<TopologyResult | null>(null);
  const [rangesScanned, setRangesScanned] = useState<string[]>([]);
  const [selectedDevices, setSelectedDevices] = useState<Set<string>>(new Set());
  const [showTopologyReview, setShowTopologyReview] = useState(false);
  const [importModal, setImportModal]   = useState(false);
  const [projects, setProjects]         = useState<any[]>([]);
  const [selectedProject, setSelectedProject] = useState<number | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    scannerApi.getNetworkRanges()
      .then(d => { setAutoRanges(d.ranges); if (d.ranges[0] && !ranges[0]) setRanges([d.ranges[0]]); })
      .catch(() => {});
    projectsApi.list().then(setProjects).catch(() => {});
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const startScan = async () => {
    const valid = ranges.filter(r => r.trim());
    if (!valid.length) { toast.error('Enter at least one IP range'); return; }
    setScanning(true); setDevices([]); setTopology(null);
    setSelectedDevices(new Set()); setProgress({ pct: 0, msg: 'Starting...', topo: 0 });
    try {
      const job = await scannerApi.startScan({
        ip_range: valid.join(','),
        scan_type: scanType,
        run_topology: runTopology,
        snmp_communities: snmpCommunities.split(',').map(s => s.trim()).filter(Boolean),
        use_traceroute: useTraceroute,
      });
      pollRef.current = setInterval(async () => {
        try {
          const prog = await scannerApi.getJobProgress(job.id);
          setProgress({ pct: prog.progress, msg: prog.message, topo: prog.topology_connections });
          if (prog.status === 'completed' || prog.status === 'failed') {
            clearInterval(pollRef.current!); setScanning(false);
            if (prog.status === 'completed') {
              const full = await scannerApi.getJob(job.id);
              let parsed: any = {};
              try { parsed = JSON.parse(full.results || '{}'); } catch {}
              const devs = Array.isArray(parsed) ? parsed : (parsed.devices || []);
              const topo: TopologyResult | null = parsed.topology || null;
              setDevices(devs); setTopology(topo);
              setRangesScanned(parsed.ranges_scanned || valid);
              setSelectedDevices(new Set(devs.map((d: any) => d.ip)));
              if (topo?.stats.total_connections) {
                toast.success(`${devs.length} devices · ${topo.stats.total_connections} connections`, { duration: 5000 });
                setShowTopologyReview(true);
              } else {
                toast.success(`Scan completed: ${devs.length} devices`);
              }
            } else { toast.error('Scan failed'); }
          }
        } catch { clearInterval(pollRef.current!); setScanning(false); }
      }, 1500);
    } catch (e: any) {
      setScanning(false);
      toast.error(e?.response?.data?.detail || 'Error starting scan');
    }
  };

  const runTopoOnly = async () => {
    if (!devices.length) { toast.error('No devices to analyze'); return; }
    toast('Starting topology discovery...', { icon: '🔍' });
    try {
      const { job_id } = await scannerApi.runTopology(devices, {
        snmp_communities: snmpCommunities.split(',').map(s => s.trim()).filter(Boolean),
        use_traceroute: useTraceroute,
      });
      const poll = setInterval(async () => {
        try {
          const res = await scannerApi.getTopologyResult(job_id);
          if (res.status === 'completed') {
            clearInterval(poll);
            if (res.result) {
              setTopology(res.result);
              setShowTopologyReview(true);
              toast.success(`${res.result.stats.total_connections} connections detected`);
            } else {
              toast('Topology complete — no connections found');
            }
          } else if (res.status === 'failed') {
            clearInterval(poll);
            toast.error(`Topology failed: ${res.message || 'unknown error'}`);
          }
        } catch (pollErr: any) {
          clearInterval(poll);
          toast.error(`Topology polling error: ${pollErr?.response?.data?.detail || pollErr?.message || 'unknown'}`);
        }
      }, 2000);
    } catch (err: any) {
      const detail = err?.response?.data?.detail || err?.message || 'unknown error';
      toast.error(`Error starting topology: ${detail}`);
    }
  };

  const applyTopology = async (accepted: TopologyConnection[]) => {
    if (!selectedProject) { toast.error('Select a project first'); return; }
    try {
      const proj = await projectsApi.get(selectedProject);
      const existNodes: any[] = JSON.parse(proj.nodes || '[]');
      const existEdges: any[] = JSON.parse(proj.edges || '[]');
      const existIps = new Set(existNodes.map((n: any) => n.ip));
      const existPairs = new Set(existEdges.map((e: any) => [e.source, e.target].sort().join('|')));

      const newNodes = devices
        .filter((d: any) => selectedDevices.has(d.ip) && !existIps.has(d.ip))
        .map((d: any, i: number) => ({
          id: d.ip, type: d.device_type,
          label: d.custom_name || d.hostname || d.ip,
          ip: d.ip, hostname: d.hostname, mac: d.mac, vendor: d.vendor,
          open_ports: d.open_ports, custom_name: '', custom_type: '', notes: '',
          status: d.status, source_range: d.source_range || '',
          x: 200 + (i % 6) * 160, y: 100 + Math.floor(i / 6) * 150, z: 0,
        }));

      const newEdges = accepted
        .filter(c => !existPairs.has([c.source, c.target].sort().join('|')))
        .map(c => ({
          id: `${c.source}-${c.target}-${Math.random().toString(36).slice(2, 8)}`,
          source: c.source, target: c.target, type: c.type,
          label: c.label || '', confidence: c.confidence, method: c.method,
        }));

      await projectsApi.update(selectedProject, {
        nodes: JSON.stringify([...existNodes, ...newNodes]),
        edges: JSON.stringify([...existEdges, ...newEdges]),
      });
      toast.success(`✓ ${newNodes.length} nodes + ${newEdges.length} connections applied`);
      setShowTopologyReview(false);
      navigate(`/diagram/${selectedProject}`);
    } catch { toast.error('Error applying topology'); }
  };

  const toggleDev = (ip: string) => setSelectedDevices(prev => {
    const s = new Set(prev); if (s.has(ip)) s.delete(ip); else s.add(ip); return s;
  });

  const typeCount = devices.reduce((a, d: any) => { a[d.device_type] = (a[d.device_type] || 0) + 1; return a; }, {} as Record<string, number>);

  // ── Topology Review fullscreen ─────────────────────────────────────────────
  if (showTopologyReview && topology) {
    return (
      <div className="h-full flex flex-col">
        <div className="p-3 bg-surface-800 border-b border-surface-700 flex items-center gap-3">
          <span className="text-sm text-slate-400">Target project:</span>
          <select className="input w-56 text-sm py-1" value={selectedProject || ''}
            onChange={e => setSelectedProject(Number(e.target.value))}>
            <option value="">Select project...</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          {!selectedProject && (
            <button onClick={async () => {
              const p = await projectsApi.create(`Network: ${rangesScanned.slice(0,2).join(', ')}`);
              setProjects(prev => [...prev, p]); setSelectedProject(p.id);
              toast.success(`Project: ${p.name}`);
            }} className="btn-ghost text-sm text-brand-400">
              <Plus size={14} className="inline mr-1" />Create new
            </button>
          )}
        </div>
        <div className="flex-1 min-h-0">
          <TopologyReview
            connections={topology.connections}
            devices={devices}
            onApply={applyTopology}
            onCancel={() => setShowTopologyReview(false)}
          />
        </div>
      </div>
    );
  }

  // ── Normal scanner view ────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-5">
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-slate-300 mb-4">Scan Configuration</h2>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <RangeInput ranges={ranges} onChange={setRanges} autoRanges={autoRanges} disabled={scanning} />
          <div className="space-y-3">
            <div>
              <label className="label">Scan Type</label>
              <select className="input" value={scanType}
                onChange={e => setScanType(e.target.value as any)} disabled={scanning}>
                <option value="basic">Basic (ping + ARP + ports)</option>
                <option value="nmap">Advanced with Nmap</option>
              </select>
            </div>
            {/* Topology toggle */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-surface-700 border border-surface-600">
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" checked={runTopology}
                  onChange={e => setRunTopology(e.target.checked)} disabled={scanning} className="sr-only peer" />
                <div className="w-9 h-5 bg-surface-600 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-brand-600" />
              </label>
              <div>
                <div className="text-sm font-medium text-white">Topology Discovery</div>
                <div className="text-xs text-slate-500">LLDP · CDP (Cisco) · SNMP · Traceroute</div>
              </div>
              <button onClick={() => setShowAdvanced(!showAdvanced)} className="ml-auto text-slate-500 hover:text-slate-300">
                <Settings2 size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Advanced options */}
        {showAdvanced && runTopology && (
          <div className="mb-4 p-4 rounded-lg bg-surface-900 border border-surface-700 grid grid-cols-2 gap-4">
            <div>
              <label className="label">SNMP Communities</label>
              <input className="input font-mono text-sm" placeholder="public,private"
                value={snmpCommunities} onChange={e => setSnmpCommunities(e.target.value)} disabled={scanning} />
              <p className="text-xs text-slate-500 mt-1">Supported: Cisco, Ubiquiti, TP-Link, HP, Netgear</p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input type="checkbox" id="tr" checked={useTraceroute}
                  onChange={e => setUseTraceroute(e.target.checked)} disabled={scanning} className="accent-brand-500" />
                <label htmlFor="tr" className="text-sm text-slate-300">Traceroute (detects routing hierarchy)</label>
              </div>
              <div className="text-xs text-slate-500 bg-surface-800 p-2 rounded">
                🔗 LLDP — Ubiquiti, TP-Link, HP, Cisco<br/>
                🔗 CDP — Cisco exclusive<br/>
                📋 SNMP MAC Table — any SNMP switch<br/>
                🛤️ Traceroute — router hierarchy<br/>
                🧠 Subnet inference — always active
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={startScan} disabled={scanning || !ranges.some(r => r.trim())}
            className="btn-primary flex items-center gap-2">
            {scanning ? <RefreshCw size={16} className="animate-spin" /> : <Play size={16} />}
            {scanning ? 'Scanning...' : 'Start Scan'}
          </button>
          {devices.length > 0 && !scanning && (
            <button onClick={runTopoOnly} className="btn-secondary flex items-center gap-2 text-sm">
              <GitBranch size={14} /> Re-detect Topology
            </button>
          )}
        </div>
      </div>

      {/* Progress */}
      {(scanning || (progress.pct > 0 && progress.pct < 100)) && (
        <div className="card p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-300 truncate flex-1 mr-2">{progress.msg}</span>
            <span className="text-sm font-mono text-brand-400">{progress.pct}%</span>
          </div>
          <div className="h-2 bg-surface-700 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-brand-600 to-cyan-500 rounded-full transition-all duration-500"
              style={{ width: `${progress.pct}%` }} />
          </div>
          {progress.topo > 0 && (
            <div className="mt-2 text-xs text-green-400 flex items-center gap-1">
              <GitBranch size={12} /> {progress.topo} topology connections detected
            </div>
          )}
        </div>
      )}

      {/* Results */}
      {devices.length > 0 && (
        <>
          <div className="card p-4">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <div className="flex items-center gap-3">
                <CheckCircle2 size={18} className="text-green-400" />
                <span className="font-semibold text-white">{devices.length} devices</span>
                {rangesScanned.length > 1 && (
                  <span className="badge bg-surface-700 text-slate-400">
                    {rangesScanned.length} ranges
                  </span>
                )}
              </div>
              <div className="flex gap-2 flex-wrap">
                <button onClick={() => setSelectedDevices(new Set(devices.map((d: any) => d.ip)))} className="btn-ghost text-xs px-2 py-1">Sel. all</button>
                <button onClick={() => setSelectedDevices(new Set())} className="btn-ghost text-xs px-2 py-1">Desel.</button>
                {topology && topology.stats.total_connections > 0 && (
                  <button onClick={() => setShowTopologyReview(true)}
                    className="btn-secondary flex items-center gap-2 text-sm">
                    <Eye size={14} />
                    Topology ({topology.stats.total_connections})
                  </button>
                )}
                <button onClick={() => { projectsApi.list().then(setProjects); setImportModal(true); }}
                  disabled={selectedDevices.size === 0}
                  className="btn-primary flex items-center gap-2 text-sm">
                  <Import size={14} /> Import ({selectedDevices.size})
                </button>
              </div>
            </div>

            {topology && (
              <div className="flex gap-2 flex-wrap mb-2">
                {topology.stats.lldp_cdp_neighbors > 0 && (
                  <span className="badge bg-green-900/30 text-green-400">🔗 {topology.stats.lldp_cdp_neighbors} LLDP/CDP</span>
                )}
                <span className="badge bg-green-900/30 text-green-400">High conf: {topology.stats.high_confidence}</span>
                <span className="badge bg-yellow-900/30 text-yellow-400">Medium: {topology.stats.medium_confidence}</span>
                <span className="badge bg-surface-700 text-slate-500 text-xs">{topology.methods_used.join(' · ')}</span>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {Object.entries(typeCount).map(([t, c]) => (
                <span key={t} className="badge bg-surface-700 text-slate-300">
                  {DEVICE_LABELS[t as DeviceType] || t}: {c as number}
                </span>
              ))}
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-700">
                    <th className="p-3 w-10">
                      <input type="checkbox" className="accent-brand-500"
                        checked={selectedDevices.size === devices.length}
                        onChange={() => selectedDevices.size === devices.length
                          ? setSelectedDevices(new Set())
                          : setSelectedDevices(new Set(devices.map((d: any) => d.ip)))} />
                    </th>
                    <th className="text-left p-3 text-slate-400 font-medium">Type</th>
                    <th className="text-left p-3 text-slate-400 font-medium">IP</th>
                    <th className="text-left p-3 text-slate-400 font-medium">Hostname</th>
                    <th className="text-left p-3 text-slate-400 font-medium">MAC / Vendor</th>
                    <th className="text-left p-3 text-slate-400 font-medium">Ports</th>
                    <th className="text-left p-3 text-slate-400 font-medium">Range</th>
                  </tr>
                </thead>
                <tbody>
                  {devices.map((d: any) => (
                    <tr key={d.ip} onClick={() => toggleDev(d.ip)}
                      className={`border-b border-surface-700/50 hover:bg-surface-700/30 cursor-pointer transition-colors ${selectedDevices.has(d.ip) ? 'bg-brand-900/10' : ''}`}>
                      <td className="p-3">
                        <input type="checkbox" checked={selectedDevices.has(d.ip)}
                          onChange={() => toggleDev(d.ip)} onClick={e => e.stopPropagation()}
                          className="accent-brand-500" />
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <DeviceIcon type={d.device_type} size={26} />
                          <span className="text-xs text-slate-400 hidden xl:block">
                            {DEVICE_LABELS[d.device_type as DeviceType] || d.device_type}
                          </span>
                        </div>
                      </td>
                      <td className="p-3 font-mono text-green-400">{d.ip}</td>
                      <td className="p-3 text-slate-200 max-w-[140px] truncate">{d.hostname || '—'}</td>
                      <td className="p-3">
                        <div className="font-mono text-xs text-slate-400">{d.mac || '—'}</div>
                        {d.vendor && <div className="text-xs text-slate-500">{d.vendor}</div>}
                      </td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-1">
                          {(d.open_ports || []).slice(0, 5).map((p: number) => (
                            <span key={p} className="badge bg-surface-700 text-slate-400 font-mono">{p}</span>
                          ))}
                          {(d.open_ports || []).length > 5 && (
                            <span className="badge bg-surface-700 text-slate-500">+{d.open_ports.length - 5}</span>
                          )}
                        </div>
                      </td>
                      <td className="p-3 text-xs font-mono text-slate-500">{d.source_range || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Import modal */}
      <Modal isOpen={importModal} onClose={() => setImportModal(false)} title="Import to Diagram">
        <div className="space-y-4">
          <p className="text-slate-400 text-sm">{selectedDevices.size} devices selected (nodes only, no connections).</p>
          <div>
            <label className="label">Target project</label>
            <select className="input" value={selectedProject || ''} onChange={e => setSelectedProject(Number(e.target.value))}>
              <option value="">Select...</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setImportModal(false)} className="btn-secondary">Cancel</button>
            <button disabled={!selectedProject} onClick={async () => {
              if (!selectedProject) return;
              const selected = devices.filter((d: any) => selectedDevices.has(d.ip));
              const nodes = selected.map((d: any, i: number) => ({
                id: d.ip, type: d.device_type, label: d.hostname || d.ip,
                ip: d.ip, hostname: d.hostname, mac: d.mac, vendor: d.vendor,
                open_ports: d.open_ports, custom_name: '', custom_type: '', notes: '',
                status: d.status, x: 150 + (i % 5) * 160, y: 100 + Math.floor(i / 5) * 150, z: 0,
              }));
              try {
                const proj = await projectsApi.get(selectedProject);
                const existing = JSON.parse(proj.nodes || '[]');
                const existingIps = new Set(existing.map((n: any) => n.ip));
                const newNodes = nodes.filter((n: any) => !existingIps.has(n.ip));
                await projectsApi.update(selectedProject, { nodes: JSON.stringify([...existing, ...newNodes]) });
                toast.success(`${newNodes.length} devices imported`);
                setImportModal(false);
                navigate(`/diagram/${selectedProject}`);
              } catch { toast.error('Error importing devices'); }
            }} className="btn-primary">Import & Open</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
