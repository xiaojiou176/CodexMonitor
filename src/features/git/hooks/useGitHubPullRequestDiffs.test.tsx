// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { GitHubPullRequestDiff, WorkspaceInfo } from "../../../types";
import { getGitHubPullRequestDiff } from "../../../services/tauri";
import { useGitHubPullRequestDiffs } from "./useGitHubPullRequestDiffs";

vi.mock("../../../services/tauri", () => ({
  getGitHubPullRequestDiff: vi.fn(),
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

const workspace: WorkspaceInfo = {
  id: "workspace-1",
  name: "Workspace",
  path: "/tmp/workspace",
  connected: true,
  settings: { sidebarCollapsed: false },
};

const diffsA: GitHubPullRequestDiff[] = [
  { path: "src/a.ts", status: "modified", diff: "@@ -1 +1 @@" },
];

const diffsB: GitHubPullRequestDiff[] = [
  { path: "src/b.ts", status: "added", diff: "@@ -0,0 +1 @@" },
];

describe("useGitHubPullRequestDiffs", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("loads PR diffs when enabled and updates with manual refresh", async () => {
    const getDiffMock = vi.mocked(getGitHubPullRequestDiff);
    getDiffMock.mockResolvedValueOnce(diffsA).mockResolvedValueOnce(diffsB);

    const { result } = renderHook(() =>
      useGitHubPullRequestDiffs(workspace, 55, true),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.diffs).toEqual(diffsA);
    expect(result.current.error).toBeNull();

    await act(async () => {
      await result.current.refresh();
    });
    await waitFor(() => expect(result.current.diffs).toEqual(diffsB));
    expect(getDiffMock).toHaveBeenCalledTimes(2);
    expect(getDiffMock).toHaveBeenLastCalledWith("workspace-1", 55);
  });

  it("resets state and avoids fetch when missing workspace or PR number", async () => {
    const getDiffMock = vi.mocked(getGitHubPullRequestDiff);
    const { result } = renderHook(() =>
      useGitHubPullRequestDiffs(workspace, null, true),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.diffs).toEqual([]);
    expect(result.current.error).toBeNull();
    expect(getDiffMock).not.toHaveBeenCalled();

    await result.current.refresh();
    expect(getDiffMock).not.toHaveBeenCalled();
  });

  it("ignores stale diff response after PR number switch", async () => {
    const getDiffMock = vi.mocked(getGitHubPullRequestDiff);
    const slow = deferred<GitHubPullRequestDiff[]>();
    const fast = deferred<GitHubPullRequestDiff[]>();
    getDiffMock.mockReturnValueOnce(slow.promise).mockReturnValueOnce(fast.promise);

    const { result, rerender } = renderHook(
      ({ prNumber }: { prNumber: number | null }) =>
        useGitHubPullRequestDiffs(workspace, prNumber, true),
      { initialProps: { prNumber: 100 } },
    );

    rerender({ prNumber: 101 });
    await waitFor(() => expect(getDiffMock).toHaveBeenCalledTimes(2));

    fast.resolve(diffsB);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.diffs).toEqual(diffsB);

    slow.resolve(diffsA);
    await waitFor(() => expect(result.current.diffs).toEqual(diffsB));
  });
});
