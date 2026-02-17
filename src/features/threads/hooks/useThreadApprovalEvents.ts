import { useCallback } from "react";
import type { Dispatch, MutableRefObject } from "react";
import type { ApprovalRequest, ThreadPhase, ThreadWaitReason } from "../../../types";
import {
  getApprovalCommandInfo,
  matchesCommandPrefix,
} from "../../../utils/approvalRules";
import { respondToServerRequest } from "../../../services/tauri";
import type { ThreadAction } from "./useThreadsReducer";

type UseThreadApprovalEventsOptions = {
  dispatch: Dispatch<ThreadAction>;
  approvalAllowlistRef: MutableRefObject<Record<string, string[][]>>;
  setThreadPhase: (threadId: string, phase: ThreadPhase) => void;
  setThreadWaitReason: (threadId: string, waitReason: ThreadWaitReason) => void;
};

function resolveApprovalThreadId(params: Record<string, unknown>): string | null {
  const threadId = params.threadId ?? params.thread_id ?? null;
  if (typeof threadId !== "string") {
    return null;
  }
  const trimmed = threadId.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function useThreadApprovalEvents({
  dispatch,
  approvalAllowlistRef,
  setThreadPhase,
  setThreadWaitReason,
}: UseThreadApprovalEventsOptions) {
  return useCallback(
    (approval: ApprovalRequest) => {
      const threadId = resolveApprovalThreadId(approval.params ?? {});
      if (threadId) {
        dispatch({ type: "ensureThread", workspaceId: approval.workspace_id, threadId });
        setThreadPhase(threadId, "waiting_user");
        setThreadWaitReason(threadId, "approval");
      }
      const commandInfo = getApprovalCommandInfo(approval.params ?? {});
      const allowlist =
        approvalAllowlistRef.current[approval.workspace_id] ?? [];
      if (commandInfo && matchesCommandPrefix(commandInfo.tokens, allowlist)) {
        void respondToServerRequest(
          approval.workspace_id,
          approval.request_id,
          "accept",
        );
        return;
      }
      dispatch({ type: "addApproval", approval });
    },
    [approvalAllowlistRef, dispatch, setThreadPhase, setThreadWaitReason],
  );
}
