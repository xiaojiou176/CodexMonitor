import type { ApprovalRequest, DebugEntry, RequestUserInputRequest } from "../../../types";
import { useWindowFocusState } from "../../layout/hooks/useWindowFocusState";
import { useAgentResponseRequiredNotifications } from "../../notifications/hooks/useAgentResponseRequiredNotifications";

type Params = {
  systemNotificationsEnabled: boolean;
  subagentSystemNotificationsEnabled: boolean;
  isSubagentThread?: (workspaceId: string, threadId: string) => boolean;
  approvals: ApprovalRequest[];
  userInputRequests: RequestUserInputRequest[];
  isSubAgentThread?: (workspaceId: string, threadId: string) => boolean;
  getWorkspaceName?: (workspaceId: string) => string | undefined;
  onDebug?: (entry: DebugEntry) => void;
};

export function useResponseRequiredNotificationsController({
  systemNotificationsEnabled,
  subagentSystemNotificationsEnabled,
  isSubagentThread,
  approvals,
  userInputRequests,
  isSubAgentThread,
  getWorkspaceName,
  onDebug,
}: Params) {
  const isWindowFocused = useWindowFocusState();

  useAgentResponseRequiredNotifications({
    enabled: systemNotificationsEnabled,
    subagentNotificationsEnabled: subagentSystemNotificationsEnabled,
    isSubagentThread,
    isWindowFocused,
    approvals,
    userInputRequests,
    isSubAgentThread,
    getWorkspaceName,
    onDebug,
  });
}
