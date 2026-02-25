import { useCallback, useMemo, useRef, useState } from "react";
import type { DragEvent } from "react";

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

type ThreadRow = {
  thread: ThreadSummary;
  depth: number;
  rootId?: string;
  isSubAgent?: boolean;
  hasSubAgentDescendants?: boolean;
  isCollapsed?: boolean;
};

type ThreadListProps = {
  workspaceId: string;
  pinnedRows: ThreadRow[];
  unpinnedRows: ThreadRow[];
  totalThreadRoots: number;
  isExpanded: boolean;
  nextCursor: string | null;
  isPaging: boolean;
  nested?: boolean;
  showLoadOlder?: boolean;
  activeWorkspaceId: string | null;
  activeThreadId: string | null;
  threadStatusById: ThreadStatusMap;
  getThreadTime: (thread: ThreadSummary) => string | null;
  isThreadPinned: (workspaceId: string, threadId: string) => boolean;
  onToggleExpanded: (workspaceId: string) => void;
  onLoadOlderThreads: (workspaceId: string) => void;
  onSelectThread: (workspaceId: string, threadId: string) => void;
  onThreadSelectionChange?: (selection: {
    workspaceId: string;
    threadId: string;
    orderedThreadIds: string[];
    metaKey: boolean;
    ctrlKey: boolean;
    shiftKey: boolean;
  }) => void;
  selectedThreadIds?: ReadonlySet<string>;
  onShowThreadMenu: (
    event: SidebarMenuTriggerEvent,
    workspaceId: string,
    threadId: string,
    canPin: boolean,
  ) => void;
  onReorderThreads?: (
    workspaceId: string,
    sourceThreadId: string,
    targetThreadId: string,
    position: "before" | "after",
  ) => void;
  onToggleRootCollapse?: (workspaceId: string, rootId: string) => void;
  showSubAgentCollapseToggles?: boolean;
  sidebarTicker: SidebarTicker;
};

export function ThreadList({
  workspaceId,
  pinnedRows,
  unpinnedRows,
  totalThreadRoots,
  isExpanded,
  nextCursor,
  isPaging,
  nested,
  showLoadOlder = true,
  activeWorkspaceId,
  activeThreadId,
  threadStatusById,
  getThreadTime,
  isThreadPinned,
  onToggleExpanded,
  onLoadOlderThreads,
  onSelectThread,
  onThreadSelectionChange,
  selectedThreadIds,
  onShowThreadMenu,
  onReorderThreads,
  onToggleRootCollapse,
  showSubAgentCollapseToggles = true,
  sidebarTicker,
}: ThreadListProps) {
  const [draggingRootId, setDraggingRootId] = useState<string | null>(null);
  const [dropTargetRootId, setDropTargetRootId] = useState<string | null>(null);
  const [dropTargetPosition, setDropTargetPosition] = useState<
    "before" | "after" | null
  >(null);
  const draggingRootIdRef = useRef<string | null>(null);
  const indentUnit = nested ? 10 : 14;
  const orderedThreadIds = useMemo(
    () => [...pinnedRows, ...unpinnedRows].map((row) => row.thread.id),
    [pinnedRows, unpinnedRows],
  );
  const hasProcessingRows = useMemo(
    () =>
      [...pinnedRows, ...unpinnedRows].some(
        ({ thread }) => threadStatusById[thread.id]?.isProcessing,
      ),
    [pinnedRows, threadStatusById, unpinnedRows],
  );

  const nowMs = useSidebarTickerNow(sidebarTicker, hasProcessingRows);

  const emitThreadSelection = useCallback(
    (
      _workspaceId: string,
      threadId: string,
      metaKey: boolean,
      ctrlKey: boolean,
      shiftKey: boolean,
    ) => {
      onThreadSelectionChange?.({
        workspaceId,
        threadId,
        orderedThreadIds,
        metaKey,
        ctrlKey,
        shiftKey,
      });
    },
    [onThreadSelectionChange, orderedThreadIds, workspaceId],
  );

  const resetDragState = useCallback(() => {
    draggingRootIdRef.current = null;
    setDraggingRootId(null);
    setDropTargetRootId(null);
    setDropTargetPosition(null);
  }, []);

  const handleDragStart = useCallback(
    (event: DragEvent<HTMLDivElement>, rootId: string, isReorderableRoot: boolean) => {
      if (!isReorderableRoot) {
        return;
      }
      draggingRootIdRef.current = rootId;
      setDraggingRootId(rootId);
      setDropTargetRootId(null);
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", rootId);
      }
    },
    [],
  );

  const handleDragOver = useCallback(
    (event: DragEvent<HTMLDivElement>, targetRootId: string, isReorderableRoot: boolean) => {
      if (!isReorderableRoot) {
        return;
      }
      event.preventDefault();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = "move";
      }
      const sourceRootId =
        draggingRootIdRef.current ?? event.dataTransfer?.getData("text/plain") ?? null;
      if (!sourceRootId || sourceRootId === targetRootId) {
        return;
      }
      const rect = event.currentTarget.getBoundingClientRect();
      const position =
        event.clientY <= rect.top + rect.height / 2 ? "before" : "after";
      if (dropTargetRootId !== targetRootId) {
        setDropTargetRootId(targetRootId);
      }
      if (dropTargetPosition !== position) {
        setDropTargetPosition(position);
      }
    },
    [dropTargetPosition, dropTargetRootId],
  );

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>, targetRootId: string, isReorderableRoot: boolean) => {
      if (!isReorderableRoot) {
        return;
      }
      event.preventDefault();
      const sourceRootId =
        draggingRootIdRef.current ?? event.dataTransfer?.getData("text/plain") ?? null;
      if (!sourceRootId || sourceRootId === targetRootId) {
        resetDragState();
        return;
      }
      const position =
        dropTargetRootId === targetRootId && dropTargetPosition
          ? dropTargetPosition
          : (() => {
              const rect = event.currentTarget.getBoundingClientRect();
              return event.clientY <= rect.top + rect.height / 2
                ? "before"
                : "after";
            })();
      onReorderThreads?.(workspaceId, sourceRootId, targetRootId, position);
      resetDragState();
    },
    [
      dropTargetPosition,
      dropTargetRootId,
      onReorderThreads,
      resetDragState,
      workspaceId,
    ],
  );

  const renderThreadRow = (row: ThreadRow) => {
    const { thread, depth } = row;
    const relativeTime = getThreadTime(thread);
    const status = threadStatusById[thread.id];
    const visualStatus = deriveThreadVisualStatus(status, nowMs);
    const statusClass = visualStatus;
    const statusLabel = getThreadVisualStatusLabel(visualStatus);
    const statusBadge = getThreadVisualStatusBadge(visualStatus);
    const canPin = depth === 0;
    const isPinned = canPin && isThreadPinned(workspaceId, thread.id);
    const isReorderableRoot =
      Boolean(onReorderThreads) && !nested && depth === 0 && !isPinned;
    const isDragging = draggingRootId === thread.id;
    const isDropTarget =
      isReorderableRoot &&
      dropTargetRootId === thread.id &&
      draggingRootId !== null &&
      draggingRootId !== thread.id;
    const isDropTargetBefore = isDropTarget && dropTargetPosition === "before";
    const isDropTargetAfter = isDropTarget && dropTargetPosition === "after";
    const isSelected = selectedThreadIds?.has(thread.id) ?? false;
    const isActive =
      workspaceId === activeWorkspaceId && thread.id === activeThreadId;
    const rootId = row.rootId ?? thread.id;
    const hasSubAgentDescendants = row.hasSubAgentDescendants ?? false;
    const isRootCollapseToggleVisible =
      depth === 0 &&
      showSubAgentCollapseToggles &&
      hasSubAgentDescendants &&
      Boolean(onToggleRootCollapse);
    const isCollapsed = row.isCollapsed ?? false;

    return (
      <ThreadRowItem
        key={thread.id}
        workspaceId={workspaceId}
        threadId={thread.id}
        threadName={thread.name}
        depth={depth}
        indentUnit={indentUnit}
        relativeTime={relativeTime}
        statusClass={statusClass}
        statusLabel={statusLabel}
        statusBadge={statusBadge}
        canPin={canPin}
        isPinned={isPinned}
        isSelected={isSelected}
        isActive={isActive}
        isSubAgent={Boolean(row.isSubAgent)}
        isReorderableRoot={isReorderableRoot}
        isDragging={isDragging}
        isDropTargetBefore={isDropTargetBefore}
        isDropTargetAfter={isDropTargetAfter}
        draggable={isReorderableRoot}
        isRootCollapseToggleVisible={isRootCollapseToggleVisible}
        isCollapsed={isCollapsed}
        rootId={rootId}
        onEmitSelection={emitThreadSelection}
        onSelectThread={onSelectThread}
        onShowThreadMenu={onShowThreadMenu}
        onToggleRootCollapse={onToggleRootCollapse}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onDragEnd={resetDragState}
      />
    );
  };

  return (
    <div className={`thread-list${nested ? " thread-list-nested" : ""}`}>
      {pinnedRows.map((row) => renderThreadRow(row))}
      {pinnedRows.length > 0 && unpinnedRows.length > 0 && (
        <div className="thread-list-separator" aria-hidden="true" />
      )}
      {unpinnedRows.map((row) => renderThreadRow(row))}
      {totalThreadRoots > 3 && (
        <button
          className="thread-more"
          onClick={(event) => {
            event.stopPropagation();
            onToggleExpanded(workspaceId);
          }}
        >
          {isExpanded ? "收起" : "更多..."}
        </button>
      )}
      {showLoadOlder && nextCursor && (isExpanded || totalThreadRoots <= 3) && (
        <button
          className="thread-more"
          onClick={(event) => {
            event.stopPropagation();
            onLoadOlderThreads(workspaceId);
          }}
          disabled={isPaging}
        >
          {isPaging
            ? "加载中..."
            : totalThreadRoots === 0
              ? "搜索更早的..."
              : "加载更早的..."}
        </button>
      )}
    </div>
  );
}
