// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspaceInfo, WorkspaceSettings } from "../../../types";
import {
  addWorkspace,
  addWorkspaceFromGitUrl,
  connectWorkspace,
  isWorkspacePathDir,
  listWorkspaces,
  removeWorkspace,
  updateWorkspaceSettings,
} from "../../../services/tauri";
import { useWorkspaceCrud } from "./useWorkspaceCrud";

vi.mock("../../../services/tauri", () => ({
  addWorkspace: vi.fn(),
  addWorkspaceFromGitUrl: vi.fn(),
  connectWorkspace: vi.fn(),
  isWorkspacePathDir: vi.fn(),
  listWorkspaces: vi.fn(),
  removeWorkspace: vi.fn(),
  updateWorkspaceSettings: vi.fn(),
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

const workspaceA: WorkspaceInfo = {
  id: "ws-a",
  name: "A",
  path: "/tmp/a",
  connected: false,
  kind: "main",
  settings: { sidebarCollapsed: false },
};

const workspaceB: WorkspaceInfo = {
  id: "ws-b",
  name: "B",
  path: "/tmp/b",
  connected: false,
  kind: "main",
  settings: { sidebarCollapsed: false },
};

describe("useWorkspaceCrud", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("refreshes workspaces and clears stale active id", async () => {
    const setHasLoaded = vi.fn();
    let workspacesState: WorkspaceInfo[] = [workspaceA];
    let activeWorkspaceId: string | null = "missing";
    const setWorkspaces = vi.fn((next) => {
      workspacesState =
        typeof next === "function" ? next(workspacesState) : (next as WorkspaceInfo[]);
    });
    const setActiveWorkspaceId = vi.fn((next) => {
      activeWorkspaceId =
        typeof next === "function" ? next(activeWorkspaceId) : (next as string | null);
    });
    vi.mocked(listWorkspaces).mockResolvedValue([workspaceB]);

    const { result } = renderHook(() =>
      useWorkspaceCrud({
        workspaces: workspacesState,
        setWorkspaces,
        setActiveWorkspaceId,
        workspaceSettingsRef: { current: new Map<string, WorkspaceSettings>() },
        setHasLoaded,
      }),
    );

    const entries = await result.current.refreshWorkspaces();
    expect(entries).toEqual([workspaceB]);
    expect(workspacesState).toEqual([workspaceB]);
    expect(activeWorkspaceId).toBeNull();
    expect(setHasLoaded).toHaveBeenCalledWith(true);
  });

  it("adds workspace from path, emits metrics, and supports bulk add decisions", async () => {
    const onDebug = vi.fn();
    let workspacesState: WorkspaceInfo[] = [workspaceA];
    let activeWorkspaceId: string | null = null;
    const setWorkspaces = vi.fn((next) => {
      workspacesState =
        typeof next === "function" ? next(workspacesState) : (next as WorkspaceInfo[]);
    });
    const setActiveWorkspaceId = vi.fn((next) => {
      activeWorkspaceId =
        typeof next === "function" ? next(activeWorkspaceId) : (next as string | null);
    });
    const setHasLoaded = vi.fn();
    const workspaceC: WorkspaceInfo = {
      id: "ws-c",
      name: "C",
      path: "/tmp/c",
      connected: false,
      kind: "main",
      settings: { sidebarCollapsed: false },
    };
    vi.mocked(addWorkspace).mockResolvedValue(workspaceC);
    vi.mocked(isWorkspacePathDir).mockImplementation(async (path) => path.includes("/tmp/"));

    const { result, rerender } = renderHook(
      (props: { workspaces: WorkspaceInfo[] }) =>
        useWorkspaceCrud({
          onDebug,
          workspaces: props.workspaces,
          setWorkspaces,
          setActiveWorkspaceId,
          workspaceSettingsRef: { current: new Map<string, WorkspaceSettings>() },
          setHasLoaded,
        }),
      { initialProps: { workspaces: workspacesState } },
    );

    const added = await result.current.addWorkspaceFromPath("  /tmp/c  ");
    expect(added?.id).toBe("ws-c");
    expect(activeWorkspaceId).toBe("ws-c");
    expect(sentryCountMock).toHaveBeenCalledWith("workspace_added", 1, {
      attributes: { workspace_id: "ws-c", workspace_kind: "main" },
    });

    rerender({ workspaces: workspacesState });
    const bulk = await result.current.addWorkspacesFromPaths([
      "/tmp/a",
      "/tmp/c",
      "/tmp/new-one",
      "/not-dir",
      "/tmp/new-one",
    ]);
    expect(bulk.skippedExisting).toContain("/tmp/a");
    expect(bulk.skippedExisting).toContain("/tmp/c");
    expect(bulk.skippedInvalid).toContain("/not-dir");
    expect(bulk.added).toHaveLength(1);
    expect(bulk.firstAdded?.id).toBe("ws-c");
    expect(onDebug).toHaveBeenCalled();
  });

  it("handles connect/update/remove flows including optimistic rollback", async () => {
    const onDebug = vi.fn();
    const childWorkspace: WorkspaceInfo = {
      id: "ws-child",
      name: "Child",
      path: "/tmp/child",
      connected: false,
      kind: "worktree",
      parentId: workspaceA.id,
      settings: { sidebarCollapsed: false },
    };
    let workspacesState: WorkspaceInfo[] = [workspaceA, childWorkspace];
    let activeWorkspaceId: string | null = childWorkspace.id;
    const workspaceSettingsRef = {
      current: new Map<string, WorkspaceSettings>([
        [workspaceA.id, { sidebarCollapsed: false }],
      ]),
    };
    const setWorkspaces = vi.fn((next) => {
      workspacesState =
        typeof next === "function" ? next(workspacesState) : (next as WorkspaceInfo[]);
    });
    const setActiveWorkspaceId = vi.fn((next) => {
      activeWorkspaceId =
        typeof next === "function" ? next(activeWorkspaceId) : (next as string | null);
    });
    const setHasLoaded = vi.fn();
    vi.mocked(connectWorkspace).mockResolvedValue(undefined);
    vi.mocked(updateWorkspaceSettings).mockRejectedValueOnce(new Error("save failed"));
    vi.mocked(updateWorkspaceSettings).mockResolvedValueOnce({
      ...workspaceA,
      settings: { sidebarCollapsed: true },
    });
    vi.mocked(removeWorkspace).mockResolvedValue(undefined);

    const { result } = renderHook(() =>
      useWorkspaceCrud({
        onDebug,
        workspaces: workspacesState,
        setWorkspaces,
        setActiveWorkspaceId,
        workspaceSettingsRef,
        setHasLoaded,
      }),
    );

    await result.current.connectWorkspace(workspaceA);
    expect(workspacesState.find((entry) => entry.id === workspaceA.id)?.connected).toBe(true);

    await expect(
      result.current.updateWorkspaceSettings(workspaceA.id, { sidebarCollapsed: true }),
    ).rejects.toThrow("save failed");
    expect(
      workspacesState.find((entry) => entry.id === workspaceA.id)?.settings.sidebarCollapsed,
    ).toBe(false);

    const updated = await result.current.updateWorkspaceSettings(workspaceA.id, {
      sidebarCollapsed: true,
    });
    expect(updated.settings.sidebarCollapsed).toBe(true);
    expect(
      workspacesState.find((entry) => entry.id === workspaceA.id)?.settings.sidebarCollapsed,
    ).toBe(true);

    await result.current.removeWorkspace(workspaceA.id);
    expect(workspacesState).toEqual([]);
    expect(activeWorkspaceId).toBeNull();
    expect(onDebug).toHaveBeenCalled();
  });

  it("validates git-url inputs and reports refresh failure as undefined", async () => {
    const setHasLoaded = vi.fn();
    let workspacesState: WorkspaceInfo[] = [];
    const setWorkspaces = vi.fn((next) => {
      workspacesState =
        typeof next === "function" ? next(workspacesState) : (next as WorkspaceInfo[]);
    });
    let activeWorkspaceId: string | null = null;
    const setActiveWorkspaceId = vi.fn((next) => {
      activeWorkspaceId =
        typeof next === "function" ? next(activeWorkspaceId) : (next as string | null);
    });
    vi.mocked(listWorkspaces).mockRejectedValueOnce(new Error("boom"));
    vi.mocked(addWorkspaceFromGitUrl).mockResolvedValue(workspaceB);

    const { result } = renderHook(() =>
      useWorkspaceCrud({
        workspaces: workspacesState,
        setWorkspaces,
        setActiveWorkspaceId,
        workspaceSettingsRef: { current: new Map<string, WorkspaceSettings>() },
        setHasLoaded,
      }),
    );

    expect(await result.current.refreshWorkspaces()).toBeUndefined();
    await expect(
      result.current.addWorkspaceFromGitUrl(" ", "/tmp/dest"),
    ).rejects.toThrow("Remote Git URL is required.");
    await expect(
      result.current.addWorkspaceFromGitUrl("https://github.com/x/y.git", " "),
    ).rejects.toThrow("Destination folder is required.");

    const added = await result.current.addWorkspaceFromGitUrl(
      "https://github.com/x/y.git",
      "/tmp/dest",
      "folder",
      { activate: false },
    );
    expect(added?.id).toBe("ws-b");
    expect(activeWorkspaceId).toBeNull();
    expect(setHasLoaded).toHaveBeenCalledWith(true);
  });
});
