import { useCallback, useMemo } from "react";

import type { ThreadSummary } from "../../../types";
import type { SidebarMenuTriggerEvent } from "../hooks/useSidebarMenus";
import {
  deriveThreadVisualStatus,
  getThreadVisualStatusBadge,
  getThreadVisualStatusLabel,
} from "../../../utils/threadStatus";
import type { SidebarTicker } from "../hooks/useSidebarTicker";
import { useSidebarTickerNow } from "../hooks/useSidebarTicker";
import { ThreadRowItem } from "./ThreadRowItem";

type ThreadStatusMap = Record<
  string,
  {
    isProcessing: boolean;
    hasUnread: boolean;
    isReviewing: boolean;
    processingStartedAt?: number | null;
    lastActivityAt?: number | null;
    lastErrorAt?: number | null;
    lastErrorMessage?: string | null;
  }
>;

type PinnedThreadRow = {
  thread: ThreadSummary;
  depth: number;
  workspaceId: string;
  rootId?: string;
  isSubAgent?: boolean;
  hasSubAgentDescendants?: boolean;
  isCollapsed?: boolean;
};

type PinnedThreadListProps = {
  rows: PinnedThreadRow[];
  activeWorkspaceId: string | null;
  activeThreadId: string | null;
  selectedWorkspaceId?: string | null;
  selectedThreadIds?: ReadonlySet<string>;
  threadStatusById: ThreadStatusMap;
  getThreadTime: (thread: ThreadSummary) => string | null;
  isThreadPinned: (workspaceId: string, threadId: string) => boolean;
  onSelectThread: (workspaceId: string, threadId: string) => void;
  onThreadSelectionChange?: (selection: {
    workspaceId: string;
    threadId: string;
    orderedThreadIds: string[];
    metaKey: boolean;
    ctrlKey: boolean;
    shiftKey: boolean;
  }) => void;
  onShowThreadMenu: (
    event: SidebarMenuTriggerEvent,
    workspaceId: string,
    threadId: string,
    canPin: boolean,
  ) => void;
  onToggleRootCollapse?: (workspaceId: string, rootId: string) => void;
  showSubAgentCollapseToggles?: boolean;
  sidebarTicker: SidebarTicker;
};

export function PinnedThreadList({
  rows,
  activeWorkspaceId,
  activeThreadId,
  selectedWorkspaceId = null,
  selectedThreadIds,
  threadStatusById,
  getThreadTime,
  isThreadPinned,
  onSelectThread,
  onThreadSelectionChange,
  onShowThreadMenu,
  onToggleRootCollapse,
  showSubAgentCollapseToggles = true,
  sidebarTicker,
}: PinnedThreadListProps) {
  const orderedThreadIdsByWorkspace = useMemo(() => {
    const map = new Map<string, string[]>();
    rows.forEach(({ workspaceId, thread }) => {
      const ids = map.get(workspaceId);
      if (ids) {
        ids.push(thread.id);
        return;
      }
      map.set(workspaceId, [thread.id]);
    });
    return map;
  }, [rows]);
  const hasProcessingRows = useMemo(
    () => rows.some(({ thread }) => threadStatusById[thread.id]?.isProcessing),
    [rows, threadStatusById],
  );
  const nowMs = useSidebarTickerNow(sidebarTicker, hasProcessingRows);
  const emitThreadSelection = useCallback(
    (
      workspaceId: string,
      threadId: string,
      metaKey: boolean,
      ctrlKey: boolean,
      shiftKey: boolean,
    ) => {
      onThreadSelectionChange?.({
        workspaceId,
        threadId,
        orderedThreadIds: orderedThreadIdsByWorkspace.get(workspaceId) ?? [],
        metaKey,
        ctrlKey,
        shiftKey,
      });
    },
    [onThreadSelectionChange, orderedThreadIdsByWorkspace],
  );

  return (
    <div className="thread-list pinned-thread-list">
      {rows.map((threadRow) => {
        const { thread, depth, workspaceId } = threadRow;
        const relativeTime = getThreadTime(thread);
        const status = threadStatusById[thread.id];
        const visualStatus = deriveThreadVisualStatus(status, nowMs);
        const statusClass = visualStatus;
        const statusLabel = getThreadVisualStatusLabel(visualStatus);
        const statusBadge = getThreadVisualStatusBadge(visualStatus);
        const canPin = depth === 0;
        const isPinned = canPin && isThreadPinned(workspaceId, thread.id);
        const isSelected =
          selectedWorkspaceId === workspaceId &&
          (selectedThreadIds?.has(thread.id) ?? false);
        const isActive =
          workspaceId === activeWorkspaceId && thread.id === activeThreadId;
        const rootId = threadRow.rootId ?? thread.id;
        const hasSubAgentDescendants = threadRow.hasSubAgentDescendants ?? false;
        const isCollapsed = threadRow.isCollapsed ?? false;
        const isRootCollapseToggleVisible =
          depth === 0 &&
          showSubAgentCollapseToggles &&
          hasSubAgentDescendants &&
          Boolean(onToggleRootCollapse);

        return (
          <ThreadRowItem
            key={`${workspaceId}:${thread.id}`}
            workspaceId={workspaceId}
            threadId={thread.id}
            threadName={thread.name}
            depth={depth}
            indentUnit={14}
            relativeTime={relativeTime}
            statusClass={statusClass}
            statusLabel={statusLabel}
            statusBadge={statusBadge}
            canPin={canPin}
            isPinned={isPinned}
            isSelected={isSelected}
            isActive={isActive}
            isSubAgent={Boolean(threadRow.isSubAgent)}
            isReorderableRoot={false}
            isDragging={false}
            isDropTargetBefore={false}
            isDropTargetAfter={false}
            draggable={false}
            isRootCollapseToggleVisible={isRootCollapseToggleVisible}
            isCollapsed={isCollapsed}
            rootId={rootId}
            onEmitSelection={emitThreadSelection}
            onSelectThread={onSelectThread}
            onShowThreadMenu={onShowThreadMenu}
            onToggleRootCollapse={onToggleRootCollapse}
          />
        );
      })}
    </div>
  );
}
