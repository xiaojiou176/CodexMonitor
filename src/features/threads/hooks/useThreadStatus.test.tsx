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

  it("dispatches setThreadPhase", () => {
    const dispatch = vi.fn();
    const { result } = renderHook(() => useThreadStatus({ dispatch }));

    act(() => {
      result.current.setThreadPhase("thread-4", "waiting_user");
    });

    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({
      type: "setThreadPhase",
      threadId: "thread-4",
      phase: "waiting_user",
    });
  });

  it("dispatches touchThreadActivity with a timestamp", () => {
    const dispatch = vi.fn();
    vi.spyOn(Date, "now").mockReturnValue(3210);
    const { result } = renderHook(() => useThreadStatus({ dispatch }));

    act(() => {
      result.current.touchThreadActivity("thread-7");
    });

    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({
      type: "touchThreadActivity",
      threadId: "thread-7",
      timestamp: 3210,
    });
  });

  it("resets thread runtime state", () => {
    const dispatch = vi.fn();
    vi.spyOn(Date, "now").mockReturnValue(4321);
    const { result } = renderHook(() => useThreadStatus({ dispatch }));

    act(() => {
      result.current.resetThreadRuntimeState("thread-9");
    });

    expect(dispatch).toHaveBeenCalledTimes(7);
    expect(dispatch).toHaveBeenNthCalledWith(1, {
      type: "markReviewing",
      threadId: "thread-9",
      isReviewing: false,
    });
    expect(dispatch).toHaveBeenNthCalledWith(2, {
      type: "setThreadTurnStatus",
      threadId: "thread-9",
      turnStatus: "interrupted",
    });
    expect(dispatch).toHaveBeenNthCalledWith(3, {
      type: "setThreadWaitReason",
      threadId: "thread-9",
      waitReason: "none",
    });
    expect(dispatch).toHaveBeenNthCalledWith(4, {
      type: "setThreadRetryState",
      threadId: "thread-9",
      retryState: "none",
    });
    expect(dispatch).toHaveBeenNthCalledWith(5, {
      type: "setThreadPhase",
      threadId: "thread-9",
      phase: "interrupted",
    });
    expect(dispatch).toHaveBeenNthCalledWith(6, {
      type: "markProcessing",
      threadId: "thread-9",
      isProcessing: false,
      timestamp: 4321,
    });
    expect(dispatch).toHaveBeenNthCalledWith(7, {
      type: "setActiveTurnId",
      threadId: "thread-9",
      turnId: null,
    });
  });
});
