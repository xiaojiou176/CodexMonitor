// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as Sentry from "@sentry/react";
import { resumeThread, setThreadName } from "../../../services/tauri";
import * as threadStorageUtils from "../utils/threadStorage";
import { useThreads } from "./useThreads";

type ArchiveFailure = { threadId: string; error: string };

const useThreadActionsMocks = vi.hoisted(() => ({
  startThreadForWorkspace: vi.fn(),
  forkThreadForWorkspace: vi.fn(),
  resumeThreadForWorkspace: vi.fn(),
  refreshThread: vi.fn(),
  loadOlderMessagesForThread: vi.fn(),
  resetWorkspaceThreads: vi.fn(),
  listThreadsForWorkspace: vi.fn(),
  loadOlderThreadsForWorkspace: vi.fn(),
  archiveThreads: vi.fn(async () => ({
    allSucceeded: true,
    okIds: [] as string[],
    failed: [] as ArchiveFailure[],
    total: 0,
  })),
}));

const useThreadMessagingCapture = vi.hoisted(() => ({
  latestArgs: null as Record<string, unknown> | null,
}));

const useThreadEventHandlersCapture = vi.hoisted(() => ({
  latestArgs: null as Record<string, unknown> | null,
}));

const useThreadActionsCapture = vi.hoisted(() => ({
  latestArgs: null as Record<string, unknown> | null,
}));

vi.mock("../../app/hooks/useAppServerEvents", () => ({
  useAppServerEvents: vi.fn(),
}));

vi.mock("../../../services/tauri", () => ({
  respondToServerRequest: vi.fn(),
  respondToUserInputRequest: vi.fn(),
  rememberApprovalRule: vi.fn(),
  sendUserMessage: vi.fn(),
  steerTurn: vi.fn(),
  startReview: vi.fn(),
  startThread: vi.fn(),
  forkThread: vi.fn(),
  listThreads: vi.fn(),
  resumeThread: vi.fn(),
  archiveThreads: vi.fn(async () => ({
    allSucceeded: true,
    okIds: [] as string[],
    failed: [] as ArchiveFailure[],
    total: 0,
  })),
  setThreadName: vi.fn(),
  getAccountRateLimits: vi.fn(),
  getAccountInfo: vi.fn(),
  interruptTurn: vi.fn(),
  compactThread: vi.fn(),
  getAppsList: vi.fn(),
  listMcpServerStatus: vi.fn(),
}));

vi.mock("@sentry/react", () => ({
  metrics: {
    count: vi.fn(),
  },
}));

vi.mock("./useThreadActions", () => ({
  useThreadActions: vi.fn((args: Record<string, unknown>) => {
    useThreadActionsCapture.latestArgs = args;
    return useThreadActionsMocks;
  }),
}));

vi.mock("./useThreadMessaging", () => ({
  useThreadMessaging: vi.fn((args: Record<string, unknown>) => {
    useThreadMessagingCapture.latestArgs = args;
    return {
      interruptTurn: vi.fn(),
      sendUserMessage: vi.fn(),
      sendUserMessageToThread: vi.fn(),
      startFork: vi.fn(),
      startReview: vi.fn(),
      startResume: vi.fn(),
      startCompact: vi.fn(),
      startApps: vi.fn(),
      startMcp: vi.fn(),
      startStatus: vi.fn(),
      reviewPrompt: null,
      openReviewPrompt: vi.fn(),
      closeReviewPrompt: vi.fn(),
      showPresetStep: false,
      choosePreset: vi.fn(),
      highlightedPresetIndex: -1,
      setHighlightedPresetIndex: vi.fn(),
      highlightedBranchIndex: -1,
      setHighlightedBranchIndex: vi.fn(),
      highlightedCommitIndex: -1,
      setHighlightedCommitIndex: vi.fn(),
      handleReviewPromptKeyDown: vi.fn(),
      confirmBranch: vi.fn(),
      selectBranch: vi.fn(),
      selectBranchAtIndex: vi.fn(),
      selectCommit: vi.fn(),
      selectCommitAtIndex: vi.fn(),
      confirmCommit: vi.fn(),
      updateCustomInstructions: vi.fn(),
      confirmCustom: vi.fn(),
    };
  }),
}));

vi.mock("./useThreadEventHandlers", () => ({
  useThreadEventHandlers: vi.fn((args: Record<string, unknown>) => {
    useThreadEventHandlersCapture.latestArgs = args;
    return {};
  }),
}));

const activeWorkspace = {
  id: "ws-active",
  name: "Active",
  path: "/tmp/active",
  connected: true,
  settings: { sidebarCollapsed: false },
};

describe("useThreads branch guards", () => {
  beforeEach(() => {
    const resumedSuccessfully = new Set<string>();
    vi.clearAllMocks();
    localStorage.clear();
    useThreadMessagingCapture.latestArgs = null;
    useThreadEventHandlersCapture.latestArgs = null;
    useThreadActionsCapture.latestArgs = null;
    useThreadActionsMocks.startThreadForWorkspace.mockReset();
    useThreadActionsMocks.forkThreadForWorkspace.mockReset();
    useThreadActionsMocks.resumeThreadForWorkspace.mockReset();
    useThreadActionsMocks.refreshThread.mockReset();
    useThreadActionsMocks.loadOlderMessagesForThread.mockReset();
    useThreadActionsMocks.resetWorkspaceThreads.mockReset();
    useThreadActionsMocks.listThreadsForWorkspace.mockReset();
    useThreadActionsMocks.loadOlderThreadsForWorkspace.mockReset();
    useThreadActionsMocks.archiveThreads.mockReset();
    useThreadActionsMocks.archiveThreads.mockResolvedValue({
      allSucceeded: true,
      okIds: [] as string[],
      failed: [] as ArchiveFailure[],
      total: 0,
    });
    useThreadActionsMocks.resumeThreadForWorkspace.mockImplementation(
      async (workspaceId: string, threadId: string) => {
        const key = `${workspaceId}:${threadId}`;
        if (resumedSuccessfully.has(key)) {
          return true;
        }
        try {
          await resumeThread(workspaceId, threadId);
          resumedSuccessfully.add(key);
          return true;
        } catch {
          resumedSuccessfully.delete(key);
          return false;
        }
      },
    );
    useThreadActionsMocks.startThreadForWorkspace.mockResolvedValue("thread-started");
  });

  it("hydrates custom thread names from workspace settings and persists normalized entries", async () => {
    const saveCustomNamesSpy = vi.spyOn(threadStorageUtils, "saveCustomNames");
    const threadDisplayNamesWithInvalidValue = {
      "thread-a": "  Keep Me  ",
      "thread-empty": "   ",
      "thread-non-string": 123,
    } as unknown as Record<string, string>;
    const ws = {
      ...activeWorkspace,
      id: "ws-custom",
      settings: {
        sidebarCollapsed: false,
        threadDisplayNames: threadDisplayNamesWithInvalidValue,
      },
    };

    const { rerender } = renderHook(
      (props: { workspaces: Array<typeof ws> }) =>
        useThreads({
          workspaces: props.workspaces,
          activeWorkspace: ws,
          onWorkspaceConnected: vi.fn(),
        }),
      {
        initialProps: { workspaces: [ws] },
      },
    );

    await waitFor(() => {
      expect(saveCustomNamesSpy).toHaveBeenCalledTimes(1);
    });

    const getCustomName = useThreadActionsCapture.latestArgs
      ?.getCustomName as ((workspaceId: string, threadId: string) => string | undefined);
    expect(getCustomName("ws-custom", "thread-a")).toBe("Keep Me");
    expect(getCustomName("ws-custom", "thread-empty")).toBeUndefined();

    rerender({ workspaces: [ws] });
    expect(saveCustomNamesSpy).toHaveBeenCalledTimes(1);
  });

  it("does not persist custom names when hydrated values already exist", async () => {
    const saveCustomNamesSpy = vi.spyOn(threadStorageUtils, "saveCustomNames");
    window.localStorage.setItem(
      threadStorageUtils.STORAGE_KEY_CUSTOM_NAMES,
      JSON.stringify({ "ws-custom:thread-a": "Keep Me" }),
    );
    const ws = {
      ...activeWorkspace,
      id: "ws-custom",
      settings: {
        sidebarCollapsed: false,
        threadDisplayNames: {
          "thread-a": "  Keep Me  ",
        },
      },
    };

    renderHook(() =>
      useThreads({
        workspaces: [ws],
        activeWorkspace: ws,
        onWorkspaceConnected: vi.fn(),
      }),
    );

    await act(async () => {
      await Promise.resolve();
    });
    expect(saveCustomNamesSpy).not.toHaveBeenCalled();
  });

  it("returns null from startThread when there is no active workspace", async () => {
    const { result } = renderHook(() =>
      useThreads({
        activeWorkspace: null,
        onWorkspaceConnected: vi.fn(),
      }),
    );

    let started: string | null = "placeholder";
    await act(async () => {
      started = await result.current.startThread();
    });

    expect(started).toBeNull();
  });

  it("starts a thread for active workspace when startThread is called", async () => {
    useThreadActionsMocks.startThreadForWorkspace.mockResolvedValueOnce("thread-created");
    const { result } = renderHook(() =>
      useThreads({
        activeWorkspace: { ...activeWorkspace },
        onWorkspaceConnected: vi.fn(),
      }),
    );

    let started: string | null = null;
    await act(async () => {
      started = await result.current.startThread();
    });

    expect(started).toBe("thread-created");
    expect(useThreadActionsMocks.startThreadForWorkspace).toHaveBeenCalledWith("ws-active");
  });

  it("does not resume thread when setActiveThreadId has no resolvable workspace id", async () => {
    const { result } = renderHook(() =>
      useThreads({
        activeWorkspace: null,
        onWorkspaceConnected: vi.fn(),
      }),
    );

    await act(async () => {
      result.current.setActiveThreadId("thread-1");
    });

    expect(resumeThread).not.toHaveBeenCalled();
  });

  it("returns null when ensureThreadForActiveWorkspace has no active workspace", async () => {
    renderHook(() =>
      useThreads({
        activeWorkspace: null,
        onWorkspaceConnected: vi.fn(),
      }),
    );
    const ensureThreadForActiveWorkspace = useThreadMessagingCapture
      .latestArgs?.ensureThreadForActiveWorkspace as (() => Promise<string | null>);

    let ensured: string | null = "placeholder";
    await act(async () => {
      ensured = await ensureThreadForActiveWorkspace();
    });

    expect(ensured).toBeNull();
    expect(useThreadActionsMocks.startThreadForWorkspace).not.toHaveBeenCalled();
  });

  it("resumes thread when caller provides explicit workspace id", async () => {
    const { result } = renderHook(() =>
      useThreads({
        activeWorkspace: null,
        onWorkspaceConnected: vi.fn(),
      }),
    );

    await act(async () => {
      result.current.setActiveThreadId("thread-2", "ws-explicit");
    });

    await waitFor(() => {
      expect(resumeThread).toHaveBeenCalledWith("ws-explicit", "thread-2");
    });
  });

  it("prefers explicit workspace id over active workspace fallback", async () => {
    const { result } = renderHook(() =>
      useThreads({
        activeWorkspace: {
          ...activeWorkspace,
        },
        onWorkspaceConnected: vi.fn(),
      }),
    );

    await act(async () => {
      result.current.setActiveThreadId("thread-explicit", "ws-explicit");
    });

    await waitFor(() => {
      expect(resumeThread).toHaveBeenCalledWith("ws-explicit", "thread-explicit");
    });
    expect(resumeThread).not.toHaveBeenCalledWith("ws-active", "thread-explicit");
  });

  it("resumes thread via active workspace id when workspace id argument is omitted", async () => {
    const { result } = renderHook(() =>
      useThreads({
        activeWorkspace: {
          ...activeWorkspace,
        },
        onWorkspaceConnected: vi.fn(),
      }),
    );

    await act(async () => {
      result.current.setActiveThreadId("thread-from-active");
    });

    await waitFor(() => {
      expect(resumeThread).toHaveBeenCalledWith("ws-active", "thread-from-active");
    });
  });

  it("does not resume when selecting a null thread id", async () => {
    const { result } = renderHook(() =>
      useThreads({
        activeWorkspace: {
          ...activeWorkspace,
        },
        onWorkspaceConnected: vi.fn(),
      }),
    );

    await act(async () => {
      result.current.setActiveThreadId(null);
    });

    expect(resumeThread).not.toHaveBeenCalled();
    expect(Sentry.metrics.count).not.toHaveBeenCalled();
  });

  it("tracks thread switch metric only when thread id actually changes", async () => {
    const { result } = renderHook(() =>
      useThreads({
        activeWorkspace: {
          ...activeWorkspace,
        },
        onWorkspaceConnected: vi.fn(),
      }),
    );

    await act(async () => {
      result.current.setActiveThreadId("thread-1");
    });
    await act(async () => {
      result.current.setActiveThreadId("thread-1");
    });

    expect(Sentry.metrics.count).toHaveBeenCalledTimes(1);
    expect(Sentry.metrics.count).toHaveBeenCalledWith("thread_switched", 1, {
      attributes: {
        workspace_id: "ws-active",
        thread_id: "thread-1",
        reason: "select",
      },
    });
    expect(resumeThread).toHaveBeenCalledTimes(1);
  });

  it("tracks switch metrics for each real active-thread transition", async () => {
    const { result } = renderHook(() =>
      useThreads({
        activeWorkspace: {
          ...activeWorkspace,
        },
        onWorkspaceConnected: vi.fn(),
      }),
    );

    await act(async () => {
      result.current.setActiveThreadId("thread-1");
    });
    await act(async () => {
      result.current.setActiveThreadId("thread-2");
    });

    expect(Sentry.metrics.count).toHaveBeenCalledTimes(2);
    expect(vi.mocked(Sentry.metrics.count).mock.calls[0]?.[2]).toEqual({
      attributes: {
        workspace_id: "ws-active",
        thread_id: "thread-1",
        reason: "select",
      },
    });
    expect(vi.mocked(Sentry.metrics.count).mock.calls[1]?.[2]).toEqual({
      attributes: {
        workspace_id: "ws-active",
        thread_id: "thread-2",
        reason: "select",
      },
    });
  });

  it("swallows async resume failures from setActiveThreadId", async () => {
    vi.mocked(resumeThread).mockRejectedValueOnce(new Error("resume failed"));
    const { result } = renderHook(() =>
      useThreads({
        activeWorkspace: {
          ...activeWorkspace,
        },
        onWorkspaceConnected: vi.fn(),
      }),
    );

    await act(async () => {
      result.current.setActiveThreadId("thread-fail");
    });

    await waitFor(() => {
      expect(resumeThread).toHaveBeenCalledWith("ws-active", "thread-fail");
    });
  });

  it("retries resume after a previous resume failure", async () => {
    vi.mocked(resumeThread)
      .mockRejectedValueOnce(new Error("resume failed"))
      .mockResolvedValueOnce({});

    const { result } = renderHook(() =>
      useThreads({
        activeWorkspace: {
          ...activeWorkspace,
        },
        onWorkspaceConnected: vi.fn(),
      }),
    );

    await act(async () => {
      result.current.setActiveThreadId("thread-retry");
    });
    await act(async () => {
      result.current.setActiveThreadId("thread-retry");
    });

    await waitFor(() => {
      expect(resumeThread).toHaveBeenCalledTimes(2);
    });
    expect(vi.mocked(resumeThread).mock.calls[0]).toEqual(["ws-active", "thread-retry"]);
    expect(vi.mocked(resumeThread).mock.calls[1]).toEqual(["ws-active", "thread-retry"]);
  });

  it("uses active workspace fallback when ensureThreadForActiveWorkspace starts a thread", async () => {
    useThreadActionsMocks.startThreadForWorkspace.mockResolvedValueOnce("thread-new");
    const { result } = renderHook(() =>
      useThreads({
        activeWorkspace: { ...activeWorkspace },
        onWorkspaceConnected: vi.fn(),
      }),
    );
    const ensureThreadForActiveWorkspace = useThreadMessagingCapture
      .latestArgs?.ensureThreadForActiveWorkspace as (() => Promise<string | null>);

    let ensured: string | null = null;
    await act(async () => {
      ensured = await ensureThreadForActiveWorkspace();
    });

    expect(ensured).toBe("thread-new");
    expect(useThreadActionsMocks.startThreadForWorkspace).toHaveBeenCalledWith("ws-active");
    expect(useThreadActionsMocks.resumeThreadForWorkspace).not.toHaveBeenCalled();
    void result;
  });

  it("keeps existing thread when ensureThreadForActiveWorkspace resume succeeds", async () => {
    const { result } = renderHook(() =>
      useThreads({
        activeWorkspace: { ...activeWorkspace },
        onWorkspaceConnected: vi.fn(),
      }),
    );
    await act(async () => {
      result.current.setActiveThreadId("thread-existing");
    });
    const ensureThreadForActiveWorkspace = useThreadMessagingCapture
      .latestArgs?.ensureThreadForActiveWorkspace as (() => Promise<string | null>);
    useThreadActionsMocks.startThreadForWorkspace.mockClear();
    useThreadActionsMocks.resumeThreadForWorkspace.mockClear();

    let ensured: string | null = null;
    await act(async () => {
      ensured = await ensureThreadForActiveWorkspace();
    });

    expect(ensured).toBe("thread-existing");
    expect(useThreadActionsMocks.resumeThreadForWorkspace).toHaveBeenCalledWith(
      "ws-active",
      "thread-existing",
    );
    expect(useThreadActionsMocks.startThreadForWorkspace).not.toHaveBeenCalled();
  });

  it("retries with new thread when ensureThreadForActiveWorkspace resume returns false", async () => {
    useThreadActionsMocks.resumeThreadForWorkspace.mockResolvedValueOnce(false);
    useThreadActionsMocks.startThreadForWorkspace.mockResolvedValueOnce("thread-recovered");
    renderHook(() =>
      useThreads({
        activeWorkspace: { ...activeWorkspace },
        onWorkspaceConnected: vi.fn(),
      }),
    );
    const ensureThreadForActiveWorkspace = useThreadMessagingCapture
      .latestArgs?.ensureThreadForActiveWorkspace as (() => Promise<string | null>);
    expect(ensureThreadForActiveWorkspace).toBeTypeOf("function");

    const { result } = renderHook(() =>
      useThreads({
        activeWorkspace: { ...activeWorkspace },
        onWorkspaceConnected: vi.fn(),
      }),
    );
    await act(async () => {
      result.current.setActiveThreadId("thread-stale");
    });

    let ensured: string | null = null;
    await act(async () => {
      ensured = await ensureThreadForActiveWorkspace();
    });

    expect(useThreadActionsMocks.resumeThreadForWorkspace).toHaveBeenCalledWith(
      "ws-active",
      "thread-stale",
    );
    expect(useThreadActionsMocks.startThreadForWorkspace).toHaveBeenCalledWith("ws-active");
    expect(ensured).toBe("thread-recovered");
  });

  it("falls back to a fresh thread when ensureThreadForActiveWorkspace resume throws", async () => {
    vi.mocked(resumeThread)
      .mockRejectedValueOnce(new Error("initial resume failed"))
      .mockRejectedValueOnce(new Error("stale resume failed"));
    useThreadActionsMocks.startThreadForWorkspace.mockResolvedValueOnce("thread-recovered");
    const { result } = renderHook(() =>
      useThreads({
        activeWorkspace: { ...activeWorkspace },
        onWorkspaceConnected: vi.fn(),
      }),
    );

    await act(async () => {
      result.current.setActiveThreadId("thread-stale");
    });
    const ensureThreadForActiveWorkspace = useThreadMessagingCapture
      .latestArgs?.ensureThreadForActiveWorkspace as (() => Promise<string | null>);

    let ensured: string | null = null;
    await act(async () => {
      ensured = await ensureThreadForActiveWorkspace();
    });

    expect(useThreadActionsMocks.resumeThreadForWorkspace).toHaveBeenCalledWith(
      "ws-active",
      "thread-stale",
    );
    expect(useThreadActionsMocks.startThreadForWorkspace).toHaveBeenCalledWith("ws-active");
    expect(ensured).toBe("thread-recovered");
  });

  it("skips activation side effect for non-active workspace in ensureThreadForWorkspace", async () => {
    useThreadActionsMocks.startThreadForWorkspace.mockResolvedValueOnce("thread-other");
    const { result } = renderHook(() =>
      useThreads({
        activeWorkspace: { ...activeWorkspace },
        onWorkspaceConnected: vi.fn(),
      }),
    );
    const ensureThreadForWorkspace = useThreadMessagingCapture
      .latestArgs?.ensureThreadForWorkspace as ((workspaceId: string) => Promise<string | null>);

    let ensured: string | null = null;
    await act(async () => {
      ensured = await ensureThreadForWorkspace("ws-other");
    });

    expect(ensured).toBe("thread-other");
    expect(useThreadActionsMocks.startThreadForWorkspace).toHaveBeenCalledWith("ws-other", {
      activate: false,
    });
    expect(result.current.activeThreadId).toBeNull();
    expect(Sentry.metrics.count).not.toHaveBeenCalledWith("thread_switched", 1, {
      attributes: {
        workspace_id: "ws-other",
        thread_id: "thread-other",
        reason: "select",
      },
    });
  });

  it("swallows onMessageActivity errors via safeMessageActivity", async () => {
    const onMessageActivity = vi.fn(() => {
      throw new Error("ui callback failed");
    });
    renderHook(() =>
      useThreads({
        activeWorkspace: { ...activeWorkspace },
        onWorkspaceConnected: vi.fn(),
        onMessageActivity,
      }),
    );
    const safeMessageActivity = useThreadEventHandlersCapture
      .latestArgs?.safeMessageActivity as (() => void);

    expect(safeMessageActivity).toBeTypeOf("function");
    expect(() => safeMessageActivity()).not.toThrow();
    expect(onMessageActivity).toHaveBeenCalledTimes(1);
  });

  it("captures both persist and rename failures during renameThread", async () => {
    const onDebug = vi.fn();
    const persistThreadDisplayName = vi.fn().mockRejectedValue(new Error("persist failed"));
    vi.mocked(setThreadName).mockRejectedValueOnce(new Error("rename failed"));
    const { result } = renderHook(() =>
      useThreads({
        activeWorkspace: { ...activeWorkspace },
        onWorkspaceConnected: vi.fn(),
        onDebug,
        persistThreadDisplayName,
      }),
    );

    await act(async () => {
      result.current.renameThread("ws-active", "thread-rename", "  New Name  ");
    });

    await waitFor(() => {
      expect(onDebug).toHaveBeenCalled();
    });
    const labels = onDebug.mock.calls.map((call) => call[0]?.label);
    expect(labels).toContain("workspace/settings threadDisplayNames error");
    expect(labels).toContain("thread/name/set error");
  });

  it("normalizes non-Error rename failures into string payloads", async () => {
    const onDebug = vi.fn();
    const persistThreadDisplayName = vi.fn().mockRejectedValue("persist-string-failure");
    vi.mocked(setThreadName).mockRejectedValueOnce("rename-string-failure");
    const { result } = renderHook(() =>
      useThreads({
        activeWorkspace: { ...activeWorkspace },
        onWorkspaceConnected: vi.fn(),
        onDebug,
        persistThreadDisplayName,
      }),
    );

    await act(async () => {
      result.current.renameThread("ws-active", "thread-string-errors", "  Name  ");
    });

    await waitFor(() => {
      expect(onDebug).toHaveBeenCalled();
    });
    const payloads = onDebug.mock.calls.map((call) => call[0]?.payload);
    expect(payloads).toContain("persist-string-failure");
    expect(payloads).toContain("rename-string-failure");
  });

  it("ignores blank names in renameThread", async () => {
    const persistThreadDisplayName = vi.fn();
    const { result } = renderHook(() =>
      useThreads({
        activeWorkspace: { ...activeWorkspace },
        onWorkspaceConnected: vi.fn(),
        persistThreadDisplayName,
      }),
    );

    await act(async () => {
      result.current.renameThread("ws-active", "thread-blank", "   ");
    });

    expect(persistThreadDisplayName).not.toHaveBeenCalled();
    expect(setThreadName).not.toHaveBeenCalled();
  });

  it("does not emit switch metric when target thread stays null", async () => {
    const { result } = renderHook(() =>
      useThreads({
        activeWorkspace: { ...activeWorkspace },
        onWorkspaceConnected: vi.fn(),
      }),
    );

    await act(async () => {
      result.current.setActiveThreadId(null);
    });
    await act(async () => {
      result.current.setActiveThreadId(null);
    });

    expect(Sentry.metrics.count).not.toHaveBeenCalled();
    expect(resumeThread).not.toHaveBeenCalled();
  });

  it("emits switch metric for explicit workspace target", async () => {
    const { result } = renderHook(() =>
      useThreads({
        activeWorkspace: { ...activeWorkspace },
        onWorkspaceConnected: vi.fn(),
      }),
    );

    await act(async () => {
      result.current.setActiveThreadId("thread-explicit-2", "ws-explicit");
    });

    expect(Sentry.metrics.count).toHaveBeenCalledWith("thread_switched", 1, {
      attributes: {
        workspace_id: "ws-explicit",
        thread_id: "thread-explicit-2",
        reason: "select",
      },
    });
    expect(resumeThread).toHaveBeenCalledWith("ws-explicit", "thread-explicit-2");
  });

  it("returns null when ensureThreadForActiveWorkspace cannot create a new thread", async () => {
    vi.mocked(resumeThread)
      .mockRejectedValueOnce(new Error("initial resume failed"))
      .mockRejectedValueOnce(new Error("stale resume failed"));
    useThreadActionsMocks.startThreadForWorkspace.mockResolvedValueOnce(null);
    const { result } = renderHook(() =>
      useThreads({
        activeWorkspace: { ...activeWorkspace },
        onWorkspaceConnected: vi.fn(),
      }),
    );

    await act(async () => {
      result.current.setActiveThreadId("thread-stale");
    });
    const ensureThreadForActiveWorkspace = useThreadMessagingCapture
      .latestArgs?.ensureThreadForActiveWorkspace as (() => Promise<string | null>);

    let ensured: string | null = "placeholder";
    await act(async () => {
      ensured = await ensureThreadForActiveWorkspace();
    });

    expect(ensured).toBeNull();
    expect(useThreadActionsMocks.resumeThreadForWorkspace).toHaveBeenCalledWith(
      "ws-active",
      "thread-stale",
    );
    expect(useThreadActionsMocks.startThreadForWorkspace).toHaveBeenCalledWith("ws-active");
  });

  it("returns null when ensureThreadForActiveWorkspace cannot start from empty state", async () => {
    useThreadActionsMocks.startThreadForWorkspace.mockResolvedValueOnce(null);
    renderHook(() =>
      useThreads({
        activeWorkspace: { ...activeWorkspace },
        onWorkspaceConnected: vi.fn(),
      }),
    );
    const ensureThreadForActiveWorkspace = useThreadMessagingCapture
      .latestArgs?.ensureThreadForActiveWorkspace as (() => Promise<string | null>);

    let ensured: string | null = "placeholder";
    await act(async () => {
      ensured = await ensureThreadForActiveWorkspace();
    });

    expect(ensured).toBeNull();
    expect(useThreadActionsMocks.startThreadForWorkspace).toHaveBeenCalledWith("ws-active");
    expect(useThreadActionsMocks.resumeThreadForWorkspace).not.toHaveBeenCalled();
  });

  it("returns null when ensureThreadForWorkspace fallback creation fails", async () => {
    vi.mocked(resumeThread)
      .mockRejectedValueOnce(new Error("initial resume failed"))
      .mockRejectedValueOnce(new Error("stale resume failed"));
    useThreadActionsMocks.startThreadForWorkspace.mockResolvedValueOnce(null);

    const { result } = renderHook(() =>
      useThreads({
        activeWorkspace: { ...activeWorkspace },
        onWorkspaceConnected: vi.fn(),
      }),
    );

    await act(async () => {
      result.current.setActiveThreadId("thread-missing", "ws-active");
    });
    const ensureThreadForWorkspace = useThreadMessagingCapture
      .latestArgs?.ensureThreadForWorkspace as ((workspaceId: string) => Promise<string | null>);

    let ensured: string | null = "placeholder";
    await act(async () => {
      ensured = await ensureThreadForWorkspace("ws-active");
    });

    expect(useThreadActionsMocks.resumeThreadForWorkspace).toHaveBeenCalledWith(
      "ws-active",
      "thread-missing",
    );
    expect(useThreadActionsMocks.startThreadForWorkspace).toHaveBeenCalledWith("ws-active", {
      activate: true,
    });
    expect(ensured).toBeNull();
  });

  it("returns null when ensureThreadForWorkspace cannot start from empty state", async () => {
    useThreadActionsMocks.startThreadForWorkspace.mockResolvedValueOnce(null);
    renderHook(() =>
      useThreads({
        activeWorkspace: { ...activeWorkspace },
        onWorkspaceConnected: vi.fn(),
      }),
    );
    const ensureThreadForWorkspace = useThreadMessagingCapture
      .latestArgs?.ensureThreadForWorkspace as ((workspaceId: string) => Promise<string | null>);

    let ensured: string | null = "placeholder";
    await act(async () => {
      ensured = await ensureThreadForWorkspace("ws-active");
    });

    expect(ensured).toBeNull();
    expect(useThreadActionsMocks.startThreadForWorkspace).toHaveBeenCalledWith("ws-active", {
      activate: true,
    });
    expect(useThreadActionsMocks.resumeThreadForWorkspace).not.toHaveBeenCalled();
  });

  it("falls back to a fresh active thread when ensureThreadForWorkspace resume throws", async () => {
    vi.mocked(resumeThread)
      .mockRejectedValueOnce(new Error("initial resume failed"))
      .mockRejectedValueOnce(new Error("stale resume failed"));
    useThreadActionsMocks.startThreadForWorkspace.mockResolvedValueOnce("thread-restored");

    const { result } = renderHook(() =>
      useThreads({
        activeWorkspace: { ...activeWorkspace },
        onWorkspaceConnected: vi.fn(),
      }),
    );

    await act(async () => {
      result.current.setActiveThreadId("thread-stale", "ws-active");
    });
    const ensureThreadForWorkspace = useThreadMessagingCapture
      .latestArgs?.ensureThreadForWorkspace as ((workspaceId: string) => Promise<string | null>);

    let ensured: string | null = null;
    await act(async () => {
      ensured = await ensureThreadForWorkspace("ws-active");
    });

    expect(useThreadActionsMocks.resumeThreadForWorkspace).toHaveBeenCalledWith(
      "ws-active",
      "thread-stale",
    );
    expect(useThreadActionsMocks.startThreadForWorkspace).toHaveBeenCalledWith("ws-active", {
      activate: true,
    });
    expect(ensured).toBe("thread-restored");
  });

  it("activates the workspace thread when ensureThreadForWorkspace starts a new active thread", async () => {
    useThreadActionsMocks.startThreadForWorkspace.mockResolvedValueOnce("thread-active-new");

    const { result } = renderHook(() =>
      useThreads({
        activeWorkspace: { ...activeWorkspace },
        onWorkspaceConnected: vi.fn(),
      }),
    );
    const ensureThreadForWorkspace = useThreadMessagingCapture
      .latestArgs?.ensureThreadForWorkspace as ((workspaceId: string) => Promise<string | null>);

    let ensured: string | null = null;
    await act(async () => {
      ensured = await ensureThreadForWorkspace("ws-active");
    });

    expect(ensured).toBe("thread-active-new");
    expect(useThreadActionsMocks.startThreadForWorkspace).toHaveBeenCalledWith("ws-active", {
      activate: true,
    });
    expect(result.current.activeThreadId).toBe("thread-active-new");
  });

  it("reuses stale active workspace thread when ensureThreadForWorkspace resume succeeds", async () => {
    const { result } = renderHook(() =>
      useThreads({
        activeWorkspace: { ...activeWorkspace },
        onWorkspaceConnected: vi.fn(),
      }),
    );
    await act(async () => {
      result.current.setActiveThreadId("thread-existing", "ws-active");
    });
    const ensureThreadForWorkspace = useThreadMessagingCapture
      .latestArgs?.ensureThreadForWorkspace as ((workspaceId: string) => Promise<string | null>);
    useThreadActionsMocks.startThreadForWorkspace.mockClear();
    useThreadActionsMocks.resumeThreadForWorkspace.mockClear();

    let ensured: string | null = null;
    await act(async () => {
      ensured = await ensureThreadForWorkspace("ws-active");
    });

    expect(ensured).toBe("thread-existing");
    expect(useThreadActionsMocks.resumeThreadForWorkspace).toHaveBeenCalledWith(
      "ws-active",
      "thread-existing",
    );
    expect(useThreadActionsMocks.startThreadForWorkspace).not.toHaveBeenCalled();
  });

  it("delegates removeThread and exposes non-subagent default", async () => {
    const { result } = renderHook(() =>
      useThreads({
        activeWorkspace: { ...activeWorkspace },
        onWorkspaceConnected: vi.fn(),
      }),
    );

    await act(async () => {
      await result.current.removeThread("ws-active", "thread-remove");
    });

    expect(useThreadActionsMocks.archiveThreads).toHaveBeenCalledWith("ws-active", [
      "thread-remove",
    ]);
    expect(result.current.isSubAgentThread("ws-active", "thread-remove")).toBe(false);
  });

  it("skips auto-archive timer setup when subagent auto-archive is disabled", () => {
    const setIntervalSpy = vi.spyOn(window, "setInterval");
    renderHook(() =>
      useThreads({
        activeWorkspace: { ...activeWorkspace },
        onWorkspaceConnected: vi.fn(),
        autoArchiveSubAgentThreadsEnabled: false,
      }),
    );

    const intervalDurations = setIntervalSpy.mock.calls.map((call) => Number(call[1]));
    expect(intervalDurations).not.toContain(60_000);
    setIntervalSpy.mockRestore();
  });

  it("falls back to default auto-archive age when max age input is non-finite", () => {
    const setIntervalSpy = vi.spyOn(window, "setInterval");
    renderHook(() =>
      useThreads({
        activeWorkspace: { ...activeWorkspace },
        onWorkspaceConnected: vi.fn(),
        autoArchiveSubAgentThreadsMaxAgeMinutes: Number.NaN,
      }),
    );

    const intervalDurations = setIntervalSpy.mock.calls.map((call) => Number(call[1]));
    expect(intervalDurations).toContain(60_000);
    setIntervalSpy.mockRestore();
  });

  it("uses fallback timestamp for invalid createdAt when evaluating auto-archive", async () => {
    vi.useFakeTimers();
    try {
      const now = new Date("2026-02-26T07:00:00.000Z");
      vi.setSystemTime(now);
      useThreadActionsMocks.archiveThreads.mockResolvedValueOnce({
        allSucceeded: true,
        okIds: ["thread-sub"],
        failed: [],
        total: 1,
      });

      renderHook(() =>
        useThreads({
          activeWorkspace: { ...activeWorkspace },
          onWorkspaceConnected: vi.fn(),
          autoArchiveSubAgentThreadsMaxAgeMinutes: 5,
        }),
      );

      const eventArgs = useThreadEventHandlersCapture.latestArgs as Record<string, unknown>;
      const dispatch = eventArgs.dispatch as (action: Record<string, unknown>) => void;
      const markSubAgentThread = eventArgs.markSubAgentThread as ((threadId: string) => void);
      const recordThreadCreatedAt = eventArgs.recordThreadCreatedAt as (
        threadId: string,
        createdAt: number,
        fallbackTimestamp?: number,
      ) => void;
      const recordThreadActivity = eventArgs.recordThreadActivity as (
        workspaceId: string,
        threadId: string,
        timestamp?: number,
      ) => void;
      const staleAt = now.getTime() - 20 * 60 * 1000;

      act(() => {
        dispatch({
          type: "setThreads",
          workspaceId: "ws-active",
          threads: [{ id: "thread-sub", name: "Sub agent", updatedAt: staleAt }],
          sortKey: "updated_at",
        });
        dispatch({
          type: "setThreadParent",
          threadId: "thread-sub",
          parentId: "thread-parent",
        });
        dispatch({
          type: "setActiveThreadId",
          workspaceId: "ws-active",
          threadId: "thread-main",
        });
        markSubAgentThread("thread-sub");
        recordThreadCreatedAt("thread-sub", Number.NaN, staleAt);
        recordThreadActivity("ws-active", "thread-sub", staleAt);
      });

      await act(async () => {
        vi.advanceTimersByTime(60_000);
        await Promise.resolve();
      });

      expect(useThreadActionsMocks.archiveThreads).toHaveBeenCalledWith("ws-active", [
        "thread-sub",
      ]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("skips auto-archive when active turn is in-flight phase", async () => {
    vi.useFakeTimers();
    try {
      const now = new Date("2026-02-26T07:30:00.000Z");
      vi.setSystemTime(now);

      renderHook(() =>
        useThreads({
          activeWorkspace: { ...activeWorkspace },
          onWorkspaceConnected: vi.fn(),
          autoArchiveSubAgentThreadsMaxAgeMinutes: 5,
        }),
      );

      const eventArgs = useThreadEventHandlersCapture.latestArgs as Record<string, unknown>;
      const dispatch = eventArgs.dispatch as (action: Record<string, unknown>) => void;
      const markSubAgentThread = eventArgs.markSubAgentThread as ((threadId: string) => void);
      const recordThreadCreatedAt = eventArgs.recordThreadCreatedAt as (
        threadId: string,
        createdAt: number,
        fallbackTimestamp?: number,
      ) => void;
      const staleAt = now.getTime() - 20 * 60 * 1000;
      const phases = ["starting", "streaming", "tool_running"] as const;

      for (const phase of phases) {
        act(() => {
          dispatch({
            type: "setThreads",
            workspaceId: "ws-active",
            threads: [{ id: "thread-sub", name: "Sub agent", updatedAt: staleAt }],
            sortKey: "updated_at",
          });
          dispatch({
            type: "setThreadParent",
            threadId: "thread-sub",
            parentId: "thread-parent",
          });
          dispatch({
            type: "setActiveTurnId",
            threadId: "thread-sub",
            turnId: "turn-active",
          });
          dispatch({
            type: "setThreadPhase",
            threadId: "thread-sub",
            phase,
          });
          markSubAgentThread("thread-sub");
          recordThreadCreatedAt("thread-sub", staleAt, staleAt);
        });

        await act(async () => {
          vi.advanceTimersByTime(60_000);
          await Promise.resolve();
        });
      }

      expect(useThreadActionsMocks.archiveThreads).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("ignores empty thread ids during auto-archive candidate scan", async () => {
    vi.useFakeTimers();
    try {
      const now = new Date("2026-02-26T07:45:00.000Z");
      vi.setSystemTime(now);

      renderHook(() =>
        useThreads({
          activeWorkspace: { ...activeWorkspace },
          onWorkspaceConnected: vi.fn(),
          autoArchiveSubAgentThreadsMaxAgeMinutes: 5,
        }),
      );

      const eventArgs = useThreadEventHandlersCapture.latestArgs as Record<string, unknown>;
      const dispatch = eventArgs.dispatch as (action: Record<string, unknown>) => void;
      const staleAt = now.getTime() - 20 * 60 * 1000;

      act(() => {
        dispatch({
          type: "setThreads",
          workspaceId: "ws-active",
          threads: [{ id: "", name: "Invalid sub agent", updatedAt: staleAt }],
          sortKey: "updated_at",
        });
      });

      await act(async () => {
        vi.advanceTimersByTime(60_000);
        await Promise.resolve();
      });

      expect(useThreadActionsMocks.archiveThreads).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("auto-archives stale subagent threads when eligible", async () => {
    vi.useFakeTimers();
    try {
      const now = new Date("2026-02-26T08:00:00.000Z");
      vi.setSystemTime(now);
      useThreadActionsMocks.archiveThreads.mockResolvedValueOnce({
        allSucceeded: true,
        okIds: ["thread-sub"],
        failed: [],
        total: 1,
      });

      renderHook(() =>
        useThreads({
          activeWorkspace: { ...activeWorkspace },
          onWorkspaceConnected: vi.fn(),
          autoArchiveSubAgentThreadsMaxAgeMinutes: 5,
        }),
      );

      const eventArgs = useThreadEventHandlersCapture.latestArgs as Record<string, unknown>;
      const dispatch = eventArgs.dispatch as (action: Record<string, unknown>) => void;
      const markSubAgentThread = eventArgs.markSubAgentThread as ((threadId: string) => void);
      const recordThreadCreatedAt = eventArgs.recordThreadCreatedAt as (
        threadId: string,
        createdAt: number,
        fallbackTimestamp?: number,
      ) => void;
      const recordThreadActivity = eventArgs.recordThreadActivity as (
        workspaceId: string,
        threadId: string,
        timestamp?: number,
      ) => void;
      const staleAt = now.getTime() - 20 * 60 * 1000;

      act(() => {
        dispatch({
          type: "setThreads",
          workspaceId: "ws-active",
          threads: [{ id: "thread-sub", name: "Sub agent", updatedAt: staleAt }],
          sortKey: "updated_at",
        });
        dispatch({
          type: "setActiveThreadId",
          workspaceId: "ws-active",
          threadId: "thread-main",
        });
        dispatch({
          type: "setThreadParent",
          threadId: "thread-sub",
          parentId: "thread-parent",
        });
        markSubAgentThread("thread-sub");
        recordThreadCreatedAt("thread-sub", staleAt, staleAt);
        recordThreadActivity("ws-active", "thread-sub", staleAt);
      });

      await act(async () => {
        vi.advanceTimersByTime(60_000);
        await Promise.resolve();
      });

      expect(useThreadActionsMocks.archiveThreads).toHaveBeenCalledWith("ws-active", [
        "thread-sub",
      ]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("blocks auto-archive when subagent parent link is missing", async () => {
    vi.useFakeTimers();
    try {
      const now = new Date("2026-02-26T08:30:00.000Z");
      vi.setSystemTime(now);
      const onDebug = vi.fn();

      renderHook(() =>
        useThreads({
          activeWorkspace: { ...activeWorkspace },
          onWorkspaceConnected: vi.fn(),
          onDebug,
          autoArchiveSubAgentThreadsMaxAgeMinutes: 5,
        }),
      );

      const eventArgs = useThreadEventHandlersCapture.latestArgs as Record<string, unknown>;
      const dispatch = eventArgs.dispatch as (action: Record<string, unknown>) => void;
      const markSubAgentThread = eventArgs.markSubAgentThread as ((threadId: string) => void);
      const recordThreadCreatedAt = eventArgs.recordThreadCreatedAt as (
        threadId: string,
        createdAt: number,
        fallbackTimestamp?: number,
      ) => void;
      const recordThreadActivity = eventArgs.recordThreadActivity as (
        workspaceId: string,
        threadId: string,
        timestamp?: number,
      ) => void;
      const staleAt = now.getTime() - 20 * 60 * 1000;

      act(() => {
        dispatch({
          type: "setThreads",
          workspaceId: "ws-active",
          threads: [{ id: "thread-sub", name: "Sub agent", updatedAt: staleAt }],
          sortKey: "updated_at",
        });
        dispatch({
          type: "setActiveThreadId",
          workspaceId: "ws-active",
          threadId: "thread-main",
        });
        markSubAgentThread("thread-sub");
        recordThreadCreatedAt("thread-sub", staleAt, staleAt);
        recordThreadActivity("ws-active", "thread-sub", staleAt);
      });

      await act(async () => {
        vi.advanceTimersByTime(60_000);
        await Promise.resolve();
      });

      expect(useThreadActionsMocks.archiveThreads).not.toHaveBeenCalled();
      expect(
        onDebug.mock.calls.some(([event]) => {
          const candidate = event as {
            label?: string;
            payload?: { reason?: { hasSubAgentParent?: boolean }; threadId?: string };
          };
          return (
            candidate?.label === "thread/auto-archive blocked"
            && candidate?.payload?.threadId === "thread-sub"
            && candidate?.payload?.reason?.hasSubAgentParent === false
          );
        }),
      ).toBe(true);
      expect(onDebug).toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("returns no-op summary when removeThreads has empty workspace id", async () => {
    const { result } = renderHook(() =>
      useThreads({
        activeWorkspace: { ...activeWorkspace },
        onWorkspaceConnected: vi.fn(),
      }),
    );

    let summary:
      | { allSucceeded: boolean; okIds: string[]; failed: Array<unknown>; total: number }
      | undefined;
    await act(async () => {
      summary = await result.current.removeThreads("", ["thread-1"]);
    });

    expect(summary).toEqual({
      allSucceeded: true,
      okIds: [],
      failed: [],
      total: 0,
    });
    expect(useThreadActionsMocks.archiveThreads).not.toHaveBeenCalled();
  });

  it("returns no-op summary when removeThreads receives only blank thread ids", async () => {
    const { result } = renderHook(() =>
      useThreads({
        activeWorkspace: { ...activeWorkspace },
        onWorkspaceConnected: vi.fn(),
      }),
    );

    let summary:
      | { allSucceeded: boolean; okIds: string[]; failed: Array<unknown>; total: number }
      | undefined;
    await act(async () => {
      summary = await result.current.removeThreads("ws-active", [" ", "", "\n"]);
    });

    expect(summary).toEqual({
      allSucceeded: true,
      okIds: [],
      failed: [],
      total: 0,
    });
    expect(useThreadActionsMocks.archiveThreads).not.toHaveBeenCalled();
  });

  it("keeps subagent flag false when markSubAgentThread receives an empty thread id", () => {
    const { result } = renderHook(() =>
      useThreads({
        activeWorkspace: { ...activeWorkspace },
        onWorkspaceConnected: vi.fn(),
      }),
    );
    const eventArgs = useThreadEventHandlersCapture.latestArgs as Record<string, unknown>;
    const markSubAgentThread = eventArgs.markSubAgentThread as ((threadId: string) => void);

    act(() => {
      markSubAgentThread("");
    });

    expect(result.current.isSubAgentThread("ws-active", "")).toBe(false);
    expect(result.current.isSubAgentThread("ws-active", "thread-any")).toBe(false);
  });

  it("blocks auto-archive when subagent thread is pinned", async () => {
    vi.useFakeTimers();
    try {
      const now = new Date("2026-02-26T09:00:00.000Z");
      vi.setSystemTime(now);
      const onDebug = vi.fn();

      const { result } = renderHook(() =>
        useThreads({
          activeWorkspace: { ...activeWorkspace },
          onWorkspaceConnected: vi.fn(),
          onDebug,
          autoArchiveSubAgentThreadsMaxAgeMinutes: 5,
        }),
      );

      const eventArgs = useThreadEventHandlersCapture.latestArgs as Record<string, unknown>;
      const dispatch = eventArgs.dispatch as (action: Record<string, unknown>) => void;
      const markSubAgentThread = eventArgs.markSubAgentThread as ((threadId: string) => void);
      const recordThreadCreatedAt = eventArgs.recordThreadCreatedAt as (
        threadId: string,
        createdAt: number,
        fallbackTimestamp?: number,
      ) => void;
      const recordThreadActivity = eventArgs.recordThreadActivity as (
        workspaceId: string,
        threadId: string,
        timestamp?: number,
      ) => void;
      const staleAt = now.getTime() - 20 * 60 * 1000;

      act(() => {
        dispatch({
          type: "setThreads",
          workspaceId: "ws-active",
          threads: [{ id: "thread-sub", name: "Sub agent", updatedAt: staleAt }],
          sortKey: "updated_at",
        });
        dispatch({
          type: "setActiveThreadId",
          workspaceId: "ws-active",
          threadId: "thread-main",
        });
        dispatch({
          type: "setThreadParent",
          threadId: "thread-sub",
          parentId: "thread-parent",
        });
        markSubAgentThread("thread-sub");
        recordThreadCreatedAt("thread-sub", staleAt, staleAt);
        recordThreadActivity("ws-active", "thread-sub", staleAt);
        result.current.pinThread("ws-active", "thread-sub");
      });

      await act(async () => {
        vi.advanceTimersByTime(60_000);
        await Promise.resolve();
      });

      expect(useThreadActionsMocks.archiveThreads).not.toHaveBeenCalled();
      expect(
        onDebug.mock.calls.some(([event]) => {
          const candidate = event as { label?: string; payload?: { threadId?: string } };
          return (
            candidate?.label === "thread/auto-archive"
            && candidate?.payload?.threadId === "thread-sub"
          );
        }),
      ).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("logs eligible auto-archive payload before removing stale subagent thread", async () => {
    vi.useFakeTimers();
    try {
      const now = new Date("2026-02-26T09:30:00.000Z");
      vi.setSystemTime(now);
      const onDebug = vi.fn();
      useThreadActionsMocks.archiveThreads.mockResolvedValueOnce({
        allSucceeded: true,
        okIds: ["thread-sub"],
        failed: [],
        total: 1,
      });

      renderHook(() =>
        useThreads({
          activeWorkspace: { ...activeWorkspace },
          onWorkspaceConnected: vi.fn(),
          onDebug,
          autoArchiveSubAgentThreadsMaxAgeMinutes: 5,
        }),
      );

      const eventArgs = useThreadEventHandlersCapture.latestArgs as Record<string, unknown>;
      const dispatch = eventArgs.dispatch as (action: Record<string, unknown>) => void;
      const markSubAgentThread = eventArgs.markSubAgentThread as ((threadId: string) => void);
      const recordThreadCreatedAt = eventArgs.recordThreadCreatedAt as (
        threadId: string,
        createdAt: number,
        fallbackTimestamp?: number,
      ) => void;
      const recordThreadActivity = eventArgs.recordThreadActivity as (
        workspaceId: string,
        threadId: string,
        timestamp?: number,
      ) => void;
      const staleAt = now.getTime() - 20 * 60 * 1000;

      act(() => {
        dispatch({
          type: "setThreads",
          workspaceId: "ws-active",
          threads: [{ id: "thread-sub", name: "Sub agent", updatedAt: staleAt }],
          sortKey: "updated_at",
        });
        dispatch({
          type: "setActiveThreadId",
          workspaceId: "ws-active",
          threadId: "thread-main",
        });
        dispatch({
          type: "setThreadParent",
          threadId: "thread-sub",
          parentId: "thread-parent",
        });
        markSubAgentThread("thread-sub");
        recordThreadCreatedAt("thread-sub", staleAt, staleAt);
        recordThreadActivity("ws-active", "thread-sub", staleAt);
      });

      await act(async () => {
        vi.advanceTimersByTime(60_000);
        await Promise.resolve();
      });

      expect(useThreadActionsMocks.archiveThreads).toHaveBeenCalledWith("ws-active", [
        "thread-sub",
      ]);
      expect(
        onDebug.mock.calls.some(([event]) => {
          const candidate = event as {
            label?: string;
            payload?: { workspaceId?: string; threadId?: string; hasUnread?: boolean };
          };
          return (
            candidate?.label === "thread/auto-archive"
            && candidate?.payload?.workspaceId === "ws-active"
            && candidate?.payload?.threadId === "thread-sub"
            && candidate?.payload?.hasUnread === false
          );
        }),
      ).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("skips queued auto-archive work after hook unmount disposes timer loop", async () => {
    vi.useFakeTimers();
    try {
      const now = new Date("2026-02-26T10:00:00.000Z");
      vi.setSystemTime(now);
      const onDebug = vi.fn();

      const { unmount } = renderHook(() =>
        useThreads({
          activeWorkspace: { ...activeWorkspace },
          onWorkspaceConnected: vi.fn(),
          onDebug,
          autoArchiveSubAgentThreadsMaxAgeMinutes: 5,
        }),
      );

      const eventArgs = useThreadEventHandlersCapture.latestArgs as Record<string, unknown>;
      const dispatch = eventArgs.dispatch as (action: Record<string, unknown>) => void;
      const markSubAgentThread = eventArgs.markSubAgentThread as ((threadId: string) => void);
      const recordThreadCreatedAt = eventArgs.recordThreadCreatedAt as (
        threadId: string,
        createdAt: number,
        fallbackTimestamp?: number,
      ) => void;
      const recordThreadActivity = eventArgs.recordThreadActivity as (
        workspaceId: string,
        threadId: string,
        timestamp?: number,
      ) => void;
      const staleAt = now.getTime() - 20 * 60 * 1000;

      act(() => {
        dispatch({
          type: "setThreads",
          workspaceId: "ws-active",
          threads: [{ id: "thread-sub", name: "Sub agent", updatedAt: staleAt }],
          sortKey: "updated_at",
        });
        dispatch({
          type: "setActiveThreadId",
          workspaceId: "ws-active",
          threadId: "thread-main",
        });
        dispatch({
          type: "setThreadParent",
          threadId: "thread-sub",
          parentId: "thread-parent",
        });
        markSubAgentThread("thread-sub");
        recordThreadCreatedAt("thread-sub", staleAt, staleAt);
        recordThreadActivity("ws-active", "thread-sub", staleAt);
      });

      act(() => {
        vi.advanceTimersByTime(60_000);
        unmount();
      });
      await act(async () => {
        await Promise.resolve();
      });

      expect(useThreadActionsMocks.archiveThreads).not.toHaveBeenCalled();
      expect(
        onDebug.mock.calls.some(([event]) => {
          const candidate = event as { label?: string };
          return candidate?.label === "thread/auto-archive";
        }),
      ).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});
