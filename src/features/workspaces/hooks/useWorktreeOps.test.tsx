// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspaceInfo } from "../../../types";
import {
  addClone,
  addWorktree,
  removeWorktree,
  renameWorktree,
  renameWorktreeUpstream,
} from "../../../services/tauri";
import { useWorktreeOps } from "./useWorktreeOps";

vi.mock("../../../services/tauri", () => ({
  addClone: vi.fn(),
  addWorktree: vi.fn(),
  removeWorktree: vi.fn(),
  renameWorktree: vi.fn(),
  renameWorktreeUpstream: vi.fn(),
}));

const { sentryCountMock } = vi.hoisted(() => ({
  sentryCountMock: vi.fn(),
}));
vi.mock("@sentry/react", () => ({
  default: {
    metrics: {
      count: sentryCountMock,
    },
  },
  metrics: {
    count: sentryCountMock,
  },
}));

const parentWorkspace: WorkspaceInfo = {
  id: "ws-parent",
  name: "Parent",
  path: "/tmp/repo",
  connected: true,
  kind: "main",
  settings: { sidebarCollapsed: false },
};

describe("useWorktreeOps", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("adds worktrees/clones and tracks metrics", async () => {
    let workspacesState: WorkspaceInfo[] = [parentWorkspace];
    let activeWorkspaceId: string | null = null;
    const setWorkspaces = vi.fn((next) => {
      workspacesState =
        typeof next === "function" ? next(workspacesState) : (next as WorkspaceInfo[]);
    });
    const setActiveWorkspaceId = vi.fn((next) => {
      activeWorkspaceId =
        typeof next === "function" ? next(activeWorkspaceId) : (next as string | null);
    });
    const worktreeWorkspace: WorkspaceInfo = {
      id: "wt-1",
      name: "feature-1",
      path: "/tmp/repo-worktrees/feature-1",
      connected: true,
      kind: "worktree",
      parentId: parentWorkspace.id,
      settings: { sidebarCollapsed: false },
      worktree: { branch: "feature-1" },
    };
    const cloneWorkspace: WorkspaceInfo = {
      id: "clone-1",
      name: "clone-one",
      path: "/tmp/clones/clone-one",
      connected: true,
      kind: "main",
      parentId: parentWorkspace.id,
      settings: { sidebarCollapsed: false },
    };
    vi.mocked(addWorktree).mockResolvedValue(worktreeWorkspace);
    vi.mocked(addClone).mockResolvedValue(cloneWorkspace);

    const { result } = renderHook(() =>
      useWorktreeOps({ setWorkspaces, setActiveWorkspaceId }),
    );

    expect(await result.current.addWorktreeAgent(parentWorkspace, "   ")).toBeNull();
    const created = await result.current.addWorktreeAgent(parentWorkspace, " feature-1 ");
    expect(created?.id).toBe("wt-1");
    expect(workspacesState.map((entry) => entry.id)).toContain("wt-1");
    expect(activeWorkspaceId).toBe("wt-1");

    const cloned = await result.current.addCloneAgent(
      parentWorkspace,
      " clone-one ",
      "/tmp/clones",
    );
    expect(cloned?.id).toBe("clone-1");
    expect(activeWorkspaceId).toBe("clone-1");

    expect(sentryCountMock).toHaveBeenCalledWith("worktree_agent_created", 1, {
      attributes: {
        workspace_id: "wt-1",
        parent_id: "ws-parent",
      },
    });
    expect(sentryCountMock).toHaveBeenCalledWith("clone_agent_created", 1, {
      attributes: {
        workspace_id: "clone-1",
        parent_id: "ws-parent",
      },
    });
  });

  it("removes and renames worktrees with rollback on failure", async () => {
    const existingWorktree: WorkspaceInfo = {
      id: "wt-2",
      name: "before",
      path: "/tmp/repo-worktrees/wt-2",
      connected: true,
      kind: "worktree",
      parentId: parentWorkspace.id,
      settings: { sidebarCollapsed: false },
      worktree: { branch: "before" },
    };
    let workspacesState: WorkspaceInfo[] = [parentWorkspace, existingWorktree];
    let activeWorkspaceId: string | null = existingWorktree.id;
    const setWorkspaces = vi.fn((next) => {
      workspacesState =
        typeof next === "function" ? next(workspacesState) : (next as WorkspaceInfo[]);
    });
    const setActiveWorkspaceId = vi.fn((next) => {
      activeWorkspaceId =
        typeof next === "function" ? next(activeWorkspaceId) : (next as string | null);
    });
    vi.mocked(renameWorktree).mockRejectedValueOnce(new Error("rename failed"));
    vi.mocked(renameWorktree).mockResolvedValueOnce({
      ...existingWorktree,
      name: "after",
      worktree: { branch: "after" },
    });
    vi.mocked(removeWorktree).mockResolvedValue(undefined);
    vi.mocked(renameWorktreeUpstream).mockResolvedValue(undefined);

    const { result } = renderHook(() =>
      useWorktreeOps({ setWorkspaces, setActiveWorkspaceId }),
    );

    await expect(result.current.renameWorktree(existingWorktree.id, "after")).rejects.toThrow(
      "rename failed",
    );
    expect(workspacesState.find((entry) => entry.id === existingWorktree.id)?.name).toBe(
      "before",
    );

    const renamed = await result.current.renameWorktree(existingWorktree.id, "after");
    expect(renamed.name).toBe("after");
    expect(workspacesState.find((entry) => entry.id === existingWorktree.id)?.name).toBe(
      "after",
    );

    await result.current.renameWorktreeUpstream(existingWorktree.id, "before", "after");
    expect(renameWorktreeUpstream).toHaveBeenCalledWith(existingWorktree.id, "before", "after");

    await act(async () => {
      await result.current.removeWorktree(existingWorktree.id);
    });
    expect(result.current.deletingWorktreeIds.has(existingWorktree.id)).toBe(false);
    expect(workspacesState.map((entry) => entry.id)).not.toContain(existingWorktree.id);
    expect(activeWorkspaceId).toBeNull();
  });

  it("validates clone destination and clears deleting ids even when remove fails", async () => {
    let workspacesState: WorkspaceInfo[] = [parentWorkspace];
    let activeWorkspaceId: string | null = null;
    const setWorkspaces = vi.fn((next) => {
      workspacesState =
        typeof next === "function" ? next(workspacesState) : (next as WorkspaceInfo[]);
    });
    const setActiveWorkspaceId = vi.fn((next) => {
      activeWorkspaceId =
        typeof next === "function" ? next(activeWorkspaceId) : (next as string | null);
    });
    vi.mocked(removeWorktree).mockRejectedValue(new Error("cannot remove"));

    const { result } = renderHook(() =>
      useWorktreeOps({ setWorkspaces, setActiveWorkspaceId }),
    );

    expect(await result.current.addCloneAgent(parentWorkspace, "   ", "/tmp/clones")).toBeNull();
    await expect(result.current.addCloneAgent(parentWorkspace, "clone", " ")).rejects.toThrow(
      "Copies folder is required.",
    );

    await expect(
      act(async () => {
        await result.current.removeWorktree(parentWorkspace.id);
      }),
    ).rejects.toThrow("cannot remove");
    expect(result.current.deletingWorktreeIds.has(parentWorkspace.id)).toBe(false);
    expect(workspacesState).toHaveLength(1);
    expect(activeWorkspaceId).toBeNull();
  });
});
