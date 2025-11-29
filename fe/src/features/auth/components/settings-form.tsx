'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authApi } from '../api/auth-api';
import { useAuthStore } from '@/store/auth-store';
import { useState, useEffect } from 'react';
import { User, Save, Lock, AlertCircle } from 'lucide-react';

const profileSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name is too long'),
  profileImage: z.string().url('Invalid URL').optional().or(z.literal('')),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(6, 'Current password is required'),
  newPassword: z.string().min(6, 'New password must be at least 6 characters'),
  confirmPassword: z.string().min(6, 'Confirm password is required'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

type ProfileFormData = z.infer<typeof profileSchema>;
type PasswordFormData = z.infer<typeof passwordSchema>;

export default function SettingsForm() {
  const { user, setUser } = useAuthStore();
  const queryClient = useQueryClient();
  const [profileError, setProfileError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');

  // Fetch current profile
  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: authApi.getProfile,
    enabled: !!user,
  });

  const profileForm = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user?.name || '',
      profileImage: user?.avatar_url || '',
    },
  });

  const passwordForm = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  // Update form when profile data loads
  useEffect(() => {
    if (profile && !isLoading) {
      profileForm.reset({
        name: profile.name || user?.name || '',
        profileImage: profile.avatar_url || user?.avatar_url || '',
      });
    }
  }, [profile, isLoading, profileForm, user]);

  const updateProfileMutation = useMutation({
    mutationFn: authApi.updateProfile,
    onSuccess: (data) => {
      setProfileError('');
      setProfileSuccess('Profile updated successfully!');
      
      // Update user in store
      if (user) {
        setUser({
          ...user,
          name: data.name || user.name,
          avatar_url: data.avatar_url || user.avatar_url,
        });
      }
      
      // Invalidate profile query
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      
      // Clear success message after 3 seconds
      setTimeout(() => setProfileSuccess(''), 3000);
    },
    onError: (err: any) => {
      setProfileError(err.response?.data?.message || 'Failed to update profile');
      setProfileSuccess('');
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: (data: { currentPassword: string; newPassword: string }) =>
      authApi.changePassword(data),
    onSuccess: () => {
      setPasswordError('');
      setPasswordSuccess('Password changed successfully!');
      passwordForm.reset();
      
      // Clear success message after 3 seconds
      setTimeout(() => setPasswordSuccess(''), 3000);
    },
    onError: (err: any) => {
      setPasswordError(err.response?.data?.message || 'Failed to change password');
      setPasswordSuccess('');
    },
  });

  const onProfileSubmit = (data: ProfileFormData) => {
    setProfileError('');
    setProfileSuccess('');
    updateProfileMutation.mutate({
      name: data.name,
      profileImage: data.profileImage || undefined,
    });
  };

  const onPasswordSubmit = (data: PasswordFormData) => {
    setPasswordError('');
    setPasswordSuccess('');
    changePasswordMutation.mutate({
      currentPassword: data.currentPassword,
      newPassword: data.newPassword,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Profile Settings */}
      <div className="p-6 bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center mb-6">
          <User className="w-5 h-5 mr-2 text-gray-600" />
          <h2 className="text-lg font-semibold text-gray-900">Profile Settings</h2>
        </div>

        {profileError && (
          <div className="mb-4 p-3 text-sm text-red-500 bg-red-50 rounded-md flex items-center">
            <AlertCircle className="w-4 h-4 mr-2" />
            {profileError}
          </div>
        )}

        {profileSuccess && (
          <div className="mb-4 p-3 text-sm text-green-500 bg-green-50 rounded-md">
            {profileSuccess}
          </div>
        )}

        <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name
            </label>
            <input
              type="text"
              {...profileForm.register('name')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {profileForm.formState.errors.name && (
              <p className="mt-1 text-sm text-red-500">
                {profileForm.formState.errors.name.message}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={user?.email || ''}
              disabled
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500 cursor-not-allowed"
            />
            <p className="mt-1 text-xs text-gray-500">Email cannot be changed</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Profile Image URL
            </label>
            <input
              type="url"
              {...profileForm.register('profileImage')}
              placeholder="https://example.com/avatar.jpg"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {profileForm.formState.errors.profileImage && (
              <p className="mt-1 text-sm text-red-500">
                {profileForm.formState.errors.profileImage.message}
              </p>
            )}
            {user?.avatar_url && (
              <div className="mt-2">
                <img
                  src={user.avatar_url}
                  alt="Profile"
                  className="w-16 h-16 rounded-full border border-gray-300"
                />
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={updateProfileMutation.isPending}
            className="flex items-center px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4 mr-2" />
            {updateProfileMutation.isPending ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      </div>

      {/* Password Settings */}
      <div className="p-6 bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center mb-6">
          <Lock className="w-5 h-5 mr-2 text-gray-600" />
          <h2 className="text-lg font-semibold text-gray-900">Change Password</h2>
        </div>

        {passwordError && (
          <div className="mb-4 p-3 text-sm text-red-500 bg-red-50 rounded-md flex items-center">
            <AlertCircle className="w-4 h-4 mr-2" />
            {passwordError}
          </div>
        )}

        {passwordSuccess && (
          <div className="mb-4 p-3 text-sm text-green-500 bg-green-50 rounded-md">
            {passwordSuccess}
          </div>
        )}

        <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Current Password
            </label>
            <input
              type="password"
              {...passwordForm.register('currentPassword')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {passwordForm.formState.errors.currentPassword && (
              <p className="mt-1 text-sm text-red-500">
                {passwordForm.formState.errors.currentPassword.message}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              New Password
            </label>
            <input
              type="password"
              {...passwordForm.register('newPassword')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {passwordForm.formState.errors.newPassword && (
              <p className="mt-1 text-sm text-red-500">
                {passwordForm.formState.errors.newPassword.message}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Confirm New Password
            </label>
            <input
              type="password"
              {...passwordForm.register('confirmPassword')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {passwordForm.formState.errors.confirmPassword && (
              <p className="mt-1 text-sm text-red-500">
                {passwordForm.formState.errors.confirmPassword.message}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={changePasswordMutation.isPending}
            className="flex items-center px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Lock className="w-4 h-4 mr-2" />
            {changePasswordMutation.isPending ? 'Changing...' : 'Change Password'}
          </button>
        </form>
      </div>
    </div>
  );
}

