'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { teamApi } from '../api/team-api';
import { X } from 'lucide-react';

const createTeamSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
});

type CreateTeamFormData = z.infer<typeof createTeamSchema>;

interface CreateTeamModalProps {
  onClose: () => void;
}

export default function CreateTeamModal({ onClose }: CreateTeamModalProps) {
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateTeamFormData>({
    resolver: zodResolver(createTeamSchema),
  });

  const createTeamMutation = useMutation({
    mutationFn: teamApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      onClose();
    },
  });

  const onSubmit = (data: CreateTeamFormData) => {
    createTeamMutation.mutate(data);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="w-full max-w-md p-6 bg-white rounded-lg shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">Create New Team</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Team Name</label>
            <input
              {...register('name')}
              type="text"
              className="w-full px-3 py-2 mt-1 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Acme Corp"
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-500">{errors.name.message}</p>
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
              disabled={createTeamMutation.isPending}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {createTeamMutation.isPending ? 'Creating...' : 'Create Team'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
