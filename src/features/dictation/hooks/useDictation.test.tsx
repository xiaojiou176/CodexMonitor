// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DictationEvent } from "../../../types";
import { useDictation } from "./useDictation";

const startDictationMock = vi.fn();
const stopDictationMock = vi.fn();
const cancelDictationMock = vi.fn();
const subscribeDictationEventsMock = vi.fn();

vi.mock("../../../services/tauri", () => ({
  startDictation: (preferredLanguage: string | null) =>
    startDictationMock(preferredLanguage),
  stopDictation: () => stopDictationMock(),
  cancelDictation: () => cancelDictationMock(),
}));

vi.mock("../../../services/events", () => ({
  subscribeDictationEvents: (handler: (event: DictationEvent) => void) =>
    subscribeDictationEventsMock(handler),
}));

describe("useDictation", () => {
  let emitEvent: ((event: DictationEvent) => void) | null = null;
  let unlistenMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    unlistenMock = vi.fn();
    emitEvent = null;
    subscribeDictationEventsMock.mockImplementation((handler: (event: DictationEvent) => void) => {
      emitEvent = handler;
      return unlistenMock;
    });
    startDictationMock.mockResolvedValue("listening");
    stopDictationMock.mockResolvedValue("processing");
    cancelDictationMock.mockResolvedValue("idle");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("tracks state and level events, resetting level when state returns to idle", () => {
    const { result } = renderHook(() => useDictation());

    act(() => {
      emitEvent?.({ type: "state", state: "listening" });
      emitEvent?.({ type: "level", value: 73 });
    });

    expect(result.current.state).toBe("listening");
    expect(result.current.level).toBe(73);

    act(() => {
      emitEvent?.({ type: "state", state: "idle" });
    });

    expect(result.current.state).toBe("idle");
    expect(result.current.level).toBe(0);
  });

  it("stores transcript, supports id-targeted clear, and keeps mismatched transcript", () => {
    const { result } = renderHook(() => useDictation());

    act(() => {
      emitEvent?.({ type: "transcript", text: "hello world" });
    });

    const transcript = result.current.transcript;
    expect(transcript?.text).toBe("hello world");
    expect(typeof transcript?.id).toBe("string");

    act(() => {
      result.current.clearTranscript("not-current");
    });
    expect(result.current.transcript?.text).toBe("hello world");

    act(() => {
      result.current.clearTranscript(transcript?.id ?? "");
    });
    expect(result.current.transcript).toBeNull();
  });

  it("clears hint on timer and resets timer when canceled twice", () => {
    const { result } = renderHook(() => useDictation());

    act(() => {
      emitEvent?.({ type: "canceled", message: "first cancel" });
    });
    expect(result.current.hint).toBe("first cancel");

    act(() => {
      vi.advanceTimersByTime(1500);
      emitEvent?.({ type: "canceled", message: "second cancel" });
      vi.advanceTimersByTime(700);
    });

    expect(result.current.hint).toBe("second cancel");

    act(() => {
      vi.advanceTimersByTime(1300);
    });
    expect(result.current.hint).toBeNull();
  });

  it("supports error lifecycle and start/stop/cancel callbacks", async () => {
    const { result } = renderHook(() => useDictation());

    act(() => {
      emitEvent?.({ type: "error", message: "mic denied" });
      emitEvent?.({ type: "canceled", message: "manual cancel" });
    });
    expect(result.current.error).toBe("mic denied");
    expect(result.current.hint).toBe("manual cancel");

    await act(async () => {
      await result.current.start("en-US");
    });
    expect(startDictationMock).toHaveBeenCalledWith("en-US");
    expect(result.current.error).toBeNull();
    expect(result.current.hint).toBeNull();

    await act(async () => {
      await result.current.stop();
      await result.current.cancel();
    });

    expect(stopDictationMock).toHaveBeenCalledTimes(1);
    expect(cancelDictationMock).toHaveBeenCalledTimes(1);

    act(() => {
      emitEvent?.({ type: "error", message: "recoverable" });
      result.current.clearError();
      emitEvent?.({ type: "canceled", message: "short hint" });
      result.current.clearHint();
    });

    expect(result.current.error).toBeNull();
    expect(result.current.hint).toBeNull();
  });

  it("unsubscribes on unmount", async () => {
    const { unmount } = renderHook(() => useDictation());

    await act(async () => {
      unmount();
    });

    expect(unlistenMock).toHaveBeenCalledTimes(1);
  });
});
