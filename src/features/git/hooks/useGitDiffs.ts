import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getGitDiffs } from "../../../services/tauri";
import { logError } from "../../../services/logger";
import type { GitFileDiff, GitFileStatus, WorkspaceInfo } from "../../../types";
import { BoundedCache } from "../../../utils/boundedCache";

type GitDiffState = {
  diffs: GitFileDiff[];
  isLoading: boolean;
  error: string | null;
};

const emptyState: GitDiffState = {
  diffs: [],
  isLoading: false,
  error: null,
};

const GIT_DIFFS_CACHE_MAX_ENTRIES = 32;
const GIT_DIFFS_CACHE_TTL_MS = 5 * 60 * 1000;

export function useGitDiffs(
  activeWorkspace: WorkspaceInfo | null,
  files: GitFileStatus[],
  enabled: boolean,
  ignoreWhitespaceChanges: boolean,
) {
  const [state, setState] = useState<GitDiffState>(emptyState);
  const requestIdRef = useRef(0);
  const cacheKeyRef = useRef<string | null>(null);
  const cachedDiffsRef = useRef(
    new BoundedCache<string, GitFileDiff[]>(
      GIT_DIFFS_CACHE_MAX_ENTRIES,
      GIT_DIFFS_CACHE_TTL_MS,
    ),
  );
  const inFlightRefreshRef = useRef<Promise<void> | null>(null);
  const inFlightCacheKeyRef = useRef<string | null>(null);

  const fileKey = useMemo(
    () =>
      files
        .map((file) => `${file.path}:${file.status}`)
        .sort()
        .join("|"),
    [files],
  );

  const refresh = useCallback(async () => {
    if (!activeWorkspace) {
      setState(emptyState);
      return;
    }
    const workspaceId = activeWorkspace.id;
    const cacheKey = `${workspaceId}|ignoreWhitespaceChanges:${ignoreWhitespaceChanges ? "1" : "0"}`;
    if (
      inFlightRefreshRef.current &&
      inFlightCacheKeyRef.current === cacheKey
    ) {
      return inFlightRefreshRef.current;
    }
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    const refreshPromise = getGitDiffs(workspaceId)
      .then((diffs) => {
        if (
          requestIdRef.current !== requestId ||
          cacheKeyRef.current !== cacheKey
        ) {
          return;
        }
        setState({ diffs, isLoading: false, error: null });
        cachedDiffsRef.current.set(cacheKey, diffs);
      })
      .catch((error) => {
        console.error("Failed to load git diffs", error);
        logError("useGitDiffs", "Failed to load git diffs", {
          workspaceId,
          cacheKey,
          error: error instanceof Error ? error.message : String(error),
        });
        if (
          requestIdRef.current !== requestId ||
          cacheKeyRef.current !== cacheKey
        ) {
          return;
        }
        setState({
          diffs: [],
          isLoading: false,
          error: error instanceof Error ? error.message : String(error),
        });
      })
      .finally(() => {
        if (inFlightRefreshRef.current === refreshPromise) {
          inFlightRefreshRef.current = null;
          inFlightCacheKeyRef.current = null;
        }
      });
    inFlightRefreshRef.current = refreshPromise;
    inFlightCacheKeyRef.current = cacheKey;
    return refreshPromise;
  }, [activeWorkspace, ignoreWhitespaceChanges]);

  useEffect(() => {
    const workspaceId = activeWorkspace?.id ?? null;
    const nextCacheKey = workspaceId
      ? `${workspaceId}|ignoreWhitespaceChanges:${ignoreWhitespaceChanges ? "1" : "0"}`
      : null;
    if (cacheKeyRef.current !== nextCacheKey) {
      cacheKeyRef.current = nextCacheKey;
      requestIdRef.current += 1;
      inFlightRefreshRef.current = null;
      inFlightCacheKeyRef.current = null;
      if (!nextCacheKey) {
        setState(emptyState);
        return;
      }
      const cached = cachedDiffsRef.current.get(nextCacheKey);
      setState({
        diffs: cached ?? [],
        isLoading: false,
        error: null,
      });
    }
  }, [activeWorkspace?.id, ignoreWhitespaceChanges]);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    void refresh();
  }, [enabled, fileKey, refresh]);

  const orderedDiffs = useMemo(() => {
    const diffByPath = new Map(
      state.diffs.map((entry) => [entry.path, entry]),
    );
    return files.map((file) => {
      const entry = diffByPath.get(file.path);
      return {
        path: file.path,
        status: file.status,
        diff: entry?.diff ?? "",
        oldLines: entry?.oldLines,
        newLines: entry?.newLines,
        isImage: entry?.isImage,
        oldImageData: entry?.oldImageData,
        newImageData: entry?.newImageData,
        oldImageMime: entry?.oldImageMime,
        newImageMime: entry?.newImageMime,
      };
    });
  }, [files, state.diffs]);

  return {
    diffs: orderedDiffs,
    isLoading: state.isLoading,
    error: state.error,
    refresh,
  };
}
