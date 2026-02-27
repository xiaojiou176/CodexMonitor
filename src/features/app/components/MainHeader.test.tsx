// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { WorkspaceInfo } from "../../../types";
import { MainHeader } from "./MainHeader";

const revealItemInDir = vi.hoisted(() => vi.fn());

vi.mock("@tauri-apps/plugin-opener", () => ({
  revealItemInDir: (...args: unknown[]) => revealItemInDir(...args),
}));

vi.mock("../../../utils/platformPaths", () => ({
  revealInFileManagerLabel: () => "在文件管理器中显示",
}));

vi.mock("./OpenAppMenu", () => ({
  OpenAppMenu: () => <div data-testid="open-app-menu" />,
}));

vi.mock("./LaunchScriptButton", () => ({
  LaunchScriptButton: () => null,
}));

vi.mock("./LaunchScriptEntryButton", () => ({
  LaunchScriptEntryButton: () => null,
}));

const workspace: WorkspaceInfo = {
  id: "ws-1",
  name: "CodexMonitor",
  path: "/tmp/codex-monitor",
  connected: true,
  settings: { sidebarCollapsed: false },
};

function createProps() {
  return {
    workspace,
    openTargets: [],
    openAppIconById: {},
    selectedOpenAppId: "",
    onSelectOpenAppId: vi.fn(),
    branchName: "main",
    branches: [
      { name: "main", isCurrent: true },
      { name: "feature/existing", isCurrent: false },
    ],
    onCheckoutBranch: vi.fn(),
    onCreateBranch: vi.fn(),
    onToggleTerminal: vi.fn(),
    isTerminalOpen: false,
    canCopyThread: true,
    onCopyThread: vi.fn(),
    onCopyThreadFull: vi.fn(),
    onCopyThreadCompact: vi.fn(),
    onApplyDetailedCopyPreset: vi.fn(),
    onApplyCompactCopyPreset: vi.fn(),
    onCopyThreadCurrentConfig: vi.fn(),
    onCopyThreadConfigChange: vi.fn(),
    copyThreadConfig: {
      includeUserInput: true,
      includeCodexReplies: true,
      toolOutputMode: "detailed" as const,
    },
  };
}

describe("MainHeader", () => {
  afterEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  it("handles branch menu checkout and create actions", async () => {
    const props = createProps();
    render(<MainHeader {...props} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "main" }));
    });
    const searchInput = await screen.findByRole("textbox", { name: "搜索分支" });

    await act(async () => {
      fireEvent.change(searchInput, { target: { value: "feature/existing" } });
      fireEvent.keyDown(searchInput, { key: "Enter" });
    });
    expect(props.onCheckoutBranch).toHaveBeenCalledWith("feature/existing");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "main" }));
    });
    const searchInputAgain = await screen.findByRole("textbox", { name: "搜索分支" });
    await act(async () => {
      fireEvent.change(searchInputAgain, { target: { value: "feature/new-branch" } });
      fireEvent.click(screen.getByRole("button", { name: "创建" }));
    });
    expect(props.onCreateBranch).toHaveBeenCalledWith("feature/new-branch");
  });

  it("applies copy presets and updates copy options", async () => {
    const props = createProps();
    render(<MainHeader {...props} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "复制选项" }));
    });

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "详细复制 保留用户输入、回复与完整工具输出" }),
      );
    });
    expect(props.onApplyDetailedCopyPreset).toHaveBeenCalledTimes(1);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "复制选项" }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("checkbox", { name: "包含用户输入" }));
    });
    expect(props.onCopyThreadConfigChange).toHaveBeenCalledWith({
      includeUserInput: false,
      includeCodexReplies: true,
      toolOutputMode: "detailed",
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("radio", { name: "简略" }));
    });
    expect(props.onCopyThreadConfigChange).toHaveBeenCalledWith({
      includeUserInput: true,
      includeCodexReplies: true,
      toolOutputMode: "compact",
    });
  });

  it("toggles terminal panel from action button", () => {
    const props = createProps();
    render(<MainHeader {...props} />);

    fireEvent.click(screen.getByRole("button", { name: "切换终端面板" }));
    expect(props.onToggleTerminal).toHaveBeenCalledTimes(1);
  });

  it("opens info popover and runs copy/reveal actions", async () => {
    const props = createProps();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText,
      },
    });

    render(
      <MainHeader
        {...props}
        disableBranchMenu
        parentPath="/tmp"
        worktreePath="/tmp/codex-monitor"
        worktreeLabel="feature/worktree"
      />,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "feature/worktree" }));
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "复制命令" }));
    });
    expect(writeText).toHaveBeenCalledWith('cd "codex-monitor"');

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "在文件管理器中显示" }));
    });
    expect(revealItemInDir).toHaveBeenCalledWith("/tmp/codex-monitor");
  });

  it("handles worktree rename focus/change/commit/cancel path", async () => {
    const props = createProps();
    const worktreeRename = {
      name: "feature/worktree",
      error: null,
      notice: null,
      isSubmitting: false,
      isDirty: true,
      upstream: null,
      onFocus: vi.fn(),
      onChange: vi.fn(),
      onCancel: vi.fn(),
      onCommit: vi.fn(),
    };

    render(
      <MainHeader
        {...props}
        disableBranchMenu
        worktreeLabel="feature/worktree"
        worktreeRename={worktreeRename}
      />,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "feature/worktree" }));
    });

    const input = screen.getByDisplayValue("feature/worktree");
    await act(async () => {
      fireEvent.focus(input);
    });
    expect(worktreeRename.onFocus).toHaveBeenCalledTimes(1);

    await act(async () => {
      fireEvent.change(input, { target: { value: "feature/renamed" } });
    });
    expect(worktreeRename.onChange).toHaveBeenCalledWith("feature/renamed");

    await act(async () => {
      fireEvent.keyDown(input, { key: "Enter" });
    });
    expect(worktreeRename.onCommit).toHaveBeenCalledTimes(1);

    const cancelCallsBeforeEscape = worktreeRename.onCancel.mock.calls.length;
    await act(async () => {
      fireEvent.keyDown(input, { key: "Escape" });
    });
    expect(worktreeRename.onCancel.mock.calls.length).toBeGreaterThan(cancelCallsBeforeEscape);
  });

  it("shows branch validation and async branch action errors", async () => {
    const props = createProps();
    props.onCreateBranch = vi.fn().mockRejectedValue(new Error("create failed"));
    props.onCheckoutBranch = vi.fn().mockRejectedValue(new Error("checkout failed"));
    render(<MainHeader {...props} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "main" }));
    });
    const searchInput = await screen.findByRole("textbox", { name: "搜索分支" });

    await act(async () => {
      fireEvent.change(searchInput, { target: { value: "bad name" } });
      fireEvent.keyDown(searchInput, { key: "Enter" });
    });
    expect(screen.getAllByText("Branch name cannot contain spaces.").length).toBeGreaterThan(0);
    expect(props.onCreateBranch).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.change(searchInput, { target: { value: "feature/new" } });
      fireEvent.click(screen.getByRole("button", { name: "创建" }));
    });
    expect(props.onCreateBranch).toHaveBeenCalledWith("feature/new");
    expect(screen.getByText("create failed")).toBeTruthy();

    await act(async () => {
      fireEvent.change(searchInput, { target: { value: "feature/existing" } });
      fireEvent.keyDown(searchInput, { key: "Enter" });
    });
    expect(props.onCheckoutBranch).toHaveBeenCalledWith("feature/existing");
    expect(screen.getByText("checkout failed")).toBeTruthy();
  });

  it("supports copy fallback handlers and ignores config changes when callback is absent", async () => {
    const props = createProps();
    props.onApplyDetailedCopyPreset = undefined;
    props.onApplyCompactCopyPreset = undefined;
    props.onCopyThreadCurrentConfig = undefined;
    props.onCopyThreadConfigChange = undefined;
    props.copyThreadConfig = undefined;
    render(<MainHeader {...props} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "复制选项" }));
    });
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "详细复制 保留用户输入、回复与完整工具输出" }),
      );
    });
    expect(props.onCopyThreadFull).toHaveBeenCalledTimes(1);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "复制选项" }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "精简复制 保留关键对话，省略工具细节" }));
    });
    expect(props.onCopyThreadCompact).toHaveBeenCalledTimes(1);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "复制选项" }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("checkbox", { name: "包含 Codex 回复（所有）" }));
      fireEvent.click(screen.getByRole("radio", { name: "不包含" }));
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "复制对话" }));
    });
    expect(props.onCopyThread).toHaveBeenCalledTimes(1);
  });

  it("renders optional action groups based on workspace tool and extra action flags", () => {
    const props = createProps();
    render(
      <MainHeader
        {...props}
        showWorkspaceTools={false}
        showTerminalButton={false}
        extraActionsNode={<button type="button">额外操作</button>}
      />,
    );

    expect(screen.queryByTestId("open-app-menu")).toBeNull();
    expect(screen.getByRole("button", { name: "额外操作" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "切换终端面板" })).toBeNull();
  });

  it("handles worktree rename blur and upstream confirm flow", async () => {
    const props = createProps();
    const onUpstreamConfirm = vi.fn();
    const worktreeRename = {
      name: "feature/worktree",
      error: "rename failed",
      notice: "rename notice",
      isSubmitting: false,
      isDirty: true,
      upstream: {
        oldBranch: "feature/worktree",
        newBranch: "feature/new-name",
        error: "upstream failed",
        isSubmitting: false,
        onConfirm: onUpstreamConfirm,
      },
      onFocus: vi.fn(),
      onChange: vi.fn(),
      onCancel: vi.fn(),
      onCommit: vi.fn(),
    };

    render(
      <MainHeader
        {...props}
        disableBranchMenu
        worktreeLabel="feature/worktree"
        worktreeRename={worktreeRename}
      />,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "feature/worktree" }));
    });

    const input = screen.getByDisplayValue("feature/worktree");
    const confirmButton = screen.getByRole("button", { name: "确认重命名" });

    await act(async () => {
      fireEvent.blur(input, { relatedTarget: confirmButton });
    });
    expect(worktreeRename.onCommit).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.blur(input, { relatedTarget: null });
    });
    expect(worktreeRename.onCommit).toHaveBeenCalledTimes(1);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "更新上游" }));
    });
    expect(onUpstreamConfirm).toHaveBeenCalledTimes(1);
    expect(screen.getByText("rename failed")).toBeTruthy();
    expect(screen.getByText("rename notice")).toBeTruthy();
    expect(screen.getByText("upstream failed")).toBeTruthy();
  });
});
