// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as Sentry from "@sentry/react";
import { resumeThread, setThreadName } from "../../../services/tauri";
import { useThreads } from "./useThreads";

const useThreadActionsMocks = vi.hoisted(() => ({
  startThreadForWorkspace: vi.fn(),
  forkThreadForWorkspace: vi.fn(),
  resumeThreadForWorkspace: vi.fn(),
  refreshThread: vi.fn(),
  loadOlderMessagesForThread: vi.fn(),
  resetWorkspaceThreads: vi.fn(),
  listThreadsForWorkspace: vi.fn(),
  loadOlderThreadsForWorkspace: vi.fn(),
  archiveThreads: vi.fn(async () => ({ allSucceeded: true, okIds: [], failed: [], total: 0 })),
}));

const useThreadMessagingCapture = vi.hoisted(() => ({
  latestArgs: null as Record<string, unknown> | null,
}));

const useThreadEventHandlersCapture = vi.hoisted(() => ({
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
  archiveThreads: vi.fn(async () => ({ allSucceeded: true, okIds: [], failed: [], total: 0 })),
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
  useThreadActions: vi.fn(() => useThreadActionsMocks),
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
      okIds: [],
      failed: [],
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
  });

  it("returns null when ensureThreadForWorkspace fallback creation fails", async () => {
    useThreadActionsMocks.resumeThreadForWorkspace.mockResolvedValueOnce(false);
    useThreadActionsMocks.startThreadForWorkspace.mockResolvedValueOnce(null);

    const { result } = renderHook(() =>
      useThreads({
        activeWorkspace: { ...activeWorkspace },
        onWorkspaceConnected: vi.fn(),
      }),
    );
    const ensureThreadForWorkspace = useThreadMessagingCapture
      .latestArgs?.ensureThreadForWorkspace as ((workspaceId: string) => Promise<string | null>);

    await act(async () => {
      result.current.setActiveThreadId("thread-missing", "ws-explicit");
    });

    let ensured: string | null = "placeholder";
    await act(async () => {
      ensured = await ensureThreadForWorkspace("ws-explicit");
    });

    expect(useThreadActionsMocks.resumeThreadForWorkspace).toHaveBeenCalledWith(
      "ws-explicit",
      "thread-missing",
    );
    expect(useThreadActionsMocks.startThreadForWorkspace).toHaveBeenCalledWith("ws-explicit", {
      activate: false,
    });
    expect(ensured).toBeNull();
  });
});
