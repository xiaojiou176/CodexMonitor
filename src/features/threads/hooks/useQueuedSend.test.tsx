// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspaceInfo } from "../../../types";
import { useQueuedSend } from "./useQueuedSend";

const {
  evaluateThreadStaleStateMock,
  flushScheduledLocalStorageWritesMock,
  hasRunningCommandExecutionMock,
} = vi.hoisted(() => ({
  evaluateThreadStaleStateMock: vi.fn(),
  flushScheduledLocalStorageWritesMock: vi.fn(),
  hasRunningCommandExecutionMock: vi.fn(),
}));

vi.mock("../../../utils/localStorageWriteScheduler", () => ({
  scheduleLocalStorageWrite: (_key: string, write: () => void) => {
    write();
  },
  flushScheduledLocalStorageWrites: flushScheduledLocalStorageWritesMock,
}));

vi.mock("./threadStalePolicy", () => ({
  evaluateThreadStaleState: evaluateThreadStaleStateMock,
  hasRunningCommandExecution: hasRunningCommandExecutionMock,
}));

const workspace: WorkspaceInfo = {
  id: "workspace-1",
  name: "CodexMonitor",
  path: "/tmp/codex",
  connected: true,
  settings: { sidebarCollapsed: false },
};

const pendingResolutions: Array<() => void> = [];

const makeOptions = (
  overrides: Partial<Parameters<typeof useQueuedSend>[0]> = {},
) => ({
  activeThreadId: "thread-1",
  activeTurnId: null,
  isProcessing: false,
  isReviewing: false,
  steerEnabled: false,
  appsEnabled: true,
  activeWorkspace: workspace,
  connectWorkspace: vi.fn().mockResolvedValue(undefined),
  startThreadForWorkspace: vi.fn().mockResolvedValue("thread-1"),
  sendUserMessage: vi.fn().mockResolvedValue(undefined),
  sendUserMessageToThread: vi.fn().mockResolvedValue(undefined),
  startFork: vi.fn().mockResolvedValue(undefined),
  startReview: vi.fn().mockResolvedValue(undefined),
  startResume: vi.fn().mockResolvedValue(undefined),
  startCompact: vi.fn().mockResolvedValue(undefined),
  startApps: vi.fn().mockResolvedValue(undefined),
  startMcp: vi.fn().mockResolvedValue(undefined),
  startStatus: vi.fn().mockResolvedValue(undefined),
  clearActiveImages: vi.fn(),
  ...overrides,
});

function createPendingPromise(): Promise<void> {
  return new Promise<void>((resolve) => {
    pendingResolutions.push(resolve);
  });
}

async function flushAsyncTicks(ticks = 1): Promise<void> {
  for (let index = 0; index < ticks; index += 1) {
    await act(async () => {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 0);
      });
    });
  }
}

describe("useQueuedSend", () => {
  beforeEach(() => {
    window.localStorage.clear();
    flushScheduledLocalStorageWritesMock.mockClear();
    evaluateThreadStaleStateMock.mockReset();
    evaluateThreadStaleStateMock.mockReturnValue({
      isStale: false,
      processingAgeMs: 0,
      silenceMs: 0,
      silenceThresholdMs: 90_000,
    });
    hasRunningCommandExecutionMock.mockReset();
    hasRunningCommandExecutionMock.mockReturnValue(false);
  });

  afterEach(async () => {
    while (pendingResolutions.length > 0) {
      pendingResolutions.pop()?.();
    }
    await flushAsyncTicks(1);
    vi.clearAllTimers();
  });

  it("sanitizes persisted queue payloads and keeps only valid queued messages", () => {
    window.localStorage.setItem(
      "codexmonitor.queuedMessagesByThread",
      JSON.stringify({
        "thread-1": [
          { id: "ok-1", text: "valid", createdAt: 1, images: ["img-1"] },
          { id: 123, text: "bad id", createdAt: 2 },
          { id: "bad-2", text: "bad createdAt", createdAt: "2" },
          { id: "bad-3", text: "bad images", createdAt: 3, images: [1] },
        ],
        "thread-2": "not-an-array",
      }),
    );

    const options = makeOptions({ activeThreadId: "thread-1", isProcessing: true });
    const { result } = renderHook((props) => useQueuedSend(props), {
      initialProps: options,
    });

    expect(result.current.activeQueue.map((item) => item.id)).toEqual(["ok-1"]);
    expect(result.current.activeQueue[0]?.workspaceId).toBe("workspace-1");
  });

  it("falls back to empty queue when persisted queue JSON is malformed", () => {
    window.localStorage.setItem(
      "codexmonitor.queuedMessagesByThread",
      "{ this is not valid json",
    );

    const options = makeOptions({ activeThreadId: "thread-1" });
    const { result } = renderHook((props) => useQueuedSend(props), {
      initialProps: options,
    });

    expect(result.current.activeQueue).toEqual([]);
    expect(result.current.queueHealthEntries).toEqual([]);
  });

  it("routes slash commands to the matching command handlers", async () => {
    const options = makeOptions();
    const { result } = renderHook((props) => useQueuedSend(props), {
      initialProps: options,
    });

    const commandCases = [
      { text: "/fork branch", fn: options.startFork },
      { text: "/review pr", fn: options.startReview },
      { text: "/resume task", fn: options.startResume },
      { text: "/compact now", fn: options.startCompact },
      { text: "/mcp status", fn: options.startMcp },
      { text: "/status", fn: options.startStatus },
      { text: "/apps", fn: options.startApps },
    ];

    for (const commandCase of commandCases) {
      await act(async () => {
        await result.current.handleSend(commandCase.text);
      });
      expect(commandCase.fn).toHaveBeenCalledWith(commandCase.text.trim());
    }

    expect(options.sendUserMessage).not.toHaveBeenCalled();
    expect(options.clearActiveImages).toHaveBeenCalledTimes(commandCases.length);
  });

  it("handles /new command without posting a follow-up when no prompt body exists", async () => {
    const options = makeOptions({
      startThreadForWorkspace: vi.fn().mockResolvedValue("thread-new"),
    });
    const { result } = renderHook((props) => useQueuedSend(props), {
      initialProps: options,
    });

    await act(async () => {
      await result.current.handleSend("/new");
    });

    expect(options.startThreadForWorkspace).toHaveBeenCalledWith("workspace-1");
    expect(options.sendUserMessageToThread).not.toHaveBeenCalled();
    expect(options.sendUserMessage).not.toHaveBeenCalled();
  });

  it("sends queued messages one at a time after processing completes", async () => {
    const options = makeOptions();
    const { result, rerender } = renderHook(
      (props) => useQueuedSend(props),
      { initialProps: options },
    );

    await act(async () => {
      await result.current.queueMessage("First");
      await result.current.queueMessage("Second");
    });

    await flushAsyncTicks();

    expect(options.sendUserMessage).toHaveBeenCalledTimes(1);
    expect(options.sendUserMessage).toHaveBeenCalledWith("First", []);

    await act(async () => {
      rerender({ ...options, isProcessing: true });
    });
    await flushAsyncTicks();
    await act(async () => {
      rerender({ ...options, isProcessing: false });
    });
    await flushAsyncTicks();

    expect(options.sendUserMessage).toHaveBeenCalledTimes(2);
    expect(options.sendUserMessage).toHaveBeenLastCalledWith("Second", []);
  });

  it("waits for processing to start before sending the next queued message", async () => {
    const options = makeOptions();
    const { result } = renderHook((props) => useQueuedSend(props), {
      initialProps: options,
    });

    await act(async () => {
      await result.current.queueMessage("Alpha");
      await result.current.queueMessage("Beta");
    });

    await flushAsyncTicks();

    expect(options.sendUserMessage).toHaveBeenCalledTimes(1);
    expect(options.sendUserMessage).toHaveBeenCalledWith("Alpha", []);
  });

  it("queues send while processing", async () => {
    const options = makeOptions({ isProcessing: true, steerEnabled: false });
    const { result } = renderHook((props) => useQueuedSend(props), {
      initialProps: options,
    });

    await act(async () => {
      await result.current.handleSend("Queued");
    });

    expect(options.sendUserMessage).not.toHaveBeenCalled();
    expect(result.current.activeQueue).toHaveLength(1);
    expect(result.current.activeQueue[0]?.text).toBe("Queued");
  });

  it("queues message for a non-active thread and dispatches via thread sender", async () => {
    const workspaceTwo: WorkspaceInfo = {
      ...workspace,
      id: "workspace-2",
      name: "Another",
      path: "/tmp/another",
    };
    const options = makeOptions({
      activeThreadId: "thread-1",
      activeWorkspace: workspace,
      threadStatusById: {
        "thread-1": { isProcessing: false, isReviewing: false },
        "thread-2": { isProcessing: false, isReviewing: false },
      },
      threadWorkspaceById: {
        "thread-1": "workspace-1",
        "thread-2": "workspace-2",
      },
      workspacesById: new Map([
        ["workspace-1", workspace],
        ["workspace-2", workspaceTwo],
      ]),
    });
    const { result } = renderHook((props) => useQueuedSend(props), {
      initialProps: options,
    });

    await act(async () => {
      await result.current.queueMessageForThread("thread-2", "continue background");
    });

    await flushAsyncTicks(2);

    expect(options.sendUserMessageToThread).toHaveBeenCalledTimes(1);
    expect(options.sendUserMessageToThread).toHaveBeenCalledWith(
      workspaceTwo,
      "thread-2",
      "continue background",
      [],
    );
    expect(options.sendUserMessage).not.toHaveBeenCalled();
    expect(options.clearActiveImages).not.toHaveBeenCalled();
  });

  it("ignores queueMessageForThread when thread workspace is unresolved", async () => {
    const options = makeOptions({
      activeThreadId: "thread-1",
      activeWorkspace: workspace,
      threadWorkspaceById: {
        "thread-1": "workspace-1",
      },
      workspacesById: new Map([["workspace-1", workspace]]),
    });
    const { result } = renderHook((props) => useQueuedSend(props), {
      initialProps: options,
    });

    await act(async () => {
      await result.current.queueMessageForThread("thread-2", "missing mapping");
    });

    await flushAsyncTicks(2);

    expect(options.sendUserMessageToThread).not.toHaveBeenCalled();
    expect(result.current.queuedByThread["thread-2"] ?? []).toEqual([]);
  });

  it("does not flush active queue while active turn id exists", async () => {
    const options = makeOptions({
      activeTurnId: "turn-1",
      isProcessing: false,
      threadStatusById: {
        "thread-1": {
          isProcessing: false,
          isReviewing: false,
          processingStartedAt: null,
        },
      },
    });

    const { result, rerender } = renderHook((props) => useQueuedSend(props), {
      initialProps: options,
    });

    await act(async () => {
      await result.current.queueMessage("wait-for-turn-end");
    });

    await flushAsyncTicks(2);

    expect(options.sendUserMessage).not.toHaveBeenCalled();
    expect(result.current.activeQueue.map((item) => item.text)).toEqual(["wait-for-turn-end"]);

    await act(async () => {
      rerender({
        ...options,
        activeTurnId: null,
        threadStatusById: {
          "thread-1": {
            isProcessing: false,
            isReviewing: false,
            processingStartedAt: null,
          },
        },
      });
    });

    await flushAsyncTicks(2);

    expect(options.sendUserMessage).toHaveBeenCalledTimes(1);
    expect(options.sendUserMessage).toHaveBeenCalledWith("wait-for-turn-end", []);
  });

  it("queues while processing when steer is enabled", async () => {
    const options = makeOptions({ isProcessing: true, steerEnabled: true });
    const { result } = renderHook((props) => useQueuedSend(props), {
      initialProps: options,
    });

    await act(async () => {
      await result.current.handleSend("Steer");
    });

    expect(options.sendUserMessage).not.toHaveBeenCalled();
    expect(result.current.activeQueue).toHaveLength(1);
    expect(result.current.activeQueue[0]?.text).toBe("Steer");
  });

  it("allows steering queued message while processing when turn id is unavailable", async () => {
    const options = makeOptions({
      isProcessing: true,
      steerEnabled: true,
      activeTurnId: null,
    });
    const { result } = renderHook((props) => useQueuedSend(props), {
      initialProps: options,
    });

    await act(async () => {
      await result.current.queueMessage("Wait for turn");
    });

    const queued = result.current.activeQueue[0];
    expect(queued?.text).toBe("Wait for turn");

    await act(async () => {
      const ok = await result.current.steerQueuedMessage("thread-1", queued?.id ?? "");
      expect(ok).toBeTruthy();
    });

    expect(options.sendUserMessage).toHaveBeenCalledTimes(1);
    expect(options.sendUserMessage).toHaveBeenCalledWith("Wait for turn", [], {
      forceSteer: true,
    });
    expect(result.current.activeQueue).toHaveLength(0);
  });

  it("allows steering queued message when idle", async () => {
    const options = makeOptions({
      isProcessing: false,
      steerEnabled: true,
      activeTurnId: null,
      activeWorkspace: null,
    });
    const { result } = renderHook((props) => useQueuedSend(props), {
      initialProps: options,
    });

    await act(async () => {
      await result.current.queueMessage("steer while idle");
    });

    const queued = result.current.activeQueue[0];
    expect(queued?.text).toBe("steer while idle");

    await act(async () => {
      const ok = await result.current.steerQueuedMessage("thread-1", queued?.id ?? "");
      expect(ok).toBeTruthy();
    });

    expect(options.sendUserMessage).toHaveBeenCalledTimes(1);
    expect(options.sendUserMessage).toHaveBeenCalledWith("steer while idle", [], {
      forceSteer: true,
    });
    expect(result.current.activeQueue).toHaveLength(0);
  });

  it("does not steer queued message when steer mode is disabled", async () => {
    const options = makeOptions({
      isProcessing: false,
      steerEnabled: false,
      activeTurnId: null,
      activeWorkspace: null,
    });
    const { result } = renderHook((props) => useQueuedSend(props), {
      initialProps: options,
    });

    await act(async () => {
      await result.current.queueMessage("steer with toggle off");
    });

    const queued = result.current.activeQueue[0];
    expect(queued?.text).toBe("steer with toggle off");

    await act(async () => {
      const ok = await result.current.steerQueuedMessage("thread-1", queued?.id ?? "");
      expect(ok).toBe(false);
    });

    expect(options.sendUserMessage).not.toHaveBeenCalled();
    expect(result.current.activeQueue).toHaveLength(1);
  });

  it("queues while processing when steer is enabled and turn id exists", async () => {
    const options = makeOptions({
      isProcessing: true,
      steerEnabled: true,
      activeTurnId: "turn-1",
    });
    const { result } = renderHook((props) => useQueuedSend(props), {
      initialProps: options,
    });

    await act(async () => {
      await result.current.handleSend("Steer direct send");
    });

    expect(options.sendUserMessage).not.toHaveBeenCalled();
    expect(result.current.activeQueue).toHaveLength(1);
    expect(result.current.activeQueue[0]?.text).toBe("Steer direct send");
  });

  it("queues when active turn id exists and steer is enabled even if processing is false", async () => {
    const options = makeOptions({
      isProcessing: false,
      steerEnabled: true,
      activeTurnId: "turn-1",
    });
    const { result } = renderHook((props) => useQueuedSend(props), {
      initialProps: options,
    });

    await act(async () => {
      await result.current.handleSend("Steer with turn id only");
    });

    expect(options.sendUserMessage).not.toHaveBeenCalled();
    expect(result.current.activeQueue).toHaveLength(1);
    expect(result.current.activeQueue[0]?.text).toBe("Steer with turn id only");
  });

  it("allows steering queued message when active turn id exists and processing is false", async () => {
    const options = makeOptions({
      isProcessing: false,
      steerEnabled: true,
      activeTurnId: "turn-1",
    });
    const { result } = renderHook((props) => useQueuedSend(props), {
      initialProps: options,
    });

    await act(async () => {
      await result.current.queueMessage("queued via steer button");
    });

    const queued = result.current.activeQueue[0];
    expect(queued?.text).toBe("queued via steer button");

    await act(async () => {
      const ok = await result.current.steerQueuedMessage("thread-1", queued?.id ?? "");
      expect(ok).toBeTruthy();
    });

    expect(options.sendUserMessage).toHaveBeenCalledTimes(1);
    expect(options.sendUserMessage).toHaveBeenCalledWith("queued via steer button", [], {
      forceSteer: true,
    });
    expect(result.current.activeQueue).toHaveLength(0);
  });

  it("retries queued send after failure", async () => {
    const options = makeOptions({
      sendUserMessage: vi
        .fn()
        .mockRejectedValueOnce(new Error("boom"))
        .mockResolvedValueOnce(undefined),
    });
    const { result } = renderHook((props) => useQueuedSend(props), {
      initialProps: options,
    });

    await act(async () => {
      await result.current.queueMessage("Retry");
    });

    await flushAsyncTicks();
    await flushAsyncTicks();

    expect(options.sendUserMessage).toHaveBeenCalledTimes(2);
    expect(options.sendUserMessage).toHaveBeenLastCalledWith("Retry", []);
  });

  it("queues messages per thread and only flushes the active thread without workspace mapping", async () => {
    const options = makeOptions({ isProcessing: true });
    const { result, rerender } = renderHook(
      (props) => useQueuedSend(props),
      { initialProps: options },
    );

    await act(async () => {
      await result.current.queueMessage("Thread-1");
    });

    await act(async () => {
      rerender({ ...options, activeThreadId: "thread-2", isProcessing: false });
    });
    await flushAsyncTicks();

    expect(options.sendUserMessage).not.toHaveBeenCalled();
    expect(result.current.queueHealthEntries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          threadId: "thread-1",
          queueLength: 1,
          inFlight: false,
          blockedReason: "workspace_unresolved",
          lastFailureReason: null,
        }),
      ]),
    );

    await act(async () => {
      rerender({ ...options, activeThreadId: "thread-1", isProcessing: false });
    });
    await flushAsyncTicks();

    expect(options.sendUserMessage).toHaveBeenCalledTimes(1);
    expect(options.sendUserMessage).toHaveBeenCalledWith("Thread-1", []);
  });

  it("drains queued background thread even while active thread is processing", async () => {
    const workspaceTwo: WorkspaceInfo = {
      ...workspace,
      id: "workspace-2",
      name: "Another",
      path: "/tmp/another",
    };
    const options = makeOptions({
      activeThreadId: "thread-1",
      activeWorkspace: workspace,
      isProcessing: true,
      threadStatusById: {
        "thread-1": { isProcessing: false, isReviewing: false },
        "thread-2": { isProcessing: false, isReviewing: false },
      },
      threadWorkspaceById: {
        "thread-1": "workspace-1",
        "thread-2": "workspace-2",
      },
      workspacesById: new Map([
        ["workspace-1", workspace],
        ["workspace-2", workspaceTwo],
      ]),
    });
    const { result, rerender } = renderHook((props) => useQueuedSend(props), {
      initialProps: options,
    });

    await act(async () => {
      await result.current.queueMessage("wait until global processing ends");
    });

    await act(async () => {
      rerender({
        ...options,
        activeThreadId: "thread-2",
        activeTurnId: "turn-2",
        activeWorkspace: workspaceTwo,
        isProcessing: true,
        isReviewing: false,
      });
    });

    await flushAsyncTicks(2);

    expect(options.sendUserMessageToThread).toHaveBeenCalledTimes(1);
    expect(options.sendUserMessageToThread).toHaveBeenCalledWith(
      workspace,
      "thread-1",
      "wait until global processing ends",
      [],
    );
    expect(result.current.queuedByThread["thread-1"] ?? []).toEqual([]);

    await act(async () => {
      rerender({
        ...options,
        activeThreadId: "thread-2",
        activeTurnId: null,
        activeWorkspace: workspaceTwo,
        isProcessing: false,
        isReviewing: false,
      });
    });

    await flushAsyncTicks(2);

    expect(options.sendUserMessageToThread).toHaveBeenCalledTimes(1);
    expect(result.current.queuedByThread["thread-1"] ?? []).toEqual([]);
    expect(
      result.current.queueHealthEntries.find((entry) => entry.threadId === "thread-1")
        ?.blockedReason,
    ).toBe("awaiting_turn_start_event");
  });

  it("drains active-thread queue even when another thread is globally processing", async () => {
    const workspaceTwo: WorkspaceInfo = {
      ...workspace,
      id: "workspace-2",
      name: "Another",
      path: "/tmp/another",
    };
    const options = makeOptions({
      activeThreadId: "thread-1",
      activeWorkspace: workspace,
      activeTurnId: null,
      isProcessing: false,
      threadStatusById: {
        "thread-1": { isProcessing: false, isReviewing: false },
        "thread-2": {
          isProcessing: true,
          isReviewing: false,
          processingStartedAt: Date.now(),
        },
      },
      threadWorkspaceById: {
        "thread-1": "workspace-1",
        "thread-2": "workspace-2",
      },
      workspacesById: new Map([
        ["workspace-1", workspace],
        ["workspace-2", workspaceTwo],
      ]),
    });
    const { result } = renderHook((props) => useQueuedSend(props), {
      initialProps: options,
    });

    await act(async () => {
      await result.current.queueMessage("active thread should still drain");
    });

    await flushAsyncTicks(2);

    expect(options.sendUserMessage).toHaveBeenCalledTimes(1);
    expect(options.sendUserMessage).toHaveBeenCalledWith("active thread should still drain", []);
  });

  it("dispatches non-active queued message when workspace mapping is available", async () => {
    const workspaceTwo: WorkspaceInfo = {
      ...workspace,
      id: "workspace-2",
      name: "Another",
      path: "/tmp/another",
    };
    const options = makeOptions({
      activeThreadId: "thread-1",
      activeWorkspace: workspace,
      isProcessing: true,
      threadStatusById: {
        "thread-1": { isProcessing: false, isReviewing: false },
        "thread-2": { isProcessing: false, isReviewing: false },
      },
      threadWorkspaceById: {
        "thread-1": "workspace-1",
        "thread-2": "workspace-2",
      },
      workspacesById: new Map([
        ["workspace-1", workspace],
        ["workspace-2", workspaceTwo],
      ]),
    });
    const { result, rerender } = renderHook((props) => useQueuedSend(props), {
      initialProps: options,
    });

    await act(async () => {
      await result.current.queueMessage("Thread-1 background drain");
    });

    await act(async () => {
      rerender({
        ...options,
        activeThreadId: "thread-2",
        activeTurnId: null,
        activeWorkspace: workspaceTwo,
        isProcessing: false,
        isReviewing: false,
      });
    });
    await flushAsyncTicks();

    expect(options.sendUserMessageToThread).toHaveBeenCalledTimes(1);
    expect(options.sendUserMessageToThread).toHaveBeenCalledWith(
      workspace,
      "thread-1",
      "Thread-1 background drain",
      [],
    );
    expect(result.current.queuedByThread["thread-1"] ?? []).toEqual([]);
    expect(options.sendUserMessage).not.toHaveBeenCalled();
  });

  it("dispatches non-active queued thread even when another thread is processing", async () => {
    const workspaceTwo: WorkspaceInfo = {
      ...workspace,
      id: "workspace-2",
      name: "Another",
      path: "/tmp/another",
    };

    const options = makeOptions({
      activeThreadId: "thread-2",
      activeWorkspace: workspaceTwo,
      isProcessing: true,
      threadStatusById: {
        "thread-1": {
          isProcessing: true,
          isReviewing: false,
          processingStartedAt: Date.now(),
        },
        "thread-2": {
          isProcessing: false,
          isReviewing: false,
          processingStartedAt: null,
        },
      },
      threadWorkspaceById: {
        "thread-1": "workspace-1",
        "thread-2": "workspace-2",
      },
      workspacesById: new Map([
        ["workspace-1", workspace],
        ["workspace-2", workspaceTwo],
      ]),
    });

    const { result, rerender } = renderHook((props) => useQueuedSend(props), {
      initialProps: options,
    });

    await act(async () => {
      await result.current.queueMessage("thread-2 waits for global processing");
    });

    await act(async () => {
      rerender({
        ...options,
        activeThreadId: "thread-1",
        activeWorkspace: workspace,
        isProcessing: true,
        threadStatusById: {
          "thread-1": {
            isProcessing: true,
            isReviewing: false,
            processingStartedAt: Date.now(),
          },
          "thread-2": {
            isProcessing: false,
            isReviewing: false,
            processingStartedAt: null,
          },
        },
      });
    });

    await flushAsyncTicks(2);

    expect(options.sendUserMessageToThread).toHaveBeenCalledTimes(1);
    expect(options.sendUserMessageToThread).toHaveBeenCalledWith(
      workspaceTwo,
      "thread-2",
      "thread-2 waits for global processing",
      [],
    );

    await act(async () => {
      rerender({
        ...options,
        activeThreadId: "thread-1",
        activeWorkspace: workspace,
        isProcessing: false,
        threadStatusById: {
          "thread-1": {
            isProcessing: false,
            isReviewing: false,
            processingStartedAt: null,
          },
          "thread-2": {
            isProcessing: false,
            isReviewing: false,
            processingStartedAt: null,
          },
        },
      });
    });

    await flushAsyncTicks(2);

    expect(options.sendUserMessageToThread).toHaveBeenCalledTimes(1);
    expect(result.current.queuedByThread["thread-2"] ?? []).toEqual([]);
  });

  it("dispatches non-active queued thread using queued workspace id fallback", async () => {
    const workspaceTwo: WorkspaceInfo = {
      ...workspace,
      id: "workspace-2",
      name: "Another",
      path: "/tmp/another",
    };
    const options = makeOptions({
      activeThreadId: "thread-1",
      activeWorkspace: workspace,
      isProcessing: true,
      threadStatusById: {
        "thread-1": { isProcessing: false, isReviewing: false },
        "thread-2": { isProcessing: false, isReviewing: false },
      },
      threadWorkspaceById: {
        "thread-2": "workspace-2",
      },
      workspacesById: new Map([
        ["workspace-1", workspace],
        ["workspace-2", workspaceTwo],
      ]),
    });
    const { result, rerender } = renderHook((props) => useQueuedSend(props), {
      initialProps: options,
    });

    await act(async () => {
      await result.current.queueMessage("Thread-1 queued while active");
    });

    await act(async () => {
      rerender({
        ...options,
        activeThreadId: "thread-2",
        activeTurnId: null,
        activeWorkspace: workspaceTwo,
        isProcessing: false,
        isReviewing: false,
      });
    });

    await flushAsyncTicks();

    expect(options.sendUserMessageToThread).toHaveBeenCalledTimes(1);
    expect(options.sendUserMessageToThread).toHaveBeenCalledWith(
      workspace,
      "thread-1",
      "Thread-1 queued while active",
      [],
    );
    expect(result.current.queuedByThread["thread-1"] ?? []).toEqual([]);
  });

  it("drains two queued background messages without switching to target thread", async () => {
    const workspaceTwo: WorkspaceInfo = {
      ...workspace,
      id: "workspace-2",
      name: "Another",
      path: "/tmp/another",
    };
    const options = makeOptions({
      activeThreadId: "thread-1",
      activeWorkspace: workspace,
      isProcessing: false,
      threadStatusById: {
        "thread-1": { isProcessing: false, isReviewing: false },
        "thread-2": { isProcessing: false, isReviewing: false, processingStartedAt: null },
      },
      threadWorkspaceById: {
        "thread-1": "workspace-1",
        "thread-2": "workspace-2",
      },
      workspacesById: new Map([
        ["workspace-1", workspace],
        ["workspace-2", workspaceTwo],
      ]),
    });

    const { result, rerender } = renderHook((props) => useQueuedSend(props), {
      initialProps: options,
    });

    await act(async () => {
      await result.current.queueMessageForThread("thread-2", "bg-first");
      await result.current.queueMessageForThread("thread-2", "bg-second");
    });

    await flushAsyncTicks(2);

    expect(options.sendUserMessageToThread).toHaveBeenCalledTimes(1);
    expect(options.sendUserMessageToThread).toHaveBeenNthCalledWith(
      1,
      workspaceTwo,
      "thread-2",
      "bg-first",
      [],
    );
    expect(result.current.queuedByThread["thread-2"]?.map((item) => item.text)).toEqual([
      "bg-second",
    ]);

    await act(async () => {
      rerender({
        ...options,
        activeThreadId: "thread-1",
        activeWorkspace: workspace,
        threadStatusById: {
          "thread-1": { isProcessing: false, isReviewing: false },
          "thread-2": { isProcessing: true, isReviewing: false, processingStartedAt: Date.now() },
        },
      });
    });

    await flushAsyncTicks(2);

    await act(async () => {
      rerender({
        ...options,
        activeThreadId: "thread-1",
        activeWorkspace: workspace,
        threadStatusById: {
          "thread-1": { isProcessing: false, isReviewing: false },
          "thread-2": { isProcessing: false, isReviewing: false, processingStartedAt: null },
        },
      });
    });

    await flushAsyncTicks(4);

    expect(options.sendUserMessageToThread).toHaveBeenCalledTimes(2);
    expect(options.sendUserMessageToThread).toHaveBeenNthCalledWith(
      2,
      workspaceTwo,
      "thread-2",
      "bg-second",
      [],
    );
    expect(result.current.queuedByThread["thread-2"] ?? []).toEqual([]);

    await act(async () => {
      rerender({
        ...options,
        activeThreadId: "thread-1",
        activeWorkspace: workspace,
        threadStatusById: {
          "thread-1": { isProcessing: false, isReviewing: false },
          "thread-2": { isProcessing: true, isReviewing: false, processingStartedAt: Date.now() },
        },
      });
    });

    await flushAsyncTicks(2);

    await act(async () => {
      rerender({
        ...options,
        activeThreadId: "thread-1",
        activeWorkspace: workspace,
        threadStatusById: {
          "thread-1": { isProcessing: false, isReviewing: false },
          "thread-2": { isProcessing: false, isReviewing: false, processingStartedAt: null },
        },
      });
    });

    await flushAsyncTicks(2);

    const threadTwoHealth = result.current.queueHealthEntries.find((entry) => entry.threadId === "thread-2");
    expect(threadTwoHealth?.queueLength ?? 0).toBe(0);
    expect(threadTwoHealth?.inFlight ?? false).toBe(false);
  });

  it("keeps background queue serial when switching threads", async () => {
    const workspaceTwo: WorkspaceInfo = {
      ...workspace,
      id: "workspace-2",
      name: "Another",
      path: "/tmp/another",
    };
    const options = makeOptions({
      activeThreadId: "thread-1",
      activeWorkspace: workspace,
      isProcessing: true,
      threadStatusById: {
        "thread-1": { isProcessing: false, isReviewing: false },
        "thread-2": { isProcessing: false, isReviewing: false },
      },
      threadWorkspaceById: {
        "thread-1": "workspace-1",
        "thread-2": "workspace-2",
      },
      workspacesById: new Map([
        ["workspace-1", workspace],
        ["workspace-2", workspaceTwo],
      ]),
    });
    const { result, rerender } = renderHook((props) => useQueuedSend(props), {
      initialProps: options,
    });

    await act(async () => {
      await result.current.queueMessage("Background first");
      await result.current.queueMessage("Background second");
    });

    await act(async () => {
      rerender({
        ...options,
        activeThreadId: "thread-2",
        activeTurnId: null,
        activeWorkspace: workspaceTwo,
        isProcessing: false,
        isReviewing: false,
      });
    });

    await flushAsyncTicks(4);

    expect(options.sendUserMessageToThread).toHaveBeenCalledTimes(1);
    expect(options.sendUserMessageToThread).toHaveBeenNthCalledWith(
      1,
      workspace,
      "thread-1",
      "Background first",
      [],
    );
    expect(result.current.queuedByThread["thread-1"]?.map((item) => item.text)).toEqual([
      "Background second",
    ]);
    expect(
      result.current.queueHealthEntries.find((entry) => entry.threadId === "thread-1")
        ?.blockedReason,
    ).toBe("awaiting_turn_start_event");
  });

  it("connects workspace before sending when disconnected", async () => {
    const connectWorkspace = vi.fn().mockResolvedValue(undefined);
    const options = makeOptions({
      activeWorkspace: { ...workspace, connected: false },
      connectWorkspace,
    });
    const { result } = renderHook((props) => useQueuedSend(props), {
      initialProps: options,
    });

    await act(async () => {
      await result.current.handleSend("Connect");
    });

    expect(connectWorkspace).toHaveBeenCalledWith({
      ...workspace,
      connected: false,
    });
    expect(options.sendUserMessage).toHaveBeenCalledWith("Connect", []);
  });

  it("returns empty queue state when no queued items exist", () => {
    const options = makeOptions({
      activeThreadId: "thread-empty",
      threadStatusById: {},
    });

    const { result } = renderHook((props) => useQueuedSend(props), {
      initialProps: options,
    });

    expect(result.current.activeQueue).toEqual([]);
    expect(result.current.queueHealthEntries).toEqual([]);
  });

  it("supports duplicate enqueue requests for the same text", async () => {
    const options = makeOptions({ isProcessing: true });
    const { result } = renderHook((props) => useQueuedSend(props), {
      initialProps: options,
    });

    await act(async () => {
      await result.current.queueMessage("duplicate");
      await result.current.queueMessage("duplicate");
    });

    expect(result.current.activeQueue.map((item) => item.text)).toEqual([
      "duplicate",
      "duplicate",
    ]);
  });

  it("requeues an in-flight message when retryThreadQueue is triggered", async () => {
    const options = makeOptions({
      sendUserMessage: vi.fn().mockImplementation(
        () => createPendingPromise(),
      ),
    });
    const { result } = renderHook((props) => useQueuedSend(props), {
      initialProps: options,
    });

    await act(async () => {
      await result.current.queueMessage("first");
    });
    await flushAsyncTicks(2);

    await act(async () => {
      result.current.retryThreadQueue("thread-1");
    });
    await flushAsyncTicks(2);

    expect(options.sendUserMessage).toHaveBeenCalledTimes(2);
    expect(options.sendUserMessage).toHaveBeenNthCalledWith(2, "first", []);
  });

  it("stops auto-dispatching after max retry threshold and keeps item queued", async () => {
    const options = makeOptions({
      sendUserMessage: vi.fn().mockRejectedValue(new Error("always-fail")),
    });
    const { result } = renderHook((props) => useQueuedSend(props), {
      initialProps: options,
    });

    await act(async () => {
      await result.current.queueMessage("stuck message");
    });

    await flushAsyncTicks(4);

    expect(options.sendUserMessage).toHaveBeenCalledTimes(2);
    expect(result.current.activeQueue.map((item) => item.text)).toEqual([
      "stuck message",
    ]);

    await flushAsyncTicks(2);
    expect(options.sendUserMessage).toHaveBeenCalledTimes(2);

    const threadHealth = result.current.queueHealthEntries.find(
      (entry) => entry.threadId === "thread-1",
    );
    expect(threadHealth?.lastFailureReason).toBe("always-fail");
  });

  it("allows manual retry after auto-retry threshold is reached", async () => {
    const options = makeOptions({
      sendUserMessage: vi
        .fn()
        .mockRejectedValueOnce(new Error("fail-1"))
        .mockRejectedValueOnce(new Error("fail-2"))
        .mockResolvedValueOnce(undefined),
    });
    const { result } = renderHook((props) => useQueuedSend(props), {
      initialProps: options,
    });

    await act(async () => {
      await result.current.queueMessage("manual retry");
    });

    await flushAsyncTicks(4);
    expect(options.sendUserMessage).toHaveBeenCalledTimes(2);
    expect(result.current.activeQueue).toHaveLength(1);

    await act(async () => {
      result.current.retryThreadQueue("thread-1");
    });
    await flushAsyncTicks(2);

    expect(options.sendUserMessage).toHaveBeenCalledTimes(3);
    expect(options.sendUserMessage).toHaveBeenLastCalledWith("manual retry", []);
    expect(result.current.activeQueue).toEqual([]);
  });

  it("ignores empty input and empty thread id branches", async () => {
    const options = makeOptions();
    const { result } = renderHook((props) => useQueuedSend(props), {
      initialProps: options,
    });

    await act(async () => {
      await result.current.handleSend("   ");
      await result.current.queueMessageForThread("", "content");
      await result.current.queueMessageForThread("thread-1", "    ");
    });

    expect(options.sendUserMessage).not.toHaveBeenCalled();
    expect(result.current.activeQueue).toEqual([]);
  });

  it("flushes scheduled localStorage writes on cleanup", () => {
    const options = makeOptions();
    const { unmount } = renderHook((props) => useQueuedSend(props), {
      initialProps: options,
    });

    unmount();

    expect(flushScheduledLocalStorageWritesMock).toHaveBeenCalledWith(
      "codexmonitor.queuedMessagesByThread",
    );
  });

  it("keeps subsequent queued message blocked while first dispatch is still in flight", async () => {
    const sendFirstPending = createPendingPromise();
    const options = makeOptions({
      sendUserMessage: vi
        .fn()
        .mockImplementationOnce(() => sendFirstPending)
        .mockResolvedValue(undefined),
    });
    const { result } = renderHook((props) => useQueuedSend(props), {
      initialProps: options,
    });

    await act(async () => {
      await result.current.queueMessage("first-in-flight");
      await result.current.queueMessage("second-queued");
    });
    await flushAsyncTicks(3);

    expect(options.sendUserMessage).toHaveBeenCalledTimes(1);
    expect(options.sendUserMessage).toHaveBeenCalledWith("first-in-flight", []);
    expect(result.current.activeQueue.map((item) => item.text)).toEqual(["second-queued"]);
    expect(
      result.current.queueHealthEntries.find((entry) => entry.threadId === "thread-1")
        ?.blockedReason,
    ).toBe("awaiting_turn_start_event");
  });

  it("supports dropping a single queued message and clearing whole thread queue", async () => {
    const onRecoverStaleThread = vi.fn();
    const options = makeOptions({
      isProcessing: true,
      onRecoverStaleThread,
    });
    const { result } = renderHook((props) => useQueuedSend(props), {
      initialProps: options,
    });

    await act(async () => {
      await result.current.queueMessage("keep-me");
      await result.current.queueMessage("remove-me");
    });

    const removeId = result.current.activeQueue.find((item) => item.text === "remove-me")?.id ?? "";
    await act(async () => {
      result.current.removeQueuedMessage("thread-1", removeId);
    });
    expect(result.current.activeQueue.map((item) => item.text)).toEqual(["keep-me"]);

    await act(async () => {
      result.current.clearThreadQueue("thread-1");
    });

    expect(result.current.activeQueue).toEqual([]);
    expect(onRecoverStaleThread).toHaveBeenCalledWith("thread-1");
  });

  it("invokes recovery callback for manual retry even when thread has no in-flight message", async () => {
    const onRecoverStaleThread = vi.fn();
    const options = makeOptions({
      isProcessing: true,
      onRecoverStaleThread,
    });
    const { result } = renderHook((props) => useQueuedSend(props), {
      initialProps: options,
    });

    await act(async () => {
      await result.current.queueMessage("manual-retry-target");
    });

    await act(async () => {
      result.current.retryThreadQueue("thread-1");
    });

    expect(result.current.activeQueue.map((item) => item.text)).toEqual(["manual-retry-target"]);
    expect(onRecoverStaleThread).toHaveBeenCalledWith("thread-1");
  });

  it("does not duplicate requeue when retryThreadQueue is re-entered", async () => {
    const options = makeOptions({
      sendUserMessage: vi.fn().mockImplementation(
        () => createPendingPromise(),
      ),
    });
    const { result } = renderHook((props) => useQueuedSend(props), {
      initialProps: options,
    });

    await act(async () => {
      await result.current.queueMessage("dedupe-retry");
    });
    await flushAsyncTicks(2);

    await act(async () => {
      result.current.retryThreadQueue("thread-1");
      result.current.retryThreadQueue("thread-1");
    });
    await flushAsyncTicks(2);

    expect(options.sendUserMessage).toHaveBeenCalledTimes(2);
    expect(result.current.activeQueue.filter((item) => item.text === "dedupe-retry")).toHaveLength(0);
  });

  it("captures non-Error dispatch failures for background thread send and keeps queue", async () => {
    const workspaceTwo: WorkspaceInfo = {
      ...workspace,
      id: "workspace-2",
      name: "Another",
      path: "/tmp/another",
    };
    const options = makeOptions({
      activeModel: "gpt-5",
      activeEffort: "high",
      activeCollaborationMode: { mode: "pair" },
      activeWorkspace: workspace,
      threadStatusById: {
        "thread-1": { isProcessing: false, isReviewing: false },
        "thread-2": { isProcessing: false, isReviewing: false },
      },
      threadWorkspaceById: {
        "thread-1": "workspace-1",
        "thread-2": "workspace-2",
      },
      workspacesById: new Map([
        ["workspace-1", workspace],
        ["workspace-2", workspaceTwo],
      ]),
      sendUserMessageToThread: vi.fn().mockRejectedValue("queue exploded"),
    });
    const { result } = renderHook((props) => useQueuedSend(props), {
      initialProps: options,
    });

    await act(async () => {
      await result.current.queueMessageForThread("thread-2", "retry background");
    });
    await flushAsyncTicks(3);

    expect(options.sendUserMessageToThread).toHaveBeenCalledWith(
      workspaceTwo,
      "thread-2",
      "retry background",
      [],
      {
        model: "gpt-5",
        effort: "high",
        collaborationMode: { mode: "pair" },
      },
    );
    expect(result.current.queuedByThread["thread-2"]?.map((item) => item.text)).toEqual([
      "retry background",
    ]);
    expect(
      result.current.queueHealthEntries.find((entry) => entry.threadId === "thread-2")
        ?.lastFailureReason,
    ).toBe("queue exploded");
  });

  it("filters persisted queue items when model/effort/collaborationMode payloads are invalid", () => {
    window.localStorage.setItem(
      "codexmonitor.queuedMessagesByThread",
      JSON.stringify({
        "thread-1": [
          { id: "ok", text: "valid", createdAt: 1, model: null, effort: null },
          { id: "bad-model", text: "x", createdAt: 2, model: 123 },
          { id: "bad-effort", text: "x", createdAt: 3, effort: 5 },
          { id: "bad-collab", text: "x", createdAt: 4, collaborationMode: "pair" },
        ],
      }),
    );

    const { result } = renderHook((props) => useQueuedSend(props), {
      initialProps: makeOptions({ activeThreadId: "thread-1", isProcessing: true }),
    });

    expect(result.current.activeQueue).toHaveLength(1);
    expect(result.current.activeQueue[0]?.id).toBe("ok");
  });

  it("returns early while reviewing and does not enqueue or dispatch", async () => {
    const options = makeOptions({
      activeThreadId: "thread-1",
      isReviewing: true,
      isProcessing: false,
    });
    const { result } = renderHook((props) => useQueuedSend(props), { initialProps: options });

    await act(async () => {
      await result.current.handleSend("blocked while reviewing");
    });

    expect(options.sendUserMessage).not.toHaveBeenCalled();
    expect(options.clearActiveImages).not.toHaveBeenCalled();
    expect(result.current.activeQueue).toEqual([]);
  });

  it("sends immediately when processing=true but active thread is missing", async () => {
    const options = makeOptions({
      activeThreadId: null,
      isProcessing: true,
      activeWorkspace: null,
    });
    const { result } = renderHook((props) => useQueuedSend(props), { initialProps: options });

    await act(async () => {
      await result.current.handleSend("send without thread");
    });

    expect(options.sendUserMessage).toHaveBeenCalledTimes(1);
    expect(options.sendUserMessage).toHaveBeenCalledWith("send without thread", []);
  });

  it("runs /new with prompt body and forwards model options to new thread", async () => {
    const options = makeOptions({
      activeModel: "gpt-5",
      activeEffort: "high",
      activeCollaborationMode: { mode: "pair" },
      startThreadForWorkspace: vi.fn().mockResolvedValue("thread-new"),
    });
    const { result } = renderHook((props) => useQueuedSend(props), { initialProps: options });

    await act(async () => {
      await result.current.handleSend("/new continue this task", ["img-1"]);
    });

    expect(options.startThreadForWorkspace).toHaveBeenCalledWith("workspace-1");
    expect(options.sendUserMessageToThread).toHaveBeenCalledWith(
      workspace,
      "thread-new",
      "continue this task",
      [],
      { model: "gpt-5", effort: "high", collaborationMode: { mode: "pair" } },
    );
    expect(options.sendUserMessage).not.toHaveBeenCalled();
    expect(options.clearActiveImages).toHaveBeenCalledTimes(1);
  });

  it("no-ops queueMessage when active thread is null", async () => {
    const options = makeOptions({ activeThreadId: null });
    const { result } = renderHook((props) => useQueuedSend(props), { initialProps: options });

    await act(async () => {
      await result.current.queueMessage("will be ignored");
    });

    expect(result.current.queuedByThread).toEqual({});
  });

  it("ignores queueMessageForThread when target thread is reviewing", async () => {
    const options = makeOptions({
      activeThreadId: "thread-1",
      threadStatusById: {
        "thread-1": { isProcessing: false, isReviewing: false },
        "thread-2": { isProcessing: false, isReviewing: true },
      },
      threadWorkspaceById: {
        "thread-1": "workspace-1",
        "thread-2": "workspace-1",
      },
      workspacesById: new Map([["workspace-1", workspace]]),
    });
    const { result } = renderHook((props) => useQueuedSend(props), { initialProps: options });

    await act(async () => {
      await result.current.queueMessageForThread("thread-2", "review lock");
    });

    expect(options.sendUserMessageToThread).not.toHaveBeenCalled();
    expect(result.current.queuedByThread["thread-2"] ?? []).toEqual([]);
  });

  it("rejects steering queued slash commands on the active thread", async () => {
    const options = makeOptions({ steerEnabled: true, isProcessing: true });
    const { result } = renderHook((props) => useQueuedSend(props), { initialProps: options });

    await act(async () => {
      await result.current.queueMessage("/status now");
    });
    const queued = result.current.activeQueue[0];

    await act(async () => {
      const ok = await result.current.steerQueuedMessage("thread-1", queued?.id ?? "");
      expect(ok).toBe(false);
    });

    expect(options.sendUserMessage).not.toHaveBeenCalled();
    expect(result.current.activeQueue).toHaveLength(1);
    expect(result.current.activeQueue[0]?.text).toBe("/status now");
  });

  it("requeues item when steer dispatch throws and returns false", async () => {
    const options = makeOptions({
      steerEnabled: true,
      isProcessing: true,
      sendUserMessage: vi.fn().mockRejectedValueOnce(new Error("steer failed")),
    });
    const { result } = renderHook((props) => useQueuedSend(props), { initialProps: options });

    await act(async () => {
      await result.current.queueMessage("steer me");
    });
    const queued = result.current.activeQueue[0];

    await act(async () => {
      const ok = await result.current.steerQueuedMessage("thread-1", queued?.id ?? "");
      expect(ok).toBe(false);
    });

    expect(result.current.activeQueue.map((item) => item.text)).toEqual(["steer me"]);
  });

  it("returns zero migration counts when queue is empty", () => {
    const { result } = renderHook((props) => useQueuedSend(props), {
      initialProps: makeOptions({ activeThreadId: "thread-empty" }),
    });
    const migrated = result.current.migrateLegacyQueueWorkspaceIds();
    expect(migrated).toEqual({ migratedMessages: 0, migratedThreads: 0 });
  });

  it("migrates legacy queue workspace ids using active workspace fallback", async () => {
    window.localStorage.setItem(
      "codexmonitor.queuedMessagesByThread",
      JSON.stringify({
        "thread-1": [{ id: "legacy-1", text: "legacy", createdAt: 1, images: [] }],
      }),
    );
    const options = makeOptions({
      activeThreadId: "thread-1",
      activeWorkspace: workspace,
      isProcessing: true,
    });
    const { result } = renderHook((props) => useQueuedSend(props), { initialProps: options });

    await act(async () => {
      result.current.migrateLegacyQueueWorkspaceIds();
    });
    await flushAsyncTicks(1);

    expect(result.current.activeQueue[0]?.workspaceId).toBe("workspace-1");
    expect(result.current.legacyQueueMessageCount).toBe(0);
  });

  it("keeps non-active slash command queued with command_requires_active_thread health", async () => {
    const workspaceTwo: WorkspaceInfo = {
      ...workspace,
      id: "workspace-2",
      name: "Another",
      path: "/tmp/another",
    };
    const options = makeOptions({
      activeThreadId: "thread-1",
      activeWorkspace: workspace,
      threadWorkspaceById: {
        "thread-1": "workspace-1",
        "thread-2": "workspace-2",
      },
      workspacesById: new Map([
        ["workspace-1", workspace],
        ["workspace-2", workspaceTwo],
      ]),
    });
    const { result } = renderHook((props) => useQueuedSend(props), { initialProps: options });

    await act(async () => {
      await result.current.queueMessageForThread("thread-2", "/status");
    });
    await flushAsyncTicks(2);

    expect(options.sendUserMessageToThread).not.toHaveBeenCalled();
    expect(result.current.queuedByThread["thread-2"]?.map((item) => item.text)).toEqual(["/status"]);
    expect(
      result.current.queueHealthEntries.find((entry) => entry.threadId === "thread-2")
        ?.blockedReason,
    ).toBe("command_requires_active_thread");
  });

  it("returns false when steering is requested with empty ids", async () => {
    const options = makeOptions({ steerEnabled: true });
    const { result } = renderHook((props) => useQueuedSend(props), { initialProps: options });

    await act(async () => {
      expect(await result.current.steerQueuedMessage("", "message-1")).toBe(false);
      expect(await result.current.steerQueuedMessage("thread-1", "")).toBe(false);
    });
  });

  it("returns false when steering target message id is missing", async () => {
    const options = makeOptions({ steerEnabled: true, isProcessing: true });
    const { result } = renderHook((props) => useQueuedSend(props), { initialProps: options });

    await act(async () => {
      await result.current.queueMessage("existing queued item");
    });

    await act(async () => {
      expect(await result.current.steerQueuedMessage("thread-1", "missing-id")).toBe(false);
    });

    expect(options.sendUserMessage).not.toHaveBeenCalled();
    expect(result.current.activeQueue).toHaveLength(1);
  });

  it("connects disconnected workspace before steering queued message", async () => {
    const options = makeOptions({
      steerEnabled: true,
      isProcessing: true,
      activeWorkspace: { ...workspace, connected: false },
      activeModel: null,
      activeEffort: null,
      activeCollaborationMode: null,
    });
    const { result } = renderHook((props) => useQueuedSend(props), { initialProps: options });

    await act(async () => {
      await result.current.queueMessage("steer after reconnect");
    });
    const queued = result.current.activeQueue[0];

    await act(async () => {
      expect(await result.current.steerQueuedMessage("thread-1", queued?.id ?? "")).toBe(true);
    });

    expect(options.connectWorkspace).toHaveBeenCalledWith(
      expect.objectContaining({ id: "workspace-1", connected: false }),
    );
    expect(options.sendUserMessage).toHaveBeenCalledWith("steer after reconnect", [], {
      forceSteer: true,
    });
  });

  it("queues active-thread message with undefined workspace id when workspace cannot be resolved", async () => {
    const options = makeOptions({
      activeWorkspace: null,
      activeThreadId: "thread-1",
      threadWorkspaceById: {},
      workspacesById: new Map(),
      isProcessing: true,
    });
    const { result } = renderHook((props) => useQueuedSend(props), { initialProps: options });

    await act(async () => {
      await result.current.queueMessageForThread("thread-1", "no workspace mapping");
    });

    const queued = result.current.queuedByThread["thread-1"]?.[0];
    expect(queued?.workspaceId).toBeUndefined();
  });

  it("does not auto-dispatch queued messages while thread is reviewing", async () => {
    window.localStorage.setItem(
      "codexmonitor.queuedMessagesByThread",
      JSON.stringify({
        "thread-1": [{ id: "queued-1", text: "blocked", createdAt: 1, images: [] }],
      }),
    );
    const options = makeOptions({
      activeThreadId: "thread-1",
      isReviewing: true,
      threadStatusById: {
        "thread-1": { isProcessing: false, isReviewing: true, phase: "completed" },
      },
    });
    const { result } = renderHook((props) => useQueuedSend(props), { initialProps: options });

    await flushAsyncTicks(2);

    expect(options.sendUserMessage).not.toHaveBeenCalled();
    expect(result.current.activeQueue.map((item) => item.id)).toEqual(["queued-1"]);
  });

  it("does not auto-dispatch queued messages while waiting for user input", async () => {
    window.localStorage.setItem(
      "codexmonitor.queuedMessagesByThread",
      JSON.stringify({
        "thread-1": [{ id: "queued-2", text: "blocked", createdAt: 2, images: [] }],
      }),
    );
    const options = makeOptions({
      activeThreadId: "thread-1",
      threadStatusById: {
        "thread-1": { isProcessing: false, isReviewing: false, phase: "waiting_user" },
      },
    });
    const { result } = renderHook((props) => useQueuedSend(props), { initialProps: options });

    await flushAsyncTicks(2);

    expect(options.sendUserMessage).not.toHaveBeenCalled();
    expect(result.current.activeQueue.map((item) => item.id)).toEqual(["queued-2"]);
  });

  it("connects workspace before auto-dispatching queued active-thread message", async () => {
    const options = makeOptions({
      activeThreadId: "thread-1",
      activeWorkspace: { ...workspace, connected: false },
      isProcessing: true,
    });
    const { result, rerender } = renderHook((props) => useQueuedSend(props), {
      initialProps: options,
    });

    await act(async () => {
      await result.current.queueMessage("auto-connect then send");
    });

    await act(async () => {
      rerender({ ...options, isProcessing: false });
    });
    await flushAsyncTicks(2);

    expect(options.connectWorkspace).toHaveBeenCalledWith(
      expect.objectContaining({ id: "workspace-1", connected: false }),
    );
    expect(options.sendUserMessage).toHaveBeenCalledWith("auto-connect then send", []);
  });

  it("keeps background queue blocked when processing thread is not stale", async () => {
    const workspaceTwo: WorkspaceInfo = {
      ...workspace,
      id: "workspace-2",
      name: "Another",
      path: "/tmp/another",
    };
    evaluateThreadStaleStateMock.mockReturnValue({
      isStale: false,
      processingAgeMs: 5_000,
      silenceMs: 5_000,
      silenceThresholdMs: 90_000,
    });
    const options = makeOptions({
      activeThreadId: "thread-1",
      activeWorkspace: workspace,
      threadStatusById: {
        "thread-1": { isProcessing: false, isReviewing: false },
        "thread-2": { isProcessing: true, isReviewing: false, processingStartedAt: Date.now() },
      },
      threadWorkspaceById: {
        "thread-1": "workspace-1",
        "thread-2": "workspace-2",
      },
      workspacesById: new Map([
        ["workspace-1", workspace],
        ["workspace-2", workspaceTwo],
      ]),
    });
    const { result } = renderHook((props) => useQueuedSend(props), { initialProps: options });

    await act(async () => {
      await result.current.queueMessageForThread("thread-2", "blocked background");
    });
    await flushAsyncTicks(3);

    expect(options.sendUserMessageToThread).not.toHaveBeenCalled();
    expect(result.current.queuedByThread["thread-2"]?.map((item) => item.text)).toEqual([
      "blocked background",
    ]);
    expect(
      result.current.queueHealthEntries.find((entry) => entry.threadId === "thread-2")
        ?.blockedReason,
    ).toBe("processing");
  });

  it("auto-dispatches queued active-thread message with preserved model options", async () => {
    const options = makeOptions({
      isProcessing: true,
      activeModel: "gpt-5",
      activeEffort: "high",
      activeCollaborationMode: { mode: "pair" },
    });
    const { result, rerender } = renderHook((props) => useQueuedSend(props), {
      initialProps: options,
    });

    await act(async () => {
      await result.current.queueMessage("send with options");
    });
    await flushAsyncTicks(1);

    await act(async () => {
      rerender({ ...options, isProcessing: false });
    });
    await flushAsyncTicks(2);

    expect(options.sendUserMessage).toHaveBeenCalledTimes(1);
    expect(options.sendUserMessage).toHaveBeenCalledWith(
      "send with options",
      [],
      { model: "gpt-5", effort: "high", collaborationMode: { mode: "pair" } },
    );
    expect(result.current.activeQueue).toEqual([]);
  });

  it("dispatches queued /status command after processing ends without sending chat text", async () => {
    const options = makeOptions({ isProcessing: true });
    const { result, rerender } = renderHook((props) => useQueuedSend(props), {
      initialProps: options,
    });

    await act(async () => {
      await result.current.handleSend("/status");
    });
    expect(result.current.activeQueue.map((item) => item.text)).toEqual(["/status"]);

    await act(async () => {
      rerender({ ...options, isProcessing: false });
    });
    await flushAsyncTicks(2);

    expect(options.startStatus).toHaveBeenCalledWith("/status");
    expect(options.sendUserMessage).not.toHaveBeenCalled();
  });

  it("filters persisted queue entries with invalid workspace id type", async () => {
    window.localStorage.setItem(
      "codexmonitor.queuedMessagesByThread",
      JSON.stringify({
        "thread-1": [
          { id: "ok-1", text: "valid", createdAt: 1, workspaceId: "workspace-1" },
          { id: "bad-workspace", text: "bad", createdAt: 2, workspaceId: 42 },
        ],
      }),
    );

    const options = makeOptions({ activeThreadId: "thread-1" });
    renderHook((props) => useQueuedSend(props), {
      initialProps: options,
    });
    await flushAsyncTicks(1);

    expect(options.sendUserMessage).toHaveBeenCalledTimes(1);
    expect(options.sendUserMessage).toHaveBeenCalledWith("valid", []);
  });

  it("sanitizes persisted entries with invalid model/effort/collaborationMode payloads", () => {
    window.localStorage.setItem(
      "codexmonitor.queuedMessagesByThread",
      JSON.stringify({
        "thread-1": [
          { id: "ok-1", text: "valid", createdAt: 1, model: "gpt-5", effort: "high" },
          { id: "bad-model", text: "invalid", createdAt: 2, model: 123 },
          { id: "bad-effort", text: "invalid", createdAt: 3, effort: 456 },
          { id: "bad-collab", text: "invalid", createdAt: 4, collaborationMode: "pair" },
        ],
      }),
    );

    const options = makeOptions({ activeThreadId: "thread-1", isProcessing: true });
    const { result } = renderHook((props) => useQueuedSend(props), {
      initialProps: options,
    });

    expect(result.current.activeQueue).toHaveLength(1);
    expect(result.current.activeQueue[0]?.id).toBe("ok-1");
  });

  it("ignores /new command when no active workspace is available", async () => {
    const options = makeOptions({
      activeWorkspace: null,
      startThreadForWorkspace: vi.fn().mockResolvedValue("thread-new"),
    });
    const { result } = renderHook((props) => useQueuedSend(props), {
      initialProps: options,
    });

    await act(async () => {
      await result.current.handleSend("/new run this");
    });

    expect(options.startThreadForWorkspace).not.toHaveBeenCalled();
    expect(options.sendUserMessage).not.toHaveBeenCalled();
    expect(options.sendUserMessageToThread).not.toHaveBeenCalled();
  });

  it("normalizes null stale-state signals from getWorkspaceLastAliveAt", async () => {
    const options = makeOptions({
      activeThreadId: "thread-1",
      getWorkspaceLastAliveAt: vi.fn().mockReturnValue(NaN),
      threadStatusById: {
        "thread-1": { isProcessing: true, isReviewing: false, processingStartedAt: Date.now() - 1000 },
      },
    });
    renderHook((props) => useQueuedSend(props), {
      initialProps: options,
    });
    await flushAsyncTicks(1);

    expect(evaluateThreadStaleStateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        lastAliveAt: null,
      }),
    );
  });

  it("ignores empty text submissions when there are no images", async () => {
    const options = makeOptions();
    const { result } = renderHook((props) => useQueuedSend(props), {
      initialProps: options,
    });

    await act(async () => {
      await result.current.handleSend("   ", []);
    });

    expect(options.sendUserMessage).not.toHaveBeenCalled();
    expect(options.sendUserMessageToThread).not.toHaveBeenCalled();
    expect(options.clearActiveImages).not.toHaveBeenCalled();
  });

  it("sends image-only payloads even when text is whitespace", async () => {
    const options = makeOptions({
      activeWorkspace: null,
    });
    const { result } = renderHook((props) => useQueuedSend(props), {
      initialProps: options,
    });

    await act(async () => {
      await result.current.handleSend("   ", ["img-1"]);
    });

    expect(options.sendUserMessage).toHaveBeenCalledTimes(1);
    expect(options.sendUserMessage).toHaveBeenCalledWith("", ["img-1"]);
    expect(options.clearActiveImages).toHaveBeenCalledTimes(1);
  });

  it("connects disconnected workspace before direct send and forwards model options", async () => {
    const options = makeOptions({
      activeWorkspace: { ...workspace, connected: false },
      activeModel: "gpt-5",
      activeEffort: "high",
      activeCollaborationMode: { mode: "pair" },
    });
    const { result } = renderHook((props) => useQueuedSend(props), {
      initialProps: options,
    });

    await act(async () => {
      await result.current.handleSend("Ship it");
    });

    expect(options.connectWorkspace).toHaveBeenCalledWith(
      expect.objectContaining({ id: "workspace-1", connected: false }),
    );
    expect(options.sendUserMessage).toHaveBeenCalledWith(
      "Ship it",
      [],
      { model: "gpt-5", effort: "high", collaborationMode: { mode: "pair" } },
    );
    expect(options.clearActiveImages).toHaveBeenCalledTimes(1);
  });

  it("treats /apps as plain text when apps feature is disabled", async () => {
    const options = makeOptions({
      appsEnabled: false,
      activeWorkspace: null,
    });
    const { result } = renderHook((props) => useQueuedSend(props), {
      initialProps: options,
    });

    await act(async () => {
      await result.current.handleSend("/apps open");
    });

    expect(options.startApps).not.toHaveBeenCalled();
    expect(options.sendUserMessage).toHaveBeenCalledWith("/apps open", []);
  });

  it("prioritizes the active thread in queue health ordering", async () => {
    const workspaceTwo: WorkspaceInfo = {
      ...workspace,
      id: "workspace-2",
      name: "Another",
      path: "/tmp/another",
    };
    const options = makeOptions({
      activeThreadId: "thread-1",
      isProcessing: true,
      activeWorkspace: workspace,
      threadWorkspaceById: {
        "thread-1": "workspace-1",
        "thread-2": "workspace-2",
      },
      workspacesById: new Map([
        ["workspace-1", workspace],
        ["workspace-2", workspaceTwo],
      ]),
      threadStatusById: {
        "thread-1": { isProcessing: true, isReviewing: false },
        "thread-2": { isProcessing: false, isReviewing: false },
      },
    });
    const { result } = renderHook((props) => useQueuedSend(props), {
      initialProps: options,
    });

    await act(async () => {
      await result.current.queueMessage("active-first");
      await result.current.queueMessageForThread("thread-2", "background");
    });

    const entries = result.current.queueHealthEntries.map((entry) => entry.threadId);
    expect(entries[0]).toBe("thread-1");
    expect(entries).toContain("thread-2");
  });

  it("migrates legacy workspace ids even when unrelated empty queues are dropped by sanitization", async () => {
    window.localStorage.setItem(
      "codexmonitor.queuedMessagesByThread",
      JSON.stringify({
        "thread-empty": [],
        "thread-1": [{ id: "m-1", text: "hello", createdAt: 1 }],
      }),
    );
    const options = makeOptions({
      isProcessing: true,
      threadWorkspaceById: {
        "thread-1": "workspace-1",
      },
    });
    const { result } = renderHook((props) => useQueuedSend(props), {
      initialProps: options,
    });

    await act(async () => {
      result.current.migrateLegacyQueueWorkspaceIds();
    });

    expect(result.current.queuedByThread["thread-empty"]).toBeUndefined();
    expect(result.current.queuedByThread["thread-1"]?.[0]?.workspaceId).toBe("workspace-1");
  });

  it("rejects steering when queued thread is not the active thread", async () => {
    const workspaceTwo: WorkspaceInfo = {
      ...workspace,
      id: "workspace-2",
      name: "Another",
      path: "/tmp/another",
    };
    const options = makeOptions({
      steerEnabled: true,
      activeThreadId: "thread-1",
      threadStatusById: {
        "thread-1": { isProcessing: false, isReviewing: false },
        "thread-2": { isProcessing: true, isReviewing: false },
      },
      threadWorkspaceById: {
        "thread-1": "workspace-1",
        "thread-2": "workspace-2",
      },
      workspacesById: new Map([
        ["workspace-1", workspace],
        ["workspace-2", workspaceTwo],
      ]),
    });
    const { result } = renderHook((props) => useQueuedSend(props), {
      initialProps: options,
    });

    await act(async () => {
      await result.current.queueMessageForThread("thread-2", "background steer");
    });

    const queued = result.current.queuedByThread["thread-2"]?.[0];
    expect(typeof queued?.id).toBe("string");

    await act(async () => {
      const ok = await result.current.steerQueuedMessage("thread-2", queued?.id ?? "");
      expect(ok).toBe(false);
    });

    expect(options.sendUserMessage).not.toHaveBeenCalled();
  });

  it("dispatches background queued messages with model options", async () => {
    const workspaceTwo: WorkspaceInfo = {
      ...workspace,
      id: "workspace-2",
      name: "Another",
      path: "/tmp/another",
    };
    const options = makeOptions({
      activeThreadId: "thread-1",
      activeWorkspace: workspace,
      activeModel: "gemini-3.1-pro",
      activeEffort: "high",
      activeCollaborationMode: { mode: "pair" },
      threadStatusById: {
        "thread-1": { isProcessing: false, isReviewing: false },
        "thread-2": { isProcessing: false, isReviewing: false },
      },
      threadWorkspaceById: {
        "thread-1": "workspace-1",
        "thread-2": "workspace-2",
      },
      workspacesById: new Map([
        ["workspace-1", workspace],
        ["workspace-2", workspaceTwo],
      ]),
    });
    const { result } = renderHook((props) => useQueuedSend(props), {
      initialProps: options,
    });

    await act(async () => {
      await result.current.queueMessageForThread("thread-2", "send with options");
    });
    await flushAsyncTicks(2);

    expect(options.sendUserMessageToThread).toHaveBeenCalledWith(
      workspaceTwo,
      "thread-2",
      "send with options",
      [],
      {
        model: "gemini-3.1-pro",
        effort: "high",
        collaborationMode: { mode: "pair" },
      },
    );
  });

  it("runs /new with prompt body and no active model options", async () => {
    const options = makeOptions({
      activeModel: null,
      activeEffort: null,
      activeCollaborationMode: null,
      startThreadForWorkspace: vi.fn().mockResolvedValue("thread-new"),
    });
    const { result } = renderHook((props) => useQueuedSend(props), {
      initialProps: options,
    });

    await act(async () => {
      await result.current.handleSend("/new draft notes");
    });

    expect(options.sendUserMessageToThread).toHaveBeenCalledWith(
      workspace,
      "thread-new",
      "draft notes",
      [],
    );
  });

  it("runs /new with prompt body when only effort is configured", async () => {
    const options = makeOptions({
      activeModel: null,
      activeEffort: "medium",
      activeCollaborationMode: null,
      startThreadForWorkspace: vi.fn().mockResolvedValue("thread-new"),
    });
    const { result } = renderHook((props) => useQueuedSend(props), {
      initialProps: options,
    });

    await act(async () => {
      await result.current.handleSend("/new summarize");
    });

    expect(options.sendUserMessageToThread).toHaveBeenCalledWith(
      workspace,
      "thread-new",
      "summarize",
      [],
      {
        model: null,
        effort: "medium",
        collaborationMode: null,
      },
    );
  });

  it("returns false when steering target thread has no queued messages", async () => {
    const options = makeOptions({ steerEnabled: true });
    const { result } = renderHook((props) => useQueuedSend(props), {
      initialProps: options,
    });

    await act(async () => {
      expect(await result.current.steerQueuedMessage("thread-1", "missing-item")).toBe(false);
    });

    expect(options.sendUserMessage).not.toHaveBeenCalled();
  });

  it("steers queued message with merged queued and active model options", async () => {
    window.localStorage.setItem(
      "codexmonitor.queuedMessagesByThread",
      JSON.stringify({
        "thread-1": [
          {
            id: "steer-opts",
            text: "steer with options",
            createdAt: 1,
            model: "gemini-3.1-pro",
            collaborationMode: { mode: "solo" },
          },
        ],
      }),
    );
    const options = makeOptions({
      steerEnabled: true,
      isProcessing: true,
      activeEffort: "high",
      activeModel: null,
      activeCollaborationMode: null,
    });
    const { result } = renderHook((props) => useQueuedSend(props), {
      initialProps: options,
    });

    await act(async () => {
      expect(await result.current.steerQueuedMessage("thread-1", "steer-opts")).toBe(true);
    });

    expect(options.sendUserMessage).toHaveBeenCalledWith(
      "steer with options",
      [],
      {
        forceSteer: true,
        model: "gemini-3.1-pro",
        effort: "high",
        collaborationMode: { mode: "solo" },
      },
    );
  });

  it("swallows persistence errors when localStorage.setItem throws", async () => {
    const setItemSpy = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("disk full");
      });
    const options = makeOptions({ isProcessing: true });
    const { result } = renderHook((props) => useQueuedSend(props), {
      initialProps: options,
    });

    await act(async () => {
      await result.current.queueMessage("persist failure should not crash");
    });

    expect(result.current.activeQueue.map((item) => item.text)).toEqual([
      "persist failure should not crash",
    ]);
    setItemSpy.mockRestore();
  });

  it("migrates legacy workspace id from queued fallback entry", async () => {
    window.localStorage.setItem(
      "codexmonitor.queuedMessagesByThread",
      JSON.stringify({
        "thread-2": [
          {
            id: "legacy-has-workspace",
            text: "seed",
            createdAt: 1,
            workspaceId: "workspace-2",
          },
          {
            id: "legacy-missing-workspace",
            text: "needs migration",
            createdAt: 2,
          },
        ],
      }),
    );
    const options = makeOptions({
      activeThreadId: "thread-1",
      activeWorkspace: workspace,
      isProcessing: true,
    });
    const { result } = renderHook((props) => useQueuedSend(props), {
      initialProps: options,
    });

    await act(async () => {
      const migrated = result.current.migrateLegacyQueueWorkspaceIds();
      expect(migrated).toEqual({ migratedMessages: 0, migratedThreads: 0 });
    });

    expect(
      result.current.queuedByThread["thread-2"]?.find((item) => item.id === "legacy-missing-workspace")
        ?.workspaceId,
    ).toBe("workspace-2");
  });

  it("keeps removeQueuedMessage as a no-op for unknown thread id", () => {
    const options = makeOptions();
    const { result } = renderHook((props) => useQueuedSend(props), {
      initialProps: options,
    });

    act(() => {
      result.current.removeQueuedMessage("thread-missing", "msg-missing");
    });

    expect(result.current.queuedByThread["thread-missing"]).toEqual([]);
  });

  it("dispatches /apps text for background thread when apps feature is disabled", async () => {
    const workspaceTwo: WorkspaceInfo = {
      ...workspace,
      id: "workspace-2",
      name: "Another",
      path: "/tmp/another",
    };
    const options = makeOptions({
      appsEnabled: false,
      activeThreadId: "thread-1",
      activeWorkspace: workspace,
      activeModel: null,
      activeEffort: null,
      activeCollaborationMode: null,
      threadStatusById: {
        "thread-1": { isProcessing: false, isReviewing: false },
        "thread-2": { isProcessing: false, isReviewing: false },
      },
      threadWorkspaceById: {
        "thread-1": "workspace-1",
        "thread-2": "workspace-2",
      },
      workspacesById: new Map([
        ["workspace-1", workspace],
        ["workspace-2", workspaceTwo],
      ]),
    });
    const { result } = renderHook((props) => useQueuedSend(props), { initialProps: options });

    await act(async () => {
      await result.current.queueMessageForThread("thread-2", "/apps dashboard");
    });
    await flushAsyncTicks(2);

    expect(options.startApps).not.toHaveBeenCalled();
    expect(options.sendUserMessageToThread).toHaveBeenCalledWith(
      workspaceTwo,
      "thread-2",
      "/apps dashboard",
      [],
    );
    expect(result.current.queuedByThread["thread-2"] ?? []).toEqual([]);
  });

  it("keeps migration as a no-op for explicit empty thread queues", async () => {
    const options = makeOptions({
      activeThreadId: "thread-1",
      isProcessing: true,
    });
    const { result } = renderHook((props) => useQueuedSend(props), { initialProps: options });

    await act(async () => {
      await result.current.queueMessage("temporary");
    });

    const queuedId = result.current.activeQueue[0]?.id ?? "";
    await act(async () => {
      result.current.removeQueuedMessage("thread-1", queuedId);
    });

    await act(async () => {
      expect(result.current.migrateLegacyQueueWorkspaceIds()).toEqual({
        migratedMessages: 0,
        migratedThreads: 0,
      });
    });
  });

  it("swallows persistence errors when localStorage.removeItem throws", () => {
    const removeItemSpy = vi
      .spyOn(Storage.prototype, "removeItem")
      .mockImplementation(() => {
        throw new Error("remove denied");
      });
    const options = makeOptions({
      activeThreadId: "thread-empty",
      activeWorkspace: null,
    });

    const { result } = renderHook((props) => useQueuedSend(props), {
      initialProps: options,
    });

    expect(result.current.activeQueue).toEqual([]);
    removeItemSpy.mockRestore();
  });

  it("steers with force flag only when queued and active options are null", async () => {
    const options = makeOptions({
      steerEnabled: true,
      isProcessing: true,
      activeModel: null,
      activeEffort: null,
      activeCollaborationMode: null,
    });
    const { result } = renderHook((props) => useQueuedSend(props), { initialProps: options });

    await act(async () => {
      await result.current.queueMessage("force-only");
    });
    const queued = result.current.activeQueue[0];

    await act(async () => {
      expect(await result.current.steerQueuedMessage("thread-1", queued?.id ?? "")).toBe(true);
    });

    expect(options.sendUserMessage).toHaveBeenCalledWith("force-only", [], {
      forceSteer: true,
    });
  });

  it("dispatches persisted background item without options and without images payload", async () => {
    const workspaceTwo: WorkspaceInfo = {
      ...workspace,
      id: "workspace-2",
      name: "Another",
      path: "/tmp/another",
    };
    window.localStorage.setItem(
      "codexmonitor.queuedMessagesByThread",
      JSON.stringify({
        "thread-2": [
          {
            id: "persisted-bg",
            text: "persisted background item",
            createdAt: 1,
            workspaceId: "workspace-2",
            model: null,
            effort: null,
            collaborationMode: null,
          },
        ],
      }),
    );
    const options = makeOptions({
      activeThreadId: "thread-1",
      activeWorkspace: workspace,
      activeModel: null,
      activeEffort: null,
      activeCollaborationMode: null,
      threadStatusById: {
        "thread-1": { isProcessing: false, isReviewing: false },
        "thread-2": { isProcessing: false, isReviewing: false },
      },
      threadWorkspaceById: {
        "thread-1": "workspace-1",
        "thread-2": "workspace-2",
      },
      workspacesById: new Map([
        ["workspace-1", workspace],
        ["workspace-2", workspaceTwo],
      ]),
    });
    renderHook((props) => useQueuedSend(props), { initialProps: options });

    await flushAsyncTicks(3);

    expect(options.sendUserMessageToThread).toHaveBeenCalledWith(
      workspaceTwo,
      "thread-2",
      "persisted background item",
      [],
    );
  });

});
