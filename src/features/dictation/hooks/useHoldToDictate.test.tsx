// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useHoldToDictate } from "./useHoldToDictate";

type DictationState = "idle" | "listening" | "processing";

type SetupOptions = {
  enabled?: boolean;
  ready?: boolean;
  state?: DictationState;
  holdKey?: string;
  preferredLanguage?: string | null;
};

function dispatchKeyDown(key: string, repeat = false) {
  const event = new KeyboardEvent("keydown", { key, bubbles: true, repeat });
  window.dispatchEvent(event);
}

function dispatchKeyUp(key: string) {
  const event = new KeyboardEvent("keyup", { key, bubbles: true });
  window.dispatchEvent(event);
}

function dispatchBlur() {
  window.dispatchEvent(new Event("blur"));
}

function setupHook(options: SetupOptions = {}) {
  const startDictation = vi.fn();
  const stopDictation = vi.fn();
  const cancelDictation = vi.fn();

  const props = {
    enabled: options.enabled ?? true,
    ready: options.ready ?? true,
    state: options.state ?? "idle",
    preferredLanguage: options.preferredLanguage ?? "en-US",
    holdKey: options.holdKey ?? "alt",
    startDictation,
    stopDictation,
    cancelDictation,
  };

  const hook = renderHook((nextProps: typeof props) => useHoldToDictate(nextProps), {
    initialProps: props,
  });

  return {
    ...hook,
    startDictation,
    stopDictation,
    cancelDictation,
    rerenderWith: (partial: Partial<typeof props>) =>
      hook.rerender({
        ...props,
        ...partial,
      }),
  };
}

describe("useHoldToDictate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts dictation on matching hold key when enabled, ready, and idle", () => {
    const { startDictation } = setupHook({ preferredLanguage: "zh-CN" });

    act(() => {
      dispatchKeyDown("Alt");
    });

    expect(startDictation).toHaveBeenCalledTimes(1);
    expect(startDictation).toHaveBeenCalledWith("zh-CN");
  });

  it("does not start dictation for non-matching key, repeated keydown, or blocked states", () => {
    const nonMatch = setupHook({ holdKey: "alt" });

    act(() => {
      dispatchKeyDown("Shift");
      dispatchKeyDown("Alt", true);
    });

    expect(nonMatch.startDictation).not.toHaveBeenCalled();
    nonMatch.unmount();

    const disabled = setupHook({ enabled: false });
    act(() => {
      dispatchKeyDown("Alt");
    });
    expect(disabled.startDictation).not.toHaveBeenCalled();
    disabled.unmount();

    const notReady = setupHook({ ready: false });
    act(() => {
      dispatchKeyDown("Alt");
    });
    expect(notReady.startDictation).not.toHaveBeenCalled();
    notReady.unmount();

    const nonIdle = setupHook({ state: "processing" });
    act(() => {
      dispatchKeyDown("Alt");
    });
    expect(nonIdle.startDictation).not.toHaveBeenCalled();
    nonIdle.unmount();
  });

  it("stops immediately on keyup when dictation is already listening", () => {
    const { startDictation, stopDictation, rerenderWith } = setupHook({ state: "idle" });

    act(() => {
      dispatchKeyDown("Alt");
      rerenderWith({ state: "listening" });
    });
    expect(startDictation).toHaveBeenCalledTimes(1);

    act(() => {
      dispatchKeyUp("Alt");
    });

    expect(stopDictation).toHaveBeenCalledTimes(1);
  });

  it("stops when state transitions to listening during the stop-grace window", () => {
    const { startDictation, stopDictation, rerenderWith } = setupHook({ state: "idle" });

    act(() => {
      dispatchKeyDown("Alt");
      dispatchKeyUp("Alt");
    });

    expect(startDictation).toHaveBeenCalledTimes(1);
    expect(stopDictation).not.toHaveBeenCalled();

    act(() => {
      rerenderWith({ state: "listening" });
    });

    expect(stopDictation).toHaveBeenCalledTimes(1);
  });

  it("does not stop after grace timeout expires", () => {
    const { stopDictation, rerenderWith } = setupHook({ state: "idle" });

    act(() => {
      dispatchKeyDown("Alt");
      dispatchKeyUp("Alt");
      vi.advanceTimersByTime(1500);
      rerenderWith({ state: "listening" });
    });

    expect(stopDictation).not.toHaveBeenCalled();
  });

  it("cancels dictation on blur when hold is active and state is listening", () => {
    const { cancelDictation, rerenderWith } = setupHook({ state: "idle" });

    act(() => {
      dispatchKeyDown("Alt");
    });

    act(() => {
      rerenderWith({ state: "listening" });
    });

    act(() => {
      dispatchBlur();
    });

    expect(cancelDictation).toHaveBeenCalledTimes(1);
  });

  it("cleans up listeners and pending timeout on unmount", () => {
    const clearTimeoutSpy = vi.spyOn(window, "clearTimeout");
    const { unmount, startDictation } = setupHook({ state: "idle" });

    act(() => {
      dispatchKeyDown("Alt");
      dispatchKeyUp("Alt");
    });

    unmount();

    act(() => {
      dispatchKeyDown("Alt");
    });

    expect(startDictation).toHaveBeenCalledTimes(1);
    expect(clearTimeoutSpy).toHaveBeenCalled();
  });
});
