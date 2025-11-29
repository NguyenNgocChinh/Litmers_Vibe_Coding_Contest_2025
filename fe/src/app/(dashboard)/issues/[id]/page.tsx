'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { issueApi } from '@/features/issue/api/issue-api';
import { commentApi, type Comment } from '@/features/issue/api/comment-api';
import { subtaskApi, type Subtask } from '@/features/issue/api/subtask-api';
import { aiApi } from '@/features/ai/api/ai-api';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ArrowUp, ArrowDown, Minus, Edit2, Calendar, CheckCircle2, Circle, Sparkles, Lightbulb, History, X, Trash2, Plus, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import LoadingSpinner from '@/components/ui/loading-spinner';
import { useAuthStore } from '@/features/auth/store/auth-store';
import type { IssueDetail } from '@/features/issue/types/issue-detail.types';
import UpdateIssueModal from '@/features/issue/components/update-issue-modal';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, useSensor, useSensors, closestCenter } from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const priorityConfig = {
  HIGH: { color: 'text-orange-600', bg: 'bg-orange-50', icon: ArrowUp },
  MEDIUM: { color: 'text-yellow-600', bg: 'bg-yellow-50', icon: Minus },
  LOW: { color: 'text-gray-600', bg: 'bg-gray-50', icon: ArrowDown },
};

const statusConfig: Record<string, { color: string }> = {
  'Backlog': { color: 'bg-gray-100 text-gray-800' },
  'In Progress': { color: 'bg-blue-100 text-blue-800' },
  'Done': { color: 'bg-green-100 text-green-800' },
};

export default function IssueDetailPage() {
  const params = useParams();
  const router = useRouter();
  const issueId = params.id as string;
  const currentUser = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [commentContent, setCommentContent] = useState('');
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editCommentContent, setEditCommentContent] = useState('');
  const [aiSummary, setAiSummary] = useState<{ summary: string; cached?: boolean } | null>(null);
  const [aiSuggestion, setAiSuggestion] = useState<{ suggestions: string; cached?: boolean } | null>(null);
  const [aiCommentSummary, setAiCommentSummary] = useState<{ summary: string; key_decisions: string[]; cached?: boolean } | null>(null);
  const [aiLoading, setAiLoading] = useState<{ summary?: boolean; suggestion?: boolean; commentSummary?: boolean }>({});
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [editingSubtaskId, setEditingSubtaskId] = useState<string | null>(null);
  const [editSubtaskTitle, setEditSubtaskTitle] = useState('');
  const [activeSubtask, setActiveSubtask] = useState<Subtask | null>(null);
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [commentsPerPage, setCommentsPerPage] = useState(10);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const { data: issue, isLoading } = useQuery({
    queryKey: ['issue', issueId],
    queryFn: () => issueApi.getOne(issueId),
  });

  // Sync subtasks state with issue subtasks
  useEffect(() => {
    if (issue?.subtasks) {
      setSubtasks(issue.subtasks as Subtask[]);
    }
  }, [issue?.subtasks]);

  const { data: comments, isLoading: commentsLoading } = useQuery({
    queryKey: ['comments', issueId],
    queryFn: () => commentApi.getAll(issueId),
    enabled: !!issueId,
  });


  const createCommentMutation = useMutation({
    mutationFn: (content: string) => commentApi.create(issueId, { content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', issueId] });
      queryClient.invalidateQueries({ queryKey: ['ai-comment-summary', issueId] });
      setCommentContent('');
    },
  });

  const updateCommentMutation = useMutation({
    mutationFn: ({ commentId, content }: { commentId: string; content: string }) =>
      commentApi.update(issueId, commentId, { content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', issueId] });
      setEditingCommentId(null);
      setEditCommentContent('');
    },
  });

  const deleteCommentMutation = useMutation({
    mutationFn: (commentId: string) => commentApi.delete(issueId, commentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', issueId] });
      queryClient.invalidateQueries({ queryKey: ['ai-comment-summary', issueId] });
    },
  });

  const createSubtaskMutation = useMutation({
    mutationFn: (title: string) => subtaskApi.create(issueId, { title }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['issue', issueId] });
      setNewSubtaskTitle('');
    },
  });

  const updateSubtaskMutation = useMutation({
    mutationFn: ({ subtaskId, data }: { subtaskId: string; data: { title?: string; is_completed?: boolean } }) =>
      subtaskApi.update(issueId, subtaskId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['issue', issueId] });
      setEditingSubtaskId(null);
      setEditSubtaskTitle('');
    },
  });

  const toggleSubtaskMutation = useMutation({
    mutationFn: ({ subtaskId, completed }: { subtaskId: string; completed: boolean }) =>
      subtaskApi.update(issueId, subtaskId, { is_completed: completed }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['issue', issueId] });
    },
  });

  const deleteSubtaskMutation = useMutation({
    mutationFn: (subtaskId: string) => subtaskApi.delete(issueId, subtaskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['issue', issueId] });
    },
  });

  const handleSubtaskDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const subtask = subtasks.find(s => s.id === active.id);
    if (subtask) {
      setActiveSubtask(subtask);
    }
  };

  const handleSubtaskDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveSubtask(null);

    if (!over || active.id === over.id) return;

    const oldIndex = subtasks.findIndex(s => s.id === active.id);
    const newIndex = subtasks.findIndex(s => s.id === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      const newSubtasks = arrayMove(subtasks, oldIndex, newIndex);
      setSubtasks(newSubtasks);
      // Note: Backend doesn't have position update endpoint yet, so we just update local state
      // In a real implementation, you would call an API to update positions
    }
  };


  const handleStartEditComment = (comment: Comment) => {
    setEditingCommentId(comment.id);
    setEditCommentContent(comment.content);
  };

  const handleSaveComment = () => {
    if (editingCommentId) {
      updateCommentMutation.mutate({
        commentId: editingCommentId,
        content: editCommentContent,
      });
    }
  };

  const handleGetAISummary = async () => {
    if (!issue) return;
    setAiLoading({ ...aiLoading, summary: true });
    try {
      const result = await aiApi.summarize({
        issue_id: issueId,
        title: issue.title,
        description: issue.description,
      });
      setAiSummary(result);
    } catch (error) {
      console.error('Failed to get AI summary:', error);
    } finally {
      setAiLoading({ ...aiLoading, summary: false });
    }
  };

  const handleGetAISuggestion = async () => {
    if (!issue) return;
    setAiLoading({ ...aiLoading, suggestion: true });
    try {
      const result = await aiApi.suggest({
        issue_id: issueId,
        title: issue.title,
        description: issue.description,
      });
      setAiSuggestion(result);
    } catch (error) {
      console.error('Failed to get AI suggestion:', error);
    } finally {
      setAiLoading({ ...aiLoading, suggestion: false });
    }
  };

  const handleGetAICommentSummary = async () => {
    if (!issue) return;
    setAiLoading({ ...aiLoading, commentSummary: true });
    try {
      const result = await aiApi.summarizeComments({
        issue_id: issueId,
      });
      setAiCommentSummary(result);
    } catch (error: any) {
      if (error.response?.status === 400) {
        alert('At least 5 comments are required for comment summary');
      }
      console.error('Failed to get AI comment summary:', error);
    } finally {
      setAiLoading({ ...aiLoading, commentSummary: false });
    }
  };

  if (isLoading) return <LoadingSpinner className="min-h-[400px]" size={32} />;
  if (!issue) return <div>Issue not found</div>;

  const priorityStyle = priorityConfig[issue.priority];
  const PriorityIcon = priorityStyle.icon;
  const statusStyle = statusConfig[issue.status] || { color: 'bg-gray-100 text-gray-800' };
  const completedSubtasks = issue.subtasks?.filter(s => s.completed).length || 0;
  const totalSubtasks = issue.subtasks?.length || 0;
  const subtaskProgress = totalSubtasks > 0 ? (completedSubtasks / totalSubtasks) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link href={`/projects/${issue.project_id}`} className="text-gray-400 hover:text-gray-600">
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">{issue.title}</h1>
        </div>
        <button
          onClick={() => setIsUpdateModalOpen(true)}
          className="flex items-center px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
        >
          <Edit2 className="w-4 h-4 mr-2" />
          Edit
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          <div className="p-6 bg-white rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Description</h3>
            {issue.description ? (
              <p className="text-gray-700 whitespace-pre-wrap">{issue.description}</p>
            ) : (
              <p className="text-gray-400 italic">No description provided.</p>
            )}
          </div>

          {/* AI Features */}
          {issue.description && issue.description.length > 10 && (
            <div className="p-6 bg-white rounded-lg shadow-sm border border-gray-200">
              <h3 className="text-lg font-medium text-gray-900 mb-4">AI Features</h3>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={handleGetAISummary}
                  disabled={aiLoading.summary}
                  className="flex items-center px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100 disabled:opacity-50"
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  {aiLoading.summary ? 'Generating...' : 'AI Summary'}
                </button>
                <button
                  onClick={handleGetAISuggestion}
                  disabled={aiLoading.suggestion}
                  className="flex items-center px-4 py-2 text-sm font-medium text-purple-600 bg-purple-50 rounded-md hover:bg-purple-100 disabled:opacity-50"
                >
                  <Lightbulb className="w-4 h-4 mr-2" />
                  {aiLoading.suggestion ? 'Generating...' : 'AI Suggestion'}
                </button>
                {comments && comments.length >= 5 && (
                  <button
                    onClick={handleGetAICommentSummary}
                    disabled={aiLoading.commentSummary}
                    className="flex items-center px-4 py-2 text-sm font-medium text-green-600 bg-green-50 rounded-md hover:bg-green-100 disabled:opacity-50"
                  >
                    <Sparkles className="w-4 h-4 mr-2" />
                    {aiLoading.commentSummary ? 'Generating...' : 'Comment Summary'}
                  </button>
                )}
              </div>
              
              {aiSummary && (
                <div className="mt-4 p-4 bg-blue-50 rounded-md border border-blue-200">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-blue-900 mb-2">AI Summary</p>
                      <p className="text-sm text-blue-800 whitespace-pre-wrap">{aiSummary.summary}</p>
                      {aiSummary.cached && (
                        <p className="text-xs text-blue-600 mt-2">(Cached)</p>
                      )}
                    </div>
                    <button
                      onClick={() => setAiSummary(null)}
                      className="text-blue-400 hover:text-blue-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {aiSuggestion && (
                <div className="mt-4 p-4 bg-purple-50 rounded-md border border-purple-200">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-purple-900 mb-2">AI Suggestion</p>
                      <p className="text-sm text-purple-800 whitespace-pre-wrap">{aiSuggestion.suggestions}</p>
                      {aiSuggestion.cached && (
                        <p className="text-xs text-purple-600 mt-2">(Cached)</p>
                      )}
                    </div>
                    <button
                      onClick={() => setAiSuggestion(null)}
                      className="text-purple-400 hover:text-purple-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {aiCommentSummary && (
                <div className="mt-4 p-4 bg-green-50 rounded-md border border-green-200">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-green-900 mb-2">Comment Summary</p>
                      <p className="text-sm text-green-800 whitespace-pre-wrap mb-3">{aiCommentSummary.summary}</p>
                      {aiCommentSummary.key_decisions && aiCommentSummary.key_decisions.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-green-900 mb-1">Key Decisions:</p>
                          <ul className="list-disc list-inside text-xs text-green-800 space-y-1">
                            {aiCommentSummary.key_decisions.map((decision, idx) => (
                              <li key={idx}>{decision}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {aiCommentSummary.cached && (
                        <p className="text-xs text-green-600 mt-2">(Cached)</p>
                      )}
                    </div>
                    <button
                      onClick={() => setAiCommentSummary(null)}
                      className="text-green-400 hover:text-green-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Subtasks */}
          <div className="p-6 bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Subtasks</h3>
              {subtasks.length > 0 && (
                <div className="text-sm text-gray-500">
                  {completedSubtasks} of {totalSubtasks} completed
                </div>
              )}
            </div>
            
            {subtasks.length > 0 && (
              <div className="mb-3 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 transition-all"
                  style={{ width: `${subtaskProgress}%` }}
                />
              </div>
            )}

            {/* Add Subtask Form */}
            {!editingSubtaskId && (
              <div className="mb-4 flex items-center space-x-2">
                <input
                  type="text"
                  value={newSubtaskTitle}
                  onChange={(e) => setNewSubtaskTitle(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && newSubtaskTitle.trim()) {
                      createSubtaskMutation.mutate(newSubtaskTitle.trim());
                    }
                  }}
                  placeholder="Add a subtask..."
                  className="flex-1 px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={() => {
                    if (newSubtaskTitle.trim()) {
                      createSubtaskMutation.mutate(newSubtaskTitle.trim());
                    }
                  }}
                  disabled={!newSubtaskTitle.trim() || createSubtaskMutation.isPending}
                  className="flex items-center px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Subtasks List */}
            {subtasks.length > 0 ? (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleSubtaskDragStart}
                onDragEnd={handleSubtaskDragEnd}
              >
                <SortableContext items={subtasks.map(s => s.id)} strategy={verticalListSortingStrategy}>
                  <ul className="space-y-2">
                    {subtasks.map((subtask) => (
                      <SortableSubtaskItem
                        key={subtask.id}
                        subtask={subtask}
                        isEditing={editingSubtaskId === subtask.id}
                        editTitle={editSubtaskTitle}
                        onEditTitleChange={setEditSubtaskTitle}
                        onToggleComplete={(completed) => toggleSubtaskMutation.mutate({ subtaskId: subtask.id, completed })}
                        onStartEdit={() => {
                          setEditingSubtaskId(subtask.id);
                          setEditSubtaskTitle(subtask.title);
                        }}
                        onSaveEdit={() => {
                          if (editSubtaskTitle.trim()) {
                            updateSubtaskMutation.mutate({
                              subtaskId: subtask.id,
                              data: { title: editSubtaskTitle.trim() },
                            });
                          }
                        }}
                        onCancelEdit={() => {
                          setEditingSubtaskId(null);
                          setEditSubtaskTitle('');
                        }}
                        onDelete={() => {
                          if (confirm(`Delete subtask "${subtask.title}"?`)) {
                            deleteSubtaskMutation.mutate(subtask.id);
                          }
                        }}
                      />
                    ))}
                  </ul>
                </SortableContext>
                <DragOverlay>
                  {activeSubtask ? (
                    <div className="p-2 bg-white border border-gray-200 rounded shadow-lg opacity-90">
                      <div className="flex items-center space-x-2">
                        <GripVertical className="w-4 h-4 text-gray-400" />
                        <span className="text-sm">{activeSubtask.title}</span>
                      </div>
                    </div>
                  ) : null}
                </DragOverlay>
              </DndContext>
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">No subtasks yet. Add one above!</p>
            )}
          </div>

          {/* Comments */}
          <div className="p-6 bg-white rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Comments {comments && `(${comments.length})`}
            </h3>
            
            {/* Create Comment */}
            <div className="mb-6">
              <textarea
                value={commentContent}
                onChange={(e) => setCommentContent(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Add a comment..."
              />
              <div className="flex justify-end mt-2">
                <button
                  onClick={() => createCommentMutation.mutate(commentContent)}
                  disabled={!commentContent.trim() || createCommentMutation.isPending}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {createCommentMutation.isPending ? 'Posting...' : 'Post Comment'}
                </button>
              </div>
            </div>

            {/* Comments List */}
            {commentsLoading ? (
              <LoadingSpinner className="min-h-[100px]" size={24} />
            ) : comments && comments.length > 0 ? (
              <div className="space-y-4">
                {comments.slice(0, commentsPerPage).map((comment) => (
                  <div key={comment.id} className="border-b border-gray-200 pb-4 last:border-0">
                    {editingCommentId === comment.id ? (
                      <div>
                        <textarea
                          value={editCommentContent}
                          onChange={(e) => setEditCommentContent(e.target.value)}
                          rows={3}
                          className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
                        />
                        <div className="flex justify-end space-x-2">
                          <button
                            onClick={() => {
                              setEditingCommentId(null);
                              setEditCommentContent('');
                            }}
                            className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handleSaveComment}
                            disabled={updateCommentMutation.isPending}
                            className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            {comment.user?.avatar_url ? (
                              <img
                                src={comment.user.avatar_url}
                                alt={comment.user.name}
                                className="w-8 h-8 rounded-full"
                              />
                            ) : (
                              <div className="flex items-center justify-center w-8 h-8 bg-gray-200 rounded-full text-gray-500 text-sm font-medium">
                                {comment.user?.name?.[0] || 'U'}
                              </div>
                            )}
                            <div>
                              <p className="text-sm font-medium text-gray-900">{comment.user?.name || 'Unknown'}</p>
                              <p className="text-xs text-gray-500">
                                {new Date(comment.created_at).toLocaleString()}
                                {comment.updated_at !== comment.created_at && ' (edited)'}
                              </p>
                            </div>
                          </div>
                          {comment.user_id === currentUser?.id && (
                            <div className="flex space-x-2">
                              <button
                                onClick={() => handleStartEditComment(comment)}
                                className="text-gray-400 hover:text-gray-600"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => {
                                  if (confirm('Are you sure you want to delete this comment?')) {
                                    deleteCommentMutation.mutate(comment.id);
                                  }
                                }}
                                className="text-gray-400 hover:text-red-600"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </div>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap ml-10">{comment.content}</p>
                      </div>
                    )}
                  </div>
                ))}
                
                {/* Load More / Pagination */}
                {comments.length > commentsPerPage && (
                  <div className="flex justify-center pt-4">
                    <button
                      onClick={() => setCommentsPerPage(prev => Math.min(prev + 10, comments.length))}
                      className="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100"
                    >
                      Load More ({comments.length - commentsPerPage} remaining)
                    </button>
                  </div>
                )}
                
                {commentsPerPage >= comments.length && comments.length > 10 && (
                  <div className="flex justify-center pt-2">
                    <button
                      onClick={() => setCommentsPerPage(10)}
                      className="text-sm text-gray-500 hover:text-gray-700"
                    >
                      Show Less
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-gray-400 text-center py-8">No comments yet. Be the first to comment!</p>
            )}
          </div>

          {/* Change History */}
          {issue.change_history && issue.change_history.length > 0 && (
            <div className="p-6 bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center space-x-2 mb-4">
                <History className="w-5 h-5 text-gray-500" />
                <h3 className="text-lg font-medium text-gray-900">Change History</h3>
              </div>
              <div className="space-y-4">
                {issue.change_history.map((activity) => (
                  <div key={activity.id} className="flex items-start space-x-3">
                    <div className="flex-shrink-0">
                      {activity.actor?.avatar_url ? (
                        <img
                          src={activity.actor.avatar_url}
                          alt={activity.actor.name}
                          className="w-8 h-8 rounded-full"
                        />
                      ) : (
                        <div className="flex items-center justify-center w-8 h-8 bg-gray-200 rounded-full text-gray-500 text-sm font-medium">
                          {activity.actor?.name?.[0] || 'U'}
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-gray-900">
                        <span className="font-medium">{activity.actor?.name || 'Unknown'}</span>
                        {' '}changed <span className="font-medium">{activity.field_name}</span>
                        {activity.old_value && activity.new_value && (
                          <>
                            {' '}from <span className="text-gray-600">"{activity.old_value}"</span>
                            {' '}to <span className="text-gray-600">"{activity.new_value}"</span>
                          </>
                        )}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(activity.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div className="p-6 bg-white rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-sm font-medium text-gray-900 mb-4">Details</h3>
            <dl className="space-y-3">
              <div>
                <dt className="text-xs font-medium text-gray-500">Status</dt>
                <dd className="mt-1">
                  <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium', statusStyle.color)}>
                    {issue.status}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-500">Priority</dt>
                <dd className="mt-1">
                  <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium', priorityStyle.bg, priorityStyle.color)}>
                    <PriorityIcon className="w-3 h-3 mr-1" />
                    {issue.priority}
                  </span>
                </dd>
              </div>
              {issue.due_date && (
                <div>
                  <dt className="text-xs font-medium text-gray-500">Due Date</dt>
                  <dd className="mt-1 flex items-center text-sm text-gray-900">
                    <Calendar className="w-4 h-4 mr-2" />
                    {new Date(issue.due_date).toLocaleDateString()}
                  </dd>
                </div>
              )}
              {issue.labels && issue.labels.length > 0 && (
                <div>
                  <dt className="text-xs font-medium text-gray-500 mb-2">Labels</dt>
                  <dd className="mt-1 flex flex-wrap gap-2">
                    {issue.labels.map((label) => (
                      <span
                        key={label.id}
                        className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border"
                        style={{
                          backgroundColor: `${label.color}33`,
                          borderColor: label.color,
                          color: label.color,
                        }}
                      >
                        {label.name}
                      </span>
                    ))}
                  </dd>
                </div>
              )}
              <div>
                <dt className="text-xs font-medium text-gray-500">Assignee</dt>
                <dd className="mt-1">
                  {issue.assignee ? (
                    <div className="flex items-center">
                      {issue.assignee.avatar_url ? (
                        <img
                          src={issue.assignee.avatar_url}
                          alt={issue.assignee.name}
                          className="w-6 h-6 rounded-full mr-2"
                        />
                      ) : (
                        <div className="flex items-center justify-center w-6 h-6 bg-gray-200 rounded-full text-gray-500 text-xs font-medium mr-2">
                          {issue.assignee.name[0]}
                        </div>
                      )}
                      <span className="text-sm text-gray-900">{issue.assignee.name}</span>
                    </div>
                  ) : (
                    <span className="text-sm text-gray-400">Unassigned</span>
                  )}
                </dd>
              </div>
              {issue.reporter && (
                <div>
                  <dt className="text-xs font-medium text-gray-500">Reporter</dt>
                  <dd className="mt-1">
                    <div className="flex items-center">
                      {issue.reporter.avatar_url ? (
                        <img
                          src={issue.reporter.avatar_url}
                          alt={issue.reporter.name}
                          className="w-6 h-6 rounded-full mr-2"
                        />
                      ) : (
                        <div className="flex items-center justify-center w-6 h-6 bg-gray-200 rounded-full text-gray-500 text-xs font-medium mr-2">
                          {issue.reporter.name[0]}
                        </div>
                      )}
                      <span className="text-sm text-gray-900">{issue.reporter.name}</span>
                    </div>
                  </dd>
                </div>
              )}
              <div>
                <dt className="text-xs font-medium text-gray-500">Created</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {new Date(issue.created_at).toLocaleDateString()}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-500">Updated</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {new Date(issue.updated_at).toLocaleDateString()}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>

      {isUpdateModalOpen && issue && (
        <UpdateIssueModal issue={issue} onClose={() => setIsUpdateModalOpen(false)} />
      )}
    </div>
  );
}

// Sortable Subtask Item Component
interface SortableSubtaskItemProps {
  subtask: Subtask;
  isEditing: boolean;
  editTitle: string;
  onEditTitleChange: (title: string) => void;
  onToggleComplete: (completed: boolean) => void;
  onStartEdit: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onDelete: () => void;
}

function SortableSubtaskItem({
  subtask,
  isEditing,
  editTitle,
  onEditTitleChange,
  onToggleComplete,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onDelete,
}: SortableSubtaskItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: subtask.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center space-x-2 p-2 rounded-md hover:bg-gray-50',
        isDragging && 'bg-blue-50'
      )}
    >
      <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
        <GripVertical className="w-4 h-4 text-gray-400" />
      </div>
      
      <button
        onClick={() => onToggleComplete(!subtask.completed)}
        className="flex-shrink-0"
      >
        {subtask.completed ? (
          <CheckCircle2 className="w-5 h-5 text-green-600" />
        ) : (
          <Circle className="w-5 h-5 text-gray-400" />
        )}
      </button>

      {isEditing ? (
        <div className="flex-1 flex items-center space-x-2">
          <input
            type="text"
            value={editTitle}
            onChange={(e) => onEditTitleChange(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                onSaveEdit();
              } else if (e.key === 'Escape') {
                onCancelEdit();
              }
            }}
            className="flex-1 px-2 py-1 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            autoFocus
          />
          <button
            onClick={onSaveEdit}
            className="px-2 py-1 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700"
          >
            Save
          </button>
          <button
            onClick={onCancelEdit}
            className="px-2 py-1 text-xs font-medium text-gray-700 bg-gray-100 rounded hover:bg-gray-200"
          >
            Cancel
          </button>
        </div>
      ) : (
        <>
          <span
            className={cn(
              'flex-1 text-sm cursor-pointer',
              subtask.completed && 'line-through text-gray-500'
            )}
            onDoubleClick={onStartEdit}
          >
            {subtask.title}
          </span>
          <div className="flex items-center space-x-1">
            <button
              onClick={onStartEdit}
              className="p-1 text-gray-400 hover:text-blue-600"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              onClick={onDelete}
              className="p-1 text-gray-400 hover:text-red-600"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </>
      )}
    </li>
  );
}
