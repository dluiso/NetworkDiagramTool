import { useState } from 'react';
import { User, Shield, Key, CheckCircle } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { authApi } from '../api/auth';
import toast from 'react-hot-toast';

const PERMISSION_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  scanner: 'Network Scanner',
  projects: 'Projects',
  tools: 'Network Tools',
  profile: 'Profile',
  admin: 'Admin Panel',
  users: 'User Management',
  groups: 'Group Management',
  config: 'Configuration',
};

export default function ProfilePage() {
  const { user, fetchMe } = useAuthStore();
  const [passwords, setPasswords] = useState({ old: '', new: '', confirm: '' });
  const [showPasswords, setShowPasswords] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!user) return null;

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwords.new !== passwords.confirm) {
      toast.error('New passwords do not match');
      return;
    }
    if (passwords.new.length < 8) {
      toast.error('New password must be at least 8 characters');
      return;
    }
    setSaving(true);
    try {
      await authApi.changePassword(passwords.old, passwords.new);
      toast.success('Password updated successfully');
      setPasswords({ old: '', new: '', confirm: '' });
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to update password');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      {/* Profile Info */}
      <div className="card p-6">
        <div className="flex items-center gap-4 mb-5">
          <div className="w-14 h-14 bg-brand-600 rounded-full flex items-center justify-center flex-shrink-0">
            <User size={24} className="text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">{user.full_name || user.username}</h2>
            <p className="text-sm text-slate-400">@{user.username}</p>
            {user.email && <p className="text-xs text-slate-500 mt-0.5">{user.email}</p>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-slate-500">Group</span>
            <p className="text-white font-medium mt-0.5">{user.group_name || '—'}</p>
          </div>
          <div>
            <span className="text-slate-500">Status</span>
            <p className="mt-0.5">
              {user.is_active ? (
                <span className="text-green-400 font-medium flex items-center gap-1">
                  <CheckCircle size={14} /> Active
                </span>
              ) : (
                <span className="text-red-400 font-medium">Inactive</span>
              )}
            </p>
          </div>
          <div>
            <span className="text-slate-500">Role</span>
            <p className="text-white font-medium mt-0.5">
              {user.is_admin || user.permissions.includes('admin') ? (
                <span className="flex items-center gap-1 text-brand-400">
                  <Shield size={14} /> Administrator
                </span>
              ) : (
                user.group_name || 'Member'
              )}
            </p>
          </div>
          <div>
            <span className="text-slate-500">Member since</span>
            <p className="text-white font-medium mt-0.5">
              {new Date(user.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>

      {/* Permissions */}
      <div className="card p-6">
        <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
          <Shield size={16} className="text-brand-400" />
          Access Permissions
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {(user.is_admin || user.permissions.includes('admin')
            ? Object.keys(PERMISSION_LABELS)
            : user.permissions
          ).map((perm) => (
            <div
              key={perm}
              className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-surface-700 text-sm"
            >
              <CheckCircle size={13} className="text-green-400 flex-shrink-0" />
              <span className="text-slate-300">{PERMISSION_LABELS[perm] || perm}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Change Password */}
      <div className="card p-6">
        <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
          <Key size={16} className="text-brand-400" />
          Change Password
        </h3>
        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label className="label">Current Password</label>
            <input
              type={showPasswords ? 'text' : 'password'}
              className="input"
              value={passwords.old}
              onChange={(e) => setPasswords((p) => ({ ...p, old: e.target.value }))}
              required
            />
          </div>
          <div>
            <label className="label">New Password</label>
            <input
              type={showPasswords ? 'text' : 'password'}
              className="input"
              placeholder="Min. 8 characters"
              value={passwords.new}
              onChange={(e) => setPasswords((p) => ({ ...p, new: e.target.value }))}
              required
              minLength={8}
            />
          </div>
          <div>
            <label className="label">Confirm New Password</label>
            <input
              type={showPasswords ? 'text' : 'password'}
              className="input"
              value={passwords.confirm}
              onChange={(e) => setPasswords((p) => ({ ...p, confirm: e.target.value }))}
              required
            />
          </div>
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer">
              <input
                type="checkbox"
                checked={showPasswords}
                onChange={(e) => setShowPasswords(e.target.checked)}
                className="accent-brand-600"
              />
              Show passwords
            </label>
            <button type="submit" disabled={saving} className="btn-primary px-5">
              {saving ? 'Saving...' : 'Update Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
