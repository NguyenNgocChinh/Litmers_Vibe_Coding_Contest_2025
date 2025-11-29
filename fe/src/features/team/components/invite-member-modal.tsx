'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { teamApi } from '../api/team-api';
import { X } from 'lucide-react';
import { useState } from 'react';

const inviteMemberSchema = z.object({
  email: z.string().email('Invalid email address'),
});

type InviteMemberFormData = z.infer<typeof inviteMemberSchema>;

interface InviteMemberModalProps {
  teamId: string;
  onClose: () => void;
}

export default function InviteMemberModal({ teamId, onClose }: InviteMemberModalProps) {
  const queryClient = useQueryClient();
  const [error, setError] = useState('');
  
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<InviteMemberFormData>({
    resolver: zodResolver(inviteMemberSchema),
  });

  const inviteMutation = useMutation({
    mutationFn: (data: InviteMemberFormData) => teamApi.inviteMember(teamId, data.email),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members', teamId] });
      onClose();
    },
    onError: (err: any) => {
        setError(err.response?.data?.message || 'Failed to invite member');
    }
  });

  const onSubmit = (data: InviteMemberFormData) => {
    setError('');
    inviteMutation.mutate(data);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="w-full max-w-md p-6 bg-white rounded-lg shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">Invite Member</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
            <X className="w-6 h-6" />
          </button>
        </div>

        {error && (
            <div className="p-3 mb-4 text-sm text-red-500 bg-red-50 rounded-md">
            {error}
            </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Email Address</label>
            <input
              {...register('email')}
              type="email"
              className="w-full px-3 py-2 mt-1 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="colleague@example.com"
            />
            {errors.email && (
              <p className="mt-1 text-sm text-red-500">{errors.email.message}</p>
            )}
          </div>

          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={inviteMutation.isPending}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {inviteMutation.isPending ? 'Inviting...' : 'Invite'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
