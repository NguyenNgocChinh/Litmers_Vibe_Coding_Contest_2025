"use client";

import { useQuery } from "@tanstack/react-query";
import { teamApi } from "../api/team-api";
import Link from "next/link";
import { Plus } from "lucide-react";
import { useState } from "react";
import CreateTeamModal from "./create-team-modal";
import LoadingSpinner from "@/components/ui/loading-spinner";

export default function TeamList() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const {
    data: teams,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["teams"],
    queryFn: teamApi.getAll,
  });

  if (isLoading) return <LoadingSpinner className="min-h-[400px]" size={32} />;
  if (error) return <div>Error loading teams</div>;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Teams</h2>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="flex items-center justify-center px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 w-full sm:w-auto"
        >
          <Plus className="w-5 h-5 mr-2" />
          Create Team
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {teams?.map((team) => (
          <Link
            key={team.id}
            href={`/teams/${team.id}`}
            className="block p-6 bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow"
          >
            <h3 className="text-lg font-medium text-gray-900">{team.name}</h3>
            <p className="mt-2 text-sm text-gray-500">
              Created: {new Date(team.created_at).toLocaleDateString()}
            </p>
          </Link>
        ))}
        {teams?.length === 0 && (
          <div className="col-span-full p-8 text-center text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-300">
            No teams found. Create one to get started!
          </div>
        )}
      </div>

      {isCreateModalOpen && (
        <CreateTeamModal onClose={() => setIsCreateModalOpen(false)} />
      )}
    </div>
  );
}
