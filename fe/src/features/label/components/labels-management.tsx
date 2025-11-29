'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { labelApi, type Label } from '../api/label-api';
import { Plus, Edit2, Trash2, X } from 'lucide-react';
import LoadingSpinner from '@/components/ui/loading-spinner';

interface LabelsManagementProps {
  projectId: string;
}

const MAX_LABELS = 20;
const COLOR_PRESETS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
  '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B739', '#52BE80',
  '#E74C3C', '#3498DB', '#9B59B6', '#1ABC9C', '#F39C12',
];

export default function LabelsManagement({ projectId }: LabelsManagementProps) {
  const queryClient = useQueryClient();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingLabel, setEditingLabel] = useState<Label | null>(null);
  const [error, setError] = useState('');

  const { data: labels, isLoading } = useQuery({
    queryKey: ['labels', projectId],
    queryFn: () => labelApi.getAll(projectId),
  });

  const createLabelMutation = useMutation({
    mutationFn: (data: { name: string; color: string }) => labelApi.create(projectId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['labels', projectId] });
      setIsCreateModalOpen(false);
      setError('');
    },
    onError: (err: any) => {
      setError(err.response?.data?.message || 'Failed to create label');
    },
  });

  const updateLabelMutation = useMutation({
    mutationFn: ({ labelId, data }: { labelId: string; data: { name?: string; color?: string } }) =>
      labelApi.update(projectId, labelId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['labels', projectId] });
      setEditingLabel(null);
      setError('');
    },
    onError: (err: any) => {
      setError(err.response?.data?.message || 'Failed to update label');
    },
  });

  const deleteLabelMutation = useMutation({
    mutationFn: (labelId: string) => labelApi.delete(projectId, labelId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['labels', projectId] });
    },
  });

  const handleCreate = (name: string, color: string) => {
    if (!name.trim()) {
      setError('Label name is required');
      return;
    }
    if (labels && labels.length >= MAX_LABELS) {
      setError(`Maximum ${MAX_LABELS} labels per project`);
      return;
    }
    createLabelMutation.mutate({ name: name.trim(), color });
  };

  const handleUpdate = (labelId: string, name: string, color: string) => {
    if (!name.trim()) {
      setError('Label name is required');
      return;
    }
    updateLabelMutation.mutate({ labelId, data: { name: name.trim(), color } });
  };

  if (isLoading) return <LoadingSpinner className="min-h-[400px]" size={32} />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Labels</h2>
          <p className="text-sm text-gray-500 mt-1">
            Manage labels for this project ({labels?.length || 0}/{MAX_LABELS} used)
          </p>
        </div>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          disabled={labels && labels.length >= MAX_LABELS}
          className="flex items-center px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="w-5 h-5 mr-2" />
          Create Label
        </button>
      </div>

      {error && (
        <div className="p-3 text-sm text-red-500 bg-red-50 rounded-md">
          {error}
        </div>
      )}

      {labels && labels.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {labels.map((label) => (
            <div
              key={label.id}
              className="p-4 bg-white rounded-lg shadow-sm border border-gray-200"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <div
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: label.color }}
                  />
                  <span className="text-sm font-medium text-gray-900">{label.name}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setEditingLabel(label)}
                    className="p-1 text-gray-400 hover:text-blue-600"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Are you sure you want to delete label "${label.name}"?`)) {
                        deleteLabelMutation.mutate(label.id);
                      }
                    }}
                    className="p-1 text-gray-400 hover:text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="text-xs text-gray-500">
                Created {new Date(label.created_at).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-8 text-center text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-300">
          No labels yet. Create your first label to get started!
        </div>
      )}

      {/* Create Modal */}
      {isCreateModalOpen && (
        <LabelFormModal
          onClose={() => {
            setIsCreateModalOpen(false);
            setError('');
          }}
          onSubmit={(name, color) => handleCreate(name, color)}
          isSubmitting={createLabelMutation.isPending}
          colorPresets={COLOR_PRESETS}
        />
      )}

      {/* Edit Modal */}
      {editingLabel && (
        <LabelFormModal
          label={editingLabel}
          onClose={() => {
            setEditingLabel(null);
            setError('');
          }}
          onSubmit={(name, color) => handleUpdate(editingLabel.id, name, color)}
          isSubmitting={updateLabelMutation.isPending}
          colorPresets={COLOR_PRESETS}
        />
      )}
    </div>
  );
}

interface LabelFormModalProps {
  label?: Label;
  onClose: () => void;
  onSubmit: (name: string, color: string) => void;
  isSubmitting: boolean;
  colorPresets: string[];
}

function LabelFormModal({ label, onClose, onSubmit, isSubmitting, colorPresets }: LabelFormModalProps) {
  const [name, setName] = useState(label?.name || '');
  const [color, setColor] = useState(label?.color || colorPresets[0]);
  const [customColor, setCustomColor] = useState(label?.color || colorPresets[0]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit(name, color);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="w-full max-w-md p-6 bg-white rounded-lg shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">
            {label ? 'Edit Label' : 'Create Label'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={30}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Label name"
              required
            />
            <p className="mt-1 text-xs text-gray-500">{name.length}/30 characters</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Color</label>
            <div className="space-y-3">
              {/* Color Presets */}
              <div>
                <p className="text-xs text-gray-500 mb-2">Preset Colors</p>
                <div className="flex flex-wrap gap-2">
                  {colorPresets.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => {
                        setColor(preset);
                        setCustomColor(preset);
                      }}
                      className={`w-8 h-8 rounded-full border-2 transition-all ${
                        color === preset ? 'border-gray-900 scale-110' : 'border-gray-300 hover:border-gray-500'
                      }`}
                      style={{ backgroundColor: preset }}
                    />
                  ))}
                </div>
              </div>

              {/* Custom Color Picker */}
              <div>
                <p className="text-xs text-gray-500 mb-2">Custom Color</p>
                <div className="flex items-center space-x-2">
                  <input
                    type="color"
                    value={customColor}
                    onChange={(e) => {
                      setCustomColor(e.target.value);
                      setColor(e.target.value);
                    }}
                    className="w-12 h-12 border rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={customColor}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(value)) {
                        setCustomColor(value);
                        setColor(value);
                      }
                    }}
                    className="flex-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="#FF5733"
                    pattern="^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$"
                  />
                </div>
              </div>

              {/* Current Color Preview */}
              <div className="flex items-center space-x-2">
                <div
                  className="w-8 h-8 rounded border border-gray-300"
                  style={{ backgroundColor: color }}
                />
                <span className="text-sm text-gray-600">{color}</span>
              </div>
            </div>
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
              disabled={isSubmitting || !name.trim()}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {isSubmitting ? (label ? 'Updating...' : 'Creating...') : (label ? 'Update' : 'Create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

