import { api } from '@/lib/axios';

export const aiApi = {
  summarize: async (data: { issue_id?: string; title: string; description?: string }) => {
    const response = await api.post<{ summary: string; cached?: boolean }>('/ai/summarize', data);
    return response.data;
  },
  suggest: async (data: { issue_id?: string; title: string; description?: string }) => {
    const response = await api.post<{ suggestions: string; cached?: boolean }>('/ai/suggest', data);
    return response.data;
  },
  autoLabel: async (data: { title: string; description?: string }) => {
    const response = await api.post<{ labels: string[] }>('/ai/label', data);
    return response.data;
  },
  detectDuplicates: async (data: { title: string; description?: string; project_id: string }) => {
    const response = await api.post<{ duplicates: Array<{ id: string; title: string; similarity: number }> }>('/ai/duplicate', data);
    return response.data;
  },
  summarizeComments: async (data: { issue_id: string }) => {
    const response = await api.post<{ summary: string; key_decisions: string[]; cached?: boolean }>('/ai/comment-summary', data);
    return response.data;
  },
};

