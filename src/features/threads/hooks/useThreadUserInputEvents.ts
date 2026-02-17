import { useCallback } from "react";
import type { Dispatch } from "react";
import type { RequestUserInputRequest, ThreadPhase } from "../../../types";
import type { ThreadAction } from "./useThreadsReducer";

type UseThreadUserInputEventsOptions = {
  dispatch: Dispatch<ThreadAction>;
  setThreadPhase: (threadId: string, phase: ThreadPhase) => void;
};

export function useThreadUserInputEvents({
  dispatch,
  setThreadPhase,
}: UseThreadUserInputEventsOptions) {
  return useCallback(
    (request: RequestUserInputRequest) => {
      const threadId = request.params.thread_id?.trim();
      if (threadId) {
        dispatch({ type: "ensureThread", workspaceId: request.workspace_id, threadId });
        setThreadPhase(threadId, "waiting_user");
      }
      dispatch({ type: "addUserInputRequest", request });
    },
    [dispatch, setThreadPhase],
  );
}
