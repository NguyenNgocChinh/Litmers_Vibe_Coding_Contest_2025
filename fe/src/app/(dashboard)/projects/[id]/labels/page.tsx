'use client';

import { useParams } from 'next/navigation';
import LabelsManagement from '@/features/label/components/labels-management';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function LabelsPage() {
  const params = useParams();
  const projectId = params.id as string;

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4">
        <Link href={`/projects/${projectId}`} className="text-gray-400 hover:text-gray-600">
          <ArrowLeft className="w-6 h-6" />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Labels Management</h1>
      </div>

      <LabelsManagement projectId={projectId} />
    </div>
  );
}

