import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FolderOpen, Plus, Trash2, Copy, Network, Edit2, ChevronRight
} from 'lucide-react';
import { projectsApi } from '../api/projects';
import { Project } from '../types';
import { Modal } from '../components/shared/Modal';
import toast from 'react-hot-toast';

export default function ProjectsPage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewModal, setShowNewModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);

  const load = () => {
    setLoading(true);
    projectsApi.list()
      .then(setProjects)
      .catch(() => toast.error('Error loading projects'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const p = await projectsApi.create(newName.trim(), newDesc.trim() || undefined);
      setShowNewModal(false);
      setNewName(''); setNewDesc('');
      navigate(`/diagram/${p.id}`);
    } catch {
      toast.error('Error creating project');
    } finally {
      setCreating(false);
    }
  };

  const handleDuplicate = async (p: Project) => {
    try {
      await projectsApi.duplicate(p.id);
      toast.success('Project duplicated');
      load();
    } catch {
      toast.error('Error duplicating project');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await projectsApi.delete(deleteTarget.id);
      toast.success('Project deleted');
      setDeleteTarget(null);
      load();
    } catch {
      toast.error('Error deleting project');
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-white">Projects</h2>
          <p className="text-slate-400 text-sm">{projects.length} saved projects</p>
        </div>
        <button onClick={() => setShowNewModal(true)} className="btn-primary flex items-center gap-2">
          <Plus size={16} />
          New Project
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48 text-slate-500">Loading...</div>
      ) : projects.length === 0 ? (
        <div className="card flex flex-col items-center justify-center p-16 text-slate-500">
          <Network size={48} className="mb-4 opacity-40" />
          <p className="text-lg font-medium mb-2">No projects yet</p>
          <p className="text-sm mb-6">Create your first network diagram</p>
          <button onClick={() => setShowNewModal(true)} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> Create Project
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((p) => {
            let nodeCount = 0, edgeCount = 0;
            try { nodeCount = JSON.parse(p.nodes).length; } catch {}
            try { edgeCount = JSON.parse(p.edges).length; } catch {}
            return (
              <div key={p.id} className="card hover:border-brand-600/50 transition-colors group">
                <div
                  className="h-32 bg-surface-900 rounded-t-xl flex items-center justify-center cursor-pointer border-b border-surface-700"
                  onClick={() => navigate(`/diagram/${p.id}`)}
                >
                  <Network size={48} className="text-brand-600/30" />
                </div>
                <div className="p-4">
                  <div
                    className="flex items-start justify-between cursor-pointer"
                    onClick={() => navigate(`/diagram/${p.id}`)}
                  >
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-white truncate">{p.name}</h3>
                      {p.description && (
                        <p className="text-xs text-slate-500 truncate mt-0.5">{p.description}</p>
                      )}
                    </div>
                    <ChevronRight size={16} className="text-slate-600 group-hover:text-slate-400 flex-shrink-0 ml-2" />
                  </div>

                  <div className="flex gap-3 text-xs text-slate-500 mt-2">
                    <span>{nodeCount} nodes</span>
                    <span>{edgeCount} connections</span>
                  </div>
                  <div className="text-xs text-slate-600 mt-1">
                    {new Date(p.updated_at).toLocaleString('en')}
                  </div>

                  <div className="flex gap-1 mt-3 pt-3 border-t border-surface-700">
                    <button
                      onClick={() => navigate(`/diagram/${p.id}`)}
                      className="btn-primary flex-1 text-xs py-1.5 flex items-center justify-center gap-1"
                    >
                      <Edit2 size={12} /> Edit
                    </button>
                    <button
                      onClick={() => handleDuplicate(p)}
                      className="btn-secondary text-xs p-1.5"
                      title="Duplicate"
                    >
                      <Copy size={14} />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(p)}
                      className="btn-ghost text-xs p-1.5 text-red-400 hover:bg-red-900/20"
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* New project modal */}
      <Modal isOpen={showNewModal} onClose={() => setShowNewModal(false)} title="New Project">
        <div className="space-y-4">
          <div>
            <label className="label">Name *</label>
            <input
              className="input"
              placeholder="My Main Network"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              autoFocus
            />
          </div>
          <div>
            <label className="label">Description (optional)</label>
            <textarea
              className="input resize-none"
              rows={2}
              placeholder="Diagram description..."
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowNewModal(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleCreate} disabled={creating || !newName.trim()} className="btn-primary">
              {creating ? 'Creating...' : 'Create & Open'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete confirm modal */}
      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Project" size="sm">
        <div className="space-y-4">
          <p className="text-slate-300">
            Delete <strong className="text-white">"{deleteTarget?.name}"</strong>? This action cannot be undone.
          </p>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setDeleteTarget(null)} className="btn-secondary">Cancel</button>
            <button onClick={handleDelete} className="btn-danger">Delete</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
