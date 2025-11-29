'use client';

import { useParams } from 'next/navigation';
import IssueList from '@/features/issue/components/issue-list';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function ProjectIssuesPage() {
  const params = useParams();
  const projectId = params.id as string;

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4">
        <Link href={`/projects/${projectId}`} className="text-gray-400 hover:text-gray-600">
          <ArrowLeft className="w-6 h-6" />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Project Issues</h1>
      </div>

      <IssueList projectId={projectId} />
    </div>
  );
}
