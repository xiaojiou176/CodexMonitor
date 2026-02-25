// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { RequestUserInputRequest } from "../../../types";
import { useThreadUserInputEvents } from "./useThreadUserInputEvents";

function buildRequest(threadId: string): RequestUserInputRequest {
  return {
    workspace_id: "ws-1",
    request_id: 101,
    params: {
      thread_id: threadId,
      turn_id: "turn-1",
      item_id: "item-1",
      questions: [],
    },
  };
}

describe("useThreadUserInputEvents", () => {
  it("ensures thread and sets waiting state when thread_id is present", () => {
    const dispatch = vi.fn();
    const setThreadPhase = vi.fn();
    const setThreadWaitReason = vi.fn();
    const { result } = renderHook(() =>
      useThreadUserInputEvents({
        dispatch,
        setThreadPhase,
        setThreadWaitReason,
      }),
    );

    act(() => {
      result.current(buildRequest("  thread-1 "));
    });

    expect(dispatch).toHaveBeenCalledWith({
      type: "ensureThread",
      workspaceId: "ws-1",
      threadId: "thread-1",
    });
    expect(setThreadPhase).toHaveBeenCalledWith("thread-1", "waiting_user");
    expect(setThreadWaitReason).toHaveBeenCalledWith("thread-1", "user_input");
    expect(dispatch).toHaveBeenCalledWith({
      type: "addUserInputRequest",
      request: buildRequest("  thread-1 "),
    });
  });

  it("skips thread state updates when thread_id is blank", () => {
    const dispatch = vi.fn();
    const setThreadPhase = vi.fn();
    const setThreadWaitReason = vi.fn();
    const request = buildRequest("   ");
    const { result } = renderHook(() =>
      useThreadUserInputEvents({
        dispatch,
        setThreadPhase,
        setThreadWaitReason,
      }),
    );

    act(() => {
      result.current(request);
    });

    expect(setThreadPhase).not.toHaveBeenCalled();
    expect(setThreadWaitReason).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: "ensureThread" }),
    );
    expect(dispatch).toHaveBeenCalledWith({
      type: "addUserInputRequest",
      request,
    });
  });
});
