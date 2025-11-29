"use client";

import { useQuery } from "@tanstack/react-query";
import { teamApi } from "@/features/team/api/team-api";
import ProjectList from "@/features/project/components/project-list";
import { useState } from "react";
import LoadingSpinner from "@/components/ui/loading-spinner";

export default function ProjectsPage() {
  const { data: teams, isLoading } = useQuery({
    queryKey: ["teams"],
    queryFn: teamApi.getAll,
  });

  const [selectedTeamId, setSelectedTeamId] = useState<string>("");

  // Auto-select first team
  if (!selectedTeamId && teams && teams.length > 0) {
    setSelectedTeamId(teams[0].id);
  }

  if (isLoading) return <LoadingSpinner className="min-h-[400px]" size={32} />;

  if (!teams || teams.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-300">
        No teams found. Create a team first to manage projects.
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 sm:mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select Team
        </label>
        <select
          value={selectedTeamId}
          onChange={(e) => setSelectedTeamId(e.target.value)}
          className="w-full sm:w-auto px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {teams.map((team) => (
            <option key={team.id} value={team.id}>
              {team.name}
            </option>
          ))}
        </select>
      </div>

      {selectedTeamId && <ProjectList teamId={selectedTeamId} />}
    </div>
  );
}
