import { describe, expect, it, vi } from "vitest";
import type { ApprovalRequest, ConversationItem, ThreadSummary } from "../../../types";
import { initialState, threadReducer } from "./useThreadsReducer";
import type { ThreadState } from "./useThreadsReducer";

describe("threadReducer", () => {
  it("ensures thread with default name and active selection", () => {
    const next = threadReducer(initialState, {
      type: "ensureThread",
      workspaceId: "ws-1",
      threadId: "thread-1",
    });
    const threads = next.threadsByWorkspace["ws-1"] ?? [];
    expect(threads).toHaveLength(1);
    expect(threads[0].name).toBe("New Agent");
    expect(next.activeThreadIdByWorkspace["ws-1"]).toBe("thread-1");
    expect(next.threadStatusById["thread-1"]?.isProcessing).toBe(false);
  });

  it("renames auto-generated thread on first user message", () => {
    const threads: ThreadSummary[] = [
      { id: "thread-1", name: "New Agent", updatedAt: 1 },
    ];
    const next = threadReducer(
      {
        ...initialState,
        threadsByWorkspace: { "ws-1": threads },
      },
      {
        type: "upsertItem",
        workspaceId: "ws-1",
        threadId: "thread-1",
        item: {
          id: "user-1",
          kind: "message",
          role: "user",
          text: "Hello there",
        },
        hasCustomName: false,
      },
    );
    expect(next.threadsByWorkspace["ws-1"]?.[0]?.name).toBe("Hello there");
    const items = next.itemsByThread["thread-1"] ?? [];
    expect(items).toHaveLength(1);
    if (items[0]?.kind === "message") {
      expect(items[0].id).toBe("user-1");
      expect(items[0].text).toBe("Hello there");
    }
  });

  it("does not rename auto-generated thread when user message text is empty", () => {
    const threads: ThreadSummary[] = [
      { id: "thread-empty", name: "New Agent", updatedAt: 1 },
    ];
    const next = threadReducer(
      {
        ...initialState,
        threadsByWorkspace: { "ws-1": threads },
      },
      {
        type: "upsertItem",
        workspaceId: "ws-1",
        threadId: "thread-empty",
        item: {
          id: "user-empty",
          kind: "message",
          role: "user",
          text: "",
        },
        hasCustomName: false,
      },
    );

    expect(next.threadsByWorkspace["ws-1"]?.[0]?.name).toBe("New Agent");
  });

  it("renames auto-generated thread from assistant output when no user message", () => {
    const threads: ThreadSummary[] = [
      { id: "thread-1", name: "New Agent", updatedAt: 1 },
    ];
    const next = threadReducer(
      {
        ...initialState,
        threadsByWorkspace: { "ws-1": threads },
        itemsByThread: { "thread-1": [] },
      },
      {
        type: "appendAgentDelta",
        workspaceId: "ws-1",
        threadId: "thread-1",
        itemId: "assistant-1",
        delta: "Assistant note",
        hasCustomName: false,
      },
    );
    expect(next.threadsByWorkspace["ws-1"]?.[0]?.name).toBe("Assistant note");
  });

  it("merges overlapping assistant deltas without duplicating text", () => {
    const first = threadReducer(initialState, {
      type: "appendAgentDelta",
      workspaceId: "ws-1",
      threadId: "thread-1",
      itemId: "assistant-merge",
      delta: "Hello",
      hasCustomName: false,
    });

    const merged = threadReducer(first, {
      type: "appendAgentDelta",
      workspaceId: "ws-1",
      threadId: "thread-1",
      itemId: "assistant-merge",
      delta: "lo world",
      hasCustomName: false,
    });

    const item = merged.itemsByThread["thread-1"]?.[0];
    expect(item?.kind).toBe("message");
    if (item?.kind === "message") {
      expect(item.text).toBe("Hello world");
    }
  });

  it("replaces assistant text when completeAgentMessage receives a longer payload", () => {
    const withDelta = threadReducer(initialState, {
      type: "appendAgentDelta",
      workspaceId: "ws-1",
      threadId: "thread-1",
      itemId: "assistant-complete",
      delta: "partial",
      hasCustomName: false,
    });

    const completed = threadReducer(withDelta, {
      type: "completeAgentMessage",
      workspaceId: "ws-1",
      threadId: "thread-1",
      itemId: "assistant-complete",
      text: "partial + final",
      hasCustomName: false,
    });

    const item = completed.itemsByThread["thread-1"]?.[0];
    expect(item?.kind).toBe("message");
    if (item?.kind === "message") {
      expect(item.text).toBe("partial + final");
    }
  });

  it("attaches turn-level model metadata to assistant messages", () => {
    const withTurnMeta = threadReducer(initialState, {
      type: "setThreadTurnMeta",
      threadId: "thread-1",
      turnId: "turn-1",
      model: "gpt-5.3-codex",
    });

    const next = threadReducer(withTurnMeta, {
      type: "appendAgentDelta",
      workspaceId: "ws-1",
      threadId: "thread-1",
      itemId: "assistant-1",
      delta: "Answer",
      hasCustomName: false,
      turnId: "turn-1",
    });

    const item = next.itemsByThread["thread-1"]?.[0];
    expect(item?.kind).toBe("message");
    if (item?.kind === "message") {
      expect(item.role).toBe("assistant");
      expect(item.model).toBe("gpt-5.3-codex");
      expect(item.turnId).toBe("turn-1");
    }
  });

  it("backfills context window onto assistant messages by turn id", () => {
    const withTurnMeta = threadReducer(initialState, {
      type: "setThreadTurnMeta",
      threadId: "thread-1",
      turnId: "turn-1",
      model: "gpt-5.3-codex",
    });
    const withMessage = threadReducer(withTurnMeta, {
      type: "completeAgentMessage",
      workspaceId: "ws-1",
      threadId: "thread-1",
      itemId: "assistant-1",
      text: "Final output",
      hasCustomName: false,
      turnId: "turn-1",
    });

    const next = threadReducer(withMessage, {
      type: "setThreadTurnContextWindow",
      threadId: "thread-1",
      turnId: "turn-1",
      contextWindow: 192000,
    });

    const item = next.itemsByThread["thread-1"]?.[0];
    expect(item?.kind).toBe("message");
    if (item?.kind === "message") {
      expect(item.contextWindow).toBe(192000);
      expect(item.turnId).toBe("turn-1");
    }
  });

  it("updates thread timestamp when newer activity arrives", () => {
    const threads: ThreadSummary[] = [
      { id: "thread-1", name: "Agent 1", updatedAt: 1000 },
    ];
    const next = threadReducer(
      {
        ...initialState,
        threadsByWorkspace: { "ws-1": threads },
      },
      {
        type: "setThreadTimestamp",
        workspaceId: "ws-1",
        threadId: "thread-1",
        timestamp: 1500,
      },
    );
    expect(next.threadsByWorkspace["ws-1"]?.[0]?.updatedAt).toBe(1500);
  });

  it("moves active thread to top on timestamp updates when sorted by updated_at", () => {
    const threads: ThreadSummary[] = [
      { id: "thread-1", name: "Agent 1", updatedAt: 1000 },
      { id: "thread-2", name: "Agent 2", updatedAt: 900 },
    ];
    const next = threadReducer(
      {
        ...initialState,
        threadsByWorkspace: { "ws-1": threads },
        threadSortKeyByWorkspace: { "ws-1": "updated_at" },
      },
      {
        type: "setThreadTimestamp",
        workspaceId: "ws-1",
        threadId: "thread-2",
        timestamp: 1500,
      },
    );
    expect(next.threadsByWorkspace["ws-1"]?.map((thread) => thread.id)).toEqual([
      "thread-2",
      "thread-1",
    ]);
  });

  it("keeps ordering stable on timestamp updates when sorted by created_at", () => {
    const threads: ThreadSummary[] = [
      { id: "thread-1", name: "Agent 1", updatedAt: 1000 },
      { id: "thread-2", name: "Agent 2", updatedAt: 900 },
    ];
    const next = threadReducer(
      {
        ...initialState,
        threadsByWorkspace: { "ws-1": threads },
        threadSortKeyByWorkspace: { "ws-1": "created_at" },
      },
      {
        type: "setThreadTimestamp",
        workspaceId: "ws-1",
        threadId: "thread-2",
        timestamp: 1500,
      },
    );
    expect(next.threadsByWorkspace["ws-1"]?.map((thread) => thread.id)).toEqual([
      "thread-1",
      "thread-2",
    ]);
  });

  it("tracks processing durations", () => {
    const started = threadReducer(
      {
        ...initialState,
        threadStatusById: {
          "thread-1": {
            isProcessing: false,
            hasUnread: false,
            isReviewing: false,
            phase: "completed",
            processingStartedAt: null,
            lastDurationMs: null,
          },
        },
      },
      {
        type: "markProcessing",
        threadId: "thread-1",
        isProcessing: true,
        timestamp: 1000,
      },
    );
    const stopped = threadReducer(started, {
      type: "markProcessing",
      threadId: "thread-1",
      isProcessing: false,
      timestamp: 1600,
    });
    expect(stopped.threadStatusById["thread-1"]?.lastDurationMs).toBe(600);
  });

  it("does not churn state for repeated processing=true updates", () => {
    const processingState = threadReducer(
      {
        ...initialState,
        threadStatusById: {
          "thread-1": {
            isProcessing: true,
            hasUnread: false,
            isReviewing: false,
            phase: "starting",
            processingStartedAt: 1000,
            lastDurationMs: null,
          },
        },
      },
      {
        type: "markProcessing",
        threadId: "thread-1",
        isProcessing: true,
        timestamp: 1200,
      },
    );

    expect(processingState).toBe(
      threadReducer(processingState, {
        type: "markProcessing",
        threadId: "thread-1",
        isProcessing: true,
        timestamp: 1400,
      }),
    );
  });

  it("does not churn state for unchanged unread/review flags", () => {
    const base: ThreadState = {
      ...initialState,
      threadStatusById: {
        "thread-1": {
          isProcessing: false,
          hasUnread: true,
          isReviewing: true,
          phase: "tool_running",
          processingStartedAt: null,
          lastDurationMs: 300,
          lastActivityAt: null,
          lastErrorAt: null,
          lastErrorMessage: null,
          turnStatus: null,
          activeItemStatuses: {},
          messagePhase: "unknown",
          waitReason: "none",
          retryState: "none",
          lastMcpProgressMessage: null,
        },
      },
    };

    const unread = threadReducer(base, {
      type: "markUnread",
      threadId: "thread-1",
      hasUnread: true,
    });
    expect(unread).toBe(base);

    const reviewing = threadReducer(base, {
      type: "markReviewing",
      threadId: "thread-1",
      isReviewing: true,
    });
    expect(reviewing).toBe(base);
  });

  it("tracks request user input queue", () => {
    const request = {
      workspace_id: "ws-1",
      request_id: 99,
      params: {
        thread_id: "thread-1",
        turn_id: "turn-1",
        item_id: "call-1",
        questions: [{ id: "q1", header: "Confirm", question: "Proceed?" }],
      },
    };
    const added = threadReducer(initialState, {
      type: "addUserInputRequest",
      request,
    });
    expect(added.userInputRequests).toHaveLength(1);
    expect(added.userInputRequests[0]).toEqual(request);

    const removed = threadReducer(added, {
      type: "removeUserInputRequest",
      requestId: 99,
      workspaceId: "ws-1",
    });
    expect(removed.userInputRequests).toHaveLength(0);
  });

  it("drops local review-start items when server review starts", () => {
    const localReview: ConversationItem = {
      id: "review-start-1",
      kind: "review",
      state: "started",
      text: "",
    };
    const incomingReview: ConversationItem = {
      id: "remote-review-1",
      kind: "review",
      state: "started",
      text: "",
    };
    const next = threadReducer(
      {
        ...initialState,
        itemsByThread: { "thread-1": [localReview] },
      },
      {
        type: "upsertItem",
        workspaceId: "ws-1",
        threadId: "thread-1",
        item: incomingReview,
      },
    );
    const items = next.itemsByThread["thread-1"] ?? [];
    expect(items).toHaveLength(1);
    expect(items[0]?.id).toBe("remote-review-1");
  });

  it("appends review items when ids repeat", () => {
    const firstReview: ConversationItem = {
      id: "review-mode",
      kind: "review",
      state: "started",
      text: "Reviewing changes",
    };
    const next = threadReducer(
      {
        ...initialState,
        itemsByThread: { "thread-1": [firstReview] },
      },
      {
        type: "upsertItem",
        workspaceId: "ws-1",
        threadId: "thread-1",
        item: {
          id: "review-mode",
          kind: "review",
          state: "completed",
          text: "Reviewing changes",
        },
      },
    );
    const items = next.itemsByThread["thread-1"] ?? [];
    expect(items).toHaveLength(2);
    expect(items[0]?.id).toBe("review-mode");
    expect(items[1]?.id).toBe("review-mode-1");
  });

  it("ignores duplicate review items with identical id, state, and text", () => {
    const firstReview: ConversationItem = {
      id: "review-mode",
      kind: "review",
      state: "started",
      text: "Reviewing changes",
    };
    const next = threadReducer(
      {
        ...initialState,
        itemsByThread: { "thread-1": [firstReview] },
      },
      {
        type: "upsertItem",
        workspaceId: "ws-1",
        threadId: "thread-1",
        item: {
          id: "review-mode",
          kind: "review",
          state: "started",
          text: "Reviewing changes",
        },
      },
    );
    const items = next.itemsByThread["thread-1"] ?? [];
    expect(items).toHaveLength(1);
    expect(items[0]?.id).toBe("review-mode");
  });

  it("dedupes review items with identical content", () => {
    const firstReview: ConversationItem = {
      id: "review-mode",
      kind: "review",
      state: "completed",
      text: "Reviewing changes",
    };
    const next = threadReducer(
      {
        ...initialState,
        itemsByThread: { "thread-1": [firstReview] },
      },
      {
        type: "upsertItem",
        workspaceId: "ws-1",
        threadId: "thread-1",
        item: {
          id: "review-mode-duplicate",
          kind: "review",
          state: "completed",
          text: "Reviewing changes",
        },
      },
    );
    const items = next.itemsByThread["thread-1"] ?? [];
    expect(items).toHaveLength(1);
    expect(items[0]?.id).toBe("review-mode");
  });

  it("creates and appends plan deltas when no plan tool item exists", () => {
    const next = threadReducer(initialState, {
      type: "appendPlanDelta",
      threadId: "thread-1",
      itemId: "plan-1",
      delta: "- Step 1",
    });
    const items = next.itemsByThread["thread-1"] ?? [];
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: "plan-1",
      kind: "tool",
      toolType: "plan",
      title: "方案",
      output: "- Step 1",
    });
  });

  it("appends reasoning summary and content when missing", () => {
    const withSummary = threadReducer(initialState, {
      type: "appendReasoningSummary",
      threadId: "thread-1",
      itemId: "reasoning-1",
      delta: "Short plan",
    });
    const summaryItem = withSummary.itemsByThread["thread-1"]?.[0];
    expect(summaryItem?.kind).toBe("reasoning");
    if (summaryItem?.kind === "reasoning") {
      expect(summaryItem.summary).toBe("Short plan");
      expect(summaryItem.content).toBe("");
    }

    const withContent = threadReducer(withSummary, {
      type: "appendReasoningContent",
      threadId: "thread-1",
      itemId: "reasoning-1",
      delta: "More detail",
    });
    const contentItem = withContent.itemsByThread["thread-1"]?.[0];
    expect(contentItem?.kind).toBe("reasoning");
    if (contentItem?.kind === "reasoning") {
      expect(contentItem.summary).toBe("Short plan");
      expect(contentItem.content).toBe("More detail");
    }
  });

  it("inserts a reasoning summary boundary between sections", () => {
    const withSummary = threadReducer(initialState, {
      type: "appendReasoningSummary",
      threadId: "thread-1",
      itemId: "reasoning-1",
      delta: "Exploring files",
    });
    const withBoundary = threadReducer(withSummary, {
      type: "appendReasoningSummaryBoundary",
      threadId: "thread-1",
      itemId: "reasoning-1",
    });
    const withSecondSummary = threadReducer(withBoundary, {
      type: "appendReasoningSummary",
      threadId: "thread-1",
      itemId: "reasoning-1",
      delta: "Searching for routes",
    });

    const item = withSecondSummary.itemsByThread["thread-1"]?.[0];
    expect(item?.kind).toBe("reasoning");
    if (item?.kind === "reasoning") {
      expect(item.summary).toBe("Exploring files\n\nSearching for routes");
    }
  });

  it("ignores tool output deltas when the item is not a tool", () => {
    const message: ConversationItem = {
      id: "tool-1",
      kind: "message",
      role: "assistant",
      text: "Hi",
    };
    const base: ThreadState = {
      ...initialState,
      itemsByThread: { "thread-1": [message] },
    };
    const next = threadReducer(base, {
      type: "appendToolOutput",
      threadId: "thread-1",
      itemId: "tool-1",
      delta: "delta",
    });
    expect(next).toBe(base);
  });

  it("adds and removes user input requests by workspace and id", () => {
    const requestA = {
      workspace_id: "ws-1",
      request_id: 1,
      params: {
        thread_id: "thread-1",
        turn_id: "turn-1",
        item_id: "item-1",
        questions: [],
      },
    };
    const requestB = {
      workspace_id: "ws-2",
      request_id: 1,
      params: {
        thread_id: "thread-2",
        turn_id: "turn-2",
        item_id: "item-2",
        questions: [],
      },
    };

    const added = threadReducer(initialState, {
      type: "addUserInputRequest",
      request: requestA,
    });
    expect(added.userInputRequests).toEqual([requestA]);

    const deduped = threadReducer(added, {
      type: "addUserInputRequest",
      request: requestA,
    });
    expect(deduped.userInputRequests).toHaveLength(1);

    const withSecond = threadReducer(added, {
      type: "addUserInputRequest",
      request: requestB,
    });
    expect(withSecond.userInputRequests).toHaveLength(2);

    const removed = threadReducer(withSecond, {
      type: "removeUserInputRequest",
      requestId: 1,
      workspaceId: "ws-1",
    });
    expect(removed.userInputRequests).toEqual([requestB]);
  });

  it("stores turn diff updates by thread id", () => {
    const next = threadReducer(initialState, {
      type: "setThreadTurnDiff",
      threadId: "thread-1",
      diff: "diff --git a/file.ts b/file.ts",
    });

    expect(next.turnDiffByThread["thread-1"]).toBe(
      "diff --git a/file.ts b/file.ts",
    );
  });

  it("clears turn diff state when a thread is removed", () => {
    const base: ThreadState = {
      ...initialState,
      threadsByWorkspace: {
        "ws-1": [{ id: "thread-1", name: "Agent 1", updatedAt: 1 }],
      },
      activeThreadIdByWorkspace: { "ws-1": "thread-1" },
      turnDiffByThread: { "thread-1": "diff --git a/file.ts b/file.ts" },
    };

    const next = threadReducer(base, {
      type: "removeThread",
      workspaceId: "ws-1",
      threadId: "thread-1",
    });

    expect(next.turnDiffByThread["thread-1"]).toBeUndefined();
  });

  it("moves active thread to the next available thread after removal", () => {
    const base: ThreadState = {
      ...initialState,
      threadsByWorkspace: {
        "ws-1": [
          { id: "thread-1", name: "Agent 1", updatedAt: 3 },
          { id: "thread-2", name: "Agent 2", updatedAt: 2 },
        ],
      },
      activeThreadIdByWorkspace: { "ws-1": "thread-1" },
    };

    const next = threadReducer(base, {
      type: "removeThread",
      workspaceId: "ws-1",
      threadId: "thread-1",
    });

    expect(next.threadsByWorkspace["ws-1"]?.map((thread) => thread.id)).toEqual([
      "thread-2",
    ]);
    expect(next.activeThreadIdByWorkspace["ws-1"]).toBe("thread-2");
  });

  it("removes reverse parent mappings that point to a removed thread", () => {
    const base: ThreadState = {
      ...initialState,
      threadsByWorkspace: {
        "ws-1": [
          { id: "thread-parent", name: "Parent", updatedAt: 3 },
          { id: "thread-child", name: "Child", updatedAt: 2 },
          { id: "thread-sibling", name: "Sibling", updatedAt: 1 },
        ],
      },
      activeThreadIdByWorkspace: { "ws-1": "thread-parent" },
      threadParentById: {
        "thread-child": "thread-parent",
        "thread-sibling": "thread-other",
      },
    };

    const next = threadReducer(base, {
      type: "removeThread",
      workspaceId: "ws-1",
      threadId: "thread-parent",
    });

    expect(next.threadParentById["thread-child"]).toBeUndefined();
    expect(next.threadParentById["thread-sibling"]).toBe("thread-other");
  });

  it("removes turn/runtime metadata and orphaned parent ranks when a thread is removed", () => {
    const base: ThreadState = {
      ...initialState,
      threadsByWorkspace: {
        "ws-1": [
          { id: "thread-parent", name: "Parent", updatedAt: 3 },
          { id: "thread-child", name: "Child", updatedAt: 2 },
        ],
      },
      threadParentById: {
        "thread-child": "thread-parent",
      },
      threadParentRankById: {
        "thread-child": 123,
      },
      turnMetaByThread: {
        "thread-parent": {
          threadId: "thread-parent",
          turnId: "turn-parent",
          model: "gpt-5",
          contextWindow: 1000,
        },
      },
      turnMetaByTurnId: {
        "turn-parent": {
          threadId: "thread-parent",
          turnId: "turn-parent",
          model: "gpt-5",
          contextWindow: 1000,
        },
        "turn-child": {
          threadId: "thread-child",
          turnId: "turn-child",
          model: "gpt-5",
          contextWindow: 1000,
        },
      },
    };

    const next = threadReducer(base, {
      type: "removeThread",
      workspaceId: "ws-1",
      threadId: "thread-parent",
    });

    expect(next.turnMetaByThread["thread-parent"]).toBeUndefined();
    expect(next.turnMetaByTurnId["turn-parent"]).toBeUndefined();
    expect(next.turnMetaByTurnId["turn-child"]?.threadId).toBe("thread-child");
    expect(next.threadParentById["thread-child"]).toBeUndefined();
    expect(next.threadParentRankById["thread-child"]).toBeUndefined();
  });

  it("allows newer parent ordering updates to override older links", () => {
    const base: ThreadState = {
      ...initialState,
      threadParentById: { "thread-child": "thread-parent-old" },
      threadParentRankById: { "thread-child": 100 },
    };

    const next = threadReducer(base, {
      type: "setThreadParent",
      threadId: "thread-child",
      parentId: "thread-parent-new",
      ordering: { timestamp: 200 },
    });

    expect(next.threadParentById["thread-child"]).toBe("thread-parent-new");
    expect(next.threadParentRankById["thread-child"]).toBe(200);
  });

  it("blocks stale parent ordering updates from overwriting newer links", () => {
    const base: ThreadState = {
      ...initialState,
      threadParentById: { "thread-child": "thread-parent-new" },
      threadParentRankById: { "thread-child": 200 },
    };

    const next = threadReducer(base, {
      type: "setThreadParent",
      threadId: "thread-child",
      parentId: "thread-parent-old",
      ordering: { timestamp: 100 },
    });

    expect(next.threadParentById["thread-child"]).toBe("thread-parent-new");
    expect(next.threadParentRankById["thread-child"]).toBe(200);
  });

  it("keeps setThreadParent calls without ordering backward compatible", () => {
    const base: ThreadState = {
      ...initialState,
      threadParentById: { "thread-child": "thread-parent-a" },
      threadParentRankById: { "thread-child": 200 },
    };

    const next = threadReducer(base, {
      type: "setThreadParent",
      threadId: "thread-child",
      parentId: "thread-parent-b",
    });

    expect(next.threadParentById["thread-child"]).toBe("thread-parent-b");
    expect(next.threadParentRankById["thread-child"]).toBeUndefined();
  });

  it("applies bulk last-agent updates with timestamp guard", () => {
    const base: ThreadState = {
      ...initialState,
      lastAgentMessageByThread: {
        "thread-1": {
          text: "old",
          timestamp: 200,
        },
      },
    };

    const next = threadReducer(base, {
      type: "setLastAgentMessagesBulk",
      updates: [
        {
          threadId: "thread-1",
          text: "stale",
          timestamp: 150,
        },
        {
          threadId: "thread-2",
          text: "fresh",
          timestamp: 300,
        },
      ],
    });

    expect(next.lastAgentMessageByThread["thread-1"]).toEqual({
      text: "old",
      timestamp: 200,
    });
    expect(next.lastAgentMessageByThread["thread-2"]).toEqual({
      text: "fresh",
      timestamp: 300,
    });
  });

  it("hides background threads and keeps them hidden on future syncs", () => {
    const withThread = threadReducer(initialState, {
      type: "ensureThread",
      workspaceId: "ws-1",
      threadId: "thread-bg",
    });
    expect(withThread.threadsByWorkspace["ws-1"]?.some((t) => t.id === "thread-bg")).toBeTruthy();

    const hidden = threadReducer(withThread, {
      type: "hideThread",
      workspaceId: "ws-1",
      threadId: "thread-bg",
    });
    expect(hidden.threadsByWorkspace["ws-1"]?.some((t) => t.id === "thread-bg")).toBe(false);

    const synced = threadReducer(hidden, {
      type: "setThreads",
      workspaceId: "ws-1",
      sortKey: "updated_at",
      threads: [
        { id: "thread-bg", name: "Agent 1", updatedAt: Date.now() },
        { id: "thread-visible", name: "Agent 2", updatedAt: Date.now() },
      ],
    });
    const ids = synced.threadsByWorkspace["ws-1"]?.map((t) => t.id) ?? [];
    expect(ids).toContain("thread-visible");
    expect(ids).not.toContain("thread-bg");
  });

  it("anchors active thread into visible list when sync omits it", () => {
    const base: ThreadState = {
      ...initialState,
      activeThreadIdByWorkspace: { "ws-1": "thread-gone" },
      threadsByWorkspace: {
        "ws-1": [
          { id: "thread-gone", name: "Old", updatedAt: 200 },
          { id: "thread-keep", name: "Keep", updatedAt: 100 },
        ],
      },
    };

    const next = threadReducer(base, {
      type: "setThreads",
      workspaceId: "ws-1",
      sortKey: "updated_at",
      threads: [
        { id: "thread-new-1", name: "New 1", updatedAt: 300 },
        { id: "thread-new-2", name: "New 2", updatedAt: 250 },
      ],
    });

    expect(next.activeThreadIdByWorkspace["ws-1"]).toBe("thread-gone");
    expect(next.threadsByWorkspace["ws-1"]?.map((thread) => thread.id)).toEqual([
      "thread-gone",
      "thread-new-1",
      "thread-new-2",
    ]);
  });

  it("anchors a default active thread placeholder when current list has no active record", () => {
    const base: ThreadState = {
      ...initialState,
      activeThreadIdByWorkspace: { "ws-1": "thread-missing" },
      threadsByWorkspace: {
        "ws-1": [{ id: "thread-keep", name: "Keep", updatedAt: 100 }],
      },
    };

    const next = threadReducer(base, {
      type: "setThreads",
      workspaceId: "ws-1",
      sortKey: "updated_at",
      threads: [{ id: "thread-new", name: "New", updatedAt: 300 }],
    });

    expect(next.activeThreadIdByWorkspace["ws-1"]).toBe("thread-missing");
    expect(next.threadsByWorkspace["ws-1"]?.[0]).toEqual({
      id: "thread-missing",
      name: "New Agent",
      updatedAt: 0,
    });
  });

  it("does not anchor hidden active thread when sync omits it", () => {
    const base: ThreadState = {
      ...initialState,
      activeThreadIdByWorkspace: { "ws-1": "thread-hidden" },
      hiddenThreadIdsByWorkspace: {
        "ws-1": {
          "thread-hidden": true,
        },
      },
      threadsByWorkspace: {
        "ws-1": [{ id: "thread-hidden", name: "Hidden", updatedAt: 200 }],
      },
    };

    const next = threadReducer(base, {
      type: "setThreads",
      workspaceId: "ws-1",
      sortKey: "updated_at",
      threads: [
        { id: "thread-new-1", name: "New 1", updatedAt: 300 },
        { id: "thread-new-2", name: "New 2", updatedAt: 250 },
      ],
    });

    expect(next.activeThreadIdByWorkspace["ws-1"]).toBe("thread-new-1");
    expect(next.threadsByWorkspace["ws-1"]?.map((thread) => thread.id)).toEqual([
      "thread-new-1",
      "thread-new-2",
    ]);
  });

  it("handles batch empty and sequential actions", () => {
    const unchanged = threadReducer(initialState, {
      type: "batch",
      actions: [],
    });
    expect(unchanged).toBe(initialState);

    const updated = threadReducer(initialState, {
      type: "batch",
      actions: [
        { type: "setThreadListLoading", workspaceId: "ws-1", isLoading: true },
        { type: "setThreadListCursor", workspaceId: "ws-1", cursor: "cursor-1" },
      ],
    });
    expect(updated.threadListLoadingByWorkspace["ws-1"]).toBe(true);
    expect(updated.threadListCursorByWorkspace["ws-1"]).toBe("cursor-1");
  });

  it("returns same state for default case action", () => {
    const unknownAction = {
      type: "__unknown__",
    } as unknown as Parameters<typeof threadReducer>[1];
    expect(threadReducer(initialState, unknownAction)).toBe(initialState);
  });

  it("returns the same populated state for default actions", () => {
    const base = threadReducer(initialState, {
      type: "setThreadListLoading",
      workspaceId: "ws-1",
      isLoading: true,
    });
    const unknownAction = {
      type: "__unknown__",
      payload: { anything: true },
    } as unknown as Parameters<typeof threadReducer>[1];

    expect(threadReducer(base, unknownAction)).toBe(base);
  });

  it("covers setActiveThreadId and hidden ensureThread early return", () => {
    const base: ThreadState = {
      ...initialState,
      hiddenThreadIdsByWorkspace: { "ws-1": { "thread-hidden": true } },
      threadStatusById: {
        "thread-1": {
          isProcessing: false,
          hasUnread: true,
          isReviewing: false,
          phase: "completed",
          processingStartedAt: null,
          lastDurationMs: null,
          waitReason: "none",
          retryState: "none",
          messagePhase: "unknown",
        },
      },
    };
    const activated = threadReducer(base, {
      type: "setActiveThreadId",
      workspaceId: "ws-1",
      threadId: "thread-1",
    });
    expect(activated.activeThreadIdByWorkspace["ws-1"]).toBe("thread-1");
    expect(activated.threadStatusById["thread-1"]?.hasUnread).toBe(false);

    const hiddenEnsure = threadReducer(base, {
      type: "ensureThread",
      workspaceId: "ws-1",
      threadId: "thread-hidden",
    });
    expect(hiddenEnsure).toBe(base);
  });

  it("covers setThreadParent invalid payload early returns", () => {
    const base: ThreadState = {
      ...initialState,
      threadParentById: { "thread-1": "thread-parent" },
      threadParentRankById: { "thread-1": 100 },
    };
    const emptyParent = threadReducer(base, {
      type: "setThreadParent",
      threadId: "thread-1",
      parentId: "",
    });
    expect(emptyParent).toBe(base);

    const selfParent = threadReducer(base, {
      type: "setThreadParent",
      threadId: "thread-1",
      parentId: "thread-1",
    });
    expect(selfParent).toBe(base);
  });

  it("covers touchThreadActivity success and stale early return", () => {
    const touched = threadReducer(initialState, {
      type: "touchThreadActivity",
      threadId: "thread-1",
      timestamp: 100,
    });
    expect(touched.threadStatusById["thread-1"]?.lastActivityAt).toBe(100);

    const stale = threadReducer(touched, {
      type: "touchThreadActivity",
      threadId: "thread-1",
      timestamp: 99,
    });
    expect(stale).toBe(touched);
  });

  it("covers status actions and active-item clear early return", () => {
    const withStatus = threadReducer(initialState, {
      type: "setThreadTurnStatus",
      threadId: "thread-1",
      turnStatus: "inProgress",
    });
    expect(withStatus.threadStatusById["thread-1"]?.turnStatus).toBe("inProgress");

    const withPhase = threadReducer(withStatus, {
      type: "setThreadMessagePhase",
      threadId: "thread-1",
      messagePhase: "commentary",
    });
    expect(withPhase.threadStatusById["thread-1"]?.messagePhase).toBe("commentary");

    const withWaitReason = threadReducer(withPhase, {
      type: "setThreadWaitReason",
      threadId: "thread-1",
      waitReason: "tool_wait",
    });
    expect(withWaitReason.threadStatusById["thread-1"]?.waitReason).toBe("tool_wait");

    const withRetry = threadReducer(withWaitReason, {
      type: "setThreadRetryState",
      threadId: "thread-1",
      retryState: "retrying",
    });
    expect(withRetry.threadStatusById["thread-1"]?.retryState).toBe("retrying");

    const withActiveItem = threadReducer(withRetry, {
      type: "setActiveItemStatus",
      threadId: "thread-1",
      itemId: "item-1",
      status: "inProgress",
    });
    expect(withActiveItem.threadStatusById["thread-1"]?.activeItemStatuses?.["item-1"]).toBe(
      "inProgress",
    );

    const clearMissing = threadReducer(withRetry, {
      type: "clearActiveItemStatus",
      threadId: "thread-1",
      itemId: "missing",
    });
    expect(clearMissing).toBe(withRetry);

    const cleared = threadReducer(withActiveItem, {
      type: "clearActiveItemStatus",
      threadId: "thread-1",
      itemId: "item-1",
    });
    expect(cleared.threadStatusById["thread-1"]?.activeItemStatuses?.["item-1"]).toBeUndefined();
  });

  it("covers setMcpProgressMessage and setThreadPhase early return", () => {
    const withTerminal = threadReducer(initialState, {
      type: "setThreadTurnStatus",
      threadId: "thread-1",
      turnStatus: "completed",
    });
    const blocked = threadReducer(withTerminal, {
      type: "setThreadPhase",
      threadId: "thread-1",
      phase: "streaming",
    });
    expect(blocked).toBe(withTerminal);

    const withProgress = threadReducer(withTerminal, {
      type: "setMcpProgressMessage",
      threadId: "thread-1",
      message: "loading tools",
    });
    expect(withProgress.threadStatusById["thread-1"]?.lastMcpProgressMessage).toBe(
      "loading tools",
    );
  });

  it("covers markThreadError and list-style state writers", () => {
    const errored = threadReducer(initialState, {
      type: "markThreadError",
      threadId: "thread-1",
      timestamp: 111,
      message: "  boom  ",
    });
    expect(errored.threadStatusById["thread-1"]?.phase).toBe("failed");
    expect(errored.threadStatusById["thread-1"]?.lastErrorMessage).toBe("boom");

    const listState = threadReducer(initialState, {
      type: "batch",
      actions: [
        { type: "setThreadListLoading", workspaceId: "ws-1", isLoading: true },
        { type: "setThreadResumeLoading", threadId: "thread-1", isLoading: true },
        { type: "setThreadListPaging", workspaceId: "ws-1", isLoading: true },
        { type: "setThreadListCursor", workspaceId: "ws-1", cursor: "cursor-1" },
      ],
    });
    expect(listState.threadListLoadingByWorkspace["ws-1"]).toBe(true);
    expect(listState.threadResumeLoadingById["thread-1"]).toBe(true);
    expect(listState.threadListPagingByWorkspace["ws-1"]).toBe(true);
    expect(listState.threadListCursorByWorkspace["ws-1"]).toBe("cursor-1");
  });

  it("covers addAssistantMessage, setThreadName, and setThreadItems", () => {
    const renamed = threadReducer(
      {
        ...initialState,
        threadsByWorkspace: {
          "ws-1": [{ id: "thread-1", name: "New Agent", updatedAt: 0 }],
        },
      },
      {
        type: "setThreadName",
        workspaceId: "ws-1",
        threadId: "thread-1",
        name: "Manual name",
      },
    );
    expect(renamed.threadsByWorkspace["ws-1"]?.[0]?.name).toBe("Manual name");

    const withAssistant = threadReducer(renamed, {
      type: "addAssistantMessage",
      threadId: "thread-1",
      text: "hello",
    });
    expect(withAssistant.itemsByThread["thread-1"]?.[0]?.kind).toBe("message");

    const replacedItems = threadReducer(withAssistant, {
      type: "setThreadItems",
      threadId: "thread-1",
      items: [],
    });
    expect(replacedItems.itemsByThread["thread-1"]).toEqual([]);
  });

  it("covers completeAgentMessage append and early return", () => {
    const appended = threadReducer(initialState, {
      type: "completeAgentMessage",
      workspaceId: "ws-1",
      threadId: "thread-1",
      itemId: "assistant-1",
      text: "abcdef",
      hasCustomName: false,
    });
    expect(appended.itemsByThread["thread-1"]?.[0]).toMatchObject({
      id: "assistant-1",
      kind: "message",
      role: "assistant",
      text: "abcdef",
    });

    const unchanged = threadReducer(appended, {
      type: "completeAgentMessage",
      workspaceId: "ws-1",
      threadId: "thread-1",
      itemId: "assistant-1",
      text: "abc",
      hasCustomName: false,
    });
    expect(unchanged).toBe(appended);
  });

  it("covers appendToolOutput write path and no-op early return", () => {
    const base: ThreadState = {
      ...initialState,
      itemsByThread: {
        "thread-1": [
          {
            id: "tool-1",
            kind: "tool",
            toolType: "shell",
            title: "Shell",
            detail: "",
            status: "completed",
            output: "abc",
          },
        ],
      },
    };
    const appended = threadReducer(base, {
      type: "appendToolOutput",
      threadId: "thread-1",
      itemId: "tool-1",
      delta: "def",
    });
    const item = appended.itemsByThread["thread-1"]?.[0];
    expect(item?.kind).toBe("tool");
    if (item?.kind === "tool") {
      expect(item.output).toBe("abcdef");
    }

    const unchanged = threadReducer(appended, {
      type: "appendToolOutput",
      threadId: "thread-1",
      itemId: "tool-1",
      delta: "abcdef",
    });
    expect(unchanged).toBe(appended);
  });

  it("covers approval and user-input wait-reason transitions", () => {
    const approval = {
      workspace_id: "ws-1",
      request_id: 7,
      method: "exec/approveCommand",
      params: { thread_id: "thread-1" },
      command: { kind: "apply_patch", args: [], parsed_cmd: [] },
      status: "pending",
      title: "Needs review",
      options: [],
      created_at: "2026-01-01T00:00:00Z",
      id: "approval-7",
    };
    const addedApproval = threadReducer(initialState, {
      type: "addApproval",
      approval,
    });
    expect(addedApproval.approvals).toHaveLength(1);
    expect(addedApproval.threadStatusById["thread-1"]?.waitReason).toBe("approval");

    const dedupedApproval = threadReducer(addedApproval, {
      type: "addApproval",
      approval,
    });
    expect(dedupedApproval).toBe(addedApproval);

    const withUserInput = threadReducer(addedApproval, {
      type: "addUserInputRequest",
      request: {
        workspace_id: "ws-1",
        request_id: 8,
        params: {
          thread_id: "thread-1",
          turn_id: "turn-1",
          item_id: "item-1",
          questions: [],
        },
      },
    });
    expect(withUserInput.threadStatusById["thread-1"]?.waitReason).toBe("user_input");

    const removedApproval = threadReducer(withUserInput, {
      type: "removeApproval",
      requestId: 7,
      workspaceId: "ws-1",
    });
    expect(removedApproval.threadStatusById["thread-1"]?.waitReason).toBe("user_input");

    const removedUserInput = threadReducer(removedApproval, {
      type: "removeUserInputRequest",
      requestId: 8,
      workspaceId: "ws-1",
    });
    expect(removedUserInput.threadStatusById["thread-1"]?.waitReason).toBe("none");
  });

  it("covers invalid turn-id payload early return and metadata stores", () => {
    const invalidTurnMeta = threadReducer(initialState, {
      type: "setThreadTurnMeta",
      threadId: "thread-1",
      turnId: "   ",
      model: "gpt-5",
    });
    expect(invalidTurnMeta).toBe(initialState);

    const invalidContext = threadReducer(initialState, {
      type: "setThreadTurnContextWindow",
      threadId: "thread-1",
      turnId: "  ",
      contextWindow: 1000,
    });
    expect(invalidContext).toBe(initialState);

    const setStores = threadReducer(initialState, {
      type: "batch",
      actions: [
        { type: "setThreadTokenUsage", threadId: "thread-1", tokenUsage: { total: { totalTokens: 10, inputTokens: 0, cachedInputTokens: 0, outputTokens: 0, reasoningOutputTokens: 0 }, last: { totalTokens: 0, inputTokens: 0, cachedInputTokens: 0, outputTokens: 0, reasoningOutputTokens: 0 }, modelContextWindow: null } },
        { type: "setRateLimits", workspaceId: "ws-1", rateLimits: { primary: null, secondary: null, credits: null, planType: null } },
        { type: "setAccountInfo", workspaceId: "ws-1", account: { type: "apikey" as const, email: "a@b.com", planType: null, requiresOpenaiAuth: null } },
        { type: "setActiveTurnId", threadId: "thread-1", turnId: "turn-1" },
        { type: "setThreadPlan", threadId: "thread-1", plan: { turnId: "turn-1", explanation: null, steps: [] } },
        { type: "clearThreadPlan", threadId: "thread-1" },
      ],
    });
    expect(setStores.tokenUsageByThread["thread-1"]).toEqual({ total: { totalTokens: 10, inputTokens: 0, cachedInputTokens: 0, outputTokens: 0, reasoningOutputTokens: 0 }, last: { totalTokens: 0, inputTokens: 0, cachedInputTokens: 0, outputTokens: 0, reasoningOutputTokens: 0 }, modelContextWindow: null });
    expect(setStores.rateLimitsByWorkspace["ws-1"]).toEqual({ primary: null, secondary: null, credits: null, planType: null });
    expect(setStores.accountByWorkspace["ws-1"]).toEqual({ type: "apikey", email: "a@b.com", planType: null, requiresOpenaiAuth: null });
    expect(setStores.activeTurnIdByThread["thread-1"]).toBe("turn-1");
    expect(setStores.planByThread["thread-1"]).toBeNull();
  });

  it("covers setLastAgentMessage stale early return and bulk no-op paths", () => {
    const withLatest = threadReducer(initialState, {
      type: "setLastAgentMessage",
      threadId: "thread-1",
      text: "latest",
      timestamp: 200,
    });
    const stale = threadReducer(withLatest, {
      type: "setLastAgentMessage",
      threadId: "thread-1",
      text: "stale",
      timestamp: 199,
    });
    expect(stale).toBe(withLatest);

    const emptyBulk = threadReducer(withLatest, {
      type: "setLastAgentMessagesBulk",
      updates: [],
    });
    expect(emptyBulk).toBe(withLatest);

    const invalidOnlyBulk = threadReducer(withLatest, {
      type: "setLastAgentMessagesBulk",
      updates: [{ threadId: "", text: "", timestamp: 300 }],
    });
    expect(invalidOnlyBulk).toBe(withLatest);
  });

  it("uses ordering.version when timestamp is invalid for setThreadParent", () => {
    const next = threadReducer(initialState, {
      type: "setThreadParent",
      threadId: "thread-child",
      parentId: "thread-parent",
      ordering: { timestamp: -1, version: 77 },
    });

    expect(next.threadParentById["thread-child"]).toBe("thread-parent");
    expect(next.threadParentRankById["thread-child"]).toBe(77);
  });

  it("keeps state when setThreadParent receives unchanged parent with invalid ordering", () => {
    const base: ThreadState = {
      ...initialState,
      threadParentById: { "thread-child": "thread-parent" },
      threadParentRankById: { "thread-child": 77 },
    };

    const next = threadReducer(base, {
      type: "setThreadParent",
      threadId: "thread-child",
      parentId: "thread-parent",
      ordering: { timestamp: 0, version: 0 },
    });

    expect(next).toBe(base);
  });

  it("keeps state when setThreadParent receives same parent and same incoming rank", () => {
    const base: ThreadState = {
      ...initialState,
      threadParentById: { "thread-child": "thread-parent" },
      threadParentRankById: { "thread-child": 88 },
    };

    const next = threadReducer(base, {
      type: "setThreadParent",
      threadId: "thread-child",
      parentId: "thread-parent",
      ordering: { timestamp: 88 },
    });

    expect(next).toBe(base);
  });

  it("drops orphan parent ranks while removing a different thread", () => {
    const base: ThreadState = {
      ...initialState,
      threadsByWorkspace: {
        "ws-1": [
          { id: "thread-remove", name: "Remove", updatedAt: 2 },
          { id: "thread-keep", name: "Keep", updatedAt: 1 },
        ],
      },
      threadParentById: {
        "thread-child": "thread-keep",
      },
      threadParentRankById: {
        "thread-child": 10,
        "thread-orphan": 999,
      },
    };

    const next = threadReducer(base, {
      type: "removeThread",
      workspaceId: "ws-1",
      threadId: "thread-remove",
    });

    expect(next.threadParentRankById["thread-child"]).toBe(10);
    expect(next.threadParentRankById["thread-orphan"]).toBeUndefined();
  });

  it("appends a new assistant message when appendAgentDelta targets a non-message item", () => {
    const base: ThreadState = {
      ...initialState,
      itemsByThread: {
        "thread-1": [
          {
            id: "same-id",
            kind: "tool",
            toolType: "shell",
            title: "Shell",
            detail: "",
            status: "completed",
            output: "done",
          },
        ],
      },
    };

    const next = threadReducer(base, {
      type: "appendAgentDelta",
      workspaceId: "ws-1",
      threadId: "thread-1",
      itemId: "same-id",
      delta: "assistant text",
      hasCustomName: true,
    });

    expect(next.itemsByThread["thread-1"]).toHaveLength(2);
    expect(next.itemsByThread["thread-1"]?.[1]).toMatchObject({
      id: "same-id",
      kind: "message",
      role: "assistant",
      text: "assistant text",
    });
  });

  it("keeps state when appendAgentDelta receives an empty delta without meta changes", () => {
    const base = threadReducer(initialState, {
      type: "appendAgentDelta",
      workspaceId: "ws-1",
      threadId: "thread-1",
      itemId: "assistant-1",
      delta: "seed",
      hasCustomName: true,
    });

    const next = threadReducer(base, {
      type: "appendAgentDelta",
      workspaceId: "ws-1",
      threadId: "thread-1",
      itemId: "assistant-1",
      delta: "",
      hasCustomName: true,
    });

    expect(next).toBe(base);
  });

  it("replaces assistant text on completeAgentMessage when incoming text length is equal", () => {
    const base = threadReducer(initialState, {
      type: "appendAgentDelta",
      workspaceId: "ws-1",
      threadId: "thread-1",
      itemId: "assistant-1",
      delta: "old",
      hasCustomName: true,
    });

    const next = threadReducer(base, {
      type: "completeAgentMessage",
      workspaceId: "ws-1",
      threadId: "thread-1",
      itemId: "assistant-1",
      text: "new",
      hasCustomName: true,
    });

    const item = next.itemsByThread["thread-1"]?.[0];
    expect(item?.kind).toBe("message");
    if (item?.kind === "message") {
      expect(item.text).toBe("new");
    }
  });

  it("converts existing non-tool item into plan tool on appendPlanDelta", () => {
    const base: ThreadState = {
      ...initialState,
      itemsByThread: {
        "thread-1": [
          {
            id: "plan-1",
            kind: "message",
            role: "assistant",
            text: "legacy",
          },
        ],
      },
    };

    const next = threadReducer(base, {
      type: "appendPlanDelta",
      threadId: "thread-1",
      itemId: "plan-1",
      delta: "Step A",
    });

    const item = next.itemsByThread["thread-1"]?.[0];
    expect(item?.kind).toBe("tool");
    if (item?.kind === "tool") {
      expect(item.toolType).toBe("plan");
      expect(item.output).toBe("Step A");
    }
  });

  it("keeps state when appendReasoningSummaryBoundary is called on a double-newline summary", () => {
    const base: ThreadState = {
      ...initialState,
      itemsByThread: {
        "thread-1": [
          {
            id: "reasoning-1",
            kind: "reasoning",
            summary: "line 1\n\n",
            content: "",
          },
        ],
      },
    };

    const next = threadReducer(base, {
      type: "appendReasoningSummaryBoundary",
      threadId: "thread-1",
      itemId: "reasoning-1",
    });

    expect(next).toBe(base);
  });

  it("stores approval without touching thread status when payload thread id is blank", () => {
    const approval = {
      workspace_id: "ws-1",
      request_id: 101,
      params: { thread_id: "   " },
      command: { kind: "apply_patch", args: [], parsed_cmd: [] },
      status: "pending",
      title: "Approval",
      options: [],
      created_at: "2026-01-01T00:00:00Z",
      id: "approval-101",
    } as unknown as ApprovalRequest;

    const next = threadReducer(initialState, {
      type: "addApproval",
      approval,
    });

    expect(next.approvals).toHaveLength(1);
    expect(next.threadStatusById["thread-1"]).toBeUndefined();
  });

  it("removes previous turn mapping when setThreadTurnMeta switches to a new turn id", () => {
    const withFirstTurn = threadReducer(initialState, {
      type: "setThreadTurnMeta",
      threadId: "thread-1",
      turnId: "turn-1",
      model: "gpt-5",
    });

    const withSecondTurn = threadReducer(withFirstTurn, {
      type: "setThreadTurnMeta",
      threadId: "thread-1",
      turnId: "turn-2",
      model: "gpt-5-mini",
    });

    expect(withSecondTurn.turnMetaByTurnId["turn-1"]).toBeUndefined();
    expect(withSecondTurn.turnMetaByTurnId["turn-2"]?.threadId).toBe("thread-1");
    expect(withSecondTurn.turnMetaByThread["thread-1"]?.turnId).toBe("turn-2");
  });

  it("backfills context window and turn id onto the trailing assistant without explicit turn id", () => {
    const base: ThreadState = {
      ...initialState,
      itemsByThread: {
        "thread-1": [
          {
            id: "a-1",
            kind: "message",
            role: "assistant",
            text: "first",
            turnId: "turn-older",
          },
          {
            id: "a-2",
            kind: "message",
            role: "assistant",
            text: "tail",
          },
        ],
      },
    };

    const next = threadReducer(base, {
      type: "setThreadTurnContextWindow",
      threadId: "thread-1",
      turnId: "turn-new",
      contextWindow: 4096,
    });

    const first = next.itemsByThread["thread-1"]?.[0];
    const second = next.itemsByThread["thread-1"]?.[1];
    expect(first?.kind).toBe("message");
    expect(second?.kind).toBe("message");
    if (first?.kind === "message") {
      expect(first.turnId).toBe("turn-older");
      expect(first.contextWindow).toBeUndefined();
    }
    if (second?.kind === "message") {
      expect(second.turnId).toBe("turn-new");
      expect(second.contextWindow).toBe(4096);
    }
  });

  it("does not rename from agent output when thread already has a user message", () => {
    const base: ThreadState = {
      ...initialState,
      threadsByWorkspace: {
        "ws-1": [{ id: "thread-1", name: "New Agent", updatedAt: 1 }],
      },
      itemsByThread: {
        "thread-1": [
          {
            id: "user-1",
            kind: "message",
            role: "user",
            text: "keep existing title",
          },
        ],
      },
    };

    const next = threadReducer(base, {
      type: "appendAgentDelta",
      workspaceId: "ws-1",
      threadId: "thread-1",
      itemId: "assistant-1",
      delta: "assistant title candidate",
      hasCustomName: false,
    });

    expect(next.threadsByWorkspace["ws-1"]?.[0]?.name).toBe("New Agent");
  });

  it("does not rename from agent output when custom name flag is set", () => {
    const base: ThreadState = {
      ...initialState,
      threadsByWorkspace: {
        "ws-1": [{ id: "thread-1", name: "New Agent", updatedAt: 1 }],
      },
    };
    const next = threadReducer(base, {
      type: "appendAgentDelta",
      workspaceId: "ws-1",
      threadId: "thread-1",
      itemId: "assistant-1",
      delta: "assistant title candidate",
      hasCustomName: true,
    });

    expect(next.threadsByWorkspace["ws-1"]?.[0]?.name).toBe("New Agent");
  });

  it("keeps assistant text unchanged when incoming delta is a prefix of existing text", () => {
    const base = threadReducer(initialState, {
      type: "appendAgentDelta",
      workspaceId: "ws-1",
      threadId: "thread-1",
      itemId: "assistant-1",
      delta: "hello world",
      hasCustomName: false,
    });
    const next = threadReducer(base, {
      type: "appendAgentDelta",
      workspaceId: "ws-1",
      threadId: "thread-1",
      itemId: "assistant-1",
      delta: "hello",
      hasCustomName: false,
    });

    const item = next.itemsByThread["thread-1"]?.[0];
    expect(item?.kind).toBe("message");
    if (item?.kind === "message") {
      expect(item.text).toBe("hello world");
    }
  });

  it("replaces assistant text when incoming delta fully extends existing text", () => {
    const base = threadReducer(initialState, {
      type: "appendAgentDelta",
      workspaceId: "ws-1",
      threadId: "thread-1",
      itemId: "assistant-1",
      delta: "hello",
      hasCustomName: false,
    });
    const next = threadReducer(base, {
      type: "appendAgentDelta",
      workspaceId: "ws-1",
      threadId: "thread-1",
      itemId: "assistant-1",
      delta: "hello world",
      hasCustomName: false,
    });

    const item = next.itemsByThread["thread-1"]?.[0];
    expect(item?.kind).toBe("message");
    if (item?.kind === "message") {
      expect(item.text).toBe("hello world");
    }
  });

  it("ignores setThreadParent when incoming ordering rank is older than current rank", () => {
    const withParent = threadReducer(initialState, {
      type: "setThreadParent",
      threadId: "thread-1",
      parentId: "parent-1",
      ordering: { timestamp: 200 },
    });
    const next = threadReducer(withParent, {
      type: "setThreadParent",
      threadId: "thread-1",
      parentId: "parent-2",
      ordering: { timestamp: 100 },
    });

    expect(next).toBe(withParent);
    expect(next.threadParentById["thread-1"]).toBe("parent-1");
  });

  it("resolves waitReason back to retry after removing only user-input request", () => {
    const base: ThreadState = {
      ...initialState,
      threadStatusById: {
        "thread-1": {
          isProcessing: false,
          hasUnread: false,
          isReviewing: false,
          phase: "waiting_user",
          processingStartedAt: null,
          lastDurationMs: null,
          waitReason: "retry",
          retryState: "retrying",
          activeItemStatuses: {},
          messagePhase: "unknown",
          lastMcpProgressMessage: null,
        },
      },
      userInputRequests: [
        {
          workspace_id: "ws-1",
          request_id: 11,
          params: {
            thread_id: "thread-1",
            turn_id: "turn-1",
            item_id: "call-1",
            questions: [],
          },
        },
      ],
    };

    const next = threadReducer(base, {
      type: "removeUserInputRequest",
      workspaceId: "ws-1",
      requestId: 11,
    });

    expect(next.userInputRequests).toHaveLength(0);
    expect(next.threadStatusById["thread-1"]?.waitReason).toBe("retry");
  });

  it("keeps custom thread titles when assistant rename candidate is blank or unchanged", () => {
    const base: ThreadState = {
      ...initialState,
      threadsByWorkspace: {
        "ws-1": [{ id: "thread-1", name: "Project Alpha", updatedAt: 1 }],
      },
    };

    const blankRename = threadReducer(base, {
      type: "appendAgentDelta",
      workspaceId: "ws-1",
      threadId: "thread-1",
      itemId: "assistant-1",
      delta: "   ",
      hasCustomName: false,
    });
    expect(blankRename.threadsByWorkspace["ws-1"]?.[0]?.name).toBe("Project Alpha");

    const sameNameBase: ThreadState = {
      ...initialState,
      threadsByWorkspace: {
        "ws-1": [{ id: "thread-1", name: "Agent 1", updatedAt: 1 }],
      },
    };
    const unchanged = threadReducer(sameNameBase, {
      type: "appendAgentDelta",
      workspaceId: "ws-1",
      threadId: "thread-1",
      itemId: "assistant-2",
      delta: "Agent 1",
      hasCustomName: false,
    });
    expect(unchanged.threadsByWorkspace["ws-1"]?.[0]?.name).toBe("Agent 1");
  });

  it("sanitizes user rename text by stripping image and skill markers", () => {
    const base: ThreadState = {
      ...initialState,
      threadsByWorkspace: {
        "ws-1": [{ id: "thread-1", name: "New Agent", updatedAt: 1 }],
      },
      threadSortKeyByWorkspace: { "ws-1": "updated_at" },
    };

    const next = threadReducer(base, {
      type: "upsertItem",
      workspaceId: "ws-1",
      threadId: "thread-1",
      hasCustomName: false,
      item: {
        id: "user-1",
        kind: "message",
        role: "user",
        text: "  [image x2]   $Skill_Agent   Build me a roadmap  ",
      },
    });

    expect(next.threadsByWorkspace["ws-1"]?.[0]?.name).toBe("Build me a roadmap");
  });

  it("handles setThreadPhase active and final transitions", () => {
    const running = threadReducer(initialState, {
      type: "setThreadPhase",
      threadId: "thread-1",
      phase: "tool_running",
    });
    expect(running.threadStatusById["thread-1"]?.isProcessing).toBe(true);
    expect(running.threadStatusById["thread-1"]?.waitReason).toBe("tool_wait");
    expect(running.threadStatusById["thread-1"]?.retryState).toBe("none");

    const streaming = threadReducer(running, {
      type: "setThreadPhase",
      threadId: "thread-1",
      phase: "streaming",
    });
    expect(streaming.threadStatusById["thread-1"]?.waitReason).toBe("none");

    const completed = threadReducer(streaming, {
      type: "setThreadPhase",
      threadId: "thread-1",
      phase: "completed",
    });
    expect(completed.threadStatusById["thread-1"]?.isProcessing).toBe(false);
    expect(completed.threadStatusById["thread-1"]?.processingStartedAt).toBeNull();
    expect(completed.threadStatusById["thread-1"]?.activeItemStatuses).toEqual({});
  });

  it("returns unchanged state for timestamp updates with empty or stale data", () => {
    const noThreads = threadReducer(initialState, {
      type: "setThreadTimestamp",
      workspaceId: "ws-1",
      threadId: "thread-1",
      timestamp: 100,
    });
    expect(noThreads).toBe(initialState);

    const base: ThreadState = {
      ...initialState,
      threadsByWorkspace: {
        "ws-1": [{ id: "thread-1", name: "Agent 1", updatedAt: 500 }],
      },
    };
    const stale = threadReducer(base, {
      type: "setThreadTimestamp",
      workspaceId: "ws-1",
      threadId: "thread-1",
      timestamp: 500,
    });
    expect(stale).toBe(base);
  });

  it("keeps state when no-op reasoning updates are received", () => {
    const boundaryNoop = threadReducer(initialState, {
      type: "appendReasoningSummaryBoundary",
      threadId: "thread-1",
      itemId: "reasoning-missing",
    });
    expect(boundaryNoop).toBe(initialState);

    const contentNoop = threadReducer(initialState, {
      type: "appendReasoningContent",
      threadId: "thread-1",
      itemId: "reasoning-missing",
      delta: "",
    });
    expect(contentNoop).toBe(initialState);
  });

  it("keeps assistant items unchanged when turn context update targets a different turn", () => {
    const base = threadReducer(initialState, {
      type: "setThreadItems",
      threadId: "thread-1",
      items: [
        {
          id: "assistant-other-turn",
          kind: "message",
          role: "assistant",
          text: "Existing output",
          turnId: "turn-other",
          contextWindow: 8000,
        },
      ],
    });

    const next = threadReducer(base, {
      type: "setThreadTurnContextWindow",
      threadId: "thread-1",
      turnId: "turn-new",
      contextWindow: 16000,
    });

    expect(next.itemsByThread["thread-1"]).toBe(base.itemsByThread["thread-1"]);
    const item = next.itemsByThread["thread-1"]?.[0];
    expect(item?.kind).toBe("message");
    if (item?.kind === "message") {
      expect(item.turnId).toBe("turn-other");
      expect(item.contextWindow).toBe(8000);
    }
  });

  it("keeps assistant items unchanged when turn model update targets a different turn", () => {
    const base = threadReducer(initialState, {
      type: "setThreadItems",
      threadId: "thread-1",
      items: [
        {
          id: "assistant-other-turn",
          kind: "message",
          role: "assistant",
          text: "Existing output",
          turnId: "turn-other",
          model: "gpt-4o",
        },
      ],
    });

    const next = threadReducer(base, {
      type: "setThreadTurnMeta",
      threadId: "thread-1",
      turnId: "turn-new",
      model: "gpt-5",
    });

    expect(next.itemsByThread["thread-1"]).toBe(base.itemsByThread["thread-1"]);
    const item = next.itemsByThread["thread-1"]?.[0];
    expect(item?.kind).toBe("message");
    if (item?.kind === "message") {
      expect(item.turnId).toBe("turn-other");
      expect(item.model).toBe("gpt-4o");
    }
  });

  it("keeps state when appendReasoningSummary receives an empty delta for existing summary", () => {
    const base = threadReducer(initialState, {
      type: "setThreadItems",
      threadId: "thread-1",
      items: [
        {
          id: "reasoning-1",
          kind: "reasoning",
          summary: "Already summarized",
          content: "details",
        },
      ],
    });

    const next = threadReducer(base, {
      type: "appendReasoningSummary",
      threadId: "thread-1",
      itemId: "reasoning-1",
      delta: "",
    });

    expect(next).toBe(base);
  });

  it("keeps state when appendPlanDelta does not change existing plan output", () => {
    const base = threadReducer(initialState, {
      type: "setThreadItems",
      threadId: "thread-1",
      items: [
        {
          id: "plan-1",
          kind: "tool",
          toolType: "plan",
          title: "方案",
          detail: "Generating plan...",
          status: "in_progress",
          output: "- Step 1",
        },
      ],
    });

    const next = threadReducer(base, {
      type: "appendPlanDelta",
      threadId: "thread-1",
      itemId: "plan-1",
      delta: "",
    });

    expect(next).toBe(base);
  });

  it("clears active thread when hiding the only visible active thread", () => {
    const base: ThreadState = {
      ...initialState,
      threadsByWorkspace: {
        "ws-1": [{ id: "thread-1", name: "Only", updatedAt: 1 }],
      },
      activeThreadIdByWorkspace: {
        "ws-1": "thread-1",
      },
    };

    const next = threadReducer(base, {
      type: "hideThread",
      workspaceId: "ws-1",
      threadId: "thread-1",
    });

    expect(next.threadsByWorkspace["ws-1"]).toEqual([]);
    expect(next.activeThreadIdByWorkspace["ws-1"]).toBeNull();
  });

  it("drops stored parent rank when parent changes without valid ordering rank", () => {
    const base: ThreadState = {
      ...initialState,
      threadParentById: { "thread-child": "thread-parent-a" },
      threadParentRankById: { "thread-child": 42 },
    };

    const next = threadReducer(base, {
      type: "setThreadParent",
      threadId: "thread-child",
      parentId: "thread-parent-b",
      ordering: { timestamp: 0, version: 0 },
    });

    expect(next.threadParentById["thread-child"]).toBe("thread-parent-b");
    expect(next.threadParentRankById["thread-child"]).toBeUndefined();
  });

  it("concatenates assistant delta when merge text has no overlap", () => {
    const seeded = threadReducer(initialState, {
      type: "appendAgentDelta",
      workspaceId: "ws-1",
      threadId: "thread-1",
      itemId: "assistant-no-overlap",
      delta: "hello",
      hasCustomName: false,
    });

    const next = threadReducer(seeded, {
      type: "appendAgentDelta",
      workspaceId: "ws-1",
      threadId: "thread-1",
      itemId: "assistant-no-overlap",
      delta: "XYZ",
      hasCustomName: false,
    });

    const item = next.itemsByThread["thread-1"]?.[0];
    expect(item?.kind).toBe("message");
    if (item?.kind === "message") {
      expect(item.text).toBe("helloXYZ");
    }
  });

  it("uses ordering.version when timestamp is NaN in parent-rank updates", () => {
    const next = threadReducer(initialState, {
      type: "setThreadParent",
      threadId: "thread-child",
      parentId: "thread-parent",
      ordering: { timestamp: Number.NaN, version: 123 },
    });

    expect(next.threadParentById["thread-child"]).toBe("thread-parent");
    expect(next.threadParentRankById["thread-child"]).toBe(123);
  });

  it("keeps retry waitReason after removing the last approval when retry is active", () => {
    const approval = {
      workspace_id: "ws-1",
      request_id: 11,
      method: "exec/approveCommand",
      params: { thread_id: "thread-1" },
      command: { kind: "exec", args: ["echo"], parsed_cmd: ["echo"] },
      status: "pending",
      title: "Needs approval",
      options: [],
      created_at: "2026-01-01T00:00:00Z",
      id: "approval-11",
    };
    const base: ThreadState = {
      ...initialState,
      approvals: [approval],
      threadStatusById: {
        "thread-1": {
          isProcessing: false,
          hasUnread: false,
          isReviewing: false,
          phase: "completed",
          processingStartedAt: null,
          lastDurationMs: null,
          waitReason: "retry",
          retryState: "retrying",
          messagePhase: "unknown",
          activeItemStatuses: {},
          lastMcpProgressMessage: null,
        },
      },
    };

    const next = threadReducer(base, {
      type: "removeApproval",
      requestId: 11,
      workspaceId: "ws-1",
    });

    expect(next.approvals).toEqual([]);
    expect(next.threadStatusById["thread-1"]?.waitReason).toBe("retry");
  });

  it("treats setThreadTurnMeta as no-op when turn id is invalid", () => {
    const next = threadReducer(initialState, {
      type: "setThreadTurnMeta",
      threadId: "thread-1",
      turnId: "   ",
      model: "gpt-5.3-codex",
    });

    expect(next).toBe(initialState);
  });

  it("reuses prior context window and updates matching assistant model on turn meta refresh", () => {
    const base: ThreadState = {
      ...initialState,
      itemsByThread: {
        "thread-1": [
          {
            id: "assistant-1",
            kind: "message",
            role: "assistant",
            text: "Existing output",
            turnId: "turn-1",
          },
        ],
      },
      turnMetaByThread: {
        "thread-1": {
          threadId: "thread-1",
          turnId: "turn-1",
          model: "old-model",
          contextWindow: 8192,
        },
      },
      turnMetaByTurnId: {
        "turn-1": {
          threadId: "thread-1",
          turnId: "turn-1",
          model: "old-model",
          contextWindow: 8192,
        },
      },
    };

    const next = threadReducer(base, {
      type: "setThreadTurnMeta",
      threadId: "thread-1",
      turnId: "turn-1",
      model: "new-model",
    });

    expect(next.turnMetaByThread["thread-1"]?.contextWindow).toBe(8192);
    expect(next.turnMetaByThread["thread-1"]?.model).toBe("new-model");
    expect(next.turnMetaByTurnId["turn-1"]?.contextWindow).toBe(8192);
    expect(next.turnMetaByTurnId["turn-1"]?.model).toBe("new-model");
    const message = next.itemsByThread["thread-1"]?.[0];
    expect(message?.kind).toBe("message");
    if (message?.kind === "message") {
      expect(message.text).toBe("Existing output");
      expect(message.model).toBe("new-model");
      expect(message.turnId).toBe("turn-1");
    }
    expect(next.itemsByThread["thread-1"]).not.toBe(base.itemsByThread["thread-1"]);
  });

  it("keeps existing assistant text when complete payload is shorter", () => {
    const withMessage = threadReducer(initialState, {
      type: "completeAgentMessage",
      workspaceId: "ws-1",
      threadId: "thread-1",
      itemId: "assistant-shorter",
      text: "longer-final-output",
      hasCustomName: false,
    });

    const next = threadReducer(withMessage, {
      type: "completeAgentMessage",
      workspaceId: "ws-1",
      threadId: "thread-1",
      itemId: "assistant-shorter",
      text: "short",
      hasCustomName: false,
    });

    expect(next).toBe(withMessage);
    const item = next.itemsByThread["thread-1"]?.[0];
    expect(item?.kind).toBe("message");
    if (item?.kind === "message") {
      expect(item.text).toBe("longer-final-output");
    }
  });

  it("treats setThreadTurnContextWindow as no-op when turn id is invalid", () => {
    const next = threadReducer(initialState, {
      type: "setThreadTurnContextWindow",
      threadId: "thread-1",
      turnId: "",
      contextWindow: 1024,
    });

    expect(next).toBe(initialState);
  });

  it("resets retry wait state when processing stops after retry", () => {
    const base: ThreadState = {
      ...initialState,
      threadStatusById: {
        "thread-1": {
          isProcessing: true,
          hasUnread: false,
          isReviewing: false,
          phase: "starting",
          processingStartedAt: 100,
          lastDurationMs: null,
          waitReason: "retry",
          retryState: "retrying",
          messagePhase: "unknown",
          activeItemStatuses: { "tool-1": "inProgress" },
          lastMcpProgressMessage: "waiting retry",
        },
      },
    };

    const next = threadReducer(base, {
      type: "markProcessing",
      threadId: "thread-1",
      isProcessing: false,
      timestamp: 250,
    });

    expect(next.threadStatusById["thread-1"]?.phase).toBe("completed");
    expect(next.threadStatusById["thread-1"]?.waitReason).toBe("retry");
    expect(next.threadStatusById["thread-1"]?.retryState).toBe("none");
    expect(next.threadStatusById["thread-1"]?.lastDurationMs).toBe(150);
    expect(next.threadStatusById["thread-1"]?.lastMcpProgressMessage).toBeNull();
  });

  it("keeps terminal phases when markProcessing stops an already-terminal thread", () => {
    const base: ThreadState = {
      ...initialState,
      threadStatusById: {
        "thread-1": {
          isProcessing: true,
          hasUnread: false,
          isReviewing: false,
          phase: "stale_recovered",
          processingStartedAt: 20,
          lastDurationMs: null,
          waitReason: "none",
          retryState: "none",
          messagePhase: "unknown",
        },
      },
    };

    const next = threadReducer(base, {
      type: "markProcessing",
      threadId: "thread-1",
      isProcessing: false,
      timestamp: 30,
    });

    expect(next.threadStatusById["thread-1"]?.phase).toBe("stale_recovered");
  });

  it("clears terminal turn metadata fields when setThreadTurnStatus receives terminal status", () => {
    const base: ThreadState = {
      ...initialState,
      threadStatusById: {
        "thread-1": {
          isProcessing: false,
          hasUnread: false,
          isReviewing: false,
          phase: "tool_running",
          processingStartedAt: null,
          lastDurationMs: null,
          waitReason: "tool_wait",
          retryState: "retrying",
          turnStatus: "inProgress",
          activeItemStatuses: { "tool-1": "inProgress" },
          messagePhase: "unknown",
          lastMcpProgressMessage: "streaming tools",
        },
      },
    };

    const next = threadReducer(base, {
      type: "setThreadTurnStatus",
      threadId: "thread-1",
      turnStatus: "completed",
    });

    expect(next.threadStatusById["thread-1"]?.turnStatus).toBe("completed");
    expect(next.threadStatusById["thread-1"]?.waitReason).toBe("none");
    expect(next.threadStatusById["thread-1"]?.retryState).toBe("none");
    expect(next.threadStatusById["thread-1"]?.activeItemStatuses).toEqual({});
    expect(next.threadStatusById["thread-1"]?.lastMcpProgressMessage).toBeNull();
  });

  it("transitions tool wait and completion duration through setThreadPhase", () => {
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(1_000);
    try {
      const running = threadReducer(initialState, {
        type: "setThreadPhase",
        threadId: "thread-1",
        phase: "tool_running",
      });
      expect(running.threadStatusById["thread-1"]?.waitReason).toBe("tool_wait");
      expect(running.threadStatusById["thread-1"]?.isProcessing).toBe(true);

      const streaming = threadReducer(running, {
        type: "setThreadPhase",
        threadId: "thread-1",
        phase: "streaming",
      });
      expect(streaming.threadStatusById["thread-1"]?.waitReason).toBe("none");

      const done = threadReducer(streaming, {
        type: "setThreadPhase",
        threadId: "thread-1",
        phase: "completed",
      });
      expect(done.threadStatusById["thread-1"]?.isProcessing).toBe(false);
      expect(done.threadStatusById["thread-1"]?.lastDurationMs).toBe(0);
      expect(done.threadStatusById["thread-1"]?.activeItemStatuses).toEqual({});
    } finally {
      nowSpy.mockRestore();
    }
  });

  it("falls back from reviewing tool_running phase to starting when still processing", () => {
    const base: ThreadState = {
      ...initialState,
      threadStatusById: {
        "thread-1": {
          isProcessing: true,
          hasUnread: false,
          isReviewing: true,
          phase: "tool_running",
          processingStartedAt: 1,
          lastDurationMs: null,
          waitReason: "none",
          retryState: "none",
          messagePhase: "unknown",
        },
      },
    };

    const next = threadReducer(base, {
      type: "markReviewing",
      threadId: "thread-1",
      isReviewing: false,
    });

    expect(next.threadStatusById["thread-1"]?.isReviewing).toBe(false);
    expect(next.threadStatusById["thread-1"]?.phase).toBe("starting");
  });

  it("stores null error message when markThreadError receives only whitespace", () => {
    const next = threadReducer(initialState, {
      type: "markThreadError",
      threadId: "thread-1",
      timestamp: 222,
      message: "   ",
    });

    expect(next.threadStatusById["thread-1"]?.lastErrorMessage).toBeNull();
    expect(next.threadStatusById["thread-1"]?.lastErrorAt).toBe(222);
  });

  it("renames from long first user message and bumps thread when sorted by updated_at", () => {
    const base: ThreadState = {
      ...initialState,
      threadSortKeyByWorkspace: { "ws-1": "updated_at" },
      threadsByWorkspace: {
        "ws-1": [
          { id: "thread-1", name: "New Agent", updatedAt: 10 },
          { id: "thread-2", name: "Another", updatedAt: 9 },
        ],
      },
    };

    const next = threadReducer(base, {
      type: "upsertItem",
      workspaceId: "ws-1",
      threadId: "thread-1",
      hasCustomName: false,
      item: {
        id: "user-long",
        kind: "message",
        role: "user",
        text: "This is a very long first user message that should be truncated in preview naming",
      },
    });

    expect(next.threadsByWorkspace["ws-1"]?.[0]?.id).toBe("thread-1");
    expect(next.threadsByWorkspace["ws-1"]?.[0]?.name).toBe(
      "This is a very long first user message…",
    );
  });

  it("replaces non-reasoning item when reasoning delta targets existing id", () => {
    const base: ThreadState = {
      ...initialState,
      itemsByThread: {
        "thread-1": [
          { id: "mixed-1", kind: "message", role: "assistant", text: "plain" },
        ],
      },
    };

    const summaryNext = threadReducer(base, {
      type: "appendReasoningSummary",
      threadId: "thread-1",
      itemId: "mixed-1",
      delta: "why",
    });
    const summaryItem = summaryNext.itemsByThread["thread-1"]?.[0];
    expect(summaryItem?.kind).toBe("reasoning");

    const contentNext = threadReducer(summaryNext, {
      type: "appendReasoningContent",
      threadId: "thread-1",
      itemId: "mixed-1",
      delta: "details",
    });
    const contentItem = contentNext.itemsByThread["thread-1"]?.[0];
    expect(contentItem?.kind).toBe("reasoning");
    if (contentItem?.kind === "reasoning") {
      expect(contentItem.summary).toBe("why");
      expect(contentItem.content).toBe("details");
    }
  });

  it("keeps state when setLastAgentMessagesBulk only contains invalid updates", () => {
    const base: ThreadState = {
      ...initialState,
      lastAgentMessageByThread: {
        "thread-1": { text: "stable", timestamp: 100 },
      },
    };

    const next = threadReducer(base, {
      type: "setLastAgentMessagesBulk",
      updates: [
        { threadId: "", text: "skip", timestamp: 101 },
        { threadId: "thread-2", text: "", timestamp: 102 },
        { threadId: "thread-1", text: "older", timestamp: 99 },
      ],
    });

    expect(next).toBe(base);
  });

  it("keeps assistant context window unchanged when latest assistant belongs to another turn", () => {
    const base: ThreadState = {
      ...initialState,
      itemsByThread: {
        "thread-1": [
          {
            id: "assistant-1",
            kind: "message",
            role: "assistant",
            text: "hello",
            turnId: "turn-old",
            contextWindow: 1024,
          },
        ],
      },
    };

    const next = threadReducer(base, {
      type: "setThreadTurnContextWindow",
      threadId: "thread-1",
      turnId: "turn-new",
      contextWindow: 2048,
    });

    expect(next).toEqual({
      ...base,
      turnMetaByThread: {
        "thread-1": { threadId: "thread-1", turnId: "turn-new", contextWindow: 2048, model: null },
      },
      turnMetaByTurnId: {
        "turn-new": { threadId: "thread-1", turnId: "turn-new", contextWindow: 2048, model: null },
      },
    });
    const item = next.itemsByThread["thread-1"]?.[0];
    expect(item?.kind).toBe("message");
    if (item?.kind === "message") {
      expect(item.turnId).toBe("turn-old");
      expect(item.contextWindow).toBe(1024);
    }
  });

  it("keeps assistant model unchanged when latest assistant belongs to another turn", () => {
    const base: ThreadState = {
      ...initialState,
      itemsByThread: {
        "thread-1": [
          {
            id: "assistant-1",
            kind: "message",
            role: "assistant",
            text: "hello",
            turnId: "turn-old",
            model: "model-old",
          },
        ],
      },
    };

    const next = threadReducer(base, {
      type: "setThreadTurnMeta",
      threadId: "thread-1",
      turnId: "turn-new",
      model: "model-new",
    });

    const item = next.itemsByThread["thread-1"]?.[0];
    expect(item?.kind).toBe("message");
    if (item?.kind === "message") {
      expect(item.turnId).toBe("turn-old");
      expect(item.model).toBe("model-old");
    }
  });

  it("keeps non-assistant role when appendAgentDelta collides with existing user message id", () => {
    const base: ThreadState = {
      ...initialState,
      itemsByThread: {
        "thread-1": [
          {
            id: "shared-id",
            kind: "message",
            role: "user",
            text: "first",
          },
        ],
      },
    };

    const next = threadReducer(base, {
      type: "appendAgentDelta",
      workspaceId: "ws-1",
      threadId: "thread-1",
      itemId: "shared-id",
      delta: " update",
      hasCustomName: false,
      turnId: "turn-1",
    });

    const item = next.itemsByThread["thread-1"]?.[0];
    expect(item?.kind).toBe("message");
    if (item?.kind === "message") {
      expect(item.role).toBe("user");
      expect(item.text).toBe("first update");
      expect(item.turnId).toBeUndefined();
      expect(item.model).toBeUndefined();
    }
  });

  it("ignores mismatched turn id when only thread-level turn meta exists", () => {
    const withThreadMeta = threadReducer(initialState, {
      type: "setThreadTurnMeta",
      threadId: "thread-1",
      turnId: "turn-1",
      model: "model-1",
    });

    const next = threadReducer(withThreadMeta, {
      type: "appendAgentDelta",
      workspaceId: "ws-1",
      threadId: "thread-1",
      itemId: "assistant-mismatch",
      delta: "reply",
      hasCustomName: false,
      turnId: "turn-2",
    });

    const item = next.itemsByThread["thread-1"]?.[0];
    expect(item?.kind).toBe("message");
    if (item?.kind === "message") {
      expect(item.turnId).toBe("turn-2");
      expect(item.model).toBeNull();
    }
  });

  it("renames hex-like auto thread names from assistant text", () => {
    const base: ThreadState = {
      ...initialState,
      threadsByWorkspace: {
        "ws-1": [{ id: "thread-1", name: "a1b2c3d4", updatedAt: 1 }],
      },
    };

    const next = threadReducer(base, {
      type: "appendAgentDelta",
      workspaceId: "ws-1",
      threadId: "thread-1",
      itemId: "assistant-sanitize",
      delta: "Ship status now",
      hasCustomName: false,
    });

    expect(next.threadsByWorkspace["ws-1"]?.[0]?.name).toBe("Ship status now");
  });

  it("does not rename non-auto custom thread names from assistant output", () => {
    const base: ThreadState = {
      ...initialState,
      threadsByWorkspace: {
        "ws-1": [{ id: "thread-1", name: "Pinned Project Thread", updatedAt: 1 }],
      },
    };

    const next = threadReducer(base, {
      type: "appendAgentDelta",
      workspaceId: "ws-1",
      threadId: "thread-1",
      itemId: "assistant-custom",
      delta: "Fresh assistant summary",
      hasCustomName: false,
    });

    expect(next.threadsByWorkspace["ws-1"]?.[0]?.name).toBe("Pinned Project Thread");
  });

  it("normalizes non-positive turn context window values to null", () => {
    const base: ThreadState = {
      ...initialState,
      itemsByThread: {
        "thread-1": [
          {
            id: "assistant-ctx",
            kind: "message",
            role: "assistant",
            text: "answer",
            turnId: "turn-1",
            contextWindow: 2048,
          },
        ],
      },
    };

    const next = threadReducer(base, {
      type: "setThreadTurnContextWindow",
      threadId: "thread-1",
      turnId: "turn-1",
      contextWindow: 0,
    });

    const item = next.itemsByThread["thread-1"]?.[0];
    expect(item?.kind).toBe("message");
    if (item?.kind === "message") {
      expect(item.turnId).toBe("turn-1");
      expect(item.contextWindow).toBeNull();
    }
    expect(next.turnMetaByThread["thread-1"]?.contextWindow).toBeNull();
  });

  it("returns same state when hiding an already hidden thread", () => {
    const base: ThreadState = {
      ...initialState,
      hiddenThreadIdsByWorkspace: { "ws-1": { "thread-1": true } },
    };
    const next = threadReducer(base, {
      type: "hideThread",
      workspaceId: "ws-1",
      threadId: "thread-1",
    });
    expect(next).toBe(base);
  });

  it("sets active thread to null when hiding the only active thread", () => {
    const base: ThreadState = {
      ...initialState,
      threadsByWorkspace: { "ws-1": [{ id: "thread-1", name: "Solo", updatedAt: 1 }] },
      activeThreadIdByWorkspace: { "ws-1": "thread-1" },
    };
    const next = threadReducer(base, {
      type: "hideThread",
      workspaceId: "ws-1",
      threadId: "thread-1",
    });
    expect(next.activeThreadIdByWorkspace["ws-1"]).toBeNull();
    expect(next.threadsByWorkspace["ws-1"]).toEqual([]);
  });

  it("preserves retry waitReason transitions across markProcessing start/stop", () => {
    const base: ThreadState = {
      ...initialState,
      threadStatusById: {
        "thread-1": {
          isProcessing: false,
          hasUnread: false,
          isReviewing: false,
          phase: "starting",
          processingStartedAt: null,
          lastDurationMs: null,
          waitReason: "retry",
          retryState: "none",
          messagePhase: "unknown",
          activeItemStatuses: {},
          turnStatus: null,
          lastActivityAt: null,
          lastErrorAt: null,
          lastErrorMessage: null,
          lastMcpProgressMessage: null,
        },
      },
    };

    const running = threadReducer(base, {
      type: "markProcessing",
      threadId: "thread-1",
      isProcessing: true,
      timestamp: 100,
    });
    expect(running.threadStatusById["thread-1"]?.retryState).toBe("retrying");

    const stopped = threadReducer(running, {
      type: "markProcessing",
      threadId: "thread-1",
      isProcessing: false,
      timestamp: 200,
    });
    expect(stopped.threadStatusById["thread-1"]?.waitReason).toBe("retry");
    expect(stopped.threadStatusById["thread-1"]?.retryState).toBe("none");
  });

  it("switches tool_wait waitReason when thread phase enters and exits tool_running", () => {
    const base: ThreadState = {
      ...initialState,
      threadStatusById: {
        "thread-1": {
          isProcessing: false,
          hasUnread: false,
          isReviewing: false,
          phase: "starting",
          processingStartedAt: null,
          lastDurationMs: null,
          waitReason: "none",
          retryState: "retrying",
          messagePhase: "unknown",
          activeItemStatuses: { item: "inProgress" },
          turnStatus: null,
          lastActivityAt: null,
          lastErrorAt: null,
          lastErrorMessage: null,
          lastMcpProgressMessage: "working",
        },
      },
    };

    const toolRunning = threadReducer(base, {
      type: "setThreadPhase",
      threadId: "thread-1",
      phase: "tool_running",
    });
    expect(toolRunning.threadStatusById["thread-1"]?.waitReason).toBe("tool_wait");
    expect(toolRunning.threadStatusById["thread-1"]?.retryState).toBe("none");

    const streaming = threadReducer(toolRunning, {
      type: "setThreadPhase",
      threadId: "thread-1",
      phase: "streaming",
    });
    expect(streaming.threadStatusById["thread-1"]?.waitReason).toBe("none");
  });

  it("handles non-string thread ids for approval/user-input and keeps queue updates", () => {
    const badApproval = {
      workspace_id: "ws-1",
      request_id: 7,
      params: { thread_id: 42 },
    } as unknown as ApprovalRequest;
    const afterApproval = threadReducer(initialState, {
      type: "addApproval",
      approval: badApproval,
    });
    expect(afterApproval.approvals).toHaveLength(1);

    const badInput = {
      workspace_id: "ws-1",
      request_id: 9,
      params: { thread_id: 42, questions: [] },
    } as unknown as ThreadState["userInputRequests"][number];
    const afterInput = threadReducer(afterApproval, {
      type: "addUserInputRequest",
      request: badInput,
    });
    expect(afterInput.userInputRequests).toHaveLength(1);
  });

  it("falls back to none waitReason when removing non-existing approval/input requests", () => {
    const base: ThreadState = {
      ...initialState,
      threadStatusById: {
        "thread-1": {
          isProcessing: false,
          hasUnread: false,
          isReviewing: false,
          phase: "completed",
          processingStartedAt: null,
          lastDurationMs: null,
          waitReason: "none",
          retryState: "none",
          messagePhase: "unknown",
          activeItemStatuses: {},
          turnStatus: null,
          lastActivityAt: null,
          lastErrorAt: null,
          lastErrorMessage: null,
          lastMcpProgressMessage: null,
        },
      },
      approvals: [],
      userInputRequests: [],
    };
    const afterRemoveApproval = threadReducer(base, {
      type: "removeApproval",
      requestId: 123,
      workspaceId: "ws-1",
    });
    expect(afterRemoveApproval.approvals).toEqual([]);
    const afterRemoveInput = threadReducer(afterRemoveApproval, {
      type: "removeUserInputRequest",
      requestId: 456,
      workspaceId: "ws-1",
    });
    expect(afterRemoveInput.userInputRequests).toEqual([]);
  });

  it("creates reasoning and plan entries from non-matching existing kinds", () => {
    const base: ThreadState = {
      ...initialState,
      itemsByThread: {
        "thread-1": [
          {
            id: "mixed-1",
            kind: "message",
            role: "assistant",
            text: "hello",
          },
        ],
      },
    };
    const withReasoning = threadReducer(base, {
      type: "appendReasoningSummary",
      threadId: "thread-1",
      itemId: "mixed-1",
      delta: "plan",
    });
    const reasoningItem = withReasoning.itemsByThread["thread-1"]?.find((i) => i.id === "mixed-1");
    expect(reasoningItem?.kind).toBe("reasoning");

    const withPlan = threadReducer(base, {
      type: "appendPlanDelta",
      threadId: "thread-1",
      itemId: "mixed-1",
      delta: "step",
    });
    const planItem = withPlan.itemsByThread["thread-1"]?.find((i) => i.id === "mixed-1");
    expect(planItem?.kind).toBe("tool");
  });

  it("truncates very long auto-generated thread names from user messages", () => {
    const base: ThreadState = {
      ...initialState,
      threadsByWorkspace: {
        "ws-1": [{ id: "thread-1", name: "New Agent", updatedAt: 1 }],
      },
    };
    const next = threadReducer(base, {
      type: "upsertItem",
      workspaceId: "ws-1",
      threadId: "thread-1",
      item: {
        id: "u-1",
        kind: "message",
        role: "user",
        text: "A".repeat(120),
      },
      hasCustomName: false,
    });
    expect(next.threadsByWorkspace["ws-1"]?.[0]?.name.endsWith("…")).toBe(true);
  });

  it("keeps reducer idempotent for unchanged status updates", () => {
    const base: ThreadState = {
      ...initialState,
      threadStatusById: {
        "thread-1": {
          isProcessing: false,
          hasUnread: false,
          isReviewing: false,
          phase: "completed",
          processingStartedAt: null,
          lastDurationMs: null,
          waitReason: "none",
          retryState: "none",
          messagePhase: "unknown",
          activeItemStatuses: { step: "completed" },
          turnStatus: null,
          lastActivityAt: 100,
          lastErrorAt: 200,
          lastErrorMessage: "boom",
          lastMcpProgressMessage: "done",
        },
      },
    };

    const sameActivity = threadReducer(base, {
      type: "touchThreadActivity",
      threadId: "thread-1",
      timestamp: 100,
    });
    expect(sameActivity).toBe(base);

    const sameActiveItem = threadReducer(base, {
      type: "setActiveItemStatus",
      threadId: "thread-1",
      itemId: "step",
      status: "completed",
    });
    expect(sameActiveItem).toBe(base);

    const sameMcp = threadReducer(base, {
      type: "setMcpProgressMessage",
      threadId: "thread-1",
      message: "done",
    });
    expect(sameMcp).toBe(base);

    const sameError = threadReducer(base, {
      type: "markThreadError",
      threadId: "thread-1",
      timestamp: 200,
      message: "boom",
    });
    expect(sameError.threadStatusById["thread-1"]?.phase).toBe("failed");
  });

  it("keeps summary/content boundary reducers no-op when content does not change", () => {
    const base: ThreadState = {
      ...initialState,
      itemsByThread: {
        "thread-1": [
          { id: "r-1", kind: "reasoning", summary: "Line 1\n\n", content: "Body" },
          {
            id: "tool-1",
            kind: "tool",
            toolType: "plan",
            title: "方案",
            detail: "Generating plan...",
            status: "in_progress",
          },
        ],
      },
    };

    const sameSummary = threadReducer(base, {
      type: "appendReasoningSummary",
      threadId: "thread-1",
      itemId: "r-1",
      delta: "",
    });
    expect(sameSummary).toBe(base);

    const sameBoundary = threadReducer(base, {
      type: "appendReasoningSummaryBoundary",
      threadId: "thread-1",
      itemId: "r-1",
    });
    expect(sameBoundary).toBe(base);

    const sameContent = threadReducer(base, {
      type: "appendReasoningContent",
      threadId: "thread-1",
      itemId: "r-1",
      delta: "",
    });
    expect(sameContent).toBe(base);

    const sameToolOutput = threadReducer(base, {
      type: "appendToolOutput",
      threadId: "thread-1",
      itemId: "tool-1",
      delta: "",
    });
    expect(sameToolOutput).toBe(base);
  });

  it("preserves retry waitReason when clearing approval/user-input queues", () => {
    const base: ThreadState = {
      ...initialState,
      approvals: [
        {
          workspace_id: "ws-1",
          request_id: 1,
          params: { thread_id: "thread-1" },
        } as unknown as ApprovalRequest,
      ],
      userInputRequests: [
        ({
          workspace_id: "ws-1",
          request_id: 2,
          params: {
            thread_id: "thread-1",
            turn_id: "turn-1",
            item_id: "item-1",
            questions: [],
          },
        } as unknown) as ThreadState["userInputRequests"][number],
      ],
      threadStatusById: {
        "thread-1": {
          isProcessing: false,
          hasUnread: false,
          isReviewing: false,
          phase: "completed",
          processingStartedAt: null,
          lastDurationMs: null,
          waitReason: "retry",
          retryState: "retrying",
          messagePhase: "unknown",
          activeItemStatuses: {},
          turnStatus: null,
          lastActivityAt: null,
          lastErrorAt: null,
          lastErrorMessage: null,
          lastMcpProgressMessage: null,
        },
      },
    };

    const afterApproval = threadReducer(base, {
      type: "removeApproval",
      requestId: 1,
      workspaceId: "ws-1",
    });
    expect(afterApproval.threadStatusById["thread-1"]?.waitReason).toBe("user_input");

    const afterInput = threadReducer(afterApproval, {
      type: "removeUserInputRequest",
      requestId: 2,
      workspaceId: "ws-1",
    });
    expect(afterInput.threadStatusById["thread-1"]?.waitReason).toBe("none");
  });

  it("uses thread-level model fallback when setting turn context window", () => {
    const base: ThreadState = {
      ...initialState,
      turnMetaByThread: {
        "thread-1": {
          threadId: "thread-1",
          turnId: "turn-old",
          model: "gemini-3.1-pro",
          contextWindow: 1024,
        },
      },
    };
    const next = threadReducer(base, {
      type: "setThreadTurnContextWindow",
      threadId: "thread-1",
      turnId: "turn-new",
      contextWindow: 4096,
    });
    expect(next.turnMetaByTurnId["turn-new"]?.model).toBe("gemini-3.1-pro");
    expect(next.turnMetaByTurnId["turn-new"]?.contextWindow).toBe(4096);
  });

  it("truncates assistant-based auto rename text", () => {
    const base: ThreadState = {
      ...initialState,
      threadsByWorkspace: {
        "ws-1": [{ id: "thread-1", name: "Agent 1234", updatedAt: 1 }],
      },
      itemsByThread: {
        "thread-1": [
          { id: "assistant-prev", kind: "message", role: "assistant", text: "B".repeat(120) },
          {
            id: "msg-1",
            kind: "tool",
            toolType: "exec_command",
            title: "tool",
            detail: "detail",
            status: "completed",
            output: "x",
          },
        ],
      },
    };
    const next = threadReducer(base, {
      type: "appendAgentDelta",
      workspaceId: "ws-1",
      threadId: "thread-1",
      itemId: "msg-1",
      delta: "B".repeat(120),
      hasCustomName: false,
    });
    expect(next.threadsByWorkspace["ws-1"]?.[0]?.name).toBe(`${"B".repeat(38)}…`);
  });

  it("keeps thread-level meta unresolved when turn-id mapping points to another thread", () => {
    const base: ThreadState = {
      ...initialState,
      turnMetaByTurnId: {
        "turn-1": {
          threadId: "thread-2",
          turnId: "turn-1",
          model: "other-thread-model",
          contextWindow: 4096,
        },
      },
      turnMetaByThread: {
        "thread-1": {
          threadId: "thread-1",
          turnId: "turn-fallback",
          model: "fallback-model",
          contextWindow: 2048,
        },
      },
    };
    const next = threadReducer(base, {
      type: "appendAgentDelta",
      workspaceId: "ws-1",
      threadId: "thread-1",
      itemId: "assistant-1",
      delta: "hello",
      hasCustomName: false,
      turnId: "turn-1",
    });
    const item = next.itemsByThread["thread-1"]?.[0];
    expect(item?.kind).toBe("message");
    if (item?.kind === "message") {
      expect(item.turnId).toBe("turn-1");
      expect(item.model).toBeNull();
      expect(item.contextWindow).toBeNull();
    }
  });

  it("keeps context-window update as no-op when assistant already matches target turn and value", () => {
    const base: ThreadState = {
      ...initialState,
      itemsByThread: {
        "thread-1": [
          {
            id: "assistant-1",
            kind: "message",
            role: "assistant",
            text: "done",
            turnId: "turn-1",
            contextWindow: 4096,
          },
        ],
      },
    };
    const next = threadReducer(base, {
      type: "setThreadTurnContextWindow",
      threadId: "thread-1",
      turnId: "turn-1",
      contextWindow: 4096,
    });
    expect(next.itemsByThread).toBe(base.itemsByThread);
  });

  it("keeps model update as no-op when assistant already matches target turn and model", () => {
    const base: ThreadState = {
      ...initialState,
      itemsByThread: {
        "thread-1": [
          {
            id: "assistant-1",
            kind: "message",
            role: "assistant",
            text: "done",
            turnId: "turn-1",
            model: "gemini-3.1-pro",
          },
        ],
      },
    };
    const next = threadReducer(base, {
      type: "setThreadTurnMeta",
      threadId: "thread-1",
      turnId: "turn-1",
      model: "gemini-3.1-pro",
    });
    expect(next.itemsByThread).toBe(base.itemsByThread);
  });

  it("keeps wait reason on no-op queue removals and preserves queue-driven transitions", () => {
    const approval = {
      workspace_id: "ws-1",
      request_id: 11,
      params: { thread_id: "thread-1" },
    } as unknown as ApprovalRequest;
    const request = ({
      workspace_id: "ws-1",
      request_id: 22,
      params: { thread_id: "thread-1", turn_id: "t", item_id: "i", questions: [] },
    } as unknown) as ThreadState["userInputRequests"][number];

    const base: ThreadState = {
      ...initialState,
      approvals: [approval],
      userInputRequests: [request],
      threadStatusById: {
        "thread-1": {
          isProcessing: false,
          hasUnread: false,
          isReviewing: false,
          phase: "completed",
          processingStartedAt: null,
          lastDurationMs: null,
          waitReason: "approval",
          retryState: "none",
          messagePhase: "unknown",
          activeItemStatuses: {},
          turnStatus: null,
          lastActivityAt: null,
          lastErrorAt: null,
          lastErrorMessage: null,
          lastMcpProgressMessage: null,
        },
      },
    };

    const afterApprovalRemove = threadReducer(base, {
      type: "removeApproval",
      requestId: 11,
      workspaceId: "ws-1",
    });
    expect(afterApprovalRemove.threadStatusById["thread-1"]?.waitReason).toBe("user_input");

    const approvalAndInput: ThreadState = {
      ...base,
      threadStatusById: {
        "thread-1": {
          ...base.threadStatusById["thread-1"],
          waitReason: "approval",
        },
      },
    };
    const keepApprovalStatus = threadReducer(approvalAndInput, {
      type: "removeUserInputRequest",
      requestId: 22,
      workspaceId: "ws-1",
    });
    expect(keepApprovalStatus.threadStatusById).toBe(approvalAndInput.threadStatusById);

    const userInputOnly: ThreadState = {
      ...base,
      approvals: [],
      threadStatusById: {
        "thread-1": {
          ...base.threadStatusById["thread-1"],
          waitReason: "user_input",
        },
      },
    };
    const afterInputRemove = threadReducer(userInputOnly, {
      type: "removeUserInputRequest",
      requestId: 22,
      workspaceId: "ws-1",
    });
    expect(afterInputRemove.threadStatusById["thread-1"]?.waitReason).toBe("none");
  });

  it("keeps appending agent delta as no-op when both text and runtime meta are unchanged", () => {
    const base: ThreadState = {
      ...initialState,
      itemsByThread: {
        "thread-1": [
          {
            id: "assistant-1",
            kind: "message",
            role: "assistant",
            text: "stable",
            turnId: "turn-1",
            model: "gemini-3.1-pro",
            contextWindow: 4096,
          },
        ],
      },
      turnMetaByThread: {
        "thread-1": {
          threadId: "thread-1",
          turnId: "turn-1",
          model: "gemini-3.1-pro",
          contextWindow: 4096,
        },
      },
      turnMetaByTurnId: {
        "turn-1": {
          threadId: "thread-1",
          turnId: "turn-1",
          model: "gemini-3.1-pro",
          contextWindow: 4096,
        },
      },
    };
    const next = threadReducer(base, {
      type: "appendAgentDelta",
      workspaceId: "ws-1",
      threadId: "thread-1",
      itemId: "assistant-1",
      delta: "stable",
      hasCustomName: false,
      turnId: "turn-1",
    });
    expect(next).toBe(base);
  });

  it("returns original state for empty batch actions", () => {
    const next = threadReducer(initialState, {
      type: "batch",
      actions: [],
    });
    expect(next).toBe(initialState);
  });

  it("does not update status map when clearing active thread selection", () => {
    const base: ThreadState = {
      ...initialState,
      threadStatusById: {
        "thread-1": {
          isProcessing: false,
          hasUnread: true,
          isReviewing: false,
          phase: "completed",
          processingStartedAt: null,
          lastDurationMs: null,
          lastActivityAt: null,
          lastErrorAt: null,
          lastErrorMessage: null,
          turnStatus: null,
          activeItemStatuses: {},
          messagePhase: "unknown",
          waitReason: "none",
          retryState: "none",
          lastMcpProgressMessage: null,
        },
      },
    };
    const next = threadReducer(base, {
      type: "setActiveThreadId",
      workspaceId: "ws-1",
      threadId: null,
    });
    expect(next.threadStatusById).toBe(base.threadStatusById);
  });

  it("keeps timestamp update as no-op when incoming timestamp is stale", () => {
    const base: ThreadState = {
      ...initialState,
      threadsByWorkspace: {
        "ws-1": [{ id: "thread-1", name: "Agent 1", updatedAt: 2000 }],
      },
    };
    const next = threadReducer(base, {
      type: "setThreadTimestamp",
      workspaceId: "ws-1",
      threadId: "thread-1",
      timestamp: 1500,
    });
    expect(next).toBe(base);
  });

  it("keeps completeAgentMessage text unchanged when incoming payload is shorter", () => {
    const base: ThreadState = {
      ...initialState,
      itemsByThread: {
        "thread-1": [
          {
            id: "assistant-1",
            kind: "message",
            role: "assistant",
            text: "longer existing text",
          },
        ],
      },
    };
    const next = threadReducer(base, {
      type: "completeAgentMessage",
      workspaceId: "ws-1",
      threadId: "thread-1",
      itemId: "assistant-1",
      text: "short",
      hasCustomName: false,
    });
    expect(next.itemsByThread["thread-1"]?.[0]).toMatchObject({
      kind: "message",
      text: "longer existing text",
    });
  });

  it("uses retry wait reason fallback when removing the final approval", () => {
    const approval = {
      workspace_id: "ws-1",
      request_id: 301,
      params: { thread_id: "thread-1" },
    } as unknown as ApprovalRequest;
    const base: ThreadState = {
      ...initialState,
      approvals: [approval],
      threadStatusById: {
        "thread-1": {
          isProcessing: false,
          hasUnread: false,
          isReviewing: false,
          phase: "completed",
          processingStartedAt: null,
          lastDurationMs: null,
          lastActivityAt: null,
          lastErrorAt: null,
          lastErrorMessage: null,
          turnStatus: null,
          activeItemStatuses: {},
          messagePhase: "unknown",
          waitReason: "retry",
          retryState: "none",
          lastMcpProgressMessage: null,
        },
      },
    };
    const next = threadReducer(base, {
      type: "removeApproval",
      requestId: 301,
      workspaceId: "ws-1",
    });
    expect(next.threadStatusById["thread-1"]?.waitReason).toBe("retry");
  });

  it("keeps active thread when still visible during setThreads", () => {
    const base: ThreadState = {
      ...initialState,
      activeThreadIdByWorkspace: { "ws-1": "thread-2" },
      threadsByWorkspace: {
        "ws-1": [
          { id: "thread-1", name: "Agent 1", updatedAt: 1000 },
          { id: "thread-2", name: "Agent 2", updatedAt: 900 },
        ],
      },
    };
    const next = threadReducer(base, {
      type: "setThreads",
      workspaceId: "ws-1",
      threads: [
        { id: "thread-2", name: "Agent 2", updatedAt: 1200 },
        { id: "thread-3", name: "Agent 3", updatedAt: 1100 },
      ],
      sortKey: "updated_at",
    });
    expect(next.activeThreadIdByWorkspace["ws-1"]).toBe("thread-2");
  });

  it("preserves active item statuses and progress for non-terminal turn status updates", () => {
    const base: ThreadState = {
      ...initialState,
      threadStatusById: {
        "thread-1": {
          isProcessing: true,
          hasUnread: false,
          isReviewing: false,
          phase: "streaming",
          processingStartedAt: 1000,
          lastDurationMs: null,
          lastActivityAt: 1200,
          lastErrorAt: null,
          lastErrorMessage: null,
          turnStatus: "streaming",
          activeItemStatuses: { "item-1": "in_progress" },
          messagePhase: "assistant",
          waitReason: "approval",
          retryState: "retrying",
          lastMcpProgressMessage: "working",
        },
      },
    };
    const next = threadReducer(base, {
      type: "setThreadTurnStatus",
      threadId: "thread-1",
      turnStatus: "running",
    });
    expect(next.threadStatusById["thread-1"]?.activeItemStatuses).toEqual({
      "item-1": "in_progress",
    });
    expect(next.threadStatusById["thread-1"]?.waitReason).toBe("approval");
    expect(next.threadStatusById["thread-1"]?.lastMcpProgressMessage).toBe("working");
  });
});
