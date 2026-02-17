import { useCallback, useRef } from "react";
import type { Dispatch } from "react";
import type {
  ProtocolItemStatus,
  ProtocolMessagePhase,
  ProtocolTurnStatus,
  ThreadPhase,
  ThreadRetryState,
  ThreadWaitReason,
} from "../../../types";
import type { ThreadAction } from "./useThreadsReducer";

type UseThreadStatusOptions = {
  dispatch: Dispatch<ThreadAction>;
};

export function useThreadStatus({ dispatch }: UseThreadStatusOptions) {
  const lastTouchByThreadRef = useRef<Record<string, number>>({});
  const markProcessing = useCallback(
    (threadId: string, isProcessing: boolean) => {
      dispatch({
        type: "markProcessing",
        threadId,
        isProcessing,
        timestamp: Date.now(),
      });
    },
    [dispatch],
  );

  const markReviewing = useCallback(
    (threadId: string, isReviewing: boolean) => {
      dispatch({ type: "markReviewing", threadId, isReviewing });
    },
    [dispatch],
  );

  const markThreadError = useCallback(
    (threadId: string, message: string) => {
      dispatch({
        type: "markThreadError",
        threadId,
        timestamp: Date.now(),
        message,
      });
    },
    [dispatch],
  );

  const setActiveTurnId = useCallback(
    (threadId: string, turnId: string | null) => {
      dispatch({ type: "setActiveTurnId", threadId, turnId });
    },
    [dispatch],
  );

  const setThreadPhase = useCallback(
    (threadId: string, phase: ThreadPhase) => {
      dispatch({ type: "setThreadPhase", threadId, phase });
    },
    [dispatch],
  );

  const setThreadTurnStatus = useCallback(
    (threadId: string, turnStatus: ProtocolTurnStatus | null) => {
      dispatch({ type: "setThreadTurnStatus", threadId, turnStatus });
    },
    [dispatch],
  );

  const setThreadMessagePhase = useCallback(
    (threadId: string, messagePhase: ProtocolMessagePhase) => {
      dispatch({ type: "setThreadMessagePhase", threadId, messagePhase });
    },
    [dispatch],
  );

  const setThreadWaitReason = useCallback(
    (threadId: string, waitReason: ThreadWaitReason) => {
      dispatch({ type: "setThreadWaitReason", threadId, waitReason });
    },
    [dispatch],
  );

  const setThreadRetryState = useCallback(
    (threadId: string, retryState: ThreadRetryState) => {
      dispatch({ type: "setThreadRetryState", threadId, retryState });
    },
    [dispatch],
  );

  const setActiveItemStatus = useCallback(
    (threadId: string, itemId: string, status: ProtocolItemStatus) => {
      dispatch({ type: "setActiveItemStatus", threadId, itemId, status });
    },
    [dispatch],
  );

  const clearActiveItemStatus = useCallback(
    (threadId: string, itemId: string) => {
      dispatch({ type: "clearActiveItemStatus", threadId, itemId });
    },
    [dispatch],
  );

  const setMcpProgressMessage = useCallback(
    (threadId: string, message: string | null) => {
      dispatch({ type: "setMcpProgressMessage", threadId, message });
    },
    [dispatch],
  );

  const touchThreadActivity = useCallback(
    (threadId: string, timestamp = Date.now()) => {
      const lastTouchedAt = lastTouchByThreadRef.current[threadId] ?? 0;
      // Keep this heartbeat cheap during streaming/chunked tool output.
      if (timestamp - lastTouchedAt < 1000) {
        return;
      }
      lastTouchByThreadRef.current[threadId] = timestamp;
      dispatch({
        type: "touchThreadActivity",
        threadId,
        timestamp,
      });
    },
    [dispatch],
  );

  const resetThreadRuntimeState = useCallback(
    (threadId: string) => {
      markReviewing(threadId, false);
      setThreadTurnStatus(threadId, "interrupted");
      setThreadWaitReason(threadId, "none");
      setThreadRetryState(threadId, "none");
      setThreadPhase(threadId, "interrupted");
      markProcessing(threadId, false);
      setActiveTurnId(threadId, null);
    },
    [
      markProcessing,
      markReviewing,
      setActiveTurnId,
      setThreadPhase,
      setThreadRetryState,
      setThreadTurnStatus,
      setThreadWaitReason,
    ],
  );

  return {
    markProcessing,
    markReviewing,
    markThreadError,
    setActiveTurnId,
    setThreadPhase,
    setThreadTurnStatus,
    setThreadMessagePhase,
    setThreadWaitReason,
    setThreadRetryState,
    setActiveItemStatus,
    clearActiveItemStatus,
    setMcpProgressMessage,
    touchThreadActivity,
    resetThreadRuntimeState,
  };
}
