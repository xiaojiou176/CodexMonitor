// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useThreadStatus } from "./useThreadStatus";

describe("useThreadStatus", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("dispatches markProcessing with a timestamp", () => {
    const dispatch = vi.fn();
    vi.spyOn(Date, "now").mockReturnValue(1234);
    const { result } = renderHook(() => useThreadStatus({ dispatch }));

    act(() => {
      result.current.markProcessing("thread-1", true);
    });

    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({
      type: "markProcessing",
      threadId: "thread-1",
      isProcessing: true,
      timestamp: 1234,
    });
  });

  it("dispatches markReviewing", () => {
    const dispatch = vi.fn();
    const { result } = renderHook(() => useThreadStatus({ dispatch }));

    act(() => {
      result.current.markReviewing("thread-2", false);
    });

    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({
      type: "markReviewing",
      threadId: "thread-2",
      isReviewing: false,
    });
  });

  it("dispatches setActiveTurnId", () => {
    const dispatch = vi.fn();
    const { result } = renderHook(() => useThreadStatus({ dispatch }));

    act(() => {
      result.current.setActiveTurnId("thread-3", "turn-9");
    });

    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({
      type: "setActiveTurnId",
      threadId: "thread-3",
      turnId: "turn-9",
    });
  });

  it("resets thread runtime state", () => {
    const dispatch = vi.fn();
    vi.spyOn(Date, "now").mockReturnValue(4321);
    const { result } = renderHook(() => useThreadStatus({ dispatch }));

    act(() => {
      result.current.resetThreadRuntimeState("thread-9");
    });

    expect(dispatch).toHaveBeenCalledTimes(3);
    expect(dispatch).toHaveBeenNthCalledWith(1, {
      type: "markReviewing",
      threadId: "thread-9",
      isReviewing: false,
    });
    expect(dispatch).toHaveBeenNthCalledWith(2, {
      type: "markProcessing",
      threadId: "thread-9",
      isProcessing: false,
      timestamp: 4321,
    });
    expect(dispatch).toHaveBeenNthCalledWith(3, {
      type: "setActiveTurnId",
      threadId: "thread-9",
      turnId: null,
    });
  });
});
