'use client';

import { useParams } from 'next/navigation';
import KanbanBoard from '@/features/kanban/components/kanban-board';
import Link from 'next/link';
import { ArrowLeft, Plus } from 'lucide-react';

export default function KanbanPage() {
  const params = useParams();
  const projectId = params.id as string;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link href={`/projects/${projectId}`} className="text-gray-400 hover:text-gray-600">
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Kanban Board</h1>
        </div>
        <button className="flex items-center px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700">
          <Plus className="w-5 h-5 mr-2" />
          New Issue
        </button>
      </div>

      <KanbanBoard projectId={projectId} />
    </div>
  );
}
