import client from './client';
import { User, Group, AdminStats, ConfigEntry } from '../types';

export const adminApi = {
  // ---- Stats ----
  getStats: async (): Promise<AdminStats> => {
    const res = await client.get('/admin/stats');
    return res.data;
  },

  // ---- Users ----
  listUsers: async (statusFilter?: 'pending' | 'active' | 'inactive' | 'all'): Promise<User[]> => {
    const params = statusFilter && statusFilter !== 'all' ? { status_filter: statusFilter } : {};
    const res = await client.get('/admin/users', { params });
    return res.data;
  },

  getUser: async (id: number): Promise<User> => {
    const res = await client.get(`/admin/users/${id}`);
    return res.data;
  },

  updateUser: async (id: number, data: Partial<{
    email: string;
    full_name: string;
    is_active: boolean;
    is_approved: boolean;
    is_admin: boolean;
    group_id: number;
  }>): Promise<User> => {
    const res = await client.put(`/admin/users/${id}`, data);
    return res.data;
  },

  approveUser: async (id: number): Promise<User> => {
    const res = await client.post(`/admin/users/${id}/approve`);
    return res.data;
  },

  deactivateUser: async (id: number): Promise<User> => {
    const res = await client.post(`/admin/users/${id}/deactivate`);
    return res.data;
  },

  activateUser: async (id: number): Promise<User> => {
    const res = await client.post(`/admin/users/${id}/activate`);
    return res.data;
  },

  deleteUser: async (id: number): Promise<void> => {
    await client.delete(`/admin/users/${id}`);
  },

  resetPassword: async (id: number, newPassword: string): Promise<void> => {
    await client.put(`/admin/users/${id}/reset-password`, null, {
      params: { new_password: newPassword },
    });
  },

  // ---- Groups ----
  listGroups: async (): Promise<Group[]> => {
    const res = await client.get('/admin/groups');
    return res.data;
  },

  createGroup: async (data: {
    name: string;
    description?: string;
    permissions: string[];
  }): Promise<Group> => {
    const res = await client.post('/admin/groups', data);
    return res.data;
  },

  updateGroup: async (id: number, data: {
    name?: string;
    description?: string;
    permissions?: string[];
  }): Promise<Group> => {
    const res = await client.put(`/admin/groups/${id}`, data);
    return res.data;
  },

  deleteGroup: async (id: number): Promise<void> => {
    await client.delete(`/admin/groups/${id}`);
  },

  setDefaultGroup: async (id: number): Promise<void> => {
    await client.post(`/admin/groups/${id}/set-default`);
  },

  // ---- Configuration ----
  getConfig: async (): Promise<ConfigEntry[]> => {
    const res = await client.get('/admin/config');
    return res.data;
  },

  saveConfig: async (entries: ConfigEntry[]): Promise<void> => {
    await client.put('/admin/config', { entries });
  },

  // ---- Permissions meta ----
  getAvailablePermissions: async (): Promise<{ slug: string; description: string }[]> => {
    const res = await client.get('/admin/permissions/available');
    return res.data;
  },
};
