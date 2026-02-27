/** @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CustomPromptOption } from "../../../types";
import { PromptPanel } from "./PromptPanel";
import { pushErrorToast } from "../../../services/toasts";

const popupMock = vi.hoisted(() => vi.fn());
const menuNew = vi.hoisted(() => vi.fn(async ({ items }) => ({ popup: popupMock, items })));
const menuItemNew = vi.hoisted(() => vi.fn(async (options) => options));

vi.mock("@tauri-apps/api/menu", () => ({
  Menu: { new: menuNew },
  MenuItem: { new: menuItemNew },
}));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: vi.fn(() => ({ scaleFactor: () => 1 })),
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

vi.mock("../../../services/toasts", () => ({
  pushErrorToast: vi.fn(),
}));

const pushErrorToastMock = vi.mocked(pushErrorToast);

const workspacePrompt: CustomPromptOption = {
  name: "workspace-review",
  path: "/repo/.codex/prompts/workspace-review.md",
  content: "Workspace review for $NAME",
  description: "workspace prompt",
  scope: "workspace",
};

const globalPrompt: CustomPromptOption = {
  name: "global-summary",
  path: "/Users/user/.codex/prompts/global-summary.md",
  content: "Global summary",
  description: "global prompt",
  scope: "global",
};

const baseProps = {
  prompts: [workspacePrompt, globalPrompt],
  workspacePath: "/repo",
  filePanelMode: "prompts" as const,
  onFilePanelModeChange: vi.fn(),
  onSendPrompt: vi.fn(async () => {}),
  onSendPromptToNewAgent: vi.fn(async () => {}),
  onCreatePrompt: vi.fn(async () => {}),
  onUpdatePrompt: vi.fn(async () => {}),
  onDeletePrompt: vi.fn(async () => {}),
  onMovePrompt: vi.fn(async () => {}),
  onRevealWorkspacePrompts: vi.fn(async () => {}),
  onRevealGeneralPrompts: vi.fn(async () => {}),
  canRevealGeneralPrompts: true,
};

function renderPanel(overrides: Partial<typeof baseProps> = {}) {
  return render(<PromptPanel {...baseProps} {...overrides} />);
}

describe("PromptPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    menuNew.mockClear();
    menuItemNew.mockClear();
    popupMock.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders grouped prompts and filters with search", () => {
    renderPanel();

    expect(screen.getByText("2 个提示词")).not.toBeNull();
    expect(screen.getByText("workspace-review")).not.toBeNull();
    expect(screen.getByText("global-summary")).not.toBeNull();

    fireEvent.change(screen.getByRole("searchbox", { name: "筛选提示词" }), {
      target: { value: "workspace" },
    });

    expect(screen.getByText("1 个提示词")).not.toBeNull();
    expect(screen.getByText("workspace-review")).not.toBeNull();
    expect(screen.queryByText("global-summary")).toBeNull();
  });

  it("expands prompt args and sends to current/new agent", async () => {
    const onSendPrompt = vi.fn(async () => {});
    const onSendPromptToNewAgent = vi.fn(async () => {});
    renderPanel({ onSendPrompt, onSendPromptToNewAgent });

    fireEvent.change(screen.getByLabelText("Arguments for workspace-review"), {
      target: { value: "NAME=Alice" },
    });

    const sendButtons = screen.getAllByRole("button", { name: "Send" });
    fireEvent.click(sendButtons[0]);

    await waitFor(() => {
      expect(onSendPrompt).toHaveBeenCalledWith("Workspace review for Alice");
    });

    const newAgentButtons = screen.getAllByRole("button", { name: "New agent" });
    fireEvent.click(newAgentButtons[0]);

    await waitFor(() => {
      expect(onSendPromptToNewAgent).toHaveBeenCalledWith("Workspace review for Alice");
    });
  });

  it("shows toast when prompt argument expansion fails", async () => {
    const onSendPrompt = vi.fn(async () => {});
    renderPanel({ onSendPrompt });

    fireEvent.change(screen.getByLabelText("Arguments for workspace-review"), {
      target: { value: "invalid-token" },
    });

    fireEvent.click(screen.getAllByRole("button", { name: "Send" })[0]);

    await waitFor(() => {
      expect(pushErrorToastMock).toHaveBeenCalled();
    });
    expect(onSendPrompt).not.toHaveBeenCalled();
  });

  it("creates prompt with validation and error handling", async () => {
    const onCreatePrompt = vi
      .fn()
      .mockRejectedValueOnce(new Error("create failed"))
      .mockResolvedValue(undefined);
    renderPanel({ onCreatePrompt });

    fireEvent.click(screen.getByRole("button", { name: "添加工作区提示词" }));

    fireEvent.click(screen.getByRole("button", { name: "创建" }));
    expect(screen.getByText("Name is required.")).not.toBeNull();

    const nameInput = screen.getByPlaceholderText("提示词名称");
    fireEvent.change(nameInput, { target: { value: "bad name" } });
    fireEvent.click(screen.getByRole("button", { name: "创建" }));
    expect(screen.getByText("Name cannot include whitespace.")).not.toBeNull();

    fireEvent.change(nameInput, { target: { value: " new-workspace-prompt " } });
    fireEvent.change(screen.getByPlaceholderText("可选描述"), {
      target: { value: " desc " },
    });
    fireEvent.change(screen.getByPlaceholderText("可选参数提示"), {
      target: { value: " args " },
    });
    fireEvent.change(screen.getByPlaceholderText("提示词内容"), {
      target: { value: "hello" },
    });

    fireEvent.click(screen.getByRole("button", { name: "创建" }));
    await waitFor(() => {
      expect(screen.getByText("create failed")).not.toBeNull();
    });

    fireEvent.click(screen.getByRole("button", { name: "创建" }));

    await waitFor(() => {
      expect(onCreatePrompt).toHaveBeenLastCalledWith({
        scope: "workspace",
        name: "new-workspace-prompt",
        description: "desc",
        argumentHint: "args",
        content: "hello",
      });
    });

    expect(screen.queryByPlaceholderText("提示词名称")).toBeNull();
  });

  it("edits prompt via menu action", async () => {
    const onUpdatePrompt = vi.fn(async () => {});
    renderPanel({ onUpdatePrompt });

    fireEvent.click(screen.getAllByRole("button", { name: "提示词操作" })[0], {
      clientX: 10,
      clientY: 20,
    });

    await waitFor(() => expect(menuNew).toHaveBeenCalled());

    const menuArgs = menuNew.mock.calls[menuNew.mock.calls.length - 1]?.[0];
    const editItem = menuArgs.items.find((item: { text: string }) => item.text === "编辑");
    await act(async () => {
      await editItem.action();
    });

    const nameInput = screen.getByPlaceholderText("提示词名称");
    fireEvent.change(nameInput, { target: { value: "workspace-updated" } });
    fireEvent.change(screen.getByPlaceholderText("提示词内容"), {
      target: { value: "updated body" },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(onUpdatePrompt).toHaveBeenCalledWith({
        path: workspacePrompt.path,
        name: "workspace-updated",
        description: workspacePrompt.description,
        argumentHint: null,
        content: "updated body",
      });
    });
  });

  it("moves prompts via menu and highlights the row", async () => {
    const onMovePrompt = vi.fn(async () => {});
    const { container } = renderPanel({ onMovePrompt });

    fireEvent.click(screen.getAllByRole("button", { name: "提示词操作" })[0], {
      clientX: 10,
      clientY: 20,
    });

    await waitFor(() => expect(menuNew).toHaveBeenCalled());

    const menuArgs = menuNew.mock.calls[menuNew.mock.calls.length - 1]?.[0];
    const moveItem = menuArgs.items.find((item: { text: string }) =>
      item.text.startsWith("Move to"),
    );
    await act(async () => {
      await moveItem.action();
    });

    await waitFor(() => {
      expect(onMovePrompt).toHaveBeenCalledWith({
        path: workspacePrompt.path,
        scope: "global",
      });
    });

    const row = container.querySelector(".prompt-row.is-highlight");
    expect(row).not.toBeNull();
  });

  it("handles delete confirm, cancel, and failure", async () => {
    const onDeletePrompt = vi
      .fn()
      .mockRejectedValueOnce(new Error("delete failed"))
      .mockResolvedValueOnce(undefined);
    renderPanel({ onDeletePrompt });

    fireEvent.click(screen.getAllByRole("button", { name: "提示词操作" })[0], {
      clientX: 10,
      clientY: 20,
    });

    await waitFor(() => expect(menuNew).toHaveBeenCalled());

    const menuArgs = menuNew.mock.calls[menuNew.mock.calls.length - 1]?.[0];
    const deleteItem = menuArgs.items.find((item: { text: string }) => item.text === "删除");
    await act(async () => {
      await deleteItem.action();
    });

    expect(screen.getByText("删除此提示词？")).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByText("删除此提示词？")).toBeNull();

    await act(async () => {
      await deleteItem.action();
    });
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(pushErrorToastMock).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(onDeletePrompt).toHaveBeenLastCalledWith(workspacePrompt.path);
    });
    expect(screen.queryByText("删除此提示词？")).toBeNull();
  });

  it("renders empty state links based on reveal availability", async () => {
    const onRevealWorkspacePrompts = vi.fn(async () => {});
    const onRevealGeneralPrompts = vi.fn(async () => {});
    const { rerender } = renderPanel({
      prompts: [],
      workspacePath: null,
      canRevealGeneralPrompts: false,
      onRevealWorkspacePrompts,
      onRevealGeneralPrompts,
    });

    expect(screen.getByText("暂无提示词")).not.toBeNull();
    expect(screen.getByText("暂无工作区提示词")).not.toBeNull();
    expect(screen.getByText("暂无通用提示词")).not.toBeNull();
    expect(screen.queryByRole("button", { name: "工作区提示词目录" })).toBeNull();
    expect(screen.queryByRole("button", { name: "CODEX_HOME/prompts" })).toBeNull();

    rerender(
      <PromptPanel
        {...baseProps}
        prompts={[]}
        workspacePath="/repo"
        canRevealGeneralPrompts
        onRevealWorkspacePrompts={onRevealWorkspacePrompts}
        onRevealGeneralPrompts={onRevealGeneralPrompts}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "工作区提示词目录" }));
    fireEvent.click(screen.getByRole("button", { name: "CODEX_HOME/prompts" }));

    await waitFor(() => {
      expect(onRevealWorkspacePrompts).toHaveBeenCalledTimes(1);
      expect(onRevealGeneralPrompts).toHaveBeenCalledTimes(1);
    });
  });

  it("clears pending delete state when prompt disappears", async () => {
    const { rerender } = renderPanel();

    fireEvent.click(screen.getAllByRole("button", { name: "提示词操作" })[0], {
      clientX: 10,
      clientY: 20,
    });

    await waitFor(() => expect(menuNew).toHaveBeenCalled());

    const menuArgs = menuNew.mock.calls[menuNew.mock.calls.length - 1]?.[0];
    const deleteItem = menuArgs.items.find((item: { text: string }) => item.text === "删除");
    await act(async () => {
      await deleteItem.action();
    });

    expect(screen.getByText("删除此提示词？")).not.toBeNull();

    rerender(
      <PromptPanel
        {...baseProps}
        prompts={[globalPrompt]}
      />,
    );

    expect(screen.queryByText("删除此提示词？")).toBeNull();
  });
});
