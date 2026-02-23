import { describe, expect, it } from "vitest";
import { computeAppBadgeCount } from "./useAppBadgeCount";
import type { ApprovalRequest, RequestUserInputRequest, ThreadSummary } from "../../../types";

describe("computeAppBadgeCount", () => {
  it.each(["approval", "user_input", "tool_wait", "retry"] as const)(
    "does not count completed thread when waitReason=%s",
    (waitReason) => {
      const threadsByWorkspace: Record<string, ThreadSummary[]> = {
        "ws-1": [{ id: "thread-1", name: "Thread 1", updatedAt: 1 }],
      };

      const result = computeAppBadgeCount({
        threadStatusById: {
          "thread-1": { turnStatus: "completed", isProcessing: false, waitReason },
        },
        approvals: [],
        userInputRequests: [],
        isSubAgentThread: () => false,
        threadsByWorkspace,
      });

      expect(result).toBe(0);
    },
  );

  it("counts completed-idle threads and ignores in-progress threads", () => {
    const threadsByWorkspace: Record<string, ThreadSummary[]> = {
      "ws-1": [
        { id: "thread-1", name: "Thread 1", updatedAt: 1 },
        { id: "thread-2", name: "Thread 2", updatedAt: 2 },
      ],
    };

    const result = computeAppBadgeCount({
      threadStatusById: {
        "thread-1": { turnStatus: "completed", isProcessing: false, waitReason: "none" },
        "thread-2": { turnStatus: "inProgress", isProcessing: true, waitReason: "none" },
      },
      approvals: [],
      userInputRequests: [],
      isSubAgentThread: () => false,
      threadsByWorkspace,
    });

    expect(result).toBe(1);
  });

  it("excludes completed-idle sub-agent threads", () => {
    const threadsByWorkspace: Record<string, ThreadSummary[]> = {
      "ws-1": [{ id: "thread-sub", name: "Sub", updatedAt: 1 }],
    };

    const result = computeAppBadgeCount({
      threadStatusById: {
        "thread-sub": { turnStatus: "completed", isProcessing: false, waitReason: "none" },
      },
      approvals: [],
      userInputRequests: [],
      isSubAgentThread: (_workspaceId, threadId) => threadId === "thread-sub",
      threadsByWorkspace,
    });

    expect(result).toBe(0);
  });

  it("deduplicates completed-idle and response-required requests on the same thread", () => {
    const threadsByWorkspace: Record<string, ThreadSummary[]> = {
      "ws-1": [{ id: "thread-1", name: "Thread 1", updatedAt: 1 }],
    };
    const approvals: ApprovalRequest[] = [
      {
        workspace_id: "ws-1",
        request_id: 11,
        method: "approval/request",
        params: { thread_id: "thread-1" },
      },
    ];
    const userInputRequests: RequestUserInputRequest[] = [
      {
        workspace_id: "ws-1",
        request_id: 12,
        params: {
          thread_id: "thread-1",
          turn_id: "turn-1",
          item_id: "item-1",
          questions: [],
        },
      },
    ];

    const result = computeAppBadgeCount({
      threadStatusById: {
        "thread-1": { turnStatus: "completed", isProcessing: false, waitReason: "none" },
      },
      approvals,
      userInputRequests,
      isSubAgentThread: () => false,
      threadsByWorkspace,
    });

    expect(result).toBe(1);
  });

  it("keeps strict completed-idle gate and rejects near-miss statuses", () => {
    const threadsByWorkspace: Record<string, ThreadSummary[]> = {
      "ws-1": [
        { id: "count-me", name: "Count Me", updatedAt: 1 },
        { id: "processing", name: "Still Processing", updatedAt: 2 },
        { id: "not-completed", name: "Not Completed", updatedAt: 3 },
        { id: "waiting-approval", name: "Waiting Approval", updatedAt: 4 },
      ],
    };

    const result = computeAppBadgeCount({
      threadStatusById: {
        "count-me": { turnStatus: "completed", isProcessing: false, waitReason: "none" },
        processing: { turnStatus: "completed", isProcessing: true, waitReason: "none" },
        "not-completed": { turnStatus: "inProgress", isProcessing: false, waitReason: "none" },
        "waiting-approval": { turnStatus: "completed", isProcessing: false, waitReason: "approval" },
      },
      approvals: [],
      userInputRequests: [],
      isSubAgentThread: () => false,
      threadsByWorkspace,
    });

    expect(result).toBe(1);
  });

  it("counts response-required approvals without threadId via request key", () => {
    const approvals: ApprovalRequest[] = [
      {
        workspace_id: "ws-1",
        request_id: 201,
        method: "approval/request",
        params: {},
      },
      {
        workspace_id: "ws-1",
        request_id: 201,
        method: "approval/request",
        params: {},
      },
      {
        workspace_id: "ws-1",
        request_id: 202,
        method: "approval/request",
        params: {},
      },
    ];

    const result = computeAppBadgeCount({
      threadStatusById: {},
      approvals,
      userInputRequests: [],
      isSubAgentThread: () => false,
      threadsByWorkspace: {},
    });

    expect(result).toBe(2);
  });

  it("deduplicates no-thread requests by workspace+request_id across event streams", () => {
    const approvals: ApprovalRequest[] = [
      {
        workspace_id: "ws-1",
        request_id: 777,
        method: "approval/request",
        params: {},
      },
      {
        workspace_id: "ws-1",
        request_id: 777,
        method: "approval/request",
        params: {},
      },
    ];
    const userInputRequests: RequestUserInputRequest[] = [
      {
        workspace_id: "ws-1",
        request_id: 777,
        params: {
          thread_id: "",
          turn_id: "turn-1",
          item_id: "item-1",
          questions: [],
        },
      },
      {
        workspace_id: "ws-1",
        request_id: 888,
        params: {
          thread_id: "",
          turn_id: "turn-2",
          item_id: "item-2",
          questions: [],
        },
      },
      {
        workspace_id: "ws-2",
        request_id: 777,
        params: {
          thread_id: "",
          turn_id: "turn-3",
          item_id: "item-3",
          questions: [],
        },
      },
    ];

    const result = computeAppBadgeCount({
      threadStatusById: {},
      approvals,
      userInputRequests,
      isSubAgentThread: () => false,
      threadsByWorkspace: {},
    });

    expect(result).toBe(3);
  });

  it("counts only main-thread items when main/sub-agent threads are mixed", () => {
    const threadsByWorkspace: Record<string, ThreadSummary[]> = {
      "ws-1": [
        { id: "main-thread", name: "Main", updatedAt: 1 },
        { id: "sub-thread", name: "Sub", updatedAt: 2 },
      ],
    };
    const approvals: ApprovalRequest[] = [
      {
        workspace_id: "ws-1",
        request_id: 1,
        method: "approval/request",
        params: { thread_id: "main-thread" },
      },
      {
        workspace_id: "ws-1",
        request_id: 2,
        method: "approval/request",
        params: { thread_id: "sub-thread" },
      },
    ];
    const userInputRequests: RequestUserInputRequest[] = [
      {
        workspace_id: "ws-1",
        request_id: 3,
        params: {
          thread_id: "main-thread",
          turn_id: "turn-1",
          item_id: "item-1",
          questions: [],
        },
      },
      {
        workspace_id: "ws-1",
        request_id: 4,
        params: {
          thread_id: "sub-thread",
          turn_id: "turn-2",
          item_id: "item-2",
          questions: [],
        },
      },
    ];

    const result = computeAppBadgeCount({
      threadStatusById: {
        "main-thread": { turnStatus: "completed", isProcessing: false, waitReason: "none" },
        "sub-thread": { turnStatus: "completed", isProcessing: false, waitReason: "none" },
      },
      approvals,
      userInputRequests,
      isSubAgentThread: (_workspaceId, threadId) => threadId.startsWith("sub-"),
      threadsByWorkspace,
    });

    expect(result).toBe(1);
  });

  it("returns zero when there are no pending threads or response-required requests", () => {
    const result = computeAppBadgeCount({
      threadStatusById: {
        "thread-1": { turnStatus: "failed", isProcessing: false, waitReason: "none" },
        "thread-2": { turnStatus: "completed", isProcessing: false, waitReason: "approval" },
      },
      approvals: [],
      userInputRequests: [],
      isSubAgentThread: () => false,
      threadsByWorkspace: {
        "ws-1": [
          { id: "thread-1", name: "Thread 1", updatedAt: 1 },
          { id: "thread-2", name: "Thread 2", updatedAt: 2 },
        ],
      },
    });

    expect(result).toBe(0);
  });
});
