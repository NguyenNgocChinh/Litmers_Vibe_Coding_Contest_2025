import { api } from '@/lib/axios';
import { getApiUrlWithFallback } from '@/lib/config';

export const authApi = {
  login: async (data: any) => {
    const response = await api.post('/auth/login', data);
    return response.data;
  },
  signup: async (data: any) => {
    const response = await api.post('/auth/signup', data);
    return response.data;
  },
  getGoogleAuthUrl: () => {
    return `${getApiUrlWithFallback()}/auth/google`;
  },
  getProfile: async () => {
    const response = await api.get('/auth/profile');
    return response.data;
  },
  updateProfile: async (data: { name?: string; profileImage?: string }) => {
    const response = await api.patch('/auth/profile', data);
    return response.data;
  },
  changePassword: async (data: { currentPassword: string; newPassword: string }) => {
    const response = await api.post('/auth/change-password', data);
    return response.data;
  },
};
