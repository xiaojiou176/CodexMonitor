/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AutocompleteItem } from "../hooks/useComposerAutocomplete";
import { ComposerInput } from "./ComposerInput";

const mockUseComposerImageDrop = vi.fn();
const mockHandlePaste = vi.fn(async () => {});
const mockIsMobilePlatform = vi.fn(() => false);
const mockGetFileTypeIconUrl = vi.fn(() => null);

vi.mock("../hooks/useComposerImageDrop", () => ({
  useComposerImageDrop: (...args: unknown[]) => mockUseComposerImageDrop(...args),
}));

vi.mock("../../../utils/platformPaths", () => ({
  isMobilePlatform: () => mockIsMobilePlatform(),
}));

vi.mock("../../../utils/fileTypeIcons", () => ({
  getFileTypeIconUrl: (...args: unknown[]) => mockGetFileTypeIconUrl(...args),
}));

vi.mock("../../dictation/components/DictationWaveform", () => ({
  DictationWaveform: ({ active, processing, level }: { active: boolean; processing: boolean; level: number }) => (
    <div data-testid="dictation-waveform">{`${active}-${processing}-${level}`}</div>
  ),
}));

vi.mock("./ReviewInlinePrompt", () => ({
  ReviewInlinePrompt: () => <div data-testid="review-inline-prompt">review-inline</div>,
}));

type RenderOptions = {
  disabled?: boolean;
  canStop?: boolean;
  preferQueueOverStop?: boolean;
  canSend?: boolean;
  isProcessing?: boolean;
  dictationState?: "idle" | "listening" | "processing";
  dictationEnabled?: boolean;
  dictationError?: string | null;
  dictationHint?: string | null;
  onDismissDictationHint?: (() => void) | undefined;
  onToggleExpand?: (() => void) | undefined;
  isExpanded?: boolean;
  suggestionsOpen?: boolean;
  suggestions?: AutocompleteItem[];
  highlightIndex?: number;
  reviewPrompt?: object | undefined;
  suggestionsStyle?: React.CSSProperties;
  onTextPaste?: ((event: React.ClipboardEvent<HTMLTextAreaElement>) => void) | undefined;
};

function createReviewPromptCallbacks() {
  return {
    onReviewPromptClose: vi.fn(),
    onReviewPromptShowPreset: vi.fn(),
    onReviewPromptChoosePreset: vi.fn(),
    highlightedPresetIndex: 0,
    onReviewPromptHighlightPreset: vi.fn(),
    highlightedBranchIndex: 0,
    onReviewPromptHighlightBranch: vi.fn(),
    highlightedCommitIndex: 0,
    onReviewPromptHighlightCommit: vi.fn(),
    onReviewPromptSelectBranch: vi.fn(),
    onReviewPromptSelectBranchAtIndex: vi.fn(),
    onReviewPromptConfirmBranch: vi.fn(async () => {}),
    onReviewPromptSelectCommit: vi.fn(),
    onReviewPromptSelectCommitAtIndex: vi.fn(),
    onReviewPromptConfirmCommit: vi.fn(async () => {}),
    onReviewPromptUpdateCustomInstructions: vi.fn(),
    onReviewPromptConfirmCustom: vi.fn(async () => {}),
  };
}

function renderComposerInput(options: RenderOptions = {}) {
  const spies = {
    onStop: vi.fn(),
    onSend: vi.fn(),
    onToggleDictation: vi.fn(),
    onOpenDictationSettings: vi.fn(),
    onAddAttachment: vi.fn(),
    onRemoveAttachment: vi.fn(),
    onTextChange: vi.fn(),
    onSelectionChange: vi.fn(),
    onKeyDown: vi.fn(),
    onHighlightIndex: vi.fn(),
    onSelectSuggestion: vi.fn(),
    onDismissDictationError: vi.fn(),
  };

  const reviewCallbacks = createReviewPromptCallbacks();
  const textareaRef = { current: null as HTMLTextAreaElement | null };

  const view = render(
    <div className="app">
      <ComposerInput
        text="hello"
        disabled={options.disabled ?? false}
        sendLabel="Send"
        canStop={options.canStop ?? false}
        preferQueueOverStop={options.preferQueueOverStop ?? false}
        canSend={options.canSend ?? true}
        isProcessing={options.isProcessing ?? false}
        onStop={spies.onStop}
        onSend={spies.onSend}
        dictationState={options.dictationState ?? "idle"}
        dictationLevel={0.5}
        dictationEnabled={options.dictationEnabled ?? true}
        onToggleDictation={spies.onToggleDictation}
        onOpenDictationSettings={spies.onOpenDictationSettings}
        dictationError={options.dictationError ?? null}
        onDismissDictationError={spies.onDismissDictationError}
        dictationHint={options.dictationHint ?? null}
        onDismissDictationHint={options.onDismissDictationHint}
        attachments={["/tmp/file.png"]}
        onAddAttachment={spies.onAddAttachment}
        onRemoveAttachment={spies.onRemoveAttachment}
        onTextChange={spies.onTextChange}
        onTextPaste={options.onTextPaste}
        onSelectionChange={spies.onSelectionChange}
        onKeyDown={spies.onKeyDown}
        isExpanded={options.isExpanded ?? false}
        onToggleExpand={options.onToggleExpand}
        textareaRef={textareaRef}
        suggestionsOpen={options.suggestionsOpen ?? false}
        suggestions={options.suggestions ?? []}
        highlightIndex={options.highlightIndex ?? 0}
        onHighlightIndex={spies.onHighlightIndex}
        onSelectSuggestion={spies.onSelectSuggestion}
        suggestionsStyle={options.suggestionsStyle}
        reviewPrompt={options.reviewPrompt as never}
        {...reviewCallbacks}
      />
    </div>,
  );

  return { ...view, spies };
}

beforeEach(() => {
  mockHandlePaste.mockReset();
  mockHandlePaste.mockResolvedValue(undefined);
  mockUseComposerImageDrop.mockReset();
  mockUseComposerImageDrop.mockReturnValue({
    dropTargetRef: { current: null },
    isDragOver: false,
    handleDragOver: vi.fn(),
    handleDragEnter: vi.fn(),
    handleDragLeave: vi.fn(),
    handleDrop: vi.fn(),
    handlePaste: mockHandlePaste,
  });
  mockIsMobilePlatform.mockReset();
  mockIsMobilePlatform.mockReturnValue(false);
  mockGetFileTypeIconUrl.mockReset();
  mockGetFileTypeIconUrl.mockReturnValue(null);
  HTMLElement.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  cleanup();
});

describe("ComposerInput behavior branches", () => {
  it("calls send vs stop action based on stop state", () => {
    const view = renderComposerInput({ canStop: false });

    fireEvent.click(screen.getByLabelText("Send"));
    expect(view.spies.onSend).toHaveBeenCalledTimes(1);
    expect(view.spies.onStop).toHaveBeenCalledTimes(0);

    cleanup();
    const stopView = renderComposerInput({ canStop: true, isProcessing: true });
    fireEvent.click(screen.getByLabelText("停止"));
    expect(stopView.spies.onStop).toHaveBeenCalledTimes(1);
  });

  it("keeps send action when queue is preferred over stop", () => {
    const view = renderComposerInput({
      canStop: true,
      preferQueueOverStop: true,
      isProcessing: true,
    });

    fireEvent.click(screen.getByLabelText("Send"));
    expect(view.spies.onSend).toHaveBeenCalledTimes(1);
    expect(view.spies.onStop).toHaveBeenCalledTimes(0);
  });

  it("opens dictation settings when dictation is disabled", () => {
    const view = renderComposerInput({ dictationEnabled: false });

    fireEvent.click(screen.getByLabelText("打开听写设置"));

    expect(view.spies.onOpenDictationSettings).toHaveBeenCalledTimes(1);
    expect(view.spies.onToggleDictation).toHaveBeenCalledTimes(0);
  });

  it("toggles dictation when available and shows waveform while busy", () => {
    const view = renderComposerInput({ dictationState: "listening", dictationEnabled: true });

    fireEvent.click(screen.getByLabelText("停止听写"));

    expect(view.spies.onToggleDictation).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("dictation-waveform").textContent).toBe("true-false-0.5");
  });

  it("disables send and mic buttons while dictation is processing", () => {
    renderComposerInput({ dictationState: "processing" });

    expect(screen.getByLabelText("Send")).toHaveProperty("disabled", true);
    expect(screen.getByLabelText("听写处理中")).toHaveProperty("disabled", true);
    expect(screen.getByTestId("dictation-waveform").textContent).toBe("false-true-0.5");
  });

  it("renders dictation error and hint dismiss actions", () => {
    const onDismissHint = vi.fn();
    const view = renderComposerInput({
      dictationError: "mic failed",
      dictationHint: "try again",
      onDismissDictationHint: onDismissHint,
    });

    expect(screen.getByText("mic failed")).toBeTruthy();
    const dismissButtons = screen.getAllByRole("button", { name: "Dismiss" });
    fireEvent.click(dismissButtons[0]);
    fireEvent.click(dismissButtons[1]);

    expect(view.spies.onDismissDictationError).toHaveBeenCalledTimes(1);
    expect(onDismissHint).toHaveBeenCalledTimes(1);
  });

  it("forwards paste event only when drop hook does not prevent default", () => {
    const onTextPaste = vi.fn();
    renderComposerInput({ onTextPaste });

    const textarea = screen.getByRole("textbox");
    fireEvent.paste(textarea);

    expect(mockHandlePaste).toHaveBeenCalledTimes(1);
    expect(onTextPaste).toHaveBeenCalledTimes(1);

    mockHandlePaste.mockImplementationOnce(async (event: ClipboardEvent) => {
      event.preventDefault();
    });

    fireEvent.paste(textarea);
    expect(onTextPaste).toHaveBeenCalledTimes(1);
  });

  it("supports mobile actions menu interactions and closes on outside events", () => {
    const onToggleExpand = vi.fn();
    const view = renderComposerInput({ onToggleExpand, isExpanded: false });

    fireEvent.click(screen.getByLabelText("更多操作"));
    fireEvent.click(within(screen.getByRole("menu")).getByRole("button", { name: "Add image" }));
    expect(view.spies.onAddAttachment).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByLabelText("更多操作"));
    fireEvent.click(within(screen.getByRole("menu")).getByRole("button", { name: "展开输入框" }));
    expect(onToggleExpand).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByLabelText("更多操作"));
    expect(screen.queryByRole("menu")).toBeTruthy();
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("menu")).toBeNull();

    fireEvent.click(screen.getByLabelText("更多操作"));
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("renders suggestions and handles highlight/select interactions", () => {
    mockGetFileTypeIconUrl.mockReturnValue("icon://file");
    const suggestions: AutocompleteItem[] = [
      {
        id: "file:1",
        label: "/repo/src/index.ts",
        description: "",
        hint: "",
        group: "Files",
      },
      {
        id: "skill:refactor",
        label: "Refactor",
        description: "Use skill",
        hint: "",
        group: "Skills",
      },
    ];

    const view = renderComposerInput({
      suggestionsOpen: true,
      suggestions,
      highlightIndex: 1,
      suggestionsStyle: { left: 8, bottom: 12 },
    });

    const listbox = screen.getByRole("listbox");
    expect(listbox.className.includes("composer-suggestions")).toBe(true);
    expect(screen.getByText("Files")).toBeTruthy();
    expect(screen.getByText("Skills")).toBeTruthy();
    expect(screen.getByText("index.ts")).toBeTruthy();

    const options = screen.getAllByRole("option");
    fireEvent.mouseEnter(options[0]);
    fireEvent.click(options[0]);

    expect(view.spies.onHighlightIndex).toHaveBeenCalledTimes(1);
    expect(view.spies.onSelectSuggestion).toHaveBeenCalledTimes(1);
    expect(listbox.style.left).toBe("8px");
    expect(listbox.style.bottom).toBe("12px");
  });

  it("renders review inline prompt when review state is complete", () => {
    renderComposerInput({
      suggestionsOpen: true,
      suggestions: [],
      reviewPrompt: { step: "preset" },
    });

    const inline = screen.getByTestId("review-inline-prompt");
    const listbox = screen.getByRole("listbox");
    expect(Boolean(inline)).toBe(true);
    expect(listbox.className.includes("review-inline-suggestions")).toBe(true);
  });

  it("switches placeholder between desktop, mobile, and disabled states", () => {
    const view = renderComposerInput({ disabled: false });

    expect(screen.getByRole("textbox").getAttribute("placeholder")).toBe(
      "Ask Codex anything，@ 添加文件，/ 输入命令，$ 调用技能（⌘K）",
    );

    mockIsMobilePlatform.mockReturnValue(true);
    view.rerender(
      <div className="app">
        <ComposerInput
          text="hello"
          disabled={false}
          sendLabel="Send"
          canStop={false}
          canSend
          isProcessing={false}
          onStop={vi.fn()}
          onSend={vi.fn()}
          dictationState="idle"
          dictationLevel={0.5}
          dictationEnabled
          onToggleDictation={vi.fn()}
          onOpenDictationSettings={vi.fn()}
          dictationError={null}
          onDismissDictationError={vi.fn()}
          dictationHint={null}
          attachments={[]}
          onAddAttachment={vi.fn()}
          onRemoveAttachment={vi.fn()}
          onTextChange={vi.fn()}
          onSelectionChange={vi.fn()}
          onKeyDown={vi.fn()}
          textareaRef={{ current: null }}
          suggestionsOpen={false}
          suggestions={[]}
          highlightIndex={0}
          onHighlightIndex={vi.fn()}
          onSelectSuggestion={vi.fn()}
        />
      </div>,
    );

    expect(screen.getByRole("textbox").getAttribute("placeholder")).toBe(
      "Ask Codex anything，@ 添加文件，/ 输入命令，$ 调用技能",
    );

    view.rerender(
      <div className="app">
        <ComposerInput
          text="hello"
          disabled
          sendLabel="Send"
          canStop={false}
          canSend
          isProcessing={false}
          onStop={vi.fn()}
          onSend={vi.fn()}
          dictationState="idle"
          dictationLevel={0.5}
          dictationEnabled
          onToggleDictation={vi.fn()}
          onOpenDictationSettings={vi.fn()}
          dictationError={null}
          onDismissDictationError={vi.fn()}
          dictationHint={null}
          attachments={[]}
          onAddAttachment={vi.fn()}
          onRemoveAttachment={vi.fn()}
          onTextChange={vi.fn()}
          onSelectionChange={vi.fn()}
          onKeyDown={vi.fn()}
          textareaRef={{ current: null }}
          suggestionsOpen={false}
          suggestions={[]}
          highlightIndex={0}
          onHighlightIndex={vi.fn()}
          onSelectSuggestion={vi.fn()}
        />
      </div>,
    );

    expect(screen.getByRole("textbox").getAttribute("placeholder")).toBe(
      "审查进行中，完成后聊天将重新启用。",
    );
  });
});
