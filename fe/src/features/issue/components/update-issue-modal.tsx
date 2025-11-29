'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { issueApi } from '../api/issue-api';
import { projectApi } from '@/features/project/api/project-api';
import { teamApi } from '@/features/team/api/team-api';
import { labelApi, type Label } from '@/features/label/api/label-api';
import { X } from 'lucide-react';
import { useState, useEffect } from 'react';
import type { IssueDetail } from '../types/issue-detail.types';

const updateIssueSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title must be at most 200 characters'),
  description: z.string().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']),
  status: z.string().min(1, 'Status is required'),
  assignee_id: z.string().optional(),
  due_date: z.string().optional(),
  label_ids: z.array(z.string()).optional(),
});

type UpdateIssueFormData = z.infer<typeof updateIssueSchema>;

interface UpdateIssueModalProps {
  issue: IssueDetail;
  onClose: () => void;
}

export default function UpdateIssueModal({ issue, onClose }: UpdateIssueModalProps) {
  const queryClient = useQueryClient();
  const [error, setError] = useState('');
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  
  // Get project to get team_id
  const { data: project } = useQuery({
    queryKey: ['project', issue.project_id],
    queryFn: () => projectApi.getOne(issue.project_id),
  });

  // Get team members
  const { data: teamMembers } = useQuery({
    queryKey: ['team-members', project?.team_id],
    queryFn: () => teamApi.getMembers(project!.team_id),
    enabled: !!project?.team_id,
  });

  // Get labels
  const { data: labels } = useQuery({
    queryKey: ['labels', issue.project_id],
    queryFn: () => labelApi.getAll(issue.project_id),
  });

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<UpdateIssueFormData>({
    resolver: zodResolver(updateIssueSchema),
    defaultValues: {
      title: issue.title,
      description: issue.description || '',
      priority: issue.priority,
      status: issue.status,
      assignee_id: issue.assignee_id || '',
      due_date: issue.due_date ? new Date(issue.due_date).toISOString().split('T')[0] : '',
      label_ids: issue.labels?.map(l => l.id) || [],
    },
  });

  useEffect(() => {
    if (issue.labels) {
      setSelectedLabels(issue.labels.map(l => l.id));
      setValue('label_ids', issue.labels.map(l => l.id));
    }
  }, [issue.labels, setValue]);

  const toggleLabel = (labelId: string) => {
    if (selectedLabels.length >= 5 && !selectedLabels.includes(labelId)) {
      setError('Maximum 5 labels per issue');
      return;
    }
    
    const newLabels = selectedLabels.includes(labelId)
      ? selectedLabels.filter((id) => id !== labelId)
      : [...selectedLabels, labelId];
    
    setSelectedLabels(newLabels);
    setValue('label_ids', newLabels);
    setError('');
  };

  const updateIssueMutation = useMutation({
    mutationFn: (data: UpdateIssueFormData) => {
      const updateData: any = {
        title: data.title,
        description: data.description,
        priority: data.priority,
        status: data.status,
        assignee_id: data.assignee_id || null,
        due_date: data.due_date || null,
        label_ids: selectedLabels,
      };
      return issueApi.update(issue.id, updateData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['issue', issue.id] });
      queryClient.invalidateQueries({ queryKey: ['issues', issue.project_id] });
      queryClient.invalidateQueries({ queryKey: ['kanban-board', issue.project_id] });
      onClose();
    },
    onError: (err: any) => {
      setError(err.response?.data?.message || 'Failed to update issue');
    },
  });

  const onSubmit = (data: UpdateIssueFormData) => {
    setError('');
    updateIssueMutation.mutate({ ...data, label_ids: selectedLabels });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="w-full max-w-2xl p-6 bg-white rounded-lg shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">Update Issue</h3>
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
            <label className="block text-sm font-medium text-gray-700">Title *</label>
            <input
              {...register('title')}
              type="text"
              className="w-full px-3 py-2 mt-1 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Fix login bug"
            />
            {errors.title && (
              <p className="mt-1 text-sm text-red-500">{errors.title.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Description (Optional)</label>
            <textarea
              {...register('description')}
              rows={4}
              className="w-full px-3 py-2 mt-1 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Describe the issue..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Priority</label>
              <select
                {...register('priority')}
                className="w-full px-3 py-2 mt-1 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Status *</label>
              <input
                {...register('status')}
                type="text"
                className="w-full px-3 py-2 mt-1 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Backlog, In Progress, Done, or custom status"
                list="status-options"
              />
              <datalist id="status-options">
                <option value="Backlog" />
                <option value="In Progress" />
                <option value="Done" />
              </datalist>
              {errors.status && (
                <p className="mt-1 text-sm text-red-500">{errors.status.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Assignee</label>
              <select
                {...register('assignee_id')}
                className="w-full px-3 py-2 mt-1 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Unassigned</option>
                {teamMembers?.map((member) => (
                  <option key={member.user.id} value={member.user.id}>
                    {member.user.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Due Date</label>
              <input
                {...register('due_date')}
                type="date"
                className="w-full px-3 py-2 mt-1 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Labels ({selectedLabels.length}/5)
            </label>
            {labels && labels.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {labels.map((label) => (
                  <button
                    key={label.id}
                    type="button"
                    onClick={() => toggleLabel(label.id)}
                    className={`px-3 py-1 text-sm rounded-full border transition-colors ${
                      selectedLabels.includes(label.id)
                        ? 'bg-opacity-20 border-opacity-50'
                        : 'bg-white border-gray-300 hover:bg-gray-50'
                    }`}
                    style={{
                      backgroundColor: selectedLabels.includes(label.id) ? `${label.color}33` : undefined,
                      borderColor: selectedLabels.includes(label.id) ? label.color : undefined,
                      color: selectedLabels.includes(label.id) ? label.color : '#374151',
                    }}
                  >
                    {label.name}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No labels available for this project</p>
            )}
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={updateIssueMutation.isPending}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {updateIssueMutation.isPending ? 'Updating...' : 'Update Issue'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

