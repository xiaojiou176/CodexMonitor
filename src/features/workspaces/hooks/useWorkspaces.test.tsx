// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspaceInfo } from "../../../types";
import {
  addClone,
  addWorkspace,
  addWorkspaceFromGitUrl,
  addWorktree,
  connectWorkspace,
  isWorkspacePathDir,
  listWorkspaces,
  pickWorkspacePath,
  removeWorkspace,
  removeWorktree,
  renameWorktree,
  renameWorktreeUpstream,
  updateWorkspaceCodexBin,
  updateWorkspaceSettings,
} from "../../../services/tauri";
import { useWorkspaces } from "./useWorkspaces";

const pushErrorToastMock = vi.fn();

vi.mock("../../../services/tauri", () => ({
  listWorkspaces: vi.fn(),
  renameWorktree: vi.fn(),
  renameWorktreeUpstream: vi.fn(),
  addClone: vi.fn(),
  addWorkspaceFromGitUrl: vi.fn(),
  addWorkspace: vi.fn(),
  addWorktree: vi.fn(),
  connectWorkspace: vi.fn(),
  isWorkspacePathDir: vi.fn(),
  pickWorkspacePath: vi.fn(),
  removeWorkspace: vi.fn(),
  removeWorktree: vi.fn(),
  updateWorkspaceCodexBin: vi.fn(),
  updateWorkspaceSettings: vi.fn(),
}));

vi.mock("../../../services/toasts", () => ({
  pushErrorToast: (...args: unknown[]) => pushErrorToastMock(...args),
}));

const askMock = vi.fn();
const messageMock = vi.fn();

vi.mock("@tauri-apps/plugin-dialog", () => ({
  ask: (...args: unknown[]) => askMock(...args),
  message: (...args: unknown[]) => messageMock(...args),
}));

const worktree: WorkspaceInfo = {
  id: "wt-1",
  name: "feature/old",
  path: "/tmp/wt-1",
  connected: true,
  kind: "worktree",
  parentId: "parent-1",
  worktree: { branch: "feature/old" },
  settings: { sidebarCollapsed: false },
};

const workspaceOne: WorkspaceInfo = {
  id: "ws-1",
  name: "workspace-one",
  path: "/tmp/ws-1",
  connected: true,
  kind: "main",
  parentId: null,
  worktree: null,
  settings: { sidebarCollapsed: false, groupId: null },
};

const workspaceTwo: WorkspaceInfo = {
  id: "ws-2",
  name: "workspace-two",
  path: "/tmp/ws-2",
  connected: true,
  kind: "main",
  parentId: null,
  worktree: null,
  settings: { sidebarCollapsed: false, groupId: null },
};

const createAppSettings = (workspaceGroups: { id: string; name: string; sortOrder: number | null; copiesFolder: string | null }[] = []) =>
  ({
    onboardingDone: true,
    codexPath: null,
    startupLaunch: false,
    skipFolderConfirmations: false,
    hideMissingPathWarning: false,
    hiddenWorkspaceIds: [],
    showNotifications: true,
    firstLaunchDone: true,
    workspaceGroups,
    preferredTheme: "system",
    mcpServers: [],
    uiScale: "comfortable",
    activitySuggestionsEnabled: true,
    activitySuggestionsScope: "workspace",
    rootTerminalPathMode: "workspace",
    rootTerminalAbsolutePath: "",
  }) as const;

const flushMicrotaskQueue = () =>
  new Promise<void>((resolve) => {
    queueMicrotask(resolve);
  });

describe("useWorkspaces.renameWorktree", () => {
  beforeEach(() => {
    pushErrorToastMock.mockReset();
    askMock.mockReset();
    messageMock.mockReset();
  });
  it("optimistically updates and reconciles on success", async () => {
    const listWorkspacesMock = vi.mocked(listWorkspaces);
    const renameWorktreeMock = vi.mocked(renameWorktree);
    listWorkspacesMock.mockResolvedValue([worktree]);

    let resolveRename: (value: WorkspaceInfo) => void = () => {};
    const renamePromise = new Promise<WorkspaceInfo>((resolve) => {
      resolveRename = resolve;
    });
    renameWorktreeMock.mockReturnValue(renamePromise);

    const { result } = renderHook(() => useWorkspaces());

    await act(async () => {
      await flushMicrotaskQueue();
    });

    let renameCall: Promise<WorkspaceInfo>;
    act(() => {
      renameCall = result.current.renameWorktree("wt-1", "feature/new");
    });

    await act(async () => {
      await flushMicrotaskQueue();
    });

    expect(result.current.workspaces[0].name).toBe("feature/new");
    expect(result.current.workspaces[0].worktree?.branch).toBe("feature/new");

    resolveRename({
      ...worktree,
      name: "feature/new",
      path: "/tmp/wt-1-renamed",
      worktree: { branch: "feature/new" },
    });

    await act(async () => {
      await renameCall;
    });

    expect(result.current.workspaces[0].path).toBe("/tmp/wt-1-renamed");
  });

  it("rolls back optimistic update on failure", async () => {
    const listWorkspacesMock = vi.mocked(listWorkspaces);
    const renameWorktreeMock = vi.mocked(renameWorktree);
    listWorkspacesMock.mockResolvedValue([worktree]);
    let rejectRename: (error: Error) => void = () => {};
    const renamePromise = new Promise<WorkspaceInfo>((_, reject) => {
      rejectRename = reject;
    });
    renameWorktreeMock.mockReturnValue(renamePromise);

    const { result } = renderHook(() => useWorkspaces());

    await act(async () => {
      await flushMicrotaskQueue();
    });

    let renameCall: Promise<WorkspaceInfo>;
    act(() => {
      renameCall = result.current.renameWorktree("wt-1", "feature/new");
    });

    await act(async () => {
      await flushMicrotaskQueue();
    });

    expect(result.current.workspaces[0].name).toBe("feature/new");

    rejectRename(new Error("rename failed"));

    await act(async () => {
      try {
        await renameCall;
      } catch {
        // Expected rejection.
      }
    });

    expect(result.current.workspaces[0].name).toBe("feature/old");
    expect(result.current.workspaces[0].worktree?.branch).toBe("feature/old");
  });

  it("exposes upstream rename helper", async () => {
    const listWorkspacesMock = vi.mocked(listWorkspaces);
    const renameWorktreeUpstreamMock = vi.mocked(renameWorktreeUpstream);
    listWorkspacesMock.mockResolvedValue([worktree]);
    renameWorktreeUpstreamMock.mockResolvedValue(undefined);

    const { result } = renderHook(() => useWorkspaces());

    await act(async () => {
      await flushMicrotaskQueue();
    });

    await act(async () => {
      await result.current.renameWorktreeUpstream(
        "wt-1",
        "feature/old",
        "feature/new",
      );
    });

    expect(renameWorktreeUpstreamMock).toHaveBeenCalledWith(
      "wt-1",
      "feature/old",
      "feature/new",
    );
  });
});

describe("useWorkspaces.updateWorkspaceSettings", () => {
  beforeEach(() => {
    pushErrorToastMock.mockReset();
    askMock.mockReset();
    messageMock.mockReset();
  });

  it("does not throw when multiple updates are queued in the same tick", async () => {
    const listWorkspacesMock = vi.mocked(listWorkspaces);
    const updateWorkspaceSettingsMock = vi.mocked(updateWorkspaceSettings);
    listWorkspacesMock.mockResolvedValue([workspaceOne, workspaceTwo]);
    updateWorkspaceSettingsMock.mockImplementation(async (workspaceId, settings) => {
      const base = workspaceId === workspaceOne.id ? workspaceOne : workspaceTwo;
      return { ...base, settings };
    });

    const { result } = renderHook(() => useWorkspaces());

    await act(async () => {
      await flushMicrotaskQueue();
    });

    let updatePromise: Promise<WorkspaceInfo[]>;
    act(() => {
      updatePromise = Promise.all([
        result.current.updateWorkspaceSettings(workspaceOne.id, {
          sidebarCollapsed: true,
        }),
        result.current.updateWorkspaceSettings(workspaceTwo.id, {
          sidebarCollapsed: true,
        }),
      ]);
    });

    await act(async () => {
      await updatePromise;
    });

    expect(updateWorkspaceSettingsMock).toHaveBeenCalledTimes(2);
    expect(
      result.current.workspaces.find((entry) => entry.id === workspaceOne.id)
        ?.settings.sidebarCollapsed,
    ).toBeTruthy();
    expect(
      result.current.workspaces.find((entry) => entry.id === workspaceTwo.id)
        ?.settings.sidebarCollapsed,
    ).toBeTruthy();
  });

  it("rolls back optimistic settings when request fails", async () => {
    const listWorkspacesMock = vi.mocked(listWorkspaces);
    const updateWorkspaceSettingsMock = vi.mocked(updateWorkspaceSettings);
    listWorkspacesMock.mockResolvedValue([workspaceOne]);
    updateWorkspaceSettingsMock.mockRejectedValueOnce(
      new Error("settings failed"),
    );

    const { result } = renderHook(() => useWorkspaces());
    await act(async () => {
      await flushMicrotaskQueue();
    });

    await act(async () => {
      await expect(
        result.current.updateWorkspaceSettings(workspaceOne.id, {
          sidebarCollapsed: true,
        }),
      ).rejects.toThrow("settings failed");
    });

    expect(
      result.current.workspaces.find((entry) => entry.id === workspaceOne.id)
        ?.settings.sidebarCollapsed,
    ).toBeFalsy();
  });

  it("keeps the latest optimistic value when an older request fails", async () => {
    const listWorkspacesMock = vi.mocked(listWorkspaces);
    const updateWorkspaceSettingsMock = vi.mocked(updateWorkspaceSettings);
    listWorkspacesMock.mockResolvedValue([workspaceOne]);

    let rejectFirst: (error: Error) => void = () => {};
    let resolveSecond: (workspace: WorkspaceInfo) => void = () => {};
    const first = new Promise<WorkspaceInfo>((_, reject) => {
      rejectFirst = reject;
    });
    const second = new Promise<WorkspaceInfo>((resolve) => {
      resolveSecond = resolve;
    });

    updateWorkspaceSettingsMock
      .mockReturnValueOnce(first)
      .mockReturnValueOnce(second);

    const { result } = renderHook(() => useWorkspaces());
    await act(async () => {
      await flushMicrotaskQueue();
    });

    let firstCall: Promise<WorkspaceInfo>;
    let secondCall: Promise<WorkspaceInfo>;
    act(() => {
      firstCall = result.current.updateWorkspaceSettings(workspaceOne.id, {
        sidebarCollapsed: true,
      });
      secondCall = result.current.updateWorkspaceSettings(workspaceOne.id, {
        sidebarCollapsed: false,
        groupId: "group-2",
      });
    });

    await act(async () => {
      await flushMicrotaskQueue();
    });

    rejectFirst(new Error("first failed"));
    resolveSecond({
      ...workspaceOne,
      settings: { ...workspaceOne.settings, sidebarCollapsed: false, groupId: "group-2" },
    });

    await act(async () => {
      await Promise.allSettled([firstCall, secondCall]);
    });

    expect(
      result.current.workspaces.find((entry) => entry.id === workspaceOne.id)
        ?.settings.groupId,
    ).toBe("group-2");
    expect(
      result.current.workspaces.find((entry) => entry.id === workspaceOne.id)
        ?.settings.sidebarCollapsed,
    ).toBeFalsy();
  });

  it("throws when updating a workspace that does not exist", async () => {
    const listWorkspacesMock = vi.mocked(listWorkspaces);
    listWorkspacesMock.mockResolvedValue([workspaceOne]);

    const { result } = renderHook(() => useWorkspaces());
    await act(async () => {
      await flushMicrotaskQueue();
    });

    await act(async () => {
      await expect(
        result.current.updateWorkspaceSettings("missing-workspace", {
          sidebarCollapsed: true,
        }),
      ).rejects.toThrow("workspace not found");
    });
  });
});

describe("useWorkspaces.addWorkspaceFromPath", () => {
  beforeEach(() => {
    pushErrorToastMock.mockReset();
    askMock.mockReset();
    messageMock.mockReset();
  });

  it("adds a workspace and sets it active", async () => {
    const listWorkspacesMock = vi.mocked(listWorkspaces);
    const addWorkspaceMock = vi.mocked(addWorkspace);
    listWorkspacesMock.mockResolvedValue([]);
    addWorkspaceMock.mockResolvedValue({
      id: "workspace-1",
      name: "repo",
      path: "/tmp/repo",
      connected: true,
      kind: "main",
      parentId: null,
      worktree: null,
      settings: { sidebarCollapsed: false },
    });

    const { result } = renderHook(() => useWorkspaces());

    await act(async () => {
      await flushMicrotaskQueue();
    });

    await act(async () => {
      await result.current.addWorkspaceFromPath("/tmp/repo");
    });

    expect(addWorkspaceMock).toHaveBeenCalledWith("/tmp/repo", null);
    expect(result.current.workspaces).toHaveLength(1);
    expect(result.current.activeWorkspaceId).toBe("workspace-1");
  });

  it("returns null for blank paths and does not call backend", async () => {
    const listWorkspacesMock = vi.mocked(listWorkspaces);
    const addWorkspaceMock = vi.mocked(addWorkspace);
    addWorkspaceMock.mockClear();
    listWorkspacesMock.mockResolvedValue([]);

    const { result } = renderHook(() => useWorkspaces());
    await act(async () => {
      await flushMicrotaskQueue();
    });

    await act(async () => {
      await expect(result.current.addWorkspaceFromPath("   ")).resolves.toBeNull();
    });

    expect(addWorkspaceMock).not.toHaveBeenCalled();
  });
});

describe("useWorkspaces.loading", () => {
  beforeEach(() => {
    pushErrorToastMock.mockReset();
    askMock.mockReset();
    messageMock.mockReset();
  });

  it("surfaces bridge/runtime failures as visible errors instead of empty state", async () => {
    const listWorkspacesMock = vi.mocked(listWorkspaces);
    listWorkspacesMock.mockRejectedValueOnce(new Error("bridge unavailable"));

    const { result } = renderHook(() => useWorkspaces());

    await act(async () => {
      await flushMicrotaskQueue();
    });

    expect(result.current.hasLoaded).toBeTruthy();
    expect(pushErrorToastMock).toHaveBeenCalledWith({
      title: "加载工作区失败",
      message: "bridge unavailable",
    });
  });

  it("deduplicates refresh toasts when the same error repeats", async () => {
    const listWorkspacesMock = vi.mocked(listWorkspaces);
    listWorkspacesMock.mockRejectedValue(new Error("bridge unavailable"));

    const { result } = renderHook(() => useWorkspaces());
    await act(async () => {
      await flushMicrotaskQueue();
    });
    await act(async () => {
      await result.current.refreshWorkspaces();
    });
    await act(async () => {
      await result.current.refreshWorkspaces();
    });

    expect(pushErrorToastMock).toHaveBeenCalledTimes(1);
  });
});

describe("useWorkspaces.grouping and sorting", () => {
  beforeEach(() => {
    pushErrorToastMock.mockReset();
    askMock.mockReset();
    messageMock.mockReset();
  });

  it("sorts groups and grouped workspaces by sortOrder then name", async () => {
    const listWorkspacesMock = vi.mocked(listWorkspaces);
    const parent: WorkspaceInfo = {
      ...workspaceOne,
      id: "ws-parent",
      name: "parent",
      settings: { sidebarCollapsed: false, groupId: "g-2", sortOrder: 3 },
    };
    const groupedA: WorkspaceInfo = {
      ...workspaceTwo,
      id: "ws-group-a",
      name: "alpha",
      settings: { sidebarCollapsed: false, groupId: "g-2", sortOrder: 2 },
    };
    const groupedB: WorkspaceInfo = {
      ...workspaceTwo,
      id: "ws-group-b",
      name: "beta",
      settings: { sidebarCollapsed: false, groupId: "g-2", sortOrder: 1 },
    };
    const ungrouped: WorkspaceInfo = {
      ...workspaceTwo,
      id: "ws-ungrouped",
      name: "zeta",
      settings: { sidebarCollapsed: false, groupId: null, sortOrder: 0 },
    };
    const childWorktree: WorkspaceInfo = {
      ...worktree,
      id: "wt-child",
      name: "child-worktree",
      parentId: "ws-parent",
    };
    listWorkspacesMock.mockResolvedValue([parent, groupedA, groupedB, ungrouped, childWorktree]);

    const appSettings = {
      onboardingDone: true,
      codexPath: null,
      startupLaunch: false,
      skipFolderConfirmations: false,
      hideMissingPathWarning: false,
      hiddenWorkspaceIds: [],
      showNotifications: true,
      firstLaunchDone: true,
      workspaceGroups: [
        { id: "g-2", name: "Beta Group", sortOrder: 2, copiesFolder: null },
        { id: "g-1", name: "Alpha Group", sortOrder: 0, copiesFolder: null },
        { id: "g-fallback", name: "No Order", sortOrder: null, copiesFolder: null },
      ],
      preferredTheme: "system",
      mcpServers: [],
      uiScale: "comfortable",
      activitySuggestionsEnabled: true,
      activitySuggestionsScope: "workspace",
      rootTerminalPathMode: "workspace",
      rootTerminalAbsolutePath: "",
    } as const;

    const { result } = renderHook(() => useWorkspaces({ appSettings }));
    await act(async () => {
      await flushMicrotaskQueue();
    });

    expect(result.current.workspaceGroups.map((group) => group.id)).toEqual([
      "g-1",
      "g-2",
      "g-fallback",
    ]);
    expect(result.current.groupedWorkspaces.map((section) => section.name)).toEqual([
      "Beta Group",
      "未分组",
    ]);
    expect(result.current.groupedWorkspaces[0].workspaces.map((entry) => entry.id)).toEqual([
      "ws-group-b",
      "ws-group-a",
      "ws-parent",
    ]);
    expect(result.current.getWorkspaceGroupName("wt-child")).toBe("Beta Group");
    expect(result.current.getWorkspaceGroupName("unknown")).toBeNull();
  });
});

describe("useWorkspaces.remove flows", () => {
  beforeEach(() => {
    pushErrorToastMock.mockReset();
    askMock.mockReset();
    messageMock.mockReset();
  });

  it("removeWorkspace respects cancellation", async () => {
    const listWorkspacesMock = vi.mocked(listWorkspaces);
    const removeWorkspaceMock = vi.mocked(removeWorkspace);
    listWorkspacesMock.mockResolvedValue([workspaceOne, worktree]);
    askMock.mockResolvedValueOnce(false);

    const { result } = renderHook(() => useWorkspaces());
    await act(async () => {
      await flushMicrotaskQueue();
    });

    await act(async () => {
      await result.current.removeWorkspace(workspaceOne.id);
    });

    expect(removeWorkspaceMock).not.toHaveBeenCalled();
    expect(result.current.workspaces).toHaveLength(2);
  });

  it("removeWorkspace removes parent and child entries on confirm", async () => {
    const listWorkspacesMock = vi.mocked(listWorkspaces);
    const removeWorkspaceMock = vi.mocked(removeWorkspace);
    const child: WorkspaceInfo = { ...worktree, id: "wt-child", parentId: workspaceOne.id };
    listWorkspacesMock.mockResolvedValue([workspaceOne, child]);
    removeWorkspaceMock.mockResolvedValue(undefined);
    askMock.mockResolvedValueOnce(true);

    const { result } = renderHook(() => useWorkspaces());
    await act(async () => {
      await flushMicrotaskQueue();
    });
    act(() => {
      result.current.setActiveWorkspaceId("wt-child");
    });

    await act(async () => {
      await result.current.removeWorkspace(workspaceOne.id);
    });

    expect(removeWorkspaceMock).toHaveBeenCalledWith(workspaceOne.id);
    expect(result.current.workspaces).toHaveLength(0);
    expect(result.current.activeWorkspaceId).toBeNull();
  });

  it("removeWorkspace surfaces service failures", async () => {
    const listWorkspacesMock = vi.mocked(listWorkspaces);
    const removeWorkspaceMock = vi.mocked(removeWorkspace);
    listWorkspacesMock.mockResolvedValue([workspaceOne]);
    askMock.mockResolvedValueOnce(true);
    removeWorkspaceMock.mockRejectedValueOnce(new Error("remove failed"));

    const { result } = renderHook(() => useWorkspaces());
    await act(async () => {
      await flushMicrotaskQueue();
    });

    await act(async () => {
      await result.current.removeWorkspace(workspaceOne.id);
    });

    expect(messageMock).toHaveBeenCalledWith("remove failed", {
      title: "删除工作区失败",
      kind: "error",
    });
    expect(result.current.workspaces).toHaveLength(1);
  });

  it("removeWorktree toggles deleting state and clears it after failure", async () => {
    const listWorkspacesMock = vi.mocked(listWorkspaces);
    const removeWorktreeMock = vi.mocked(removeWorktree);
    listWorkspacesMock.mockResolvedValue([worktree]);
    askMock.mockResolvedValueOnce(true);

    let rejectRemoval: (error: Error) => void = () => {};
    removeWorktreeMock.mockReturnValue(
      new Promise<void>((_, reject) => {
        rejectRemoval = reject;
      }),
    );

    const { result } = renderHook(() => useWorkspaces());
    await act(async () => {
      await flushMicrotaskQueue();
    });

    let removeCall: Promise<void>;
    await act(async () => {
      removeCall = result.current.removeWorktree(worktree.id);
      await flushMicrotaskQueue();
    });
    expect(result.current.deletingWorktreeIds.has(worktree.id)).toBeTruthy();

    rejectRemoval(new Error("remove worktree failed"));
    await act(async () => {
      await removeCall;
    });

    expect(result.current.deletingWorktreeIds.has(worktree.id)).toBeFalsy();
    expect(messageMock).toHaveBeenCalledWith("remove worktree failed", {
      title: "删除工作树失败",
      kind: "error",
    });
  });
});

describe("useWorkspaces.connectWorkspace", () => {
  beforeEach(() => {
    pushErrorToastMock.mockReset();
    askMock.mockReset();
    messageMock.mockReset();
  });

  it("rethrows connection failures", async () => {
    const listWorkspacesMock = vi.mocked(listWorkspaces);
    const connectWorkspaceMock = vi.mocked(connectWorkspace);
    listWorkspacesMock.mockResolvedValue([workspaceOne]);
    connectWorkspaceMock.mockRejectedValueOnce(new Error("connect failed"));

    const { result } = renderHook(() => useWorkspaces());
    await act(async () => {
      await flushMicrotaskQueue();
    });

    await act(async () => {
      await expect(
        result.current.connectWorkspace(workspaceOne),
      ).rejects.toThrow("connect failed");
    });
  });
});

describe("useWorkspaces.add and filter helpers", () => {
  beforeEach(() => {
    pushErrorToastMock.mockReset();
    askMock.mockReset();
    messageMock.mockReset();
  });

  it("addWorkspace returns null when picker is canceled", async () => {
    const listWorkspacesMock = vi.mocked(listWorkspaces);
    const pickWorkspacePathMock = vi.mocked(pickWorkspacePath);
    const addWorkspaceMock = vi.mocked(addWorkspace);
    listWorkspacesMock.mockResolvedValue([]);
    pickWorkspacePathMock.mockResolvedValueOnce(null);

    const { result } = renderHook(() => useWorkspaces());
    await act(async () => {
      await flushMicrotaskQueue();
    });

    await act(async () => {
      await expect(result.current.addWorkspace()).resolves.toBeNull();
    });

    expect(addWorkspaceMock).not.toHaveBeenCalled();
  });

  it("addWorkspaceFromGitUrl trims input and respects activate=false", async () => {
    const listWorkspacesMock = vi.mocked(listWorkspaces);
    const addWorkspaceFromGitUrlMock = vi.mocked(addWorkspaceFromGitUrl);
    listWorkspacesMock.mockResolvedValue([workspaceOne]);
    addWorkspaceFromGitUrlMock.mockResolvedValue({
      ...workspaceTwo,
      id: "ws-from-url",
      path: "/tmp/from-url",
    });

    const { result } = renderHook(() => useWorkspaces());
    await act(async () => {
      await flushMicrotaskQueue();
    });

    await act(async () => {
      await result.current.addWorkspaceFromGitUrl(
        "  https://example.com/repo.git  ",
        "  /tmp/target  ",
        "  repo-name  ",
        { activate: false },
      );
    });

    expect(addWorkspaceFromGitUrlMock).toHaveBeenCalledWith(
      "https://example.com/repo.git",
      "/tmp/target",
      "repo-name",
      null,
    );
    expect(result.current.activeWorkspaceId).toBeNull();
    expect(result.current.workspaces.map((entry) => entry.id)).toContain("ws-from-url");
  });

  it("validates git-url inputs", async () => {
    const listWorkspacesMock = vi.mocked(listWorkspaces);
    listWorkspacesMock.mockResolvedValue([]);

    const { result } = renderHook(() => useWorkspaces());
    await act(async () => {
      await flushMicrotaskQueue();
    });

    await act(async () => {
      await expect(
        result.current.addWorkspaceFromGitUrl(" ", "/tmp/target"),
      ).rejects.toThrow("Remote Git URL is required.");
    });
    await act(async () => {
      await expect(
        result.current.addWorkspaceFromGitUrl("https://example.com/repo.git", " "),
      ).rejects.toThrow("Destination folder is required.");
    });
  });

  it("filterWorkspacePaths keeps only existing directories", async () => {
    const listWorkspacesMock = vi.mocked(listWorkspaces);
    const isWorkspacePathDirMock = vi.mocked(isWorkspacePathDir);
    listWorkspacesMock.mockResolvedValue([]);
    isWorkspacePathDirMock.mockImplementation(async (path) => path !== "/tmp/file");

    const { result } = renderHook(() => useWorkspaces());
    await act(async () => {
      await flushMicrotaskQueue();
    });

    await act(async () => {
      await expect(
        result.current.filterWorkspacePaths([" /tmp/one ", " ", "/tmp/file", "/tmp/two"]),
      ).resolves.toEqual(["/tmp/one", "/tmp/two"]);
    });
  });
});

describe("useWorkspaces.clone/worktree/codex bin helpers", () => {
  beforeEach(() => {
    pushErrorToastMock.mockReset();
    askMock.mockReset();
    messageMock.mockReset();
  });

  it("addWorktreeAgent supports branch validation and activate=false", async () => {
    const listWorkspacesMock = vi.mocked(listWorkspaces);
    const addWorktreeMock = vi.mocked(addWorktree);
    listWorkspacesMock.mockResolvedValue([workspaceOne]);
    addWorktreeMock.mockResolvedValue({
      ...worktree,
      id: "wt-activate-false",
      parentId: workspaceOne.id,
      name: "feature/new",
      worktree: { branch: "feature/new" },
    });

    const { result } = renderHook(() => useWorkspaces());
    await act(async () => {
      await flushMicrotaskQueue();
    });

    await act(async () => {
      await expect(
        result.current.addWorktreeAgent(workspaceOne, "   "),
      ).resolves.toBeNull();
    });

    await act(async () => {
      await result.current.addWorktreeAgent(workspaceOne, " feature/new ", {
        activate: false,
      });
    });

    expect(addWorktreeMock).toHaveBeenCalledWith(
      workspaceOne.id,
      "feature/new",
      null,
      true,
    );
    expect(result.current.activeWorkspaceId).toBeNull();
  });

  it("addCloneAgent validates input and sets active workspace on success", async () => {
    const listWorkspacesMock = vi.mocked(listWorkspaces);
    const addCloneMock = vi.mocked(addClone);
    listWorkspacesMock.mockResolvedValue([workspaceOne]);
    addCloneMock.mockResolvedValue({
      ...workspaceTwo,
      id: "clone-1",
      parentId: workspaceOne.id,
      name: "copy-one",
      path: "/tmp/copies/copy-one",
    });

    const { result } = renderHook(() => useWorkspaces());
    await act(async () => {
      await flushMicrotaskQueue();
    });

    await act(async () => {
      await expect(
        result.current.addCloneAgent(workspaceOne, "  ", "/tmp/copies"),
      ).resolves.toBeNull();
    });
    await act(async () => {
      await expect(
        result.current.addCloneAgent(workspaceOne, "copy-one", " "),
      ).rejects.toThrow("Copies folder is required.");
    });
    await act(async () => {
      await result.current.addCloneAgent(workspaceOne, " copy-one ", " /tmp/copies ");
    });

    expect(addCloneMock).toHaveBeenCalledWith(workspaceOne.id, "/tmp/copies", "copy-one");
    expect(result.current.activeWorkspaceId).toBe("clone-1");
  });

  it("updateWorkspaceCodexBin rolls back optimistic state on failure", async () => {
    const listWorkspacesMock = vi.mocked(listWorkspaces);
    const updateWorkspaceCodexBinMock = vi.mocked(updateWorkspaceCodexBin);
    listWorkspacesMock.mockResolvedValue([workspaceOne]);
    updateWorkspaceCodexBinMock.mockRejectedValueOnce(new Error("codex bin failed"));

    const { result } = renderHook(() => useWorkspaces());
    await act(async () => {
      await flushMicrotaskQueue();
    });

    await act(async () => {
      await expect(
        result.current.updateWorkspaceCodexBin(workspaceOne.id, "/usr/local/bin/codex"),
      ).rejects.toThrow("codex bin failed");
    });

    expect(
      result.current.workspaces.find((entry) => entry.id === workspaceOne.id)?.codex_bin ?? null,
    ).toBeNull();
  });
});

describe("useWorkspaces.workspace group operations", () => {
  beforeEach(() => {
    pushErrorToastMock.mockReset();
    askMock.mockReset();
    messageMock.mockReset();
  });

  it("creates, renames and moves groups with validation", async () => {
    const listWorkspacesMock = vi.mocked(listWorkspaces);
    listWorkspacesMock.mockResolvedValue([workspaceOne]);
    const onUpdateAppSettings = vi.fn().mockResolvedValue(createAppSettings());
    const appSettings = createAppSettings([
      { id: "group-1", name: "Alpha", sortOrder: 0, copiesFolder: null },
      { id: "group-2", name: "Beta", sortOrder: 1, copiesFolder: null },
    ]);

    const { result } = renderHook(() =>
      useWorkspaces({ appSettings, onUpdateAppSettings }),
    );
    await act(async () => {
      await flushMicrotaskQueue();
    });

    await act(async () => {
      await expect(result.current.createWorkspaceGroup("  ")).rejects.toThrow(
        "Group name is required.",
      );
    });
    await act(async () => {
      await expect(result.current.createWorkspaceGroup("未分组")).rejects.toThrow(
        "\"未分组\" is reserved.",
      );
    });
    await act(async () => {
      await expect(result.current.createWorkspaceGroup("alpha")).rejects.toThrow(
        "Group name already exists.",
      );
    });
    await act(async () => {
      await result.current.createWorkspaceGroup("Gamma");
    });
    await act(async () => {
      await expect(
        result.current.renameWorkspaceGroup("group-1", "beta"),
      ).rejects.toThrow("Group name already exists.");
    });
    await act(async () => {
      await result.current.renameWorkspaceGroup("group-1", "Alpha Renamed");
      await result.current.moveWorkspaceGroup("group-2", "up");
    });

    expect(onUpdateAppSettings).toHaveBeenCalled();
    const createCall = onUpdateAppSettings.mock.calls.find(
      (call) =>
        call[0].workspaceGroups.length === 3 &&
        call[0].workspaceGroups.some((group: { name: string }) => group.name === "Gamma"),
    );
    expect(createCall).toBeTruthy();
  });

  it("deleteWorkspaceGroup clears groupId and assignWorkspaceGroup handles invalid targets", async () => {
    const groupedWorkspace: WorkspaceInfo = {
      ...workspaceOne,
      settings: { ...workspaceOne.settings, groupId: "group-1" },
    };
    const worktreeChild: WorkspaceInfo = {
      ...worktree,
      id: "wt-grouped",
      parentId: groupedWorkspace.id,
    };
    const listWorkspacesMock = vi.mocked(listWorkspaces);
    const updateWorkspaceSettingsMock = vi.mocked(updateWorkspaceSettings);
    listWorkspacesMock.mockResolvedValue([groupedWorkspace, worktreeChild]);
    updateWorkspaceSettingsMock.mockImplementation(async (workspaceId, settings) => {
      const base = workspaceId === groupedWorkspace.id ? groupedWorkspace : worktreeChild;
      return { ...base, settings };
    });
    const onUpdateAppSettings = vi.fn().mockResolvedValue(createAppSettings());
    const appSettings = createAppSettings([
      { id: "group-1", name: "Alpha", sortOrder: 0, copiesFolder: null },
    ]);

    const { result } = renderHook(() =>
      useWorkspaces({ appSettings, onUpdateAppSettings }),
    );
    await act(async () => {
      await flushMicrotaskQueue();
    });

    await act(async () => {
      await result.current.deleteWorkspaceGroup("group-1");
    });
    await act(async () => {
      await expect(
        result.current.assignWorkspaceGroup(groupedWorkspace.id, "missing-group"),
      ).resolves.toBeTruthy();
    });
    await act(async () => {
      await expect(
        result.current.assignWorkspaceGroup(worktreeChild.id, "group-1"),
      ).resolves.toBeNull();
    });

    expect(updateWorkspaceSettingsMock).toHaveBeenCalledWith(groupedWorkspace.id, {
      groupId: null,
      sidebarCollapsed: false,
    });
    expect(onUpdateAppSettings).toHaveBeenCalled();
    expect(result.current.getWorkspaceGroupName(groupedWorkspace.id)).toBeNull();
  });
});
