import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
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
}: PinnedThreadListProps) {
  const [nowMs, setNowMs] = useState(() => Date.now());
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

  return (
    <div className="thread-list pinned-thread-list">
      {rows.map((threadRow) => {
        const { thread, depth, workspaceId } = threadRow;
        const relativeTime = getThreadTime(thread);
        const indentStyle =
          depth > 0
            ? ({ "--thread-indent": `${depth * 14}px` } as CSSProperties)
            : undefined;
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
        const orderedThreadIds = orderedThreadIdsByWorkspace.get(workspaceId) ?? [];
        const rootId = threadRow.rootId ?? thread.id;
        const hasSubAgentDescendants = threadRow.hasSubAgentDescendants ?? false;
        const isCollapsed = threadRow.isCollapsed ?? false;
        const isRootCollapseToggleVisible =
          depth === 0 &&
          showSubAgentCollapseToggles &&
          hasSubAgentDescendants &&
          Boolean(onToggleRootCollapse);

        return (
          <div
            key={`${workspaceId}:${thread.id}`}
            data-thread-id={thread.id}
            className={`thread-row${isActive ? " active" : ""}${
              isSelected ? " thread-row-selected" : ""
            }`}
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
      })}
    </div>
  );
}
