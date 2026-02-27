// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_LAUNCH_SCRIPT_ICON } from "../utils/launchScriptIcons";
import { LaunchScriptButton } from "./LaunchScriptButton";

function createProps(
  overrides: Partial<ComponentProps<typeof LaunchScriptButton>> = {},
): ComponentProps<typeof LaunchScriptButton> {
  return {
    launchScript: "npm run dev",
    editorOpen: false,
    draftScript: "npm run dev",
    isSaving: false,
    error: null,
    onRun: vi.fn(),
    onOpenEditor: vi.fn(),
    onCloseEditor: vi.fn(),
    onDraftChange: vi.fn(),
    onSave: vi.fn(),
    showNew: false,
    newEditorOpen: false,
    newDraftScript: "",
    newDraftIcon: DEFAULT_LAUNCH_SCRIPT_ICON,
    newDraftLabel: "",
    newError: null,
    onOpenNew: vi.fn(),
    onCloseNew: vi.fn(),
    onNewDraftChange: vi.fn(),
    onNewDraftIconChange: vi.fn(),
    onNewDraftLabelChange: vi.fn(),
    onCreateNew: vi.fn(),
    ...overrides,
  };
}

describe("LaunchScriptButton", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("runs script from primary button and shows run label when script exists", () => {
    const props = createProps({ launchScript: "pnpm dev" });
    render(<LaunchScriptButton {...props} />);

    const runButton = screen.getByRole("button", { name: "运行启动脚本" });
    fireEvent.click(runButton);

    expect(props.onRun).toHaveBeenCalledTimes(1);
  });

  it("shows setup label when no launch script is configured", () => {
    render(<LaunchScriptButton {...createProps({ launchScript: "   " })} />);

    expect(screen.getByRole("button", { name: "设置启动脚本" })).toBeTruthy();
  });

  it("opens menu via context menu and renders editor content", () => {
    const props = createProps({ editorOpen: true });
    render(<LaunchScriptButton {...props} />);

    const trigger = screen.getByRole("button", { name: "运行启动脚本" });
    fireEvent.contextMenu(trigger);

    expect(props.onOpenEditor).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText("启动脚本")).toBeTruthy();
    expect(screen.getByPlaceholderText("例如 npm run dev")).toBeTruthy();
  });

  it("renders save error message in editor", () => {
    render(<LaunchScriptButton {...createProps({ editorOpen: true, error: "保存失败" })} />);

    expect(screen.getByText("保存失败")).toBeTruthy();
  });

  it("disables save/create actions and shows saving text when isSaving is true", () => {
    const props = createProps({
      editorOpen: true,
      isSaving: true,
      showNew: true,
      newEditorOpen: true,
    });
    render(<LaunchScriptButton {...props} />);

    const savingButtons = screen.getAllByRole("button", { name: "保存中..." });
    expect(savingButtons.length).toBe(2);
    savingButtons.forEach((button) => {
      expect(button.getAttribute("disabled")).not.toBeNull();
    });
  });
});
