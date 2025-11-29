import { api } from '@/lib/axios';

export interface Comment {
  id: string;
  issue_id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  user?: {
    id: string;
    name: string;
    avatar_url?: string;
  };
}

export const commentApi = {
  getAll: async (issueId: string) => {
    const response = await api.get<Comment[]>(`/issues/${issueId}/comments`);
    return response.data;
  },
  create: async (issueId: string, data: { content: string }) => {
    const response = await api.post<Comment>(`/issues/${issueId}/comments`, data);
    return response.data;
  },
  update: async (issueId: string, commentId: string, data: { content: string }) => {
    const response = await api.patch<Comment>(`/issues/${issueId}/comments/${commentId}`, data);
    return response.data;
  },
  delete: async (issueId: string, commentId: string) => {
    const response = await api.delete(`/issues/${issueId}/comments/${commentId}`);
    return response.data;
  },
};

