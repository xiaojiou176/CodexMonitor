// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { createSidebarTicker } from "./useSidebarTicker";

describe("createSidebarTicker", () => {
  afterEach(() => {
    if (vi.isFakeTimers()) {
      vi.runOnlyPendingTimers();
      vi.useRealTimers();
    }
  });

  it("shares a single interval across multiple subscribers and stops after last unsubscribe", () => {
    vi.useFakeTimers();
    const setIntervalSpy = vi.spyOn(window, "setInterval");
    const clearIntervalSpy = vi.spyOn(window, "clearInterval");

    const ticker = createSidebarTicker(1000);
    const listenerA = vi.fn();
    const listenerB = vi.fn();

    const unsubscribeA = ticker.subscribe(listenerA);
    const unsubscribeB = ticker.subscribe(listenerB);

    expect(setIntervalSpy).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(1000);
    expect(listenerA).toHaveBeenCalledTimes(1);
    expect(listenerB).toHaveBeenCalledTimes(1);

    unsubscribeA();
    expect(clearIntervalSpy).toHaveBeenCalledTimes(0);

    unsubscribeB();
    expect(clearIntervalSpy).toHaveBeenCalledTimes(1);

    ticker.dispose();
    setIntervalSpy.mockRestore();
    clearIntervalSpy.mockRestore();
  });

  it("cleans up timer on dispose while subscribed", () => {
    vi.useFakeTimers();
    const clearIntervalSpy = vi.spyOn(window, "clearInterval");

    const ticker = createSidebarTicker(1000);
    const unsubscribe = ticker.subscribe(() => undefined);

    ticker.dispose();
    expect(clearIntervalSpy).toHaveBeenCalledTimes(1);

    unsubscribe();
    clearIntervalSpy.mockRestore();
  });
});
