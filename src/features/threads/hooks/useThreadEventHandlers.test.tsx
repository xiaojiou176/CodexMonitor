// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppServerEvent } from "../../../types";
import { useThreadEventHandlers } from "./useThreadEventHandlers";

const mocks = vi.hoisted(() => ({
  onApprovalRequest: vi.fn(),
  onRequestUserInput: vi.fn(),
  itemHandlers: {
    onAgentMessageDelta: vi.fn(),
    onAgentMessageCompleted: vi.fn(),
    onItemStarted: vi.fn(),
    onItemCompleted: vi.fn(),
    onReasoningSummaryDelta: vi.fn(),
    onReasoningSummaryBoundary: vi.fn(),
    onReasoningTextDelta: vi.fn(),
    onPlanDelta: vi.fn(),
    onCommandOutputDelta: vi.fn(),
    onTerminalInteraction: vi.fn(),
    onFileChangeOutputDelta: vi.fn(),
    onMcpToolCallProgress: vi.fn(),
  },
  turnHandlers: {
    onThreadStarted: vi.fn(),
    onThreadNameUpdated: vi.fn(),
    onTurnStarted: vi.fn(),
    onTurnCompleted: vi.fn(),
    onTurnPlanUpdated: vi.fn(),
    onTurnDiffUpdated: vi.fn(),
    onThreadTokenUsageUpdated: vi.fn(),
    onAccountRateLimitsUpdated: vi.fn(),
    onTurnError: vi.fn(),
  },
}));

vi.mock("./useThreadApprovalEvents", () => ({
  useThreadApprovalEvents: vi.fn(() => mocks.onApprovalRequest),
}));

vi.mock("./useThreadUserInputEvents", () => ({
  useThreadUserInputEvents: vi.fn(() => mocks.onRequestUserInput),
}));

vi.mock("./useThreadItemEvents", () => ({
  useThreadItemEvents: vi.fn(() => mocks.itemHandlers),
}));

vi.mock("./useThreadTurnEvents", () => ({
  useThreadTurnEvents: vi.fn(() => mocks.turnHandlers),
}));

type HookOptions = Parameters<typeof useThreadEventHandlers>[0];

function createEvent(
  method: string,
  stderrMessage?: unknown,
  paramsOverride?: unknown,
): AppServerEvent {
  const params =
    paramsOverride !== undefined
      ? paramsOverride
      : stderrMessage === undefined
        ? {}
        : { message: stderrMessage };
  return {
    workspace_id: "ws-1",
    message: {
      method,
      params,
    },
  };
}

function renderEventHandlers(overrides: Partial<HookOptions> = {}) {
  const dispatch = vi.fn();
  const onDebug = vi.fn();
  const onWorkspaceConnected = vi.fn();
  const applyCollabThreadLinks = vi.fn();
  const updateThreadParent = vi.fn();
  const base: HookOptions = {
    activeThreadId: null,
    dispatch,
    planByThreadRef: { current: {} },
    getCustomName: vi.fn(() => undefined),
    isThreadHidden: vi.fn(() => false),
    markProcessing: vi.fn(),
    markReviewing: vi.fn(),
    setThreadPhase: vi.fn(),
    setThreadTurnStatus: vi.fn(),
    setThreadMessagePhase: vi.fn(),
    setThreadWaitReason: vi.fn(),
    setThreadRetryState: vi.fn(),
    setActiveItemStatus: vi.fn(),
    clearActiveItemStatus: vi.fn(),
    setMcpProgressMessage: vi.fn(),
    getThreadTurnStatus: vi.fn(() => null),
    touchThreadActivity: vi.fn(),
    markThreadError: vi.fn(),
    setActiveTurnId: vi.fn(),
    safeMessageActivity: vi.fn(),
    recordThreadActivity: vi.fn(),
    onUserMessageCreated: vi.fn(),
    pushThreadErrorMessage: vi.fn(),
    onDebug,
    onWorkspaceConnected,
    applyCollabThreadLinks,
    updateThreadParent,
    markSubAgentThread: vi.fn(),
    recordThreadCreatedAt: vi.fn(),
    onReviewExited: vi.fn(),
    approvalAllowlistRef: { current: {} },
    pendingInterruptsRef: { current: new Set<string>() },
    resolveCurrentModel: vi.fn(() => "gpt-5"),
    ...overrides,
  };
  const hook = renderHook(() => useThreadEventHandlers(base));
  return { ...hook, dispatch, onDebug };
}

describe("useThreadEventHandlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("hides background threads only when action is hide", () => {
    const { result, dispatch } = renderEventHandlers();

    act(() => {
      result.current.onBackgroundThreadAction("ws-1", "thread-1", "pin");
    });
    expect(dispatch).not.toHaveBeenCalled();

    act(() => {
      result.current.onBackgroundThreadAction("ws-1", "thread-1", "hide");
    });
    expect(dispatch).toHaveBeenCalledWith({
      type: "hideThread",
      workspaceId: "ws-1",
      threadId: "thread-1",
    });
  });

  it("forwards non-stderr app server events to debug output", () => {
    const { result, onDebug } = renderEventHandlers();
    const event = createEvent("thread/started");

    act(() => {
      result.current.onAppServerEvent(event);
    });

    expect(onDebug).toHaveBeenCalledTimes(1);
    expect(onDebug).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "event",
        label: "thread/started",
        payload: event,
      }),
    );
  });

  it("keeps malformed stderr payloads as direct debug events", () => {
    const { result, onDebug } = renderEventHandlers();
    const event = createEvent("codex/stderr", { not: "a string" });

    act(() => {
      result.current.onAppServerEvent(event);
    });

    expect(onDebug).toHaveBeenCalledTimes(1);
    expect(onDebug).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "stderr",
        label: "codex/stderr",
        payload: event,
      }),
    );
  });

  it("batches stderr events and emits signature summaries", () => {
    const { result, onDebug } = renderEventHandlers();
    const a = createEvent(
      "codex/stderr",
      "\u001b[31mrmcp::transport::worker connection refused\u001b[0m",
    );
    const b = createEvent(
      "codex/stderr",
      "rmcp::transport::worker untagged enum JsonRpcMessage",
    );
    const c = createEvent(
      "codex/stderr",
      "state db missing rollout path for workspace",
    );
    const d = createEvent(
      "codex/stderr",
      "rmcp::transport::worker connection refused",
    );

    act(() => {
      result.current.onAppServerEvent(a);
      result.current.onAppServerEvent(b);
      result.current.onAppServerEvent(c);
      result.current.onAppServerEvent(d);
    });
    expect(onDebug).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(360);
    });

    expect(onDebug).toHaveBeenCalledTimes(1);
    expect(onDebug).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "stderr",
        label: "codex/stderr (batched x4)",
        payload: expect.objectContaining({
          workspaceId: "ws-1",
          count: 4,
          samples: [
            "rmcp::transport::worker connection refused",
            "rmcp::transport::worker untagged enum JsonRpcMessage",
            "state db missing rollout path for workspace",
          ],
          topSignatures: expect.arrayContaining([
            { signature: "rmcp.connection_refused", count: 2 },
            { signature: "rmcp.decode_invalid_jsonrpc", count: 1 },
            { signature: "state_db.missing_rollout_path", count: 1 },
          ]),
        }),
      }),
    );
  });

  it("flushes pending stderr debug entries on unmount", () => {
    const { result, onDebug, unmount } = renderEventHandlers();
    const event = createEvent("codex/stderr", "rmcp::transport::worker connection refused");

    act(() => {
      result.current.onAppServerEvent(event);
    });
    expect(onDebug).not.toHaveBeenCalled();

    unmount();
    expect(onDebug).toHaveBeenCalledTimes(1);
    expect(onDebug).toHaveBeenCalledWith(
      expect.objectContaining({
        label: "codex/stderr (batched x1)",
      }),
    );
  });

  it("treats ansi-only stderr payloads as malformed and emits direct debug", () => {
    const { result, onDebug } = renderEventHandlers();

    act(() => {
      result.current.onAppServerEvent(createEvent("codex/stderr", "\u001b[31m   \u001b[0m"));
    });

    expect(onDebug).toHaveBeenCalledTimes(1);
    expect(onDebug).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "stderr",
        label: "codex/stderr",
      }),
    );
  });

  it("keeps malformed stderr payloads when params is not an object", () => {
    const { result, onDebug } = renderEventHandlers();

    act(() => {
      result.current.onAppServerEvent(
        createEvent("codex/stderr", undefined, "bad-params"),
      );
    });

    expect(onDebug).toHaveBeenCalledTimes(1);
    expect(onDebug).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "stderr",
        label: "codex/stderr",
      }),
    );
  });

  it("batches per workspace and classifies transport_other signatures", () => {
    const { result, onDebug } = renderEventHandlers();
    const ws2Event: AppServerEvent = {
      workspace_id: "ws-2",
      message: {
        method: "codex/stderr",
        params: { message: "rmcp::transport::worker something unexpected happened" },
      },
    };

    act(() => {
      result.current.onAppServerEvent(createEvent("codex/stderr", "first ws-1"));
      result.current.onAppServerEvent(ws2Event);
      vi.advanceTimersByTime(360);
    });

    expect(onDebug).toHaveBeenCalledTimes(2);
    const payloads = onDebug.mock.calls.map((call) => call[0]?.payload);
    expect(payloads).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ workspaceId: "ws-1", count: 1 }),
        expect.objectContaining({
          workspaceId: "ws-2",
          topSignatures: [{ signature: "rmcp.transport_other", count: 1 }],
        }),
      ]),
    );
  });

  it("truncates generic signature to 120 chars in stderr summary", () => {
    const { result, onDebug } = renderEventHandlers();
    const longMessage = `generic signature ${"x".repeat(200)}`;

    act(() => {
      result.current.onAppServerEvent(createEvent("codex/stderr", longMessage));
      vi.advanceTimersByTime(360);
    });

    const payload = onDebug.mock.calls[0]?.[0]?.payload as {
      topSignatures?: Array<{ signature: string; count: number }>;
    };
    const signature = payload?.topSignatures?.[0]?.signature;
    expect(signature).toBe(longMessage.slice(0, 120));
  });

  it("drops batched stderr quietly when debug callback is unavailable", () => {
    const { result, onDebug, unmount } = renderEventHandlers({ onDebug: undefined });

    act(() => {
      result.current.onAppServerEvent(createEvent("codex/stderr", "rmcp::transport::worker ignored"));
      vi.advanceTimersByTime(360);
    });

    expect(onDebug).not.toHaveBeenCalled();
    unmount();
    expect(onDebug).not.toHaveBeenCalled();
  });
});
