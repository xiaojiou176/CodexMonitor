import { useCallback } from "react";
import { useWorkspaces } from "../../workspaces/hooks/useWorkspaces";
import type { AppSettings, DebugEntry, WorkspaceInfo } from "../../../types";
import { useWorkspaceDialogs } from "./useWorkspaceDialogs";
import { useWorkspaceFromUrlPrompt } from "../../workspaces/hooks/useWorkspaceFromUrlPrompt";

type WorkspaceControllerOptions = {
  appSettings: AppSettings;
  addDebugEntry: (entry: DebugEntry) => void;
  queueSaveSettings: (next: AppSettings) => Promise<AppSettings>;
};

export function useWorkspaceController({
  appSettings,
  addDebugEntry,
  queueSaveSettings,
}: WorkspaceControllerOptions) {
  const workspaceCore = useWorkspaces({
    onDebug: addDebugEntry,
    defaultCodexBin: appSettings.codexBin,
    appSettings,
    onUpdateAppSettings: queueSaveSettings,
  });

  const {
    workspaces,
    addWorkspaceFromGitUrl,
    addWorkspaceFromPath,
    filterWorkspacePaths,
    removeWorkspace: removeWorkspaceCore,
    removeWorktree: removeWorktreeCore,
  } = workspaceCore;

  const {
    requestWorkspacePaths,
    mobileRemoteWorkspacePathPrompt,
    updateMobileRemoteWorkspacePathInput,
    cancelMobileRemoteWorkspacePathPrompt,
    submitMobileRemoteWorkspacePathPrompt,
    showAddWorkspacesResult,
    confirmWorkspaceRemoval,
    confirmWorktreeRemoval,
    showWorkspaceRemovalError,
    showWorktreeRemovalError,
  } = useWorkspaceDialogs();

  const addWorkspacesFromPaths = useCallback(
    async (paths: string[]): Promise<WorkspaceInfo | null> => {
      const candidates = await filterWorkspacePaths(paths);
      const added: WorkspaceInfo[] = [];
      const skippedInvalid = paths.filter((path) => !candidates.includes(path));

      for (const path of candidates) {
        const next = await addWorkspaceFromPath(path);
        if (next) {
          added.push(next);
        }
      }

      await showAddWorkspacesResult({
        added,
        firstAdded: added[0] ?? null,
        skippedExisting: [],
        skippedInvalid,
        failures: [],
      });

      return added[0] ?? null;
    },
    [addWorkspaceFromPath, filterWorkspacePaths, showAddWorkspacesResult],
  );

  const addWorkspace = useCallback(async (): Promise<WorkspaceInfo | null> => {
    const paths = await requestWorkspacePaths(appSettings.backendMode);
    if (paths.length === 0) {
      return null;
    }
    return addWorkspacesFromPaths(paths);
  }, [addWorkspacesFromPaths, appSettings.backendMode, requestWorkspacePaths]);

  const addWorkspaceFromUrl = useCallback(
    async (url: string, destinationPath: string, targetFolderName?: string | null) => {
      await addWorkspaceFromGitUrl(url, destinationPath, targetFolderName, {
        activate: true,
      });
    },
    [addWorkspaceFromGitUrl],
  );

  const {
    workspaceFromUrlPrompt,
    openWorkspaceFromUrlPrompt,
    closeWorkspaceFromUrlPrompt,
    chooseWorkspaceFromUrlDestinationPath,
    submitWorkspaceFromUrlPrompt,
    updateWorkspaceFromUrlUrl,
    updateWorkspaceFromUrlTargetFolderName,
    clearWorkspaceFromUrlDestinationPath,
    canSubmitWorkspaceFromUrlPrompt,
  } = useWorkspaceFromUrlPrompt({
    onSubmit: addWorkspaceFromUrl,
  });

  const removeWorkspace = useCallback(
    async (workspaceId: string) => {
      const confirmed = await confirmWorkspaceRemoval(workspaces, workspaceId);
      if (!confirmed) {
        return;
      }
      try {
        await removeWorkspaceCore(workspaceId);
      } catch (error) {
        await showWorkspaceRemovalError(error);
      }
    },
    [confirmWorkspaceRemoval, removeWorkspaceCore, showWorkspaceRemovalError, workspaces],
  );

  const removeWorktree = useCallback(
    async (workspaceId: string) => {
      const confirmed = await confirmWorktreeRemoval(workspaces, workspaceId);
      if (!confirmed) {
        return;
      }
      try {
        await removeWorktreeCore(workspaceId);
      } catch (error) {
        await showWorktreeRemovalError(error);
      }
    },
    [confirmWorktreeRemoval, removeWorktreeCore, showWorktreeRemovalError, workspaces],
  );

  return {
    ...workspaceCore,
    addWorkspace,
    addWorkspacesFromPaths,
    mobileRemoteWorkspacePathPrompt,
    updateMobileRemoteWorkspacePathInput,
    cancelMobileRemoteWorkspacePathPrompt,
    submitMobileRemoteWorkspacePathPrompt,
    workspaceFromUrlPrompt,
    openWorkspaceFromUrlPrompt,
    closeWorkspaceFromUrlPrompt,
    chooseWorkspaceFromUrlDestinationPath,
    submitWorkspaceFromUrlPrompt,
    updateWorkspaceFromUrlUrl,
    updateWorkspaceFromUrlTargetFolderName,
    clearWorkspaceFromUrlDestinationPath,
    canSubmitWorkspaceFromUrlPrompt,
    removeWorkspace,
    removeWorktree,
  };
}
