import { api } from '@/lib/axios';
import type { Issue } from '@/features/kanban/api/kanban-api';
import type { IssueDetail } from '../types/issue-detail.types';

export interface FilterIssuesParams {
  project_id: string;
  search?: string;
  status?: string | string[];
  assignee_id?: string;
  priority?: string | string[];
  label_id?: string;
  has_due_date?: boolean;
  due_date_from?: string;
  due_date_to?: string;
  sort_by?: 'created_at' | 'due_date' | 'priority' | 'updated_at';
  sort_order?: 'asc' | 'desc';
}

export const issueApi = {
  getAll: async (projectId: string, filters?: Omit<FilterIssuesParams, 'project_id'>) => {
    const params = new URLSearchParams({ project_id: projectId });
    
    if (filters) {
      if (filters.search) params.append('search', filters.search);
      if (filters.status) {
        const statusArray = Array.isArray(filters.status) ? filters.status : [filters.status];
        statusArray.forEach(s => params.append('status', s));
      }
      if (filters.assignee_id) params.append('assignee_id', filters.assignee_id);
      if (filters.priority) {
        const priorityArray = Array.isArray(filters.priority) ? filters.priority : [filters.priority];
        priorityArray.forEach(p => params.append('priority', p));
      }
      if (filters.label_id) params.append('label_id', filters.label_id);
      if (filters.has_due_date !== undefined) params.append('has_due_date', String(filters.has_due_date));
      if (filters.due_date_from) params.append('due_date_from', filters.due_date_from);
      if (filters.due_date_to) params.append('due_date_to', filters.due_date_to);
      if (filters.sort_by) params.append('sort_by', filters.sort_by);
      if (filters.sort_order) params.append('sort_order', filters.sort_order);
    }
    
    const response = await api.get<Issue[]>(`/issues?${params.toString()}`);
    return response.data;
  },
  getOne: async (id: string) => {
    const response = await api.get<IssueDetail>(`/issues/${id}`);
    return response.data;
  },
  getChangeHistory: async (id: string) => {
    const response = await api.get(`/issues/${id}/history`);
    return response.data;
  },
  create: async (data: {
    title: string;
    description?: string;
    project_id: string;
    priority: Issue['priority'];
    assignee_id?: string;
    due_date?: string;
    label_ids?: string[];
  }) => {
    const response = await api.post<Issue>('/issues', data);
    return response.data;
  },
  update: async (id: string, data: {
    title?: string;
    description?: string;
    priority?: Issue['priority'];
    status?: string;
    assignee_id?: string | null;
    due_date?: string | null;
    label_ids?: string[];
  }) => {
    const response = await api.patch<IssueDetail>(`/issues/${id}`, data);
    return response.data;
  },
  delete: async (id: string) => {
    const response = await api.delete(`/issues/${id}`);
    return response.data;
  },
};
