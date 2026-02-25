// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  RequestUserInputRequest,
  RequestUserInputResponse,
} from "../../../types";
import { respondToUserInputRequest } from "../../../services/tauri";
import { useThreadUserInput } from "./useThreadUserInput";

vi.mock("../../../services/tauri", () => ({
  respondToUserInputRequest: vi.fn(),
}));

const request: RequestUserInputRequest = {
  workspace_id: "ws-1",
  request_id: 7,
  params: {
    thread_id: "thread-1",
    turn_id: "turn-1",
    item_id: "item-1",
    questions: [],
  },
};

const response: RequestUserInputResponse = {
  answers: {
    q1: { answers: ["yes"] },
  },
};

describe("useThreadUserInput", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("submits answers and removes request from queue", async () => {
    vi.mocked(respondToUserInputRequest).mockResolvedValue(undefined);
    const dispatch = vi.fn();
    const { result } = renderHook(() =>
      useThreadUserInput({
        dispatch,
        setThreadPhase: vi.fn(),
        setThreadWaitReason: vi.fn(),
      }),
    );

    await act(async () => {
      await result.current.handleUserInputSubmit(request, response);
    });

    expect(respondToUserInputRequest).toHaveBeenCalledWith(
      "ws-1",
      7,
      response.answers,
    );
    expect(dispatch).toHaveBeenCalledWith({
      type: "removeUserInputRequest",
      requestId: 7,
      workspaceId: "ws-1",
    });
  });

  it("does not remove request when submit fails", async () => {
    vi.mocked(respondToUserInputRequest).mockRejectedValue(
      new Error("submit failed"),
    );
    const dispatch = vi.fn();
    const { result } = renderHook(() =>
      useThreadUserInput({
        dispatch,
        setThreadPhase: vi.fn(),
        setThreadWaitReason: vi.fn(),
      }),
    );

    await expect(
      result.current.handleUserInputSubmit(request, response),
    ).rejects.toThrow("submit failed");
    expect(dispatch).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: "removeUserInputRequest" }),
    );
  });
});
