'use client';

import { useAuthStore } from '@/store/auth-store';

export function Header() {
  const user = useAuthStore((state) => state.user);

  return (
    <header className="flex items-center justify-between h-16 px-6 bg-white border-b border-gray-200">
      <div className="flex items-center">
        {/* Mobile menu button could go here */}
      </div>
      <div className="flex items-center space-x-4">
        <div className="text-sm font-medium text-gray-700">
          {user?.name || 'User'}
        </div>
        {user?.avatar_url ? (
          <img
            src={user.avatar_url}
            alt={user.name}
            className="w-8 h-8 rounded-full"
          />
        ) : (
          <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-gray-500">
            {user?.name?.[0] || 'U'}
          </div>
        )}
      </div>
    </header>
  );
}
