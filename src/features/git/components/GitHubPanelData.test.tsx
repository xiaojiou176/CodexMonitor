/** @vitest-environment jsdom */
import { render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspaceInfo } from "../../../types";
import { GitHubPanelData } from "./GitHubPanelData";

const useGitHubIssuesMock = vi.hoisted(() => vi.fn());
const useGitHubPullRequestsMock = vi.hoisted(() => vi.fn());
const useGitHubPullRequestDiffsMock = vi.hoisted(() => vi.fn());
const useGitHubPullRequestCommentsMock = vi.hoisted(() => vi.fn());

vi.mock("../hooks/useGitHubIssues", () => ({
  useGitHubIssues: (...args: unknown[]) => useGitHubIssuesMock(...args),
}));

vi.mock("../hooks/useGitHubPullRequests", () => ({
  useGitHubPullRequests: (...args: unknown[]) => useGitHubPullRequestsMock(...args),
}));

vi.mock("../hooks/useGitHubPullRequestDiffs", () => ({
  useGitHubPullRequestDiffs: (...args: unknown[]) =>
    useGitHubPullRequestDiffsMock(...args),
}));

vi.mock("../hooks/useGitHubPullRequestComments", () => ({
  useGitHubPullRequestComments: (...args: unknown[]) =>
    useGitHubPullRequestCommentsMock(...args),
}));

const workspace: WorkspaceInfo = {
  id: "workspace-1",
  name: "CodexMonitor",
  path: "/tmp/codex-monitor",
  connected: true,
  settings: { sidebarCollapsed: false },
};

describe("GitHubPanelData", () => {
  beforeEach(() => {
    useGitHubIssuesMock.mockReturnValue({
      issues: [],
      total: 0,
      isLoading: false,
      error: null,
    });
    useGitHubPullRequestsMock.mockReturnValue({
      pullRequests: [],
      total: 0,
      isLoading: false,
      error: null,
    });
    useGitHubPullRequestDiffsMock.mockReturnValue({
      diffs: [],
      isLoading: false,
      error: null,
    });
    useGitHubPullRequestCommentsMock.mockReturnValue({
      comments: [],
      isLoading: false,
      error: null,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("forwards empty state callbacks and disables hook loading flags when context is inactive", async () => {
    const onIssuesChange = vi.fn();
    const onPullRequestsChange = vi.fn();
    const onPullRequestDiffsChange = vi.fn();
    const onPullRequestCommentsChange = vi.fn();

    const { container } = render(
      <GitHubPanelData
        activeWorkspace={null}
        gitPanelMode="diff"
        shouldLoadDiffs={false}
        diffSource="local"
        selectedPullRequestNumber={null}
        onIssuesChange={onIssuesChange}
        onPullRequestsChange={onPullRequestsChange}
        onPullRequestDiffsChange={onPullRequestDiffsChange}
        onPullRequestCommentsChange={onPullRequestCommentsChange}
      />,
    );

    expect(container.firstChild).toBeNull();
    expect(useGitHubIssuesMock).toHaveBeenCalledWith(null, false);
    expect(useGitHubPullRequestsMock).toHaveBeenCalledWith(null, false);
    expect(useGitHubPullRequestDiffsMock).toHaveBeenCalledWith(null, null, false);
    expect(useGitHubPullRequestCommentsMock).toHaveBeenCalledWith(null, null, false);

    await waitFor(() => {
      expect(onIssuesChange).toHaveBeenCalledWith({
        issues: [],
        total: 0,
        isLoading: false,
        error: null,
      });
      expect(onPullRequestsChange).toHaveBeenCalledWith({
        pullRequests: [],
        total: 0,
        isLoading: false,
        error: null,
      });
      expect(onPullRequestDiffsChange).toHaveBeenCalledWith({
        diffs: [],
        isLoading: false,
        error: null,
      });
      expect(onPullRequestCommentsChange).toHaveBeenCalledWith({
        comments: [],
        isLoading: false,
        error: null,
      });
    });
  });

  it("enables PR data hooks and forwards error states", async () => {
    const onIssuesChange = vi.fn();
    const onPullRequestsChange = vi.fn();
    const onPullRequestDiffsChange = vi.fn();
    const onPullRequestCommentsChange = vi.fn();

    useGitHubIssuesMock.mockReturnValue({
      issues: [],
      total: 0,
      isLoading: false,
      error: "issues-error",
    });
    useGitHubPullRequestsMock.mockReturnValue({
      pullRequests: [],
      total: 0,
      isLoading: false,
      error: "prs-error",
    });
    useGitHubPullRequestDiffsMock.mockReturnValue({
      diffs: [],
      isLoading: false,
      error: "diff-error",
    });
    useGitHubPullRequestCommentsMock.mockReturnValue({
      comments: [],
      isLoading: false,
      error: "comments-error",
    });

    render(
      <GitHubPanelData
        activeWorkspace={workspace}
        gitPanelMode="prs"
        shouldLoadDiffs={true}
        diffSource="pr"
        selectedPullRequestNumber={17}
        onIssuesChange={onIssuesChange}
        onPullRequestsChange={onPullRequestsChange}
        onPullRequestDiffsChange={onPullRequestDiffsChange}
        onPullRequestCommentsChange={onPullRequestCommentsChange}
      />,
    );

    expect(useGitHubIssuesMock).toHaveBeenCalledWith(workspace, false);
    expect(useGitHubPullRequestsMock).toHaveBeenCalledWith(workspace, true);
    expect(useGitHubPullRequestDiffsMock).toHaveBeenCalledWith(workspace, 17, true);
    expect(useGitHubPullRequestCommentsMock).toHaveBeenCalledWith(workspace, 17, true);

    await waitFor(() => {
      expect(onIssuesChange).toHaveBeenCalledWith({
        issues: [],
        total: 0,
        isLoading: false,
        error: "issues-error",
      });
      expect(onPullRequestsChange).toHaveBeenCalledWith({
        pullRequests: [],
        total: 0,
        isLoading: false,
        error: "prs-error",
      });
      expect(onPullRequestDiffsChange).toHaveBeenCalledWith({
        diffs: [],
        isLoading: false,
        error: "diff-error",
      });
      expect(onPullRequestCommentsChange).toHaveBeenCalledWith({
        comments: [],
        isLoading: false,
        error: "comments-error",
      });
    });
  });

  it("fires callbacks again with updated hook data after rerender", async () => {
    const onIssuesChange = vi.fn();
    const onPullRequestsChange = vi.fn();
    const onPullRequestDiffsChange = vi.fn();
    const onPullRequestCommentsChange = vi.fn();

    const { rerender } = render(
      <GitHubPanelData
        activeWorkspace={workspace}
        gitPanelMode="issues"
        shouldLoadDiffs={true}
        diffSource="commit"
        selectedPullRequestNumber={null}
        onIssuesChange={onIssuesChange}
        onPullRequestsChange={onPullRequestsChange}
        onPullRequestDiffsChange={onPullRequestDiffsChange}
        onPullRequestCommentsChange={onPullRequestCommentsChange}
      />,
    );

    await waitFor(() => {
      expect(onIssuesChange).toHaveBeenCalledWith({
        issues: [],
        total: 0,
        isLoading: false,
        error: null,
      });
    });

    useGitHubIssuesMock.mockReturnValue({
      issues: [{ number: 1, title: "Issue #1", url: "https://example.com/1", updatedAt: "now" }],
      total: 1,
      isLoading: false,
      error: null,
    });
    useGitHubPullRequestsMock.mockReturnValue({
      pullRequests: [
        {
          number: 7,
          title: "PR #7",
          url: "https://example.com/pr/7",
          updatedAt: "now",
          isDraft: false,
          author: { login: "bot" },
        },
      ],
      total: 1,
      isLoading: false,
      error: null,
    });

    rerender(
      <GitHubPanelData
        activeWorkspace={workspace}
        gitPanelMode="prs"
        shouldLoadDiffs={true}
        diffSource="pr"
        selectedPullRequestNumber={7}
        onIssuesChange={onIssuesChange}
        onPullRequestsChange={onPullRequestsChange}
        onPullRequestDiffsChange={onPullRequestDiffsChange}
        onPullRequestCommentsChange={onPullRequestCommentsChange}
      />,
    );

    await waitFor(() => {
      expect(onIssuesChange).toHaveBeenLastCalledWith({
        issues: [
          { number: 1, title: "Issue #1", url: "https://example.com/1", updatedAt: "now" },
        ],
        total: 1,
        isLoading: false,
        error: null,
      });
      expect(onPullRequestsChange).toHaveBeenLastCalledWith({
        pullRequests: [
          {
            number: 7,
            title: "PR #7",
            url: "https://example.com/pr/7",
            updatedAt: "now",
            isDraft: false,
            author: { login: "bot" },
          },
        ],
        total: 1,
        isLoading: false,
        error: null,
      });
    });
  });
});
