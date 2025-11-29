'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { projectApi } from '../api/project-api';
import { X } from 'lucide-react';
import { useState } from 'react';

const createProjectSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  description: z.string().optional(),
  visibility: z.enum(['PUBLIC', 'PRIVATE']),
});

type CreateProjectFormData = z.infer<typeof createProjectSchema>;

interface CreateProjectModalProps {
  teamId: string;
  onClose: () => void;
}

export default function CreateProjectModal({ teamId, onClose }: CreateProjectModalProps) {
  const queryClient = useQueryClient();
  const [error, setError] = useState('');
  
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateProjectFormData>({
    resolver: zodResolver(createProjectSchema),
    defaultValues: {
      visibility: 'PRIVATE',
    },
  });

  const createProjectMutation = useMutation({
    mutationFn: (data: CreateProjectFormData) => projectApi.create({ ...data, team_id: teamId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', teamId] });
      onClose();
    },
    onError: (err: any) => {
      setError(err.response?.data?.message || 'Failed to create project');
    },
  });

  const onSubmit = (data: CreateProjectFormData) => {
    setError('');
    createProjectMutation.mutate(data);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="w-full max-w-md p-6 bg-white rounded-lg shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">Create New Project</h3>
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
            <label className="block text-sm font-medium text-gray-700">Project Name</label>
            <input
              {...register('name')}
              type="text"
              className="w-full px-3 py-2 mt-1 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="My Awesome Project"
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-500">{errors.name.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Description (Optional)</label>
            <textarea
              {...register('description')}
              rows={3}
              className="w-full px-3 py-2 mt-1 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="What is this project about?"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Visibility</label>
            <select
              {...register('visibility')}
              className="w-full px-3 py-2 mt-1 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="PRIVATE">Private</option>
              <option value="PUBLIC">Public</option>
            </select>
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
              disabled={createProjectMutation.isPending}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {createProjectMutation.isPending ? 'Creating...' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
