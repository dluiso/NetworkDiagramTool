import { useState, useEffect } from 'react';
import { Modal } from '../shared/Modal';
import { DiagramNode, DeviceType } from '../../types';
import { DeviceIcon, ALL_DEVICE_TYPES, DEVICE_LABELS } from '../shared/DeviceIcon';
import { useDiagramStore } from '../../store/diagramStore';
import { Trash2 } from 'lucide-react';

interface Props {
  nodeId: string | null;
  onClose: () => void;
}

export function EditDeviceModal({ nodeId, onClose }: Props) {
  const { nodes, edges, updateNode, removeNode, removeEdge } = useDiagramStore();
  const node = nodes.find(n => n.id === nodeId);

  const [form, setForm] = useState<Partial<DiagramNode>>({});

  useEffect(() => {
    if (node) setForm({ ...node });
  }, [nodeId, node]);

  if (!node) return null;

  const save = () => {
    updateNode(node.id, form);
    onClose();
  };

  const nodeEdges = edges.filter(e => e.source === node.id || e.target === node.id);

  return (
    <Modal isOpen={!!nodeId} onClose={onClose} title="Edit Device" size="lg">
      <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
        {/* Device type selector */}
        <div>
          <label className="label">Device Type</label>
          <div className="grid grid-cols-4 gap-2">
            {ALL_DEVICE_TYPES.map(type => (
              <button
                key={type}
                onClick={() => setForm(f => ({ ...f, type }))}
                className={`flex flex-col items-center gap-1 p-2 rounded-lg border transition-colors ${
                  form.type === type
                    ? 'border-brand-500 bg-brand-900/30'
                    : 'border-surface-600 hover:border-surface-500 bg-surface-700'
                }`}
              >
                <DeviceIcon type={type} size={28} />
                <span className="text-xs text-slate-400">{DEVICE_LABELS[type]}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Custom name</label>
            <input
              className="input"
              placeholder={node.hostname || node.ip}
              value={form.custom_name || ''}
              onChange={e => setForm(f => ({ ...f, custom_name: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">IP</label>
            <input className="input font-mono" value={form.ip || ''} readOnly />
          </div>
          <div>
            <label className="label">Hostname</label>
            <input
              className="input"
              value={form.hostname || ''}
              onChange={e => setForm(f => ({ ...f, hostname: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">MAC</label>
            <input className="input font-mono" value={form.mac || ''} readOnly />
          </div>
          <div>
            <label className="label">Vendor</label>
            <input
              className="input"
              value={form.vendor || ''}
              onChange={e => setForm(f => ({ ...f, vendor: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">Group / VLAN</label>
            <input
              className="input"
              placeholder="VLAN 10, DMZ, etc."
              value={form.group || ''}
              onChange={e => setForm(f => ({ ...f, group: e.target.value }))}
            />
          </div>
        </div>

        <div>
          <label className="label">Notes</label>
          <textarea
            className="input resize-none"
            rows={2}
            value={form.notes || ''}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            placeholder="Notes, passwords, physical location..."
          />
        </div>

        {/* Color */}
        <div>
          <label className="label">Custom color</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={form.color || '#6366f1'}
              onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
              className="w-10 h-10 rounded cursor-pointer bg-transparent border border-surface-600"
            />
            <button
              onClick={() => setForm(f => ({ ...f, color: undefined }))}
              className="btn-ghost text-xs px-2 py-1"
            >
              Reset
            </button>
          </div>
        </div>

        {/* Connections */}
        {nodeEdges.length > 0 && (
          <div>
            <label className="label">Connections ({nodeEdges.length})</label>
            <div className="space-y-1">
              {nodeEdges.map(edge => {
                const otherId = edge.source === node.id ? edge.target : edge.source;
                const otherNode = nodes.find(n => n.id === otherId);
                return (
                  <div key={edge.id} className="flex items-center justify-between p-2 bg-surface-700 rounded-lg text-sm">
                    <span className="text-slate-300">
                      {edge.source === node.id ? '→' : '←'}{' '}
                      <span className="font-mono text-slate-200">{otherNode?.label || otherId}</span>
                      <span className="text-slate-500 ml-2">({edge.type})</span>
                    </span>
                    <button
                      onClick={() => removeEdge(edge.id)}
                      className="text-red-400 hover:text-red-300 p-1"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2 border-t border-surface-700">
          <button
            onClick={() => { removeNode(node.id); onClose(); }}
            className="btn-danger flex items-center gap-2 text-sm"
          >
            <Trash2 size={14} />
            Delete
          </button>
          <div className="flex-1" />
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={save} className="btn-primary">Save Changes</button>
        </div>
      </div>
    </Modal>
  );
}
