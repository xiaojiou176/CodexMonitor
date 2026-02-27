// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendNotification } from "../../../services/tauri";
import { useAgentSystemNotifications } from "./useAgentSystemNotifications";

const useAppServerEventsMock = vi.fn();

vi.mock("../../../services/tauri", () => ({
  sendNotification: vi.fn(),
}));

vi.mock("../../app/hooks/useAppServerEvents", () => ({
  useAppServerEvents: (handlers: unknown) => useAppServerEventsMock(handlers),
}));

function flushMicrotaskQueue() {
  return new Promise<void>((resolve) => {
    queueMicrotask(resolve);
  });
}

function getHandlers() {
  const lastCall =
    useAppServerEventsMock.mock.calls[useAppServerEventsMock.mock.calls.length - 1];
  return (lastCall?.[0] ?? {}) as {
    onTurnStarted?: (workspaceId: string, threadId: string, turnId: string) => void;
    onTurnCompleted?: (workspaceId: string, threadId: string, turnId: string) => void;
    onTurnError?: (
      workspaceId: string,
      threadId: string,
      turnId: string,
      payload: { message: string; willRetry: boolean },
    ) => void;
    onItemStarted?: (workspaceId: string, threadId: string) => void;
    onAgentMessageDelta?: (event: { workspaceId: string; threadId: string }) => void;
    onAgentMessageCompleted?: (event: {
      workspaceId: string;
      threadId: string;
      text: string;
    }) => void;
  };
}

describe("useAgentSystemNotifications", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-27T10:00:00.000Z"));
    vi.mocked(sendNotification).mockReset();
    vi.mocked(sendNotification).mockResolvedValue();
    useAppServerEventsMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("sends a completion notification when duration threshold is met", async () => {
    const onThreadNotificationSent = vi.fn();
    const onDebug = vi.fn();

    renderHook(() =>
      useAgentSystemNotifications({
        enabled: true,
        isWindowFocused: false,
        minDurationMs: 1_000,
        getWorkspaceName: () => "Workspace A",
        onThreadNotificationSent,
        onDebug,
      }),
    );

    const handlers = getHandlers();
    act(() => {
      handlers.onTurnStarted?.("ws-1", "thread-1", "turn-1");
      vi.advanceTimersByTime(1_100);
      handlers.onTurnCompleted?.("ws-1", "thread-1", "turn-1");
    });
    await act(async () => {
      await flushMicrotaskQueue();
    });

    expect(sendNotification).toHaveBeenCalledTimes(1);
    expect(vi.mocked(sendNotification).mock.calls[0]).toEqual([
      "Workspace A",
      "Your agent has finished its task.",
      {
        autoCancel: true,
        extra: { kind: "thread", workspaceId: "ws-1", threadId: "thread-1" },
      },
    ]);
    expect(onThreadNotificationSent).toHaveBeenCalledWith("ws-1", "thread-1");
    expect(onDebug).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "client",
        label: "notification/success",
      }),
    );
  });

  it("deduplicates completion notifications inside the cooldown window", async () => {
    renderHook(() =>
      useAgentSystemNotifications({
        enabled: true,
        isWindowFocused: false,
        minDurationMs: 100,
      }),
    );
    const handlers = getHandlers();

    act(() => {
      handlers.onTurnStarted?.("ws-1", "thread-1", "turn-1");
      vi.advanceTimersByTime(200);
      handlers.onTurnCompleted?.("ws-1", "thread-1", "turn-1");
    });
    await act(async () => {
      await flushMicrotaskQueue();
    });
    expect(sendNotification).toHaveBeenCalledTimes(1);

    act(() => {
      handlers.onTurnStarted?.("ws-1", "thread-1", "turn-2");
      vi.advanceTimersByTime(200);
      handlers.onTurnCompleted?.("ws-1", "thread-1", "turn-2");
    });
    await act(async () => {
      await flushMicrotaskQueue();
    });
    expect(sendNotification).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(1_500);
      handlers.onTurnStarted?.("ws-1", "thread-1", "turn-3");
      vi.advanceTimersByTime(200);
      handlers.onTurnCompleted?.("ws-1", "thread-1", "turn-3");
    });
    await act(async () => {
      await flushMicrotaskQueue();
    });
    expect(sendNotification).toHaveBeenCalledTimes(2);
  });

  it("cleans up previous message after notifying and falls back for next turn", async () => {
    renderHook(() =>
      useAgentSystemNotifications({
        enabled: true,
        isWindowFocused: false,
        minDurationMs: 1,
      }),
    );
    const handlers = getHandlers();

    act(() => {
      handlers.onItemStarted?.("ws-1", "thread-1");
      vi.advanceTimersByTime(5);
      handlers.onAgentMessageCompleted?.({
        workspaceId: "ws-1",
        threadId: "thread-1",
        text: "first-message",
      });
    });
    await act(async () => {
      await flushMicrotaskQueue();
    });
    expect(vi.mocked(sendNotification).mock.calls[0]?.[1]).toBe("first-message");

    act(() => {
      vi.advanceTimersByTime(1_500);
      handlers.onTurnStarted?.("ws-1", "thread-1", "turn-2");
      vi.advanceTimersByTime(5);
      handlers.onTurnCompleted?.("ws-1", "thread-1", "turn-2");
    });
    await act(async () => {
      await flushMicrotaskQueue();
    });
    expect(vi.mocked(sendNotification).mock.calls[1]?.[1]).toBe(
      "Your agent has finished its task.",
    );
  });

  it("records start from item and delta events, and truncates long message text", async () => {
    const longText = "x".repeat(250);

    renderHook(() =>
      useAgentSystemNotifications({
        enabled: true,
        isWindowFocused: false,
        minDurationMs: 1,
      }),
    );
    const handlers = getHandlers();

    act(() => {
      handlers.onItemStarted?.("ws-1", "thread-1");
      handlers.onAgentMessageDelta?.({ workspaceId: "ws-1", threadId: "thread-1" });
      vi.advanceTimersByTime(5);
      handlers.onAgentMessageCompleted?.({
        workspaceId: "ws-1",
        threadId: "thread-1",
        text: longText,
      });
    });
    await act(async () => {
      await flushMicrotaskQueue();
    });

    const notifiedBody = vi.mocked(sendNotification).mock.calls[0]?.[1];
    expect(typeof notifiedBody).toBe("string");
    expect(notifiedBody).toHaveLength(200);
    expect((notifiedBody ?? "").endsWith("…")).toBe(true);
  });

  it("suppresses notifications for disabled, focused, short, or missing-duration flows", async () => {
    const baseAction = async (options: {
      enabled: boolean;
      isWindowFocused: boolean;
      minDurationMs?: number;
      advanceMs?: number;
      withStart?: boolean;
    }) => {
      renderHook(() =>
        useAgentSystemNotifications({
          enabled: options.enabled,
          isWindowFocused: options.isWindowFocused,
          minDurationMs: options.minDurationMs ?? 10,
        }),
      );
      const handlers = getHandlers();
      act(() => {
        if (options.withStart ?? true) {
          handlers.onTurnStarted?.("ws-1", "thread-1", "turn-1");
        }
        vi.advanceTimersByTime(options.advanceMs ?? 5);
        handlers.onTurnCompleted?.("ws-1", "thread-1", "turn-1");
      });
      await act(async () => {
        await flushMicrotaskQueue();
      });
    };

    await baseAction({ enabled: false, isWindowFocused: false });
    await baseAction({
      enabled: true,
      isWindowFocused: true,
      minDurationMs: 1,
      advanceMs: 5,
    });
    await baseAction({
      enabled: true,
      isWindowFocused: false,
      minDurationMs: 1_000,
      advanceMs: 100,
    });
    await baseAction({
      enabled: true,
      isWindowFocused: false,
      withStart: false,
    });

    expect(sendNotification).not.toHaveBeenCalled();
  });

  it("skips error and message-complete notifications when shouldNotify returns false", async () => {
    renderHook(() =>
      useAgentSystemNotifications({
        enabled: true,
        isWindowFocused: false,
        minDurationMs: 1_000,
      }),
    );
    const handlers = getHandlers();

    act(() => {
      handlers.onTurnStarted?.("ws-1", "thread-1", "turn-1");
      vi.advanceTimersByTime(10);
      handlers.onTurnError?.("ws-1", "thread-1", "turn-1", {
        message: "too fast",
        willRetry: false,
      });
      handlers.onItemStarted?.("ws-1", "thread-2");
      vi.advanceTimersByTime(10);
      handlers.onAgentMessageCompleted?.({
        workspaceId: "ws-1",
        threadId: "thread-2",
        text: "too fast",
      });
    });
    await act(async () => {
      await flushMicrotaskQueue();
    });

    expect(sendNotification).not.toHaveBeenCalled();
  });

  it("sends error notification for non-retry failures and skips retrying errors", async () => {
    const onThreadNotificationSent = vi.fn();

    renderHook(() =>
      useAgentSystemNotifications({
        enabled: true,
        isWindowFocused: false,
        minDurationMs: 1,
        onThreadNotificationSent,
      }),
    );
    const handlers = getHandlers();

    act(() => {
      handlers.onTurnStarted?.("ws-1", "thread-1", "turn-1");
      vi.advanceTimersByTime(5);
      handlers.onTurnError?.("ws-1", "thread-1", "turn-1", {
        message: "will retry",
        willRetry: true,
      });
    });
    await act(async () => {
      await flushMicrotaskQueue();
    });
    expect(sendNotification).toHaveBeenCalledTimes(0);

    act(() => {
      handlers.onTurnStarted?.("ws-1", "thread-1", "turn-2");
      vi.advanceTimersByTime(5);
      handlers.onTurnError?.("ws-1", "thread-1", "turn-2", {
        message: "fatal error",
        willRetry: false,
      });
    });
    await act(async () => {
      await flushMicrotaskQueue();
    });
    expect(sendNotification).toHaveBeenCalledTimes(1);
    expect(vi.mocked(sendNotification).mock.calls[0]?.[0]).toBe("Agent Error");
    expect(vi.mocked(sendNotification).mock.calls[0]?.[1]).toBe("fatal error");
    expect(onThreadNotificationSent).toHaveBeenCalledWith("ws-1", "thread-1");
  });

  it("suppresses all notifications for sub-agent threads", async () => {
    renderHook(() =>
      useAgentSystemNotifications({
        enabled: true,
        isWindowFocused: false,
        minDurationMs: 1,
        isSubAgentThread: (_workspaceId, threadId) => threadId === "thread-sub",
      }),
    );
    const handlers = getHandlers();

    act(() => {
      handlers.onTurnStarted?.("ws-1", "thread-sub", "turn-1");
      handlers.onItemStarted?.("ws-1", "thread-sub");
      handlers.onAgentMessageDelta?.({ workspaceId: "ws-1", threadId: "thread-sub" });
      handlers.onAgentMessageCompleted?.({
        workspaceId: "ws-1",
        threadId: "thread-sub",
        text: "ignore",
      });
      handlers.onTurnCompleted?.("ws-1", "thread-sub", "turn-1");
      handlers.onTurnError?.("ws-1", "thread-sub", "turn-1", {
        message: "ignore",
        willRetry: false,
      });
    });
    await act(async () => {
      await flushMicrotaskQueue();
    });

    expect(sendNotification).not.toHaveBeenCalled();
  });

  it("records debug error when notification delivery fails", async () => {
    const onDebug = vi.fn();
    vi.mocked(sendNotification).mockRejectedValueOnce(new Error("notification failed"));

    renderHook(() =>
      useAgentSystemNotifications({
        enabled: true,
        isWindowFocused: false,
        minDurationMs: 1,
        onDebug,
      }),
    );
    const handlers = getHandlers();

    act(() => {
      handlers.onTurnStarted?.("ws-1", "thread-1", "turn-1");
      vi.advanceTimersByTime(10);
      handlers.onTurnCompleted?.("ws-1", "thread-1", "turn-1");
    });
    await act(async () => {
      await flushMicrotaskQueue();
      await flushMicrotaskQueue();
    });

    expect(sendNotification).toHaveBeenCalledTimes(1);
    expect(onDebug).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "error",
        label: "notification/error",
        payload: "notification failed",
      }),
    );
  });
});
