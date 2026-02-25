import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DebugEntry, WorkspaceInfo } from "../../../types";
import { getWorkspaceFiles } from "../../../services/tauri";

type UseWorkspaceFilesOptions = {
  activeWorkspace: WorkspaceInfo | null;
  onDebug?: (entry: DebugEntry) => void;
  enabled?: boolean;
  pollingEnabled?: boolean;
};

function areStringArraysEqual(a: string[], b: string[]) {
  if (a === b) {
    return true;
  }
  if (a.length !== b.length) {
    return false;
  }
  for (let index = 0; index < a.length; index += 1) {
    if (a[index] !== b[index]) {
      return false;
    }
  }
  return true;
}

const REFRESH_INTERVAL_MS = 5000;
const LARGE_REFRESH_INTERVAL_MS = 20000;
const LARGE_FILE_COUNT = 20000;
const MAX_POLL_BACKOFF_MULTIPLIER = 4;

function getPollingInterval(fileCount: number, unchangedPollCount: number) {
  const baseInterval =
    fileCount > LARGE_FILE_COUNT ? LARGE_REFRESH_INTERVAL_MS : REFRESH_INTERVAL_MS;
  const backoffMultiplier = Math.min(
    MAX_POLL_BACKOFF_MULTIPLIER,
    Math.max(1, unchangedPollCount + 1),
  );
  return baseInterval * backoffMultiplier;
}

function isLatestWorkspaceFilesResponse(
  latestRequestSeq: number,
  requestSeq: number,
  latestWorkspaceId: string | null,
  requestWorkspaceId: string,
) {
  return latestRequestSeq === requestSeq && latestWorkspaceId === requestWorkspaceId;
}

export function useWorkspaceFiles({
  activeWorkspace,
  onDebug,
  enabled = true,
  pollingEnabled,
}: UseWorkspaceFilesOptions) {
  const [files, setFiles] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const lastFetchedWorkspaceId = useRef<string | null>(null);
  const inFlight = useRef<number | null>(null);
  const latestRequestSeqRef = useRef(0);
  const unchangedPollCountRef = useRef(0);
  const pollingTimeoutRef = useRef<number | null>(null);
  const workspaceId = activeWorkspace?.id ?? null;
  const latestWorkspaceIdRef = useRef<string | null>(workspaceId);
  const isConnected = Boolean(activeWorkspace?.connected);
  const isEnabled = enabled;
  const isPollingEnabled = pollingEnabled ?? isEnabled;

  const refreshFiles = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;
    if (!workspaceId || !isConnected || !isEnabled) {
      return false;
    }
    if (inFlight.current !== null) {
      return false;
    }
    const requestSeq = latestRequestSeqRef.current + 1;
    latestRequestSeqRef.current = requestSeq;
    inFlight.current = requestSeq;
    const requestWorkspaceId = workspaceId;
    if (!silent) {
      setIsLoading(true);
      onDebug?.({
        id: `${Date.now()}-client-files-list`,
        timestamp: Date.now(),
        source: "client",
        label: "files/list",
        payload: { workspaceId: requestWorkspaceId, requestSeq },
      });
    }
    let changed = false;
    try {
      const response = await getWorkspaceFiles(requestWorkspaceId);
      const isLatestResponse = isLatestWorkspaceFilesResponse(
        latestRequestSeqRef.current,
        requestSeq,
        latestWorkspaceIdRef.current,
        requestWorkspaceId,
      );
      if (!isLatestResponse) {
        onDebug?.({
          id: `${Date.now()}-server-files-list-stale`,
          timestamp: Date.now(),
          source: "server",
          label: "files/list stale response ignored",
          payload: {
            requestWorkspaceId,
            latestWorkspaceId: latestWorkspaceIdRef.current,
            requestSeq,
            latestRequestSeq: latestRequestSeqRef.current,
          },
        });
        return false;
      }
      const nextFiles = Array.isArray(response) ? response : [];
      setFiles((prev) => {
        changed = !areStringArraysEqual(prev, nextFiles);
        if (changed || !silent) {
          onDebug?.({
            id: `${Date.now()}-server-files-list`,
            timestamp: Date.now(),
            source: "server",
            label: "files/list response",
            payload: {
              workspaceId: requestWorkspaceId,
              fileCount: nextFiles.length,
              changed,
              requestSeq,
            },
          });
        }
        return changed ? nextFiles : prev;
      });
      lastFetchedWorkspaceId.current = requestWorkspaceId;
      return changed;
    } catch (error) {
      onDebug?.({
        id: `${Date.now()}-client-files-list-error`,
        timestamp: Date.now(),
        source: "error",
        label: "files/list error",
        payload: error instanceof Error ? error.message : String(error),
      });
      return false;
    } finally {
      if (inFlight.current === requestSeq) {
        inFlight.current = null;
      }
      if (
        !silent &&
        isLatestWorkspaceFilesResponse(
          latestRequestSeqRef.current,
          requestSeq,
          latestWorkspaceIdRef.current,
          requestWorkspaceId,
        )
      ) {
        setIsLoading(false);
      }
    }
  }, [isConnected, isEnabled, onDebug, workspaceId]);

  useEffect(() => {
    latestWorkspaceIdRef.current = workspaceId;
  }, [workspaceId]);

  useEffect(() => {
    setFiles([]);
    lastFetchedWorkspaceId.current = null;
    inFlight.current = null;
    latestRequestSeqRef.current += 1;
    unchangedPollCountRef.current = 0;
    if (pollingTimeoutRef.current !== null) {
      window.clearTimeout(pollingTimeoutRef.current);
      pollingTimeoutRef.current = null;
    }
  }, [isConnected, workspaceId]);

  useEffect(() => {
    setIsLoading(Boolean(workspaceId && isConnected && isEnabled));
  }, [isConnected, isEnabled, workspaceId]);

  useEffect(() => {
    if (!workspaceId || !isConnected || !isEnabled) {
      return;
    }
    if (lastFetchedWorkspaceId.current === workspaceId && files.length > 0) {
      return;
    }
    refreshFiles({ silent: false }).catch(() => {});
  }, [files.length, isConnected, isEnabled, refreshFiles, workspaceId]);

  useEffect(() => {
    if (!workspaceId || !isConnected || !isPollingEnabled) {
      return;
    }
    let cancelled = false;

    const scheduleNext = () => {
      if (cancelled) {
        return;
      }
      const refreshInterval = getPollingInterval(files.length, unchangedPollCountRef.current);
      pollingTimeoutRef.current = window.setTimeout(async () => {
        const changed = await refreshFiles({ silent: true });
        if (changed) {
          unchangedPollCountRef.current = 0;
        } else {
          unchangedPollCountRef.current += 1;
        }
        scheduleNext();
      }, refreshInterval);
    };

    scheduleNext();

    return () => {
      cancelled = true;
      if (pollingTimeoutRef.current !== null) {
        window.clearTimeout(pollingTimeoutRef.current);
        pollingTimeoutRef.current = null;
      }
    };
  }, [files.length, isConnected, isPollingEnabled, refreshFiles, workspaceId]);

  const fileOptions = useMemo(() => files.filter(Boolean), [files]);

  return {
    files: fileOptions,
    isLoading,
    refreshFiles,
  };
}

type VitestLike = {
  describe: (name: string, fn: () => void) => void;
  it: (name: string, fn: () => void) => void;
  expect: (value: unknown) => {
    toBe: (expected: unknown) => void;
  };
};

const vitest = (import.meta as ImportMeta & { vitest?: VitestLike }).vitest;
if (vitest) {
  const { describe, it, expect } = vitest;

  describe("isLatestWorkspaceFilesResponse", () => {
    it("accepts only latest seq on same workspace", () => {
      expect(isLatestWorkspaceFilesResponse(3, 3, "ws-a", "ws-a")).toBe(true);
      expect(isLatestWorkspaceFilesResponse(4, 3, "ws-a", "ws-a")).toBe(false);
      expect(isLatestWorkspaceFilesResponse(3, 3, "ws-b", "ws-a")).toBe(false);
    });
  });
}
