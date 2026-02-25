/* @vitest-environment jsdom */
import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { WorkspaceInfo } from "../../../types";
import { useWorkspaceRestore } from "./useWorkspaceRestore";

const disconnectedWorkspace: WorkspaceInfo = {
  id: "ws-restore",
  name: "Restore Workspace",
  path: "/tmp/ws-restore",
  connected: false,
  settings: { sidebarCollapsed: false },
};

describe("useWorkspaceRestore", () => {
  it("calls refreshThreadRuntime after connect/list in remote mode when preferredThreadId exists", async () => {
    const connectWorkspace = vi.fn().mockResolvedValue(undefined);
    const listThreadsForWorkspace = vi.fn().mockResolvedValue(undefined);
    const resolvePreferredThreadId = vi.fn().mockReturnValue("thread-1");
    const refreshThreadRuntime = vi.fn().mockResolvedValue(undefined);
    const options: Parameters<typeof useWorkspaceRestore>[0] = {
      workspaces: [disconnectedWorkspace],
      hasLoaded: true,
      backendMode: "remote",
      activeWorkspaceId: "ws-restore",
      activeThreadId: "active-thread",
      connectWorkspace,
      listThreadsForWorkspace,
      resolvePreferredThreadId,
      refreshThreadRuntime,
    };

    renderHook(() => useWorkspaceRestore(options));

    await waitFor(() => {
      expect(connectWorkspace).toHaveBeenCalledTimes(1);
      expect(listThreadsForWorkspace).toHaveBeenCalledTimes(1);
      expect(refreshThreadRuntime).toHaveBeenCalledTimes(1);
    });

    expect(connectWorkspace).toHaveBeenCalledWith(disconnectedWorkspace);
    expect(listThreadsForWorkspace).toHaveBeenCalledWith(disconnectedWorkspace, {
      preserveState: true,
    });
    expect(resolvePreferredThreadId).toHaveBeenCalledWith({
      workspaceId: disconnectedWorkspace.id,
      activeWorkspaceId: "ws-restore",
      activeThreadId: "active-thread",
    });
    expect(refreshThreadRuntime).toHaveBeenCalledWith(
      disconnectedWorkspace.id,
      "thread-1",
    );
    expect(connectWorkspace.mock.invocationCallOrder[0]).toBeLessThan(
      listThreadsForWorkspace.mock.invocationCallOrder[0],
    );
    expect(listThreadsForWorkspace.mock.invocationCallOrder[0]).toBeLessThan(
      refreshThreadRuntime.mock.invocationCallOrder[0],
    );
  });

  it("does not call refreshThreadRuntime when preferredThreadId is missing", async () => {
    const connectWorkspace = vi.fn().mockResolvedValue(undefined);
    const listThreadsForWorkspace = vi.fn().mockResolvedValue(undefined);
    const resolvePreferredThreadId = vi.fn().mockReturnValue(null);
    const refreshThreadRuntime = vi.fn().mockResolvedValue(undefined);
    const options: Parameters<typeof useWorkspaceRestore>[0] = {
      workspaces: [disconnectedWorkspace],
      hasLoaded: true,
      backendMode: "remote",
      activeWorkspaceId: "ws-restore",
      activeThreadId: "active-thread",
      connectWorkspace,
      listThreadsForWorkspace,
      resolvePreferredThreadId,
      refreshThreadRuntime,
    };

    renderHook(() => useWorkspaceRestore(options));

    await waitFor(() => {
      expect(connectWorkspace).toHaveBeenCalledTimes(1);
      expect(listThreadsForWorkspace).toHaveBeenCalledTimes(1);
    });

    expect(resolvePreferredThreadId).toHaveBeenCalledWith({
      workspaceId: disconnectedWorkspace.id,
      activeWorkspaceId: "ws-restore",
      activeThreadId: "active-thread",
    });
    expect(listThreadsForWorkspace).toHaveBeenCalledWith(disconnectedWorkspace, {
      preserveState: true,
    });
    expect(refreshThreadRuntime).not.toHaveBeenCalled();
  });

  it("preserves thread list state on restore even in local mode", async () => {
    const connectWorkspace = vi.fn().mockResolvedValue(undefined);
    const listThreadsForWorkspace = vi.fn().mockResolvedValue(undefined);
    const options: Parameters<typeof useWorkspaceRestore>[0] = {
      workspaces: [disconnectedWorkspace],
      hasLoaded: true,
      backendMode: "local",
      activeWorkspaceId: "ws-restore",
      activeThreadId: "active-thread",
      connectWorkspace,
      listThreadsForWorkspace,
    };

    renderHook(() => useWorkspaceRestore(options));

    await waitFor(() => {
      expect(connectWorkspace).toHaveBeenCalledTimes(1);
      expect(listThreadsForWorkspace).toHaveBeenCalledTimes(1);
    });

    expect(listThreadsForWorkspace).toHaveBeenCalledWith(disconnectedWorkspace, {
      preserveState: true,
    });
  });
});
