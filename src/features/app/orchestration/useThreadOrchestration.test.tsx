// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AccessMode, AppSettings } from "../../../types";
import {
  useThreadCodexBootstrapOrchestration,
  useThreadCodexSyncOrchestration,
  useThreadSelectionHandlersOrchestration,
  useThreadUiOrchestration,
} from "./useThreadOrchestration";

const mockPushErrorToast = vi.fn();
const mockNormalizeCodexArgsInput = vi.fn();
const mockGetIgnoredCodexArgsFlagsMetadata = vi.fn();
const mockCreatePendingThreadSeed = vi.fn();
const mockBuildThreadCodexSeedPatch = vi.fn();
const mockResolveThreadCodexState = vi.fn();
const mockUseThreadCodexOrchestration = vi.fn();

vi.mock("../../../services/toasts", () => ({
  pushErrorToast: (...args: unknown[]) => mockPushErrorToast(...args),
}));

vi.mock("../../../utils/codexArgsInput", () => ({
  normalizeCodexArgsInput: (...args: unknown[]) => mockNormalizeCodexArgsInput(...args),
}));

vi.mock("../../threads/utils/codexArgsProfiles", () => ({
  getIgnoredCodexArgsFlagsMetadata: (...args: unknown[]) =>
    mockGetIgnoredCodexArgsFlagsMetadata(...args),
}));

vi.mock("../../threads/utils/threadCodexParamsSeed", () => ({
  NO_THREAD_SCOPE_SUFFIX: "__no_thread__",
  createPendingThreadSeed: (...args: unknown[]) =>
    mockCreatePendingThreadSeed(...args),
  buildThreadCodexSeedPatch: (...args: unknown[]) =>
    mockBuildThreadCodexSeedPatch(...args),
  resolveThreadCodexState: (...args: unknown[]) =>
    mockResolveThreadCodexState(...args),
}));

vi.mock("../../threads/utils/threadStorage", () => ({
  makeThreadCodexParamsKey: (workspaceId: string, threadId: string) =>
    `${workspaceId}:${threadId}`,
}));

vi.mock("./useThreadCodexOrchestration", () => ({
  useThreadCodexOrchestration: (...args: unknown[]) =>
    mockUseThreadCodexOrchestration(...args),
}));

const baseAppSettings: AppSettings = {
  theme: "auto",
  notificationsEnabled: true,
  soundEnabled: true,
  showLineNumbers: true,
  vimMode: false,
  telemetryEnabled: true,
  spellcheckEnabled: true,
  updatesChannel: "stable",
  launchOnStartup: false,
  hideMenuBar: false,
  lastComposerModelId: null,
  lastComposerReasoningEffort: null,
};

describe("useThreadOrchestration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNormalizeCodexArgsInput.mockImplementation((value: string | null) =>
      value?.trim() ? value.trim() : null,
    );
    mockGetIgnoredCodexArgsFlagsMetadata.mockReturnValue({ hasIgnoredFlags: false });
    mockCreatePendingThreadSeed.mockReturnValue({ seed: "ok" });
    mockBuildThreadCodexSeedPatch.mockReturnValue({ modelId: "seed-model" });
    mockResolveThreadCodexState.mockReturnValue({
      scopeKey: "scope-key",
      accessMode: "current",
      preferredModelId: "model-a",
      preferredEffort: "high",
      preferredCollabModeId: "collab-a",
      preferredCodexArgsOverride: "--x",
    });
    mockUseThreadCodexOrchestration.mockReturnValue({ bootstrapped: true });
  });

  it("bootstraps codex orchestration with latest workspace ref", () => {
    const { result, rerender } = renderHook(
      ({ workspaceId }) =>
        useThreadCodexBootstrapOrchestration({ activeWorkspaceId: workspaceId }),
      { initialProps: { workspaceId: "ws-1" as string | null } },
    );

    expect(result.current).toEqual({ bootstrapped: true });
    expect(mockUseThreadCodexOrchestration).toHaveBeenCalledTimes(1);
    const firstCallArg = mockUseThreadCodexOrchestration.mock.calls[0][0] as {
      activeWorkspaceIdForParamsRef: { current: string | null };
    };
    expect(firstCallArg.activeWorkspaceIdForParamsRef.current).toBe("ws-1");

    rerender({ workspaceId: "ws-2" });
    expect(firstCallArg.activeWorkspaceIdForParamsRef.current).toBe("ws-2");
  });

  it("syncs resolved codex state and seeds missing thread params", () => {
    const setThreadCodexSelectionKey = vi.fn();
    const setAccessMode = vi.fn();
    const setPreferredModelId = vi.fn();
    const setPreferredEffort = vi.fn();
    const setPreferredCollabModeId = vi.fn();
    const setPreferredCodexArgsOverride = vi.fn();
    const patchThreadCodexParams = vi.fn();
    const activeThreadIdRef = { current: null as string | null };
    const pendingNewThreadSeedRef = {
      current: { workspaceId: "ws-1", any: true } as unknown,
    };

    const getThreadCodexParams = vi
      .fn()
      .mockImplementation((_workspaceId: string, threadId: string) => {
        if (threadId === "thread-1") {
          return null;
        }
        if (threadId === "__no_thread__") {
          return { modelId: "fallback-model" };
        }
        return null;
      });

    renderHook(() =>
      useThreadCodexSyncOrchestration({
        activeWorkspaceId: "ws-1",
        activeThreadId: "thread-1",
        appSettings: {
          lastComposerModelId: "default-model",
          lastComposerReasoningEffort: "medium",
        },
        threadCodexParamsVersion: 1,
        getThreadCodexParams,
        patchThreadCodexParams,
        setThreadCodexSelectionKey,
        setAccessMode,
        setPreferredModelId,
        setPreferredEffort,
        setPreferredCollabModeId,
        setPreferredCodexArgsOverride,
        activeThreadIdRef,
        pendingNewThreadSeedRef,
        selectedModelId: "selected-model",
        resolvedEffort: "high",
        accessMode: "all",
        selectedCollaborationModeId: "collab-next",
        selectedCodexArgsOverride: "--allow",
      }),
    );

    expect(setThreadCodexSelectionKey).toHaveBeenCalledWith("scope-key");
    expect(setAccessMode).toHaveBeenCalledWith("current");
    expect(setPreferredModelId).toHaveBeenCalledWith("model-a");
    expect(setPreferredEffort).toHaveBeenCalledWith("high");
    expect(setPreferredCollabModeId).toHaveBeenCalledWith("collab-a");
    expect(setPreferredCodexArgsOverride).toHaveBeenCalledWith("--x");

    expect(patchThreadCodexParams).toHaveBeenCalledWith("ws-1", "thread-1", {
      modelId: "seed-model",
    });
    expect(mockBuildThreadCodexSeedPatch).toHaveBeenCalled();
    expect(activeThreadIdRef.current).toBe("thread-1");
    expect(pendingNewThreadSeedRef.current).toBeNull();
  });

  it("skips sync work when workspace is absent", () => {
    const setThreadCodexSelectionKey = vi.fn();
    const setAccessMode = vi.fn();
    const setPreferredModelId = vi.fn();
    const setPreferredEffort = vi.fn();
    const setPreferredCollabModeId = vi.fn();
    const patchThreadCodexParams = vi.fn();
    const getThreadCodexParams = vi.fn();
    const activeThreadIdRef = { current: null as string | null };
    const pendingNewThreadSeedRef = { current: null as unknown };

    renderHook(() =>
      useThreadCodexSyncOrchestration({
        activeWorkspaceId: null,
        activeThreadId: null,
        appSettings: {
          lastComposerModelId: null,
          lastComposerReasoningEffort: null,
        },
        threadCodexParamsVersion: 0,
        getThreadCodexParams,
        patchThreadCodexParams,
        setThreadCodexSelectionKey,
        setAccessMode,
        setPreferredModelId,
        setPreferredEffort,
        setPreferredCollabModeId,
        activeThreadIdRef,
        pendingNewThreadSeedRef,
        selectedModelId: null,
        resolvedEffort: null,
        accessMode: "current",
        selectedCollaborationModeId: null,
      }),
    );

    expect(getThreadCodexParams).not.toHaveBeenCalled();
    expect(patchThreadCodexParams).not.toHaveBeenCalled();
    expect(setThreadCodexSelectionKey).not.toHaveBeenCalled();
    expect(setAccessMode).not.toHaveBeenCalled();
    expect(setPreferredModelId).not.toHaveBeenCalled();
    expect(setPreferredEffort).not.toHaveBeenCalled();
    expect(setPreferredCollabModeId).not.toHaveBeenCalled();
  });

  it("selection handlers persist params and update settings only without active thread", () => {
    let latestSettings: AppSettings = {
      ...baseAppSettings,
      lastComposerModelId: "old-model",
      lastComposerReasoningEffort: "low",
    };
    const setAppSettings = vi.fn((updater: (current: AppSettings) => AppSettings) => {
      latestSettings = updater(latestSettings);
      return latestSettings;
    });
    const queueSaveSettings = vi.fn().mockResolvedValue(undefined);
    const setSelectedModelId = vi.fn();
    const setSelectedEffort = vi.fn();
    const setSelectedCollaborationModeId = vi.fn();
    const setAccessMode = vi.fn();
    const setSelectedCodexArgsOverride = vi.fn();
    const persistThreadCodexParams = vi.fn();
    const activeThreadIdRef = { current: null as string | null };

    const { result } = renderHook(() =>
      useThreadSelectionHandlersOrchestration({
        appSettingsLoading: false,
        setAppSettings,
        queueSaveSettings,
        activeThreadIdRef,
        setSelectedModelId,
        setSelectedEffort,
        setSelectedCollaborationModeId,
        setAccessMode,
        setSelectedCodexArgsOverride,
        persistThreadCodexParams,
      }),
    );

    act(() => {
      result.current.handleSelectModel("gpt-5");
      result.current.handleSelectEffort("  high  ");
      result.current.handleSelectCollaborationMode("collab-1");
      result.current.handleSelectAccessMode("all" as AccessMode);
      result.current.handleSelectCodexArgsOverride("  --allow  ");
    });

    expect(setSelectedModelId).toHaveBeenCalledWith("gpt-5");
    expect(setSelectedEffort).toHaveBeenCalledWith("high");
    expect(setSelectedCollaborationModeId).toHaveBeenCalledWith("collab-1");
    expect(setAccessMode).toHaveBeenCalledWith("all");
    expect(setSelectedCodexArgsOverride).toHaveBeenCalledWith("--allow");

    expect(queueSaveSettings).toHaveBeenCalledTimes(2);
    expect(latestSettings.lastComposerModelId).toBe("gpt-5");
    expect(latestSettings.lastComposerReasoningEffort).toBe("high");

    expect(persistThreadCodexParams).toHaveBeenNthCalledWith(1, { modelId: "gpt-5" });
    expect(persistThreadCodexParams).toHaveBeenNthCalledWith(2, { effort: "high" });
    expect(persistThreadCodexParams).toHaveBeenNthCalledWith(3, {
      collaborationModeId: "collab-1",
    });
    expect(persistThreadCodexParams).toHaveBeenNthCalledWith(4, { accessMode: "all" });
    expect(persistThreadCodexParams).toHaveBeenNthCalledWith(5, {
      codexArgsOverride: "--allow",
    });
  });

  it("selection handlers avoid appSettings write with active thread and warn on ignored flags", () => {
    mockGetIgnoredCodexArgsFlagsMetadata.mockReturnValue({ hasIgnoredFlags: true });

    const setAppSettings = vi.fn();
    const queueSaveSettings = vi.fn();
    const setSelectedModelId = vi.fn();
    const setSelectedEffort = vi.fn();
    const setSelectedCollaborationModeId = vi.fn();
    const setAccessMode = vi.fn();
    const setSelectedCodexArgsOverride = vi.fn();
    const persistThreadCodexParams = vi.fn();
    const activeThreadIdRef = { current: "thread-1" as string | null };

    const { result } = renderHook(() =>
      useThreadSelectionHandlersOrchestration({
        appSettingsLoading: false,
        setAppSettings,
        queueSaveSettings,
        activeThreadIdRef,
        setSelectedModelId,
        setSelectedEffort,
        setSelectedCollaborationModeId,
        setAccessMode,
        setSelectedCodexArgsOverride,
        persistThreadCodexParams,
      }),
    );

    act(() => {
      result.current.handleSelectModel("gpt-5");
      result.current.handleSelectEffort("   ");
      result.current.handleSelectCodexArgsOverride("--danger");
    });

    expect(setAppSettings).not.toHaveBeenCalled();
    expect(queueSaveSettings).not.toHaveBeenCalled();
    expect(setSelectedEffort).toHaveBeenCalledWith(null);
    expect(mockPushErrorToast).toHaveBeenCalledTimes(1);
  });

  it("ui orchestration handles send flow, workspace selection, open-link guard and archive", async () => {
    const pendingNewThreadSeedRef = { current: null as unknown };
    const runWithDraftStart = vi.fn(async (runner: () => Promise<void>) => runner());
    const handleComposerSend = vi.fn().mockResolvedValue(undefined);
    const clearDraftState = vi.fn();
    const exitDiffView = vi.fn();
    const resetPullRequestSelection = vi.fn();
    const selectWorkspace = vi.fn();
    const setActiveThreadId = vi.fn();
    const setActiveTab = vi.fn();
    const removeThread = vi.fn();
    const clearDraftForThread = vi.fn();
    const removeImagesForThread = vi.fn();

    const { result } = renderHook(() =>
      useThreadUiOrchestration({
        activeWorkspaceId: "ws-1",
        activeThreadId: "thread-1",
        accessMode: "current",
        selectedCollaborationModeId: "collab-1",
        selectedCodexArgsOverride: "--allow",
        pendingNewThreadSeedRef,
        runWithDraftStart,
        handleComposerSend,
        clearDraftState,
        exitDiffView,
        resetPullRequestSelection,
        selectWorkspace,
        setActiveThreadId,
        setActiveTab,
        isCompact: true,
        removeThread,
        clearDraftForThread,
        removeImagesForThread,
      }),
    );

    await act(async () => {
      await result.current.handleComposerSendWithDraftStart("hello", ["img"], []);
    });

    expect(mockCreatePendingThreadSeed).toHaveBeenCalledWith({
      activeThreadId: "thread-1",
      activeWorkspaceId: "ws-1",
      selectedCollaborationModeId: "collab-1",
      accessMode: "current",
      codexArgsOverride: "--allow",
    });
    expect(pendingNewThreadSeedRef.current).toEqual({ seed: "ok" });
    expect(handleComposerSend).toHaveBeenCalledWith("hello", ["img"], undefined, undefined);

    await act(async () => {
      await result.current.handleComposerSendWithDraftStart(
        "hello-2",
        [],
        [{ appId: "app-1", mention: "@app" }],
        "submit",
      );
    });

    expect(handleComposerSend).toHaveBeenCalledWith(
      "hello-2",
      [],
      [{ appId: "app-1", mention: "@app" }],
      "submit",
    );

    act(() => {
      result.current.handleSelectWorkspaceInstance("ws-2", "thread-2");
      result.current.handleOpenThreadLink("thread-3");
      result.current.handleArchiveActiveThread();
    });

    expect(exitDiffView).toHaveBeenCalledTimes(2);
    expect(resetPullRequestSelection).toHaveBeenCalledTimes(2);
    expect(clearDraftState).toHaveBeenCalledTimes(2);
    expect(selectWorkspace).toHaveBeenCalledWith("ws-2");
    expect(setActiveThreadId).toHaveBeenCalledWith("thread-2", "ws-2");
    expect(setActiveTab).toHaveBeenCalledWith("codex");
    expect(setActiveThreadId).toHaveBeenCalledWith("thread-3", "ws-1");
    expect(removeThread).toHaveBeenCalledWith("ws-1", "thread-1");
    expect(clearDraftForThread).toHaveBeenCalledWith("thread-1");
    expect(removeImagesForThread).toHaveBeenCalledWith("thread-1");
  });

  it("ui orchestration guards open-thread/archive when workspace or thread is missing", () => {
    const exitDiffView = vi.fn();
    const resetPullRequestSelection = vi.fn();
    const clearDraftState = vi.fn();
    const setActiveThreadId = vi.fn();
    const removeThread = vi.fn();
    const clearDraftForThread = vi.fn();
    const removeImagesForThread = vi.fn();

    const { result } = renderHook(() =>
      useThreadUiOrchestration({
        activeWorkspaceId: null,
        activeThreadId: null,
        accessMode: "current",
        selectedCollaborationModeId: null,
        selectedCodexArgsOverride: null,
        pendingNewThreadSeedRef: { current: null },
        runWithDraftStart: async (runner) => runner(),
        handleComposerSend: vi.fn().mockResolvedValue(undefined),
        clearDraftState,
        exitDiffView,
        resetPullRequestSelection,
        selectWorkspace: vi.fn(),
        setActiveThreadId,
        setActiveTab: vi.fn(),
        isCompact: false,
        removeThread,
        clearDraftForThread,
        removeImagesForThread,
      }),
    );

    act(() => {
      result.current.handleOpenThreadLink("thread-x");
      result.current.handleArchiveActiveThread();
    });

    expect(exitDiffView).not.toHaveBeenCalled();
    expect(resetPullRequestSelection).not.toHaveBeenCalled();
    expect(clearDraftState).not.toHaveBeenCalled();
    expect(setActiveThreadId).not.toHaveBeenCalled();
    expect(removeThread).not.toHaveBeenCalled();
    expect(clearDraftForThread).not.toHaveBeenCalled();
    expect(removeImagesForThread).not.toHaveBeenCalled();
  });
});
