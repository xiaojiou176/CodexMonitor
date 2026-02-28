import { memo, useCallback } from "react";
import type { CSSProperties, DragEvent, KeyboardEvent, MouseEvent } from "react";
import ChevronDown from "lucide-react/dist/esm/icons/chevron-down";
import ChevronRight from "lucide-react/dist/esm/icons/chevron-right";
import Pin from "lucide-react/dist/esm/icons/pin";

import type { SidebarMenuTriggerEvent } from "../hooks/useSidebarMenus";

type ThreadRowItemProps = {
  workspaceId: string;
  threadId: string;
  threadName: string;
  depth: number;
  indentUnit: number;
  relativeTime: string | null;
  statusClass: string;
  statusLabel: string;
  statusBadge: string | null;
  canPin: boolean;
  isPinned: boolean;
  isSelected: boolean;
  isActive: boolean;
  isSubAgent: boolean;
  isReorderableRoot: boolean;
  isDragging: boolean;
  isDropTargetBefore: boolean;
  isDropTargetAfter: boolean;
  draggable: boolean;
  isRootCollapseToggleVisible: boolean;
  isCollapsed: boolean;
  rootId: string;
  onEmitSelection?: (
    workspaceId: string,
    threadId: string,
    metaKey: boolean,
    ctrlKey: boolean,
    shiftKey: boolean,
  ) => void;
  onSelectThread: (workspaceId: string, threadId: string) => void;
  onShowThreadMenu: (
    event: SidebarMenuTriggerEvent,
    workspaceId: string,
    threadId: string,
    canPin: boolean,
  ) => void;
  onToggleRootCollapse?: (workspaceId: string, rootId: string) => void;
  onDragStart?: (
    event: DragEvent<HTMLDivElement>,
    rootId: string,
    isReorderableRoot: boolean,
  ) => void;
  onDragOver?: (
    event: DragEvent<HTMLDivElement>,
    rootId: string,
    isReorderableRoot: boolean,
  ) => void;
  onDrop?: (
    event: DragEvent<HTMLDivElement>,
    rootId: string,
    isReorderableRoot: boolean,
  ) => void;
  onDragEnd?: () => void;
};

function ThreadRowItemComponent({
  workspaceId,
  threadId,
  threadName,
  depth,
  indentUnit,
  relativeTime,
  statusClass,
  statusLabel,
  statusBadge,
  canPin,
  isPinned,
  isSelected,
  isActive,
  isSubAgent,
  isReorderableRoot,
  isDragging,
  isDropTargetBefore,
  isDropTargetAfter,
  draggable,
  isRootCollapseToggleVisible,
  isCollapsed,
  rootId,
  onEmitSelection,
  onSelectThread,
  onShowThreadMenu,
  onToggleRootCollapse,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: ThreadRowItemProps) {
  const indentStyle =
    depth > 0
      ? ({ "--thread-indent": `${depth * indentUnit}px` } as CSSProperties)
      : undefined;

  const handleRowClick = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      onEmitSelection?.(
        workspaceId,
        threadId,
        event.metaKey,
        event.ctrlKey,
        event.shiftKey,
      );
      onSelectThread(workspaceId, threadId);
    },
    [onEmitSelection, onSelectThread, threadId, workspaceId],
  );

  const handleContextMenu = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      onShowThreadMenu(event, workspaceId, threadId, canPin);
    },
    [canPin, onShowThreadMenu, threadId, workspaceId],
  );

  const handleRowKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.target !== event.currentTarget) {
        return;
      }
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }
      event.preventDefault();
      onEmitSelection?.(workspaceId, threadId, false, false, false);
      onSelectThread(workspaceId, threadId);
    },
    [onEmitSelection, onSelectThread, threadId, workspaceId],
  );

  const handleMenuClick = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      onShowThreadMenu(event, workspaceId, threadId, canPin);
    },
    [canPin, onShowThreadMenu, threadId, workspaceId],
  );

  const handleMenuKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        event.stopPropagation();
        onShowThreadMenu(event, workspaceId, threadId, canPin);
      }
    },
    [canPin, onShowThreadMenu, threadId, workspaceId],
  );

  const handleCollapseToggle = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
      onToggleRootCollapse?.(workspaceId, rootId);
    },
    [onToggleRootCollapse, rootId, workspaceId],
  );

  const handleDragStart = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      onDragStart?.(event, rootId, isReorderableRoot);
    },
    [isReorderableRoot, onDragStart, rootId],
  );

  const handleDragOver = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      onDragOver?.(event, rootId, isReorderableRoot);
    },
    [isReorderableRoot, onDragOver, rootId],
  );

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      onDrop?.(event, rootId, isReorderableRoot);
    },
    [isReorderableRoot, onDrop, rootId],
  );

  return (
    <div
      data-thread-id={threadId}
      className={`thread-row${isActive ? " active" : ""}${
        isSelected ? " thread-row-selected" : ""
      }${isReorderableRoot ? " thread-row-draggable" : ""}${
        isSubAgent ? " thread-row-subagent" : ""
      }${isDragging ? " thread-row-dragging" : ""}${
        isDropTargetBefore || isDropTargetAfter ? " thread-row-drop-target" : ""
      }${isDropTargetBefore ? " thread-row-drop-target-before" : ""}${
        isDropTargetAfter ? " thread-row-drop-target-after" : ""
      }`}
      style={indentStyle}
      tabIndex={0}
      aria-label={`选择对话 ${threadName}`}
      onClick={handleRowClick}
      onKeyDown={handleRowKeyDown}
      onContextMenu={handleContextMenu}
      draggable={draggable}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onDragEnd={onDragEnd}
    >
      {isRootCollapseToggleVisible && (
        <button
          type="button"
          className={`thread-collapse-toggle${isCollapsed ? " is-collapsed" : ""}`}
          aria-label={isCollapsed ? "展开子代理" : "折叠子代理"}
          title={isCollapsed ? "展开子代理" : "折叠子代理"}
          onClick={handleCollapseToggle}
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
      {statusBadge ? <span className={`thread-status-badge ${statusClass}`}>{statusBadge}</span> : null}
      {isPinned ? <Pin size={12} className="thread-pin-icon" aria-label="已置顶" /> : null}
      <span className="thread-name" title={threadName}>
        {threadName}
      </span>
      <div className="thread-meta">
        {relativeTime ? <span className="thread-time">{relativeTime}</span> : null}
        <div className="thread-menu">
          <button
            type="button"
            className="thread-menu-trigger"
            aria-label="更多操作"
            onClick={handleMenuClick}
            onKeyDown={handleMenuKeyDown}
          />
        </div>
      </div>
    </div>
  );
}

export function threadRowItemPropsEqual(
  prev: Readonly<ThreadRowItemProps>,
  next: Readonly<ThreadRowItemProps>,
): boolean {
  return (
    prev.workspaceId === next.workspaceId &&
    prev.threadId === next.threadId &&
    prev.threadName === next.threadName &&
    prev.depth === next.depth &&
    prev.indentUnit === next.indentUnit &&
    prev.relativeTime === next.relativeTime &&
    prev.statusClass === next.statusClass &&
    prev.statusLabel === next.statusLabel &&
    prev.statusBadge === next.statusBadge &&
    prev.canPin === next.canPin &&
    prev.isPinned === next.isPinned &&
    prev.isSelected === next.isSelected &&
    prev.isActive === next.isActive &&
    prev.isSubAgent === next.isSubAgent &&
    prev.isReorderableRoot === next.isReorderableRoot &&
    prev.isDragging === next.isDragging &&
    prev.isDropTargetBefore === next.isDropTargetBefore &&
    prev.isDropTargetAfter === next.isDropTargetAfter &&
    prev.draggable === next.draggable &&
    prev.isRootCollapseToggleVisible === next.isRootCollapseToggleVisible &&
    prev.isCollapsed === next.isCollapsed &&
    prev.rootId === next.rootId &&
    prev.onEmitSelection === next.onEmitSelection &&
    prev.onSelectThread === next.onSelectThread &&
    prev.onShowThreadMenu === next.onShowThreadMenu &&
    prev.onToggleRootCollapse === next.onToggleRootCollapse &&
    prev.onDragStart === next.onDragStart &&
    prev.onDragOver === next.onDragOver &&
    prev.onDrop === next.onDrop &&
    prev.onDragEnd === next.onDragEnd
  );
}

export const ThreadRowItem = memo(ThreadRowItemComponent, threadRowItemPropsEqual);
