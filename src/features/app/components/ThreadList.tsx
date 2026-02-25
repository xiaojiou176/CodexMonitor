import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, DragEvent } from "react";
import ChevronDown from "lucide-react/dist/esm/icons/chevron-down";
import ChevronRight from "lucide-react/dist/esm/icons/chevron-right";
import Pin from "lucide-react/dist/esm/icons/pin";

import type { ThreadSummary } from "../../../types";
import type { SidebarMenuTriggerEvent } from "../hooks/useSidebarMenus";
import {
  deriveThreadVisualStatus,
  getThreadVisualStatusBadge,
  getThreadVisualStatusLabel,
} from "../../../utils/threadStatus";

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
}: ThreadListProps) {
  const [draggingRootId, setDraggingRootId] = useState<string | null>(null);
  const [dropTargetRootId, setDropTargetRootId] = useState<string | null>(null);
  const [dropTargetPosition, setDropTargetPosition] = useState<
    "before" | "after" | null
  >(null);
  const draggingRootIdRef = useRef<string | null>(null);
  const indentUnit = nested ? 10 : 14;
  const [nowMs, setNowMs] = useState(() => Date.now());
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

  useEffect(() => {
    if (!hasProcessingRows) {
      return undefined;
    }
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => {
      window.clearInterval(timer);
    };
  }, [hasProcessingRows]);

  const emitThreadSelection = useCallback(
    (threadId: string, metaKey: boolean, ctrlKey: boolean, shiftKey: boolean) => {
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
    const indentStyle =
      depth > 0
        ? ({ "--thread-indent": `${depth * indentUnit}px` } as CSSProperties)
        : undefined;
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
      <div
        key={thread.id}
        data-thread-id={thread.id}
        className={`thread-row${isActive ? " active" : ""}${
          isSelected ? " thread-row-selected" : ""
        }${
          isReorderableRoot ? " thread-row-draggable" : ""
        }${row.isSubAgent ? " thread-row-subagent" : ""}${
          isDragging ? " thread-row-dragging" : ""
        }${
          isDropTarget ? " thread-row-drop-target" : ""
        }${
          isDropTargetBefore ? " thread-row-drop-target-before" : ""
        }${isDropTargetAfter ? " thread-row-drop-target-after" : ""}`}
        style={indentStyle}
        onClick={(event) => {
          emitThreadSelection(
            thread.id,
            event.metaKey,
            event.ctrlKey,
            event.shiftKey,
          );
          onSelectThread(workspaceId, thread.id);
        }}
        onContextMenu={(event) =>
          onShowThreadMenu(event, workspaceId, thread.id, canPin)
        }
        draggable={isReorderableRoot}
        onDragStart={(event) =>
          handleDragStart(event, thread.id, isReorderableRoot)
        }
        onDragOver={(event) =>
          handleDragOver(event, thread.id, isReorderableRoot)
        }
        onDrop={(event) => handleDrop(event, thread.id, isReorderableRoot)}
        onDragEnd={resetDragState}
      >
        {isRootCollapseToggleVisible && (
          <button
            type="button"
            className={`thread-collapse-toggle${isCollapsed ? " is-collapsed" : ""}`}
            aria-label={isCollapsed ? "展开子代理" : "折叠子代理"}
            title={isCollapsed ? "展开子代理" : "折叠子代理"}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onToggleRootCollapse?.(workspaceId, rootId);
            }}
          >
            {isCollapsed ? <ChevronRight aria-hidden /> : <ChevronDown aria-hidden />}
          </button>
        )}
        <span
          className={`thread-status ${statusClass}`}
          aria-label={statusLabel}
          title={statusLabel}
        />
        <span className="sr-only">{`线程状态：${statusLabel}`}</span>
        {statusBadge ? (
          <span className={`thread-status-badge ${statusClass}`}>{statusBadge}</span>
        ) : null}
        {isPinned && <Pin size={12} className="thread-pin-icon" aria-label="已置顶" />}
        <span className="thread-name" title={thread.name}>{thread.name}</span>
        <div className="thread-meta">
          {relativeTime && <span className="thread-time">{relativeTime}</span>}
          <div className="thread-menu">
            <button
              type="button"
              className="thread-menu-trigger"
              aria-label="更多操作"
              onClick={(e) => {
                e.stopPropagation();
                onShowThreadMenu(e, workspaceId, thread.id, canPin);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  onShowThreadMenu(e, workspaceId, thread.id, canPin);
                }
              }}
            />
          </div>
        </div>
      </div>
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
