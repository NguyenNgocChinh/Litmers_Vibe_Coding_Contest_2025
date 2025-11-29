import { api } from '@/lib/axios';

export interface Label {
  id: string;
  project_id: string;
  name: string;
  color: string;
  created_at: string;
}

export const labelApi = {
  getAll: async (projectId: string) => {
    const response = await api.get<Label[]>(`/projects/${projectId}/labels`);
    return response.data;
  },
  create: async (projectId: string, data: { name: string; color: string }) => {
    const response = await api.post<Label>(`/projects/${projectId}/labels`, data);
    return response.data;
  },
  update: async (projectId: string, labelId: string, data: { name?: string; color?: string }) => {
    const response = await api.patch<Label>(`/projects/${projectId}/labels/${labelId}`, data);
    return response.data;
  },
  delete: async (projectId: string, labelId: string) => {
    const response = await api.delete(`/projects/${projectId}/labels/${labelId}`);
    return response.data;
  },
};

