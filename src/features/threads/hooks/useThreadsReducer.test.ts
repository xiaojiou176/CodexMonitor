import { describe, expect, it } from "vitest";
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
});
