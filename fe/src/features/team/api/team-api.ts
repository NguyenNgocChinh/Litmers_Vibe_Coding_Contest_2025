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
};
