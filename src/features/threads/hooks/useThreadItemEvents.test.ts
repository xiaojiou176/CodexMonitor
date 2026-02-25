// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildConversationItem } from "../../../utils/threadItems";
import { useThreadItemEvents } from "./useThreadItemEvents";

vi.mock("../../../utils/threadItems", () => ({
  buildConversationItem: vi.fn(),
}));

type ItemPayload = Record<string, unknown>;

type SetupOverrides = {
  activeThreadId?: string | null;
  getCustomName?: (workspaceId: string, threadId: string) => string | undefined;
  onUserMessageCreated?: (workspaceId: string, threadId: string, text: string) => void;
  onReviewExited?: (workspaceId: string, threadId: string) => void;
  getThreadTurnStatus?: (threadId: string) => "completed" | null;
};

const makeOptions = (overrides: SetupOverrides = {}) => {
  const dispatch = vi.fn();
  const markProcessing = vi.fn();
  const markReviewing = vi.fn();
  const setThreadPhase = vi.fn();
  const setThreadMessagePhase = vi.fn();
  const setActiveItemStatus = vi.fn();
  const clearActiveItemStatus = vi.fn();
  const setMcpProgressMessage = vi.fn();
  const getThreadTurnStatus = overrides.getThreadTurnStatus ?? vi.fn(() => null);
  const touchThreadActivity = vi.fn();
  const safeMessageActivity = vi.fn();
  const recordThreadActivity = vi.fn();
  const applyCollabThreadLinks = vi.fn();
  const getCustomName =
    overrides.getCustomName ?? vi.fn(() => undefined);

  const { result, unmount } = renderHook(() =>
    useThreadItemEvents({
      activeThreadId: overrides.activeThreadId ?? null,
      dispatch,
      getCustomName,
      markProcessing,
      markReviewing,
      setThreadPhase,
      setThreadMessagePhase,
      setActiveItemStatus,
      clearActiveItemStatus,
      setMcpProgressMessage,
      getThreadTurnStatus,
      touchThreadActivity,
      safeMessageActivity,
      recordThreadActivity,
      applyCollabThreadLinks,
      onUserMessageCreated: overrides.onUserMessageCreated,
      onReviewExited: overrides.onReviewExited,
    }),
  );

  return {
    result,
    unmount,
    dispatch,
    markProcessing,
    markReviewing,
    setThreadPhase,
    setThreadMessagePhase,
    setActiveItemStatus,
    clearActiveItemStatus,
    setMcpProgressMessage,
    getThreadTurnStatus,
    touchThreadActivity,
    safeMessageActivity,
    recordThreadActivity,
    applyCollabThreadLinks,
    getCustomName,
  };
};

describe("useThreadItemEvents", () => {
  const convertedItem = {
    id: "item-1",
    kind: "message",
    role: "assistant",
    text: "Hello",
  } as const;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(buildConversationItem).mockReturnValue(convertedItem);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("dispatches item updates and marks review mode on item start", () => {
    const getCustomName = vi.fn(() => "Custom");
    const { result, dispatch, markProcessing, markReviewing, safeMessageActivity, applyCollabThreadLinks } =
      makeOptions({ getCustomName });
    const item: ItemPayload = { type: "enteredReviewMode", id: "item-1" };

    act(() => {
      result.current.onItemStarted("ws-1", "thread-1", item);
    });

    expect(dispatch).toHaveBeenCalledWith({
      type: "ensureThread",
      workspaceId: "ws-1",
      threadId: "thread-1",
    });
    expect(markProcessing).toHaveBeenCalledWith("thread-1", true);
    expect(markReviewing).toHaveBeenCalledWith("thread-1", true);
    expect(applyCollabThreadLinks).toHaveBeenCalledWith("thread-1", item);
    expect(dispatch).toHaveBeenCalledWith({
      type: "upsertItem",
      workspaceId: "ws-1",
      threadId: "thread-1",
      item: convertedItem,
      hasCustomName: true,
    });
    expect(safeMessageActivity).toHaveBeenCalled();
  });

  it("marks review/processing false when review mode exits", () => {
    const { result, dispatch, markProcessing, markReviewing, safeMessageActivity } = makeOptions();
    const item: ItemPayload = { type: "exitedReviewMode", id: "review-1" };

    act(() => {
      result.current.onItemCompleted("ws-1", "thread-1", item);
    });

    expect(markReviewing).toHaveBeenCalledWith("thread-1", false);
    expect(markProcessing).toHaveBeenCalledWith("thread-1", false);
    expect(dispatch).toHaveBeenCalledWith({
      type: "ensureThread",
      workspaceId: "ws-1",
      threadId: "thread-1",
    });
    expect(dispatch).toHaveBeenCalledWith({
      type: "upsertItem",
      workspaceId: "ws-1",
      threadId: "thread-1",
      item: convertedItem,
      hasCustomName: false,
    });
    expect(safeMessageActivity).toHaveBeenCalled();
  });

  it("only triggers onReviewExited on completed exit events", () => {
    const onReviewExited = vi.fn();
    const { result } = makeOptions({ onReviewExited });
    const item: ItemPayload = { type: "exitedReviewMode", id: "review-1" };

    act(() => {
      result.current.onItemStarted("ws-1", "thread-1", item);
    });
    expect(onReviewExited).not.toHaveBeenCalled();

    act(() => {
      result.current.onItemCompleted("ws-1", "thread-1", item);
    });
    expect(onReviewExited).toHaveBeenCalledTimes(1);
    expect(onReviewExited).toHaveBeenCalledWith("ws-1", "thread-1");
  });

  it("adds lifecycle status for context compaction items", () => {
    const { result } = makeOptions();
    const item: ItemPayload = { type: "contextCompaction", id: "compact-1" };

    act(() => {
      result.current.onItemStarted("ws-1", "thread-1", item);
    });
    expect(buildConversationItem).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "contextCompaction",
        id: "compact-1",
        status: "inProgress",
      }),
    );

    act(() => {
      result.current.onItemCompleted("ws-1", "thread-1", item);
    });
    expect(buildConversationItem).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "contextCompaction",
        id: "compact-1",
        status: "completed",
      }),
    );
  });

  it("notifies when a user message is created", () => {
    const onUserMessageCreated = vi.fn();
    vi.mocked(buildConversationItem).mockReturnValue({
      id: "item-2",
      kind: "message",
      role: "user",
      text: "Hello from user",
    });
    const { result } = makeOptions({ onUserMessageCreated });
    const item: ItemPayload = { type: "userMessage", id: "item-2" };

    act(() => {
      result.current.onItemCompleted("ws-1", "thread-1", item);
    });

    expect(onUserMessageCreated).toHaveBeenCalledWith(
      "ws-1",
      "thread-1",
      "Hello from user",
    );
  });

  it("marks processing and appends agent deltas", async () => {
    const { result, dispatch, markProcessing } = makeOptions();

    act(() => {
      result.current.onAgentMessageDelta({
        workspaceId: "ws-1",
        threadId: "thread-1",
        itemId: "assistant-1",
        delta: "Hello",
      });
    });

    expect(dispatch).toHaveBeenCalledWith({
      type: "ensureThread",
      workspaceId: "ws-1",
      threadId: "thread-1",
    });
    expect(markProcessing).toHaveBeenCalledWith("thread-1", true);

    // Delta is now batched via requestAnimationFrame; flush it
    await act(async () => {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    });

    expect(dispatch).toHaveBeenCalledWith({
      type: "appendAgentDelta",
      workspaceId: "ws-1",
      threadId: "thread-1",
      itemId: "assistant-1",
      delta: "Hello",
      hasCustomName: false,
      turnId: null,
    });
  });

  it("completes agent messages and updates thread activity", () => {
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(1234);
    const { result, dispatch, recordThreadActivity, safeMessageActivity } = makeOptions({
      activeThreadId: "thread-2",
    });

    act(() => {
      result.current.onAgentMessageCompleted({
        workspaceId: "ws-1",
        threadId: "thread-1",
        itemId: "assistant-1",
        text: "Done",
      });
    });

    expect(dispatch).toHaveBeenCalledWith({
      type: "ensureThread",
      workspaceId: "ws-1",
      threadId: "thread-1",
    });
    expect(dispatch).toHaveBeenCalledWith({
      type: "completeAgentMessage",
      workspaceId: "ws-1",
      threadId: "thread-1",
      itemId: "assistant-1",
      text: "Done",
      hasCustomName: false,
      turnId: null,
    });
    expect(dispatch).toHaveBeenCalledWith({
      type: "setThreadTimestamp",
      workspaceId: "ws-1",
      threadId: "thread-1",
      timestamp: 1234,
    });
    expect(dispatch).toHaveBeenCalledWith({
      type: "setLastAgentMessage",
      threadId: "thread-1",
      text: "Done",
      timestamp: 1234,
    });
    expect(recordThreadActivity).toHaveBeenCalledWith("ws-1", "thread-1", 1234);
    expect(safeMessageActivity).toHaveBeenCalled();
    expect(dispatch).toHaveBeenCalledWith({
      type: "markUnread",
      threadId: "thread-1",
      hasUnread: true,
    });

    nowSpy.mockRestore();
  });

  it("dispatches reasoning summary boundaries", () => {
    const { result, dispatch } = makeOptions();

    act(() => {
      result.current.onReasoningSummaryBoundary("ws-1", "thread-1", "reasoning-1");
    });

    expect(dispatch).toHaveBeenCalledWith({
      type: "appendReasoningSummaryBoundary",
      threadId: "thread-1",
      itemId: "reasoning-1",
    });
  });

  it("dispatches plan deltas", () => {
    const { result, dispatch } = makeOptions();

    act(() => {
      result.current.onPlanDelta("ws-1", "thread-1", "plan-1", "- Step 1");
    });

    expect(dispatch).toHaveBeenCalledWith({
      type: "appendPlanDelta",
      threadId: "thread-1",
      itemId: "plan-1",
      delta: "- Step 1",
    });
  });

  it("ignores empty stdin terminal interaction payloads", () => {
    const { result, dispatch, markProcessing } = makeOptions();

    act(() => {
      result.current.onTerminalInteraction("ws-1", "thread-1", "tool-1", "");
    });

    expect(dispatch).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: "appendToolOutput" }),
    );
    expect(markProcessing).not.toHaveBeenCalled();
  });

  it("avoids processing phase changes for terminal turns on tool output and mcp progress", () => {
    const { result, markProcessing, setThreadPhase, setActiveItemStatus, setMcpProgressMessage } =
      makeOptions({
        getThreadTurnStatus: () => "completed",
      });

    act(() => {
      result.current.onCommandOutputDelta("ws-1", "thread-1", "tool-1", "delta");
      result.current.onMcpToolCallProgress("ws-1", "thread-1", "tool-1", "50%");
    });

    expect(markProcessing).not.toHaveBeenCalled();
    expect(setThreadPhase).not.toHaveBeenCalled();
    expect(setActiveItemStatus).toHaveBeenCalledWith("thread-1", "tool-1", "inProgress");
    expect(setMcpProgressMessage).toHaveBeenCalledWith("thread-1", "50%");
  });

  it("merges pending agent deltas for the same key before a single flush", async () => {
    const { result, dispatch } = makeOptions({
      getCustomName: () => "Custom Name",
    });

    act(() => {
      result.current.onAgentMessageDelta({
        workspaceId: "ws-1",
        threadId: "thread-1",
        itemId: "assistant-1",
        delta: "Hello ",
        turnId: "turn-1",
      });
      result.current.onAgentMessageDelta({
        workspaceId: "ws-1",
        threadId: "thread-1",
        itemId: "assistant-1",
        delta: "World",
      });
    });

    await act(async () => {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    });

    expect(dispatch).toHaveBeenCalledWith({
      type: "appendAgentDelta",
      workspaceId: "ws-1",
      threadId: "thread-1",
      itemId: "assistant-1",
      delta: "Hello World",
      hasCustomName: true,
      turnId: "turn-1",
    });
  });

  it("falls back to setTimeout when requestAnimationFrame is unavailable", () => {
    vi.useFakeTimers();
    const originalRaf = window.requestAnimationFrame;
    const originalCancelRaf = window.cancelAnimationFrame;
    // Force the fallback path in schedulePendingAgentDeltaFlush.
    Object.assign(window, {
      requestAnimationFrame: undefined,
      cancelAnimationFrame: undefined,
    });

    const { result, dispatch } = makeOptions();

    act(() => {
      result.current.onAgentMessageDelta({
        workspaceId: "ws-1",
        threadId: "thread-1",
        itemId: "assistant-timeout",
        delta: "timeout flush",
      });
      vi.advanceTimersByTime(17);
    });

    expect(dispatch).toHaveBeenCalledWith({
      type: "appendAgentDelta",
      workspaceId: "ws-1",
      threadId: "thread-1",
      itemId: "assistant-timeout",
      delta: "timeout flush",
      hasCustomName: false,
      turnId: null,
    });

    Object.assign(window, {
      requestAnimationFrame: originalRaf,
      cancelAnimationFrame: originalCancelRaf,
    });
  });

  it("flushes pending deltas on unmount via cleanup unsubscribe", () => {
    const cancelAnimationFrameSpy = vi.spyOn(window, "cancelAnimationFrame");
    const { result, dispatch, unmount } = makeOptions();

    act(() => {
      result.current.onAgentMessageDelta({
        workspaceId: "ws-1",
        threadId: "thread-1",
        itemId: "assistant-cleanup",
        delta: "cleanup",
      });
    });

    unmount();

    expect(cancelAnimationFrameSpy).toHaveBeenCalled();
    expect(dispatch).toHaveBeenCalledWith({
      type: "appendAgentDelta",
      workspaceId: "ws-1",
      threadId: "thread-1",
      itemId: "assistant-cleanup",
      delta: "cleanup",
      hasCustomName: false,
      turnId: null,
    });
  });

  it("handles invalid item payload conversion without upserting", () => {
    vi.mocked(buildConversationItem).mockReturnValue(null);
    const { result, dispatch, safeMessageActivity } = makeOptions();

    act(() => {
      result.current.onItemCompleted("ws-1", "thread-1", { type: "agentMessage" });
    });

    expect(dispatch).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: "upsertItem" }),
    );
    expect(safeMessageActivity).toHaveBeenCalled();
  });
});
