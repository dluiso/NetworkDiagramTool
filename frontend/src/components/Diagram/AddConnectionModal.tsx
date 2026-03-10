import { useState } from 'react';
import { Modal } from '../shared/Modal';
import { useDiagramStore } from '../../store/diagramStore';
import { DiagramEdge } from '../../types';
import { DeviceIcon } from '../shared/DeviceIcon';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const EDGE_TYPES = [
  { value: 'ethernet', label: 'Ethernet',    color: '#334155' },
  { value: 'wifi',     label: 'WiFi',        color: '#fbbf24' },
  { value: 'fiber',    label: 'Fiber Optic', color: '#22d3ee' },
  { value: 'wan',      label: 'WAN',         color: '#f97316' },
  { value: 'vpn',      label: 'VPN',         color: '#a78bfa' },
];

function generateId() {
  return `edge-${Math.random().toString(36).substring(2, 10)}`;
}

export function AddConnectionModal({ isOpen, onClose }: Props) {
  const { nodes, edges, addEdge } = useDiagramStore();
  const [source, setSource] = useState('');
  const [target, setTarget] = useState('');
  const [type, setType] = useState<DiagramEdge['type']>('ethernet');
  const [label, setLabel] = useState('');
  const [bandwidth, setBandwidth] = useState('');

  const handleAdd = () => {
    if (!source || !target || source === target) return;
    const exists = edges.some(e =>
      (e.source === source && e.target === target) ||
      (e.source === target && e.target === source)
    );
    if (exists) return;

    const edge: DiagramEdge = {
      id: generateId(),
      source,
      target,
      type,
      label: label || bandwidth || undefined,
      bandwidth: bandwidth || undefined,
    };
    addEdge(edge);
    setSource(''); setTarget(''); setLabel(''); setBandwidth('');
    onClose();
  };

  const srcNode = nodes.find(n => n.id === source);
  const tgtNode = nodes.find(n => n.id === target);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Connection">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Source</label>
            <select className="input" value={source} onChange={e => setSource(e.target.value)}>
              <option value="">Select...</option>
              {nodes.map(n => (
                <option key={n.id} value={n.id}>
                  {n.custom_name || n.hostname || n.ip || n.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Target</label>
            <select className="input" value={target} onChange={e => setTarget(e.target.value)}>
              <option value="">Select...</option>
              {nodes.filter(n => n.id !== source).map(n => (
                <option key={n.id} value={n.id}>
                  {n.custom_name || n.hostname || n.ip || n.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {source && target && (
          <div className="flex items-center gap-3 p-3 bg-surface-700 rounded-lg">
            {srcNode && <DeviceIcon type={srcNode.type} size={24} />}
            <span className="text-sm text-slate-300">{srcNode?.custom_name || srcNode?.ip}</span>
            <div className="flex-1 text-center text-slate-500">———</div>
            <span className="text-sm text-slate-300">{tgtNode?.custom_name || tgtNode?.ip}</span>
            {tgtNode && <DeviceIcon type={tgtNode.type} size={24} />}
          </div>
        )}

        <div>
          <label className="label">Connection type</label>
          <div className="grid grid-cols-3 gap-2">
            {EDGE_TYPES.map(({ value, label: lbl, color }) => (
              <button
                key={value}
                onClick={() => setType(value as DiagramEdge['type'])}
                className={`flex items-center gap-2 p-2 rounded-lg border text-sm transition-colors ${
                  type === value
                    ? 'border-brand-500 bg-brand-900/30 text-white'
                    : 'border-surface-600 bg-surface-700 text-slate-400 hover:border-surface-500'
                }`}
              >
                <div className="w-3 h-0.5 rounded" style={{ backgroundColor: color }} />
                {lbl}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Label (optional)</label>
            <input className="input" placeholder="e.g.: Uplink, Trunk" value={label} onChange={e => setLabel(e.target.value)} />
          </div>
          <div>
            <label className="label">Bandwidth (optional)</label>
            <input className="input" placeholder="e.g.: 1Gbps, 100Mbps" value={bandwidth} onChange={e => setBandwidth(e.target.value)} />
          </div>
        </div>

        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button
            onClick={handleAdd}
            disabled={!source || !target || source === target}
            className="btn-primary"
          >
            Add Connection
          </button>
        </div>
      </div>
    </Modal>
  );
}
