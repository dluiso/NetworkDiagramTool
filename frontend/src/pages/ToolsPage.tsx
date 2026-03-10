import { useState } from 'react';
import { Terminal, Activity, Search, Globe, Shield } from 'lucide-react';
import { scannerApi } from '../api/scanner';
import toast from 'react-hot-toast';

type Tool = 'ping' | 'traceroute' | 'dns' | 'portscan';

interface ToolResult {
  output: string;
  success: boolean;
  extra?: Record<string, any>;
}

export default function ToolsPage() {
  const [activeTool, setActiveTool] = useState<Tool>('ping');
  const [host, setHost] = useState('');
  const [ports, setPorts] = useState('1-1024');
  const [pingCount, setPingCount] = useState(4);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ToolResult | null>(null);

  const tools = [
    { id: 'ping' as Tool,      label: 'Ping',         icon: Activity, desc: 'Verify connectivity with a host' },
    { id: 'traceroute' as Tool, label: 'Traceroute',  icon: Globe,    desc: 'Trace the route to a host' },
    { id: 'dns' as Tool,       label: 'DNS Lookup',   icon: Search,   desc: 'Resolve domain names' },
    { id: 'portscan' as Tool,  label: 'Port Scanner', icon: Shield,   desc: 'Scan ports of a host' },
  ];

  const run = async () => {
    if (!host.trim()) { toast.error('Enter a host'); return; }
    setRunning(true);
    setResult(null);
    try {
      let res: ToolResult;
      switch (activeTool) {
        case 'ping':
          res = await scannerApi.ping(host, pingCount);
          break;
        case 'traceroute':
          res = await scannerApi.traceroute(host);
          break;
        case 'dns':
          const dns = await scannerApi.dns(host);
          res = { ...dns, extra: { ip: dns.ip, hostname: dns.hostname } };
          break;
        case 'portscan':
          const ps = await scannerApi.portScan(host, ports);
          res = { ...ps, extra: { open_ports: ps.open_ports, scanned: ps.scanned } };
          break;
      }
      setResult(res!);
    } catch (e: any) {
      setResult({ output: e?.response?.data?.detail || 'Error running tool', success: false });
    } finally {
      setRunning(false);
    }
  };

  const currentTool = tools.find(t => t.id === activeTool)!;

  return (
    <div className="p-6 space-y-5">
      {/* Tool selector */}
      <div className="grid grid-cols-4 gap-3">
        {tools.map(({ id, label, icon: Icon, desc }) => (
          <button
            key={id}
            onClick={() => { setActiveTool(id); setResult(null); }}
            className={`card p-4 text-left transition-colors ${
              activeTool === id
                ? 'border-brand-500 bg-brand-900/20'
                : 'hover:border-surface-600'
            }`}
          >
            <Icon size={20} className={activeTool === id ? 'text-brand-400' : 'text-slate-500'} />
            <div className="text-sm font-medium text-white mt-2">{label}</div>
            <div className="text-xs text-slate-500 mt-0.5">{desc}</div>
          </button>
        ))}
      </div>

      {/* Tool input */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Terminal size={16} className="text-brand-400" />
          <span className="font-semibold text-white">{currentTool.label}</span>
          <span className="text-slate-500 text-sm">— {currentTool.desc}</span>
        </div>

        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="label">Host / IP</label>
            <input
              className="input font-mono"
              placeholder="192.168.1.1 or hostname.local"
              value={host}
              onChange={e => setHost(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && run()}
            />
          </div>

          {activeTool === 'ping' && (
            <div className="w-28">
              <label className="label">Packets</label>
              <input
                type="number"
                className="input"
                min={1} max={10}
                value={pingCount}
                onChange={e => setPingCount(Number(e.target.value))}
              />
            </div>
          )}

          {activeTool === 'portscan' && (
            <div className="w-40">
              <label className="label">Ports</label>
              <input
                className="input font-mono"
                placeholder="1-1024"
                value={ports}
                onChange={e => setPorts(e.target.value)}
              />
            </div>
          )}

          <button
            onClick={run}
            disabled={running}
            className="btn-primary flex items-center gap-2 h-10"
          >
            {running ? (
              <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Activity size={16} />
            )}
            {running ? 'Running...' : 'Run'}
          </button>
        </div>
      </div>

      {/* Result */}
      {result && (
        <div className="card overflow-hidden">
          <div className={`flex items-center gap-2 px-4 py-2 border-b border-surface-700 ${
            result.success ? 'bg-green-900/20' : 'bg-red-900/20'
          }`}>
            <div className={`w-2 h-2 rounded-full ${result.success ? 'bg-green-400' : 'bg-red-400'}`} />
            <span className="text-sm font-medium text-slate-300">
              {result.success ? 'Completed' : 'Error'}
            </span>
            {result.extra && Object.entries(result.extra).map(([k, v]) => (
              Array.isArray(v) ? (
                <span key={k} className="badge bg-brand-900/40 text-brand-400 ml-2">
                  {v.length} open ports
                </span>
              ) : v ? (
                <span key={k} className="text-xs text-slate-400 ml-2">
                  {k}: <span className="text-slate-200 font-mono">{String(v)}</span>
                </span>
              ) : null
            ))}
          </div>
          <pre className="p-4 text-sm font-mono text-slate-300 overflow-x-auto whitespace-pre-wrap bg-surface-900 max-h-96 overflow-y-auto">
            {result.output || '(no output)'}
          </pre>
        </div>
      )}

      {/* Quick commands guide */}
      <div className="card p-4">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Usage examples</h3>
        <div className="grid grid-cols-2 gap-2">
          {[
            { host: '8.8.8.8',       tool: 'ping',     label: 'Ping Google DNS' },
            { host: '192.168.1.1',   tool: 'ping',     label: 'Ping gateway' },
            { host: 'google.com',    tool: 'dns',      label: 'DNS lookup Google' },
            { host: '192.168.1.1',   tool: 'portscan', label: 'Scan router' },
          ].map(({ host: h, tool, label }) => (
            <button
              key={label}
              onClick={() => { setHost(h); setActiveTool(tool as Tool); }}
              className="text-left p-2 rounded-lg bg-surface-700 hover:bg-surface-600 transition-colors"
            >
              <div className="text-xs font-mono text-brand-400">{h}</div>
              <div className="text-xs text-slate-500">{label}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
