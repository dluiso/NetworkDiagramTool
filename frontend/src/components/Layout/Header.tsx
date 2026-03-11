import { useLocation, useNavigate, Link } from 'react-router-dom';
import { LogOut, User, Sun, Moon, ShieldCheck } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';

const TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/scanner': 'Network Scanner',
  '/projects': 'Projects',
  '/tools': 'Network Tools',
  '/admin': 'Admin Panel',
  '/profile': 'My Profile',
};

export default function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, isAdmin } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();

  const title =
    Object.entries(TITLES).find(([path]) => location.pathname.startsWith(path))?.[1] ??
    'NetDiagram';

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="h-14 bg-surface-800 border-b border-surface-700 flex items-center justify-between px-5">
      <h1 className="text-base font-semibold text-white">{title}</h1>

      <div className="flex items-center gap-2">
        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="btn-ghost px-2 py-2 text-slate-400 hover:text-brand-400"
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        {/* User info — click to go to profile */}
        <Link
          to="/profile"
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-700 hover:bg-surface-600 transition-colors text-sm"
          title="My Profile"
        >
          <div className="w-6 h-6 bg-brand-600 rounded-full flex items-center justify-center">
            <User size={12} className="text-white" />
          </div>
          <span className="text-slate-300">{user?.username ?? '...'}</span>
          {isAdmin() && (
            <span title="Administrator">
              <ShieldCheck size={13} className="text-brand-400" />
            </span>
          )}
        </Link>

        <button
          onClick={handleLogout}
          className="btn-ghost px-2 py-2 text-slate-400 hover:text-red-400"
          title="Sign out"
        >
          <LogOut size={18} />
        </button>
      </div>
    </header>
  );
}
