import { useCallback, useEffect, useRef } from "react";
import type { ThreadPhase } from "../../../types";
import type { ThreadState } from "./useThreadsReducer";
import {
  evaluateThreadStaleState,
  hasRunningCommandExecution,
} from "./threadStalePolicy";

/**
 * How often (ms) we check for staleness.
 */
const CHECK_INTERVAL_MS = 10_000;

const STALE_RECOVERY_MESSAGE =
  "检测到会话长时间无事件，已尝试自动恢复。若任务仍在执行，可稍后刷新线程状态。";

type UseThreadStaleGuardOptions = {
  activeWorkspaceId: string | null;
  activeThreadId: string | null;
  itemsByThread: ThreadState["itemsByThread"];
  threadStatusById: ThreadState["threadStatusById"];
  markProcessing: (threadId: string, isProcessing: boolean) => void;
  markReviewing: (threadId: string, isReviewing: boolean) => void;
  setActiveTurnId: (threadId: string, turnId: string | null) => void;
  setThreadPhase: (threadId: string, phase: ThreadPhase) => void;
  pushThreadErrorMessage: (threadId: string, message: string) => void;
};

export function useThreadStaleGuard({
  activeWorkspaceId,
  activeThreadId,
  itemsByThread,
  threadStatusById,
  markProcessing,
  markReviewing,
  setActiveTurnId,
  setThreadPhase,
  pushThreadErrorMessage,
}: UseThreadStaleGuardOptions) {
  // Tracks the last time we received *any* event from each workspace.
  const lastAliveByWorkspaceRef = useRef<Record<string, number>>({});

  /** Called by the event layer every time an app-server event arrives. */
  const recordAlive = useCallback((workspaceId: string) => {
    lastAliveByWorkspaceRef.current[workspaceId] = Date.now();
  }, []);

  const getWorkspaceLastAliveAt = useCallback((workspaceId: string) => {
    return lastAliveByWorkspaceRef.current[workspaceId] ?? null;
  }, []);

  const hasRunningCommandExecutionForThread = useCallback(
    (threadId: string) => {
      return hasRunningCommandExecution(itemsByThread[threadId]);
    },
    [itemsByThread],
  );

  /** Called when the workspace disconnects (codex/disconnected). */
  const handleDisconnected = useCallback(
    (workspaceId: string) => {
      // Find all threads for this workspace that are currently processing and
      // reset them.
      const entries = Object.entries(threadStatusById);
      for (const [threadId, status] of entries) {
        if (!status?.isProcessing) {
          continue;
        }
        // We can't easily know which workspace a thread belongs to from the
        // status map alone.  For the active thread, we know its workspace.
        if (activeWorkspaceId === workspaceId && threadId === activeThreadId) {
          setThreadPhase(threadId, "interrupted");
          markProcessing(threadId, false);
          markReviewing(threadId, false);
          setActiveTurnId(threadId, null);
          pushThreadErrorMessage(
            threadId,
            "Agent 连接已断开，请重试。",
          );
        }
      }
      // Also reset if the active thread is processing (cover edge cases).
      if (activeThreadId && threadStatusById[activeThreadId]?.isProcessing) {
        if (activeWorkspaceId === workspaceId) {
          setThreadPhase(activeThreadId, "interrupted");
          markProcessing(activeThreadId, false);
          markReviewing(activeThreadId, false);
          setActiveTurnId(activeThreadId, null);
          // Message already pushed above if it matched, guard against double
          // push by checking processing again — but since we just set it to
          // false above this is a no-op if already handled.
        }
      }
    },
    [
      activeThreadId,
      activeWorkspaceId,
      markProcessing,
      markReviewing,
      pushThreadErrorMessage,
      setActiveTurnId,
      setThreadPhase,
      threadStatusById,
    ],
  );

  // Periodic check: only auto-recover when BOTH conditions are met:
  // 1) processing duration >= ACTIVE_THREAD_STALE_MS
  // 2) event silence      >= effective silence threshold
  //    (default 90s, widened for running commandExecution items)
  useEffect(() => {
    const interval = window.setInterval(() => {
      if (!activeThreadId || !activeWorkspaceId) {
        return;
      }
      const status = threadStatusById[activeThreadId];
      if (!status?.isProcessing || !status.processingStartedAt) {
        return;
      }
      if (status.phase === "waiting_user") {
        return;
      }
      const now = Date.now();
      const staleState = evaluateThreadStaleState({
        now,
        startedAt: status.processingStartedAt,
        lastAliveAt: getWorkspaceLastAliveAt(activeWorkspaceId),
        hasRunningCommandExecution:
          hasRunningCommandExecutionForThread(activeThreadId),
      });
      if (!staleState.isStale) {
        return;
      }
      setThreadPhase(activeThreadId, "stale_recovered");
      markProcessing(activeThreadId, false);
      markReviewing(activeThreadId, false);
      setActiveTurnId(activeThreadId, null);
      pushThreadErrorMessage(
        activeThreadId,
        STALE_RECOVERY_MESSAGE,
      );
    }, CHECK_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [
    activeThreadId,
    activeWorkspaceId,
    getWorkspaceLastAliveAt,
    hasRunningCommandExecutionForThread,
    markProcessing,
    markReviewing,
    pushThreadErrorMessage,
    setThreadPhase,
    setActiveTurnId,
    threadStatusById,
  ]);

  return { recordAlive, handleDisconnected, getWorkspaceLastAliveAt };
}
