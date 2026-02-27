// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { listGitBranches } from "../../../services/tauri";
import type { WorkspaceInfo } from "../../../types";
import { useGitBranches } from "./useGitBranches";

vi.mock("../../../services/tauri", () => ({
  listGitBranches: vi.fn(),
  checkoutGitBranch: vi.fn(),
  createGitBranch: vi.fn(),
}));

const workspace: WorkspaceInfo = {
  id: "workspace-1",
  name: "CodexMonitor",
  path: "/tmp/codex",
  connected: true,
  settings: { sidebarCollapsed: false },
};

const disconnectedWorkspace: WorkspaceInfo = {
  ...workspace,
  id: "workspace-disconnected",
  connected: false,
};

const flushMicrotaskQueue = () =>
  new Promise<void>((resolve) => {
    queueMicrotask(resolve);
  });

describe("useGitBranches", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("loads branches and returns recent branches sorted by last commit", async () => {
    vi.mocked(listGitBranches).mockResolvedValueOnce({
      branches: [
        { name: "main", lastCommit: 10 },
        { name: "", lastCommit: 999 },
        { name: "feature/login", last_commit: 20 },
      ],
    });

    const { result } = renderHook(() =>
      useGitBranches({ activeWorkspace: workspace }),
    );

    await act(async () => {
      await flushMicrotaskQueue();
    });

    expect(listGitBranches).toHaveBeenCalledWith(workspace.id);
    expect(result.current.branches).toEqual([
      { name: "feature/login", lastCommit: 20 },
      { name: "main", lastCommit: 10 },
    ]);
    expect(result.current.error).toBeNull();
  });

  it("reads branch list from nested result payload", async () => {
    vi.mocked(listGitBranches).mockResolvedValueOnce({
      result: {
        branches: [
          { name: "release", lastCommit: 1 },
          { name: "dev", lastCommit: 2 },
        ],
      },
    });

    const { result } = renderHook(() =>
      useGitBranches({ activeWorkspace: workspace }),
    );

    await act(async () => {
      await flushMicrotaskQueue();
    });

    expect(result.current.branches).toEqual([
      { name: "dev", lastCommit: 2 },
      { name: "release", lastCommit: 1 },
    ]);
  });

  it("does not fetch when workspace is disconnected and keeps branches empty", async () => {
    const { result } = renderHook(() =>
      useGitBranches({ activeWorkspace: disconnectedWorkspace }),
    );

    await act(async () => {
      await result.current.refreshBranches();
      await flushMicrotaskQueue();
    });

    expect(listGitBranches).not.toHaveBeenCalled();
    expect(result.current.branches).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it("stores error when branch list request fails", async () => {
    vi.mocked(listGitBranches).mockRejectedValueOnce(new Error("list failed"));

    const { result } = renderHook(() =>
      useGitBranches({ activeWorkspace: workspace }),
    );

    await act(async () => {
      await flushMicrotaskQueue();
    });

    expect(result.current.branches).toEqual([]);
    expect(result.current.error).toBe("list failed");
  });
});
