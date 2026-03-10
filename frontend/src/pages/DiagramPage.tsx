import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { projectsApi } from '../api/projects';
import { useDiagramStore } from '../store/diagramStore';
import { DiagramNode, DiagramEdge } from '../types';
import { DiagramToolbar } from '../components/Diagram/DiagramToolbar';
import { View2D } from '../components/Diagram/View2D';
import { View3D } from '../components/Diagram/View3D';
import { ViewFlat } from '../components/Diagram/ViewFlat';
import { EditDeviceModal } from '../components/Diagram/EditDeviceModal';
import { AddDeviceModal } from '../components/Diagram/AddDeviceModal';
import { AddConnectionModal } from '../components/Diagram/AddConnectionModal';
import { DeviceIcon, DEVICE_LABELS, DEVICE_COLORS } from '../components/shared/DeviceIcon';
import { DeviceType } from '../types';
import toast from 'react-hot-toast';

export default function DiagramPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [editNodeId, setEditNodeId] = useState<string | null>(null);
  const [showAddDevice, setShowAddDevice] = useState(false);
  const [showAddConnection, setShowAddConnection] = useState(false);
  const diagramRef = useRef<HTMLDivElement>(null);

  const { setProject, viewMode, nodes, edges, selectedNodeId, setSelectedNode, projectName } = useDiagramStore();

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    projectsApi.get(Number(id))
      .then(p => {
        let parsedNodes: DiagramNode[] = [];
        let parsedEdges: DiagramEdge[] = [];
        try { parsedNodes = JSON.parse(p.nodes || '[]'); } catch {}
        try { parsedEdges = JSON.parse(p.edges || '[]'); } catch {}
        setProject(p.id, p.name, parsedNodes, parsedEdges);
      })
      .catch(() => {
        toast.error('Project not found');
        navigate('/projects');
      })
      .finally(() => setLoading(false));
  }, [id]);

  const selectedNode = nodes.find(n => n.id === selectedNodeId);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 size={32} className="animate-spin text-brand-400" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-2 bg-surface-800 border-b border-surface-700">
        <button onClick={() => navigate('/projects')} className="btn-ghost p-1.5">
          <ArrowLeft size={16} />
        </button>
        <h2 className="text-sm font-semibold text-white">{projectName}</h2>
      </div>

      {/* Toolbar */}
      <DiagramToolbar
        onAddDevice={() => setShowAddDevice(true)}
        onAddConnection={() => setShowAddConnection(true)}
        containerRef={diagramRef as any}
      />

      {/* Main area */}
      <div className="flex flex-1 min-h-0">
        {/* Canvas */}
        <div ref={diagramRef} className="flex-1 relative overflow-hidden">
          {nodes.length === 0 ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500">
              <div className="text-6xl mb-4 opacity-20">⬡</div>
              <p className="text-lg font-medium mb-2">Empty diagram</p>
              <p className="text-sm mb-6">Add devices or import from the scanner</p>
              <button onClick={() => setShowAddDevice(true)} className="btn-primary">
                + Add Device
              </button>
            </div>
          ) : (
            <>
              {viewMode === '2d' && <View2D onNodeClick={setEditNodeId} />}
              {viewMode === '3d' && <View3D onNodeClick={setEditNodeId} />}
              {viewMode === 'flat' && <ViewFlat onNodeClick={setEditNodeId} />}
            </>
          )}
        </div>

        {/* Side panel - selected node info */}
        {selectedNode && (
          <div className="w-64 bg-surface-800 border-l border-surface-700 flex flex-col">
            <div className="p-4 border-b border-surface-700">
              <div className="flex items-center gap-3 mb-2">
                <DeviceIcon type={selectedNode.type as DeviceType} size={36} />
                <div className="min-w-0">
                  <div className="font-semibold text-white text-sm truncate">
                    {selectedNode.custom_name || selectedNode.hostname || selectedNode.ip}
                  </div>
                  <div className="text-xs text-slate-400">
                    {DEVICE_LABELS[selectedNode.type as DeviceType]}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex-1 p-4 space-y-3 overflow-y-auto">
              {[
                { label: 'IP', value: selectedNode.ip },
                { label: 'Hostname', value: selectedNode.hostname },
                { label: 'MAC', value: selectedNode.mac },
                { label: 'Vendor', value: selectedNode.vendor },
                { label: 'Group', value: selectedNode.group },
              ].filter(f => f.value).map(({ label, value }) => (
                <div key={label}>
                  <div className="text-xs text-slate-500 mb-0.5">{label}</div>
                  <div className="text-sm text-slate-200 font-mono break-all">{value}</div>
                </div>
              ))}

              {selectedNode.open_ports && selectedNode.open_ports.length > 0 && (
                <div>
                  <div className="text-xs text-slate-500 mb-1">Open ports</div>
                  <div className="flex flex-wrap gap-1">
                    {selectedNode.open_ports.map(p => (
                      <span key={p} className="badge bg-surface-700 text-slate-400 font-mono text-xs">{p}</span>
                    ))}
                  </div>
                </div>
              )}

              {selectedNode.notes && (
                <div>
                  <div className="text-xs text-slate-500 mb-0.5">Notes</div>
                  <div className="text-sm text-slate-300">{selectedNode.notes}</div>
                </div>
              )}

              {/* Connections */}
              {edges.filter(e => e.source === selectedNode.id || e.target === selectedNode.id).length > 0 && (
                <div>
                  <div className="text-xs text-slate-500 mb-1">Connections</div>
                  <div className="space-y-1">
                    {edges
                      .filter(e => e.source === selectedNode.id || e.target === selectedNode.id)
                      .map(edge => {
                        const otherId = edge.source === selectedNode.id ? edge.target : edge.source;
                        const other = nodes.find(n => n.id === otherId);
                        return (
                          <div key={edge.id} className="flex items-center gap-2 text-xs text-slate-400">
                            <div className="w-2 h-2 rounded-full" style={{
                              backgroundColor: { ethernet: '#334155', wifi: '#fbbf24', fiber: '#22d3ee', wan: '#f97316', vpn: '#a78bfa' }[edge.type] || '#334155'
                            }} />
                            {other?.custom_name || other?.hostname || other?.ip || otherId}
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>

            <div className="p-3 border-t border-surface-700">
              <button
                onClick={() => setEditNodeId(selectedNode.id)}
                className="btn-primary w-full text-sm py-1.5"
              >
                Edit Device
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <EditDeviceModal nodeId={editNodeId} onClose={() => setEditNodeId(null)} />
      <AddDeviceModal isOpen={showAddDevice} onClose={() => setShowAddDevice(false)} />
      <AddConnectionModal isOpen={showAddConnection} onClose={() => setShowAddConnection(false)} />
    </div>
  );
}
