'use client';

import { useQuery } from '@tanstack/react-query';
import { issueApi, type FilterIssuesParams } from '../api/issue-api';
import { projectApi } from '@/features/project/api/project-api';
import { teamApi } from '@/features/team/api/team-api';
import { labelApi } from '@/features/label/api/label-api';
import Link from 'next/link';
import { Plus, ArrowUp, ArrowDown, Minus, Search, Filter, X, Calendar } from 'lucide-react';
import { useState, useMemo } from 'react';
import CreateIssueModal from './create-issue-modal';
import { cn } from '@/lib/utils';
import LoadingSpinner from '@/components/ui/loading-spinner';

interface IssueListProps {
  projectId: string;
}

const priorityConfig = {
  HIGH: { color: 'text-orange-600', bg: 'bg-orange-50', icon: ArrowUp },
  MEDIUM: { color: 'text-yellow-600', bg: 'bg-yellow-50', icon: Minus },
  LOW: { color: 'text-gray-600', bg: 'bg-gray-50', icon: ArrowDown },
};

const statusOptions = ['Backlog', 'In Progress', 'Done'];
const priorityOptions = ['LOW', 'MEDIUM', 'HIGH'];
const sortOptions = [
  { value: 'created_at', label: 'Created Date' },
  { value: 'due_date', label: 'Due Date' },
  { value: 'priority', label: 'Priority' },
  { value: 'updated_at', label: 'Last Updated' },
];

export default function IssueList({ projectId }: IssueListProps) {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedPriorities, setSelectedPriorities] = useState<string[]>([]);
  const [selectedAssignee, setSelectedAssignee] = useState<string>('');
  const [selectedLabel, setSelectedLabel] = useState<string>('');
  const [hasDueDate, setHasDueDate] = useState<boolean | undefined>(undefined);
  const [dueDateFrom, setDueDateFrom] = useState('');
  const [dueDateTo, setDueDateTo] = useState('');
  const [sortBy, setSortBy] = useState<'created_at' | 'due_date' | 'priority' | 'updated_at'>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showFilters, setShowFilters] = useState(false);

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

  // Build filters
  const filters: Omit<FilterIssuesParams, 'project_id'> = useMemo(() => {
    const f: Omit<FilterIssuesParams, 'project_id'> = {};
    if (search) f.search = search;
    if (selectedStatuses.length > 0) f.status = selectedStatuses;
    if (selectedPriorities.length > 0) f.priority = selectedPriorities;
    if (selectedAssignee) f.assignee_id = selectedAssignee;
    if (selectedLabel) f.label_id = selectedLabel;
    if (hasDueDate !== undefined) f.has_due_date = hasDueDate;
    if (dueDateFrom) f.due_date_from = dueDateFrom;
    if (dueDateTo) f.due_date_to = dueDateTo;
    f.sort_by = sortBy;
    f.sort_order = sortOrder;
    return f;
  }, [search, selectedStatuses, selectedPriorities, selectedAssignee, selectedLabel, hasDueDate, dueDateFrom, dueDateTo, sortBy, sortOrder]);

  const { data: issues, isLoading, error } = useQuery({
    queryKey: ['issues', projectId, filters],
    queryFn: () => issueApi.getAll(projectId, filters),
  });

  const toggleStatus = (status: string) => {
    setSelectedStatuses(prev =>
      prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]
    );
  };

  const togglePriority = (priority: string) => {
    setSelectedPriorities(prev =>
      prev.includes(priority) ? prev.filter(p => p !== priority) : [...prev, priority]
    );
  };

  const clearFilters = () => {
    setSearch('');
    setSelectedStatuses([]);
    setSelectedPriorities([]);
    setSelectedAssignee('');
    setSelectedLabel('');
    setHasDueDate(undefined);
    setDueDateFrom('');
    setDueDateTo('');
    setSortBy('created_at');
    setSortOrder('desc');
  };

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (search) count++;
    if (selectedStatuses.length > 0) count++;
    if (selectedPriorities.length > 0) count++;
    if (selectedAssignee) count++;
    if (selectedLabel) count++;
    if (hasDueDate !== undefined) count++;
    if (dueDateFrom || dueDateTo) count++;
    return count;
  }, [search, selectedStatuses, selectedPriorities, selectedAssignee, selectedLabel, hasDueDate, dueDateFrom, dueDateTo]);

  if (isLoading) return <LoadingSpinner className="min-h-[400px]" size={32} />;
  if (error) return <div>Error loading issues</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Issues</h2>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="flex items-center px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700"
        >
          <Plus className="w-5 h-5 mr-2" />
          New Issue
        </button>
      </div>

      {/* Search and Filters */}
      <div className="mb-6 space-y-4">
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search issues by title..."
            className="w-full pl-10 pr-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Filter Toggle and Sort */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            <Filter className="w-4 h-4 mr-2" />
            Filters
            {activeFiltersCount > 0 && (
              <span className="ml-2 px-2 py-0.5 text-xs font-medium text-white bg-blue-600 rounded-full">
                {activeFiltersCount}
              </span>
            )}
          </button>

          <div className="flex items-center space-x-3">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {sortOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="p-2 border rounded-md hover:bg-gray-50"
              title={`Sort ${sortOrder === 'asc' ? 'Descending' : 'Ascending'}`}
            >
              {sortOrder === 'asc' ? (
                <ArrowUp className="w-4 h-4" />
              ) : (
                <ArrowDown className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-900">Filter Issues</h3>
              {activeFiltersCount > 0 && (
                <button
                  onClick={clearFilters}
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  Clear all
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Status Filter */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">Status</label>
                <div className="flex flex-wrap gap-2">
                  {statusOptions.map(status => (
                    <button
                      key={status}
                      onClick={() => toggleStatus(status)}
                      className={cn(
                        'px-3 py-1 text-xs font-medium rounded-full border transition-colors',
                        selectedStatuses.includes(status)
                          ? 'bg-blue-100 text-blue-800 border-blue-300'
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      )}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>

              {/* Priority Filter */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">Priority</label>
                <div className="flex flex-wrap gap-2">
                  {priorityOptions.map(priority => (
                    <button
                      key={priority}
                      onClick={() => togglePriority(priority)}
                      className={cn(
                        'px-3 py-1 text-xs font-medium rounded-full border transition-colors',
                        selectedPriorities.includes(priority)
                          ? 'bg-blue-100 text-blue-800 border-blue-300'
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      )}
                    >
                      {priority}
                    </button>
                  ))}
                </div>
              </div>

              {/* Assignee Filter */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">Assignee</label>
                <select
                  value={selectedAssignee}
                  onChange={(e) => setSelectedAssignee(e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Assignees</option>
                  {teamMembers?.map(member => (
                    <option key={member.user.id} value={member.user.id}>
                      {member.user.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Label Filter */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">Label</label>
                <select
                  value={selectedLabel}
                  onChange={(e) => setSelectedLabel(e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Labels</option>
                  {labels?.map(label => (
                    <option key={label.id} value={label.id}>
                      {label.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Due Date Filter */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">Has Due Date</label>
                <select
                  value={hasDueDate === undefined ? '' : String(hasDueDate)}
                  onChange={(e) => setHasDueDate(e.target.value === '' ? undefined : e.target.value === 'true')}
                  className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All</option>
                  <option value="true">Has Due Date</option>
                  <option value="false">No Due Date</option>
                </select>
              </div>

              {/* Due Date Range */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">Due Date From</label>
                <input
                  type="date"
                  value={dueDateFrom}
                  onChange={(e) => setDueDateFrom(e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">Due Date To</label>
                <input
                  type="date"
                  value={dueDateTo}
                  onChange={(e) => setDueDateTo(e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Issues Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Issue
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Priority
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Assignee
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Due Date
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {issues?.map((issue) => {
              const priorityStyle = priorityConfig[issue.priority];
              const PriorityIcon = priorityStyle.icon;
              const statusStyle = statusOptions.includes(issue.status)
                ? (issue.status === 'Backlog' ? 'bg-gray-100 text-gray-800' :
                   issue.status === 'In Progress' ? 'bg-blue-100 text-blue-800' :
                   'bg-green-100 text-green-800')
                : 'bg-gray-100 text-gray-800';

              return (
                <tr key={issue.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <Link href={`/issues/${issue.id}`} className="text-blue-600 hover:underline">
                      <div className="text-sm font-medium text-gray-900">{issue.title}</div>
                      {issue.description && (
                        <div className="text-sm text-gray-500 line-clamp-1">{issue.description}</div>
                      )}
                    </Link>
                    {issue.labels && issue.labels.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {issue.labels.map((label) => (
                          <span
                            key={label.id}
                            className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border"
                            style={{
                              backgroundColor: `${label.color}33`,
                              borderColor: label.color,
                              color: label.color,
                            }}
                          >
                            {label.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium', statusStyle)}>
                      {issue.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium', priorityStyle.bg, priorityStyle.color)}>
                      <PriorityIcon className="w-3 h-3 mr-1" />
                      {issue.priority}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
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
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {issue.due_date ? (
                      <div className="flex items-center text-sm text-gray-900">
                        <Calendar className="w-4 h-4 mr-1 text-gray-400" />
                        {new Date(issue.due_date).toLocaleDateString()}
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        
        {issues?.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            {activeFiltersCount > 0
              ? 'No issues match your filters. Try adjusting your search criteria.'
              : 'No issues found. Create one to get started!'}
          </div>
        )}
      </div>

      {isCreateModalOpen && (
        <CreateIssueModal projectId={projectId} onClose={() => setIsCreateModalOpen(false)} />
      )}
    </div>
  );
}
