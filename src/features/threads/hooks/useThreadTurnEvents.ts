import { useCallback } from "react";
import type { Dispatch, MutableRefObject } from "react";
import type {
  ProtocolMessagePhase,
  ProtocolTurnStatus,
  ThreadPhase,
  ThreadRetryState,
  ThreadWaitReason,
  TurnPlan,
} from "../../../types";
import { interruptTurn as interruptTurnService } from "../../../services/tauri";
import { getThreadCreatedTimestamp, getThreadTimestamp } from "../../../utils/threadItems";
import {
  asString,
  normalizePlanUpdate,
  normalizeRateLimits,
  normalizeTokenUsage,
} from "../utils/threadNormalize";
import {
  extractSubAgentParentThreadId,
  isSubAgentSource,
} from "../utils/subAgentSource";
import type { ThreadAction, ThreadParentOrdering } from "./useThreadsReducer";

type UseThreadTurnEventsOptions = {
  dispatch: Dispatch<ThreadAction>;
  planByThreadRef: MutableRefObject<Record<string, TurnPlan | null>>;
  getCustomName: (workspaceId: string, threadId: string) => string | undefined;
  isThreadHidden: (workspaceId: string, threadId: string) => boolean;
  markProcessing: (threadId: string, isProcessing: boolean) => void;
  markReviewing: (threadId: string, isReviewing: boolean) => void;
  setThreadPhase: (threadId: string, phase: ThreadPhase) => void;
  setThreadTurnStatus: (threadId: string, turnStatus: ProtocolTurnStatus | null) => void;
  setThreadMessagePhase: (
    threadId: string,
    messagePhase: ProtocolMessagePhase,
  ) => void;
  setThreadWaitReason: (threadId: string, waitReason: ThreadWaitReason) => void;
  setThreadRetryState: (threadId: string, retryState: ThreadRetryState) => void;
  markThreadError?: (threadId: string, message: string) => void;
  setActiveTurnId: (threadId: string, turnId: string | null) => void;
  pendingInterruptsRef: MutableRefObject<Set<string>>;
  pushThreadErrorMessage: (threadId: string, message: string) => void;
  safeMessageActivity: () => void;
  recordThreadActivity: (workspaceId: string, threadId: string, timestamp?: number) => void;
  updateThreadParent: (
    parentId: string,
    childIds: string[],
    options?: {
      source?: unknown;
      allowReparent?: boolean;
      ordering?: ThreadParentOrdering;
    },
  ) => void;
  markSubAgentThread?: (threadId: string) => void;
  recordThreadCreatedAt?: (
    threadId: string,
    createdAt: number,
    fallbackTimestamp?: number,
  ) => void;
  resolveCurrentModel?: () => string | null;
};

export function useThreadTurnEvents({
  dispatch,
  planByThreadRef,
  getCustomName,
  isThreadHidden,
  markProcessing,
  markReviewing,
  setThreadPhase,
  setThreadTurnStatus,
  setThreadMessagePhase,
  setThreadWaitReason,
  setThreadRetryState,
  markThreadError,
  setActiveTurnId,
  pendingInterruptsRef,
  pushThreadErrorMessage,
  safeMessageActivity,
  recordThreadActivity,
  updateThreadParent,
  markSubAgentThread,
  recordThreadCreatedAt,
  resolveCurrentModel,
}: UseThreadTurnEventsOptions) {
  const normalizeNonEmptyString = useCallback((value: string | null | undefined) => {
    if (typeof value !== "string") {
      return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }, []);

  const shouldClearCompletedPlan = useCallback((threadId: string, turnId: string) => {
    const plan = planByThreadRef.current[threadId];
    if (!plan || plan.steps.length === 0) {
      return false;
    }
    if (turnId && plan.turnId !== turnId) {
      return false;
    }
    return plan.steps.every((step) => step.status === "completed");
  }, [planByThreadRef]);

  const onThreadStarted = useCallback(
    (workspaceId: string, thread: Record<string, unknown>) => {
      const threadId = asString(thread.id);
      if (!threadId) {
        return;
      }
      if (isThreadHidden(workspaceId, threadId)) {
        return;
      }
      dispatch({ type: "ensureThread", workspaceId, threadId });
      const timestamp = getThreadTimestamp(thread);
      const activityTimestamp = timestamp > 0 ? timestamp : Date.now();
      recordThreadActivity(workspaceId, threadId, activityTimestamp);
      const sourceParentId = extractSubAgentParentThreadId(thread.source);
      if (sourceParentId) {
        updateThreadParent(sourceParentId, [threadId], {
          source: thread.source,
          allowReparent: true,
          ordering: { timestamp: activityTimestamp },
        });
      }
      if (isSubAgentSource(thread.source)) {
        markSubAgentThread?.(threadId);
      }
      recordThreadCreatedAt?.(
        threadId,
        getThreadCreatedTimestamp(thread),
        activityTimestamp,
      );
      dispatch({
        type: "setThreadTimestamp",
        workspaceId,
        threadId,
        timestamp: activityTimestamp,
      });

      const customName = getCustomName(workspaceId, threadId);
      if (!customName) {
        const preview = asString(thread.preview).trim();
        if (preview) {
          const name = preview.length > 38 ? `${preview.slice(0, 38)}…` : preview;
          dispatch({ type: "setThreadName", workspaceId, threadId, name });
        }
      }
      safeMessageActivity();
    },
    [
      dispatch,
      getCustomName,
      isThreadHidden,
      markSubAgentThread,
      recordThreadActivity,
      recordThreadCreatedAt,
      safeMessageActivity,
      updateThreadParent,
    ],
  );

  const onThreadNameUpdated = useCallback(
    (
      workspaceId: string,
      payload: { threadId: string; threadName: string | null },
    ) => {
      const { threadId, threadName } = payload;
      if (!threadId || !threadName) {
        return;
      }
      if (getCustomName(workspaceId, threadId)) {
        return;
      }
      dispatch({
        type: "setThreadName",
        workspaceId,
        threadId,
        name: threadName,
      });
    },
    [dispatch, getCustomName],
  );

  const onTurnStarted = useCallback(
    (
      workspaceId: string,
      threadId: string,
      turnId: string,
      metadata?: { model: string | null; status?: ProtocolTurnStatus | null },
    ) => {
      dispatch({
        type: "ensureThread",
        workspaceId,
        threadId,
      });
      if (turnId) {
        dispatch({
          type: "setThreadTurnMeta",
          threadId,
          turnId,
          model: normalizeNonEmptyString(
            metadata?.model ?? resolveCurrentModel?.() ?? null,
          ),
        });
      }
      if (pendingInterruptsRef.current.has(threadId)) {
        pendingInterruptsRef.current.delete(threadId);
        if (turnId) {
          void interruptTurnService(workspaceId, threadId, turnId).catch(() => {});
        }
        return;
      }
      markProcessing(threadId, true);
      setThreadPhase(threadId, "starting");
      setThreadTurnStatus(threadId, metadata?.status ?? "inProgress");
      setThreadMessagePhase(threadId, "unknown");
      setThreadWaitReason(threadId, "none");
      setThreadRetryState(threadId, "none");
      if (turnId) {
        setActiveTurnId(threadId, turnId);
      }
    },
    [
      dispatch,
      markProcessing,
      normalizeNonEmptyString,
      pendingInterruptsRef,
      resolveCurrentModel,
      setThreadPhase,
      setThreadTurnStatus,
      setThreadMessagePhase,
      setThreadWaitReason,
      setThreadRetryState,
      setActiveTurnId,
    ],
  );

  const onTurnCompleted = useCallback(
    (
      _workspaceId: string,
      threadId: string,
      turnId: string,
      metadata?: {
        status: ProtocolTurnStatus | null;
        errorMessage: string | null;
      },
    ) => {
      setThreadTurnStatus(threadId, metadata?.status ?? null);
      setThreadWaitReason(threadId, "none");
      setThreadRetryState(threadId, "none");
      if (metadata?.status === "failed") {
        const message = metadata.errorMessage
          ? `Turn failed: ${metadata.errorMessage}`
          : "Turn failed.";
        markThreadError?.(threadId, message);
        pushThreadErrorMessage(threadId, message);
        setThreadPhase(threadId, "failed");
      } else if (metadata?.status === "interrupted") {
        setThreadPhase(threadId, "interrupted");
      } else {
        setThreadPhase(threadId, "completed");
      }
      markProcessing(threadId, false);
      setActiveTurnId(threadId, null);
      pendingInterruptsRef.current.delete(threadId);
      if (shouldClearCompletedPlan(threadId, turnId)) {
        dispatch({ type: "clearThreadPlan", threadId });
      }
    },
    [
      dispatch,
      markProcessing,
      markThreadError,
      pendingInterruptsRef,
      pushThreadErrorMessage,
      setThreadPhase,
      setThreadTurnStatus,
      setThreadWaitReason,
      setThreadRetryState,
      setActiveTurnId,
      shouldClearCompletedPlan,
    ],
  );

  const onTurnPlanUpdated = useCallback(
    (
      workspaceId: string,
      threadId: string,
      turnId: string,
      payload: { explanation: unknown; plan: unknown },
    ) => {
      dispatch({ type: "ensureThread", workspaceId, threadId });
      const normalized = normalizePlanUpdate(
        turnId,
        payload.explanation,
        payload.plan,
      );
      dispatch({ type: "setThreadPlan", threadId, plan: normalized });
    },
    [dispatch],
  );

  const onTurnDiffUpdated = useCallback(
    (workspaceId: string, threadId: string, diff: string) => {
      dispatch({ type: "ensureThread", workspaceId, threadId });
      dispatch({ type: "setThreadTurnDiff", threadId, diff });
    },
    [dispatch],
  );

  const onThreadTokenUsageUpdated = useCallback(
    (
      workspaceId: string,
      threadId: string,
      payload: {
        turnId: string | null;
        tokenUsage: Record<string, unknown> | null;
      },
    ) => {
      const normalizedTokenUsage = normalizeTokenUsage(payload.tokenUsage);
      dispatch({ type: "ensureThread", workspaceId, threadId });
      dispatch({
        type: "setThreadTokenUsage",
        threadId,
        tokenUsage: normalizedTokenUsage,
      });
      const turnId = normalizeNonEmptyString(payload.turnId);
      if (turnId) {
        dispatch({
          type: "setThreadTurnContextWindow",
          threadId,
          turnId,
          contextWindow: normalizedTokenUsage.modelContextWindow ?? null,
        });
      }
    },
    [dispatch, normalizeNonEmptyString],
  );

  const onAccountRateLimitsUpdated = useCallback(
    (workspaceId: string, rateLimits: Record<string, unknown>) => {
      dispatch({
        type: "setRateLimits",
        workspaceId,
        rateLimits: normalizeRateLimits(rateLimits),
      });
    },
    [dispatch],
  );

  const onTurnError = useCallback(
    (
      workspaceId: string,
      threadId: string,
      _turnId: string,
      payload: { message: string; willRetry: boolean },
    ) => {
      if (payload.willRetry) {
        dispatch({ type: "ensureThread", workspaceId, threadId });
        markProcessing(threadId, true);
        setThreadTurnStatus(threadId, "inProgress");
        setThreadWaitReason(threadId, "retry");
        setThreadRetryState(threadId, "retrying");
        setThreadPhase(threadId, "starting");
        safeMessageActivity();
        return;
      }
      dispatch({ type: "ensureThread", workspaceId, threadId });
      markProcessing(threadId, false);
      markReviewing(threadId, false);
      setActiveTurnId(threadId, null);
      const message = payload.message
        ? `Turn failed: ${payload.message}`
        : "Turn failed.";
      markThreadError?.(threadId, message);
      setThreadTurnStatus(threadId, "failed");
      setThreadWaitReason(threadId, "none");
      setThreadRetryState(threadId, "none");
      setThreadPhase(threadId, "failed");
      pushThreadErrorMessage(threadId, message);
      safeMessageActivity();
    },
    [
      dispatch,
      markProcessing,
      markReviewing,
      markThreadError,
      pushThreadErrorMessage,
      safeMessageActivity,
      setThreadPhase,
      setThreadTurnStatus,
      setThreadWaitReason,
      setThreadRetryState,
      setActiveTurnId,
    ],
  );

  return {
    onThreadStarted,
    onThreadNameUpdated,
    onTurnStarted,
    onTurnCompleted,
    onTurnPlanUpdated,
    onTurnDiffUpdated,
    onThreadTokenUsageUpdated,
    onAccountRateLimitsUpdated,
    onTurnError,
  };
}
