// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { GitHubPullRequestComment, WorkspaceInfo } from "../../../types";
import { getGitHubPullRequestComments } from "../../../services/tauri";
import { useGitHubPullRequestComments } from "./useGitHubPullRequestComments";

vi.mock("../../../services/tauri", () => ({
  getGitHubPullRequestComments: vi.fn(),
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const workspaceA: WorkspaceInfo = {
  id: "workspace-a",
  name: "Workspace A",
  path: "/tmp/workspace-a",
  connected: true,
  settings: { sidebarCollapsed: false },
};

const workspaceB: WorkspaceInfo = {
  id: "workspace-b",
  name: "Workspace B",
  path: "/tmp/workspace-b",
  connected: true,
  settings: { sidebarCollapsed: false },
};

const firstBatch: GitHubPullRequestComment[] = [
  {
    id: 1,
    body: "first",
    createdAt: "2026-01-01T00:00:00Z",
    url: "https://example.com/1",
    author: { login: "alice" },
  },
];

const secondBatch: GitHubPullRequestComment[] = [
  {
    id: 2,
    body: "second",
    createdAt: "2026-01-02T00:00:00Z",
    url: "https://example.com/2",
    author: { login: "bob" },
  },
];

describe("useGitHubPullRequestComments", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("loads comments when enabled and supports manual refresh", async () => {
    const getCommentsMock = vi.mocked(getGitHubPullRequestComments);
    getCommentsMock.mockResolvedValueOnce(firstBatch).mockResolvedValueOnce(secondBatch);

    const { result, rerender } = renderHook(
      ({
        activeWorkspace,
        prNumber,
        enabled,
      }: {
        activeWorkspace: WorkspaceInfo | null;
        prNumber: number | null;
        enabled: boolean;
      }) => useGitHubPullRequestComments(activeWorkspace, prNumber, enabled),
      { initialProps: { activeWorkspace: workspaceA, prNumber: 7, enabled: false } },
    );

    expect(result.current.comments).toEqual([]);
    expect(getCommentsMock).not.toHaveBeenCalled();

    rerender({ activeWorkspace: workspaceA, prNumber: 7, enabled: true });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.comments).toEqual(firstBatch);
    expect(result.current.error).toBeNull();

    await act(async () => {
      await result.current.refresh();
    });
    await waitFor(() => expect(result.current.comments).toEqual(secondBatch));
    expect(getCommentsMock).toHaveBeenCalledTimes(2);
    expect(getCommentsMock).toHaveBeenLastCalledWith("workspace-a", 7);
  });

  it("resets to empty state and skips fetch when workspace or PR is missing", async () => {
    const getCommentsMock = vi.mocked(getGitHubPullRequestComments);

    const { result } = renderHook(() =>
      useGitHubPullRequestComments(null, null, true),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.comments).toEqual([]);
    expect(result.current.error).toBeNull();
    expect(getCommentsMock).not.toHaveBeenCalled();

    await result.current.refresh();
    expect(getCommentsMock).not.toHaveBeenCalled();
  });

  it("ignores stale responses after workspace switch", async () => {
    const getCommentsMock = vi.mocked(getGitHubPullRequestComments);
    const firstRequest = deferred<GitHubPullRequestComment[]>();
    const secondRequest = deferred<GitHubPullRequestComment[]>();
    getCommentsMock.mockReturnValueOnce(firstRequest.promise).mockReturnValueOnce(secondRequest.promise);

    const { result, rerender } = renderHook(
      ({
        activeWorkspace,
        prNumber,
      }: {
        activeWorkspace: WorkspaceInfo | null;
        prNumber: number | null;
      }) => useGitHubPullRequestComments(activeWorkspace, prNumber, true),
      { initialProps: { activeWorkspace: workspaceA, prNumber: 10 } },
    );

    rerender({ activeWorkspace: workspaceB, prNumber: 10 });
    await waitFor(() => expect(getCommentsMock).toHaveBeenCalledTimes(2));

    secondRequest.resolve(secondBatch);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.comments).toEqual(secondBatch);
    expect(result.current.error).toBeNull();

    firstRequest.resolve(firstBatch);
    await waitFor(() => expect(result.current.comments).toEqual(secondBatch));
  });

  it("captures string errors from the latest request", async () => {
    const getCommentsMock = vi.mocked(getGitHubPullRequestComments);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    getCommentsMock.mockRejectedValueOnce("request failed");

    const { result } = renderHook(() =>
      useGitHubPullRequestComments(workspaceA, 99, true),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBe("request failed");
    expect(result.current.comments).toEqual([]);

    errorSpy.mockRestore();
  });
});
