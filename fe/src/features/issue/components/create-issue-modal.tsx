'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { issueApi } from '../api/issue-api';
import { projectApi } from '@/features/project/api/project-api';
import { teamApi } from '@/features/team/api/team-api';
import { labelApi, type Label } from '@/features/label/api/label-api';
import { aiApi } from '@/features/ai/api/ai-api';
import { X, Sparkles, AlertTriangle } from 'lucide-react';
import { useState, useEffect } from 'react';

const createIssueSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title must be at most 200 characters'),
  description: z.string().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']),
  assignee_id: z.string().optional(),
  due_date: z.string().optional(),
  label_ids: z.array(z.string()).optional(),
});

type CreateIssueFormData = z.infer<typeof createIssueSchema>;

interface CreateIssueModalProps {
  projectId: string;
  onClose: () => void;
}

export default function CreateIssueModal({ projectId, onClose }: CreateIssueModalProps) {
  const queryClient = useQueryClient();
  const [error, setError] = useState('');
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const [duplicates, setDuplicates] = useState<Array<{ id: string; title: string; similarity: number }>>([]);
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);
  const [aiLabelLoading, setAiLabelLoading] = useState(false);
  const [duplicateLoading, setDuplicateLoading] = useState(false);
  
  // Get project to get team_id
  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectApi.getOne(projectId),
  });

  // Get team members
  const { data: teamMembers } = useQuery({
    queryKey: ['team-members', project?.team_id],
    queryFn: () => teamApi.getMembers(project!.team_id),
    enabled: !!project?.team_id,
  });

  // Get labels
  const { data: labels } = useQuery({
    queryKey: ['labels', projectId],
    queryFn: () => labelApi.getAll(projectId),
  });

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CreateIssueFormData>({
    resolver: zodResolver(createIssueSchema),
    defaultValues: {
      priority: 'MEDIUM',
      label_ids: [],
    },
  });

  const title = watch('title');
  const description = watch('description');

  // Auto-detect duplicates when title changes
  useEffect(() => {
    if (title && title.length > 5 && projectId) {
      const timeoutId = setTimeout(() => {
        handleDuplicateDetection();
      }, 1000); // Debounce 1 second

      return () => clearTimeout(timeoutId);
    } else {
      setDuplicates([]);
      setShowDuplicateWarning(false);
    }
  }, [title, description, projectId]);

  const handleDuplicateDetection = async () => {
    if (!title || !projectId) return;
    
    setDuplicateLoading(true);
    try {
      const result = await aiApi.detectDuplicates({
        title,
        description,
        project_id: projectId,
      });
      if (result.duplicates && result.duplicates.length > 0) {
        setDuplicates(result.duplicates);
        setShowDuplicateWarning(true);
      } else {
        setDuplicates([]);
        setShowDuplicateWarning(false);
      }
    } catch (error) {
      // Silently fail - duplicate detection is optional
      console.error('Failed to detect duplicates:', error);
    } finally {
      setDuplicateLoading(false);
    }
  };

  const handleAutoLabel = async () => {
    if (!title) return;
    
    setAiLabelLoading(true);
    try {
      const result = await aiApi.autoLabel({
        title,
        description,
      });
      // Map label names to label IDs
      if (result.labels && labels) {
        const matchedLabels = result.labels
          .map((labelName) => labels.find((l) => l.name.toLowerCase() === labelName.toLowerCase()))
          .filter(Boolean)
          .map((l) => l!.id)
          .slice(0, 5); // Max 5 labels
        
        setSelectedLabels(matchedLabels);
        setValue('label_ids', matchedLabels);
      }
    } catch (error: any) {
      setError(error.response?.data?.message || 'Failed to generate labels');
    } finally {
      setAiLabelLoading(false);
    }
  };

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

  const createIssueMutation = useMutation({
    mutationFn: (data: CreateIssueFormData) => issueApi.create({ ...data, project_id: projectId, label_ids: selectedLabels }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['issues', projectId] });
      queryClient.invalidateQueries({ queryKey: ['kanban-board', projectId] });
      onClose();
    },
    onError: (err: any) => {
      setError(err.response?.data?.message || 'Failed to create issue');
    },
  });

  const onSubmit = (data: CreateIssueFormData) => {
    setError('');
    createIssueMutation.mutate({ ...data, label_ids: selectedLabels });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="w-full max-w-2xl p-6 bg-white rounded-lg shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">Create New Issue</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
            <X className="w-6 h-6" />
          </button>
        </div>

        {error && (
          <div className="p-3 mb-4 text-sm text-red-500 bg-red-50 rounded-md">
            {error}
          </div>
        )}

        {showDuplicateWarning && duplicates.length > 0 && (
          <div className="p-3 mb-4 text-sm text-amber-700 bg-amber-50 rounded-md border border-amber-200">
            <div className="flex items-start">
              <AlertTriangle className="w-5 h-5 mr-2 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium mb-1">Similar issues found:</p>
                <ul className="list-disc list-inside space-y-1">
                  {duplicates.map((dup) => (
                    <li key={dup.id}>
                      <a
                        href={`/issues/${dup.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        {dup.title} ({(dup.similarity)}% similar)
                      </a>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => setShowDuplicateWarning(false)}
                  className="mt-2 text-xs text-amber-700 hover:text-amber-900 underline"
                >
                  Dismiss
                </button>
              </div>
            </div>
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
            {duplicateLoading && (
              <p className="mt-1 text-xs text-gray-500">Checking for duplicates...</p>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-700">Description (Optional)</label>
              <button
                type="button"
                onClick={handleAutoLabel}
                disabled={aiLabelLoading || !title}
                className="flex items-center px-2 py-1 text-xs font-medium text-blue-600 bg-blue-50 rounded hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Sparkles className="w-3 h-3 mr-1" />
                {aiLabelLoading ? 'Generating...' : 'AI Auto-Label'}
              </button>
            </div>
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
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Due Date</label>
            <input
              {...register('due_date')}
              type="date"
              className="w-full px-3 py-2 mt-1 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
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
              disabled={createIssueMutation.isPending}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {createIssueMutation.isPending ? 'Creating...' : 'Create Issue'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
