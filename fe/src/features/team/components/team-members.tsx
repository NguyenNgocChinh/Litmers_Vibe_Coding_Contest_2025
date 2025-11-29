"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { teamApi } from "../api/team-api";
import { Trash2, UserPlus } from "lucide-react";
import { useState } from "react";
import InviteMemberModal from "./invite-member-modal";
import { useAuthStore } from "@/store/auth-store";
import LoadingSpinner from "@/components/ui/loading-spinner";

interface TeamMembersProps {
  teamId: string;
}

export default function TeamMembers({ teamId }: TeamMembersProps) {
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const currentUser = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();

  const { data: members, isLoading } = useQuery({
    queryKey: ["team-members", teamId],
    queryFn: () => teamApi.getMembers(teamId),
  });

  const removeMemberMutation = useMutation({
    mutationFn: (memberId: string) => teamApi.removeMember(teamId, memberId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-members", teamId] });
    },
  });

  if (isLoading) return <LoadingSpinner className="min-h-[200px]" size={32} />;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 sm:p-6 border-b border-gray-200">
        <h3 className="text-base sm:text-lg font-medium text-gray-900">
          Members
        </h3>
        <button
          onClick={() => setIsInviteModalOpen(true)}
          className="flex items-center justify-center px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100 w-full sm:w-auto"
        >
          <UserPlus className="w-4 h-4 mr-2" />
          Invite
        </button>
      </div>
      <ul className="divide-y divide-gray-200">
        {members?.map((member) => (
          <li
            key={member.id}
            className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 sm:p-6"
          >
            <div className="flex items-center flex-1 min-w-0">
              {member.users?.avatar_url ? (
                <img
                  src={member.users.avatar_url}
                  alt={member.users.name}
                  className="w-10 h-10 rounded-full shrink-0"
                />
              ) : (
                <div className="flex items-center justify-center w-10 h-10 bg-gray-200 rounded-full text-gray-500 font-medium shrink-0">
                  {member.users?.name?.[0] || "?"}
                </div>
              )}
              <div className="ml-4 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {member.users?.name || "Unknown"}
                </p>
                <p className="text-sm text-gray-500 truncate">
                  {member.users?.email || ""}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between sm:justify-end space-x-3 sm:space-x-4">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                {member.role}
              </span>
              {/* Only show remove button if not self and has permission (simplified check) */}
              {currentUser?.id !== member.user_id && (
                <button
                  onClick={() => {
                    if (
                      confirm("Are you sure you want to remove this member?")
                    ) {
                      removeMemberMutation.mutate(member.id);
                    }
                  }}
                  className="text-gray-400 hover:text-red-500 shrink-0"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>

      {isInviteModalOpen && (
        <InviteMemberModal
          teamId={teamId}
          onClose={() => setIsInviteModalOpen(false)}
        />
      )}
    </div>
  );
}
