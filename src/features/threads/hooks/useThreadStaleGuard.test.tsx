// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ThreadState } from "./useThreadsReducer";
import { useThreadStaleGuard } from "./useThreadStaleGuard";

type ThreadStatusById = ThreadState["threadStatusById"];
type ItemsByThread = ThreadState["itemsByThread"];

function buildProcessingStatus(startedAt: number): ThreadStatusById {
  return {
    "thread-1": {
      isProcessing: true,
      hasUnread: false,
      isReviewing: false,
      phase: "starting",
      processingStartedAt: startedAt,
      lastDurationMs: null,
      lastActivityAt: startedAt,
      lastErrorAt: null,
      lastErrorMessage: null,
    },
  };
}

function buildItemsByThread(
  threadId: string,
  options?: { runningCommand?: boolean; status?: string; durationMs?: number | null },
): ItemsByThread {
  if (!options?.runningCommand) {
    return {};
  }
  const status = options.status ?? "inProgress";
  return {
    [threadId]: [
      {
        id: "cmd-1",
        kind: "tool",
        toolType: "commandExecution",
        title: "Command: npm run build",
        detail: "",
        status,
        output: "",
        durationMs: options.durationMs ?? null,
      },
    ],
  };
}

function buildCallbacks() {
  return {
    markProcessing: vi.fn(),
    markReviewing: vi.fn(),
    setActiveTurnId: vi.fn(),
    setThreadPhase: vi.fn(),
    pushThreadErrorMessage: vi.fn(),
  };
}

describe("useThreadStaleGuard", () => {
  it("does not auto-reset while processing is below 3 minutes", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-16T00:00:00.000Z"));

    const {
      markProcessing,
      markReviewing,
      setActiveTurnId,
      setThreadPhase,
      pushThreadErrorMessage,
    } = buildCallbacks();

    const startedAt = Date.now() - (2 * 60_000);
    renderHook(() =>
      useThreadStaleGuard({
        activeWorkspaceId: "ws-1",
        activeThreadId: "thread-1",
        itemsByThread: buildItemsByThread("thread-1"),
        threadStatusById: buildProcessingStatus(startedAt),
        markProcessing,
        markReviewing,
        setActiveTurnId,
        setThreadPhase,
        pushThreadErrorMessage,
      }),
    );

    act(() => {
      vi.advanceTimersByTime(30_000);
    });

    expect(markProcessing).not.toHaveBeenCalled();
    expect(markReviewing).not.toHaveBeenCalled();
    expect(setActiveTurnId).not.toHaveBeenCalled();
    expect(pushThreadErrorMessage).not.toHaveBeenCalled();

    vi.useRealTimers();
  });

  it("auto-recovers after processing exceeds 3 minutes with 90s silence", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-16T00:00:00.000Z"));

    const {
      markProcessing,
      markReviewing,
      setActiveTurnId,
      setThreadPhase,
      pushThreadErrorMessage,
    } = buildCallbacks();

    const startedAt = Date.now() - (3 * 60_000) - 1;
    renderHook(() =>
      useThreadStaleGuard({
        activeWorkspaceId: "ws-1",
        activeThreadId: "thread-1",
        itemsByThread: buildItemsByThread("thread-1"),
        threadStatusById: buildProcessingStatus(startedAt),
        markProcessing,
        markReviewing,
        setActiveTurnId,
        setThreadPhase,
        pushThreadErrorMessage,
      }),
    );

    act(() => {
      vi.advanceTimersByTime(10_000);
    });

    expect(markProcessing).toHaveBeenCalledWith("thread-1", false);
    expect(markReviewing).toHaveBeenCalledWith("thread-1", false);
    expect(setActiveTurnId).toHaveBeenCalledWith("thread-1", null);
    expect(pushThreadErrorMessage).toHaveBeenCalledWith(
      "thread-1",
      expect.stringContaining("长时间无事件"),
    );

    vi.useRealTimers();
  });

  it("does not auto-reset when recent alive events are within 90 seconds", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-16T00:00:00.000Z"));

    const {
      markProcessing,
      markReviewing,
      setActiveTurnId,
      setThreadPhase,
      pushThreadErrorMessage,
    } = buildCallbacks();

    const startedAt = Date.now() - (10 * 60_000);
    const { result } = renderHook(() =>
      useThreadStaleGuard({
        activeWorkspaceId: "ws-1",
        activeThreadId: "thread-1",
        itemsByThread: buildItemsByThread("thread-1"),
        threadStatusById: buildProcessingStatus(startedAt),
        markProcessing,
        markReviewing,
        setActiveTurnId,
        setThreadPhase,
        pushThreadErrorMessage,
      }),
    );

    act(() => {
      result.current.recordAlive("ws-1");
      vi.advanceTimersByTime(60_000);
    });

    expect(markProcessing).not.toHaveBeenCalled();
    expect(markReviewing).not.toHaveBeenCalled();
    expect(setActiveTurnId).not.toHaveBeenCalled();
    expect(pushThreadErrorMessage).not.toHaveBeenCalled();

    vi.useRealTimers();
  });

  it("resets active processing thread on explicit disconnect", () => {
    const {
      markProcessing,
      markReviewing,
      setActiveTurnId,
      setThreadPhase,
      pushThreadErrorMessage,
    } = buildCallbacks();

    const startedAt = Date.now() - 5_000;
    const { result } = renderHook(() =>
      useThreadStaleGuard({
        activeWorkspaceId: "ws-1",
        activeThreadId: "thread-1",
        itemsByThread: buildItemsByThread("thread-1"),
        threadStatusById: buildProcessingStatus(startedAt),
        markProcessing,
        markReviewing,
        setActiveTurnId,
        setThreadPhase,
        pushThreadErrorMessage,
      }),
    );

    act(() => {
      result.current.handleDisconnected("ws-1");
    });

    expect(markProcessing).toHaveBeenCalledWith("thread-1", false);
    expect(markReviewing).toHaveBeenCalledWith("thread-1", false);
    expect(setActiveTurnId).toHaveBeenCalledWith("thread-1", null);
    expect(pushThreadErrorMessage).toHaveBeenCalledWith(
      "thread-1",
      "Agent 连接已断开，请重试。",
    );
  });

  it("does not auto-reset while a commandExecution item is still running", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-16T00:00:00.000Z"));

    const {
      markProcessing,
      markReviewing,
      setActiveTurnId,
      setThreadPhase,
      pushThreadErrorMessage,
    } = buildCallbacks();

    const startedAt = Date.now() - (5 * 60_000);
    renderHook(() =>
      useThreadStaleGuard({
        activeWorkspaceId: "ws-1",
        activeThreadId: "thread-1",
        itemsByThread: buildItemsByThread("thread-1", { runningCommand: true }),
        threadStatusById: buildProcessingStatus(startedAt),
        markProcessing,
        markReviewing,
        setActiveTurnId,
        setThreadPhase,
        pushThreadErrorMessage,
      }),
    );

    act(() => {
      // Above default 90s silence window but below command-execution grace.
      vi.advanceTimersByTime(2 * 60_000);
    });

    expect(markProcessing).not.toHaveBeenCalled();
    expect(markReviewing).not.toHaveBeenCalled();
    expect(setActiveTurnId).not.toHaveBeenCalled();
    expect(pushThreadErrorMessage).not.toHaveBeenCalled();

    vi.useRealTimers();
  });

  it("treats commandExecution without status and duration as still running", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-16T00:00:00.000Z"));

    const {
      markProcessing,
      markReviewing,
      setActiveTurnId,
      setThreadPhase,
      pushThreadErrorMessage,
    } = buildCallbacks();

    const startedAt = Date.now() - (5 * 60_000);
    renderHook(() =>
      useThreadStaleGuard({
        activeWorkspaceId: "ws-1",
        activeThreadId: "thread-1",
        itemsByThread: buildItemsByThread("thread-1", {
          runningCommand: true,
          status: "",
          durationMs: null,
        }),
        threadStatusById: buildProcessingStatus(startedAt),
        markProcessing,
        markReviewing,
        setActiveTurnId,
        setThreadPhase,
        pushThreadErrorMessage,
      }),
    );

    act(() => {
      vi.advanceTimersByTime(2 * 60_000);
    });

    expect(markProcessing).not.toHaveBeenCalled();
    expect(markReviewing).not.toHaveBeenCalled();
    expect(setActiveTurnId).not.toHaveBeenCalled();
    expect(pushThreadErrorMessage).not.toHaveBeenCalled();

    vi.useRealTimers();
  });

  it("auto-recovers when commandExecution stays silent beyond extended grace window", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-16T00:00:00.000Z"));

    const {
      markProcessing,
      markReviewing,
      setActiveTurnId,
      setThreadPhase,
      pushThreadErrorMessage,
    } = buildCallbacks();

    const startedAt = Date.now() - (12 * 60_000);
    renderHook(() =>
      useThreadStaleGuard({
        activeWorkspaceId: "ws-1",
        activeThreadId: "thread-1",
        itemsByThread: buildItemsByThread("thread-1", { runningCommand: true }),
        threadStatusById: buildProcessingStatus(startedAt),
        markProcessing,
        markReviewing,
        setActiveTurnId,
        setThreadPhase,
        pushThreadErrorMessage,
      }),
    );

    act(() => {
      vi.advanceTimersByTime(10_000);
    });

    expect(markProcessing).toHaveBeenCalledWith("thread-1", false);
    expect(markReviewing).toHaveBeenCalledWith("thread-1", false);
    expect(setActiveTurnId).toHaveBeenCalledWith("thread-1", null);
    expect(pushThreadErrorMessage).toHaveBeenCalledWith(
      "thread-1",
      expect.stringContaining("长时间无事件"),
    );

    vi.useRealTimers();
  });
});
