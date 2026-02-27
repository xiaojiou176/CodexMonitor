// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ThreadSummary, WorkspaceInfo } from "../../../types";
import { useWorkspaceCycling } from "./useWorkspaceCycling";

type GroupedWorkspace = { workspaces: WorkspaceInfo[] };

type HarnessArgs = {
  workspaces?: WorkspaceInfo[];
  groupedWorkspaces?: GroupedWorkspace[];
  threadsByWorkspace?: Record<string, ThreadSummary[]>;
  activeWorkspaceId?: string | null;
  activeThreadId?: string | null;
};

function createWorkspace(id: string, name = id): WorkspaceInfo {
  return {
    id,
    name,
    path: `/tmp/${id}`,
    connected: true,
    settings: { sidebarCollapsed: false },
  };
}

function createHarness(args: HarnessArgs = {}) {
  const ws1 = createWorkspace("ws-1", "Workspace 1");
  const ws2 = createWorkspace("ws-2", "Workspace 2");

  const workspaces = args.workspaces ?? [ws1, ws2];
  const groupedWorkspaces =
    args.groupedWorkspaces ??
    [
      {
        workspaces,
      },
    ];

  const threadsByWorkspace =
    args.threadsByWorkspace ??
    {
      "ws-1": [
        { id: "t-1", name: "Thread 1", updatedAt: 3 },
        { id: "t-2", name: "Thread 2", updatedAt: 2 },
        { id: "t-3", name: "Thread 3", updatedAt: 1 },
      ],
      "ws-2": [{ id: "t-4", name: "Thread 4", updatedAt: 1 }],
    };

  const getThreadRows = vi.fn(
    (
      threads: ThreadSummary[],
      _includeArchived: boolean,
      workspaceId: string,
      getPinTimestamp: (workspaceId: string, threadId: string) => number | null,
    ) => {
      const pinnedRows = threads
        .filter((thread) => getPinTimestamp(workspaceId, thread.id) !== null)
        .map((thread) => ({ thread: { id: thread.id } }));
      const unpinnedRows = threads
        .filter((thread) => getPinTimestamp(workspaceId, thread.id) === null)
        .map((thread) => ({ thread: { id: thread.id } }));
      return { pinnedRows, unpinnedRows };
    },
  );

  const getPinTimestamp = vi.fn(() => null);
  const exitDiffView = vi.fn();
  const resetPullRequestSelection = vi.fn();
  const selectWorkspace = vi.fn();
  const setActiveThreadId = vi.fn();

  const activeWorkspaceIdRef = {
    current:
      args.activeWorkspaceId !== undefined ? args.activeWorkspaceId : "ws-1",
  };
  const activeThreadIdRef = {
    current: args.activeThreadId !== undefined ? args.activeThreadId : "t-2",
  };

  const { result } = renderHook(() =>
    useWorkspaceCycling({
      workspaces,
      groupedWorkspaces,
      threadsByWorkspace,
      getThreadRows,
      getPinTimestamp,
      activeWorkspaceIdRef,
      activeThreadIdRef,
      exitDiffView,
      resetPullRequestSelection,
      selectWorkspace,
      setActiveThreadId,
    }),
  );

  return {
    result,
    getPinTimestamp,
    getThreadRows,
    exitDiffView,
    resetPullRequestSelection,
    selectWorkspace,
    setActiveThreadId,
  };
}

describe("useWorkspaceCycling", () => {
  it("does nothing for agent cycling when active workspace is missing", () => {
    const harness = createHarness({ activeWorkspaceId: null });

    harness.result.current.handleCycleAgent("next");

    expect(harness.getThreadRows).not.toHaveBeenCalled();
    expect(harness.exitDiffView).not.toHaveBeenCalled();
    expect(harness.selectWorkspace).not.toHaveBeenCalled();
    expect(harness.setActiveThreadId).not.toHaveBeenCalled();
  });

  it("does nothing for agent cycling when workspace has no threads", () => {
    const harness = createHarness({
      threadsByWorkspace: {
        "ws-1": [],
      },
      activeWorkspaceId: "ws-1",
      activeThreadId: "t-1",
    });

    harness.result.current.handleCycleAgent("next");

    expect(harness.getThreadRows).not.toHaveBeenCalled();
    expect(harness.exitDiffView).not.toHaveBeenCalled();
    expect(harness.selectWorkspace).not.toHaveBeenCalled();
    expect(harness.setActiveThreadId).not.toHaveBeenCalled();
  });

  it("cycles agents with wrap-around and respects invalid active thread state", () => {
    const harness = createHarness({ activeThreadId: "t-3" });

    harness.result.current.handleCycleAgent("next");
    expect(harness.selectWorkspace).toHaveBeenNthCalledWith(1, "ws-1");
    expect(harness.setActiveThreadId).toHaveBeenNthCalledWith(1, "t-1", "ws-1");

    const invalidStateHarness = createHarness({ activeThreadId: "missing-thread" });
    invalidStateHarness.result.current.handleCycleAgent("prev");

    expect(invalidStateHarness.selectWorkspace).toHaveBeenCalledWith("ws-1");
    expect(invalidStateHarness.setActiveThreadId).toHaveBeenCalledWith("t-3", "ws-1");
    expect(invalidStateHarness.exitDiffView).toHaveBeenCalledTimes(1);
    expect(invalidStateHarness.resetPullRequestSelection).toHaveBeenCalledTimes(1);
  });

  it("cycles workspaces with wrap-around and moves to first thread", () => {
    const harness = createHarness({ activeWorkspaceId: "ws-2" });

    harness.result.current.handleCycleWorkspace("next");

    expect(harness.selectWorkspace).toHaveBeenCalledWith("ws-1");
    expect(harness.setActiveThreadId).toHaveBeenCalledWith("t-1", "ws-1");
    expect(harness.exitDiffView).toHaveBeenCalledTimes(1);
    expect(harness.resetPullRequestSelection).toHaveBeenCalledTimes(1);
  });

  it("supports workspace boundary cases: empty list, single item, and missing active state", () => {
    const emptyHarness = createHarness({ workspaces: [], groupedWorkspaces: [] });
    emptyHarness.result.current.handleCycleWorkspace("next");
    expect(emptyHarness.selectWorkspace).not.toHaveBeenCalled();
    expect(emptyHarness.setActiveThreadId).not.toHaveBeenCalled();

    const singleWorkspace = createWorkspace("solo");
    const singleHarness = createHarness({
      workspaces: [singleWorkspace],
      groupedWorkspaces: [{ workspaces: [singleWorkspace] }],
      threadsByWorkspace: {
        solo: [{ id: "solo-thread", name: "Solo Thread", updatedAt: 1 }],
      },
      activeWorkspaceId: "solo",
      activeThreadId: "solo-thread",
    });
    singleHarness.result.current.handleCycleWorkspace("prev");
    expect(singleHarness.selectWorkspace).toHaveBeenCalledWith("solo");
    expect(singleHarness.setActiveThreadId).toHaveBeenCalledWith(
      "solo-thread",
      "solo",
    );

    const missingActiveHarness = createHarness({ activeWorkspaceId: "missing-workspace" });
    missingActiveHarness.result.current.handleCycleWorkspace("prev");
    expect(missingActiveHarness.selectWorkspace).toHaveBeenCalledWith("ws-2");
    expect(missingActiveHarness.setActiveThreadId).toHaveBeenCalledWith("t-4", "ws-2");
  });

  it("sets active thread to null when cycling into a workspace without threads", () => {
    const harness = createHarness({
      workspaces: [createWorkspace("ws-1"), createWorkspace("ws-2")],
      groupedWorkspaces: [
        {
          workspaces: [createWorkspace("ws-1"), createWorkspace("ws-2")],
        },
      ],
      threadsByWorkspace: {
        "ws-1": [{ id: "t-1", name: "Thread 1", updatedAt: 1 }],
        "ws-2": [],
      },
      activeWorkspaceId: "ws-1",
      activeThreadId: "t-1",
    });

    harness.result.current.handleCycleWorkspace("next");

    expect(harness.selectWorkspace).toHaveBeenCalledWith("ws-2");
    expect(harness.setActiveThreadId).toHaveBeenCalledWith(null, "ws-2");
  });
});
