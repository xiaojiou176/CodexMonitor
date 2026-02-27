// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { playNotificationSound } from "../../../utils/notificationSounds";
import { useAgentSoundNotifications } from "./useAgentSoundNotifications";

const useAppServerEventsMock = vi.fn();

vi.mock("../../../utils/notificationSounds", () => ({
  playNotificationSound: vi.fn(),
}));

vi.mock("../../app/hooks/useAppServerEvents", () => ({
  useAppServerEvents: (handlers: unknown) => useAppServerEventsMock(handlers),
}));

type EventHandlers = {
  onTurnStarted?: (workspaceId: string, threadId: string, turnId: string) => void;
  onTurnCompleted?: (workspaceId: string, threadId: string, turnId: string) => void;
  onTurnError?: (
    workspaceId: string,
    threadId: string,
    turnId: string,
    payload: { message: string; willRetry: boolean },
  ) => void;
  onItemStarted?: (workspaceId: string, threadId: string) => void;
  onAgentMessageCompleted?: (event: { workspaceId: string; threadId: string }) => void;
};

function getHandlers(): EventHandlers {
  const lastCall = useAppServerEventsMock.mock.calls.at(-1);
  return (lastCall?.[0] as EventHandlers | undefined) ?? {};
}

describe("useAgentSoundNotifications", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    useAppServerEventsMock.mockReset();
    vi.mocked(playNotificationSound).mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("plays success sound when a turn completes after the minimum duration", () => {
    renderHook(() =>
      useAgentSoundNotifications({
        enabled: true,
        isWindowFocused: false,
        minDurationMs: 100,
      }),
    );

    const handlers = getHandlers();

    act(() => {
      handlers.onTurnStarted?.("ws-1", "thread-1", "turn-1");
      vi.advanceTimersByTime(120);
      handlers.onTurnCompleted?.("ws-1", "thread-1", "turn-1");
    });

    expect(playNotificationSound).toHaveBeenCalledTimes(1);
    expect(vi.mocked(playNotificationSound).mock.calls[0]?.[1]).toBe("success");
  });

  it("throttles duplicate sounds for the same thread within 1500ms", () => {
    renderHook(() =>
      useAgentSoundNotifications({
        enabled: true,
        isWindowFocused: false,
        minDurationMs: 100,
      }),
    );

    const handlers = getHandlers();

    act(() => {
      handlers.onTurnStarted?.("ws-1", "thread-1", "turn-1");
      vi.advanceTimersByTime(120);
      handlers.onTurnCompleted?.("ws-1", "thread-1", "turn-1");

      handlers.onItemStarted?.("ws-1", "thread-1");
      vi.advanceTimersByTime(120);
      handlers.onAgentMessageCompleted?.({ workspaceId: "ws-1", threadId: "thread-1" });
    });

    expect(playNotificationSound).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(1500);
      handlers.onItemStarted?.("ws-1", "thread-1");
      vi.advanceTimersByTime(120);
      handlers.onAgentMessageCompleted?.({ workspaceId: "ws-1", threadId: "thread-1" });
    });

    expect(playNotificationSound).toHaveBeenCalledTimes(2);
  });

  it("does not play sound when notifications are muted", () => {
    renderHook(() =>
      useAgentSoundNotifications({
        enabled: false,
        isWindowFocused: false,
        minDurationMs: 100,
      }),
    );

    const handlers = getHandlers();

    act(() => {
      handlers.onTurnStarted?.("ws-1", "thread-1", "turn-1");
      vi.advanceTimersByTime(120);
      handlers.onTurnCompleted?.("ws-1", "thread-1", "turn-1");
    });

    expect(playNotificationSound).not.toHaveBeenCalled();
  });

  it("plays error sound only when turn errors without retry", () => {
    renderHook(() =>
      useAgentSoundNotifications({
        enabled: true,
        isWindowFocused: false,
        minDurationMs: 100,
      }),
    );

    const handlers = getHandlers();

    act(() => {
      handlers.onTurnStarted?.("ws-1", "thread-1", "turn-1");
      vi.advanceTimersByTime(120);
      handlers.onTurnError?.("ws-1", "thread-1", "turn-1", {
        message: "retrying",
        willRetry: true,
      });

      handlers.onTurnStarted?.("ws-1", "thread-1", "turn-2");
      vi.advanceTimersByTime(120);
      handlers.onTurnError?.("ws-1", "thread-1", "turn-2", {
        message: "failed",
        willRetry: false,
      });
    });

    expect(playNotificationSound).toHaveBeenCalledTimes(1);
    expect(vi.mocked(playNotificationSound).mock.calls[0]?.[1]).toBe("error");
  });
});
