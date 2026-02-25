// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspaceInfo } from "../../../types";
import { useQueuedSend } from "./useQueuedSend";

const { flushScheduledLocalStorageWritesMock } = vi.hoisted(() => ({
  flushScheduledLocalStorageWritesMock: vi.fn(),
}));

vi.mock("../../../utils/localStorageWriteScheduler", () => ({
  scheduleLocalStorageWrite: (_key: string, write: () => void) => {
    write();
  },
  flushScheduledLocalStorageWrites: flushScheduledLocalStorageWritesMock,
}));

const workspace: WorkspaceInfo = {
  id: "workspace-1",
  name: "CodexMonitor",
  path: "/tmp/codex",
  connected: true,
  settings: { sidebarCollapsed: false },
};

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
        () => new Promise<void>(() => {
          // keep in-flight unresolved for retry path
        }),
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
    const sendFirstPending = new Promise<void>(() => {
      // keep first dispatch pending to verify serialized queue behavior
    });
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

});
