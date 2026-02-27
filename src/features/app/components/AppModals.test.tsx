// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { BranchInfo, WorkspaceInfo } from "../../../types";
import { AppModals } from "./AppModals";

const useGitBranchesMock = vi.hoisted(() => vi.fn(() => ({ branches: [] as BranchInfo[] })));

function callMaybeFn<TArgs extends unknown[]>(fn: unknown, ...args: TArgs) {
  if (typeof fn === "function") {
    (fn as (...invokeArgs: TArgs) => void)(...args);
  }
}

vi.mock("../../git/hooks/useGitBranches", () => ({
  useGitBranches: (...args: unknown[]) => useGitBranchesMock(...args),
}));

vi.mock("../../threads/components/RenameThreadPrompt", () => ({
  RenameThreadPrompt: (props: Record<string, unknown>) => (
    <div data-testid="rename-thread-prompt" data-current-name={String(props.currentName)}>
      <button type="button" onClick={() => callMaybeFn(props.onChange, "renamed-thread")}>rename-change</button>
      <button type="button" onClick={() => callMaybeFn(props.onCancel)}>rename-cancel</button>
      <button type="button" onClick={() => callMaybeFn(props.onConfirm)}>rename-confirm</button>
    </div>
  ),
}));

vi.mock("../../workspaces/components/WorktreePrompt", () => ({
  WorktreePrompt: (props: Record<string, unknown>) => (
    <div
      data-testid="worktree-prompt"
      data-branch-suggestions={JSON.stringify(props.branchSuggestions)}
      data-workspace-name={String(props.workspaceName)}
    >
      <button type="button" onClick={() => callMaybeFn(props.onNameChange, "fresh-name")}>worktree-name</button>
      <button type="button" onClick={() => callMaybeFn(props.onChange, "feature/fresh")}>worktree-branch</button>
      <button type="button" onClick={() => callMaybeFn(props.onCopyAgentsMdChange, false)}>worktree-copy-agents</button>
      <button type="button" onClick={() => callMaybeFn(props.onSetupScriptChange, "echo setup")}>worktree-script</button>
      <button type="button" onClick={() => callMaybeFn(props.onCancel)}>worktree-cancel</button>
      <button type="button" onClick={() => callMaybeFn(props.onConfirm)}>worktree-confirm</button>
    </div>
  ),
}));

vi.mock("../../workspaces/components/ClonePrompt", () => ({
  ClonePrompt: (props: Record<string, unknown>) => (
    <div data-testid="clone-prompt" data-workspace-name={String(props.workspaceName)}>
      <button type="button" onClick={() => callMaybeFn(props.onCopyNameChange, "copy-name")}>clone-copy-name</button>
      <button type="button" onClick={() => callMaybeFn(props.onChooseCopiesFolder)}>clone-choose-folder</button>
      <button type="button" onClick={() => callMaybeFn(props.onUseSuggestedCopiesFolder)}>clone-use-suggested</button>
      <button type="button" onClick={() => callMaybeFn(props.onClearCopiesFolder)}>clone-clear-folder</button>
      <button type="button" onClick={() => callMaybeFn(props.onCancel)}>clone-cancel</button>
      <button type="button" onClick={() => callMaybeFn(props.onConfirm)}>clone-confirm</button>
    </div>
  ),
}));

vi.mock("../../workspaces/components/WorkspaceFromUrlPrompt", () => ({
  WorkspaceFromUrlPrompt: (props: Record<string, unknown>) => (
    <div data-testid="workspace-from-url-prompt" data-can-submit={String(props.canSubmit)}>
      <button type="button" onClick={() => callMaybeFn(props.onUrlChange, "https://example.com/repo.git")}>url-change</button>
      <button
        type="button"
        onClick={() => callMaybeFn(props.onTargetFolderNameChange, "repo-copy")}
      >
        folder-name-change
      </button>
      <button type="button" onClick={() => callMaybeFn(props.onChooseDestinationPath)}>url-choose-destination</button>
      <button type="button" onClick={() => callMaybeFn(props.onClearDestinationPath)}>url-clear-destination</button>
      <button type="button" onClick={() => callMaybeFn(props.onCancel)}>url-cancel</button>
      <button type="button" onClick={() => callMaybeFn(props.onConfirm)}>url-confirm</button>
    </div>
  ),
}));

vi.mock("../../workspaces/components/MobileRemoteWorkspacePrompt", () => ({
  MobileRemoteWorkspacePrompt: (props: Record<string, unknown>) => (
    <div data-testid="mobile-remote-workspace-prompt">
      <button type="button" onClick={() => callMaybeFn(props.onChange, "/remote/workspace")}>mobile-change</button>
      <button type="button" onClick={() => callMaybeFn(props.onCancel)}>mobile-cancel</button>
      <button type="button" onClick={() => callMaybeFn(props.onConfirm)}>mobile-confirm</button>
    </div>
  ),
}));

vi.mock("../../git/components/BranchSwitcherPrompt", () => ({
  BranchSwitcherPrompt: (props: Record<string, unknown>) => (
    <div data-testid="branch-switcher-prompt">
      <button
        type="button"
        onClick={() => {
          const workspaces = (props.workspaces as WorkspaceInfo[]) ?? [];
          callMaybeFn(props.onSelect, "feature/selected", workspaces[0] ?? null);
        }}
      >
        branch-select
      </button>
      <button type="button" onClick={() => callMaybeFn(props.onCancel)}>branch-cancel</button>
    </div>
  ),
}));

const settingsViewMock = vi.fn((props: Record<string, unknown>) => (
  <div data-testid="settings-view" data-initial-section={String(props.initialSection)}>
    <button type="button" onClick={() => callMaybeFn(props.onClose)}>settings-close</button>
  </div>
));

const baseWorkspace: WorkspaceInfo = {
  id: "ws-1",
  name: "workspace-1",
  path: "/tmp/workspace-1",
  connected: true,
  settings: { sidebarCollapsed: false },
};

function createProps(overrides: Partial<ComponentProps<typeof AppModals>> = {}): ComponentProps<typeof AppModals> {
  return {
    renamePrompt: null,
    onRenamePromptChange: vi.fn(),
    onRenamePromptCancel: vi.fn(),
    onRenamePromptConfirm: vi.fn(),
    worktreePrompt: null,
    onWorktreePromptNameChange: vi.fn(),
    onWorktreePromptChange: vi.fn(),
    onWorktreePromptCopyAgentsMdChange: vi.fn(),
    onWorktreeSetupScriptChange: vi.fn(),
    onWorktreePromptCancel: vi.fn(),
    onWorktreePromptConfirm: vi.fn(),
    clonePrompt: null,
    onClonePromptCopyNameChange: vi.fn(),
    onClonePromptChooseCopiesFolder: vi.fn(),
    onClonePromptUseSuggestedFolder: vi.fn(),
    onClonePromptClearCopiesFolder: vi.fn(),
    onClonePromptCancel: vi.fn(),
    onClonePromptConfirm: vi.fn(),
    workspaceFromUrlPrompt: null,
    canSubmitWorkspaceFromUrlPrompt: false,
    onWorkspaceFromUrlPromptUrlChange: vi.fn(),
    onWorkspaceFromUrlPromptTargetFolderNameChange: vi.fn(),
    onWorkspaceFromUrlPromptChooseDestinationPath: vi.fn(),
    onWorkspaceFromUrlPromptClearDestinationPath: vi.fn(),
    onWorkspaceFromUrlPromptCancel: vi.fn(),
    onWorkspaceFromUrlPromptConfirm: vi.fn(),
    mobileRemoteWorkspacePathPrompt: null,
    onMobileRemoteWorkspacePathInputChange: vi.fn(),
    onMobileRemoteWorkspacePathPromptCancel: vi.fn(),
    onMobileRemoteWorkspacePathPromptConfirm: vi.fn(),
    branchSwitcher: null,
    branches: [{ name: "main", lastCommit: 1 }],
    workspaces: [baseWorkspace],
    activeWorkspace: baseWorkspace,
    currentBranch: "main",
    onBranchSwitcherSelect: vi.fn(),
    onBranchSwitcherCancel: vi.fn(),
    settingsOpen: false,
    settingsSection: null,
    onCloseSettings: vi.fn(),
    SettingsViewComponent: settingsViewMock as unknown as ComponentProps<typeof AppModals>["SettingsViewComponent"],
    settingsProps: {} as ComponentProps<typeof AppModals>["settingsProps"],
    ...overrides,
  };
}

describe("AppModals", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders nothing when all prompts are closed and requests git branches with null workspace", () => {
    useGitBranchesMock.mockReturnValue({ branches: [{ name: "unused", lastCommit: 100 }] as BranchInfo[] });

    render(<AppModals {...createProps()} />);

    expect(screen.queryByTestId("rename-thread-prompt")).toBeNull();
    expect(screen.queryByTestId("worktree-prompt")).toBeNull();
    expect(screen.queryByTestId("clone-prompt")).toBeNull();
    expect(screen.queryByTestId("workspace-from-url-prompt")).toBeNull();
    expect(screen.queryByTestId("mobile-remote-workspace-prompt")).toBeNull();
    expect(screen.queryByTestId("branch-switcher-prompt")).toBeNull();
    expect(screen.queryByTestId("settings-view")).toBeNull();
    expect(useGitBranchesMock).toHaveBeenCalledWith({ activeWorkspace: null });
  });

  it("renders all modal prompts and wires callback branches", async () => {
    const worktreeBranches: BranchInfo[] = [
      { name: "feature/a", lastCommit: 11 },
      { name: "feature/b", lastCommit: 12 },
    ];
    useGitBranchesMock.mockReturnValue({ branches: worktreeBranches });

    const props = createProps({
      renamePrompt: {
        workspaceId: "ws-1",
        threadId: "thread-1",
        name: "Thread 1",
        originalName: "Thread 1",
      },
      worktreePrompt: {
        workspace: baseWorkspace,
        name: "new-worktree",
        branch: "feature/start",
        branchWasEdited: false,
        copyAgentsMd: true,
        setupScript: "",
        savedSetupScript: null,
        isSubmitting: false,
        isSavingScript: false,
        error: null,
        scriptError: null,
      },
      clonePrompt: {
        workspace: baseWorkspace,
        copyName: "workspace-copy",
        copiesFolder: "/tmp/copies",
        initialCopiesFolder: "/tmp/copies",
        groupId: null,
        suggestedCopiesFolder: "/tmp/suggested",
        isSubmitting: false,
        error: null,
      },
      workspaceFromUrlPrompt: {
        url: "https://example.com/repo.git",
        destinationPath: "/tmp/target",
        targetFolderName: "repo",
        error: null,
        isSubmitting: false,
      },
      canSubmitWorkspaceFromUrlPrompt: true,
      mobileRemoteWorkspacePathPrompt: {
        value: "/remote/path",
        error: null,
      },
      branchSwitcher: { searchQuery: "" } as ComponentProps<typeof AppModals>["branchSwitcher"],
      settingsOpen: true,
      settingsSection: "codex",
    });

    render(<AppModals {...props} />);

    expect(await screen.findByTestId("rename-thread-prompt")).toBeTruthy();
    const worktreePrompt = await screen.findByTestId("worktree-prompt");
    expect(worktreePrompt.getAttribute("data-branch-suggestions")).toBe(JSON.stringify(worktreeBranches));
    expect(await screen.findByTestId("clone-prompt")).toBeTruthy();
    expect(await screen.findByTestId("workspace-from-url-prompt")).toBeTruthy();
    expect(await screen.findByTestId("mobile-remote-workspace-prompt")).toBeTruthy();
    expect(await screen.findByTestId("branch-switcher-prompt")).toBeTruthy();
    expect(await screen.findByTestId("settings-view")).toBeTruthy();

    fireEvent.click(screen.getByText("rename-change"));
    fireEvent.click(screen.getByText("rename-cancel"));
    fireEvent.click(screen.getByText("rename-confirm"));

    fireEvent.click(screen.getByText("worktree-name"));
    fireEvent.click(screen.getByText("worktree-branch"));
    fireEvent.click(screen.getByText("worktree-copy-agents"));
    fireEvent.click(screen.getByText("worktree-script"));
    fireEvent.click(screen.getByText("worktree-cancel"));
    fireEvent.click(screen.getByText("worktree-confirm"));

    fireEvent.click(screen.getByText("clone-copy-name"));
    fireEvent.click(screen.getByText("clone-choose-folder"));
    fireEvent.click(screen.getByText("clone-use-suggested"));
    fireEvent.click(screen.getByText("clone-clear-folder"));
    fireEvent.click(screen.getByText("clone-cancel"));
    fireEvent.click(screen.getByText("clone-confirm"));

    fireEvent.click(screen.getByText("url-change"));
    fireEvent.click(screen.getByText("folder-name-change"));
    fireEvent.click(screen.getByText("url-choose-destination"));
    fireEvent.click(screen.getByText("url-clear-destination"));
    fireEvent.click(screen.getByText("url-cancel"));
    fireEvent.click(screen.getByText("url-confirm"));

    fireEvent.click(screen.getByText("mobile-change"));
    fireEvent.click(screen.getByText("mobile-cancel"));
    fireEvent.click(screen.getByText("mobile-confirm"));

    fireEvent.click(screen.getByText("branch-select"));
    fireEvent.click(screen.getByText("branch-cancel"));

    fireEvent.click(screen.getByText("settings-close"));

    expect(useGitBranchesMock).toHaveBeenCalledWith({ activeWorkspace: baseWorkspace });
    expect(props.onRenamePromptChange).toHaveBeenCalledWith("renamed-thread");
    expect(props.onRenamePromptCancel).toHaveBeenCalledTimes(1);
    expect(props.onRenamePromptConfirm).toHaveBeenCalledTimes(1);
    expect(props.onWorktreePromptNameChange).toHaveBeenCalledWith("fresh-name");
    expect(props.onWorktreePromptChange).toHaveBeenCalledWith("feature/fresh");
    expect(props.onWorktreePromptCopyAgentsMdChange).toHaveBeenCalledWith(false);
    expect(props.onWorktreeSetupScriptChange).toHaveBeenCalledWith("echo setup");
    expect(props.onWorktreePromptCancel).toHaveBeenCalledTimes(1);
    expect(props.onWorktreePromptConfirm).toHaveBeenCalledTimes(1);
    expect(props.onClonePromptCopyNameChange).toHaveBeenCalledWith("copy-name");
    expect(props.onClonePromptChooseCopiesFolder).toHaveBeenCalledTimes(1);
    expect(props.onClonePromptUseSuggestedFolder).toHaveBeenCalledTimes(1);
    expect(props.onClonePromptClearCopiesFolder).toHaveBeenCalledTimes(1);
    expect(props.onClonePromptCancel).toHaveBeenCalledTimes(1);
    expect(props.onClonePromptConfirm).toHaveBeenCalledTimes(1);
    expect(props.onWorkspaceFromUrlPromptUrlChange).toHaveBeenCalledWith("https://example.com/repo.git");
    expect(props.onWorkspaceFromUrlPromptTargetFolderNameChange).toHaveBeenCalledWith("repo-copy");
    expect(props.onWorkspaceFromUrlPromptChooseDestinationPath).toHaveBeenCalledTimes(1);
    expect(props.onWorkspaceFromUrlPromptClearDestinationPath).toHaveBeenCalledTimes(1);
    expect(props.onWorkspaceFromUrlPromptCancel).toHaveBeenCalledTimes(1);
    expect(props.onWorkspaceFromUrlPromptConfirm).toHaveBeenCalledTimes(1);
    expect(props.onMobileRemoteWorkspacePathInputChange).toHaveBeenCalledWith("/remote/workspace");
    expect(props.onMobileRemoteWorkspacePathPromptCancel).toHaveBeenCalledTimes(1);
    expect(props.onMobileRemoteWorkspacePathPromptConfirm).toHaveBeenCalledTimes(1);
    expect(props.onBranchSwitcherSelect).toHaveBeenCalledWith("feature/selected", baseWorkspace);
    expect(props.onBranchSwitcherCancel).toHaveBeenCalledTimes(1);
    expect(props.onCloseSettings).toHaveBeenCalledTimes(1);
    expect(settingsViewMock).toHaveBeenCalledWith(
      expect.objectContaining({ initialSection: "codex" }),
      undefined,
    );
  });

  it("passes undefined as initialSection when settings section is null", async () => {
    useGitBranchesMock.mockReturnValue({ branches: [] as BranchInfo[] });

    render(
      <AppModals
        {...createProps({
          settingsOpen: true,
          settingsSection: null,
        })}
      />,
    );

    const settingsView = await screen.findByTestId("settings-view");
    expect(settingsView.getAttribute("data-initial-section")).toBe("undefined");
    expect(settingsViewMock).toHaveBeenCalledWith(
      expect.objectContaining({ initialSection: undefined }),
      undefined,
    );
  });
});
