/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ThreadTokenUsage } from "../../../types";
import { ComposerMetaBar } from "./ComposerMetaBar";

type MetaBarProps = React.ComponentProps<typeof ComposerMetaBar>;

const baseProps = (): MetaBarProps => ({
  disabled: false,
  collaborationModes: [
    { id: "default", label: "Default" },
    { id: "plan", label: "Plan" },
  ],
  selectedCollaborationModeId: "default",
  onSelectCollaborationMode: vi.fn(),
  models: [
    { id: "gpt-5", displayName: "GPT-5", model: "gpt-5", contextWindow: 20000 },
    { id: "claude-sonnet", displayName: "Claude Sonnet", model: "claude-sonnet", contextWindow: 20000 },
    { id: "gemini-2.5-pro", displayName: "Gemini 2.5 Pro", model: "gemini-2.5-pro", contextWindow: 20000 },
    { id: "mystery", displayName: "Mystery", model: "mystery", contextWindow: 20000 },
  ],
  selectedModelId: "gpt-5",
  onSelectModel: vi.fn(),
  reasoningOptions: ["low", "medium", "high"],
  selectedEffort: "low",
  onSelectEffort: vi.fn(),
  reasoningSupported: true,
  contextUsage: null,
  messageFontSize: 13,
  onMessageFontSizeChange: vi.fn(),
  continueModeEnabled: false,
  onContinueModeEnabledChange: vi.fn(),
  continuePrompt: "",
  onContinuePromptChange: vi.fn(),
});

function renderMetaBar(overrides: Partial<MetaBarProps> = {}) {
  const props = { ...baseProps(), ...overrides };
  const view = render(<ComposerMetaBar {...props} />);
  return { ...view, props };
}

function usage(partial: Partial<ThreadTokenUsage>): ThreadTokenUsage {
  return {
    total: {
      totalTokens: 0,
      inputTokens: 0,
      cachedInputTokens: 0,
      outputTokens: 0,
      reasoningOutputTokens: 0,
    },
    last: {
      totalTokens: 0,
      inputTokens: 0,
      cachedInputTokens: 0,
      outputTokens: 0,
      reasoningOutputTokens: 0,
    },
    modelContextWindow: null,
    ...partial,
  };
}

describe("ComposerMetaBar", () => {
  afterEach(() => {
    cleanup();
  });

  it("uses plan checkbox toggle when only default/plan modes are available", () => {
    const { props } = renderMetaBar();

    const toggle = screen.getByRole("checkbox", { name: "方案模式" });
    fireEvent.click(toggle);

    expect(props.onSelectCollaborationMode).toHaveBeenCalledWith("plan");
  });

  it("falls back to null when unchecking plan toggle without default mode", () => {
    const { props } = renderMetaBar({
      collaborationModes: [{ id: "plan", label: "Plan" }],
      selectedCollaborationModeId: "plan",
    });

    fireEvent.click(screen.getByRole("checkbox", { name: "方案模式" }));

    expect(props.onSelectCollaborationMode).toHaveBeenCalledWith(null);
  });

  it("falls back to select dropdown when collaboration includes non-plan modes", () => {
    const { props } = renderMetaBar({
      collaborationModes: [
        { id: "default", label: "Default" },
        { id: "pair", label: "Pair" },
      ],
      selectedCollaborationModeId: "default",
    });

    const select = screen.getByRole("combobox", { name: "协作模式" });
    fireEvent.change(select, { target: { value: "pair" } });

    expect(props.onSelectCollaborationMode).toHaveBeenCalledWith("pair");
  });

  it("renders model provider labels and calls model/effort callbacks", () => {
    const { props } = renderMetaBar({ selectedModelId: "claude-sonnet" });

    const modelSelect = screen.getByRole("combobox", { name: "模型" });
    expect(screen.getByRole("option", { name: /\[Codex\] GPT-5/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /\[Claude\] Claude Sonnet/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /\[Gemini\] Gemini 2.5 Pro/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /\[Other\] Mystery/i })).toBeTruthy();

    fireEvent.change(modelSelect, { target: { value: "gemini-2.5-pro" } });
    expect(props.onSelectModel).toHaveBeenCalledWith("gemini-2.5-pro");

    const effortSelect = screen.getByRole("combobox", { name: "思考模式" });
    fireEvent.change(effortSelect, { target: { value: "high" } });
    expect(props.onSelectEffort).toHaveBeenCalledWith("high");
  });

  it("shows fallback effort option and disables effort when reasoning is unsupported", () => {
    renderMetaBar({ reasoningOptions: [], selectedEffort: null, reasoningSupported: false });

    expect(screen.getByRole("option", { name: "Default" })).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "思考模式" })).toHaveProperty("disabled", true);
  });

  it("renders empty context state when usage is unavailable", () => {
    renderMetaBar({ contextUsage: null });
    expect(screen.getByText("上下文用量 --")).toBeTruthy();
  });

  it("renders warn usage meter, cache badge, and title details", () => {
    renderMetaBar({
      contextUsage: usage({
        modelContextWindow: 1000,
        last: {
          totalTokens: 700,
          inputTokens: 500,
          cachedInputTokens: 250,
          outputTokens: 150,
          reasoningOutputTokens: 50,
        },
        total: {
          totalTokens: 800,
          inputTokens: 600,
          cachedInputTokens: 250,
          outputTokens: 200,
          reasoningOutputTokens: 50,
        },
      }),
    });

    const progress = screen.getByRole("progressbar", { name: "上下文已用 70%" });
    expect(progress.getAttribute("aria-valuenow")).toBe("70");
    expect(screen.getByText("缓存 50%")).toBeTruthy();
    expect(screen.getByText("上下文已用 700 / 1.0k")).toBeTruthy();

    const meter = progress.closest(".composer-context-meter");
    expect(meter?.getAttribute("title") ?? "").toContain("缓存命中：50%");
    expect(meter?.getAttribute("title") ?? "").toContain("推理：50");
  });

  it("uses total usage when last turn is empty and applies danger class", () => {
    const { container } = renderMetaBar({
      contextUsage: usage({
        modelContextWindow: 100,
        last: {
          totalTokens: 0,
          inputTokens: 0,
          cachedInputTokens: 0,
          outputTokens: 0,
          reasoningOutputTokens: 0,
        },
        total: {
          totalTokens: 95,
          inputTokens: 95,
          cachedInputTokens: 0,
          outputTokens: 0,
          reasoningOutputTokens: 0,
        },
      }),
    });

    expect(screen.getByRole("progressbar", { name: "上下文已用 95%" })).toBeTruthy();
    expect(container.querySelector(".context-meter-fill--danger")).toBeTruthy();
  });

  it("falls back to selected model context window when usage window is missing", () => {
    renderMetaBar({
      selectedModelId: "gpt-5",
      models: [{ id: "gpt-5", displayName: "GPT-5", model: "gpt-5", contextWindow: 1000 }],
      contextUsage: usage({
        modelContextWindow: null,
        last: {
          totalTokens: 100,
          inputTokens: 100,
          cachedInputTokens: 0,
          outputTokens: 0,
          reasoningOutputTokens: 0,
        },
      }),
    });

    expect(screen.getByRole("progressbar", { name: "上下文已用 10%" })).toBeTruthy();
    expect(screen.getByText("上下文已用 100 / 1.0k")).toBeTruthy();
  });

  it("formats million-scale context values", () => {
    renderMetaBar({
      selectedModelId: "gpt-5",
      models: [{ id: "gpt-5", displayName: "GPT-5", model: "gpt-5", contextWindow: 2_000_000 }],
      contextUsage: usage({
        modelContextWindow: 2_000_000,
        last: {
          totalTokens: 1_234_567,
          inputTokens: 1_234_567,
          cachedInputTokens: 0,
          outputTokens: 0,
          reasoningOutputTokens: 0,
        },
      }),
    });

    expect(screen.getByRole("progressbar", { name: "上下文已用 62%" })).toBeTruthy();
    expect(screen.getByText("上下文已用 1.2m / 2.0m")).toBeTruthy();
  });

  it("changes font size and continue controls in advanced panel", () => {
    const { props } = renderMetaBar();

    fireEvent.change(screen.getByLabelText("消息字号"), { target: { value: "15" } });
    expect(props.onMessageFontSizeChange).toHaveBeenCalledWith(15);

    fireEvent.click(screen.getByRole("button", { name: "显示高级设置" }));
    fireEvent.click(screen.getByLabelText("Continue 模式"));
    fireEvent.change(screen.getByLabelText("Continue 提示词"), {
      target: { value: "继续推进" },
    });

    expect(props.onContinueModeEnabledChange).toHaveBeenCalledWith(true);
    expect(props.onContinuePromptChange).toHaveBeenCalledWith("继续推进");
  });

  it("opens advanced panel automatically from initial continue state and prop updates", () => {
    const { rerender } = render(
      <ComposerMetaBar
        {...baseProps()}
        continueModeEnabled={false}
        continuePrompt=""
      />,
    );

    expect(screen.queryByLabelText("Continue 提示词")).toBeNull();

    rerender(
      <ComposerMetaBar
        {...baseProps()}
        continueModeEnabled={false}
        continuePrompt="继续昨天计划"
      />,
    );

    expect(screen.getByLabelText("Continue 提示词")).toBeTruthy();
  });

  it("disables controls when component is disabled", () => {
    renderMetaBar({ disabled: true, continueModeEnabled: true, continuePrompt: "keep going" });

    expect(screen.getByRole("combobox", { name: "模型" })).toHaveProperty("disabled", true);
    expect(screen.getByRole("combobox", { name: "思考模式" })).toHaveProperty("disabled", true);
    expect(screen.getByLabelText("Continue 模式")).toHaveProperty("disabled", true);
    expect(screen.getByLabelText("Continue 提示词")).toHaveProperty("disabled", true);
    expect(screen.getByLabelText("消息字号")).toHaveProperty("disabled", true);
  });
});
