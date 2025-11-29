import axios from 'axios';

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Helper function to get token from Zustand store
const getTokenFromStore = (): string | null => {
  try {
    // Try to get token from localStorage directly first (for backward compatibility)
    const directToken = localStorage.getItem('supabase_token');
    if (directToken) {
      return directToken;
    }

    // If not found, try to get from Zustand store
    const authStorage = localStorage.getItem('auth-storage');
    if (authStorage) {
      const parsed = JSON.parse(authStorage);
      if (parsed?.state?.token) {
        return parsed.state.token;
      }
    }
  } catch (error) {
    console.error('Error getting token from store:', error);
  }
  return null;
};

// Add request interceptor to attach auth token
api.interceptors.request.use(
  (config) => {
    // Get token from store (Zustand or direct localStorage)
    const token = getTokenFromStore();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);
