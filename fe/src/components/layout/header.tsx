"use client";

import { useAuthStore } from "@/store/auth-store";
import { Menu } from "lucide-react";

interface HeaderProps {
  onMenuClick?: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const user = useAuthStore((state) => state.user);

  return (
    <header className="flex items-center justify-between h-16 px-4 sm:px-6 bg-white border-b border-gray-200">
      <div className="flex items-center">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
          aria-label="Toggle menu"
        >
          <Menu className="w-6 h-6" />
        </button>
      </div>
      <div className="flex items-center space-x-2 sm:space-x-4">
        <div className="hidden sm:block text-sm font-medium text-gray-700">
          {user?.name || "User"}
        </div>
        {user?.avatar_url ? (
          <img
            src={user.avatar_url}
            alt={user.name}
            className="w-8 h-8 rounded-full"
          />
        ) : (
          <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-gray-500">
            {user?.name?.[0] || "U"}
          </div>
        )}
      </div>
    </header>
  );
}
