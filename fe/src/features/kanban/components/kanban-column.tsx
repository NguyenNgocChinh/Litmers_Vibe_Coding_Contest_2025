'use client';

import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Issue } from '../api/kanban-api';
import KanbanCard from './kanban-card';
import { cn } from '@/lib/utils';

interface KanbanColumnProps {
  id: string;
  title: string;
  issues: Issue[];
  color: string;
  wipLimit?: number;
}

interface SortableIssueCardProps {
  issue: Issue;
}

function SortableIssueCard({ issue }: SortableIssueCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: issue.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <div {...attributes} {...listeners}>
        <KanbanCard issue={issue} />
      </div>
    </div>
  );
}

export default function KanbanColumn({ id, title, issues, color, wipLimit }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id,
  });

  const isOverLimit = wipLimit !== undefined && issues.length > wipLimit;

  return (
    <div className="flex flex-col h-full min-w-[300px] bg-gray-50 rounded-lg">
      <div className={cn('px-4 py-3 border-b-4 rounded-t-lg', color)}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
          <div className="flex items-center space-x-2">
            {wipLimit !== undefined && (
              <span className={cn(
                'text-xs font-medium',
                isOverLimit ? 'text-red-600' : 'text-gray-600'
              )}>
                {issues.length}/{wipLimit}
              </span>
            )}
            <span className="inline-flex items-center justify-center w-6 h-6 text-xs font-medium text-gray-600 bg-white rounded-full">
              {issues.length}
            </span>
          </div>
        </div>
        {isOverLimit && (
          <div className="mt-2 text-xs text-red-600 font-medium">
            WIP Limit Exceeded!
          </div>
        )}
      </div>
      
      <div
        ref={setNodeRef}
        className={cn(
          'flex-1 p-4 space-y-3 overflow-y-auto',
          isOver && 'bg-blue-50',
          isOverLimit && 'bg-red-50'
        )}
      >
        <SortableContext items={issues.map(i => i.id)} strategy={verticalListSortingStrategy}>
          {issues.map((issue) => (
            <SortableIssueCard key={issue.id} issue={issue} />
          ))}
        </SortableContext>
        
        {issues.length === 0 && (
          <div className="flex items-center justify-center h-32 text-sm text-gray-400 border-2 border-dashed border-gray-300 rounded-lg">
            Drop issues here
          </div>
        )}
      </div>
    </div>
  );
}
