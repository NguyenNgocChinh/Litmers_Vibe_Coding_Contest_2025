"use client";

import { useQuery } from "@tanstack/react-query";
import { projectApi } from "../api/project-api";
import Link from "next/link";
import { Plus, FolderKanban } from "lucide-react";
import { useState } from "react";
import CreateProjectModal from "./create-project-modal";
import LoadingSpinner from "@/components/ui/loading-spinner";

interface ProjectListProps {
  teamId: string;
}

export default function ProjectList({ teamId }: ProjectListProps) {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const {
    data: projects,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["projects", teamId],
    queryFn: () => projectApi.getAll(teamId),
  });

  if (isLoading) return <LoadingSpinner className="min-h-[400px]" size={32} />;
  if (error) return <div>Error loading projects</div>;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
          Projects
        </h2>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="flex items-center justify-center px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 w-full sm:w-auto"
        >
          <Plus className="w-5 h-5 mr-2" />
          Create Project
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {projects?.map((project) => (
          <Link
            key={project.id}
            href={`/projects/${project.id}`}
            className="block p-6 bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center">
                <FolderKanban className="w-8 h-8 text-blue-600 mr-3" />
                <div>
                  <h3 className="text-lg font-medium text-gray-900">
                    {project.name}
                  </h3>
                  {project.description && (
                    <p className="mt-1 text-sm text-gray-500 line-clamp-2">
                      {project.description}
                    </p>
                  )}
                </div>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  project.visibility === "PUBLIC"
                    ? "bg-green-100 text-green-800"
                    : "bg-gray-100 text-gray-800"
                }`}
              >
                {project.visibility}
              </span>
              <span>{new Date(project.created_at).toLocaleDateString()}</span>
            </div>
          </Link>
        ))}
        {projects?.length === 0 && (
          <div className="col-span-full p-8 text-center text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-300">
            No projects found. Create one to get started!
          </div>
        )}
      </div>

      {isCreateModalOpen && (
        <CreateProjectModal
          teamId={teamId}
          onClose={() => setIsCreateModalOpen(false)}
        />
      )}
    </div>
  );
}
