// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppSettings, WorkspaceInfo } from "../../../types";
import { useWorkspaceController } from "./useWorkspaceController";

const useWorkspacesMock = vi.fn();
const useWorkspaceDialogsMock = vi.fn();
const useWorkspaceFromUrlPromptMock = vi.fn();

vi.mock("../../workspaces/hooks/useWorkspaces", () => ({
  useWorkspaces: (options: unknown) => useWorkspacesMock(options),
}));

vi.mock("./useWorkspaceDialogs", () => ({
  useWorkspaceDialogs: () => useWorkspaceDialogsMock(),
}));

vi.mock("../../workspaces/hooks/useWorkspaceFromUrlPrompt", () => ({
  useWorkspaceFromUrlPrompt: (options: unknown) => useWorkspaceFromUrlPromptMock(options),
}));

function buildAppSettings(overrides: Partial<AppSettings> = {}): AppSettings {
  return {
    codexBin: null,
    backendMode: "local",
    ...overrides,
  } as AppSettings;
}

function buildWorkspace(id: string, name: string): WorkspaceInfo {
  return {
    id,
    name,
    path: `/tmp/${id}`,
    connected: true,
    settings: {
      sidebarCollapsed: false,
    },
  };
}

function buildWorkspaceCore(overrides: Record<string, unknown> = {}) {
  return {
    workspaces: [buildWorkspace("ws-1", "Workspace 1")],
    addWorkspaceFromGitUrl: vi.fn(async () => undefined),
    addWorkspaceFromPath: vi.fn(async () => null),
    filterWorkspacePaths: vi.fn(async () => []),
    removeWorkspace: vi.fn(async () => undefined),
    removeWorktree: vi.fn(async () => undefined),
    coreMarker: "from-core",
    ...overrides,
  };
}

function buildDialogs(overrides: Record<string, unknown> = {}) {
  return {
    requestWorkspacePaths: vi.fn(async () => []),
    mobileRemoteWorkspacePathPrompt: null,
    updateMobileRemoteWorkspacePathInput: vi.fn(),
    cancelMobileRemoteWorkspacePathPrompt: vi.fn(),
    submitMobileRemoteWorkspacePathPrompt: vi.fn(),
    showAddWorkspacesResult: vi.fn(async () => undefined),
    confirmWorkspaceRemoval: vi.fn(async () => true),
    confirmWorktreeRemoval: vi.fn(async () => true),
    showWorkspaceRemovalError: vi.fn(async () => undefined),
    showWorktreeRemovalError: vi.fn(async () => undefined),
    ...overrides,
  };
}

function buildWorkspaceFromUrlPrompt(overrides: Record<string, unknown> = {}) {
  return {
    workspaceFromUrlPrompt: null,
    openWorkspaceFromUrlPrompt: vi.fn(),
    closeWorkspaceFromUrlPrompt: vi.fn(),
    chooseWorkspaceFromUrlDestinationPath: vi.fn(async () => undefined),
    submitWorkspaceFromUrlPrompt: vi.fn(async () => undefined),
    updateWorkspaceFromUrlUrl: vi.fn(),
    updateWorkspaceFromUrlTargetFolderName: vi.fn(),
    clearWorkspaceFromUrlDestinationPath: vi.fn(),
    canSubmitWorkspaceFromUrlPrompt: false,
    ...overrides,
  };
}

describe("useWorkspaceController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("wires dependencies and exposes pass-through fields", () => {
    const workspaceCore = buildWorkspaceCore();
    const dialogs = buildDialogs();
    const fromUrlPrompt = buildWorkspaceFromUrlPrompt({
      canSubmitWorkspaceFromUrlPrompt: true,
    });

    useWorkspacesMock.mockReturnValue(workspaceCore);
    useWorkspaceDialogsMock.mockReturnValue(dialogs);
    useWorkspaceFromUrlPromptMock.mockReturnValue(fromUrlPrompt);

    const addDebugEntry = vi.fn();
    const queueSaveSettings = vi.fn(async (next: AppSettings) => next);
    const appSettings = buildAppSettings({ codexBin: "/usr/local/bin/codex" });

    const { result } = renderHook(() =>
      useWorkspaceController({
        appSettings,
        addDebugEntry,
        queueSaveSettings,
      }),
    );

    expect(useWorkspacesMock).toHaveBeenCalledWith({
      onDebug: addDebugEntry,
      defaultCodexBin: "/usr/local/bin/codex",
      appSettings,
      onUpdateAppSettings: queueSaveSettings,
    });
    expect(useWorkspaceFromUrlPromptMock).toHaveBeenCalledTimes(1);
    expect(result.current.coreMarker).toBe("from-core");
    expect(result.current.canSubmitWorkspaceFromUrlPrompt).toBe(true);
  });

  it("adds workspace from picker result and respects empty selection", async () => {
    const workspaceCore = buildWorkspaceCore();
    const dialogs = buildDialogs({
      requestWorkspacePaths: vi
        .fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(["/tmp/new-ws"]),
    });
    useWorkspacesMock.mockReturnValue(workspaceCore);
    useWorkspaceDialogsMock.mockReturnValue(dialogs);
    useWorkspaceFromUrlPromptMock.mockReturnValue(buildWorkspaceFromUrlPrompt());

    const { result } = renderHook(() =>
      useWorkspaceController({
        appSettings: buildAppSettings({ backendMode: "remote" }),
        addDebugEntry: vi.fn(),
        queueSaveSettings: vi.fn(async (next: AppSettings) => next),
      }),
    );

    await expect(result.current.addWorkspace()).resolves.toBeNull();
    expect(dialogs.requestWorkspacePaths).toHaveBeenCalledWith("remote");
    expect(workspaceCore.filterWorkspacePaths).not.toHaveBeenCalled();

    const addedWorkspace = buildWorkspace("ws-2", "Workspace 2");
    (workspaceCore.filterWorkspacePaths as ReturnType<typeof vi.fn>).mockResolvedValue([
      "/tmp/new-ws",
    ]);
    (workspaceCore.addWorkspaceFromPath as ReturnType<typeof vi.fn>).mockResolvedValue(
      addedWorkspace,
    );

    await expect(result.current.addWorkspace()).resolves.toEqual(addedWorkspace);
    expect(workspaceCore.filterWorkspacePaths).toHaveBeenCalledWith(["/tmp/new-ws"]);
  });

  it("builds add-workspaces summary with skipped invalid paths", async () => {
    const wsA = buildWorkspace("ws-a", "Workspace A");
    const wsB = buildWorkspace("ws-b", "Workspace B");
    const workspaceCore = buildWorkspaceCore({
      filterWorkspacePaths: vi.fn(async () => ["/tmp/a", "/tmp/b"]),
      addWorkspaceFromPath: vi
        .fn()
        .mockResolvedValueOnce(wsA)
        .mockResolvedValueOnce(wsB),
    });
    const dialogs = buildDialogs();

    useWorkspacesMock.mockReturnValue(workspaceCore);
    useWorkspaceDialogsMock.mockReturnValue(dialogs);
    useWorkspaceFromUrlPromptMock.mockReturnValue(buildWorkspaceFromUrlPrompt());

    const { result } = renderHook(() =>
      useWorkspaceController({
        appSettings: buildAppSettings(),
        addDebugEntry: vi.fn(),
        queueSaveSettings: vi.fn(async (next: AppSettings) => next),
      }),
    );

    await expect(
      result.current.addWorkspacesFromPaths(["/tmp/a", "/tmp/invalid", "/tmp/b"]),
    ).resolves.toEqual(wsA);

    expect(workspaceCore.addWorkspaceFromPath).toHaveBeenCalledTimes(2);
    expect(dialogs.showAddWorkspacesResult).toHaveBeenCalledWith({
      added: [wsA, wsB],
      firstAdded: wsA,
      skippedExisting: [],
      skippedInvalid: ["/tmp/invalid"],
      failures: [],
    });
  });

  it("forwards workspace-from-url submission with activate=true", async () => {
    const addWorkspaceFromGitUrl = vi.fn(async () => undefined);
    const workspaceCore = buildWorkspaceCore({ addWorkspaceFromGitUrl });

    useWorkspacesMock.mockReturnValue(workspaceCore);
    useWorkspaceDialogsMock.mockReturnValue(buildDialogs());
    useWorkspaceFromUrlPromptMock.mockReturnValue(buildWorkspaceFromUrlPrompt());

    renderHook(() =>
      useWorkspaceController({
        appSettings: buildAppSettings(),
        addDebugEntry: vi.fn(),
        queueSaveSettings: vi.fn(async (next: AppSettings) => next),
      }),
    );

    const onSubmit = useWorkspaceFromUrlPromptMock.mock.calls[0]?.[0]?.onSubmit as
      | ((url: string, destinationPath: string, targetFolderName?: string | null) => Promise<void>)
      | undefined;
    expect(onSubmit).toBeTypeOf("function");
    if (!onSubmit) {
      return;
    }
    await onSubmit("https://example.com/repo.git", "/tmp/workspaces", "repo-copy");

    expect(addWorkspaceFromGitUrl).toHaveBeenCalledWith(
      "https://example.com/repo.git",
      "/tmp/workspaces",
      "repo-copy",
      { activate: true },
    );
  });

  it("handles removeWorkspace confirmation and error path", async () => {
    const removeWorkspaceCore = vi.fn(async () => {
      throw new Error("remove failed");
    });
    const confirmWorkspaceRemoval = vi
      .fn()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    const showWorkspaceRemovalError = vi.fn(async () => undefined);

    const workspaceCore = buildWorkspaceCore({ removeWorkspace: removeWorkspaceCore });
    const dialogs = buildDialogs({
      confirmWorkspaceRemoval,
      showWorkspaceRemovalError,
    });

    useWorkspacesMock.mockReturnValue(workspaceCore);
    useWorkspaceDialogsMock.mockReturnValue(dialogs);
    useWorkspaceFromUrlPromptMock.mockReturnValue(buildWorkspaceFromUrlPrompt());

    const { result } = renderHook(() =>
      useWorkspaceController({
        appSettings: buildAppSettings(),
        addDebugEntry: vi.fn(),
        queueSaveSettings: vi.fn(async (next: AppSettings) => next),
      }),
    );

    await act(async () => {
      await result.current.removeWorkspace("ws-1");
    });
    expect(removeWorkspaceCore).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.removeWorkspace("ws-1");
    });
    expect(removeWorkspaceCore).toHaveBeenCalledWith("ws-1");
    expect(showWorkspaceRemovalError).toHaveBeenCalledTimes(1);
  });

  it("handles removeWorktree confirmation and error path", async () => {
    const removeWorktreeCore = vi.fn(async () => {
      throw new Error("remove worktree failed");
    });
    const confirmWorktreeRemoval = vi
      .fn()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    const showWorktreeRemovalError = vi.fn(async () => undefined);

    const workspaceCore = buildWorkspaceCore({ removeWorktree: removeWorktreeCore });
    const dialogs = buildDialogs({
      confirmWorktreeRemoval,
      showWorktreeRemovalError,
    });

    useWorkspacesMock.mockReturnValue(workspaceCore);
    useWorkspaceDialogsMock.mockReturnValue(dialogs);
    useWorkspaceFromUrlPromptMock.mockReturnValue(buildWorkspaceFromUrlPrompt());

    const { result } = renderHook(() =>
      useWorkspaceController({
        appSettings: buildAppSettings(),
        addDebugEntry: vi.fn(),
        queueSaveSettings: vi.fn(async (next: AppSettings) => next),
      }),
    );

    await act(async () => {
      await result.current.removeWorktree("ws-1");
    });
    expect(removeWorktreeCore).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.removeWorktree("ws-1");
    });
    expect(removeWorktreeCore).toHaveBeenCalledWith("ws-1");
    expect(showWorktreeRemovalError).toHaveBeenCalledTimes(1);
  });
});
