/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { GitLogEntry } from "../../../types";
import { GitDiffPanel } from "./GitDiffPanel";
import { fileManagerName } from "../../../utils/platformPaths";

const menuNew = vi.hoisted(() =>
  vi.fn(async ({ items }) => ({ popup: vi.fn(), items })),
);
const menuItemNew = vi.hoisted(() => vi.fn(async (options) => options));
const clipboardWriteText = vi.hoisted(() => vi.fn());

vi.mock("@tauri-apps/api/menu", () => ({
  Menu: { new: menuNew },
  MenuItem: { new: menuItemNew },
}));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({ scaleFactor: () => 1 }),
}));

vi.mock("@tauri-apps/api/dpi", () => ({
  LogicalPosition: class LogicalPosition {
    x: number;
    y: number;
    constructor(x: number, y: number) {
      this.x = x;
      this.y = y;
    }
  },
}));

const revealItemInDir = vi.hoisted(() => vi.fn());

vi.mock("@tauri-apps/plugin-opener", () => ({
  openUrl: vi.fn(),
  revealItemInDir: (...args: unknown[]) => revealItemInDir(...args),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  ask: vi.fn(async () => true),
}));

vi.mock("../../../services/toasts", () => ({
  pushErrorToast: vi.fn(),
}));

Object.defineProperty(navigator, "clipboard", {
  value: { writeText: (...args: unknown[]) => clipboardWriteText(...args) },
  configurable: true,
});

const logEntries: GitLogEntry[] = [];

const baseProps = {
  mode: "diff" as const,
  onModeChange: vi.fn(),
  filePanelMode: "git" as const,
  onFilePanelModeChange: vi.fn(),
  branchName: "main",
  totalAdditions: 0,
  totalDeletions: 0,
  fileStatus: "1 file changed",
  logEntries,
  stagedFiles: [],
  unstagedFiles: [],
};

afterEach(() => {
  cleanup();
});

describe("GitDiffPanel", () => {
  it("shows default diff empty state when there are no changes", () => {
    render(<GitDiffPanel {...baseProps} />);

    expect(screen.getByText("未检测到更改。")).not.toBeNull();
  });

  it("shows scoped empty state when switched to staged without staged changes", () => {
    render(
      <GitDiffPanel
        {...baseProps}
        unstagedFiles={[
          { path: "src/unstaged.ts", status: "M", additions: 1, deletions: 0 },
        ]}
      />,
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Staged" })[0]);
    expect(screen.getByText("当前范围没有已暂存改动。")).not.toBeNull();
  });

  it("enables commit when message exists and only unstaged changes", () => {
    const onCommit = vi.fn();
    render(
      <GitDiffPanel
        {...baseProps}
        commitMessage="feat: add thing"
        onCommit={onCommit}
        onGenerateCommitMessage={vi.fn()}
        unstagedFiles={[
          { path: "file.txt", status: "M", additions: 1, deletions: 0 },
        ]}
      />,
    );

    const commitButton = screen.getByRole("button", { name: "提交" });
    expect((commitButton as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(commitButton);
    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it("adds a show in file manager option for file context menus", async () => {
    clipboardWriteText.mockClear();
    const { container } = render(
      <GitDiffPanel
        {...baseProps}
        workspacePath="/tmp/repo"
        gitRoot="/tmp/repo/"
        unstagedFiles={[
          { path: "src/sample.ts", status: "M", additions: 1, deletions: 0 },
        ]}
      />,
    );

    const row = container.querySelector(".diff-row");
    expect(row).not.toBeNull();
    fireEvent.contextMenu(row as Element);

    await waitFor(() => expect(menuNew).toHaveBeenCalled());
    const menuArgs = menuNew.mock.calls[0]?.[0];
    const revealItem = menuArgs.items.find(
      (item: { text: string }) => item.text === `在 ${fileManagerName()} 中显示`,
    );

    expect(revealItem).not.toBeUndefined();
    await revealItem.action();
    expect(revealItemInDir).toHaveBeenCalledWith("/tmp/repo/src/sample.ts");
  });

  it("copies file name and path from the context menu", async () => {
    clipboardWriteText.mockClear();
    const { container } = render(
      <GitDiffPanel
        {...baseProps}
        workspacePath="/tmp/repo"
        gitRoot="/tmp/repo"
        unstagedFiles={[
          { path: "src/sample.ts", status: "M", additions: 1, deletions: 0 },
        ]}
      />,
    );

    const row = container.querySelector(".diff-row");
    expect(row).not.toBeNull();
    fireEvent.contextMenu(row as Element);

    await waitFor(() => expect(menuNew).toHaveBeenCalled());
    const menuArgs = menuNew.mock.calls[menuNew.mock.calls.length - 1]?.[0];
    const copyNameItem = menuArgs.items.find(
      (item: { text: string }) => item.text === "复制文件名",
    );
    const copyPathItem = menuArgs.items.find(
      (item: { text: string }) => item.text === "复制文件路径",
    );

    expect(copyNameItem).not.toBeUndefined();
    expect(copyPathItem).not.toBeUndefined();

    await copyNameItem.action();
    await copyPathItem.action();

    expect(clipboardWriteText).toHaveBeenCalledWith("sample.ts");
    expect(clipboardWriteText).toHaveBeenCalledWith("src/sample.ts");
  });

  it("resolves relative git roots against the workspace path", async () => {
    revealItemInDir.mockClear();
    menuNew.mockClear();
    const { container } = render(
      <GitDiffPanel
        {...baseProps}
        workspacePath="/tmp/repo"
        gitRoot="apps"
        unstagedFiles={[
          { path: "src/sample.ts", status: "M", additions: 1, deletions: 0 },
        ]}
      />,
    );

    const row = container.querySelector(".diff-row");
    expect(row).not.toBeNull();
    fireEvent.contextMenu(row as Element);

    await waitFor(() => expect(menuNew).toHaveBeenCalled());
    const menuArgs = menuNew.mock.calls[menuNew.mock.calls.length - 1]?.[0];
    const revealItem = menuArgs.items.find(
      (item: { text: string }) => item.text === `在 ${fileManagerName()} 中显示`,
    );

    expect(revealItem).not.toBeUndefined();
    await revealItem.action();
    expect(revealItemInDir).toHaveBeenCalledWith("/tmp/repo/apps/src/sample.ts");
  });

  it("copies file path relative to the workspace root", async () => {
    clipboardWriteText.mockClear();
    const { container } = render(
      <GitDiffPanel
        {...baseProps}
        workspacePath="/tmp/repo"
        gitRoot="apps"
        unstagedFiles={[
          { path: "src/sample.ts", status: "M", additions: 1, deletions: 0 },
        ]}
      />,
    );

    const row = container.querySelector(".diff-row");
    expect(row).not.toBeNull();
    fireEvent.contextMenu(row as Element);

    await waitFor(() => expect(menuNew).toHaveBeenCalled());
    const menuArgs = menuNew.mock.calls[menuNew.mock.calls.length - 1]?.[0];
    const copyPathItem = menuArgs.items.find(
      (item: { text: string }) => item.text === "复制文件路径",
    );

    expect(copyPathItem).not.toBeUndefined();
    await copyPathItem.action();

    expect(clipboardWriteText).toHaveBeenCalledWith("apps/src/sample.ts");
  });

  it("does not trim paths when the git root only shares a prefix", async () => {
    clipboardWriteText.mockClear();
    const { container } = render(
      <GitDiffPanel
        {...baseProps}
        workspacePath="/tmp/repo"
        gitRoot="/tmp/repo-tools"
        unstagedFiles={[
          { path: "src/sample.ts", status: "M", additions: 1, deletions: 0 },
        ]}
      />,
    );

    const row = container.querySelector(".diff-row");
    expect(row).not.toBeNull();
    fireEvent.contextMenu(row as Element);

    await waitFor(() => expect(menuNew).toHaveBeenCalled());
    const menuArgs = menuNew.mock.calls[menuNew.mock.calls.length - 1]?.[0];
    const copyPathItem = menuArgs.items.find(
      (item: { text: string }) => item.text === "复制文件路径",
    );

    expect(copyPathItem).not.toBeUndefined();
    await copyPathItem.action();

    expect(clipboardWriteText).toHaveBeenCalledWith("src/sample.ts");
  });

  it("switches review scope between uncommitted, staged and unstaged", () => {
    const { container } = render(
      <GitDiffPanel
        {...baseProps}
        stagedFiles={[
          { path: "src/staged.ts", status: "M", additions: 2, deletions: 1 },
        ]}
        unstagedFiles={[
          { path: "src/unstaged.ts", status: "M", additions: 3, deletions: 0 },
        ]}
      />,
    );

    const scope = container.querySelector(".diff-review-scope");
    expect(scope).not.toBeNull();

    const panelQuery = within(container);
    const scopeQuery = within(scope as HTMLElement);

    expect(panelQuery.queryAllByText("已暂存 (1)").length).toBeGreaterThan(0);
    expect(panelQuery.queryAllByText("未暂存 (1)").length).toBeGreaterThan(0);

    fireEvent.click(scopeQuery.getByRole("button", { name: "Staged" }));
    expect(panelQuery.queryAllByText("已暂存 (1)").length).toBeGreaterThan(0);
    expect(panelQuery.queryAllByText("未暂存 (1)").length).toBe(0);

    fireEvent.click(scopeQuery.getByRole("button", { name: "Unstaged" }));
    expect(panelQuery.queryAllByText("已暂存 (1)").length).toBe(0);
    expect(panelQuery.queryAllByText("未暂存 (1)").length).toBeGreaterThan(0);
  });

  it("applies stage and unstage actions only to matching files in multi-selection", async () => {
    menuNew.mockClear();
    const onStageFile = vi.fn(async () => {});
    const onUnstageFile = vi.fn(async () => {});
    render(
      <GitDiffPanel
        {...baseProps}
        stagedFiles={[
          { path: "src/alpha-staged.ts", status: "M", additions: 1, deletions: 0 },
        ]}
        unstagedFiles={[
          { path: "src/beta-unstaged.ts", status: "M", additions: 1, deletions: 0 },
        ]}
        onStageFile={onStageFile}
        onUnstageFile={onUnstageFile}
      />,
    );

    const stagedFileButton = screen.getByRole("button", { name: /alpha-staged/i });
    const unstagedFileButton = screen.getByRole("button", { name: /beta-unstaged/i });
    fireEvent.click(stagedFileButton);
    fireEvent.click(unstagedFileButton, { ctrlKey: true });

    const stagedRow = stagedFileButton.closest(".diff-row");
    expect(stagedRow).not.toBeNull();
    fireEvent.contextMenu(stagedRow as Element);

    await waitFor(() => expect(menuNew).toHaveBeenCalled());
    const menuArgs = menuNew.mock.calls[menuNew.mock.calls.length - 1]?.[0];
    const unstageItem = menuArgs.items.find((item: { text: string }) => item.text === "取消暂存");
    const stageItem = menuArgs.items.find((item: { text: string }) => item.text === "暂存文件");

    expect(unstageItem).not.toBeUndefined();
    expect(stageItem).not.toBeUndefined();

    await unstageItem.action();
    await stageItem.action();

    expect(onUnstageFile).toHaveBeenCalledTimes(1);
    expect(onUnstageFile).toHaveBeenCalledWith("src/alpha-staged.ts");
    expect(onStageFile).toHaveBeenCalledTimes(1);
    expect(onStageFile).toHaveBeenCalledWith("src/beta-unstaged.ts");
  });

  it("shows counted batch actions for shift-range multi-selection", async () => {
    menuNew.mockClear();
    const onStageFile = vi.fn(async () => {});
    const onUnstageFile = vi.fn(async () => {});

    render(
      <GitDiffPanel
        {...baseProps}
        stagedFiles={[
          { path: "src/alpha-staged.ts", status: "M", additions: 1, deletions: 0 },
        ]}
        unstagedFiles={[
          { path: "src/beta-unstaged.ts", status: "M", additions: 1, deletions: 0 },
          { path: "src/gamma-unstaged.ts", status: "M", additions: 1, deletions: 0 },
        ]}
        onStageFile={onStageFile}
        onUnstageFile={onUnstageFile}
      />,
    );

    const alphaButton = screen.getAllByRole("button", { name: /alpha-staged/i })[0];
    const gammaButton = screen.getAllByRole("button", { name: /gamma-unstaged/i })[0];

    fireEvent.click(alphaButton);
    fireEvent.click(gammaButton, { shiftKey: true });

    fireEvent.contextMenu(gammaButton.closest(".diff-row") as Element);

    await waitFor(() => expect(menuNew).toHaveBeenCalled());
    const menuArgs = menuNew.mock.calls[menuNew.mock.calls.length - 1]?.[0];
    const unstageItem = menuArgs.items.find(
      (item: { text: string }) => item.text === "取消暂存",
    );
    const stageItem = menuArgs.items.find(
      (item: { text: string }) => item.text === "暂存文件（2 个）",
    );

    expect(unstageItem).not.toBeUndefined();
    expect(stageItem).not.toBeUndefined();

    await unstageItem.action();
    await stageItem.action();

    expect(onUnstageFile).toHaveBeenCalledTimes(1);
    expect(onUnstageFile).toHaveBeenCalledWith("src/alpha-staged.ts");
    expect(onStageFile).toHaveBeenCalledTimes(2);
    expect(onStageFile).toHaveBeenNthCalledWith(1, "src/beta-unstaged.ts");
    expect(onStageFile).toHaveBeenNthCalledWith(2, "src/gamma-unstaged.ts");
  });

  it("switches among diff/log/issues/prs modes and renders mode-specific empty states", async () => {
    const onModeChange = vi.fn();

    function ControlledModePanel() {
      const [mode, setMode] = useState<"diff" | "log" | "issues" | "prs">("diff");
      return (
        <GitDiffPanel
          {...baseProps}
          mode={mode}
          onModeChange={(nextMode) => {
            onModeChange(nextMode);
            setMode(nextMode);
          }}
        />
      );
    }

    render(<ControlledModePanel />);

    const modeSelect = screen.getAllByRole("combobox", { name: "Git 面板视图" })[0];

    fireEvent.change(modeSelect, {
      target: { value: "log" },
    });
    expect(await screen.findByText("暂无提交。")).not.toBeNull();

    fireEvent.change(modeSelect, {
      target: { value: "issues" },
    });
    expect(await screen.findByText("暂无未关闭 Issue。")).not.toBeNull();

    fireEvent.change(modeSelect, {
      target: { value: "prs" },
    });
    expect(await screen.findByText("暂无未关闭 PR。")).not.toBeNull();

    expect(onModeChange).toHaveBeenCalledWith("log");
    expect(onModeChange).toHaveBeenCalledWith("issues");
    expect(onModeChange).toHaveBeenCalledWith("prs");
  });

  it("shows sidebar error and allows dismissing it", () => {
    render(<GitDiffPanel {...baseProps} error="fatal diff error" />);

    expect(screen.getByText("fatal diff error")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "关闭错误提示" }));
    expect(screen.queryByText("fatal diff error")).toBeNull();
  });
});
