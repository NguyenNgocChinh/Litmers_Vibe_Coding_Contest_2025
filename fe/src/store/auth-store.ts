import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: string;
  email: string;
  name: string;
  avatar_url?: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  setUser: (user: User | null, token?: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      setUser: (user, token) => {
        set({ user, token, isAuthenticated: !!user });
        // Save token to localStorage for axios interceptor (backward compatibility)
        if (token) {
          localStorage.setItem('supabase_token', token);
        } else {
          localStorage.removeItem('supabase_token');
        }
      },
      logout: () => {
        set({ user: null, token: null, isAuthenticated: false });
        localStorage.removeItem('supabase_token');
      },
    }),
    {
      name: 'auth-storage',
    }
  )
);
