// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LaunchScriptEntryButton } from "./LaunchScriptEntryButton";

vi.mock("./LaunchScriptIconPicker", () => ({
  LaunchScriptIconPicker: ({ onChange }: { onChange: (value: string) => void }) => (
    <button type="button" onClick={() => onChange("debug")}>
      选择图标
    </button>
  ),
}));

function createProps(
  overrides: Partial<ComponentProps<typeof LaunchScriptEntryButton>> = {},
): ComponentProps<typeof LaunchScriptEntryButton> {
  return {
    entry: {
      id: "entry-1",
      script: "npm run dev",
      icon: "play",
      label: "运行开发",
    },
    editorOpen: false,
    draftScript: "npm run dev",
    draftIcon: "play",
    draftLabel: "运行开发",
    isSaving: false,
    error: null,
    onRun: vi.fn(),
    onOpenEditor: vi.fn(),
    onCloseEditor: vi.fn(),
    onDraftChange: vi.fn(),
    onDraftIconChange: vi.fn(),
    onDraftLabelChange: vi.fn(),
    onSave: vi.fn(),
    onDelete: vi.fn(),
    ...overrides,
  };
}

describe("LaunchScriptEntryButton", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders run button and keeps editor hidden when editorOpen is false", () => {
    const props = createProps();
    render(<LaunchScriptEntryButton {...props} />);

    expect(screen.getByRole("button", { name: "运行开发" })).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("uses icon label fallback for aria label and title when entry label is blank", () => {
    render(<LaunchScriptEntryButton {...createProps({ entry: { id: "entry-1", script: "npm run dev", icon: "play", label: "   " } })} />);

    const runButton = screen.getByRole("button", { name: "运行" });
    expect(runButton.getAttribute("title")).toBe("运行");
  });

  it("fires run and open-editor callbacks from click/contextmenu", () => {
    const props = createProps();
    render(<LaunchScriptEntryButton {...props} />);

    const runButton = screen.getByRole("button", { name: "运行开发" });
    fireEvent.click(runButton);
    fireEvent.contextMenu(runButton);

    expect(props.onRun).toHaveBeenCalledTimes(1);
    expect(props.onOpenEditor).toHaveBeenCalledTimes(1);
  });

  it("renders editor branch with fields and error when editorOpen is true", () => {
    render(<LaunchScriptEntryButton {...createProps({ editorOpen: true, error: "保存失败" })} />);

    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText("运行开发")).toBeTruthy();
    expect(screen.getByPlaceholderText("可选标签")).toBeTruthy();
    expect(screen.getByPlaceholderText("例如 npm run dev")).toBeTruthy();
    expect(screen.getByText("保存失败")).toBeTruthy();
  });

  it("fires editor callbacks for draft/edit actions", () => {
    const props = createProps({ editorOpen: true });
    render(<LaunchScriptEntryButton {...props} />);

    const labelInput = screen.getByPlaceholderText("可选标签");
    const scriptTextarea = screen.getByPlaceholderText("例如 npm run dev");

    fireEvent.change(labelInput, { target: { value: "新的标签" } });
    fireEvent.change(scriptTextarea, { target: { value: "pnpm dev" } });
    fireEvent.click(screen.getByRole("button", { name: "选择图标" }));
    fireEvent.click(screen.getByRole("button", { name: "取消" }));
    fireEvent.click(screen.getByRole("button", { name: "删除" }));
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    expect(props.onDraftLabelChange).toHaveBeenCalledWith("新的标签");
    expect(props.onDraftChange).toHaveBeenCalledWith("pnpm dev");
    expect(props.onDraftIconChange).toHaveBeenCalledWith("debug");
    expect(props.onCloseEditor).toHaveBeenCalledTimes(1);
    expect(props.onDelete).toHaveBeenCalledTimes(1);
    expect(props.onSave).toHaveBeenCalledTimes(1);
  });

  it("disables save button and shows saving text when isSaving is true", () => {
    const props = createProps({ editorOpen: true, isSaving: true });
    render(<LaunchScriptEntryButton {...props} />);

    const saveButton = screen.getByRole("button", { name: "保存中..." });
    expect(saveButton.getAttribute("disabled")).not.toBeNull();

    fireEvent.click(saveButton);
    expect(props.onSave).toHaveBeenCalledTimes(0);
  });
});
