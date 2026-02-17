import { useCallback } from "react";
import type { Dispatch } from "react";
import type {
  RequestUserInputRequest,
  ThreadPhase,
  ThreadWaitReason,
} from "../../../types";
import type { ThreadAction } from "./useThreadsReducer";

type UseThreadUserInputEventsOptions = {
  dispatch: Dispatch<ThreadAction>;
  setThreadPhase: (threadId: string, phase: ThreadPhase) => void;
  setThreadWaitReason: (threadId: string, waitReason: ThreadWaitReason) => void;
};

export function useThreadUserInputEvents({
  dispatch,
  setThreadPhase,
  setThreadWaitReason,
}: UseThreadUserInputEventsOptions) {
  return useCallback(
    (request: RequestUserInputRequest) => {
      const threadId = request.params.thread_id?.trim();
      if (threadId) {
        dispatch({ type: "ensureThread", workspaceId: request.workspace_id, threadId });
        setThreadPhase(threadId, "waiting_user");
        setThreadWaitReason(threadId, "user_input");
      }
      dispatch({ type: "addUserInputRequest", request });
    },
    [dispatch, setThreadPhase, setThreadWaitReason],
  );
}
