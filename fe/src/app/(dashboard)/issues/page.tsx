'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { issueApi } from '@/features/issue/api/issue-api';
import { projectApi } from '@/features/project/api/project-api';
import { teamApi } from '@/features/team/api/team-api';
import Link from 'next/link';
import { Filter, Search } from 'lucide-react';
import LoadingSpinner from '@/components/ui/loading-spinner';
import type { Issue } from '@/features/kanban/api/kanban-api';

export default function IssuesPage() {
  const [search, setSearch] = useState('');
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [selectedTeam, setSelectedTeam] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [selectedPriority, setSelectedPriority] = useState<string>('');
  const [sortField, setSortField] = useState<'created_at' | 'due_date' | 'priority' | 'updated_at'>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Fetch teams and projects for filters
  const { data: teams } = useQuery({
    queryKey: ['teams'],
    queryFn: () => teamApi.getAll(),
  });

  const { data: projects } = useQuery({
    queryKey: ['projects', selectedTeam],
    queryFn: async () => {
      if (selectedTeam) {
        return projectApi.getAll(selectedTeam);
      }
      // If no team selected, get all projects from all teams
      if (teams && teams.length > 0) {
        const allProjects = await Promise.all(
          teams.map(team => projectApi.getAll(team.id))
        );
        return allProjects.flat();
      }
      return [];
    },
    enabled: !!teams,
  });

  // Fetch issues from all projects or selected project
  const projectIds = useMemo(() => {
    if (selectedProject) return [selectedProject];
    if (selectedTeam && projects) {
      return projects.filter(p => p.team_id === selectedTeam).map(p => p.id);
    }
    return projects?.map(p => p.id) || [];
  }, [selectedProject, selectedTeam, projects]);

  const { data: allIssues, isLoading } = useQuery({
    queryKey: ['all-issues', projectIds, search, selectedStatus, selectedPriority, sortField, sortOrder],
    queryFn: async () => {
      if (projectIds.length === 0) return [];
      
      const issuesPromises = projectIds.map(projectId => 
        issueApi.getAll(projectId, {
          search: search || undefined,
          status: selectedStatus || undefined,
          priority: selectedPriority || undefined,
          sort_by: sortField,
          sort_order: sortOrder,
        })
      );
      
      const issuesArrays = await Promise.all(issuesPromises);
      return issuesArrays.flat();
    },
    enabled: projectIds.length > 0,
  });

  // Filter and sort issues client-side
  const issues = useMemo(() => {
    if (!allIssues) return [];
    
    let filtered = [...allIssues];
    
    // Apply search filter
    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(issue => 
        issue.title.toLowerCase().includes(searchLower) ||
        issue.description?.toLowerCase().includes(searchLower)
      );
    }
    
    // Apply status filter
    if (selectedStatus) {
      filtered = filtered.filter(issue => issue.status === selectedStatus);
    }
    
    // Apply priority filter
    if (selectedPriority) {
      filtered = filtered.filter(issue => issue.priority === selectedPriority);
    }
    
    // Sort
    filtered.sort((a, b) => {
      let aVal: any = a[sortField];
      let bVal: any = b[sortField];
      
      if (sortField === 'priority') {
        const priorityOrder = { HIGH: 3, MEDIUM: 2, LOW: 1 };
        aVal = priorityOrder[a.priority as keyof typeof priorityOrder] || 0;
        bVal = priorityOrder[b.priority as keyof typeof priorityOrder] || 0;
      }
      
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;
      
      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
    
    return filtered;
  }, [allIssues, search, selectedStatus, selectedPriority, sortField, sortOrder]);

  const priorityColors: Record<string, string> = {
    HIGH: 'bg-red-100 text-red-800',
    MEDIUM: 'bg-yellow-100 text-yellow-800',
    LOW: 'bg-green-100 text-green-800',
  };

  const statusColors: Record<string, string> = {
    Backlog: 'bg-gray-100 text-gray-800',
    'In Progress': 'bg-blue-100 text-blue-800',
    Done: 'bg-green-100 text-green-800',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">All Issues</h1>
      </div>

      {/* Filters */}
      <div className="p-4 bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center space-x-2 mb-4">
          <Filter className="w-5 h-5 text-gray-500" />
          <h3 className="text-sm font-medium text-gray-900">Filters</h3>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search issues..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Team Filter */}
          <select
            value={selectedTeam}
            onChange={(e) => handleTeamChange(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Teams</option>
            {teams?.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>

          {/* Project Filter */}
          <select
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
            disabled={!selectedTeam && projects && projects.length > 0}
            className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
          >
            <option value="">All Projects</option>
            {projects?.filter(p => !selectedTeam || p.team_id === selectedTeam).map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Statuses</option>
            <option value="Backlog">Backlog</option>
            <option value="In Progress">In Progress</option>
            <option value="Done">Done</option>
          </select>

          {/* Priority Filter */}
          <select
            value={selectedPriority}
            onChange={(e) => setSelectedPriority(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Priorities</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>

          {/* Sort Field */}
          <select
            value={sortField}
            onChange={(e) => setSortField(e.target.value as any)}
            className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="created_at">Created Date</option>
            <option value="due_date">Due Date</option>
            <option value="priority">Priority</option>
            <option value="updated_at">Last Modified</option>
          </select>

          {/* Sort Order */}
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
            className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="desc">Descending</option>
            <option value="asc">Ascending</option>
          </select>
        </div>

        {/* Clear Filters */}
        <button
          onClick={() => {
            setSearch('');
            setSelectedStatus('');
            setSelectedPriority('');
            setSelectedProject('');
            setSelectedTeam('');
            setSortField('created_at');
            setSortOrder('desc');
          }}
          className="mt-4 text-sm text-blue-600 hover:underline"
        >
          Clear all filters
        </button>
      </div>

      {/* Issues List */}
      {isLoading ? (
        <LoadingSpinner className="min-h-[400px]" size={32} />
      ) : (
        <div className="space-y-4">
          {issues && issues.length > 0 ? (
            issues.map((issue) => (
              <Link
                key={issue.id}
                href={`/issues/${issue.id}`}
                className="block p-4 bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="text-lg font-medium text-gray-900 truncate">
                        {issue.title}
                      </h3>
                      <span className={`px-2 py-1 text-xs font-medium rounded ${statusColors[issue.status] || 'bg-gray-100 text-gray-800'}`}>
                        {issue.status}
                      </span>
                      <span className={`px-2 py-1 text-xs font-medium rounded ${priorityColors[issue.priority] || 'bg-gray-100 text-gray-800'}`}>
                        {issue.priority}
                      </span>
                    </div>
                    {issue.description && (
                      <p className="text-sm text-gray-600 line-clamp-2 mb-2">
                        {issue.description}
                      </p>
                    )}
                    <div className="flex items-center space-x-4 text-xs text-gray-500">
                      {issue.assignee && (
                        <span>Assigned to: {issue.assignee.name}</span>
                      )}
                      {issue.due_date && (
                        <span>
                          Due: {new Date(issue.due_date).toLocaleDateString()}
                        </span>
                      )}
                      <span>
                        Created: {new Date(issue.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    {issue.labels && issue.labels.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {issue.labels.map((label) => (
                          <span
                            key={label.id}
                            className="px-2 py-1 text-xs font-medium rounded"
                            style={{
                              backgroundColor: `${label.color}20`,
                              color: label.color,
                            }}
                          >
                            {label.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            ))
          ) : (
            <div className="p-8 text-center bg-white rounded-lg border border-gray-200">
              <p className="text-gray-500">No issues found</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

