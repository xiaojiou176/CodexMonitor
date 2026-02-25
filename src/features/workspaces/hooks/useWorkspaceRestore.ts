import { useEffect, useRef } from "react";
import type { WorkspaceInfo } from "../../../types";

type WorkspaceRestoreOptions = {
  workspaces: WorkspaceInfo[];
  hasLoaded: boolean;
  backendMode?: string;
  activeWorkspaceId?: string | null;
  activeThreadId?: string | null;
  connectWorkspace: (workspace: WorkspaceInfo) => Promise<void>;
  listThreadsForWorkspace: (
    workspace: WorkspaceInfo,
    options?: { preserveState?: boolean },
  ) => Promise<void>;
  resolvePreferredThreadId?: (context: {
    workspaceId: string;
    activeWorkspaceId: string | null;
    activeThreadId: string | null;
  }) => string | null;
  refreshThreadRuntime?: (
    workspaceId: string,
    threadId: string,
  ) => Promise<unknown> | unknown;
};

export function useWorkspaceRestore({
  workspaces,
  hasLoaded,
  backendMode,
  activeWorkspaceId,
  activeThreadId,
  connectWorkspace,
  listThreadsForWorkspace,
  resolvePreferredThreadId,
  refreshThreadRuntime,
}: WorkspaceRestoreOptions) {
  const restoredWorkspaces = useRef(new Set<string>());

  useEffect(() => {
    if (!hasLoaded) {
      return;
    }
    workspaces.forEach((workspace) => {
      if (restoredWorkspaces.current.has(workspace.id)) {
        return;
      }
      restoredWorkspaces.current.add(workspace.id);
      void (async () => {
        try {
          if (!workspace.connected) {
            await connectWorkspace(workspace);
          }
          await listThreadsForWorkspace(workspace, { preserveState: true });
          if (
            backendMode === "remote" &&
            resolvePreferredThreadId &&
            refreshThreadRuntime
          ) {
            const preferredThreadId = resolvePreferredThreadId({
              workspaceId: workspace.id,
              activeWorkspaceId: activeWorkspaceId ?? null,
              activeThreadId: activeThreadId ?? null,
            });
            if (preferredThreadId) {
              await Promise.resolve(
                refreshThreadRuntime(workspace.id, preferredThreadId),
              );
            }
          }
        } catch {
          // Silent: connection errors show in debug panel.
        }
      })();
    });
  }, [
    activeThreadId,
    activeWorkspaceId,
    backendMode,
    connectWorkspace,
    hasLoaded,
    listThreadsForWorkspace,
    refreshThreadRuntime,
    resolvePreferredThreadId,
    workspaces,
  ]);
}
