// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getGitDiffs } from "../../../services/tauri";
import { logError } from "../../../services/logger";
import type { GitFileDiff, GitFileStatus, WorkspaceInfo } from "../../../types";
import { useGitDiffs } from "./useGitDiffs";

vi.mock("../../../services/tauri", () => ({
  getGitDiffs: vi.fn(),
}));

vi.mock("../../../services/logger", () => ({
  logError: vi.fn(),
}));

const workspace: WorkspaceInfo = {
  id: "workspace-1",
  name: "CodexMonitor",
  path: "/tmp/codex",
  connected: true,
  settings: { sidebarCollapsed: false },
};

const makeFiles = (): GitFileStatus[] => [
  { path: "src/main.ts", status: "M", additions: 3, deletions: 1 },
  { path: "README.md", status: "A", additions: 1, deletions: 0 },
];

const flushMicrotaskQueue = () =>
  new Promise<void>((resolve) => {
    queueMicrotask(resolve);
  });

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

describe("useGitDiffs", () => {
  beforeEach(() => {
    vi.mocked(getGitDiffs).mockResolvedValue([]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("fetches diffs and maps response by file path", async () => {
    const getGitDiffsMock = vi.mocked(getGitDiffs);
    const files = makeFiles();
    const diffs: GitFileDiff[] = [
      { path: "README.md", diff: "+hello" },
      { path: "src/main.ts", diff: "-old\n+new" },
    ];
    getGitDiffsMock.mockResolvedValueOnce(diffs);

    const { result } = renderHook(() =>
      useGitDiffs(workspace, files, true, false),
    );

    await act(async () => {
      await flushMicrotaskQueue();
    });

    expect(getGitDiffsMock).toHaveBeenCalledWith(workspace.id);
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.diffs).toEqual([
      {
        path: "src/main.ts",
        status: "M",
        diff: "-old\n+new",
        oldLines: undefined,
        newLines: undefined,
        isImage: undefined,
        oldImageData: undefined,
        newImageData: undefined,
        oldImageMime: undefined,
        newImageMime: undefined,
      },
      {
        path: "README.md",
        status: "A",
        diff: "+hello",
        oldLines: undefined,
        newLines: undefined,
        isImage: undefined,
        oldImageData: undefined,
        newImageData: undefined,
        oldImageMime: undefined,
        newImageMime: undefined,
      },
    ]);
  });

  it("reuses in-flight refresh and restores cached diffs when workspace switches back", async () => {
    const getGitDiffsMock = vi.mocked(getGitDiffs);
    const files = makeFiles();
    const firstDeferred = deferred<GitFileDiff[]>();
    getGitDiffsMock.mockReturnValueOnce(firstDeferred.promise);

    const { result, rerender } = renderHook(
      ({
        activeWorkspace,
        enabled,
      }: {
        activeWorkspace: WorkspaceInfo | null;
        enabled: boolean;
      }) => useGitDiffs(activeWorkspace, files, enabled, false),
      { initialProps: { activeWorkspace: workspace, enabled: false } },
    );

    await act(async () => {
      const firstRefresh = result.current.refresh();
      const secondRefresh = result.current.refresh();
      firstDeferred.resolve([{ path: "src/main.ts", diff: "+cache" }]);
      await Promise.all([firstRefresh, secondRefresh]);
    });

    expect(getGitDiffsMock).toHaveBeenCalledTimes(1);
    expect(result.current.diffs[0]?.diff).toBe("+cache");

    rerender({ activeWorkspace: null, enabled: false });
    expect(result.current.diffs).toEqual([
      expect.objectContaining({ path: "src/main.ts", diff: "" }),
      expect.objectContaining({ path: "README.md", diff: "" }),
    ]);

    rerender({ activeWorkspace: workspace, enabled: false });
    expect(getGitDiffsMock).toHaveBeenCalledTimes(1);
    expect(result.current.diffs[0]?.diff).toBe("+cache");
  });

  it("sets error state and logs when diff loading fails", async () => {
    const getGitDiffsMock = vi.mocked(getGitDiffs);
    const logErrorMock = vi.mocked(logError);
    const files = makeFiles();
    getGitDiffsMock.mockRejectedValueOnce(new Error("boom"));

    const { result } = renderHook(() =>
      useGitDiffs(workspace, files, true, false),
    );

    await act(async () => {
      await flushMicrotaskQueue();
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe("boom");
    expect(result.current.diffs).toEqual([
      expect.objectContaining({ path: "src/main.ts", diff: "" }),
      expect.objectContaining({ path: "README.md", diff: "" }),
    ]);
    expect(logErrorMock).toHaveBeenCalledWith(
      "useGitDiffs",
      "Failed to load git diffs",
      expect.objectContaining({
        workspaceId: workspace.id,
        error: "boom",
      }),
    );
  });

  it("returns empty state when no workspace and keeps empty diffs on empty payload", async () => {
    const getGitDiffsMock = vi.mocked(getGitDiffs);
    const files = makeFiles();
    getGitDiffsMock.mockResolvedValueOnce([]);

    const { result, rerender } = renderHook(
      ({ activeWorkspace }: { activeWorkspace: WorkspaceInfo | null }) =>
        useGitDiffs(activeWorkspace, files, true, false),
      { initialProps: { activeWorkspace: null } },
    );

    await act(async () => {
      await result.current.refresh();
    });

    expect(getGitDiffsMock).not.toHaveBeenCalled();
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.diffs).toEqual([
      expect.objectContaining({ path: "src/main.ts", diff: "" }),
      expect.objectContaining({ path: "README.md", diff: "" }),
    ]);

    rerender({ activeWorkspace: workspace });
    await act(async () => {
      await flushMicrotaskQueue();
    });

    expect(getGitDiffsMock).toHaveBeenCalledTimes(1);
    expect(result.current.error).toBeNull();
    expect(result.current.diffs).toEqual([
      expect.objectContaining({ path: "src/main.ts", diff: "" }),
      expect.objectContaining({ path: "README.md", diff: "" }),
    ]);
  });
});
