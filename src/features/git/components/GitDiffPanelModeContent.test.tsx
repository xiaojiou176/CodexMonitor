/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { GitHubIssue, GitHubPullRequest, GitLogEntry } from "../../../types";
import {
  GitBranchRow,
  GitDiffModeContent,
  GitIssuesModeContent,
  GitLogModeContent,
  GitPanelModeStatus,
  GitPullRequestsModeContent,
  GitRootCurrentPath,
} from "./GitDiffPanelModeContent";

const openUrl = vi.hoisted(() => vi.fn());

vi.mock("../../../utils/time", () => ({
  formatRelativeTime: vi.fn(() => "1h ago"),
}));

vi.mock("@tauri-apps/plugin-opener", () => ({
  openUrl: (...args: unknown[]) => openUrl(...args),
}));

vi.mock("./GitDiffPanelShared", () => ({
  CommitButton: ({
    commitLoading,
    onCommit,
  }: {
    commitLoading: boolean;
    onCommit?: () => void | Promise<void>;
  }) => (
    <button type="button" onClick={() => void onCommit?.()} disabled={commitLoading}>
      commit
    </button>
  ),
  DiffSection: ({
    title,
    files,
  }: {
    title: string;
    files: Array<{ path: string }>;
  }) => (
    <section data-testid={`diff-section-${title}`}>
      {title} ({files.length})
    </section>
  ),
  GitLogEntryRow: ({
    entry,
    isSelected,
  }: {
    entry: GitLogEntry;
    isSelected: boolean;
  }) => <div data-testid="git-log-entry">{entry.sha}:{isSelected ? "selected" : "idle"}</div>,
}));

function createDiffProps(
  override: Partial<Parameters<typeof GitDiffModeContent>[0]> = {},
): Parameters<typeof GitDiffModeContent>[0] {
  return {
    error: null,
    showGitRootPanel: false,
    onScanGitRoots: vi.fn(),
    gitRootScanLoading: false,
    gitRootScanDepth: 3,
    onGitRootScanDepthChange: vi.fn(),
    onPickGitRoot: vi.fn(),
    hasGitRoot: false,
    onClearGitRoot: vi.fn(),
    gitRootScanError: null,
    gitRootScanHasScanned: false,
    gitRootCandidates: [],
    gitRoot: null,
    onSelectGitRoot: vi.fn(),
    showGenerateCommitMessage: false,
    commitMessage: "",
    onCommitMessageChange: vi.fn(),
    commitMessageLoading: false,
    canGenerateCommitMessage: true,
    onGenerateCommitMessage: vi.fn(),
    stagedFiles: [],
    unstagedFiles: [],
    diffScope: "uncommitted",
    onDiffScopeChange: vi.fn(),
    commitLoading: false,
    onCommit: vi.fn(),
    commitsAhead: 0,
    commitsBehind: 0,
    onPull: vi.fn(),
    pullLoading: false,
    onPush: vi.fn(),
    pushLoading: false,
    onSync: vi.fn(),
    syncLoading: false,
    onStageAllChanges: vi.fn(),
    onStageFile: vi.fn(),
    onUnstageFile: vi.fn(),
    onDiscardFile: vi.fn(),
    onDiscardFiles: vi.fn(),
    selectedFiles: new Set<string>(),
    selectedPath: null,
    onSelectFile: vi.fn(),
    onFileClick: vi.fn(),
    onShowFileMenu: vi.fn(),
    onDiffListClick: vi.fn(),
    ...override,
  };
}

afterEach(() => {
  cleanup();
});

describe("GitDiffPanelModeContent", () => {
  it("renders mode status blocks for diff/log/issues/prs", () => {
    const { rerender } = render(
      <GitPanelModeStatus
        mode="diff"
        diffStatusLabel="2 files changed"
        logCountLabel="unused"
        logSyncLabel="unused"
        logUpstreamLabel=""
        issuesLoading={false}
        issuesTotal={0}
        pullRequestsLoading={false}
        pullRequestsTotal={0}
      />,
    );
    expect(screen.getByText("2 files changed")).toBeTruthy();

    rerender(
      <GitPanelModeStatus
        mode="log"
        diffStatusLabel=""
        logCountLabel="12 commits"
        logSyncLabel="ahead 1"
        logSyncTitle="sync detail"
        logUpstreamLabel="origin/main"
        issuesLoading={false}
        issuesTotal={0}
        pullRequestsLoading={false}
        pullRequestsTotal={0}
      />,
    );
    expect(screen.getByText("12 commits")).toBeTruthy();
    expect(screen.getByText("ahead 1").getAttribute("title")).toBe("sync detail");
    expect(screen.getByText("origin/main")).toBeTruthy();

    rerender(
      <GitPanelModeStatus
        mode="issues"
        diffStatusLabel=""
        logCountLabel=""
        logSyncLabel=""
        logUpstreamLabel=""
        issuesLoading
        issuesTotal={5}
        pullRequestsLoading={false}
        pullRequestsTotal={0}
      />,
    );
    expect(screen.getByText("GitHub issues")).toBeTruthy();
    expect(screen.getByText("5 open")).toBeTruthy();

    rerender(
      <GitPanelModeStatus
        mode="prs"
        diffStatusLabel=""
        logCountLabel=""
        logSyncLabel=""
        logUpstreamLabel=""
        issuesLoading={false}
        issuesTotal={0}
        pullRequestsLoading
        pullRequestsTotal={3}
      />,
    );
    expect(screen.getByText("GitHub pull requests")).toBeTruthy();
    expect(screen.getByText("3 open")).toBeTruthy();
  });

  it("renders branch row only for diff/log and calls fetch", () => {
    const onFetch = vi.fn();
    const { rerender } = render(
      <GitBranchRow mode="diff" branchName="main" onFetch={onFetch} fetchLoading={false} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "获取远端" }));
    expect(onFetch).toHaveBeenCalledTimes(1);

    rerender(
      <GitBranchRow mode="issues" branchName="main" onFetch={onFetch} fetchLoading={false} />,
    );
    expect(screen.queryByText("main")).toBeNull();
  });

  it("renders root current path and hides for issues mode", () => {
    const onScanGitRoots = vi.fn();
    const { rerender } = render(
      <GitRootCurrentPath
        mode="diff"
        hasGitRoot
        gitRoot="/tmp/repo"
        onScanGitRoots={onScanGitRoots}
        gitRootScanLoading={false}
      />,
    );
    expect(screen.getByText("路径：")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "更改" }));
    expect(onScanGitRoots).toHaveBeenCalledTimes(1);

    rerender(
      <GitRootCurrentPath
        mode="issues"
        hasGitRoot
        gitRoot="/tmp/repo"
        onScanGitRoots={onScanGitRoots}
        gitRootScanLoading={false}
      />,
    );
    expect(screen.queryByText("路径：")).toBeNull();
  });

  it("renders empty and scope-empty messages in diff mode", () => {
    const { rerender } = render(<GitDiffModeContent {...createDiffProps()} />);
    expect(screen.getByText("未检测到更改。")).toBeTruthy();

    rerender(
      <GitDiffModeContent
        {...createDiffProps({
          diffScope: "staged",
          unstagedFiles: [{ path: "src/a.ts", status: "M", additions: 1, deletions: 0 }],
        })}
      />,
    );
    expect(screen.getByText("当前范围没有已暂存改动。")).toBeTruthy();
  });

  it("does not render empty state when error exists", () => {
    render(<GitDiffModeContent {...createDiffProps({ error: "boom" })} />);
    expect(screen.queryByText("未检测到更改。")).toBeNull();
  });

  it("renders git root scan states and candidate selection", () => {
    const onSelectGitRoot = vi.fn();
    const onDepthChange = vi.fn();
    const onPickGitRoot = vi.fn();
    const onClearGitRoot = vi.fn();
    const { rerender } = render(
      <GitDiffModeContent
        {...createDiffProps({
          showGitRootPanel: true,
          gitRootScanLoading: true,
        })}
      />,
    );
    expect(screen.getByText("正在扫描仓库...")).toBeTruthy();

    rerender(
      <GitDiffModeContent
        {...createDiffProps({
          showGitRootPanel: true,
          gitRootScanHasScanned: true,
          gitRootScanLoading: false,
          gitRootCandidates: [],
        })}
      />,
    );
    expect(screen.getByText("未找到仓库。")).toBeTruthy();

    rerender(
      <GitDiffModeContent
        {...createDiffProps({
          showGitRootPanel: true,
          gitRootScanDepth: 4,
          onGitRootScanDepthChange: onDepthChange,
          onPickGitRoot,
          hasGitRoot: true,
          onClearGitRoot,
          gitRoot: "/repo/a",
          gitRootCandidates: ["/repo/a", "/repo/b"],
          onSelectGitRoot,
        })}
      />,
    );
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "6" } });
    expect(onDepthChange).toHaveBeenCalledWith(6);

    fireEvent.click(screen.getByRole("button", { name: "选择文件夹" }));
    expect(onPickGitRoot).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "使用工作区根目录" }));
    expect(onClearGitRoot).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "/repo/b" }));
    expect(onSelectGitRoot).toHaveBeenCalledWith("/repo/b");
    expect(screen.getByText("当前")).toBeTruthy();
  });

  it("handles scope mode switches and section rendering", () => {
    const onDiffScopeChange = vi.fn();
    const { rerender } = render(
      <GitDiffModeContent
        {...createDiffProps({
          onDiffScopeChange,
          stagedFiles: [{ path: "src/staged.ts", status: "M", additions: 1, deletions: 0 }],
          unstagedFiles: [{ path: "src/unstaged.ts", status: "M", additions: 2, deletions: 0 }],
        })}
      />,
    );
    expect(screen.getByTestId("diff-section-已暂存")).toBeTruthy();
    expect(screen.getByTestId("diff-section-未暂存")).toBeTruthy();

    fireEvent.click(screen.getAllByRole("button", { name: "Staged" })[0]);
    fireEvent.click(screen.getAllByRole("button", { name: "Unstaged" })[0]);
    expect(onDiffScopeChange).toHaveBeenCalledWith("staged");
    expect(onDiffScopeChange).toHaveBeenCalledWith("unstaged");

    rerender(
      <GitDiffModeContent
        {...createDiffProps({
          diffScope: "unstaged",
          stagedFiles: [{ path: "src/staged.ts", status: "M", additions: 1, deletions: 0 }],
          unstagedFiles: [{ path: "src/unstaged.ts", status: "M", additions: 2, deletions: 0 }],
        })}
      />,
    );
    expect(screen.queryByTestId("diff-section-已暂存")).toBeNull();
    expect(screen.getByTestId("diff-section-未暂存")).toBeTruthy();
  });

  it("controls commit message generation and push/pull/sync actions", () => {
    const onGenerateCommitMessage = vi.fn();
    const onPull = vi.fn();
    const onPush = vi.fn();
    const onSync = vi.fn();
    const { rerender } = render(
      <GitDiffModeContent
        {...createDiffProps({
          showGenerateCommitMessage: true,
          canGenerateCommitMessage: false,
          onGenerateCommitMessage,
        })}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "生成提交信息" }));
    expect(onGenerateCommitMessage).not.toHaveBeenCalled();

    rerender(
      <GitDiffModeContent
        {...createDiffProps({
          showGenerateCommitMessage: true,
          canGenerateCommitMessage: true,
          onGenerateCommitMessage,
          commitsAhead: 1,
          commitsBehind: 2,
          onPull,
          onPush,
          onSync,
        })}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "生成提交信息" }));
    expect(onGenerateCommitMessage).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: /^拉取 2$/ }));
    fireEvent.click(screen.getByRole("button", { name: /同步（先拉取再推送）/ }));
    expect(onPull).toHaveBeenCalledTimes(1);
    expect(onSync).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: /^推送 1$/ }).hasAttribute("disabled")).toBe(true);
    expect(onPush).not.toHaveBeenCalled();
  });

  it("renders log mode loading, empty, sections and selected entry", () => {
    const onShowLogMenu = vi.fn();
    const baseEntry: GitLogEntry = {
      sha: "abc123",
      shortSha: "abc123",
      subject: "subject",
      authorName: "author",
      authorEmail: "author@example.com",
      authoredAt: Date.now(),
    };
    const { rerender } = render(
      <GitLogModeContent
        logError={null}
        logLoading
        logEntries={[]}
        showAheadSection={false}
        showBehindSection={false}
        logAheadEntries={[]}
        logBehindEntries={[]}
        selectedCommitSha={null}
        onShowLogMenu={onShowLogMenu}
      />,
    );
    expect(screen.getByText("正在加载提交...")).toBeTruthy();

    rerender(
      <GitLogModeContent
        logError={null}
        logLoading={false}
        logEntries={[]}
        showAheadSection={false}
        showBehindSection={false}
        logAheadEntries={[]}
        logBehindEntries={[]}
        selectedCommitSha={null}
        onShowLogMenu={onShowLogMenu}
      />,
    );
    expect(screen.getByText("暂无提交。")).toBeTruthy();

    rerender(
      <GitLogModeContent
        logError={null}
        logLoading={false}
        logEntries={[baseEntry]}
        showAheadSection
        showBehindSection
        logAheadEntries={[baseEntry]}
        logBehindEntries={[{ ...baseEntry, sha: "def456", shortSha: "def456" }]}
        selectedCommitSha="abc123"
        onShowLogMenu={onShowLogMenu}
      />,
    );
    expect(screen.getByText("待推送")).toBeTruthy();
    expect(screen.getByText("待拉取")).toBeTruthy();
    expect(screen.getByText("最近提交")).toBeTruthy();
    expect(screen.getAllByTestId("git-log-entry")[0]?.textContent?.includes("selected")).toBe(true);
  });

  it("renders issues empty state and opens issue URLs", () => {
    openUrl.mockClear();
    const issues: GitHubIssue[] = [
      {
        number: 12,
        title: "Fix CI",
        url: "https://example.com/issues/12",
        updatedAt: "2026-02-27T00:00:00Z",
      },
    ];
    const { rerender } = render(
      <GitIssuesModeContent issuesError={null} issuesLoading={false} issues={[]} />,
    );
    expect(screen.getByText("暂无未关闭 Issue。")).toBeTruthy();

    rerender(<GitIssuesModeContent issuesError={null} issuesLoading={false} issues={issues} />);
    fireEvent.click(screen.getByRole("link", { name: /Fix CI/ }));
    expect(openUrl).toHaveBeenCalledWith("https://example.com/issues/12");
    expect(screen.getByText(/1h ago/)).toBeTruthy();
  });

  it("renders pull requests empty and handles click/context menu", () => {
    const onSelectPullRequest = vi.fn();
    const onShowPullRequestMenu = vi.fn();
    const pullRequests: GitHubPullRequest[] = [
      {
        number: 34,
        title: "Improve coverage",
        url: "https://example.com/pulls/34",
        updatedAt: "2026-02-27T00:00:00Z",
        isDraft: true,
        author: null,
      },
    ];
    const { rerender } = render(
      <GitPullRequestsModeContent
        pullRequestsError={null}
        pullRequestsLoading={false}
        pullRequests={[]}
        selectedPullRequest={null}
        onSelectPullRequest={onSelectPullRequest}
        onShowPullRequestMenu={onShowPullRequestMenu}
      />,
    );
    expect(screen.getByText("暂无未关闭 PR。")).toBeTruthy();

    rerender(
      <GitPullRequestsModeContent
        pullRequestsError={null}
        pullRequestsLoading={false}
        pullRequests={pullRequests}
        selectedPullRequest={34}
        onSelectPullRequest={onSelectPullRequest}
        onShowPullRequestMenu={onShowPullRequestMenu}
      />,
    );

    const prButton = screen.getByRole("button", { name: /Improve coverage/ });
    fireEvent.click(prButton);
    fireEvent.contextMenu(prButton);
    expect(onSelectPullRequest).toHaveBeenCalledWith(pullRequests[0]);
    expect(onShowPullRequestMenu).toHaveBeenCalled();
    expect(screen.getByText("草稿")).toBeTruthy();
    expect(screen.getByText(/@未知/)).toBeTruthy();
  });
});
