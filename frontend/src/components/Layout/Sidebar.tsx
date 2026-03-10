import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Radar, FolderOpen, Wrench, Network, ShieldCheck
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';

const NAV_ITEMS = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', permission: 'dashboard' },
  { to: '/scanner', icon: Radar, label: 'Network Scanner', permission: 'scanner' },
  { to: '/projects', icon: FolderOpen, label: 'Projects', permission: 'projects' },
  { to: '/tools', icon: Wrench, label: 'Tools', permission: 'tools' },
];

export default function Sidebar() {
  const { hasPermission, isAdmin } = useAuthStore();

  const visibleItems = NAV_ITEMS.filter((item) => hasPermission(item.permission));

  return (
    <aside className="w-60 bg-surface-800 border-r border-surface-700 flex flex-col">
      {/* Logo */}
      <div className="p-4 border-b border-surface-700">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-brand-600 rounded-lg flex items-center justify-center">
            <Network size={20} className="text-white" />
          </div>
          <div>
            <div className="font-bold text-white text-sm leading-tight">NetDiagram</div>
            <div className="text-slate-500 text-xs">Network Topology</div>
          </div>
        </div>
      </div>

      {/* Main nav */}
      <nav className="flex-1 p-3 space-y-1">
        {visibleItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150 ${
                isActive
                  ? 'bg-brand-600/20 text-brand-400 border border-brand-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-surface-700'
              }`
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Admin section */}
      {isAdmin() && (
        <div className="px-3 pb-2">
          <div className="text-xs text-slate-600 uppercase tracking-wider px-3 py-2">Administration</div>
          <NavLink
            to="/admin"
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150 ${
                isActive
                  ? 'bg-brand-600/20 text-brand-400 border border-brand-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-surface-700'
              }`
            }
          >
            <ShieldCheck size={18} />
            Admin Panel
          </NavLink>
        </div>
      )}

      {/* Footer */}
      <div className="p-3 border-t border-surface-700">
        <div className="text-xs text-slate-600 text-center">v2.0.0</div>
      </div>
    </aside>
  );
}
