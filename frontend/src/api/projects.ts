import client from './client';
import { Project } from '../types';

export const projectsApi = {
  list: async () => {
    const res = await client.get('/projects/');
    return res.data as Project[];
  },

  create: async (name: string, description?: string) => {
    const res = await client.post('/projects/', { name, description });
    return res.data as Project;
  },

  get: async (id: number) => {
    const res = await client.get(`/projects/${id}`);
    return res.data as Project;
  },

  update: async (id: number, data: Partial<Project>) => {
    const res = await client.put(`/projects/${id}`, data);
    return res.data as Project;
  },

  delete: async (id: number) => {
    await client.delete(`/projects/${id}`);
  },

  duplicate: async (id: number) => {
    const res = await client.post(`/projects/${id}/duplicate`);
    return res.data as Project;
  },
};
