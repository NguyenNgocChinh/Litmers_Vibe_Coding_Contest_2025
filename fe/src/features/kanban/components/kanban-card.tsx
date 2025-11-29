'use client';

import { useMemo } from 'react';
import { Issue } from '../api/kanban-api';
import { cn } from '@/lib/utils';
import { ArrowUp, ArrowDown, Minus, Calendar, CheckCircle2 } from 'lucide-react';

interface KanbanCardProps {
  issue: Issue;
}

const priorityConfig = {
  HIGH: { color: 'text-orange-600', bg: 'bg-orange-50', icon: ArrowUp },
  MEDIUM: { color: 'text-yellow-600', bg: 'bg-yellow-50', icon: Minus },
  LOW: { color: 'text-gray-600', bg: 'bg-gray-50', icon: ArrowDown },
};

export default function KanbanCard({ issue }: KanbanCardProps) {
  const priorityStyle = priorityConfig[issue.priority];
  const PriorityIcon = priorityStyle.icon;

  return (
    <div className="p-4 bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer">
      <div className="flex items-start justify-between mb-2">
        <h4 className="text-sm font-medium text-gray-900 line-clamp-2">{issue.title}</h4>
        <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-medium', priorityStyle.bg, priorityStyle.color)}>
          <PriorityIcon className="w-3 h-3 mr-1" />
          {issue.priority}
        </span>
      </div>
      
      {issue.description && (
        <p className="text-xs text-gray-500 line-clamp-2 mb-3">{issue.description}</p>
      )}

      {issue.labels && issue.labels.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {issue.labels.slice(0, 3).map((label) => (
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
          {issue.labels.length > 3 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium text-gray-500">
              +{issue.labels.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Subtask Progress */}
      {issue.subtasks && issue.subtasks.length > 0 && (
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-500">Subtasks</span>
            <span className="text-xs text-gray-500">
              {issue.subtasks.filter(s => s.completed).length}/{issue.subtasks.length}
            </span>
          </div>
          <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 transition-all"
              style={{
                width: `${(issue.subtasks.filter(s => s.completed).length / issue.subtasks.length) * 100}%`,
              }}
            />
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="text-xs text-gray-400">
            #{issue.id.slice(0, 8)}
          </span>
          {issue.due_date && (
            <div className="flex items-center text-xs text-gray-500">
              <Calendar className="w-3 h-3 mr-1" />
              {new Date(issue.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </div>
          )}
        </div>
        {issue.assignee && (
          <div className="flex items-center space-x-2">
            {issue.assignee.avatar_url ? (
              <img
                src={issue.assignee.avatar_url}
                alt={issue.assignee.name}
                className="w-6 h-6 rounded-full"
              />
            ) : (
              <div className="flex items-center justify-center w-6 h-6 bg-gray-200 rounded-full text-gray-500 text-xs font-medium">
                {issue.assignee.name[0]}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
