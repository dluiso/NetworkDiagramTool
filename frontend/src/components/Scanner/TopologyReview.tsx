import { useState, useMemo } from 'react';
import { Network } from 'lucide-react';
import { TopologyConnection } from '../../api/scanner';
import { DeviceIcon } from '../shared/DeviceIcon';
import { DeviceType } from '../../types';

interface Props {
  connections: TopologyConnection[];
  devices: any[];
  onApply: (accepted: TopologyConnection[]) => void;
  onCancel: () => void;
}

const METHOD_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  'snmp-lldp':        { label: 'LLDP (SNMP)',      color: 'text-green-400',  icon: '🔗' },
  'snmp-cdp':         { label: 'CDP (SNMP)',        color: 'text-green-400',  icon: '🔗' },
  'snmp-mactable':    { label: 'MAC Table (SNMP)',  color: 'text-cyan-400',   icon: '📋' },
  'traceroute':       { label: 'Traceroute',        color: 'text-blue-400',   icon: '🛤️' },
  'subnet-inference': { label: 'Subnet Inference',  color: 'text-yellow-400', icon: '🧠' },
  'nmap-lldp':        { label: 'LLDP (nmap)',       color: 'text-green-400',  icon: '🔗' },
};

const EDGE_TYPE_ICONS: Record<string, string> = {
  ethernet: '⚡', wifi: '📶', fiber: '💎', wan: '🌐', vpn: '🔒',
};

function getMethodInfo(method: string) {
  for (const [key, val] of Object.entries(METHOD_LABELS)) {
    if (method.includes(key)) return val;
  }
  return { label: method, color: 'text-slate-400', icon: '❓' };
}

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  const color = confidence >= 0.9 ? 'bg-green-900/40 text-green-400 border-green-700'
              : confidence >= 0.6 ? 'bg-yellow-900/40 text-yellow-400 border-yellow-700'
              : 'bg-red-900/40 text-red-400 border-red-700';
  const label = confidence >= 0.9 ? 'High' : confidence >= 0.6 ? 'Medium' : 'Low';
  return (
    <span className={`badge border ${color} text-xs`}>
      {label} {pct}%
    </span>
  );
}

export function TopologyReview({ connections, devices, onApply, onCancel }: Props) {
  const [selected, setSelected] = useState<Set<number>>(
    new Set(connections.map((_, i) => i))
  );
  const [filterMethod, setFilterMethod] = useState<string>('all');
  const [filterConf, setFilterConf] = useState<string>('all');

  const deviceByIp = useMemo(() => {
    const map: Record<string, any> = {};
    devices.forEach(d => { map[d.ip] = d; });
    return map;
  }, [devices]);

  const filteredIdxs = useMemo(() => {
    return connections.reduce<number[]>((acc, c, i) => {
      if (filterMethod !== 'all' && !c.method.includes(filterMethod)) return acc;
      if (filterConf === 'high' && c.confidence < 0.9) return acc;
      if (filterConf === 'medium' && (c.confidence < 0.6 || c.confidence >= 0.9)) return acc;
      if (filterConf === 'low' && c.confidence >= 0.6) return acc;
      acc.push(i);
      return acc;
    }, []);
  }, [connections, filterMethod, filterConf]);

  const toggle = (i: number) => {
    setSelected(prev => {
      const s = new Set(prev);
      if (s.has(i)) s.delete(i); else s.add(i);
      return s;
    });
  };

  const selectAll      = () => setSelected(new Set(filteredIdxs));
  const selectNone     = () => setSelected(new Set([...selected].filter(i => !filteredIdxs.includes(i))));
  const selectHighConf = () => setSelected(new Set(connections.reduce<number[]>((a, c, i) => {
    if (c.confidence >= 0.9) a.push(i); return a;
  }, [])));

  const stats = {
    high:   connections.filter(c => c.confidence >= 0.9).length,
    medium: connections.filter(c => c.confidence >= 0.6 && c.confidence < 0.9).length,
    low:    connections.filter(c => c.confidence < 0.6).length,
    lldp:   connections.filter(c => c.method.includes('lldp') || c.method.includes('cdp')).length,
  };

  const methods = ['all', ...new Set(connections.map(c => {
    for (const key of Object.keys(METHOD_LABELS)) {
      if (c.method.includes(key)) return key;
    }
    return c.method;
  }))];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-surface-700">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-semibold text-white text-lg">Detected Topology</h3>
            <p className="text-sm text-slate-400">
              {connections.length} proposed connections · {selected.size} selected
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={onCancel} className="btn-secondary text-sm">Cancel</button>
            <button
              onClick={() => onApply(connections.filter((_, i) => selected.has(i)))}
              disabled={selected.size === 0}
              className="btn-primary flex items-center gap-2 text-sm"
            >
              <Network size={14} />
              Apply ({selected.size}) to Diagram
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="flex gap-3 mb-3">
          <div className="flex items-center gap-1.5 text-sm">
            <span className="w-2 h-2 rounded-full bg-green-400" />
            <span className="text-slate-400">High confidence: <span className="text-white">{stats.high}</span></span>
          </div>
          <div className="flex items-center gap-1.5 text-sm">
            <span className="w-2 h-2 rounded-full bg-yellow-400" />
            <span className="text-slate-400">Medium: <span className="text-white">{stats.medium}</span></span>
          </div>
          <div className="flex items-center gap-1.5 text-sm">
            <span className="w-2 h-2 rounded-full bg-red-400" />
            <span className="text-slate-400">Low: <span className="text-white">{stats.low}</span></span>
          </div>
          {stats.lldp > 0 && (
            <div className="flex items-center gap-1.5 text-sm">
              <span className="text-green-400">🔗</span>
              <span className="text-slate-400">LLDP/CDP: <span className="text-green-400 font-medium">{stats.lldp}</span></span>
            </div>
          )}
        </div>

        {/* Filters + quick selects */}
        <div className="flex gap-2 items-center flex-wrap">
          <select
            className="input w-auto text-xs py-1"
            value={filterMethod}
            onChange={e => setFilterMethod(e.target.value)}
          >
            {methods.map(m => (
              <option key={m} value={m}>
                {m === 'all' ? 'All methods' : (METHOD_LABELS[m]?.label || m)}
              </option>
            ))}
          </select>
          <select
            className="input w-auto text-xs py-1"
            value={filterConf}
            onChange={e => setFilterConf(e.target.value)}
          >
            <option value="all">All confidence</option>
            <option value="high">High ≥90%</option>
            <option value="medium">Medium 60-89%</option>
            <option value="low">Low &lt;60%</option>
          </select>
          <button onClick={selectAll}      className="btn-ghost text-xs px-2 py-1">Sel. all</button>
          <button onClick={selectNone}     className="btn-ghost text-xs px-2 py-1">Desel.</button>
          <button onClick={selectHighConf} className="btn-ghost text-xs px-2 py-1 text-green-400">
            High conf only
          </button>
        </div>
      </div>

      {/* Connection list */}
      <div className="flex-1 overflow-y-auto">
        {filteredIdxs.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-slate-500">
            No connections match this filter
          </div>
        ) : (
          <div className="divide-y divide-surface-700/50">
            {filteredIdxs.map(i => {
              const c = connections[i];
              const srcDevice = deviceByIp[c.source];
              const tgtDevice = deviceByIp[c.target];
              const methodInfo = getMethodInfo(c.method);
              const isSelected = selected.has(i);

              return (
                <div
                  key={i}
                  onClick={() => toggle(i)}
                  className={`flex items-center gap-3 p-3 cursor-pointer transition-colors hover:bg-surface-700/30 ${
                    isSelected ? 'bg-brand-900/10' : ''
                  }`}
                >
                  {/* Checkbox */}
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggle(i)}
                    onClick={e => e.stopPropagation()}
                    className="accent-brand-500 flex-shrink-0"
                  />

                  {/* Source device */}
                  <div className="flex items-center gap-2 w-36 flex-shrink-0">
                    <DeviceIcon type={(srcDevice?.device_type || 'unknown') as DeviceType} size={24} />
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-white truncate">
                        {srcDevice?.custom_name || srcDevice?.hostname || c.source}
                      </div>
                      <div className="text-xs font-mono text-slate-500">{c.source}</div>
                    </div>
                  </div>

                  {/* Connection line */}
                  <div className="flex-1 flex items-center gap-2 min-w-0">
                    <div className="flex-1 border-t border-dashed border-surface-600" />
                    <div className="flex flex-col items-center gap-0.5 flex-shrink-0">
                      <span className="text-xs">{EDGE_TYPE_ICONS[c.type] || '—'}</span>
                      <span className="text-xs text-slate-500">{c.type}</span>
                      {c.label && <span className="text-xs text-slate-600 font-mono">{c.label}</span>}
                    </div>
                    <div className="flex-1 border-t border-dashed border-surface-600" />
                  </div>

                  {/* Target device */}
                  <div className="flex items-center gap-2 w-36 flex-shrink-0 justify-end">
                    <div className="min-w-0 text-right">
                      <div className="text-xs font-medium text-white truncate">
                        {tgtDevice?.custom_name || tgtDevice?.hostname || c.target}
                      </div>
                      <div className="text-xs font-mono text-slate-500">{c.target}</div>
                    </div>
                    <DeviceIcon type={(tgtDevice?.device_type || 'unknown') as DeviceType} size={24} />
                  </div>

                  {/* Method + confidence */}
                  <div className="flex flex-col items-end gap-1 w-32 flex-shrink-0">
                    <ConfidenceBadge confidence={c.confidence} />
                    <span className={`text-xs ${methodInfo.color}`}>
                      {methodInfo.icon} {methodInfo.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
