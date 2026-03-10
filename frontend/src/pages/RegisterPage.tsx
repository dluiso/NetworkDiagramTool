import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Network, Eye, EyeOff, Loader2, CheckCircle } from 'lucide-react';
import { authApi } from '../api/auth';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';

export default function RegisterPage() {
  const { token } = useAuthStore();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    username: '',
    email: '',
    full_name: '',
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (token) navigate('/dashboard', { replace: true });
  }, [token]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (form.password !== form.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (form.password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    setIsLoading(true);
    try {
      await authApi.register({
        username: form.username.trim().toLowerCase(),
        email: form.email.trim().toLowerCase(),
        full_name: form.full_name.trim() || undefined,
        password: form.password,
      });
      setSuccess(true);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      if (Array.isArray(detail)) {
        toast.error(detail[0]?.msg || 'Registration failed');
      } else {
        toast.error(detail || 'Registration failed');
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-surface-900 flex items-center justify-center p-4">
        <div className="w-full max-w-sm text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-600/20 rounded-2xl mb-4">
            <CheckCircle size={32} className="text-green-400" />
          </div>
          <h1 className="text-xl font-bold text-white mb-2">Registration Received</h1>
          <p className="text-slate-400 text-sm mb-6">
            Your account is pending administrator approval. You will be notified once it has been activated.
          </p>
          <Link to="/login" className="btn-primary inline-block px-6">
            Back to Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-900 flex items-center justify-center p-4">
      {/* Background grid */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage: `linear-gradient(#6366f1 1px, transparent 1px), linear-gradient(90deg, #6366f1 1px, transparent 1px)`,
            backgroundSize: '40px 40px',
          }}
        />
      </div>

      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-brand-600 rounded-2xl mb-4 shadow-lg shadow-brand-900">
            <Network size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">NetDiagram</h1>
          <p className="text-slate-500 text-sm mt-1">Create an account</p>
        </div>

        <div className="card p-6 shadow-2xl">
          <h2 className="text-lg font-semibold text-white mb-5">Register</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Username <span className="text-red-400">*</span></label>
              <input
                type="text"
                name="username"
                className="input"
                placeholder="jsmith"
                value={form.username}
                onChange={handleChange}
                autoFocus
                required
                minLength={3}
                maxLength={50}
                pattern="[a-zA-Z0-9_.\-]+"
                title="Letters, numbers, underscores, dots, and hyphens only"
              />
            </div>

            <div>
              <label className="label">Email <span className="text-red-400">*</span></label>
              <input
                type="email"
                name="email"
                className="input"
                placeholder="john@example.com"
                value={form.email}
                onChange={handleChange}
                required
              />
            </div>

            <div>
              <label className="label">Full Name</label>
              <input
                type="text"
                name="full_name"
                className="input"
                placeholder="John Smith"
                value={form.full_name}
                onChange={handleChange}
                maxLength={100}
              />
            </div>

            <div>
              <label className="label">Password <span className="text-red-400">*</span></label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  className="input pr-10"
                  placeholder="Min. 8 characters"
                  value={form.password}
                  onChange={handleChange}
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div>
              <label className="label">Confirm Password <span className="text-red-400">*</span></label>
              <input
                type={showPassword ? 'text' : 'password'}
                name="confirmPassword"
                className="input"
                placeholder="Repeat your password"
                value={form.confirmPassword}
                onChange={handleChange}
                required
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full flex items-center justify-center gap-2 mt-2"
            >
              {isLoading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Registering...
                </>
              ) : (
                'Create Account'
              )}
            </button>
          </form>

          <div className="mt-4 pt-4 border-t border-surface-700 text-center">
            <p className="text-xs text-slate-500">
              Already have an account?{' '}
              <Link to="/login" className="text-brand-400 hover:text-brand-300">
                Sign in
              </Link>
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-slate-600 mt-4">
          New accounts require administrator approval before access is granted.
        </p>
      </div>
    </div>
  );
}
