import { useCallback } from "react";
import type { ThreadListSortKey, WorkspaceInfo } from "../../../types";

type ListThreadsOptions = {
  sortKey?: ThreadListSortKey;
};

type UseThreadListActionsOptions = {
  threadListSortKey: ThreadListSortKey;
  setThreadListSortKey: (sortKey: ThreadListSortKey) => void;
  workspaces: WorkspaceInfo[];
  listThreadsForWorkspace?: (
    workspace: WorkspaceInfo,
    options?: ListThreadsOptions,
  ) => void | Promise<void>;
  listThreadsForWorkspaces?: (
    workspaces: WorkspaceInfo[],
    options?: ListThreadsOptions,
  ) => void | Promise<void>;
  refreshWorkspaces?: () => Promise<WorkspaceInfo[] | undefined>;
  resetWorkspaceThreads: (workspaceId: string) => void;
};

export function useThreadListActions({
  threadListSortKey,
  setThreadListSortKey,
  workspaces,
  listThreadsForWorkspace,
  listThreadsForWorkspaces,
  refreshWorkspaces,
  resetWorkspaceThreads,
}: UseThreadListActionsOptions) {
  const listThreadsForConnectedWorkspaces = useCallback(
    async (connectedWorkspaces: WorkspaceInfo[], options?: ListThreadsOptions) => {
      if (connectedWorkspaces.length === 0) {
        return;
      }
      if (listThreadsForWorkspaces) {
        await listThreadsForWorkspaces(connectedWorkspaces, options);
        return;
      }
      if (!listThreadsForWorkspace) {
        return;
      }
      connectedWorkspaces.forEach((workspace) => {
        void listThreadsForWorkspace(workspace, options);
      });
    },
    [listThreadsForWorkspace, listThreadsForWorkspaces],
  );

  const handleSetThreadListSortKey = useCallback(
    (nextSortKey: ThreadListSortKey) => {
      if (nextSortKey === threadListSortKey) {
        return;
      }
      setThreadListSortKey(nextSortKey);
      const connectedWorkspaces = workspaces.filter((workspace) => workspace.connected);
      void listThreadsForConnectedWorkspaces(connectedWorkspaces, {
        sortKey: nextSortKey,
      });
    },
    [
      listThreadsForConnectedWorkspaces,
      setThreadListSortKey,
      threadListSortKey,
      workspaces,
    ],
  );

  const handleRefreshAllWorkspaceThreads = useCallback(async () => {
    const refreshed = refreshWorkspaces ? await refreshWorkspaces() : undefined;
    const source = refreshed ?? workspaces;
    const connectedWorkspaces = source.filter((workspace) => workspace.connected);
    connectedWorkspaces.forEach((workspace) => {
      resetWorkspaceThreads(workspace.id);
    });
    await listThreadsForConnectedWorkspaces(connectedWorkspaces);
  }, [
    listThreadsForConnectedWorkspaces,
    refreshWorkspaces,
    resetWorkspaceThreads,
    workspaces,
  ]);

  return {
    handleSetThreadListSortKey,
    handleRefreshAllWorkspaceThreads,
  };
}
