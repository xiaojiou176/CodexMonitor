// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import type { WorkspaceInfo } from "../types";
import {
  __workspaceOrderRecoveryStorageKeyForTests,
  clearPendingWorkspaceReorder,
  loadPendingWorkspaceReorder,
  persistWorkspaceOrderWithWal,
  replayPendingWorkspaceReorder,
  savePendingWorkspaceReorder,
} from "./workspaceOrderRecovery";

function makeWorkspace(id: string): WorkspaceInfo {
  return {
    id,
    name: `Workspace ${id}`,
    path: `/tmp/${id}`,
    connected: true,
    settings: {
      sidebarCollapsed: false,
      groupId: null,
    },
  };
}

describe("workspaceOrderRecovery", () => {
  it("records pending reorder payload", () => {
    clearPendingWorkspaceReorder();

    savePendingWorkspaceReorder({
      orderedWorkspaceIds: ["ws-2", "ws-1"],
      groupId: null,
    });

    expect(loadPendingWorkspaceReorder()).toMatchObject({
      orderedWorkspaceIds: ["ws-2", "ws-1"],
      groupId: null,
    });
  });

  it("clears pending reorder after successful persistence", async () => {
    clearPendingWorkspaceReorder();
    const persist = vi.fn(async () => undefined);

    await persistWorkspaceOrderWithWal(
      [makeWorkspace("ws-2"), makeWorkspace("ws-1")],
      "group-1",
      persist,
    );

    expect(persist).toHaveBeenCalledTimes(1);
    expect(loadPendingWorkspaceReorder()).toBeNull();
  });

  it("replays pending reorder on startup and clears WAL on success", async () => {
    clearPendingWorkspaceReorder();
    savePendingWorkspaceReorder({
      orderedWorkspaceIds: ["ws-2", "ws-1"],
      groupId: null,
    });

    const workspaceById = new Map<string, WorkspaceInfo>([
      ["ws-1", makeWorkspace("ws-1")],
      ["ws-2", makeWorkspace("ws-2")],
    ]);
    const persist = vi.fn(async () => undefined);

    const replayed = await replayPendingWorkspaceReorder(workspaceById, persist);

    expect(replayed).toBeTruthy();
    expect(persist).toHaveBeenCalledWith(
      [workspaceById.get("ws-2"), workspaceById.get("ws-1")],
      null,
    );
    expect(loadPendingWorkspaceReorder()).toBeNull();
  });

  it("keeps pending WAL when replay persistence fails", async () => {
    clearPendingWorkspaceReorder();
    savePendingWorkspaceReorder({
      orderedWorkspaceIds: ["ws-2", "ws-1"],
      groupId: "group-1",
    });

    const workspaceById = new Map<string, WorkspaceInfo>([
      ["ws-1", makeWorkspace("ws-1")],
      ["ws-2", makeWorkspace("ws-2")],
    ]);
    const persist = vi.fn(async () => {
      throw new Error("persist failed");
    });

    const replayed = await replayPendingWorkspaceReorder(workspaceById, persist);

    expect(replayed).toBe(false);
    expect(loadPendingWorkspaceReorder()).toMatchObject({
      orderedWorkspaceIds: ["ws-2", "ws-1"],
      groupId: "group-1",
    });
  });

  it("stores null group id with stable serialized sentinel", () => {
    clearPendingWorkspaceReorder();
    savePendingWorkspaceReorder({
      orderedWorkspaceIds: ["ws-1", "ws-2"],
      groupId: null,
    });

    const raw = window.localStorage.getItem(__workspaceOrderRecoveryStorageKeyForTests());
    expect(raw).toContain("__codexmonitor_null_group_id__");
    expect(loadPendingWorkspaceReorder()?.groupId).toBeNull();
  });
});
