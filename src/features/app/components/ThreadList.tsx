import { useCallback, useRef, useState } from "react";
import type { CSSProperties, DragEvent, MouseEvent } from "react";

import type { ThreadSummary } from "../../../types";

type ThreadStatusMap = Record<
  string,
  { isProcessing: boolean; hasUnread: boolean; isReviewing: boolean }
>;

type ThreadRow = {
  thread: ThreadSummary;
  depth: number;
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
  onShowThreadMenu: (
    event: MouseEvent,
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
  onShowThreadMenu,
  onReorderThreads,
}: ThreadListProps) {
  const [draggingRootId, setDraggingRootId] = useState<string | null>(null);
  const [dropTargetRootId, setDropTargetRootId] = useState<string | null>(null);
  const [dropTargetPosition, setDropTargetPosition] = useState<
    "before" | "after" | null
  >(null);
  const draggingRootIdRef = useRef<string | null>(null);
  const indentUnit = nested ? 10 : 14;

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

  const renderThreadRow = ({ thread, depth }: ThreadRow) => {
    const relativeTime = getThreadTime(thread);
    const indentStyle =
      depth > 0
        ? ({ "--thread-indent": `${depth * indentUnit}px` } as CSSProperties)
        : undefined;
    const status = threadStatusById[thread.id];
    const statusClass = status?.isReviewing
      ? "reviewing"
      : status?.isProcessing
        ? "processing"
        : status?.hasUnread
          ? "unread"
          : "ready";
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

    return (
      <div
        key={thread.id}
        className={`thread-row ${
          workspaceId === activeWorkspaceId && thread.id === activeThreadId
            ? "active"
            : ""
        }${isReorderableRoot ? " thread-row-draggable" : ""}${
          isDragging ? " thread-row-dragging" : ""
        }${isDropTarget ? " thread-row-drop-target" : ""}${
          isDropTargetBefore ? " thread-row-drop-target-before" : ""
        }${isDropTargetAfter ? " thread-row-drop-target-after" : ""}`}
        style={indentStyle}
        onClick={() => onSelectThread(workspaceId, thread.id)}
        onContextMenu={(event) =>
          onShowThreadMenu(event, workspaceId, thread.id, canPin)
        }
        role="button"
        tabIndex={0}
        draggable={isReorderableRoot}
        onDragStart={(event) =>
          handleDragStart(event, thread.id, isReorderableRoot)
        }
        onDragOver={(event) =>
          handleDragOver(event, thread.id, isReorderableRoot)
        }
        onDrop={(event) => handleDrop(event, thread.id, isReorderableRoot)}
        onDragEnd={resetDragState}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onSelectThread(workspaceId, thread.id);
          }
        }}
      >
        <span className={`thread-status ${statusClass}`} aria-hidden />
        {isPinned && <span className="thread-pin-icon" aria-label="已置顶">📌</span>}
        <span className="thread-name">{thread.name}</span>
        <div className="thread-meta">
          {relativeTime && <span className="thread-time">{relativeTime}</span>}
          <div className="thread-menu">
            <div className="thread-menu-trigger" aria-hidden="true" />
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
