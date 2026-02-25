// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  __resetLocalStorageWriteSchedulerForTests,
  flushScheduledLocalStorageWrites,
  scheduleLocalStorageWrite,
} from "./localStorageWriteScheduler";

describe("localStorageWriteScheduler", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    __resetLocalStorageWriteSchedulerForTests();
  });

  afterEach(() => {
    __resetLocalStorageWriteSchedulerForTests();
    vi.useRealTimers();
  });

  it("debounces repeated writes for the same key", () => {
    const writer = vi.fn();

    scheduleLocalStorageWrite("k1", () => writer("first"), {
      debounceMs: 50,
      maxWaitMs: 200,
    });
    vi.advanceTimersByTime(20);
    scheduleLocalStorageWrite("k1", () => writer("second"), {
      debounceMs: 50,
      maxWaitMs: 200,
    });

    vi.advanceTimersByTime(49);
    expect(writer).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(writer).toHaveBeenCalledTimes(1);
    expect(writer).toHaveBeenCalledWith("second");
  });

  it("flushes by maxWait even when writes keep arriving", () => {
    const writer = vi.fn();

    scheduleLocalStorageWrite("k2", () => writer("v1"), {
      debounceMs: 100,
      maxWaitMs: 120,
    });
    vi.advanceTimersByTime(60);
    scheduleLocalStorageWrite("k2", () => writer("v2"), {
      debounceMs: 100,
      maxWaitMs: 120,
    });
    vi.advanceTimersByTime(50);
    scheduleLocalStorageWrite("k2", () => writer("v3"), {
      debounceMs: 100,
      maxWaitMs: 120,
    });

    vi.advanceTimersByTime(10);
    expect(writer).toHaveBeenCalledTimes(1);
    expect(writer).toHaveBeenCalledWith("v3");
  });

  it("flushes pending writes on pagehide and hidden visibility", () => {
    const writer = vi.fn();

    scheduleLocalStorageWrite("k3", writer, {
      debounceMs: 500,
      maxWaitMs: 1_000,
    });
    window.dispatchEvent(new Event("pagehide"));
    expect(writer).toHaveBeenCalledTimes(1);

    scheduleLocalStorageWrite("k3", writer, {
      debounceMs: 500,
      maxWaitMs: 1_000,
    });
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "hidden",
    });
    document.dispatchEvent(new Event("visibilitychange"));
    expect(writer).toHaveBeenCalledTimes(2);
  });

  it("supports explicit flush by key and all keys", () => {
    const a = vi.fn();
    const b = vi.fn();
    scheduleLocalStorageWrite("a", a, { debounceMs: 100, maxWaitMs: 200 });
    scheduleLocalStorageWrite("b", b, { debounceMs: 100, maxWaitMs: 200 });

    flushScheduledLocalStorageWrites("a");
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).not.toHaveBeenCalled();

    flushScheduledLocalStorageWrites();
    expect(b).toHaveBeenCalledTimes(1);
  });
});
