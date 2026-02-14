import { useMemo } from "react";
import type { CSSProperties, MouseEvent } from "react";

import type { ThreadSummary } from "../../../types";

type ThreadStatusMap = Record<
  string,
  { isProcessing: boolean; hasUnread: boolean; isReviewing: boolean }
>;

type PinnedThreadRow = {
  thread: ThreadSummary;
  depth: number;
  workspaceId: string;
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
    event: MouseEvent,
    workspaceId: string,
    threadId: string,
    canPin: boolean,
  ) => void;
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

  return (
    <div className="thread-list pinned-thread-list">
      {rows.map(({ thread, depth, workspaceId }) => {
        const relativeTime = getThreadTime(thread);
        const indentStyle =
          depth > 0
            ? ({ "--thread-indent": `${depth * 14}px` } as CSSProperties)
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
        const isSelected =
          selectedWorkspaceId === workspaceId &&
          (selectedThreadIds?.has(thread.id) ?? false);
        const isActive =
          workspaceId === activeWorkspaceId && thread.id === activeThreadId;
        const orderedThreadIds = orderedThreadIdsByWorkspace.get(workspaceId) ?? [];

        return (
          <div
            key={`${workspaceId}:${thread.id}`}
            className={`thread-row ${
              isActive || isSelected ? "active" : ""
            }${isSelected ? " thread-row-selected" : ""}`}
            style={indentStyle}
            onClick={(event) => {
              onThreadSelectionChange?.({
                workspaceId,
                threadId: thread.id,
                orderedThreadIds,
                metaKey: event.metaKey,
                ctrlKey: event.ctrlKey,
                shiftKey: event.shiftKey,
              });
              onSelectThread(workspaceId, thread.id);
            }}
            onContextMenu={(event) =>
              onShowThreadMenu(event, workspaceId, thread.id, canPin)
            }
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onThreadSelectionChange?.({
                  workspaceId,
                  threadId: thread.id,
                  orderedThreadIds,
                  metaKey: false,
                  ctrlKey: false,
                  shiftKey: false,
                });
                onSelectThread(workspaceId, thread.id);
              }
            }}
          >
            <span className={`thread-status ${statusClass}`} aria-hidden />
            {isPinned && (
              <span className="thread-pin-icon" aria-label="已置顶">
                📌
              </span>
            )}
            <span className="thread-name">{thread.name}</span>
            <div className="thread-meta">
              {relativeTime && <span className="thread-time">{relativeTime}</span>}
              <div className="thread-menu">
                <div className="thread-menu-trigger" aria-hidden="true" />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
