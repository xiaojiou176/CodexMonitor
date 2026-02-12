import { useCallback, useEffect, useRef } from "react";
import type { ThreadState } from "./useThreadsReducer";

/**
 * Maximum time (ms) an active thread can stay in `isProcessing` without
 * receiving any app-server event before we consider it stale and auto-reset.
 *
 * 120 seconds balances giving slow agents enough time while avoiding the UI
 * spinning forever after a silent disconnect.
 */
const ACTIVE_THREAD_STALE_MS = 120_000;

/**
 * How often (ms) we check for staleness.
 */
const CHECK_INTERVAL_MS = 10_000;

type UseThreadStaleGuardOptions = {
  activeWorkspaceId: string | null;
  activeThreadId: string | null;
  threadStatusById: ThreadState["threadStatusById"];
  markProcessing: (threadId: string, isProcessing: boolean) => void;
  markReviewing: (threadId: string, isReviewing: boolean) => void;
  setActiveTurnId: (threadId: string, turnId: string | null) => void;
  pushThreadErrorMessage: (threadId: string, message: string) => void;
};

export function useThreadStaleGuard({
  activeWorkspaceId,
  activeThreadId,
  threadStatusById,
  markProcessing,
  markReviewing,
  setActiveTurnId,
  pushThreadErrorMessage,
}: UseThreadStaleGuardOptions) {
  // Tracks the last time we received *any* event from each workspace.
  const lastAliveByWorkspaceRef = useRef<Record<string, number>>({});

  /** Called by the event layer every time an app-server event arrives. */
  const recordAlive = useCallback((workspaceId: string) => {
    lastAliveByWorkspaceRef.current[workspaceId] = Date.now();
  }, []);

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
      threadStatusById,
    ],
  );

  // Periodic check: if the active thread has been processing for longer than
  // ACTIVE_THREAD_STALE_MS **and** we haven't received any event from the
  // workspace in that time, auto-recover.
  useEffect(() => {
    const interval = window.setInterval(() => {
      if (!activeThreadId || !activeWorkspaceId) {
        return;
      }
      const status = threadStatusById[activeThreadId];
      if (!status?.isProcessing || !status.processingStartedAt) {
        return;
      }
      const now = Date.now();
      const processingAge = now - status.processingStartedAt;
      if (processingAge < ACTIVE_THREAD_STALE_MS) {
        return;
      }
      // Check if we received any event recently.
      const lastAlive = lastAliveByWorkspaceRef.current[activeWorkspaceId] ?? 0;
      const silenceMs = now - lastAlive;
      // If we received an event within the last 30 seconds, the agent is
      // probably still alive (e.g. doing slow reasoning).  Only reset if
      // there's been extended silence.
      if (silenceMs < 30_000 && lastAlive > 0) {
        return;
      }
      markProcessing(activeThreadId, false);
      markReviewing(activeThreadId, false);
      setActiveTurnId(activeThreadId, null);
      pushThreadErrorMessage(
        activeThreadId,
        "Agent 长时间无响应，会话已自动重置。你可以重新发送消息。",
      );
    }, CHECK_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [
    activeThreadId,
    activeWorkspaceId,
    markProcessing,
    markReviewing,
    pushThreadErrorMessage,
    setActiveTurnId,
    threadStatusById,
  ]);

  return { recordAlive, handleDisconnected };
}
