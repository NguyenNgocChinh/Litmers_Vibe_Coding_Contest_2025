'use client';

import { useQuery } from '@tanstack/react-query';
import { teamApi } from '@/features/team/api/team-api';
import { useParams } from 'next/navigation';
import TeamMembers from '@/features/team/components/team-members';
import LoadingSpinner from '@/components/ui/loading-spinner';

export default function TeamDetailPage() {
  const params = useParams();
  const teamId = params.id as string;

  const { data: team, isLoading } = useQuery({
    queryKey: ['team', teamId],
    queryFn: () => teamApi.getOne(teamId),
  });

  if (isLoading) return <LoadingSpinner className="min-h-[400px]" size={32} />;
  if (!team) return <div>Team not found</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{team.name}</h1>
        {/* Add Edit/Delete buttons here if needed */}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <TeamMembers teamId={teamId} />
        
        {/* Placeholder for Projects list */}
        <div className="p-6 bg-white rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Projects</h3>
            <p className="text-gray-500">Projects will be listed here.</p>
        </div>
      </div>
    </div>
  );
}
