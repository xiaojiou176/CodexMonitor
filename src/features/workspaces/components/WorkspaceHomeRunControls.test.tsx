// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ModelOption } from "../../../types";
import { WorkspaceHomeRunControls } from "./WorkspaceHomeRunControls";

afterEach(() => {
  cleanup();
});

const buildModel = (id: string, displayName: string): ModelOption => ({
  id,
  model: id,
  displayName,
  description: "",
  supportedReasoningEfforts: [],
  defaultReasoningEffort: null,
  isDefault: false,
});

const models = [buildModel("gpt-1", "Model One"), buildModel("gpt-2", "Model Two")];

const buildProps = () => ({
  workspaceKind: "main" as const,
  runMode: "local" as const,
  onRunModeChange: vi.fn(),
  models,
  selectedModelId: "gpt-1",
  onSelectModel: vi.fn(),
  modelSelections: {} as Record<string, number>,
  onToggleModel: vi.fn(),
  onModelCountChange: vi.fn(),
  collaborationModes: [
    { id: "mode-default", label: "Default" },
    { id: "mode-review", label: "Review" },
  ],
  selectedCollaborationModeId: "mode-default",
  onSelectCollaborationMode: vi.fn(),
  reasoningOptions: ["low", "medium", "high"],
  selectedEffort: "low",
  onSelectEffort: vi.fn(),
  reasoningSupported: true,
  isSubmitting: false,
});

describe("WorkspaceHomeRunControls", () => {
  it("hides run mode menu for worktree workspaces", () => {
    const props = buildProps();
    render(<WorkspaceHomeRunControls {...props} workspaceKind="worktree" />);

    expect(screen.queryByLabelText("选择运行模式")).toBeNull();
    expect(screen.queryByLabelText("切换运行模式菜单")).toBeNull();
  });

  it("switches run mode from local to worktree", () => {
    const props = buildProps();
    render(<WorkspaceHomeRunControls {...props} />);

    fireEvent.click(screen.getByLabelText("切换运行模式菜单"));
    fireEvent.click(screen.getByText("Worktree"));

    expect(props.onRunModeChange).toHaveBeenCalledWith("worktree");
  });

  it("selects model in local mode", () => {
    const props = buildProps();
    render(<WorkspaceHomeRunControls {...props} />);

    fireEvent.click(screen.getByLabelText("切换模型菜单"));
    fireEvent.click(screen.getByText("Model Two"));

    expect(props.onSelectModel).toHaveBeenCalledWith("gpt-2");
    expect(props.onToggleModel).not.toHaveBeenCalled();
  });

  it("toggles models and changes run count in worktree mode", () => {
    const props = buildProps();
    render(
      <WorkspaceHomeRunControls
        {...props}
        runMode="worktree"
        modelSelections={{ "gpt-1": 2 }}
      />,
    );

    fireEvent.click(screen.getByLabelText("切换模型菜单"));
    fireEvent.click(screen.getByText("Model Two"));
    expect(props.onToggleModel).toHaveBeenCalledWith("gpt-2");

    const modelOption = screen.getByText("Model One").closest(".workspace-home-model-option");
    expect(modelOption).not.toBeNull();
    if (!modelOption) {
      throw new Error("Expected model option container");
    }

    fireEvent.click(within(modelOption).getByRole("button", { name: "4x" }));
    expect(props.onModelCountChange).toHaveBeenCalledWith("gpt-1", 4);
    expect(props.onToggleModel).toHaveBeenCalledTimes(1);
  });

  it("shows empty-state hint when model list is empty", () => {
    const props = buildProps();
    render(<WorkspaceHomeRunControls {...props} models={[]} selectedModelId={null} />);

    fireEvent.click(screen.getByLabelText("切换模型菜单"));

    expect(screen.getByText("Connect this workspace to load available models.")).not.toBeNull();
  });

  it("disables collaboration and reasoning selects while submitting", () => {
    const props = buildProps();
    render(<WorkspaceHomeRunControls {...props} isSubmitting />);

    expect((screen.getByLabelText("协作模式") as HTMLSelectElement).disabled).toBe(true);
    expect((screen.getByLabelText("思考模式") as HTMLSelectElement).disabled).toBe(true);
  });

  it("disables reasoning select when reasoning is unsupported", () => {
    const props = buildProps();
    render(<WorkspaceHomeRunControls {...props} reasoningSupported={false} />);

    expect((screen.getByLabelText("思考模式") as HTMLSelectElement).disabled).toBe(true);
  });

  it("emits collaboration and effort changes", () => {
    const props = buildProps();
    render(<WorkspaceHomeRunControls {...props} />);

    fireEvent.change(screen.getByLabelText("协作模式"), {
      target: { value: "" },
    });
    fireEvent.change(screen.getByLabelText("思考模式"), {
      target: { value: "high" },
    });

    expect(props.onSelectCollaborationMode).toHaveBeenCalledWith(null);
    expect(props.onSelectEffort).toHaveBeenCalledWith("high");
  });
});
