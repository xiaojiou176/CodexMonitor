import { describe, expect, it, vi } from "vitest";

import { threadRowItemPropsEqual } from "./ThreadRowItem";

const baseCallbacks = {
  onEmitSelection: vi.fn(),
  onSelectThread: vi.fn(),
  onShowThreadMenu: vi.fn(),
  onToggleRootCollapse: vi.fn(),
  onDragStart: vi.fn(),
  onDragOver: vi.fn(),
  onDrop: vi.fn(),
  onDragEnd: vi.fn(),
};

const baseProps = {
  workspaceId: "ws-1",
  threadId: "thread-1",
  threadName: "Alpha",
  depth: 0,
  indentUnit: 14,
  relativeTime: "1m",
  statusClass: "unread",
  statusLabel: "有未读消息",
  statusBadge: null,
  canPin: true,
  isPinned: false,
  isSelected: false,
  isActive: false,
  isSubAgent: false,
  isReorderableRoot: true,
  isDragging: false,
  isDropTargetBefore: false,
  isDropTargetAfter: false,
  draggable: true,
  isRootCollapseToggleVisible: false,
  isCollapsed: false,
  rootId: "thread-1",
  ...baseCallbacks,
};

describe("threadRowItemPropsEqual", () => {
  it("treats cloned props with equal whitelisted fields as equal", () => {
    const left = { ...baseProps };
    const right = { ...baseProps };

    expect(threadRowItemPropsEqual(left, right)).toBeTruthy();
  });

  it("detects changes to relevant thread display fields", () => {
    const next = { ...baseProps, threadName: "Beta" };

    expect(threadRowItemPropsEqual(baseProps, next)).toBe(false);
  });

  it("detects callback reference changes", () => {
    const next = { ...baseProps, onSelectThread: vi.fn() };

    expect(threadRowItemPropsEqual(baseProps, next)).toBe(false);
  });
});
