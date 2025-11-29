import { api } from '@/lib/axios';

export interface Subtask {
  id: string;
  issue_id: string;
  title: string;
  completed: boolean;
  position: number;
  created_at: string;
  updated_at: string;
}

export const subtaskApi = {
  create: async (issueId: string, data: { title: string }) => {
    const response = await api.post<Subtask>(`/issues/${issueId}/subtasks`, data);
    return response.data;
  },
  update: async (issueId: string, subtaskId: string, data: { title?: string; is_completed?: boolean }) => {
    const response = await api.patch<Subtask>(`/issues/${issueId}/subtasks/${subtaskId}`, data);
    return response.data;
  },
  delete: async (issueId: string, subtaskId: string) => {
    const response = await api.delete(`/issues/${issueId}/subtasks/${subtaskId}`);
    return response.data;
  },
};

