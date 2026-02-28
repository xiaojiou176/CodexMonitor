// @vitest-environment jsdom

import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ThreadRowItem, threadRowItemPropsEqual } from "./ThreadRowItem";

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

describe("ThreadRowItem", () => {
  it("selects thread with keyboard and keeps inner controls independently interactive", () => {
    const onEmitSelection = vi.fn();
    const onSelectThread = vi.fn();
    const onShowThreadMenu = vi.fn();
    const onToggleRootCollapse = vi.fn();

    const { container } = render(
      <ThreadRowItem
        {...baseProps}
        isRootCollapseToggleVisible
        onEmitSelection={onEmitSelection}
        onSelectThread={onSelectThread}
        onShowThreadMenu={onShowThreadMenu}
        onToggleRootCollapse={onToggleRootCollapse}
      />,
    );

    const row = container.querySelector(".thread-row");
    if (!row) {
      throw new Error("missing thread row element");
    }

    fireEvent.keyDown(row, { key: "Enter" });
    expect(onEmitSelection).toHaveBeenCalledWith("ws-1", "thread-1", false, false, false);
    expect(onSelectThread).toHaveBeenCalledWith("ws-1", "thread-1");
    expect(row.getAttribute("role")).toBeNull();

    const collapseButton = container.querySelector(".thread-collapse-toggle");
    if (!collapseButton) {
      throw new Error("missing collapse button");
    }
    fireEvent.click(collapseButton);
    expect(onToggleRootCollapse).toHaveBeenCalledWith("ws-1", "thread-1");

    const menuButton = container.querySelector(".thread-menu-trigger");
    if (!menuButton) {
      throw new Error("missing menu trigger button");
    }
    fireEvent.click(menuButton);
    expect(onShowThreadMenu).toHaveBeenCalled();
  });
});
