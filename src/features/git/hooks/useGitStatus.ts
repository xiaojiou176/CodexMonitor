import { useCallback, useEffect, useRef, useState } from "react";
import type { GitFileStatus, WorkspaceInfo } from "../../../types";
import { getGitStatus } from "../../../services/tauri";
import { BoundedCache } from "../../../utils/boundedCache";

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

const FAST_POLL_INTERVAL_MS = 3000;
const ERROR_POLL_INTERVAL_MS = 5000;
const IDLE_POLL_INTERVAL_MS = 12000;
const HIDDEN_POLL_INTERVAL_MS = 20000;
const GIT_STATUS_CACHE_MAX_ENTRIES = 64;
const GIT_STATUS_CACHE_TTL_MS = 60 * 1000;

type UseGitStatusOptions = {
  preferFastPolling?: boolean;
};

export function useGitStatus(
  activeWorkspace: WorkspaceInfo | null,
  options: UseGitStatusOptions = {},
) {
  const [status, setStatus] = useState<GitStatusState>(emptyStatus);
  const requestIdRef = useRef(0);
  const workspaceIdRef = useRef<string | null>(activeWorkspace?.id ?? null);
  const cachedStatusRef = useRef(
    new BoundedCache<string, GitStatusState>(
      GIT_STATUS_CACHE_MAX_ENTRIES,
      GIT_STATUS_CACHE_TTL_MS,
    ),
  );
  const inFlightRefreshRef = useRef<Promise<void> | null>(null);
  const inFlightWorkspaceIdRef = useRef<string | null>(null);
  const statusRef = useRef<GitStatusState>(emptyStatus);
  const workspaceId = activeWorkspace?.id ?? null;
  const preferFastPolling = options.preferFastPolling ?? false;

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
    statusRef.current = status;
  }, [status]);

  const getNextPollInterval = useCallback(() => {
    if (document.visibilityState !== "visible") {
      return HIDDEN_POLL_INTERVAL_MS;
    }
    const current = statusRef.current;
    const hasChanges =
      current.files.length > 0 ||
      current.stagedFiles.length > 0 ||
      current.unstagedFiles.length > 0;
    if (preferFastPolling || hasChanges) {
      return FAST_POLL_INTERVAL_MS;
    }
    if (current.error) {
      return ERROR_POLL_INTERVAL_MS;
    }
    return IDLE_POLL_INTERVAL_MS;
  }, [preferFastPolling]);

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
    let disposed = false;
    let timeoutId: number | null = null;

    const scheduleNextPoll = () => {
      if (disposed) {
        return;
      }
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
      timeoutId = window.setTimeout(triggerPoll, getNextPollInterval());
    };

    const triggerPoll = () => {
      if (disposed) {
        return;
      }
      if (document.visibilityState !== "visible") {
        scheduleNextPoll();
        return;
      }
      refresh()
        .catch(() => {})
        .finally(() => {
          scheduleNextPoll();
        });
    };

    const handleFocus = () => triggerPoll();
    const handleVisibilityChange = () => triggerPoll();

    triggerPoll();
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      disposed = true;
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [getNextPollInterval, refresh, workspaceId]);

  return { status, refresh };
}
