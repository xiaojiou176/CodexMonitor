// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildGitNodes } from "./buildGitNodes";

const mockedComponents = vi.hoisted(() => ({
  fileTreePanel: vi.fn(),
  skillsPanel: vi.fn(),
  mcpStatusPanel: vi.fn(),
  promptPanel: vi.fn(),
  gitDiffPanel: vi.fn(),
  gitDiffViewer: vi.fn(),
}));

vi.mock("../../../files/components/FileTreePanel", () => ({
  FileTreePanel: (props: any) => {
    mockedComponents.fileTreePanel(props);
    return <div data-testid="file-tree-panel" />;
  },
}));

vi.mock("../../../skills/components/SkillsPanel", () => ({
  SkillsPanel: (props: any) => {
    mockedComponents.skillsPanel(props);
    return (
      <button
        data-testid="skills-panel"
        onClick={() => props.onInvokeSkill?.({ name: "深度调试模式" })}
        type="button"
      >
        skills
      </button>
    );
  },
}));

vi.mock("../../../mcp/components/McpStatusPanel", () => ({
  McpStatusPanel: (props: any) => {
    mockedComponents.mcpStatusPanel(props);
    return <div data-testid="mcp-status-panel" />;
  },
}));

vi.mock("../../../prompts/components/PromptPanel", () => ({
  PromptPanel: (props: any) => {
    mockedComponents.promptPanel(props);
    return <div data-testid="prompt-panel" />;
  },
}));

vi.mock("../../../git/components/GitDiffPanel", () => ({
  GitDiffPanel: (props: any) => {
    mockedComponents.gitDiffPanel(props);
    return <div data-testid="git-diff-panel" />;
  },
}));

vi.mock("../../../git/components/GitDiffViewer", () => ({
  GitDiffViewer: (props: any) => {
    mockedComponents.gitDiffViewer(props);
    return <div data-testid="git-diff-viewer" />;
  },
}));

function createOptions(overrides: Record<string, unknown> = {}) {
  return {
    centerMode: "diff",
    selectedDiffPath: "src/main.ts",
    filePanelMode: "git",
    activeWorkspace: {
      id: "ws-1",
      name: "workspace",
      path: "/tmp/repo",
      connected: true,
      settings: { sidebarCollapsed: false },
    },
    files: [],
    skills: [],
    prompts: [],
    gitPanelMode: "diff",
    onGitPanelModeChange: vi.fn(),
    onFilePanelModeChange: vi.fn(),
    onInsertComposerText: vi.fn(),
    canInsertComposerText: true,
    openAppTargets: [],
    openAppIconById: {},
    selectedOpenAppId: "",
    onSelectOpenAppId: vi.fn(),
    fileTreeLoading: false,
    worktreeApplyLabel: "Apply",
    worktreeApplyTitle: null,
    worktreeApplyLoading: false,
    worktreeApplyError: null,
    worktreeApplySuccess: false,
    onApplyWorktreeChanges: vi.fn(),
    fileStatus: "idle",
    gitLogError: null,
    gitLogLoading: false,
    gitLogEntries: [],
    gitLogTotal: 0,
    gitLogAhead: 0,
    gitLogBehind: 0,
    gitLogAheadEntries: [],
    gitLogBehindEntries: [],
    gitLogUpstream: null,
    selectedCommitSha: null,
    onSelectCommit: vi.fn(),
    gitIssues: [],
    gitIssuesTotal: 0,
    gitIssuesLoading: false,
    gitIssuesError: null,
    gitPullRequests: [],
    gitPullRequestsTotal: 0,
    gitPullRequestsLoading: false,
    gitPullRequestsError: null,
    selectedPullRequestNumber: null,
    onSelectPullRequest: vi.fn(),
    gitRemoteUrl: null,
    gitRoot: null,
    gitRootCandidates: [],
    gitRootScanDepth: 3,
    gitRootScanLoading: false,
    gitRootScanError: null,
    gitRootScanHasScanned: false,
    onGitRootScanDepthChange: vi.fn(),
    onScanGitRoots: vi.fn(),
    onSelectGitRoot: vi.fn(),
    onClearGitRoot: vi.fn(),
    onPickGitRoot: vi.fn(),
    onStageGitAll: vi.fn(),
    onStageGitFile: vi.fn(),
    onUnstageGitFile: vi.fn(),
    onRevertGitFile: vi.fn(),
    onRevertAllGitChanges: vi.fn(),
    commitMessage: "",
    commitMessageLoading: false,
    commitMessageError: null,
    onCommitMessageChange: vi.fn(),
    onGenerateCommitMessage: vi.fn(),
    onCommit: vi.fn(),
    onCommitAndPush: vi.fn(),
    onCommitAndSync: vi.fn(),
    onPull: vi.fn(),
    onFetch: vi.fn(),
    onPush: vi.fn(),
    onSync: vi.fn(),
    commitLoading: false,
    pullLoading: false,
    fetchLoading: false,
    pushLoading: false,
    syncLoading: false,
    commitError: null,
    pullError: null,
    fetchError: null,
    pushError: null,
    syncError: null,
    commitsAhead: 0,
    gitDiffs: [],
    diffScrollRequestId: 0,
    gitDiffLoading: false,
    gitDiffError: null,
    isPhone: false,
    gitDiffViewStyle: "split",
    gitDiffIgnoreWhitespaceChanges: false,
    selectedPullRequest: null,
    selectedPullRequestComments: [],
    selectedPullRequestCommentsLoading: false,
    selectedPullRequestCommentsError: null,
    diffSource: "local",
    onDiffActivePathChange: vi.fn(),
    gitStatus: {
      branchName: "main",
      files: [],
      stagedFiles: [],
      unstagedFiles: [],
      totalAdditions: 0,
      totalDeletions: 0,
      error: null,
    },
    onSendPrompt: vi.fn(),
    onSendPromptToNewAgent: vi.fn(),
    onCreatePrompt: vi.fn(),
    onUpdatePrompt: vi.fn(),
    onDeletePrompt: vi.fn(),
    onMovePrompt: vi.fn(),
    onRevealWorkspacePrompts: vi.fn(),
    onRevealGeneralPrompts: vi.fn(),
    canRevealGeneralPrompts: true,
    ...overrides,
  } as any;
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("buildGitNodes", () => {
  it("inserts canonical $skill token without whitespace gap", () => {
    const onInsertComposerText = vi.fn();
    const { gitDiffPanelNode } = buildGitNodes(
      createOptions({
        filePanelMode: "skills",
        skills: [{ name: "深度调试模式", path: "/tmp/skills/deep-debug.md" }],
        onInsertComposerText,
      }),
    );

    render(<>{gitDiffPanelNode}</>);
    fireEvent.click(screen.getByTestId("skills-panel"));

    expect(onInsertComposerText).toHaveBeenCalledWith("$深度调试模式 ");
  });

  it("renders FileTreePanel in files mode and deduplicates modified file paths", () => {
    const { gitDiffPanelNode } = buildGitNodes(
      createOptions({
        filePanelMode: "files",
        gitStatus: {
          branchName: "main",
          files: [],
          stagedFiles: [{ path: "src/a.ts" }, { path: "src/b.ts" }],
          unstagedFiles: [{ path: "src/b.ts" }, { path: "src/c.ts" }],
          totalAdditions: 0,
          totalDeletions: 0,
          error: null,
        },
      }),
    );

    render(<>{gitDiffPanelNode}</>);

    expect(screen.getByTestId("file-tree-panel")).toBeTruthy();
    expect(mockedComponents.fileTreePanel).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "ws-1",
        workspacePath: "/tmp/repo",
        modifiedFiles: ["src/a.ts", "src/b.ts", "src/c.ts"],
      }),
    );
  });

  it("falls back to GitDiffPanel when files mode has no active workspace", async () => {
    const { gitDiffPanelNode } = buildGitNodes(
      createOptions({
        filePanelMode: "files",
        activeWorkspace: null,
      }),
    );

    render(<>{gitDiffPanelNode}</>);

    expect(await screen.findByTestId("git-diff-panel")).toBeTruthy();
  });

  it("renders McpStatusPanel with null workspaceId in mcp empty state", () => {
    const { gitDiffPanelNode } = buildGitNodes(
      createOptions({
        filePanelMode: "mcp",
        activeWorkspace: null,
      }),
    );

    render(<>{gitDiffPanelNode}</>);

    expect(screen.getByTestId("mcp-status-panel")).toBeTruthy();
    expect(mockedComponents.mcpStatusPanel).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId: null, filePanelMode: "mcp" }),
    );
  });

  it("renders PromptPanel with null workspacePath in prompts mode", () => {
    const { gitDiffPanelNode } = buildGitNodes(
      createOptions({
        filePanelMode: "prompts",
        activeWorkspace: null,
      }),
    );

    render(<>{gitDiffPanelNode}</>);

    expect(screen.getByTestId("prompt-panel")).toBeTruthy();
    expect(mockedComponents.promptPanel).toHaveBeenCalledWith(
      expect.objectContaining({ workspacePath: null, filePanelMode: "prompts" }),
    );
  });

  it("passes selectedPath based on centerMode in GitDiffPanel", async () => {
    const diffModeNodes = buildGitNodes(
      createOptions({ centerMode: "diff", selectedDiffPath: "src/selected.ts" }),
    );
    render(<>{diffModeNodes.gitDiffPanelNode}</>);
    await waitFor(() => {
      expect(mockedComponents.gitDiffPanel).toHaveBeenCalled();
    });

    expect(mockedComponents.gitDiffPanel).toHaveBeenLastCalledWith(
      expect.objectContaining({ selectedPath: "src/selected.ts" }),
    );

    const chatModeNodes = buildGitNodes(
      createOptions({ centerMode: "chat", selectedDiffPath: "src/selected.ts" }),
    );
    render(<>{chatModeNodes.gitDiffPanelNode}</>);
    await waitFor(() => {
      expect(mockedComponents.gitDiffPanel).toHaveBeenCalledTimes(2);
    });

    expect(mockedComponents.gitDiffPanel).toHaveBeenLastCalledWith(
      expect.objectContaining({ selectedPath: null }),
    );
  });

  it("builds GitDiffViewer with diff style and revert capability branches", async () => {
    const localNodes = buildGitNodes(
      createOptions({ isPhone: true, gitDiffViewStyle: "split", diffSource: "local" }),
    );
    render(<>{localNodes.gitDiffViewerNode}</>);
    await screen.findByTestId("git-diff-viewer");

    expect(mockedComponents.gitDiffViewer).toHaveBeenLastCalledWith(
      expect.objectContaining({ diffStyle: "unified", canRevert: true }),
    );

    const remoteNodes = buildGitNodes(
      createOptions({ isPhone: false, gitDiffViewStyle: "split", diffSource: "pr" }),
    );
    render(<>{remoteNodes.gitDiffViewerNode}</>);
    await screen.findAllByTestId("git-diff-viewer");

    expect(mockedComponents.gitDiffViewer).toHaveBeenLastCalledWith(
      expect.objectContaining({ diffStyle: "split", canRevert: false }),
    );
  });
});
