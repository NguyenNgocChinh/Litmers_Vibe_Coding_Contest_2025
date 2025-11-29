import { api } from '@/lib/axios';

export interface Project {
  id: string;
  name: string;
  description?: string;
  team_id: string;
  owner_id: string;
  visibility: 'PUBLIC' | 'PRIVATE';
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

export const projectApi = {
  getAll: async (teamId: string) => {
    const response = await api.get<Project[]>(`/projects?team_id=${teamId}`);
    return response.data;
  },
  getOne: async (id: string) => {
    const response = await api.get<Project>(`/projects/${id}`);
    return response.data;
  },
  create: async (data: { name: string; description?: string; team_id: string; visibility: 'PUBLIC' | 'PRIVATE' }) => {
    const response = await api.post<Project>('/projects', data);
    return response.data;
  },
  update: async (id: string, data: { name?: string; description?: string; visibility?: 'PUBLIC' | 'PRIVATE' }) => {
    const response = await api.patch<Project>(`/projects/${id}`, data);
    return response.data;
  },
  delete: async (id: string) => {
    const response = await api.delete(`/projects/${id}`);
    return response.data;
  },
};
