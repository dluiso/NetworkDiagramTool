import { create } from 'zustand';
import { User } from '../types';
import { authApi } from '../api/auth';

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  fetchMe: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
  isAdmin: () => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: localStorage.getItem('access_token'),
  isLoading: false,

  login: async (username, password) => {
    set({ isLoading: true });
    try {
      const data = await authApi.login(username, password);
      localStorage.setItem('access_token', data.access_token);
      set({ token: data.access_token });
      const user = await authApi.me();
      set({ user, isLoading: false });
    } catch (e) {
      set({ isLoading: false });
      throw e;
    }
  },

  logout: () => {
    localStorage.removeItem('access_token');
    set({ user: null, token: null });
  },

  fetchMe: async () => {
    const token = localStorage.getItem('access_token');
    if (!token) return;
    try {
      const user = await authApi.me();
      set({ user });
    } catch {
      localStorage.removeItem('access_token');
      set({ user: null, token: null });
    }
  },

  hasPermission: (permission: string): boolean => {
    const { user } = get();
    if (!user) return false;
    if (user.is_admin) return true;
    return user.permissions.includes('admin') || user.permissions.includes(permission);
  },

  isAdmin: (): boolean => {
    const { user } = get();
    if (!user) return false;
    return user.is_admin || user.permissions.includes('admin');
  },
}));
