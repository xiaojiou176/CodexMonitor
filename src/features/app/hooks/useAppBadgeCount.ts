import { useEffect, useMemo } from "react";
import { clearAppBadge, setAppBadgeCount } from "../../../services/tauri";
import type { ApprovalRequest, RequestUserInputRequest, ThreadSummary } from "../../../types";

type ThreadStatusSnapshot = {
  isProcessing?: boolean;
  turnStatus?: "inProgress" | "completed" | "interrupted" | "failed" | null;
  waitReason?: "none" | "approval" | "user_input" | "tool_wait" | "retry";
};

type Params = {
  threadStatusById: Record<string, ThreadStatusSnapshot | undefined>;
  approvals: ApprovalRequest[];
  userInputRequests: RequestUserInputRequest[];
  isSubAgentThread?: (workspaceId: string, threadId: string) => boolean;
  threadsByWorkspace: Record<string, ThreadSummary[] | undefined>;
};

function asNonEmptyString(value: unknown): string | null {
  const normalized = String(value ?? "").trim();
  return normalized.length > 0 ? normalized : null;
}

function resolveApprovalThreadId(approval: ApprovalRequest): string | null {
  const params = approval.params as Record<string, unknown>;
  const direct = asNonEmptyString(params.threadId ?? params.thread_id);
  if (direct) {
    return direct;
  }
  const turn =
    params.turn && typeof params.turn === "object"
      ? (params.turn as Record<string, unknown>)
      : null;
  return asNonEmptyString(turn?.threadId ?? turn?.thread_id);
}

function resolveUserInputThreadId(request: RequestUserInputRequest): string | null {
  return asNonEmptyString(request.params.thread_id ?? (request.params as Record<string, unknown>).threadId);
}

function buildThreadKey(workspaceId: string, threadId: string): string {
  return `${workspaceId}:${threadId}`;
}

function buildRequestKeyWithoutThread(workspaceId: string, requestId: string | number): string {
  return `${workspaceId}:${requestId}`;
}

function isCompletedIdleThread(status: ThreadStatusSnapshot | undefined): boolean {
  if (!status) {
    return false;
  }
  if (status.turnStatus !== "completed" || status.isProcessing !== false) {
    return false;
  }
  return status.waitReason == null || status.waitReason === "none";
}

export function computeAppBadgeCount({
  threadStatusById,
  approvals,
  userInputRequests,
  isSubAgentThread,
  threadsByWorkspace,
}: Params): number {
  const pendingThreadKeys = new Set<string>();
  const pendingRequestKeysWithoutThread = new Set<string>();

  for (const [workspaceId, threads] of Object.entries(threadsByWorkspace)) {
    if (!threads?.length) {
      continue;
    }
    for (const thread of threads) {
      if (isSubAgentThread?.(workspaceId, thread.id)) {
        continue;
      }
      if (isCompletedIdleThread(threadStatusById[thread.id])) {
        pendingThreadKeys.add(buildThreadKey(workspaceId, thread.id));
      }
    }
  }

  for (const approval of approvals) {
    const threadId = resolveApprovalThreadId(approval);
    if (threadId && isSubAgentThread?.(approval.workspace_id, threadId)) {
      continue;
    }
    if (threadId) {
      pendingThreadKeys.add(buildThreadKey(approval.workspace_id, threadId));
      continue;
    }
    pendingRequestKeysWithoutThread.add(
      buildRequestKeyWithoutThread(approval.workspace_id, approval.request_id),
    );
  }

  for (const request of userInputRequests) {
    const threadId = resolveUserInputThreadId(request);
    if (threadId && isSubAgentThread?.(request.workspace_id, threadId)) {
      continue;
    }
    if (threadId) {
      pendingThreadKeys.add(buildThreadKey(request.workspace_id, threadId));
      continue;
    }
    pendingRequestKeysWithoutThread.add(
      buildRequestKeyWithoutThread(request.workspace_id, request.request_id),
    );
  }

  return pendingThreadKeys.size + pendingRequestKeysWithoutThread.size;
}

export function useAppBadgeCount(params: Params) {
  const badgeCount = useMemo(() => computeAppBadgeCount(params), [params]);

  useEffect(() => {
    const run = async () => {
      if (badgeCount > 0) {
        await setAppBadgeCount(badgeCount);
      } else {
        await clearAppBadge();
      }
    };

    void run().catch(() => {
      // Badge sync is best-effort.
    });
  }, [badgeCount]);
}
