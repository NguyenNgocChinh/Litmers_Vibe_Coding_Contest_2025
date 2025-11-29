"use client";

import { useQuery } from "@tanstack/react-query";
import { teamApi } from "../api/team-api";
import LoadingSpinner from "@/components/ui/loading-spinner";
import { useState } from "react";

interface TeamActivitiesProps {
  teamId: string;
}

export default function TeamActivities({ teamId }: TeamActivitiesProps) {
  const [offset, setOffset] = useState(0);
  const limit = 20;

  const { data, isLoading, isError } = useQuery({
    queryKey: ["team-activities", teamId, offset],
    queryFn: () => teamApi.getActivities(teamId, limit, offset),
  });

  if (isLoading) return <LoadingSpinner className="min-h-[200px]" size={24} />;
  if (isError)
    return <div className="text-red-500">Failed to load activities</div>;

  const activities = data?.activities || [];
  const total = data?.total || 0;
  const hasMore = offset + limit < total;

  const formatActionType = (actionType: string): string => {
    const actionMap: Record<string, string> = {
      MEMBER_JOIN: "joined the team",
      MEMBER_LEAVE: "left the team",
      MEMBER_KICK: "was removed from the team",
      ROLE_CHANGE: "role changed",
      PROJECT_CREATE: "created project",
      PROJECT_DELETE: "deleted project",
      PROJECT_ARCHIVE: "archived project",
      TEAM_UPDATE: "updated team",
    };
    return actionMap[actionType] || actionType.replace(/_/g, " ").toLowerCase();
  };

  const formatActivityDescription = (
    activity: (typeof activities)[0]
  ): string => {
    const actorName = activity.actor?.name || "Unknown";
    const action = formatActionType(activity.action_type);

    if (
      activity.action_type === "ROLE_CHANGE" &&
      activity.old_value &&
      activity.new_value
    ) {
      const targetName = activity.target_user?.name || "a member";
      return `${actorName} changed ${targetName}'s role from ${activity.old_value} to ${activity.new_value}`;
    }

    if (activity.action_type === "MEMBER_KICK" && activity.target_user) {
      return `${actorName} removed ${activity.target_user.name} from the team`;
    }

    if (activity.description) {
      return activity.description;
    }

    return `${actorName} ${action}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <h3 className="text-base sm:text-lg font-medium text-gray-900">
          Activity Log
        </h3>
        <span className="text-sm text-gray-500">{total} activities</span>
      </div>

      <div className="space-y-3">
        {activities.length === 0 ? (
          <div className="p-8 text-center text-gray-500 bg-white rounded-lg border border-gray-200">
            No activities yet
          </div>
        ) : (
          activities.map((activity) => (
            <div
              key={activity.id}
              className="flex items-start space-x-3 p-4 bg-white rounded-lg border border-gray-200"
            >
              <div className="shrink-0">
                {activity.actor?.avatar_url ? (
                  <img
                    src={activity.actor.avatar_url}
                    alt={activity.actor.name}
                    className="w-10 h-10 rounded-full"
                  />
                ) : (
                  <div className="flex items-center justify-center w-10 h-10 bg-gray-200 rounded-full text-gray-500 text-sm font-medium">
                    {activity.actor?.name?.[0] || "U"}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-900">
                  {formatActivityDescription(activity)}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {new Date(activity.created_at).toLocaleString()}
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      {activities.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-4">
          <button
            onClick={() => setOffset(Math.max(0, offset - limit))}
            disabled={offset === 0}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
          >
            Previous
          </button>
          <span className="text-sm text-gray-500 text-center">
            Showing {offset + 1}-{Math.min(offset + limit, total)} of {total}
          </span>
          <button
            onClick={() => setOffset(offset + limit)}
            disabled={!hasMore}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
