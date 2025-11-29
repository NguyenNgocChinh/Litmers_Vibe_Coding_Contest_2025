'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth-store';
import LoadingSpinner from '@/components/ui/loading-spinner';

export default function Home() {
  const router = useRouter();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  useEffect(() => {
    // Redirect based on authentication status
    if (isAuthenticated) {
      router.push('/dashboard');
    } else {
      router.push('/login');
    }
  }, [isAuthenticated, router]);

  // Show loading while redirecting
  return (
    <div className="flex items-center justify-center min-h-screen">
      <LoadingSpinner size={48} />
    </div>
  );
}
