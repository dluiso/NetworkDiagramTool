import { useState, useEffect, useCallback } from 'react';
import {
  Users, Shield, Settings, RefreshCw, CheckCircle, XCircle, Trash2,
  UserPlus, Edit2, MoreVertical, AlertCircle, ChevronDown, Save, Plus
} from 'lucide-react';
import { adminApi } from '../api/admin';
import { authApi } from '../api/auth';
import { User, Group, AdminStats, ConfigEntry } from '../types';
import toast from 'react-hot-toast';

type Tab = 'users' | 'groups' | 'config';
type UserFilter = 'all' | 'pending' | 'active' | 'inactive';

const PERMISSION_META: { slug: string; label: string; description: string }[] = [
  { slug: 'dashboard', label: 'Dashboard', description: 'View dashboard' },
  { slug: 'scanner', label: 'Network Scanner', description: 'Use network scanner' },
  { slug: 'projects', label: 'Projects', description: 'Manage diagram projects' },
  { slug: 'tools', label: 'Tools', description: 'Use network tools' },
  { slug: 'profile', label: 'Profile', description: 'View and edit own profile' },
  { slug: 'admin', label: 'Admin Panel', description: 'Full admin access (grants all)' },
  { slug: 'users', label: 'Users', description: 'Manage users' },
  { slug: 'groups', label: 'Groups', description: 'Manage groups' },
  { slug: 'config', label: 'Configuration', description: 'Manage app settings' },
];

// ---- Sub-component: User row menu ----
function UserActionMenu({
  user,
  currentUserId,
  groups,
  onAction,
}: {
  user: User;
  currentUserId: number;
  groups: Group[];
  onAction: () => void;
}) {
  const [open, setOpen] = useState(false);

  const action = async (fn: () => Promise<any>, successMsg: string) => {
    setOpen(false);
    try {
      await fn();
      toast.success(successMsg);
      onAction();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Action failed');
    }
  };

  return (
    <div className="relative">
      <button
        className="btn-ghost p-1 text-slate-400 hover:text-white"
        onClick={() => setOpen(!open)}
      >
        <MoreVertical size={16} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-1 w-48 card py-1 shadow-xl">
            {!user.is_approved && (
              <button
                className="w-full text-left px-3 py-2 text-sm text-green-400 hover:bg-surface-700"
                onClick={() => action(() => adminApi.approveUser(user.id), `${user.username} approved`)}
              >
                <CheckCircle size={14} className="inline mr-2" />Approve
              </button>
            )}
            {user.is_active && user.id !== currentUserId && (
              <button
                className="w-full text-left px-3 py-2 text-sm text-yellow-400 hover:bg-surface-700"
                onClick={() => action(() => adminApi.deactivateUser(user.id), `${user.username} deactivated`)}
              >
                <XCircle size={14} className="inline mr-2" />Deactivate
              </button>
            )}
            {!user.is_active && user.is_approved && (
              <button
                className="w-full text-left px-3 py-2 text-sm text-blue-400 hover:bg-surface-700"
                onClick={() => action(() => adminApi.activateUser(user.id), `${user.username} activated`)}
              >
                <CheckCircle size={14} className="inline mr-2" />Activate
              </button>
            )}
            <div className="border-t border-surface-700 my-1" />
            <div className="px-3 py-1 text-xs text-slate-500">Change Group</div>
            {groups.map((g) => (
              <button
                key={g.id}
                disabled={user.group_id === g.id}
                className="w-full text-left px-3 py-1.5 text-sm text-slate-300 hover:bg-surface-700 disabled:opacity-40"
                onClick={() => action(
                  () => adminApi.updateUser(user.id, { group_id: g.id }),
                  `Group changed to ${g.name}`
                )}
              >
                {g.name}{user.group_id === g.id ? ' ✓' : ''}
              </button>
            ))}
            {user.id !== currentUserId && (
              <>
                <div className="border-t border-surface-700 my-1" />
                <button
                  className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-surface-700"
                  onClick={() => {
                    if (!confirm(`Delete user "${user.username}"? This cannot be undone.`)) return;
                    action(() => adminApi.deleteUser(user.id), `${user.username} deleted`);
                  }}
                >
                  <Trash2 size={14} className="inline mr-2" />Delete
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ---- Sub-component: Group Editor Modal ----
function GroupModal({
  group,
  onClose,
  onSave,
}: {
  group: Group | null;
  onClose: () => void;
  onSave: () => void;
}) {
  const [name, setName] = useState(group?.name ?? '');
  const [description, setDescription] = useState(group?.description ?? '');
  const [perms, setPerms] = useState<string[]>(group?.permissions ?? []);
  const [saving, setSaving] = useState(false);

  const togglePerm = (slug: string) => {
    setPerms((prev) =>
      prev.includes(slug) ? prev.filter((p) => p !== slug) : [...prev, slug]
    );
  };

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Group name is required'); return; }
    setSaving(true);
    try {
      if (group) {
        await adminApi.updateGroup(group.id, { name: group.is_system ? undefined : name, description, permissions: perms });
        toast.success('Group updated');
      } else {
        await adminApi.createGroup({ name, description, permissions: perms });
        toast.success('Group created');
      }
      onSave();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to save group');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="card w-full max-w-md p-6 shadow-2xl">
        <h3 className="font-semibold text-white mb-4">{group ? 'Edit Group' : 'New Group'}</h3>

        <div className="space-y-4">
          <div>
            <label className="label">Name</label>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!!group?.is_system}
              placeholder="Group name"
            />
            {group?.is_system && <p className="text-xs text-slate-500 mt-1">System groups cannot be renamed</p>}
          </div>
          <div>
            <label className="label">Description</label>
            <input
              className="input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
            />
          </div>
          <div>
            <label className="label mb-2 block">Permissions</label>
            <div className="space-y-2">
              {PERMISSION_META.map(({ slug, label, description: desc }) => (
                <label key={slug} className="flex items-start gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    className="mt-0.5 accent-brand-600"
                    checked={perms.includes(slug)}
                    onChange={() => togglePerm(slug)}
                  />
                  <div>
                    <span className="text-sm text-white group-hover:text-brand-300 transition-colors">{label}</span>
                    <span className="text-xs text-slate-500 ml-2">{desc}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-2 mt-6">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">
            {saving ? 'Saving...' : <><Save size={14} className="mr-1.5" />Save</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- Sub-component: Create User Modal ----
function CreateUserModal({ groups, onClose, onSave }: { groups: Group[]; onClose: () => void; onSave: () => void }) {
  const [form, setForm] = useState({ username: '', email: '', full_name: '', password: '' });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.username || !form.password) { toast.error('Username and password are required'); return; }
    if (form.password.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    setSaving(true);
    try {
      await authApi.adminCreateUser(form);
      toast.success(`User "${form.username}" created`);
      onSave();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to create user');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="card w-full max-w-sm p-6 shadow-2xl">
        <h3 className="font-semibold text-white mb-4">Create User</h3>
        <div className="space-y-3">
          {(['username', 'email', 'full_name', 'password'] as const).map((f) => (
            <div key={f}>
              <label className="label capitalize">{f.replace('_', ' ')}{f === 'username' || f === 'password' ? ' *' : ''}</label>
              <input
                type={f === 'password' ? 'password' : 'text'}
                className="input"
                value={form[f]}
                onChange={(e) => setForm((p) => ({ ...p, [f]: e.target.value }))}
                required={f === 'username' || f === 'password'}
              />
            </div>
          ))}
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">
            {saving ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- Main Admin Page ----
export default function AdminPage() {
  const [tab, setTab] = useState<Tab>('users');
  const [users, setUsers] = useState<User[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [config, setConfig] = useState<ConfigEntry[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [userFilter, setUserFilter] = useState<UserFilter>('all');
  const [loading, setLoading] = useState(false);
  const [editGroup, setEditGroup] = useState<Group | null | 'new'>('new' as any);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<number>(0);

  // track config edits locally
  const [configEdits, setConfigEdits] = useState<Record<string, string>>({});

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [u, g, s, c] = await Promise.all([
        adminApi.listUsers(userFilter === 'all' ? undefined : userFilter),
        adminApi.listGroups(),
        adminApi.getStats(),
        adminApi.getConfig(),
      ]);
      setUsers(u);
      setGroups(g);
      setStats(s);
      setConfig(c);
      if (u.length > 0) {
        // find self
        import('../api/auth').then(({ authApi }) => authApi.me().then((me) => setCurrentUserId(me.id)));
      }
    } catch {
      toast.error('Failed to load admin data');
    } finally {
      setLoading(false);
    }
  }, [userFilter]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const handleSaveConfig = async () => {
    setSavingConfig(true);
    try {
      const entries = config.map((c) => ({
        key: c.key,
        value: configEdits[c.key] !== undefined ? configEdits[c.key] : c.value,
        description: c.description,
      }));
      await adminApi.saveConfig(entries);
      toast.success('Configuration saved');
      setConfigEdits({});
      loadAll();
    } catch {
      toast.error('Failed to save configuration');
    } finally {
      setSavingConfig(false);
    }
  };

  const statusBadge = (user: User) => {
    if (!user.is_approved) return <span className="badge bg-yellow-900/40 text-yellow-400">Pending</span>;
    if (user.is_active) return <span className="badge bg-green-900/40 text-green-400">Active</span>;
    return <span className="badge bg-red-900/40 text-red-400">Inactive</span>;
  };

  return (
    <div className="p-6 space-y-6">
      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: 'Total Users', value: stats.total_users },
            { label: 'Pending', value: stats.pending_approval, accent: stats.pending_approval > 0 ? 'text-yellow-400' : undefined },
            { label: 'Active', value: stats.active_users, accent: 'text-green-400' },
            { label: 'Inactive', value: stats.inactive_users },
            { label: 'Groups', value: stats.total_groups },
          ].map(({ label, value, accent }) => (
            <div key={label} className="card p-4 text-center">
              <div className={`text-2xl font-bold ${accent ?? 'text-white'}`}>{value}</div>
              <div className="text-xs text-slate-500 mt-1">{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-surface-700 flex gap-1">
        {([
          { id: 'users', icon: Users, label: 'Users' },
          { id: 'groups', icon: Shield, label: 'Groups' },
          { id: 'config', icon: Settings, label: 'Configuration' },
        ] as const).map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === id
                ? 'border-brand-500 text-brand-400'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Icon size={15} />{label}
          </button>
        ))}
        <div className="flex-1" />
        <button onClick={loadAll} className="btn-ghost px-2 py-2 text-slate-400 hover:text-white mb-1" title="Refresh">
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* ---- USERS TAB ---- */}
      {tab === 'users' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              {(['all', 'pending', 'active', 'inactive'] as UserFilter[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setUserFilter(f)}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-colors capitalize ${
                    userFilter === f
                      ? 'bg-brand-600 text-white'
                      : 'bg-surface-700 text-slate-400 hover:text-white'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
            <button onClick={() => setShowCreateUser(true)} className="btn-primary text-sm flex items-center gap-2">
              <UserPlus size={14} /> Create User
            </button>
          </div>

          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-surface-700/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wide">User</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wide">Group</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wide">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wide">Joined</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-700">
                {users.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">No users found</td></tr>
                )}
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-surface-700/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-white">{u.username}</div>
                      {u.email && <div className="text-xs text-slate-500">{u.email}</div>}
                      {u.is_admin && <span className="text-xs text-brand-400">Admin</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-400">{u.group_name || '—'}</td>
                    <td className="px-4 py-3">{statusBadge(u)}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {!u.is_approved && (
                        <button
                          className="btn-ghost px-2 py-1 text-green-400 text-xs mr-2 border border-green-800/40 rounded"
                          onClick={async () => {
                            try {
                              await adminApi.approveUser(u.id);
                              toast.success(`${u.username} approved`);
                              loadAll();
                            } catch (err: any) {
                              toast.error(err?.response?.data?.detail || 'Failed');
                            }
                          }}
                        >
                          <CheckCircle size={13} className="inline mr-1" />Approve
                        </button>
                      )}
                      <UserActionMenu
                        user={u}
                        currentUserId={currentUserId}
                        groups={groups}
                        onAction={loadAll}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ---- GROUPS TAB ---- */}
      {tab === 'groups' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => { setEditGroup(null); setShowGroupModal(true); }}
              className="btn-primary text-sm flex items-center gap-2"
            >
              <Plus size={14} /> New Group
            </button>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {groups.map((g) => (
              <div key={g.id} className="card p-5 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-white flex items-center gap-2">
                      {g.name}
                      {g.is_system && <span className="badge bg-surface-700 text-slate-400 text-xs">System</span>}
                      {g.is_default && <span className="badge bg-brand-900/40 text-brand-400 text-xs">Default</span>}
                    </h3>
                    {g.description && <p className="text-xs text-slate-500 mt-0.5">{g.description}</p>}
                  </div>
                  <div className="flex gap-1">
                    <button
                      className="btn-ghost p-1.5 text-slate-400 hover:text-white"
                      onClick={() => { setEditGroup(g); setShowGroupModal(true); }}
                      title="Edit group"
                    >
                      <Edit2 size={14} />
                    </button>
                    {!g.is_system && (
                      <button
                        className="btn-ghost p-1.5 text-red-400 hover:text-red-300"
                        onClick={async () => {
                          if (!confirm(`Delete group "${g.name}"?`)) return;
                          try {
                            await adminApi.deleteGroup(g.id);
                            toast.success('Group deleted');
                            loadAll();
                          } catch (err: any) {
                            toast.error(err?.response?.data?.detail || 'Failed');
                          }
                        }}
                        title="Delete group"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>{g.user_count} member{g.user_count !== 1 ? 's' : ''}</span>
                  {!g.is_default && (
                    <button
                      className="text-brand-400 hover:text-brand-300"
                      onClick={async () => {
                        try {
                          await adminApi.setDefaultGroup(g.id);
                          toast.success(`"${g.name}" is now the default group`);
                          loadAll();
                        } catch (err: any) {
                          toast.error(err?.response?.data?.detail || 'Failed');
                        }
                      }}
                    >
                      Set as default
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {g.permissions.map((p) => (
                    <span key={p} className="badge bg-surface-700 text-slate-300 text-xs">{p}</span>
                  ))}
                  {g.permissions.length === 0 && (
                    <span className="text-xs text-slate-600">No permissions assigned</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ---- CONFIG TAB ---- */}
      {tab === 'config' && (
        <div className="card p-6 max-w-xl space-y-4">
          {config.map((entry) => (
            <div key={entry.key}>
              <label className="label">{entry.key}</label>
              {entry.description && (
                <p className="text-xs text-slate-500 mb-1">{entry.description}</p>
              )}
              {entry.key === 'registration_enabled' ? (
                <select
                  className="input"
                  value={configEdits[entry.key] ?? entry.value ?? 'true'}
                  onChange={(e) => setConfigEdits((p) => ({ ...p, [entry.key]: e.target.value }))}
                >
                  <option value="true">Enabled</option>
                  <option value="false">Disabled</option>
                </select>
              ) : (
                <input
                  type={entry.key.includes('password') ? 'password' : 'text'}
                  className="input"
                  value={configEdits[entry.key] ?? entry.value ?? ''}
                  onChange={(e) => setConfigEdits((p) => ({ ...p, [entry.key]: e.target.value }))}
                  placeholder={entry.key.includes('password') ? '(unchanged)' : ''}
                />
              )}
            </div>
          ))}
          <div className="pt-2">
            <button onClick={handleSaveConfig} disabled={savingConfig} className="btn-primary flex items-center gap-2">
              <Save size={14} />
              {savingConfig ? 'Saving...' : 'Save Configuration'}
            </button>
          </div>
        </div>
      )}

      {/* Modals */}
      {showGroupModal && (
        <GroupModal
          group={editGroup as Group | null}
          onClose={() => setShowGroupModal(false)}
          onSave={() => { setShowGroupModal(false); loadAll(); }}
        />
      )}
      {showCreateUser && (
        <CreateUserModal
          groups={groups}
          onClose={() => setShowCreateUser(false)}
          onSave={() => { setShowCreateUser(false); loadAll(); }}
        />
      )}
    </div>
  );
}
