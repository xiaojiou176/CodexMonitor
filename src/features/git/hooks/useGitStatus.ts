import { useCallback, useEffect, useRef, useState } from "react";
import type { GitFileStatus, WorkspaceInfo } from "../../../types";
import { getGitStatus } from "../../../services/tauri";

type GitStatusState = {
  branchName: string;
  files: GitFileStatus[];
  stagedFiles: GitFileStatus[];
  unstagedFiles: GitFileStatus[];
  totalAdditions: number;
  totalDeletions: number;
  error: string | null;
};

const emptyStatus: GitStatusState = {
  branchName: "",
  files: [],
  stagedFiles: [],
  unstagedFiles: [],
  totalAdditions: 0,
  totalDeletions: 0,
  error: null,
};

const REFRESH_INTERVAL_MS = 3000;
export function useGitStatus(activeWorkspace: WorkspaceInfo | null) {
  const [status, setStatus] = useState<GitStatusState>(emptyStatus);
  const requestIdRef = useRef(0);
  const workspaceIdRef = useRef<string | null>(activeWorkspace?.id ?? null);
  const cachedStatusRef = useRef<Map<string, GitStatusState>>(new Map());
  const inFlightRefreshRef = useRef<Promise<void> | null>(null);
  const inFlightWorkspaceIdRef = useRef<string | null>(null);
  const workspaceId = activeWorkspace?.id ?? null;

  const resolveBranchName = useCallback(
    (incoming: string | undefined, cached: GitStatusState | undefined) => {
      const trimmed = incoming?.trim();
      if (trimmed && trimmed !== "unknown") {
        return trimmed;
      }
      const cachedBranch = cached?.branchName?.trim();
      return cachedBranch && cachedBranch !== "unknown"
        ? cachedBranch
        : trimmed ?? "";
    },
    [],
  );

  const refresh = useCallback(() => {
    if (!workspaceId) {
      setStatus(emptyStatus);
      return Promise.resolve();
    }
    if (
      inFlightRefreshRef.current &&
      inFlightWorkspaceIdRef.current === workspaceId
    ) {
      return inFlightRefreshRef.current;
    }
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    const refreshPromise = getGitStatus(workspaceId)
      .then((data) => {
        if (
          requestIdRef.current !== requestId ||
          workspaceIdRef.current !== workspaceId
        ) {
          return;
        }
        const cached = cachedStatusRef.current.get(workspaceId);
        const resolvedBranchName = resolveBranchName(data.branchName, cached);
        const nextStatus = {
          ...data,
          branchName: resolvedBranchName,
          error: null,
        };
        setStatus(nextStatus);
        cachedStatusRef.current.set(workspaceId, nextStatus);
      })
      .catch((err) => {
        console.error("Failed to load git status", err);
        if (
          requestIdRef.current !== requestId ||
          workspaceIdRef.current !== workspaceId
        ) {
          return;
        }
        const message = err instanceof Error ? err.message : String(err);
        const cached = cachedStatusRef.current.get(workspaceId);
        const nextStatus = cached
          ? { ...cached, error: message }
          : { ...emptyStatus, branchName: "unknown", error: message };
        setStatus(nextStatus);
      })
      .finally(() => {
        if (inFlightRefreshRef.current === refreshPromise) {
          inFlightRefreshRef.current = null;
          inFlightWorkspaceIdRef.current = null;
        }
      });
    inFlightRefreshRef.current = refreshPromise;
    inFlightWorkspaceIdRef.current = workspaceId;
    return refreshPromise;
  }, [resolveBranchName, workspaceId]);

  useEffect(() => {
    if (workspaceIdRef.current !== workspaceId) {
      workspaceIdRef.current = workspaceId;
      requestIdRef.current += 1;
      inFlightRefreshRef.current = null;
      inFlightWorkspaceIdRef.current = null;
      if (!workspaceId) {
        setStatus(emptyStatus);
        return;
      }
      const cached = cachedStatusRef.current.get(workspaceId);
      setStatus(cached ?? emptyStatus);
    }
  }, [workspaceId]);

  useEffect(() => {
    if (!workspaceId) {
      setStatus(emptyStatus);
      return;
    }

    const fetchStatus = () => {
      if (document.visibilityState !== "visible") {
        return;
      }
      refresh().catch(() => {});
    };
    const handleFocus = () => fetchStatus();
    const handleVisibilityChange = () => fetchStatus();

    refresh().catch(() => {});
    const interval = window.setInterval(fetchStatus, REFRESH_INTERVAL_MS);
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [refresh, workspaceId]);

  return { status, refresh };
}
