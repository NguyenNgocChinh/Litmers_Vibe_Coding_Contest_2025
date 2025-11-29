"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { kanbanApi, Issue } from "../api/kanban-api";
import { projectApi } from "@/features/project/api/project-api";
import KanbanColumn from "./kanban-column";
import KanbanCard from "./kanban-card";
import LoadingSpinner from "@/components/ui/loading-spinner";

interface KanbanBoardProps {
  projectId: string;
}

const defaultColumns = [
  { id: "Backlog", title: "Backlog", color: "border-gray-400" },
  { id: "In Progress", title: "In Progress", color: "border-blue-500" },
  { id: "Done", title: "Done", color: "border-green-500" },
];

export default function KanbanBoard({ projectId }: KanbanBoardProps) {
  const queryClient = useQueryClient();
  const [activeIssue, setActiveIssue] = useState<Issue | null>(null);
  const [localBoard, setLocalBoard] = useState<Record<string, Issue[]>>({});

  const { data: board, isLoading } = useQuery({
    queryKey: ["kanban-board", projectId],
    queryFn: () => kanbanApi.getBoard(projectId),
  });

  const { data: statuses } = useQuery({
    queryKey: ["project-statuses", projectId],
    queryFn: () => projectApi.getStatuses(projectId),
  });

  // Sync local board with fetched board
  useMemo(() => {
    if (board) {
      setLocalBoard(board);
    }
  }, [board]);

  const updateStatusMutation = useMutation({
    mutationFn: ({
      issueId,
      status,
    }: {
      issueId: string;
      status: Issue["status"];
    }) => kanbanApi.updateIssueStatus(issueId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kanban-board", projectId] });
    },
  });

  const updatePositionsMutation = useMutation({
    mutationFn: (
      updates: Array<{ issueId: string; position: number; status: string }>
    ) => kanbanApi.updateMultipleIssuePositions(updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kanban-board", projectId] });
    },
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Get all columns (default + custom statuses from board) with WIP limits
  const columns = useMemo(() => {
    if (!board) return defaultColumns;
    const boardStatuses = Object.keys(board);
    const customStatuses = boardStatuses.filter(
      (s) => !defaultColumns.find((c) => c.id === s)
    );

    // Create a map of status name to wip_limit from API
    const statusMap = new Map<string, number | undefined>();
    if (statuses) {
      statuses.forEach((status) => {
        statusMap.set(status.name, status.wip_limit ?? undefined);
      });
    }

    return [
      ...defaultColumns
        .filter((c) => boardStatuses.includes(c.id))
        .map((c) => ({
          ...c,
          wipLimit: statusMap.get(c.id),
        })),
      ...customStatuses.map((s) => {
        const customStatus = statuses?.find((st) => st.name === s);
        return {
          id: s,
          title: s,
          color: customStatus?.color
            ? `border-[${customStatus.color}]`
            : "border-gray-300",
          wipLimit: customStatus?.wip_limit ?? undefined,
        };
      }),
    ];
  }, [board, statuses]);

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    // Find the issue being dragged
    if (localBoard) {
      const allIssues = Object.values(localBoard).flat();
      const issue = allIssues.find((i: Issue) => i.id === active.id);
      if (issue) {
        setActiveIssue(issue);
      }
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveIssue(null);

    if (!over) return;

    const issueId = active.id as string;
    const overId = over.id as string;

    // Find which column the issue is currently in
    let currentStatus: string | null = null;
    let currentIssues: Issue[] = [];

    for (const [status, issues] of Object.entries(localBoard)) {
      const issueIndex = issues.findIndex((i: Issue) => i.id === issueId);
      if (issueIndex !== -1) {
        currentStatus = status;
        currentIssues = issues;
        break;
      }
    }

    if (!currentStatus) return;

    // Check if dragging to a column header (status change) or over another issue (reorder)
    const isColumnId = Object.keys(localBoard).includes(overId);

    if (isColumnId) {
      // Dragging to a column header - status change
      if (currentStatus !== overId) {
        updateStatusMutation.mutate({ issueId, status: overId });
      }
      // If same column, do nothing (can't reorder by dropping on column header)
    } else {
      // Dragging over another issue - check if same column or different column
      let targetStatus: string | null = null;
      let targetIssues: Issue[] = [];

      for (const [status, issues] of Object.entries(localBoard)) {
        const overIssueIndex = issues.findIndex((i: Issue) => i.id === overId);
        if (overIssueIndex !== -1) {
          targetStatus = status;
          targetIssues = issues;
          break;
        }
      }

      if (targetStatus) {
        if (currentStatus === targetStatus) {
          // Reorder within same column
          const activeIssueIndex = currentIssues.findIndex(
            (i: Issue) => i.id === issueId
          );
          const overIssueIndex = targetIssues.findIndex(
            (i: Issue) => i.id === overId
          );

          if (
            activeIssueIndex !== -1 &&
            overIssueIndex !== -1 &&
            activeIssueIndex !== overIssueIndex
          ) {
            const newIssues = arrayMove(
              currentIssues,
              activeIssueIndex,
              overIssueIndex
            );
            setLocalBoard({
              ...localBoard,
              [currentStatus]: newIssues,
            });

            // Update positions in backend
            const updates = newIssues.map((issue, index) => ({
              issueId: issue.id,
              position: index,
              status: currentStatus,
            }));
            updatePositionsMutation.mutate(updates);
          }
        } else {
          // Different column - status change
          updateStatusMutation.mutate({ issueId, status: targetStatus });
        }
      }
    }
  };

  if (isLoading) return <LoadingSpinner className="min-h-[400px]" size={32} />;
  if (!board) return <div>No board data</div>;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex space-x-3 sm:space-x-4 overflow-x-auto pb-4 -mx-4 sm:-mx-6 px-4 sm:px-6">
        {columns.map((column) => {
          const columnIssues = (localBoard[column.id] || []) as Issue[];
          // Sort by position if available, otherwise by created_at
          const sortedIssues = [...columnIssues].sort((a: Issue, b: Issue) => {
            if (a.position !== undefined && b.position !== undefined) {
              return a.position - b.position;
            }
            return (
              new Date(b.created_at).getTime() -
              new Date(a.created_at).getTime()
            );
          });

          return (
            <KanbanColumn
              key={column.id}
              id={column.id}
              title={column.title}
              issues={sortedIssues}
              color={column.color}
              wipLimit={column.wipLimit}
            />
          );
        })}
      </div>

      <DragOverlay>
        {activeIssue ? (
          <div className="rotate-3 opacity-80">
            <KanbanCard issue={activeIssue} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
