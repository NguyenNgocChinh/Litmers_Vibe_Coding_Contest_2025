import { api } from '@/lib/axios';

export interface Team {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

export interface TeamMember {
  id: string;
  team_id: string;
  user_id: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
  joined_at: string;
  users: {
    id: string;
    name: string;
    email: string;
    avatar_url?: string | null;
  };
}

export const teamApi = {
  getAll: async () => {
    const response = await api.get<Team[]>('/teams');
    return response.data;
  },
  getOne: async (id: string) => {
    const response = await api.get<Team>(`/teams/${id}`);
    return response.data;
  },
  create: async (data: { name: string }) => {
    const response = await api.post<Team>('/teams', data);
    return response.data;
  },
  update: async (id: string, data: { name: string }) => {
    const response = await api.patch<Team>(`/teams/${id}`, data);
    return response.data;
  },
  delete: async (id: string) => {
    const response = await api.delete(`/teams/${id}`);
    return response.data;
  },
  getMembers: async (id: string) => {
    const response = await api.get<TeamMember[]>(`/teams/${id}/members`);
    return response.data;
  },
  inviteMember: async (id: string, email: string) => {
    const response = await api.post(`/teams/${id}/members`, { email });
    return response.data;
  },
  removeMember: async (teamId: string, memberId: string) => {
    const response = await api.delete(`/teams/${teamId}/members/${memberId}`);
    return response.data;
  },
  updateMemberRole: async (teamId: string, memberId: string, role: string) => {
    const response = await api.patch(`/teams/${teamId}/members/${memberId}`, { role });
    return response.data;
  },
  leaveTeam: async (id: string) => {
    const response = await api.post(`/teams/${id}/leave`);
    return response.data;
  },
  getActivities: async (id: string, limit: number = 50, offset: number = 0) => {
    const response = await api.get<{
      activities: Array<{
        id: string;
        action_type: string;
        description: string;
        old_value: string | null;
        new_value: string | null;
        created_at: string;
        actor: {
          id: string;
          name: string;
          email: string;
          avatar_url?: string | null;
        };
        target_user?: {
          id: string;
          name: string;
          email: string;
        } | null;
      }>;
      total: number;
      limit: number;
      offset: number;
    }>(`/teams/${id}/activities?limit=${limit}&offset=${offset}`);
    return response.data;
  },
  getStatistics: async (id: string, period: string = '30d') => {
    const response = await api.get<{
      period: string;
      creationTrend: Record<string, number>;
      completionTrend: Record<string, number>;
      memberStats: Array<{
        member: {
          id: string;
          name: string;
          email: string;
        };
        assigned: number;
        completed: number;
      }>;
      statusPerProject: Array<{
        name: string;
        Backlog: number;
        'In Progress': number;
        Done: number;
      }>;
    }>(`/teams/${id}/statistics?period=${period}`);
    return response.data;
  },
};
