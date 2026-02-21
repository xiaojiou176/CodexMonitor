// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useThreadRows } from "./useThreadRows";

describe("useThreadRows", () => {
  const threads = [
    { id: "root-a", name: "Root A", updatedAt: 3 },
    { id: "child-a1", name: "Child A1", updatedAt: 2 },
    { id: "child-a2", name: "Child A2", updatedAt: 1 },
    { id: "root-b", name: "Root B", updatedAt: 4 },
  ];
  const threadParentById = {
    "child-a1": "root-a",
    "child-a2": "child-a1",
  };

  it("hides sub-agent rows when global visibility is disabled", () => {
    const { result } = renderHook(() => useThreadRows(threadParentById));

    const rows = result.current.getThreadRows(
      threads,
      true,
      "ws-1",
      () => null,
      { showSubAgentThreads: false },
    );

    expect(rows.unpinnedRows.map((row) => row.thread.id)).toEqual(["root-a", "root-b"]);
    expect(rows.unpinnedRows.every((row) => row.depth === 0)).toBe(true);
  });

  it("collapses descendants for specified root and marks row metadata", () => {
    const { result } = renderHook(() => useThreadRows(threadParentById));

    const rows = result.current.getThreadRows(
      threads,
      true,
      "ws-1",
      () => null,
      {
        showSubAgentThreads: true,
        isRootCollapsed: (workspaceId, rootId) =>
          workspaceId === "ws-1" && rootId === "root-a",
      },
    );

    expect(rows.unpinnedRows.map((row) => row.thread.id)).toEqual(["root-a", "root-b"]);
    const rootA = rows.unpinnedRows.find((row) => row.thread.id === "root-a");
    expect(rootA?.hasSubAgentDescendants).toBe(true);
    expect(rootA?.isCollapsed).toBe(true);
  });
});
