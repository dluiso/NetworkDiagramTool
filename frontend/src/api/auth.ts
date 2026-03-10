import client from './client';
import { User } from '../types';

export const authApi = {
  login: async (username: string, password: string) => {
    const form = new URLSearchParams();
    form.append('username', username);
    form.append('password', password);
    const res = await client.post('/auth/login', form, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    return res.data as { access_token: string; token_type: string };
  },

  me: async () => {
    const res = await client.get('/auth/me');
    return res.data as User;
  },

  /** Public self-registration — creates inactive user pending admin approval */
  register: async (data: {
    username: string;
    password: string;
    email: string;
    full_name?: string;
  }) => {
    const res = await client.post('/auth/register', data);
    return res.data as { message: string; username: string };
  },

  changePassword: async (oldPassword: string, newPassword: string) => {
    const res = await client.put('/auth/change-password', {
      old_password: oldPassword,
      new_password: newPassword,
    });
    return res.data;
  },

  /** Admin-only: create a user that is immediately active */
  adminCreateUser: async (data: {
    username: string;
    password: string;
    email?: string;
    full_name?: string;
  }) => {
    const res = await client.post('/auth/admin-create', data);
    return res.data as User;
  },
};
