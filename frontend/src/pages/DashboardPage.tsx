import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FolderOpen, Radar, Network, Server, Monitor, Printer,
  Wifi, GitBranch, Plus, ArrowRight, Activity
} from 'lucide-react';
import { projectsApi } from '../api/projects';
import { scannerApi } from '../api/scanner';
import { Project, ScanJob } from '../types';
import { DEVICE_LABELS } from '../components/shared/DeviceIcon';
import toast from 'react-hot-toast';

export default function DashboardPage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [jobs, setJobs] = useState<ScanJob[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([projectsApi.list(), scannerApi.listJobs()])
      .then(([p, j]) => { setProjects(p); setJobs(j); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleNewProject = async () => {
    const name = `Network ${new Date().toLocaleDateString('en')}`;
    try {
      const p = await projectsApi.create(name);
      navigate(`/diagram/${p.id}`);
    } catch {
      toast.error('Error creating project');
    }
  };

  const completedJobs = jobs.filter(j => j.status === 'completed');
  const totalDevices = completedJobs.reduce((acc, j) => {
    try { return acc + JSON.parse(j.results).length; } catch { return acc; }
  }, 0);

  const stats = [
    { label: 'Projects', value: projects.length, icon: FolderOpen, color: 'text-brand-400', bg: 'bg-brand-900/40' },
    { label: 'Scans completed', value: completedJobs.length, icon: Radar, color: 'text-cyan-400', bg: 'bg-cyan-900/40' },
    { label: 'Devices found', value: totalDevices, icon: Network, color: 'text-green-400', bg: 'bg-green-900/40' },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {stats.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="card p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">{label}</p>
                <p className="text-3xl font-bold text-white mt-1">{loading ? '—' : value}</p>
              </div>
              <div className={`${bg} ${color} p-3 rounded-xl`}>
                <Icon size={24} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Quick actions */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-slate-300 mb-4">Quick Actions</h2>
          <div className="space-y-2">
            <button
              onClick={handleNewProject}
              className="w-full flex items-center gap-3 p-3 rounded-lg bg-brand-600/10 hover:bg-brand-600/20 border border-brand-600/20 text-brand-400 transition-colors"
            >
              <Plus size={18} />
              <span className="text-sm font-medium">New Diagram</span>
            </button>
            <button
              onClick={() => navigate('/scanner')}
              className="w-full flex items-center gap-3 p-3 rounded-lg bg-cyan-600/10 hover:bg-cyan-600/20 border border-cyan-600/20 text-cyan-400 transition-colors"
            >
              <Radar size={18} />
              <span className="text-sm font-medium">Scan Network</span>
            </button>
            <button
              onClick={() => navigate('/projects')}
              className="w-full flex items-center gap-3 p-3 rounded-lg bg-surface-700 hover:bg-surface-600 border border-surface-600 text-slate-300 transition-colors"
            >
              <FolderOpen size={18} />
              <span className="text-sm font-medium">View Projects</span>
            </button>
          </div>
        </div>

        {/* Device type legend */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-slate-300 mb-4">Device Types</h2>
          <div className="grid grid-cols-2 gap-2">
            {[
              { type: 'desktop', icon: Monitor, color: 'text-blue-400' },
              { type: 'server', icon: Server, color: 'text-purple-400' },
              { type: 'switch', icon: GitBranch, color: 'text-cyan-400' },
              { type: 'router', icon: Network, color: 'text-green-400' },
              { type: 'printer', icon: Printer, color: 'text-gray-400' },
              { type: 'ap_wifi', icon: Wifi, color: 'text-yellow-400' },
            ].map(({ type, icon: Icon, color }) => (
              <div key={type} className="flex items-center gap-2 text-sm text-slate-400">
                <Icon size={14} className={color} />
                <span>{DEVICE_LABELS[type as keyof typeof DEVICE_LABELS]}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent projects */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-slate-300">Recent Projects</h2>
          <button onClick={() => navigate('/projects')} className="btn-ghost text-xs px-2 py-1 flex items-center gap-1">
            View all <ArrowRight size={12} />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-20 text-slate-500">Loading...</div>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-24 text-slate-500">
            <Network size={32} className="mb-2 opacity-40" />
            <p className="text-sm">No projects yet</p>
            <button onClick={handleNewProject} className="btn-primary mt-3 text-xs px-3 py-1.5">
              Create first project
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {projects.slice(0, 5).map((p) => {
              let nodeCount = 0;
              try { nodeCount = JSON.parse(p.nodes).length; } catch {}
              return (
                <button
                  key={p.id}
                  onClick={() => navigate(`/diagram/${p.id}`)}
                  className="w-full flex items-center justify-between p-3 rounded-lg bg-surface-700 hover:bg-surface-600 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-brand-900 rounded-lg flex items-center justify-center">
                      <Network size={16} className="text-brand-400" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-white">{p.name}</div>
                      <div className="text-xs text-slate-500">
                        {nodeCount} devices · {new Date(p.updated_at).toLocaleDateString('en')}
                      </div>
                    </div>
                  </div>
                  <ArrowRight size={14} className="text-slate-500" />
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Recent scans */}
      {jobs.length > 0 && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-300">Recent Scans</h2>
            <button onClick={() => navigate('/scanner')} className="btn-ghost text-xs px-2 py-1 flex items-center gap-1">
              Go to scanner <ArrowRight size={12} />
            </button>
          </div>
          <div className="space-y-2">
            {jobs.slice(0, 3).map((j) => {
              let count = 0;
              try { count = JSON.parse(j.results).length; } catch {}
              return (
                <div key={j.id} className="flex items-center justify-between p-3 bg-surface-700 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Activity size={16} className="text-cyan-400" />
                    <div>
                      <div className="text-sm text-white font-mono">{j.ip_range}</div>
                      <div className="text-xs text-slate-500">{new Date(j.created_at).toLocaleString('en')}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`badge ${
                      j.status === 'completed' ? 'bg-green-900/50 text-green-400' :
                      j.status === 'running' ? 'bg-yellow-900/50 text-yellow-400' :
                      j.status === 'failed' ? 'bg-red-900/50 text-red-400' :
                      'bg-surface-700 text-slate-400'
                    }`}>
                      {j.status === 'completed' ? `${count} devices` : j.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
