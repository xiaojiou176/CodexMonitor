// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useGitHubPanelController } from "./useGitHubPanelController";

describe("useGitHubPanelController", () => {
  it("initializes panel data state with empty values", () => {
    const { result } = renderHook(() => useGitHubPanelController());

    expect(result.current.gitIssues).toEqual([]);
    expect(result.current.gitIssuesTotal).toBe(0);
    expect(result.current.gitIssuesLoading).toBe(false);
    expect(result.current.gitIssuesError).toBeNull();

    expect(result.current.gitPullRequests).toEqual([]);
    expect(result.current.gitPullRequestsTotal).toBe(0);
    expect(result.current.gitPullRequestsLoading).toBe(false);
    expect(result.current.gitPullRequestsError).toBeNull();

    expect(result.current.gitPullRequestDiffs).toEqual([]);
    expect(result.current.gitPullRequestDiffsLoading).toBe(false);
    expect(result.current.gitPullRequestDiffsError).toBeNull();

    expect(result.current.gitPullRequestComments).toEqual([]);
    expect(result.current.gitPullRequestCommentsLoading).toBe(false);
    expect(result.current.gitPullRequestCommentsError).toBeNull();
  });

  it("toggles issue panel loading and error state through issue mode updates", () => {
    const { result } = renderHook(() => useGitHubPanelController());
    const issue = {
      id: 1,
      number: 12,
      title: "Fix panel visibility",
      state: "open",
      htmlUrl: "https://example.com/issues/12",
      user: { login: "alice", avatarUrl: null, htmlUrl: null },
      labels: [],
      comments: 0,
      createdAt: "2026-02-01T00:00:00Z",
      updatedAt: "2026-02-02T00:00:00Z",
    };

    act(() => {
      result.current.handleGitIssuesChange({
        issues: [issue],
        total: 1,
        isLoading: true,
        error: "timeout",
      });
    });

    expect(result.current.gitIssuesTotal).toBe(1);
    expect(result.current.gitIssuesLoading).toBe(true);
    expect(result.current.gitIssuesError).toBe("timeout");

    act(() => {
      result.current.handleGitIssuesChange({
        issues: [issue],
        total: 1,
        isLoading: false,
        error: null,
      });
    });

    expect(result.current.gitIssuesLoading).toBe(false);
    expect(result.current.gitIssuesError).toBeNull();
  });

  it("switches between issues, pull-requests, diffs, and comments states independently", () => {
    const { result } = renderHook(() => useGitHubPanelController());
    const issue = {
      id: 2,
      number: 20,
      title: "Issue mode data",
      state: "open",
      htmlUrl: "https://example.com/issues/20",
      user: { login: "bob", avatarUrl: null, htmlUrl: null },
      labels: [],
      comments: 1,
      createdAt: "2026-02-03T00:00:00Z",
      updatedAt: "2026-02-04T00:00:00Z",
    };
    const pullRequest = {
      id: 10,
      number: 99,
      title: "PR mode data",
      state: "open",
      htmlUrl: "https://example.com/pulls/99",
      user: { login: "carol", avatarUrl: null, htmlUrl: null },
      labels: [],
      comments: 2,
      commits: 3,
      changedFiles: 4,
      additions: 5,
      deletions: 1,
      draft: false,
      createdAt: "2026-02-05T00:00:00Z",
      updatedAt: "2026-02-06T00:00:00Z",
      mergedAt: null,
      baseRefName: "main",
      headRefName: "feature/test",
    };
    const diff = {
      path: "src/App.tsx",
      status: "modified",
      additions: 3,
      deletions: 1,
      patch: "@@ -1 +1 @@",
    };
    const comment = {
      id: 300,
      body: "Looks good",
      path: "src/App.tsx",
      position: 1,
      commitId: "abc123",
      createdAt: "2026-02-07T00:00:00Z",
      updatedAt: "2026-02-07T01:00:00Z",
      user: { login: "dave", avatarUrl: null, htmlUrl: null },
      htmlUrl: "https://example.com/comment/300",
    };

    act(() => {
      result.current.handleGitIssuesChange({
        issues: [issue],
        total: 1,
        isLoading: false,
        error: null,
      });
      result.current.handleGitPullRequestsChange({
        pullRequests: [pullRequest],
        total: 1,
        isLoading: false,
        error: null,
      });
      result.current.handleGitPullRequestDiffsChange({
        diffs: [diff],
        isLoading: false,
        error: null,
      });
      result.current.handleGitPullRequestCommentsChange({
        comments: [comment],
        isLoading: false,
        error: null,
      });
    });

    expect(result.current.gitIssues).toEqual([issue]);
    expect(result.current.gitPullRequests).toEqual([pullRequest]);
    expect(result.current.gitPullRequestDiffs).toEqual([diff]);
    expect(result.current.gitPullRequestComments).toEqual([comment]);
  });

  it("skips rerender when dependency-like inputs are unchanged", () => {
    let renderCount = 0;
    const { result } = renderHook(() => {
      renderCount += 1;
      return useGitHubPanelController();
    });

    const currentIssues = result.current.gitIssues;

    act(() => {
      result.current.handleGitIssuesChange({
        issues: currentIssues,
        total: 0,
        isLoading: false,
        error: null,
      });
    });

    expect(renderCount).toBe(1);

    act(() => {
      result.current.handleGitIssuesChange({
        issues: [],
        total: 1,
        isLoading: false,
        error: "changed",
      });
    });

    expect(renderCount).toBe(2);
  });

  it("updates and clears pull request, diff, and comment error paths", () => {
    const { result } = renderHook(() => useGitHubPanelController());

    act(() => {
      result.current.handleGitPullRequestsChange({
        pullRequests: [],
        total: 0,
        isLoading: false,
        error: "pr error",
      });
      result.current.handleGitPullRequestDiffsChange({
        diffs: [],
        isLoading: false,
        error: "diff error",
      });
      result.current.handleGitPullRequestCommentsChange({
        comments: [],
        isLoading: false,
        error: "comment error",
      });
    });

    expect(result.current.gitPullRequestsError).toBe("pr error");
    expect(result.current.gitPullRequestDiffsError).toBe("diff error");
    expect(result.current.gitPullRequestCommentsError).toBe("comment error");

    act(() => {
      result.current.resetGitHubPanelState();
    });

    expect(result.current.gitPullRequestsError).toBeNull();
    expect(result.current.gitPullRequestDiffsError).toBeNull();
    expect(result.current.gitPullRequestCommentsError).toBeNull();
  });

  it("skips rerender for unchanged pull request, diff, and comment inputs", () => {
    let renderCount = 0;
    const { result } = renderHook(() => {
      renderCount += 1;
      return useGitHubPanelController();
    });

    const currentPullRequests = result.current.gitPullRequests;
    const currentDiffs = result.current.gitPullRequestDiffs;
    const currentComments = result.current.gitPullRequestComments;

    act(() => {
      result.current.handleGitPullRequestsChange({
        pullRequests: currentPullRequests,
        total: 0,
        isLoading: false,
        error: null,
      });
      result.current.handleGitPullRequestDiffsChange({
        diffs: currentDiffs,
        isLoading: false,
        error: null,
      });
      result.current.handleGitPullRequestCommentsChange({
        comments: currentComments,
        isLoading: false,
        error: null,
      });
    });

    expect(renderCount).toBe(1);
  });
});
