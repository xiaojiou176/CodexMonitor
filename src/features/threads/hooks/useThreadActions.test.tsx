// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  ConversationItem,
  ThreadArchiveBatchResult,
  WorkspaceInfo,
} from "../../../types";
import {
  archiveThread,
  archiveThreads,
  forkThread,
  listThreads,
  resumeThread,
  startThread,
} from "../../../services/tauri";
import {
  buildItemsFromThread,
  getThreadCreatedTimestamp,
  getThreadTimestamp,
  isReviewingFromThread,
  mergeThreadItems,
  previewThreadName,
} from "../../../utils/threadItems";
import { saveThreadActivity } from "../utils/threadStorage";
import { useThreadActions } from "./useThreadActions";

vi.mock("../../../services/tauri", () => ({
  startThread: vi.fn(),
  forkThread: vi.fn(),
  resumeThread: vi.fn(),
  listThreads: vi.fn(),
  archiveThread: vi.fn(),
  archiveThreads: vi.fn(),
}));

vi.mock("../../../utils/threadItems", () => ({
  buildItemsFromThread: vi.fn(),
  getThreadCreatedTimestamp: vi.fn(),
  getThreadTimestamp: vi.fn(),
  isReviewingFromThread: vi.fn(),
  mergeThreadItems: vi.fn(),
  previewThreadName: vi.fn(),
}));

vi.mock("../utils/threadStorage", () => ({
  saveThreadActivity: vi.fn(),
}));

describe("useThreadActions", () => {
  const workspace: WorkspaceInfo = {
    id: "ws-1",
    name: "CodexMonitor",
    path: "/tmp/codex",
    connected: true,
    settings: { sidebarCollapsed: false },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getThreadCreatedTimestamp).mockReturnValue(0);
  });

  function renderActions(
    overrides?: Partial<Parameters<typeof useThreadActions>[0]>,
  ) {
    const dispatch = vi.fn();
    const loadedThreadsRef = { current: {} as Record<string, boolean> };
    const replaceOnResumeRef = { current: {} as Record<string, boolean> };
    const threadActivityRef = {
      current: {} as Record<string, Record<string, number>>,
    };
    const applyCollabThreadLinksFromThread = vi.fn();
    const updateThreadParent = vi.fn();

    const args: Parameters<typeof useThreadActions>[0] = {
      dispatch,
      itemsByThread: {},
      threadsByWorkspace: {},
      activeThreadIdByWorkspace: {},
      threadListCursorByWorkspace: {},
      threadStatusById: {},
      threadSortKey: "updated_at",
      getCustomName: () => undefined,
      threadActivityRef,
      loadedThreadsRef,
      replaceOnResumeRef,
      applyCollabThreadLinksFromThread,
      updateThreadParent,
      ...overrides,
    };

    const utils = renderHook(() => useThreadActions(args));

    return {
      dispatch,
      loadedThreadsRef: args.loadedThreadsRef,
      replaceOnResumeRef: args.replaceOnResumeRef,
      threadActivityRef: args.threadActivityRef,
      applyCollabThreadLinksFromThread: args.applyCollabThreadLinksFromThread,
      updateThreadParent: args.updateThreadParent,
      ...utils,
    };
  }

  function createDeferred<T>() {
    let resolve: ((value: T) => void) | null = null;
    let reject: ((reason?: unknown) => void) | null = null;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return {
      promise,
      resolve: (value: T) => resolve?.(value),
      reject: (reason?: unknown) => reject?.(reason),
    };
  }

  it("starts a thread and activates it by default", async () => {
    vi.mocked(startThread).mockResolvedValue({
      result: { thread: { id: "thread-1" } },
    });

    const { result, dispatch, loadedThreadsRef } = renderActions();

    let threadId: string | null = null;
    await act(async () => {
      threadId = await result.current.startThreadForWorkspace("ws-1");
    });

    expect(threadId).toBe("thread-1");
    expect(startThread).toHaveBeenCalledWith("ws-1");
    expect(dispatch).toHaveBeenCalledWith({
      type: "ensureThread",
      workspaceId: "ws-1",
      threadId: "thread-1",
    });
    expect(dispatch).toHaveBeenCalledWith({
      type: "setActiveThreadId",
      workspaceId: "ws-1",
      threadId: "thread-1",
    });
    expect(loadedThreadsRef.current["thread-1"]).toBeTruthy();
  });

  it("forks a thread and activates the fork", async () => {
    vi.mocked(forkThread).mockResolvedValue({
      result: { thread: { id: "thread-fork-1" } },
    });

    const { result, dispatch, loadedThreadsRef } = renderActions();

    let threadId: string | null = null;
    await act(async () => {
      threadId = await result.current.forkThreadForWorkspace("ws-1", "thread-1");
    });

    expect(threadId).toBe("thread-fork-1");
    expect(forkThread).toHaveBeenCalledWith("ws-1", "thread-1");
    expect(dispatch).toHaveBeenCalledWith({
      type: "ensureThread",
      workspaceId: "ws-1",
      threadId: "thread-fork-1",
    });
    expect(dispatch).toHaveBeenCalledWith({
      type: "setActiveThreadId",
      workspaceId: "ws-1",
      threadId: "thread-fork-1",
    });
    expect(loadedThreadsRef.current["thread-fork-1"]).toBeTruthy();
  });

  it("starts a thread without activating when requested", async () => {
    vi.mocked(startThread).mockResolvedValue({
      result: { thread: { id: "thread-2" } },
    });

    const { result, dispatch } = renderActions();

    await act(async () => {
      await result.current.startThreadForWorkspace("ws-1", { activate: false });
    });

    expect(dispatch).toHaveBeenCalledWith({
      type: "ensureThread",
      workspaceId: "ws-1",
      threadId: "thread-2",
    });
    expect(dispatch).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: "setActiveThreadId" }),
    );
  });

  it("skips resume when already loaded", async () => {
    const loadedThreadsRef = { current: { "thread-1": true } };
    const { result } = renderActions({ loadedThreadsRef });

    let threadId: string | null = null;
    await act(async () => {
      threadId = await result.current.resumeThreadForWorkspace("ws-1", "thread-1");
    });

    expect(threadId).toBe("thread-1");
    expect(resumeThread).not.toHaveBeenCalled();
  });

  it("skips resume while processing unless forced", async () => {
    const options: Partial<Parameters<typeof useThreadActions>[0]> = {
      loadedThreadsRef: { current: { "thread-1": true } },
      threadStatusById: {
        "thread-1": {
          isProcessing: true,
          hasUnread: false,
          isReviewing: false,
          phase: "starting",
          processingStartedAt: 123,
          lastDurationMs: null,
        },
      },
    };
    const { result: skipResult } = renderActions(options);

    await act(async () => {
      await skipResult.current.resumeThreadForWorkspace("ws-1", "thread-1");
    });

    expect(resumeThread).not.toHaveBeenCalled();

    vi.mocked(resumeThread).mockResolvedValue({
      result: { thread: { id: "thread-1", updated_at: 1 } },
    });

    const { result: forceResult } = renderActions(options);

    await act(async () => {
      await forceResult.current.resumeThreadForWorkspace("ws-1", "thread-1", true);
    });

    expect(resumeThread).toHaveBeenCalledWith("ws-1", "thread-1");
  });

  it("resumes thread, sets items, status, name, and last message", async () => {
    const assistantItem: ConversationItem = {
      id: "assistant-1",
      kind: "message",
      role: "assistant",
      text: "Hello!",
    };

    vi.mocked(resumeThread).mockResolvedValue({
      result: {
        thread: { id: "thread-2", preview: "preview", updated_at: 555 },
      },
    });
    vi.mocked(buildItemsFromThread).mockReturnValue([assistantItem]);
    vi.mocked(isReviewingFromThread).mockReturnValue(true);
    vi.mocked(previewThreadName).mockReturnValue("Preview Name");
    vi.mocked(getThreadTimestamp).mockReturnValue(999);
    vi.mocked(mergeThreadItems).mockReturnValue([assistantItem]);

    const { result, dispatch, applyCollabThreadLinksFromThread } = renderActions();

    await act(async () => {
      await result.current.resumeThreadForWorkspace("ws-1", "thread-2");
    });

    expect(resumeThread).toHaveBeenCalledWith("ws-1", "thread-2");
    expect(applyCollabThreadLinksFromThread).toHaveBeenCalledWith(
      "thread-2",
      expect.objectContaining({ id: "thread-2" }),
    );
    expect(dispatch).toHaveBeenCalledWith({
      type: "ensureThread",
      workspaceId: "ws-1",
      threadId: "thread-2",
    });
    expect(dispatch).toHaveBeenCalledWith({
      type: "setThreadItems",
      threadId: "thread-2",
      items: [assistantItem],
    });
    expect(dispatch).toHaveBeenCalledWith({
      type: "markReviewing",
      threadId: "thread-2",
      isReviewing: true,
    });
    expect(dispatch).toHaveBeenCalledWith({
      type: "setThreadName",
      workspaceId: "ws-1",
      threadId: "thread-2",
      name: "Preview Name",
    });
    expect(dispatch).toHaveBeenCalledWith({
      type: "setLastAgentMessage",
      threadId: "thread-2",
      text: "Hello!",
      timestamp: 999,
    });
  });

  it("links resumed spawn subagent to its parent from thread source", async () => {
    vi.mocked(resumeThread).mockResolvedValue({
      result: {
        thread: {
          id: "child-thread",
          source: {
            subAgent: {
              thread_spawn: {
                parent_thread_id: "parent-thread",
                depth: 1,
              },
            },
          },
        },
      },
    });
    vi.mocked(buildItemsFromThread).mockReturnValue([]);
    vi.mocked(isReviewingFromThread).mockReturnValue(false);

    const { result, updateThreadParent } = renderActions();

    await act(async () => {
      await result.current.resumeThreadForWorkspace("ws-1", "child-thread", true);
    });

    expect(updateThreadParent).toHaveBeenCalledWith(
      "parent-thread",
      ["child-thread"],
      expect.objectContaining({
        allowReparent: true,
        source: expect.any(Object),
      }),
    );
  });

  it("does not hydrate status from resume when local items are preserved", async () => {
    const localItem: ConversationItem = {
      id: "local-assistant-1",
      kind: "message",
      role: "assistant",
      text: "Local snapshot",
    };
    vi.mocked(resumeThread).mockResolvedValue({
      result: {
        thread: {
          id: "thread-1",
          preview: "Stale remote preview",
          updated_at: 1000,
          turns: [{ id: "turn-stale", status: "inProgress", items: [] }],
        },
      },
    });
    vi.mocked(buildItemsFromThread).mockReturnValue([]);
    vi.mocked(isReviewingFromThread).mockReturnValue(true);

    const { result, dispatch } = renderActions({
      itemsByThread: { "thread-1": [localItem] },
    });

    await act(async () => {
      await result.current.resumeThreadForWorkspace("ws-1", "thread-1", true);
    });

    expect(dispatch).not.toHaveBeenCalledWith(
      expect.objectContaining({
        type: "markProcessing",
        threadId: "thread-1",
      }),
    );
    expect(dispatch).not.toHaveBeenCalledWith({
      type: "setActiveTurnId",
      threadId: "thread-1",
      turnId: "turn-stale",
    });
    expect(dispatch).not.toHaveBeenCalledWith({
      type: "markReviewing",
      threadId: "thread-1",
      isReviewing: true,
    });
  });

  it("loads older messages by merging even when local items already exist", async () => {
    const localItem: ConversationItem = {
      id: "local-assistant-1",
      kind: "message",
      role: "assistant",
      text: "Local snapshot",
    };
    const remoteItem: ConversationItem = {
      id: "remote-assistant-2",
      kind: "message",
      role: "assistant",
      text: "Older remote message",
    };

    vi.mocked(resumeThread).mockResolvedValue({
      result: {
        thread: {
          id: "thread-1",
          preview: "History",
          updated_at: 1000,
        },
      },
    });
    vi.mocked(buildItemsFromThread).mockReturnValue([remoteItem]);
    vi.mocked(isReviewingFromThread).mockReturnValue(false);
    vi.mocked(mergeThreadItems).mockReturnValue([localItem, remoteItem]);

    const { result, dispatch } = renderActions({
      itemsByThread: { "thread-1": [localItem] },
    });

    await act(async () => {
      await result.current.loadOlderMessagesForThread("ws-1", "thread-1");
    });

    expect(resumeThread).toHaveBeenCalledWith("ws-1", "thread-1");
    expect(mergeThreadItems).toHaveBeenCalledWith([remoteItem], [localItem]);
    expect(dispatch).toHaveBeenCalledWith({
      type: "setThreadItems",
      threadId: "thread-1",
      items: [localItem, remoteItem],
    });
  });

  it("clears processing state from resume when latest turns are completed", async () => {
    const localItem: ConversationItem = {
      id: "local-assistant-1",
      kind: "message",
      role: "assistant",
      text: "Local snapshot",
    };
    vi.mocked(resumeThread).mockResolvedValue({
      result: {
        thread: {
          id: "thread-1",
          preview: "Done thread",
          updated_at: 1000,
          turns: [
            { id: "turn-1", status: "completed", items: [] },
            { id: "turn-2", status: "completed", items: [] },
          ],
        },
      },
    });
    vi.mocked(buildItemsFromThread).mockReturnValue([]);
    vi.mocked(isReviewingFromThread).mockReturnValue(false);

    const { result, dispatch } = renderActions({
      itemsByThread: { "thread-1": [localItem] },
      threadStatusById: {
        "thread-1": {
          isProcessing: true,
          hasUnread: false,
          isReviewing: false,
          phase: "starting",
          processingStartedAt: 10,
          lastDurationMs: null,
        },
      },
    });

    await act(async () => {
      await result.current.resumeThreadForWorkspace("ws-1", "thread-1", true, true);
    });

    expect(dispatch).toHaveBeenCalledWith({
      type: "markProcessing",
      threadId: "thread-1",
      isProcessing: false,
      timestamp: expect.any(Number),
    });
    expect(dispatch).toHaveBeenCalledWith({
      type: "setActiveTurnId",
      threadId: "thread-1",
      turnId: null,
    });
  });

  it("hydrates processing state from in-progress turns on resume", async () => {
    vi.mocked(resumeThread).mockResolvedValue({
      result: {
        thread: {
          id: "thread-3",
          preview: "Working thread",
          updated_at: 1000,
          turns: [
            { id: "turn-1", status: "completed", items: [] },
            { id: "turn-2", status: "inProgress", items: [] },
          ],
        },
      },
    });
    vi.mocked(buildItemsFromThread).mockReturnValue([]);
    vi.mocked(isReviewingFromThread).mockReturnValue(false);

    const { result, dispatch } = renderActions();

    await act(async () => {
      await result.current.resumeThreadForWorkspace("ws-1", "thread-3", true);
    });

    expect(dispatch).toHaveBeenCalledWith({
      type: "markProcessing",
      threadId: "thread-3",
      isProcessing: true,
      timestamp: expect.any(Number),
    });
    expect(dispatch).toHaveBeenCalledWith({
      type: "setActiveTurnId",
      threadId: "thread-3",
      turnId: "turn-2",
    });
  });

  it("keeps resume loading true until overlapping resumes finish", async () => {
    let resolveFirst: ((value: unknown) => void) | null = null;
    let resolveSecond: ((value: unknown) => void) | null = null;
    const firstPromise = new Promise((resolve) => {
      resolveFirst = resolve;
    });
    const secondPromise = new Promise((resolve) => {
      resolveSecond = resolve;
    });
    vi.mocked(resumeThread)
      .mockReturnValueOnce(firstPromise as Promise<any>)
      .mockReturnValueOnce(secondPromise as Promise<any>);
    vi.mocked(buildItemsFromThread).mockReturnValue([]);
    vi.mocked(isReviewingFromThread).mockReturnValue(false);
    vi.mocked(getThreadTimestamp).mockReturnValue(0);

    const { result, dispatch } = renderActions();

    let callOne: Promise<string | null> | null = null;
    let callTwo: Promise<string | null> | null = null;
    await act(async () => {
      callOne = result.current.resumeThreadForWorkspace("ws-1", "thread-3", true);
      callTwo = result.current.resumeThreadForWorkspace("ws-1", "thread-3", true);
    });

    expect(dispatch).toHaveBeenCalledWith({
      type: "setThreadResumeLoading",
      threadId: "thread-3",
      isLoading: true,
    });

    await act(async () => {
      resolveFirst?.({ result: { thread: { id: "thread-3" } } });
      await firstPromise;
    });

    expect(dispatch).not.toHaveBeenCalledWith({
      type: "setThreadResumeLoading",
      threadId: "thread-3",
      isLoading: false,
    });

    await act(async () => {
      resolveSecond?.({ result: { thread: { id: "thread-3" } } });
      await Promise.all([callOne, callTwo]);
    });

    const loadingFalseCalls = dispatch.mock.calls.filter(
      ([action]) =>
        action?.type === "setThreadResumeLoading" &&
        action?.threadId === "thread-3" &&
        action?.isLoading === false,
    );
    expect(loadingFalseCalls).toHaveLength(1);
  });

  it("lists threads for a workspace and persists activity", async () => {
    vi.mocked(listThreads).mockResolvedValue({
      result: {
        data: [
          {
            id: "thread-1",
            cwd: "/tmp/codex",
            preview: "Remote preview",
            updated_at: 5000,
          },
          {
            id: "thread-2",
            cwd: "/other",
            preview: "Ignore",
            updated_at: 7000,
          },
        ],
        nextCursor: "cursor-1",
      },
    });
    vi.mocked(getThreadTimestamp).mockImplementation((thread) => {
      const value = (thread as Record<string, unknown>).updated_at as number;
      return value ?? 0;
    });

    const { result, dispatch, threadActivityRef } = renderActions({
      getCustomName: (workspaceId, threadId) =>
        workspaceId === "ws-1" && threadId === "thread-1" ? "Custom" : undefined,
      threadActivityRef: { current: {} },
    });

    await act(async () => {
      await result.current.listThreadsForWorkspace(workspace);
    });

    expect(listThreads).toHaveBeenCalled();
    expect(dispatch).toHaveBeenCalledWith({
      type: "setThreadListLoading",
      workspaceId: "ws-1",
      isLoading: true,
    });
    expect(dispatch).toHaveBeenCalledWith({
      type: "setThreads",
      workspaceId: "ws-1",
      sortKey: "updated_at",
      threads: [
        {
          id: "thread-1",
          name: "Custom",
          updatedAt: 5000,
        },
      ],
    });
    expect(dispatch).toHaveBeenCalledWith({
      type: "setThreadListCursor",
      workspaceId: "ws-1",
      cursor: "cursor-1",
    });
    expect(saveThreadActivity).toHaveBeenCalledWith({
      "ws-1": { "thread-1": 5000 },
    });
    expect(threadActivityRef.current).toEqual({
      "ws-1": { "thread-1": 5000 },
    });
  });

  it("restores parent-child links from thread/list source metadata", async () => {
    vi.mocked(listThreads).mockResolvedValue({
      result: {
        data: [
          {
            id: "parent-thread",
            cwd: "/tmp/codex",
            preview: "Parent",
            updated_at: 5000,
            source: "vscode",
          },
          {
            id: "child-thread",
            cwd: "/tmp/codex",
            preview: "Child",
            updated_at: 4500,
            source: {
              sub_agent: {
                threadSpawn: {
                  parentThreadId: "parent-thread",
                  depth: 1,
                },
              },
            },
          },
        ],
        nextCursor: null,
      },
    });
    vi.mocked(getThreadTimestamp).mockImplementation((thread) => {
      const value = (thread as Record<string, unknown>).updated_at as number;
      return value ?? 0;
    });

    const { result, updateThreadParent } = renderActions();

    await act(async () => {
      await result.current.listThreadsForWorkspace(workspace);
    });

    expect(updateThreadParent).toHaveBeenCalledWith(
      "parent-thread",
      ["child-thread"],
      expect.objectContaining({
        allowReparent: true,
      }),
    );
  });

  it("preserves list state when requested", async () => {
    vi.mocked(listThreads).mockResolvedValue({
      result: {
        data: [],
        nextCursor: null,
      },
    });

    const { result, dispatch } = renderActions();

    await act(async () => {
      await result.current.listThreadsForWorkspace(workspace, {
        preserveState: true,
      });
    });

    expect(dispatch).not.toHaveBeenCalledWith({
      type: "setThreadListLoading",
      workspaceId: "ws-1",
      isLoading: true,
    });
  });

  it("requests created_at sorting when provided", async () => {
    vi.mocked(listThreads).mockResolvedValue({
      result: {
        data: [],
        nextCursor: null,
      },
    });

    const { result } = renderActions({ threadSortKey: "created_at" });

    await act(async () => {
      await result.current.listThreadsForWorkspace(workspace);
    });

    expect(listThreads).toHaveBeenCalledWith("ws-1", null, 100, "created_at");
  });

  it("ignores stale list responses when a newer sort request is in-flight", async () => {
    const first = createDeferred<Record<string, unknown>>();
    const second = createDeferred<Record<string, unknown>>();
    vi.mocked(listThreads)
      .mockReturnValueOnce(first.promise as Promise<any>)
      .mockReturnValueOnce(second.promise as Promise<any>);
    vi.mocked(getThreadTimestamp).mockReturnValue(0);

    const { result, dispatch } = renderActions({ threadSortKey: "updated_at" });

    let firstCall: Promise<void> | null = null;
    let secondCall: Promise<void> | null = null;
    await act(async () => {
      firstCall = result.current.listThreadsForWorkspace(workspace, {
        sortKey: "created_at",
      });
      secondCall = result.current.listThreadsForWorkspace(workspace, {
        sortKey: "updated_at",
      });
    });

    await act(async () => {
      second.resolve({
        result: {
          data: [{ id: "thread-new", cwd: "/tmp/codex", updated_at: 2000 }],
          nextCursor: null,
        },
      });
      await second.promise;
    });

    await act(async () => {
      first.resolve({
        result: {
          data: [{ id: "thread-old", cwd: "/tmp/codex", updated_at: 1000 }],
          nextCursor: null,
        },
      });
      await Promise.all([firstCall, secondCall]);
    });

    const setThreadsCalls = dispatch.mock.calls
      .map(([action]) => action)
      .filter((action) => action?.type === "setThreads");
    expect(setThreadsCalls).toHaveLength(1);
    expect(setThreadsCalls[0]).toMatchObject({
      type: "setThreads",
      workspaceId: "ws-1",
      sortKey: "updated_at",
      threads: [{ id: "thread-new" }],
    });
  });

  it("loads older threads when a cursor is available", async () => {
    vi.mocked(listThreads).mockResolvedValue({
      result: {
        data: [
          {
            id: "thread-2",
            cwd: "/tmp/codex",
            preview: "Older preview",
            updated_at: 4000,
          },
        ],
        nextCursor: null,
      },
    });
    vi.mocked(getThreadTimestamp).mockImplementation((thread) => {
      const value = (thread as Record<string, unknown>).updated_at as number;
      return value ?? 0;
    });

    const { result, dispatch } = renderActions({
      threadsByWorkspace: {
        "ws-1": [{ id: "thread-1", name: "Agent 1", updatedAt: 6000 }],
      },
      threadListCursorByWorkspace: { "ws-1": "cursor-1" },
    });

    await act(async () => {
      await result.current.loadOlderThreadsForWorkspace(workspace);
    });

    expect(dispatch).toHaveBeenCalledWith({
      type: "setThreadListPaging",
      workspaceId: "ws-1",
      isLoading: true,
    });
    expect(dispatch).toHaveBeenCalledWith({
      type: "setThreads",
      workspaceId: "ws-1",
      sortKey: "updated_at",
      threads: [
        { id: "thread-1", name: "Agent 1", updatedAt: 6000 },
        { id: "thread-2", name: "Older preview", updatedAt: 4000 },
      ],
    });
    expect(dispatch).toHaveBeenCalledWith({
      type: "setThreadListCursor",
      workspaceId: "ws-1",
      cursor: null,
    });
  });

  it("archives threads in batch and reports partial failure summary", async () => {
    vi.mocked(archiveThreads).mockResolvedValue({
      allSucceeded: false,
      okIds: ["thread-8"],
      failed: [{ threadId: "thread-9", error: "denied" }],
      total: 2,
    });
    const onDebug = vi.fn();
    const { result } = renderActions({ onDebug });

    let summary: ThreadArchiveBatchResult | undefined;
    await act(async () => {
      summary = await result.current.archiveThreads("ws-1", [
        "thread-8",
        "thread-9",
      ]);
    });

    expect(summary).toEqual({
      allSucceeded: false,
      okIds: ["thread-8"],
      failed: [{ threadId: "thread-9", error: "denied" }],
      total: 2,
    });
    expect(archiveThreads).toHaveBeenCalledWith("ws-1", [
      "thread-8",
      "thread-9",
    ]);
    expect(onDebug).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "error",
        label: "thread/archive batch",
        payload: expect.objectContaining({
          total: 2,
          failed: [{ threadId: "thread-9", error: "denied" }],
        }),
      }),
    );
  });

  it("reports transport errors and marks all targets failed", async () => {
    vi.mocked(archiveThreads).mockRejectedValue(new Error("nope"));
    const onDebug = vi.fn();
    const { result } = renderActions({ onDebug });

    let summary: ThreadArchiveBatchResult | undefined;
    await act(async () => {
      summary = await result.current.archiveThreads("ws-1", [
        "thread-9",
        "thread-10",
      ]);
    });

    expect(summary).toEqual({
      allSucceeded: false,
      okIds: [],
      failed: [
        { threadId: "thread-9", error: "nope" },
        { threadId: "thread-10", error: "nope" },
      ],
      total: 2,
    });
    expect(onDebug).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "error",
        label: "thread/archive batch error",
      }),
    );
  });

  it("keeps single-thread archive API via batch wrapper", async () => {
    vi.mocked(archiveThreads).mockResolvedValue({
      allSucceeded: true,
      okIds: ["thread-9"],
      failed: [],
      total: 1,
    });
    const { result } = renderActions();

    let ok = false;
    await act(async () => {
      ok = await result.current.archiveThread("ws-1", "thread-9");
    });

    expect(ok).toBeTruthy();
    expect(archiveThreads).toHaveBeenCalledWith("ws-1", ["thread-9"]);
  });

  it("falls back to single-thread archive when batch method is unsupported", async () => {
    vi.mocked(archiveThreads).mockRejectedValue(
      new Error("unsupported method"),
    );
    vi.mocked(archiveThread)
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error("denied"));
    const onDebug = vi.fn();
    const { result } = renderActions({ onDebug });

    let summary: ThreadArchiveBatchResult | undefined;
    await act(async () => {
      summary = await result.current.archiveThreads("ws-1", [
        "thread-21",
        "thread-22",
      ]);
    });

    expect(archiveThread).toHaveBeenCalledTimes(2);
    expect(archiveThread).toHaveBeenNthCalledWith(1, "ws-1", "thread-21");
    expect(archiveThread).toHaveBeenNthCalledWith(2, "ws-1", "thread-22");
    expect(summary).toEqual({
      allSucceeded: false,
      okIds: ["thread-21"],
      failed: [{ threadId: "thread-22", error: "denied" }],
      total: 2,
    });
    expect(onDebug).toHaveBeenCalledWith(
      expect.objectContaining({
        label: "thread/archive batch fallback",
      }),
    );
  });

  it("returns null for empty thread id params and skips service calls", async () => {
    const { result } = renderActions();

    await act(async () => {
      await expect(
        result.current.resumeThreadForWorkspace("ws-1", ""),
      ).resolves.toBeNull();
      await expect(
        result.current.forkThreadForWorkspace("ws-1", ""),
      ).resolves.toBeNull();
      await expect(
        result.current.refreshThread("ws-1", ""),
      ).resolves.toBeNull();
      await expect(
        result.current.loadOlderMessagesForThread("ws-1", ""),
      ).resolves.toBeNull();
    });

    expect(resumeThread).not.toHaveBeenCalled();
    expect(forkThread).not.toHaveBeenCalled();
  });

  it("handles missing workspace state when resetting/loading older threads", async () => {
    const { result, dispatch, loadedThreadsRef } = renderActions({
      loadedThreadsRef: { current: { "thread-stays": true } },
      threadsByWorkspace: {},
      activeThreadIdByWorkspace: {},
      threadListCursorByWorkspace: {},
    });

    act(() => {
      result.current.resetWorkspaceThreads("ws-missing");
    });
    await act(async () => {
      await result.current.loadOlderThreadsForWorkspace({
        ...workspace,
        id: "ws-missing",
      });
    });

    expect(loadedThreadsRef.current["thread-stays"]).toBeTruthy();
    expect(listThreads).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalledWith(
      expect.objectContaining({
        type: "setThreadListPaging",
        workspaceId: "ws-missing",
      }),
    );
  });

  it("returns empty success when archive batch params are empty after trim", async () => {
    const { result } = renderActions();

    let summary: ThreadArchiveBatchResult | undefined;
    await act(async () => {
      summary = await result.current.archiveThreads("ws-1", ["", " ", "\n"]);
    });

    expect(summary).toEqual({
      allSucceeded: true,
      okIds: [],
      failed: [],
      total: 0,
    });
    expect(archiveThreads).not.toHaveBeenCalled();
  });

  it("cleans up resume loading state after async reject", async () => {
    vi.mocked(resumeThread).mockRejectedValue(new Error("offline"));
    const onDebug = vi.fn();
    const { result, dispatch } = renderActions({ onDebug });

    let resumed: string | null = "seed";
    await act(async () => {
      resumed = await result.current.resumeThreadForWorkspace("ws-1", "thread-reject", true);
    });

    expect(resumed).toBeNull();
    expect(dispatch).toHaveBeenCalledWith({
      type: "setThreadResumeLoading",
      threadId: "thread-reject",
      isLoading: true,
    });
    expect(dispatch).toHaveBeenCalledWith({
      type: "setThreadResumeLoading",
      threadId: "thread-reject",
      isLoading: false,
    });
    expect(onDebug).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "error",
        label: "thread/resume error",
        payload: "offline",
      }),
    );
  });

  it("forces refresh resume even when thread is already marked as loaded", async () => {
    vi.mocked(resumeThread).mockResolvedValue({
      result: { thread: { id: "thread-loaded", updated_at: 5 } },
    });
    vi.mocked(buildItemsFromThread).mockReturnValue([]);
    vi.mocked(isReviewingFromThread).mockReturnValue(false);
    vi.mocked(getThreadTimestamp).mockReturnValue(5);

    const { result, loadedThreadsRef, replaceOnResumeRef } = renderActions({
      loadedThreadsRef: { current: { "thread-loaded": true } },
    });

    await act(async () => {
      await result.current.refreshThread("ws-1", "thread-loaded");
    });

    expect(resumeThread).toHaveBeenCalledWith("ws-1", "thread-loaded");
    expect(loadedThreadsRef.current["thread-loaded"]).toBeTruthy();
    expect(replaceOnResumeRef.current["thread-loaded"]).toBeFalsy();
  });

  it("rethrows startThread failures so upstream workflows can handle async failures", async () => {
    vi.mocked(startThread).mockRejectedValue(new Error("start failed"));
    const { result } = renderActions();

    await act(async () => {
      await expect(
        result.current.startThreadForWorkspace("ws-1"),
      ).rejects.toThrow("start failed");
    });
  });

  it("normalizes fallback archive failures for non-Error reject values", async () => {
    vi.mocked(archiveThreads).mockRejectedValue(
      new Error("method not found"),
    );
    vi.mocked(archiveThread)
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce("plain-failure");
    const { result } = renderActions();

    let summary: ThreadArchiveBatchResult | undefined;
    await act(async () => {
      summary = await result.current.archiveThreads("ws-1", [
        "thread-ok",
        "thread-bad",
      ]);
    });

    expect(summary).toEqual({
      allSucceeded: false,
      okIds: ["thread-ok"],
      failed: [{ threadId: "thread-bad", error: "plain-failure" }],
      total: 2,
    });
  });

  it("normalizes invalid archive batch payloads and fans out archive_failed defaults", async () => {
    vi.mocked(archiveThreads).mockResolvedValue({
      result: {
        okIds: ["thread-a", "thread-z", 42],
        failed: [
          null,
          { threadId: "thread-a", error: "ignored-because-ok" },
          { thread_id: "thread-b", error: "" },
          { threadId: "thread-z", error: "ignored-unknown-thread" },
        ],
      },
    } as unknown as ThreadArchiveBatchResult);

    const { result } = renderActions();

    let summary: ThreadArchiveBatchResult | undefined;
    await act(async () => {
      summary = await result.current.archiveThreads("ws-1", [
        "thread-a",
        "thread-b",
        "thread-c",
      ]);
    });

    expect(summary).toEqual({
      allSucceeded: false,
      okIds: ["thread-a"],
      failed: [
        { threadId: "thread-b", error: "archive_failed" },
        { threadId: "thread-c", error: "archive_failed" },
      ],
      total: 3,
    });
  });

  it("dedupes and trims archive ids before calling batch service", async () => {
    vi.mocked(archiveThreads).mockResolvedValue({
      result: { okIds: ["thread-a", "thread-b"], failed: [] },
    } as unknown as ThreadArchiveBatchResult);

    const { result } = renderActions();

    await act(async () => {
      await result.current.archiveThreads("ws-1", [
        "thread-a",
        " thread-a ",
        "thread-b",
        " ",
      ]);
    });

    expect(archiveThreads).toHaveBeenCalledWith("ws-1", ["thread-a", "thread-b"]);
  });

  it("falls back to single-thread archive on threadIds mismatch payload errors", async () => {
    vi.mocked(archiveThreads).mockRejectedValue(
      new Error("Invalid payload: threadIds missing"),
    );
    vi.mocked(archiveThread).mockResolvedValue({});
    const { result } = renderActions();

    let summary: ThreadArchiveBatchResult | undefined;
    await act(async () => {
      summary = await result.current.archiveThreads("ws-1", ["thread-a", "thread-b"]);
    });

    expect(archiveThread).toHaveBeenCalledTimes(2);
    expect(summary).toEqual({
      allSucceeded: true,
      okIds: ["thread-a", "thread-b"],
      failed: [],
      total: 2,
    });
  });

  it("keeps no-op behavior when loading older threads only returns existing ids", async () => {
    vi.mocked(listThreads).mockResolvedValue({
      result: {
        data: [{ id: "thread-1", cwd: "/tmp/codex", preview: "Existing", updated_at: 12 }],
        nextCursor: null,
      },
    });
    vi.mocked(getThreadTimestamp).mockReturnValue(12);

    const { result, dispatch } = renderActions({
      threadsByWorkspace: {
        "ws-1": [{ id: "thread-1", name: "Agent 1", updatedAt: 12 }],
      },
      threadListCursorByWorkspace: { "ws-1": "cursor-older" },
    });

    await act(async () => {
      await result.current.loadOlderThreadsForWorkspace(workspace);
    });

    expect(dispatch).not.toHaveBeenCalledWith(
      expect.objectContaining({
        type: "setThreads",
        workspaceId: "ws-1",
      }),
    );
    expect(dispatch).toHaveBeenCalledWith({
      type: "setThreadListCursor",
      workspaceId: "ws-1",
      cursor: null,
    });
  });

  it("fans out non-fallback archive errors to all normalized thread ids", async () => {
    vi.mocked(archiveThreads).mockRejectedValue("gateway-down");

    const { result } = renderActions();

    let summary: ThreadArchiveBatchResult | undefined;
    await act(async () => {
      summary = await result.current.archiveThreads("ws-1", [
        "thread-a",
        " thread-a ",
        "thread-b",
      ]);
    });

    expect(summary).toEqual({
      allSucceeded: false,
      okIds: [],
      failed: [
        { threadId: "thread-a", error: "gateway-down" },
        { threadId: "thread-b", error: "gateway-down" },
      ],
      total: 2,
    });
  });

  it("refreshThread forces remote replacement and clears replace marker", async () => {
    const localItem: ConversationItem = {
      id: "local-1",
      kind: "message",
      role: "assistant",
      text: "Local",
    };
    const remoteItem: ConversationItem = {
      id: "remote-1",
      kind: "message",
      role: "assistant",
      text: "Remote replacement",
    };
    vi.mocked(resumeThread).mockResolvedValue({
      result: { thread: { id: "thread-r", preview: "Remote", updated_at: 21 } },
    });
    vi.mocked(buildItemsFromThread).mockReturnValue([remoteItem]);
    vi.mocked(isReviewingFromThread).mockReturnValue(false);
    vi.mocked(getThreadTimestamp).mockReturnValue(21);

    const { result, dispatch, replaceOnResumeRef } = renderActions({
      itemsByThread: { "thread-r": [localItem] },
      loadedThreadsRef: { current: { "thread-r": true } },
    });

    await act(async () => {
      await result.current.refreshThread("ws-1", "thread-r");
    });

    expect(dispatch).toHaveBeenCalledWith({
      type: "setThreadItems",
      threadId: "thread-r",
      items: [remoteItem],
    });
    expect(replaceOnResumeRef.current["thread-r"]).toBeFalsy();
  });

  it("resetWorkspaceThreads clears loaded flags for listed and active threads", () => {
    const loadedThreadsRef = {
      current: { "thread-1": true, "thread-2": true, "thread-other": true },
    };
    const { result } = renderActions({
      loadedThreadsRef,
      threadsByWorkspace: {
        "ws-1": [{ id: "thread-1", name: "Agent 1", updatedAt: 1 }],
      },
      activeThreadIdByWorkspace: { "ws-1": "thread-2" },
    });

    act(() => {
      result.current.resetWorkspaceThreads("ws-1");
    });

    expect(loadedThreadsRef.current["thread-1"]).toBeFalsy();
    expect(loadedThreadsRef.current["thread-2"]).toBeFalsy();
    expect(loadedThreadsRef.current["thread-other"]).toBeTruthy();
  });

  it("handles older-thread list errors with debug logging and paging cleanup", async () => {
    vi.mocked(listThreads).mockRejectedValue(new Error("older-list-failed"));
    const onDebug = vi.fn();
    const { result, dispatch } = renderActions({
      onDebug,
      threadListCursorByWorkspace: { "ws-1": "cursor-older" },
    });

    await act(async () => {
      await result.current.loadOlderThreadsForWorkspace(workspace);
    });

    expect(onDebug).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "error",
        label: "thread/list older error",
        payload: "older-list-failed",
      }),
    );
    expect(dispatch).toHaveBeenCalledWith({
      type: "setThreadListPaging",
      workspaceId: "ws-1",
      isLoading: false,
    });
  });

  it("supports startThread responses that return thread at top-level payload", async () => {
    vi.mocked(startThread).mockResolvedValue({
      thread: { id: "thread-direct" },
    });

    const { result, dispatch } = renderActions();

    await act(async () => {
      await result.current.startThreadForWorkspace("ws-1");
    });

    expect(dispatch).toHaveBeenCalledWith({
      type: "ensureThread",
      workspaceId: "ws-1",
      threadId: "thread-direct",
    });
    expect(dispatch).toHaveBeenCalledWith({
      type: "setActiveThreadId",
      workspaceId: "ws-1",
      threadId: "thread-direct",
    });
  });

  it("returns null when startThread response has no thread id", async () => {
    vi.mocked(startThread).mockResolvedValue({
      result: { thread: {} },
    });
    const { result, dispatch } = renderActions();

    let threadId: string | null = "seed";
    await act(async () => {
      threadId = await result.current.startThreadForWorkspace("ws-1");
    });

    expect(threadId).toBeNull();
    expect(dispatch).not.toHaveBeenCalledWith(
      expect.objectContaining({
        type: "ensureThread",
        workspaceId: "ws-1",
      }),
    );
  });

  it("returns null when fork response has no thread id and skips resume", async () => {
    vi.mocked(forkThread).mockResolvedValue({
      result: { thread: {} },
    });
    const { result } = renderActions();

    let threadId: string | null = "seed";
    await act(async () => {
      threadId = await result.current.forkThreadForWorkspace("ws-1", "thread-base");
    });

    expect(threadId).toBeNull();
    expect(resumeThread).not.toHaveBeenCalled();
  });

  it("returns null and logs fork failures", async () => {
    vi.mocked(forkThread).mockRejectedValue(new Error("fork failed"));
    const onDebug = vi.fn();
    const { result } = renderActions({ onDebug });

    let threadId: string | null = "seed";
    await act(async () => {
      threadId = await result.current.forkThreadForWorkspace("ws-1", "thread-base");
    });

    expect(threadId).toBeNull();
    expect(onDebug).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "error",
        label: "thread/fork error",
        payload: "fork failed",
      }),
    );
  });

  it("logs non-Error fork failures as strings", async () => {
    vi.mocked(forkThread).mockRejectedValue("fork down");
    const onDebug = vi.fn();
    const { result } = renderActions({ onDebug });

    let threadId: string | null = "seed";
    await act(async () => {
      threadId = await result.current.forkThreadForWorkspace("ws-1", "thread-base");
    });

    expect(threadId).toBeNull();
    expect(onDebug).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "error",
        label: "thread/fork error",
        payload: "fork down",
      }),
    );
  });

  it("uses persisted name, server name, preview truncation, and agent fallback in list summaries", async () => {
    vi.mocked(listThreads).mockResolvedValue({
      result: {
        data: [
          {
            id: "persisted",
            cwd: "/tmp/codex",
            updated_at: 400,
            preview: "ignored because persisted name wins",
          },
          {
            id: "server-name",
            cwd: "/tmp/codex",
            updated_at: 300,
            thread_name: "Server Thread Name",
          },
          {
            id: "preview-long",
            cwd: "/tmp/codex",
            updated_at: 200,
            preview: "1234567890123456789012345678901234567890X",
          },
          {
            id: "fallback-agent",
            cwd: "/tmp/codex",
            updated_at: 100,
          },
        ],
        nextCursor: null,
      },
    });
    vi.mocked(getThreadTimestamp).mockImplementation((thread) => {
      const value = (thread as Record<string, unknown>).updated_at as number;
      return value ?? 0;
    });
    vi.mocked(getThreadCreatedTimestamp).mockImplementation((thread) => {
      const value = (thread as Record<string, unknown>).updated_at as number;
      return value ?? 0;
    });

    const { result, dispatch } = renderActions({
      threadSortKey: "created_at",
      getPersistedThreadDisplayName: (_workspaceId, threadId) =>
        threadId === "persisted" ? "Persisted Name" : undefined,
    });

    await act(async () => {
      await result.current.listThreadsForWorkspace(workspace);
    });

    expect(dispatch).toHaveBeenCalledWith({
      type: "setThreads",
      workspaceId: "ws-1",
      sortKey: "created_at",
      threads: [
        { id: "persisted", name: "Persisted Name", updatedAt: 400 },
        { id: "server-name", name: "Server Thread Name", updatedAt: 300 },
        { id: "preview-long", name: "12345678901234567890123456789012345678…", updatedAt: 200 },
        { id: "fallback-agent", name: "Agent 4", updatedAt: 100 },
      ],
    });
  });

  it("stops list pagination after max pages without activity when no matches are found", async () => {
    vi.mocked(listThreads).mockResolvedValue({
      result: {
        data: [{ id: "remote", cwd: "/different", updated_at: 1 }],
        nextCursor: "next",
      },
    });
    vi.mocked(getThreadTimestamp).mockReturnValue(1);
    const { result, dispatch } = renderActions({
      threadActivityRef: { current: { "ws-1": {} } },
    });

    await act(async () => {
      await result.current.listThreadsForWorkspace(workspace);
    });

    expect(listThreads).toHaveBeenCalledTimes(3);
    expect(dispatch).toHaveBeenCalledWith({
      type: "setThreads",
      workspaceId: "ws-1",
      sortKey: "updated_at",
      threads: [],
    });
  });

  it("stops older-thread pagination after max pages without matches", async () => {
    vi.mocked(listThreads).mockResolvedValue({
      result: {
        data: [{ id: "remote", cwd: "/different", updated_at: 1 }],
        nextCursor: "next",
      },
    });
    vi.mocked(getThreadTimestamp).mockReturnValue(1);
    const { result, dispatch } = renderActions({
      threadListCursorByWorkspace: { "ws-1": "cursor-1" },
    });

    await act(async () => {
      await result.current.loadOlderThreadsForWorkspace(workspace);
    });

    expect(listThreads).toHaveBeenCalledTimes(6);
    expect(dispatch).toHaveBeenCalledWith({
      type: "setThreadListCursor",
      workspaceId: "ws-1",
      cursor: "next",
    });
  });

  it("stops older-thread pagination at hard max pages even when matches keep arriving", async () => {
    vi.mocked(listThreads).mockResolvedValue({
      result: {
        data: [{ id: "thread-1", cwd: "/tmp/codex", preview: "existing", updated_at: 12 }],
        nextCursor: "next",
      },
    });
    vi.mocked(getThreadTimestamp).mockReturnValue(12);

    const { result, dispatch } = renderActions({
      threadListCursorByWorkspace: { "ws-1": "cursor-1" },
      threadsByWorkspace: {
        "ws-1": [{ id: "thread-1", name: "Existing", updatedAt: 12 }],
      },
    });

    await act(async () => {
      await result.current.loadOlderThreadsForWorkspace(workspace);
    });

    expect(listThreads).toHaveBeenCalledTimes(6);
    expect(dispatch).toHaveBeenCalledWith({
      type: "setThreadListCursor",
      workspaceId: "ws-1",
      cursor: "next",
    });
    expect(dispatch).not.toHaveBeenCalledWith(
      expect.objectContaining({
        type: "setThreads",
        workspaceId: "ws-1",
      }),
    );
  });

  it("normalizes malformed older-thread payloads into no-op updates", async () => {
    vi.mocked(listThreads).mockResolvedValue({
      result: {
        data: { not: "array" },
        next_cursor: null,
      },
    } as unknown as Record<string, unknown>);

    const { result, dispatch } = renderActions({
      threadListCursorByWorkspace: { "ws-1": "cursor-1" },
      threadsByWorkspace: {
        "ws-1": [{ id: "thread-existing", name: "Existing", updatedAt: 30 }],
      },
    });

    await act(async () => {
      await result.current.loadOlderThreadsForWorkspace(workspace);
    });

    expect(dispatch).toHaveBeenCalledWith({
      type: "setThreadListCursor",
      workspaceId: "ws-1",
      cursor: null,
    });
    expect(dispatch).not.toHaveBeenCalledWith(
      expect.objectContaining({
        type: "setThreads",
        workspaceId: "ws-1",
      }),
    );
    expect(dispatch).not.toHaveBeenCalledWith(
      expect.objectContaining({
        type: "setLastAgentMessagesBulk",
      }),
    );
  });

  it("logs list errors for non-Error values", async () => {
    vi.mocked(listThreads).mockRejectedValue("list exploded");
    const onDebug = vi.fn();
    const { result } = renderActions({ onDebug });

    await act(async () => {
      await result.current.listThreadsForWorkspace(workspace);
    });

    expect(onDebug).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "error",
        label: "thread/list error",
        payload: "list exploded",
      }),
    );
  });

  it("returns thread id and marks loaded when resume payload has no thread body", async () => {
    vi.mocked(resumeThread).mockResolvedValue({
      result: {},
    });

    const loadedThreadsRef = { current: {} as Record<string, boolean> };
    const { result, dispatch } = renderActions({
      loadedThreadsRef,
    });

    let resumed: string | null = null;
    await act(async () => {
      resumed = await result.current.resumeThreadForWorkspace("ws-1", "thread-missing", true);
    });

    expect(resumed).toBe("thread-missing");
    expect(loadedThreadsRef.current["thread-missing"]).toBeTruthy();
    expect(dispatch).not.toHaveBeenCalledWith(
      expect.objectContaining({
        type: "ensureThread",
        threadId: "thread-missing",
      }),
    );
  });

  it("hydrates active turn id from snake_case turn fields and skips invalid turn entries", async () => {
    vi.mocked(resumeThread).mockResolvedValue({
      result: {
        thread: {
          id: "thread-4",
          turns: [
            null,
            { status: "pending" },
            { turn_status: "in_progress", turn_id: "turn-snake" },
          ],
        },
      },
    });
    vi.mocked(buildItemsFromThread).mockReturnValue([]);
    vi.mocked(isReviewingFromThread).mockReturnValue(false);

    const { result, dispatch } = renderActions();

    await act(async () => {
      await result.current.resumeThreadForWorkspace("ws-1", "thread-4", true);
    });

    expect(dispatch).toHaveBeenCalledWith({
      type: "setActiveTurnId",
      threadId: "thread-4",
      turnId: "turn-snake",
    });
  });

  it("records list activity with fallback timestamps and emits server debug events", async () => {
    vi.mocked(listThreads).mockResolvedValue({
      result: {
        data: [
          {
            id: "child-thread",
            cwd: "/tmp/codex",
            preview: "Child",
            updated_at: 0,
            source: {
              sub_agent: {
                thread_spawn: {
                  parent_thread_id: "parent-thread",
                  depth: 1,
                },
              },
            },
          },
        ],
        next_cursor: null,
      },
    });
    vi.mocked(getThreadTimestamp).mockReturnValue(0);
    vi.mocked(getThreadCreatedTimestamp).mockReturnValue(0);
    const onDebug = vi.fn();
    const markSubAgentThread = vi.fn();
    const recordThreadCreatedAt = vi.fn();

    const { result, updateThreadParent } = renderActions({
      onDebug,
      markSubAgentThread,
      recordThreadCreatedAt,
    });

    await act(async () => {
      await result.current.listThreadsForWorkspace(workspace);
    });

    expect(updateThreadParent).toHaveBeenCalledWith(
      "parent-thread",
      ["child-thread"],
      expect.objectContaining({
        allowReparent: true,
        ordering: expect.objectContaining({ timestamp: expect.any(Number) }),
      }),
    );
    expect(markSubAgentThread).toHaveBeenCalledWith("child-thread");
    expect(recordThreadCreatedAt).toHaveBeenCalledWith(
      "child-thread",
      0,
      expect.any(Number),
    );
    expect(onDebug).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "server",
        label: "thread/list response",
      }),
    );
  });

  it("skips stale older-thread request dispatches when a newer paging request wins", async () => {
    const first = createDeferred<Record<string, unknown>>();
    const second = createDeferred<Record<string, unknown>>();
    vi.mocked(listThreads)
      .mockReturnValueOnce(first.promise as Promise<any>)
      .mockReturnValueOnce(second.promise as Promise<any>);
    vi.mocked(getThreadTimestamp).mockReturnValue(1);

    const { result, dispatch } = renderActions({
      threadListCursorByWorkspace: { "ws-1": "cursor-1" },
      threadsByWorkspace: {
        "ws-1": [{ id: "existing", name: "Existing", updatedAt: 10 }],
      },
    });

    let firstCall: Promise<void> | null = null;
    let secondCall: Promise<void> | null = null;
    await act(async () => {
      firstCall = result.current.loadOlderThreadsForWorkspace(workspace);
      secondCall = result.current.loadOlderThreadsForWorkspace(workspace);
    });

    await act(async () => {
      second.resolve({
        result: {
          data: [{ id: "newer", cwd: "/tmp/codex", preview: "Newer", updated_at: 20 }],
          nextCursor: null,
        },
      });
      await second.promise;
    });

    await act(async () => {
      first.resolve({
        result: {
          data: [{ id: "older", cwd: "/tmp/codex", preview: "Older", updated_at: 5 }],
          nextCursor: null,
        },
      });
      await Promise.all([firstCall, secondCall]);
    });

    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "setThreads",
        workspaceId: "ws-1",
        threads: expect.arrayContaining([expect.objectContaining({ id: "newer" })]),
      }),
    );
    expect(dispatch).not.toHaveBeenCalledWith(
      expect.objectContaining({
        type: "setThreads",
        workspaceId: "ws-1",
        threads: expect.arrayContaining([expect.objectContaining({ id: "older" })]),
      }),
    );
  });

  it("emits older-thread last-agent bulk updates only for non-empty previews", async () => {
    vi.mocked(listThreads).mockResolvedValue({
      result: {
        data: [
          { id: "thread-1", cwd: "/tmp/codex", preview: "  ", updated_at: 12 },
          { id: "thread-2", cwd: "/tmp/codex", preview: "Older preview", updated_at: 11 },
        ],
        nextCursor: null,
      },
    });
    vi.mocked(getThreadTimestamp).mockImplementation((thread) => {
      const value = (thread as Record<string, unknown>).updated_at as number;
      return value ?? 0;
    });

    const { result, dispatch } = renderActions({
      threadListCursorByWorkspace: { "ws-1": "cursor-older" },
      threadsByWorkspace: {
        "ws-1": [
          { id: "thread-1", name: "Thread 1", updatedAt: 12 },
          { id: "thread-2", name: "Thread 2", updatedAt: 11 },
        ],
      },
    });

    await act(async () => {
      await result.current.loadOlderThreadsForWorkspace(workspace);
    });

    expect(dispatch).not.toHaveBeenCalledWith({
      type: "setLastAgentMessagesBulk",
      updates: expect.arrayContaining([
        expect.objectContaining({ threadId: "thread-1" }),
      ]),
    });
    expect(dispatch).toHaveBeenCalledWith({
      type: "setLastAgentMessagesBulk",
      updates: [{ threadId: "thread-2", text: "Older preview", timestamp: 11 }],
    });
  });

  it("ignores stale older-thread last-agent bulk updates when a newer paging request wins", async () => {
    const first = createDeferred<Record<string, unknown>>();
    const second = createDeferred<Record<string, unknown>>();
    vi.mocked(listThreads)
      .mockReturnValueOnce(first.promise as Promise<any>)
      .mockReturnValueOnce(second.promise as Promise<any>);
    vi.mocked(getThreadTimestamp).mockImplementation((thread) => {
      const value = (thread as Record<string, unknown>).updated_at as number;
      return value ?? 0;
    });

    const { result, dispatch } = renderActions({
      threadListCursorByWorkspace: { "ws-1": "cursor-1" },
      threadsByWorkspace: {
        "ws-1": [{ id: "thread-existing", name: "Existing", updatedAt: 30 }],
      },
    });

    let firstCall: Promise<void> | null = null;
    let secondCall: Promise<void> | null = null;
    await act(async () => {
      firstCall = result.current.loadOlderThreadsForWorkspace(workspace);
      secondCall = result.current.loadOlderThreadsForWorkspace(workspace);
    });

    await act(async () => {
      second.resolve({
        result: {
          data: [{ id: "thread-existing", cwd: "/tmp/codex", preview: "new-preview", updated_at: 30 }],
          nextCursor: null,
        },
      });
      await second.promise;
    });

    await act(async () => {
      first.resolve({
        result: {
          data: [{ id: "thread-existing", cwd: "/tmp/codex", preview: "old-preview", updated_at: 30 }],
          nextCursor: null,
        },
      });
      await Promise.all([firstCall, secondCall]);
    });

    expect(dispatch).toHaveBeenCalledWith({
      type: "setLastAgentMessagesBulk",
      updates: [{ threadId: "thread-existing", text: "new-preview", timestamp: 30 }],
    });
    expect(dispatch).not.toHaveBeenCalledWith({
      type: "setLastAgentMessagesBulk",
      updates: [{ threadId: "thread-existing", text: "old-preview", timestamp: 30 }],
    });
  });

  it("marks archive batch debug source as server when all targets succeed", async () => {
    vi.mocked(archiveThreads).mockResolvedValue({
      result: { okIds: ["thread-1", "thread-2"], failed: [] },
    } as unknown as ThreadArchiveBatchResult);
    const onDebug = vi.fn();
    const { result } = renderActions({ onDebug });

    await act(async () => {
      await result.current.archiveThreads("ws-1", ["thread-1", "thread-2"]);
    });

    expect(onDebug).toHaveBeenCalledWith(
      expect.objectContaining({
        label: "thread/archive batch",
        source: "server",
        payload: expect.objectContaining({ allSucceeded: true }),
      }),
    );
  });

  it("marks fallback archive debug source as server when single-archive fallback fully succeeds", async () => {
    vi.mocked(archiveThreads).mockRejectedValue(new Error("unknown method"));
    vi.mocked(archiveThread).mockResolvedValue({});
    const onDebug = vi.fn();
    const { result } = renderActions({ onDebug });

    await act(async () => {
      await result.current.archiveThreads("ws-1", ["thread-a", "thread-b"]);
    });

    expect(onDebug).toHaveBeenCalledWith(
      expect.objectContaining({
        label: "thread/archive batch fallback",
        source: "server",
        payload: expect.objectContaining({ allSucceeded: true }),
      }),
    );
  });

  it("hydrates active turn id from running status with camel turnId field", async () => {
    vi.mocked(resumeThread).mockResolvedValue({
      result: {
        thread: {
          id: "thread-running",
          turns: [{ status: "running", turnId: "turn-running" }],
        },
      },
    });
    vi.mocked(buildItemsFromThread).mockReturnValue([]);
    vi.mocked(isReviewingFromThread).mockReturnValue(false);

    const { result, dispatch } = renderActions();

    await act(async () => {
      await result.current.resumeThreadForWorkspace("ws-1", "thread-running", true);
    });

    expect(dispatch).toHaveBeenCalledWith({
      type: "markProcessing",
      threadId: "thread-running",
      isProcessing: true,
      timestamp: expect.any(Number),
    });
    expect(dispatch).toHaveBeenCalledWith({
      type: "setActiveTurnId",
      threadId: "thread-running",
      turnId: "turn-running",
    });
  });

  it("hydrates active turn id from started status with snake_case turn_id field", async () => {
    vi.mocked(resumeThread).mockResolvedValue({
      result: {
        thread: {
          id: "thread-started",
          turns: [{ status: "started", turn_id: "turn-started" }],
        },
      },
    });
    vi.mocked(buildItemsFromThread).mockReturnValue([]);
    vi.mocked(isReviewingFromThread).mockReturnValue(false);

    const { result, dispatch } = renderActions();

    await act(async () => {
      await result.current.resumeThreadForWorkspace("ws-1", "thread-started", true);
    });

    expect(dispatch).toHaveBeenCalledWith({
      type: "setActiveTurnId",
      threadId: "thread-started",
      turnId: "turn-started",
    });
  });

  it("rethrows non-Error start failures and logs normalized payloads", async () => {
    vi.mocked(startThread).mockRejectedValueOnce("start down");
    const onDebug = vi.fn();
    const { result } = renderActions({ onDebug });

    let thrown: unknown = null;
    await act(async () => {
      try {
        await result.current.startThreadForWorkspace("ws-1");
      } catch (error) {
        thrown = error;
      }
    });

    expect(thrown).toBe("start down");
    expect(onDebug).toHaveBeenCalledWith(
      expect.objectContaining({
        label: "thread/start error",
        payload: "start down",
      }),
    );
  });

  it("returns null for non-Error resume failures and logs normalized payloads", async () => {
    vi.mocked(resumeThread).mockRejectedValueOnce("resume down");
    const onDebug = vi.fn();
    const { result } = renderActions({ onDebug });

    let resumed: string | null = "placeholder";
    await act(async () => {
      resumed = await result.current.resumeThreadForWorkspace("ws-1", "thread-resume", true);
    });

    expect(resumed).toBeNull();
    expect(onDebug).toHaveBeenCalledWith(
      expect.objectContaining({
        label: "thread/resume error",
        payload: "resume down",
      }),
    );
  });

  it("emits server debug payload when thread/start succeeds", async () => {
    vi.mocked(startThread).mockResolvedValue({
      result: { thread: { id: "thread-debug-start" } },
    });
    const onDebug = vi.fn();
    const { result } = renderActions({ onDebug });

    await act(async () => {
      await result.current.startThreadForWorkspace("ws-1");
    });

    expect(onDebug).toHaveBeenCalledWith(
      expect.objectContaining({ label: "thread/start response", source: "server" }),
    );
  });

  it("emits server debug payload when thread/fork succeeds", async () => {
    vi.mocked(forkThread).mockResolvedValue({
      result: { thread: { id: "thread-debug-fork" } },
    });
    vi.mocked(resumeThread).mockResolvedValue({
      result: { thread: { id: "thread-debug-fork", updated_at: 1 } },
    });
    vi.mocked(buildItemsFromThread).mockReturnValue([]);
    vi.mocked(isReviewingFromThread).mockReturnValue(false);
    const onDebug = vi.fn();
    const { result } = renderActions({ onDebug });

    await act(async () => {
      await result.current.forkThreadForWorkspace("ws-1", "thread-source");
    });

    expect(onDebug).toHaveBeenCalledWith(
      expect.objectContaining({ label: "thread/fork response", source: "server" }),
    );
  });

  it("emits older-list debug response and restores parent metadata for older pages", async () => {
    vi.mocked(listThreads).mockResolvedValue({
      result: {
        data: [
          {
            id: "thread-older",
            cwd: "/tmp/codex",
            preview: "Older",
            updated_at: 0,
            source: {
              sub_agent: {
                threadSpawn: {
                  parentThreadId: "parent-thread",
                  depth: 1,
                },
              },
            },
          },
        ],
        nextCursor: null,
      },
    });
    vi.mocked(getThreadTimestamp).mockReturnValue(0);
    vi.mocked(getThreadCreatedTimestamp).mockReturnValue(42);
    const onDebug = vi.fn();
    const markSubAgentThread = vi.fn();
    const recordThreadCreatedAt = vi.fn();
    const { result, updateThreadParent } = renderActions({
      onDebug,
      markSubAgentThread,
      recordThreadCreatedAt,
      threadListCursorByWorkspace: { "ws-1": "cursor-1" },
      threadsByWorkspace: {
        "ws-1": [{ id: "thread-existing", name: "Existing", updatedAt: 10 }],
      },
    });

    await act(async () => {
      await result.current.loadOlderThreadsForWorkspace(workspace);
    });

    expect(onDebug).toHaveBeenCalledWith(
      expect.objectContaining({ label: "thread/list older response", source: "server" }),
    );
    expect(updateThreadParent).toHaveBeenCalledWith(
      "parent-thread",
      ["thread-older"],
      expect.objectContaining({ allowReparent: true }),
    );
    expect(markSubAgentThread).toHaveBeenCalledWith("thread-older");
    expect(recordThreadCreatedAt).toHaveBeenCalledWith("thread-older", 42, expect.any(Number));
  });

  it("normalizes bare thread/list payloads with next_cursor and malformed data", async () => {
    vi.mocked(listThreads).mockResolvedValue({
      data: {
        id: "not-an-array",
      },
      next_cursor: "cursor-snake",
    } as unknown as Record<string, unknown>);

    const { result, dispatch } = renderActions();

    await act(async () => {
      await result.current.listThreadsForWorkspace(workspace);
    });

    expect(dispatch).toHaveBeenCalledWith({
      type: "setThreads",
      workspaceId: "ws-1",
      sortKey: "updated_at",
      threads: [],
    });
    expect(dispatch).toHaveBeenCalledWith({
      type: "setThreadListCursor",
      workspaceId: "ws-1",
      cursor: "cursor-snake",
    });
  });

  it("falls back to single archive flow when threadIds validation error is returned", async () => {
    vi.mocked(archiveThreads).mockRejectedValue(
      new Error("threadIds missing from request payload"),
    );
    vi.mocked(archiveThread)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce("single-archive-failed");

    const { result } = renderActions();

    let summary: ThreadArchiveBatchResult | null = null;
    await act(async () => {
      summary = await result.current.archiveThreads("ws-1", ["thread-a", "thread-b"]);
    });

    expect(archiveThread).toHaveBeenCalledTimes(2);
    expect(summary).toEqual({
      allSucceeded: false,
      okIds: ["thread-a"],
      failed: [{ threadId: "thread-b", error: "single-archive-failed" }],
      total: 2,
    });
  });

  it("extracts thread id when thread/start response does not include result wrapper", async () => {
    vi.mocked(startThread).mockResolvedValue({
      thread: { id: "thread-direct" },
    } as unknown as { result: { thread: { id: string } } });

    const { result, dispatch } = renderActions();

    let threadId: string | null = null;
    await act(async () => {
      threadId = await result.current.startThreadForWorkspace("ws-1");
    });

    expect(threadId).toBe("thread-direct");
    expect(dispatch).toHaveBeenCalledWith({
      type: "ensureThread",
      workspaceId: "ws-1",
      threadId: "thread-direct",
    });
  });

  it("extracts thread id when thread/fork response does not include result wrapper", async () => {
    vi.mocked(forkThread).mockResolvedValue({
      thread: { id: "thread-fork-direct" },
    } as unknown as { result: { thread: { id: string } } });
    vi.mocked(resumeThread).mockResolvedValue({
      result: { thread: { id: "thread-fork-direct", updated_at: 1 } },
    });
    vi.mocked(buildItemsFromThread).mockReturnValue([]);
    vi.mocked(isReviewingFromThread).mockReturnValue(false);

    const { result } = renderActions();

    let threadId: string | null = null;
    await act(async () => {
      threadId = await result.current.forkThreadForWorkspace("ws-1", "thread-1");
    });

    expect(threadId).toBe("thread-fork-direct");
    expect(forkThread).toHaveBeenCalledWith("ws-1", "thread-1");
  });

  it("returns null when thread/start response does not include a thread id", async () => {
    vi.mocked(startThread).mockResolvedValue({
      result: {},
    } as unknown as { result: { thread: { id: string } } });

    const { result, dispatch } = renderActions();

    let threadId: string | null = null;
    await act(async () => {
      threadId = await result.current.startThreadForWorkspace("ws-1");
    });

    expect(threadId).toBeNull();
    expect(dispatch).not.toHaveBeenCalledWith(
      expect.objectContaining({
        type: "ensureThread",
      }),
    );
  });

  it("hydrates active turn from turn_status and turn_id aliases", async () => {
    vi.mocked(resumeThread).mockResolvedValue({
      result: {
        thread: {
          id: "thread-aliased-turn",
          turns: [
            null,
            { turn_status: "in-progress", turn_id: "turn-alias" },
          ],
        },
      },
    });
    vi.mocked(buildItemsFromThread).mockReturnValue([]);
    vi.mocked(isReviewingFromThread).mockReturnValue(false);

    const { result, dispatch } = renderActions();

    await act(async () => {
      await result.current.resumeThreadForWorkspace("ws-1", "thread-aliased-turn", true);
    });

    expect(dispatch).toHaveBeenCalledWith({
      type: "markProcessing",
      threadId: "thread-aliased-turn",
      isProcessing: true,
      timestamp: expect.any(Number),
    });
    expect(dispatch).toHaveBeenCalledWith({
      type: "setActiveTurnId",
      threadId: "thread-aliased-turn",
      turnId: "turn-alias",
    });
  });

  it("falls back to generated Agent name when list entry has no display fields", async () => {
    vi.mocked(listThreads).mockResolvedValue({
      result: {
        data: [
          {
            id: "thread-no-name",
            cwd: "/tmp/codex",
            name: "   ",
            thread_name: "",
            preview: "   ",
            updated_at: 50,
          },
        ],
        nextCursor: null,
      },
    });
    vi.mocked(getThreadTimestamp).mockReturnValue(50);

    const { result, dispatch } = renderActions();

    await act(async () => {
      await result.current.listThreadsForWorkspace(workspace);
    });

    expect(dispatch).toHaveBeenCalledWith({
      type: "setThreads",
      workspaceId: "ws-1",
      sortKey: "updated_at",
      threads: [{ id: "thread-no-name", name: "Agent 1", updatedAt: 50 }],
    });
  });
});
