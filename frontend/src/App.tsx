import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from './store/authStore';
import { useThemeStore } from './store/themeStore';
import AppLayout from './components/Layout/AppLayout';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import ScannerPage from './pages/ScannerPage';
import DiagramPage from './pages/DiagramPage';
import ProjectsPage from './pages/ProjectsPage';
import ToolsPage from './pages/ToolsPage';
import AdminPage from './pages/AdminPage';
import ProfilePage from './pages/ProfilePage';

// ---- Route guards ----

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { token } = useAuthStore();
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { token, isAdmin } = useAuthStore();
  if (!token) return <Navigate to="/login" replace />;
  if (!isAdmin()) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function RequirePermission({
  permission,
  children,
}: {
  permission: string;
  children: React.ReactNode;
}) {
  const { token, hasPermission } = useAuthStore();
  if (!token) return <Navigate to="/login" replace />;
  if (!hasPermission(permission)) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

// ---- App ----

export default function App() {
  const { fetchMe, token } = useAuthStore();
  const { theme } = useThemeStore();

  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
    }
  }, [theme]);

  useEffect(() => {
    if (token) fetchMe();
  }, []);

  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: theme === 'light' ? '#ffffff' : '#1e293b',
            color: theme === 'light' ? '#1e293b' : '#f1f5f9',
            border: theme === 'light' ? '1px solid #e2e8f0' : '1px solid #334155',
          },
        }}
      />
      <Routes>
        {/* Public */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Protected — inside AppLayout */}
        <Route
          path="/"
          element={
            <RequireAuth>
              <AppLayout />
            </RequireAuth>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route
            path="scanner"
            element={
              <RequirePermission permission="scanner">
                <ScannerPage />
              </RequirePermission>
            }
          />
          <Route
            path="projects"
            element={
              <RequirePermission permission="projects">
                <ProjectsPage />
              </RequirePermission>
            }
          />
          <Route
            path="diagram/:id"
            element={
              <RequirePermission permission="projects">
                <DiagramPage />
              </RequirePermission>
            }
          />
          <Route
            path="tools"
            element={
              <RequirePermission permission="tools">
                <ToolsPage />
              </RequirePermission>
            }
          />
          <Route path="profile" element={<ProfilePage />} />
          <Route
            path="admin"
            element={
              <RequireAdmin>
                <AdminPage />
              </RequireAdmin>
            }
          />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
