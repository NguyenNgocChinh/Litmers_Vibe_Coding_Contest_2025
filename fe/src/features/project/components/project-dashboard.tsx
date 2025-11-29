'use client';

import { useQuery } from '@tanstack/react-query';
import { projectApi } from '../api/project-api';
import LoadingSpinner from '@/components/ui/loading-spinner';
import Link from 'next/link';

interface ProjectDashboardProps {
  projectId: string;
}

export default function ProjectDashboard({ projectId }: ProjectDashboardProps) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['project-dashboard', projectId],
    queryFn: () => projectApi.getDashboard(projectId),
  });

  if (isLoading) return <LoadingSpinner className="min-h-[400px]" size={32} />;
  if (isError) return <div className="text-red-500">Failed to load dashboard</div>;
  if (!data) return null;

  const statusColors: Record<string, string> = {
    Backlog: 'bg-gray-400',
    'In Progress': 'bg-blue-500',
    Done: 'bg-green-500',
  };

  const priorityColors: Record<string, string> = {
    HIGH: 'bg-red-500',
    MEDIUM: 'bg-yellow-500',
    LOW: 'bg-green-500',
  };

  const statusTotal = Object.values(data.countByStatus).reduce((sum, count) => sum + count, 0);
  const priorityTotal = Object.values(data.countByPriority).reduce((sum, count) => sum + count, 0);

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-medium text-gray-900">Project Dashboard</h3>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Issue Count by Status - Pie Chart */}
        <div className="p-6 bg-white rounded-lg shadow-sm border border-gray-200">
          <h4 className="text-md font-medium text-gray-900 mb-4">Issues by Status</h4>
          {statusTotal === 0 ? (
            <p className="text-gray-500 text-sm">No issues yet</p>
          ) : (
            <div className="space-y-4">
              {/* Visual representation */}
              <div className="flex items-center justify-center h-48">
                <div className="relative w-48 h-48">
                  {Object.entries(data.countByStatus).map(([status, count], index, array) => {
                    const percentage = (count / statusTotal) * 100;
                    const startAngle = array.slice(0, index).reduce((sum, [, c]) => sum + (c / statusTotal) * 360, 0);
                    const angle = (count / statusTotal) * 360;
                    
                    if (percentage === 0) return null;

                    return (
                      <div
                        key={status}
                        className="absolute inset-0"
                        style={{
                          clipPath: `polygon(50% 50%, ${50 + 50 * Math.cos((startAngle - 90) * Math.PI / 180)}% ${50 + 50 * Math.sin((startAngle - 90) * Math.PI / 180)}%, ${50 + 50 * Math.cos((startAngle + angle - 90) * Math.PI / 180)}% ${50 + 50 * Math.sin((startAngle + angle - 90) * Math.PI / 180)}%)`,
                        }}
                      >
                        <div className={`w-full h-full ${statusColors[status] || 'bg-gray-300'} opacity-80`} />
                      </div>
                    );
                  })}
                </div>
              </div>
              
              {/* Legend */}
              <div className="space-y-2">
                {Object.entries(data.countByStatus).map(([status, count]) => {
                  const percentage = (count / statusTotal) * 100;
                  return (
                    <div key={status} className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <div className={`w-4 h-4 rounded ${statusColors[status] || 'bg-gray-300'}`} />
                        <span className="text-sm text-gray-700">{status}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium text-gray-900">{count}</span>
                        <span className="text-xs text-gray-500">({percentage.toFixed(1)}%)</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Issue Count by Priority - Bar Chart */}
        <div className="p-6 bg-white rounded-lg shadow-sm border border-gray-200">
          <h4 className="text-md font-medium text-gray-900 mb-4">Issues by Priority</h4>
          {priorityTotal === 0 ? (
            <p className="text-gray-500 text-sm">No issues yet</p>
          ) : (
            <div className="space-y-3">
              {Object.entries(data.countByPriority).map(([priority, count]) => {
                const percentage = (count / priorityTotal) * 100;
                const maxCount = Math.max(...Object.values(data.countByPriority));
                return (
                  <div key={priority} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">{priority}</span>
                      <span className="text-sm text-gray-900">{count}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-6 relative overflow-hidden">
                      <div
                        className={`h-full rounded-full flex items-center justify-end pr-2 ${priorityColors[priority] || 'bg-gray-400'}`}
                        style={{ width: `${(count / maxCount) * 100}%` }}
                      >
                        {count > 0 && (
                          <span className="text-xs font-medium text-white">{count}</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Completion Rate */}
      <div className="p-6 bg-white rounded-lg shadow-sm border border-gray-200">
        <h4 className="text-md font-medium text-gray-900 mb-4">Completion Rate</h4>
        <div className="flex items-center space-x-4">
          <div className="flex-1">
            <div className="w-full bg-gray-100 rounded-full h-8 relative overflow-hidden">
              <div
                className="bg-green-500 h-full rounded-full flex items-center justify-center"
                style={{ width: `${data.completionRate}%` }}
              >
                <span className="text-sm font-medium text-white">
                  {data.completionRate.toFixed(1)}%
                </span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-gray-900">{data.doneCount}</div>
            <div className="text-sm text-gray-500">of {data.total} completed</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recently Created Issues */}
        <div className="p-6 bg-white rounded-lg shadow-sm border border-gray-200">
          <h4 className="text-md font-medium text-gray-900 mb-4">Recently Created Issues</h4>
          {data.recentlyCreated.length === 0 ? (
            <p className="text-gray-500 text-sm">No recent issues</p>
          ) : (
            <div className="space-y-3">
              {data.recentlyCreated.map((issue) => (
                <Link
                  key={issue.id}
                  href={`/issues/${issue.id}`}
                  className="block p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{issue.title}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(issue.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <span className={`ml-2 px-2 py-1 text-xs font-medium rounded ${priorityColors[issue.priority] || 'bg-gray-300'} text-white`}>
                      {issue.priority}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Issues Due Soon */}
        <div className="p-6 bg-white rounded-lg shadow-sm border border-gray-200">
          <h4 className="text-md font-medium text-gray-900 mb-4">Issues Due Soon</h4>
          {data.dueSoon.length === 0 ? (
            <p className="text-gray-500 text-sm">No issues due soon</p>
          ) : (
            <div className="space-y-3">
              {data.dueSoon.map((issue) => (
                <Link
                  key={issue.id}
                  href={`/issues/${issue.id}`}
                  className="block p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{issue.title}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        Due: {issue.due_date ? new Date(issue.due_date).toLocaleDateString() : 'No due date'}
                      </p>
                    </div>
                    <span className={`ml-2 px-2 py-1 text-xs font-medium rounded ${priorityColors[issue.priority] || 'bg-gray-300'} text-white`}>
                      {issue.priority}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

