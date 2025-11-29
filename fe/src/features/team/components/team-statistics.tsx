'use client';

import { useQuery } from '@tanstack/react-query';
import { teamApi } from '../api/team-api';
import LoadingSpinner from '@/components/ui/loading-spinner';
import { useState } from 'react';

interface TeamStatisticsProps {
  teamId: string;
}

export default function TeamStatistics({ teamId }: TeamStatisticsProps) {
  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('30d');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['team-statistics', teamId, period],
    queryFn: () => teamApi.getStatistics(teamId, period),
  });

  if (isLoading) return <LoadingSpinner className="min-h-[400px]" size={32} />;
  if (isError) return <div className="text-red-500">Failed to load statistics</div>;
  if (!data) return null;

  // Convert trends to arrays for display
  const creationTrendData = Object.entries(data.creationTrend)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const completionTrendData = Object.entries(data.completionTrend)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const maxTrendValue = Math.max(
    ...creationTrendData.map(d => d.count),
    ...completionTrendData.map(d => d.count),
    1
  );

  const maxMemberAssigned = Math.max(...data.memberStats.map(m => m.assigned), 1);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">Team Statistics</h3>
        <div className="flex space-x-2">
          {(['7d', '30d', '90d'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1 text-sm font-medium rounded-md ${
                period === p
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {p === '7d' ? '7 Days' : p === '30d' ? '30 Days' : '90 Days'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Issue Creation Trend */}
        <div className="p-6 bg-white rounded-lg shadow-sm border border-gray-200">
          <h4 className="text-md font-medium text-gray-900 mb-4">Issue Creation Trend</h4>
          {creationTrendData.length === 0 ? (
            <p className="text-gray-500 text-sm">No data for this period</p>
          ) : (
            <div className="space-y-2">
              {creationTrendData.map((item) => (
                <div key={item.date} className="flex items-center space-x-3">
                  <span className="text-xs text-gray-500 w-20">
                    {new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                  <div className="flex-1 bg-gray-100 rounded-full h-6 relative overflow-hidden">
                    <div
                      className="bg-blue-500 h-full rounded-full flex items-center justify-end pr-2"
                      style={{ width: `${(item.count / maxTrendValue) * 100}%` }}
                    >
                      {item.count > 0 && (
                        <span className="text-xs font-medium text-white">{item.count}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Issue Completion Trend */}
        <div className="p-6 bg-white rounded-lg shadow-sm border border-gray-200">
          <h4 className="text-md font-medium text-gray-900 mb-4">Issue Completion Trend</h4>
          {completionTrendData.length === 0 ? (
            <p className="text-gray-500 text-sm">No data for this period</p>
          ) : (
            <div className="space-y-2">
              {completionTrendData.map((item) => (
                <div key={item.date} className="flex items-center space-x-3">
                  <span className="text-xs text-gray-500 w-20">
                    {new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                  <div className="flex-1 bg-gray-100 rounded-full h-6 relative overflow-hidden">
                    <div
                      className="bg-green-500 h-full rounded-full flex items-center justify-end pr-2"
                      style={{ width: `${(item.count / maxTrendValue) * 100}%` }}
                    >
                      {item.count > 0 && (
                        <span className="text-xs font-medium text-white">{item.count}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Member Statistics */}
      <div className="p-6 bg-white rounded-lg shadow-sm border border-gray-200">
        <h4 className="text-md font-medium text-gray-900 mb-4">Assigned Issues per Member</h4>
        {data.memberStats.length === 0 ? (
          <p className="text-gray-500 text-sm">No member statistics available</p>
        ) : (
          <div className="space-y-4">
            {data.memberStats.map((stat) => (
              <div key={stat.member.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-900">{stat.member.name}</span>
                  <span className="text-sm text-gray-500">
                    {stat.completed} / {stat.assigned} completed
                  </span>
                </div>
                <div className="flex space-x-2">
                  <div className="flex-1 bg-gray-100 rounded-full h-4 relative overflow-hidden">
                    <div
                      className="bg-blue-500 h-full rounded-full"
                      style={{ width: `${(stat.assigned / maxMemberAssigned) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-500 w-12 text-right">{stat.assigned}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Issue Status per Project */}
      <div className="p-6 bg-white rounded-lg shadow-sm border border-gray-200">
        <h4 className="text-md font-medium text-gray-900 mb-4">Issue Status per Project</h4>
        {data.statusPerProject.length === 0 ? (
          <p className="text-gray-500 text-sm">No project statistics available</p>
        ) : (
          <div className="space-y-4">
            {data.statusPerProject.map((project, index) => {
              const total = project.Backlog + project['In Progress'] + project.Done;
              return (
                <div key={index} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-900">{project.name}</span>
                    <span className="text-sm text-gray-500">{total} issues</span>
                  </div>
                  <div className="flex space-x-1 h-6 rounded overflow-hidden">
                    {project.Backlog > 0 && (
                      <div
                        className="bg-gray-400 flex items-center justify-center text-xs text-white"
                        style={{ width: `${(project.Backlog / total) * 100}%` }}
                        title={`Backlog: ${project.Backlog}`}
                      >
                        {project.Backlog}
                      </div>
                    )}
                    {project['In Progress'] > 0 && (
                      <div
                        className="bg-blue-500 flex items-center justify-center text-xs text-white"
                        style={{ width: `${(project['In Progress'] / total) * 100}%` }}
                        title={`In Progress: ${project['In Progress']}`}
                      >
                        {project['In Progress']}
                      </div>
                    )}
                    {project.Done > 0 && (
                      <div
                        className="bg-green-500 flex items-center justify-center text-xs text-white"
                        style={{ width: `${(project.Done / total) * 100}%` }}
                        title={`Done: ${project.Done}`}
                      >
                        {project.Done}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

