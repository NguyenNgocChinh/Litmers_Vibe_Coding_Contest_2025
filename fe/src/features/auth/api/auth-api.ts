import { api } from '@/lib/axios';

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
    return `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/auth/google`;
  },
};
