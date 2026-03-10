import { useState } from 'react';
import { Modal } from '../shared/Modal';
import { DiagramNode, DeviceType } from '../../types';
import { DeviceIcon, ALL_DEVICE_TYPES, DEVICE_LABELS } from '../shared/DeviceIcon';
import { useDiagramStore } from '../../store/diagramStore';

function generateId() {
  return Math.random().toString(36).substring(2, 10);
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function AddDeviceModal({ isOpen, onClose }: Props) {
  const { addNode } = useDiagramStore();
  const [form, setForm] = useState({
    type: 'desktop' as DeviceType,
    custom_name: '',
    ip: '',
    hostname: '',
    mac: '',
    vendor: '',
    notes: '',
    group: '',
  });

  const handleAdd = () => {
    const id = generateId();
    const node: DiagramNode = {
      id,
      type: form.type,
      label: form.custom_name || form.hostname || form.ip || `Device-${id}`,
      ip: form.ip,
      hostname: form.hostname,
      mac: form.mac,
      vendor: form.vendor,
      open_ports: [],
      custom_name: form.custom_name,
      custom_type: '',
      notes: form.notes,
      status: 'unknown',
      group: form.group,
      x: 200 + Math.random() * 300,
      y: 200 + Math.random() * 200,
      z: 0,
    };
    addNode(node);
    setForm({ type: 'desktop', custom_name: '', ip: '', hostname: '', mac: '', vendor: '', notes: '', group: '' });
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Device" size="lg">
      <div className="space-y-4">
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
            <label className="label">Name</label>
            <input
              className="input"
              placeholder="My Main Router"
              value={form.custom_name}
              onChange={e => setForm(f => ({ ...f, custom_name: e.target.value }))}
              autoFocus
            />
          </div>
          <div>
            <label className="label">IP</label>
            <input
              className="input font-mono"
              placeholder="192.168.1.1"
              value={form.ip}
              onChange={e => setForm(f => ({ ...f, ip: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">Hostname</label>
            <input
              className="input"
              placeholder="router-main"
              value={form.hostname}
              onChange={e => setForm(f => ({ ...f, hostname: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">Group / VLAN</label>
            <input
              className="input"
              placeholder="VLAN 10"
              value={form.group}
              onChange={e => setForm(f => ({ ...f, group: e.target.value }))}
            />
          </div>
        </div>

        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button
            onClick={handleAdd}
            disabled={!form.custom_name && !form.ip && !form.hostname}
            className="btn-primary"
          >
            Add
          </button>
        </div>
      </div>
    </Modal>
  );
}
