'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import KanbanBoard from '@/features/kanban/components/kanban-board';
import CreateIssueModal from '@/features/issue/components/create-issue-modal';
import Link from 'next/link';
import { ArrowLeft, Plus } from 'lucide-react';

export default function KanbanPage() {
  const params = useParams();
  const projectId = params.id as string;
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link href={`/projects/${projectId}`} className="text-gray-400 hover:text-gray-600">
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Kanban Board</h1>
        </div>
        <button 
          onClick={() => setIsCreateModalOpen(true)}
          className="flex items-center px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700"
        >
          <Plus className="w-5 h-5 mr-2" />
          New Issue
        </button>
      </div>

      <KanbanBoard projectId={projectId} />

      {isCreateModalOpen && (
        <CreateIssueModal
          projectId={projectId}
          onClose={() => setIsCreateModalOpen(false)}
        />
      )}
    </div>
  );
}
