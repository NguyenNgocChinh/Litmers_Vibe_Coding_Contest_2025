import { api } from '@/lib/axios';

export interface KanbanBoard {
  [status: string]: Issue[]; // Dynamic statuses
}

export interface Issue {
  id: string;
  title: string;
  description?: string;
  status: 'Backlog' | 'In Progress' | 'Done' | string; // Allow custom statuses
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  project_id: string;
  assignee_id?: string;
  reporter_id: string;
  created_at: string;
  updated_at: string;
  due_date?: string;
  position?: number;
  assignee?: {
    id: string;
    name: string;
    avatar_url?: string;
  };
  labels?: Array<{
    id: string;
    name: string;
    color: string;
  }>;
  subtasks?: Array<{
    id: string;
    title: string;
    completed: boolean;
  }>;
}

export const kanbanApi = {
  getBoard: async (projectId: string) => {
    const response = await api.get<KanbanBoard>(`/kanban?project_id=${projectId}`);
    return response.data;
  },
  updateIssueStatus: async (issueId: string, status: Issue['status']) => {
    const response = await api.patch<Issue>(`/kanban/issues/${issueId}/status`, { status });
    return response.data;
  },
  updateIssuePosition: async (issueId: string, position: number) => {
    const response = await api.patch<Issue>(`/kanban/issues/${issueId}/position`, { position });
    return response.data;
  },
  updateMultipleIssuePositions: async (updates: Array<{ issueId: string; position: number; status: string }>) => {
    const response = await api.post<{ message: string }>(`/kanban/issues/reorder`, { updates });
    return response.data;
  },
};
