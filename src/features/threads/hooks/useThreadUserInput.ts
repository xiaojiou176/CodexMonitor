import { useCallback } from "react";
import type { Dispatch } from "react";
import type {
  RequestUserInputRequest,
  RequestUserInputResponse,
  ThreadPhase,
} from "../../../types";
import { respondToUserInputRequest } from "../../../services/tauri";
import type { ThreadAction } from "./useThreadsReducer";

type UseThreadUserInputOptions = {
  dispatch: Dispatch<ThreadAction>;
  setThreadPhase: (threadId: string, phase: ThreadPhase) => void;
};

export function useThreadUserInput({
  dispatch,
  setThreadPhase,
}: UseThreadUserInputOptions) {
  const handleUserInputSubmit = useCallback(
    async (request: RequestUserInputRequest, response: RequestUserInputResponse) => {
      await respondToUserInputRequest(
        request.workspace_id,
        request.request_id,
        response.answers,
      );
      dispatch({
        type: "removeUserInputRequest",
        requestId: request.request_id,
        workspaceId: request.workspace_id,
      });
      const threadId = request.params.thread_id.trim();
      if (threadId) {
        setThreadPhase(threadId, "starting");
      }
    },
    [dispatch, setThreadPhase],
  );

  return { handleUserInputSubmit };
}
