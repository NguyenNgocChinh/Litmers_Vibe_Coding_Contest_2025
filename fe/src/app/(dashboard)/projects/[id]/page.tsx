'use client';

import { useQuery } from '@tanstack/react-query';
import { projectApi } from '@/features/project/api/project-api';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import LoadingSpinner from '@/components/ui/loading-spinner';

export default function ProjectDetailPage() {
  const params = useParams();
  const projectId = params.id as string;

  const { data: project, isLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectApi.getOne(projectId),
  });

  if (isLoading) return <LoadingSpinner className="min-h-[400px]" size={32} />;
  if (!project) return <div>Project not found</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4">
        <Link href="/projects" className="text-gray-400 hover:text-gray-600">
          <ArrowLeft className="w-6 h-6" />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
          project.visibility === 'PUBLIC' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
        }`}>
          {project.visibility}
        </span>
      </div>

      {project.description && (
        <div className="p-4 bg-gray-50 rounded-lg">
          <p className="text-gray-700">{project.description}</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Kanban Board Preview */}
        <div className="p-6 bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">Kanban Board</h3>
            <Link
              href={`/projects/${projectId}/kanban`}
              className="text-sm text-blue-600 hover:underline"
            >
              View Board →
            </Link>
          </div>
          <p className="text-gray-500">Manage issues on the Kanban board.</p>
        </div>

        {/* Issues List Preview */}
        <div className="p-6 bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">Issues</h3>
            <Link
              href={`/projects/${projectId}/issues`}
              className="text-sm text-blue-600 hover:underline"
            >
              View All →
            </Link>
          </div>
          <p className="text-gray-500">Track and manage project issues.</p>
        </div>

        {/* Labels Management Preview */}
        <div className="p-6 bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">Labels</h3>
            <Link
              href={`/projects/${projectId}/labels`}
              className="text-sm text-blue-600 hover:underline"
            >
              Manage →
            </Link>
          </div>
          <p className="text-gray-500">Create and manage labels for organizing issues.</p>
        </div>
      </div>
    </div>
  );
}
