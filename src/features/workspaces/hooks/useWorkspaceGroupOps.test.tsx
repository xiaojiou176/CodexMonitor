// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { AppSettings, WorkspaceGroup, WorkspaceInfo } from "../../../types";
import { useWorkspaceGroupOps } from "./useWorkspaceGroupOps";

const baseGroups: WorkspaceGroup[] = [
  { id: "g1", name: "Alpha", sortOrder: 0, copiesFolder: null },
  { id: "g2", name: "Beta", sortOrder: 1, copiesFolder: null },
];

const baseSettings: AppSettings = {
  startupBehavior: "selection",
  showInDock: true,
  theme: "system",
  zoomLevel: 1,
  softWrapTerminalLines: true,
  autoExpandTools: true,
  archiveChatThreadsOlderThanDays: 30,
  cleanupWorktreesOlderThanDays: 14,
  autoPruneWorktrees: false,
  autoSnapshotWorktree: false,
  workspaceGroups: baseGroups,
};

const workspaceMain: WorkspaceInfo = {
  id: "ws-main",
  name: "Main",
  path: "/tmp/main",
  connected: true,
  kind: "main",
  settings: { sidebarCollapsed: false, groupId: "g1" },
};

const workspaceWorktree: WorkspaceInfo = {
  id: "ws-child",
  name: "Child",
  path: "/tmp/main/worktree",
  connected: true,
  kind: "worktree",
  parentId: "ws-main",
  settings: { sidebarCollapsed: false, groupId: "g1" },
};

describe("useWorkspaceGroupOps", () => {
  it("creates, renames, moves, deletes, and assigns groups", async () => {
    const onUpdateAppSettings = vi
      .fn()
      .mockResolvedValue(baseSettings)
      .mockResolvedValue(baseSettings)
      .mockResolvedValue(baseSettings)
      .mockResolvedValue(baseSettings);
    const updateWorkspaceSettings = vi.fn().mockResolvedValue(workspaceMain);
    const workspaceGroupById = new Map(baseGroups.map((group) => [group.id, group]));

    const { result } = renderHook(() =>
      useWorkspaceGroupOps({
        appSettings: baseSettings,
        onUpdateAppSettings,
        workspaceGroups: baseGroups,
        workspaceGroupById,
        workspaces: [workspaceMain, workspaceWorktree],
        updateWorkspaceSettings,
      }),
    );

    await expect(result.current.createWorkspaceGroup(" ")).rejects.toThrow(
      "Group name is required.",
    );
    await expect(result.current.createWorkspaceGroup("ungrouped")).rejects.toThrow(
      "\"Ungrouped\" is reserved.",
    );
    await expect(result.current.createWorkspaceGroup("Alpha")).rejects.toThrow(
      "Group name already exists.",
    );

    const created = await result.current.createWorkspaceGroup("Gamma");
    expect(created?.name).toBe("Gamma");

    await expect(result.current.renameWorkspaceGroup("g2", "Alpha")).rejects.toThrow(
      "Group name already exists.",
    );
    await result.current.renameWorkspaceGroup("g2", "Renamed");

    expect(await result.current.moveWorkspaceGroup("g1", "up")).toBeNull();
    await result.current.moveWorkspaceGroup("g1", "down");
    await result.current.deleteWorkspaceGroup("g1");
    await result.current.assignWorkspaceGroup("ws-main", "g2");
    await result.current.assignWorkspaceGroup("ws-main", "missing");

    expect(updateWorkspaceSettings).toHaveBeenCalledWith("ws-main", { groupId: null });
    expect(updateWorkspaceSettings).toHaveBeenCalledWith("ws-main", { groupId: "g2" });
    expect(updateWorkspaceSettings).toHaveBeenCalledWith("ws-main", { groupId: null });
    expect(onUpdateAppSettings).toHaveBeenCalled();
  });

  it("returns null no-op when app settings wiring is unavailable", async () => {
    const updateWorkspaceSettings = vi.fn();
    const { result } = renderHook(() =>
      useWorkspaceGroupOps({
        workspaceGroups: [],
        workspaceGroupById: new Map(),
        workspaces: [workspaceMain],
        updateWorkspaceSettings,
      }),
    );

    expect(await result.current.createWorkspaceGroup("Demo")).toBeNull();
    expect(await result.current.renameWorkspaceGroup("g1", "Demo")).toBeNull();
    expect(await result.current.moveWorkspaceGroup("g1", "down")).toBeNull();
    expect(await result.current.deleteWorkspaceGroup("g1")).toBeNull();
    expect(await result.current.assignWorkspaceGroup("ws-child", "g1")).toBeNull();
    expect(updateWorkspaceSettings).not.toHaveBeenCalled();
  });
});
