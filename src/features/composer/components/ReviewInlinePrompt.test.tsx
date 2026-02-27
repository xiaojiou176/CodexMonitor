/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReviewPromptState, ReviewPromptStep } from "../../threads/hooks/useReviewPrompt";
import type { WorkspaceInfo } from "../../../types";
import { ReviewInlinePrompt } from "./ReviewInlinePrompt";

function createWorkspace(): WorkspaceInfo {
  return {
    id: "workspace-1",
    name: "Workspace One",
    path: "/tmp/workspace-one",
    connected: true,
    settings: {
      sidebarCollapsed: false,
    },
  };
}

function createReviewPrompt(
  overrides: Partial<NonNullable<ReviewPromptState>> = {},
): NonNullable<ReviewPromptState> {
  return {
    workspace: createWorkspace(),
    threadIdSnapshot: "thread-1",
    step: "preset",
    branches: [],
    commits: [],
    isLoadingBranches: false,
    isLoadingCommits: false,
    selectedBranch: "",
    selectedCommitSha: "",
    selectedCommitTitle: "",
    customInstructions: "",
    error: null,
    isSubmitting: false,
    ...overrides,
  };
}

function renderPrompt(options?: {
  step?: ReviewPromptStep;
  reviewPromptOverrides?: Partial<NonNullable<ReviewPromptState>>;
  highlightedPresetIndex?: number;
  highlightedBranchIndex?: number;
  highlightedCommitIndex?: number;
}) {
  const handlers = {
    onClose: vi.fn(),
    onShowPreset: vi.fn(),
    onChoosePreset: vi.fn(),
    onHighlightPreset: vi.fn(),
    onHighlightBranch: vi.fn(),
    onHighlightCommit: vi.fn(),
    onSelectBranch: vi.fn(),
    onSelectBranchAtIndex: vi.fn(),
    onConfirmBranch: vi.fn(async () => {}),
    onSelectCommit: vi.fn(),
    onSelectCommitAtIndex: vi.fn(),
    onConfirmCommit: vi.fn(async () => {}),
    onUpdateCustomInstructions: vi.fn(),
    onConfirmCustom: vi.fn(async () => {}),
  };

  const reviewPrompt = createReviewPrompt({
    step: options?.step ?? "preset",
    ...options?.reviewPromptOverrides,
  });

  render(
    <ReviewInlinePrompt
      reviewPrompt={reviewPrompt}
      onClose={handlers.onClose}
      onShowPreset={handlers.onShowPreset}
      onChoosePreset={handlers.onChoosePreset}
      highlightedPresetIndex={options?.highlightedPresetIndex ?? 0}
      onHighlightPreset={handlers.onHighlightPreset}
      highlightedBranchIndex={options?.highlightedBranchIndex ?? 0}
      onHighlightBranch={handlers.onHighlightBranch}
      highlightedCommitIndex={options?.highlightedCommitIndex ?? 0}
      onHighlightCommit={handlers.onHighlightCommit}
      onSelectBranch={handlers.onSelectBranch}
      onSelectBranchAtIndex={handlers.onSelectBranchAtIndex}
      onConfirmBranch={handlers.onConfirmBranch}
      onSelectCommit={handlers.onSelectCommit}
      onSelectCommitAtIndex={handlers.onSelectCommitAtIndex}
      onConfirmCommit={handlers.onConfirmCommit}
      onUpdateCustomInstructions={handlers.onUpdateCustomInstructions}
      onConfirmCustom={handlers.onConfirmCustom}
    />,
  );

  return handlers;
}

afterEach(() => {
  cleanup();
});

describe("ReviewInlinePrompt", () => {
  it("renders preset step and routes option click + hover", () => {
    const handlers = renderPrompt({ step: "preset", highlightedPresetIndex: 2 });

    expect(screen.getByRole("dialog", { name: "选择审查预设" })).toBeTruthy();
    const commitPreset = screen.getByRole("button", { name: "审查提交" });
    expect(commitPreset.className.includes("is-selected")).toBe(true);

    fireEvent.mouseEnter(screen.getByRole("button", { name: "审查未提交的更改" }));
    fireEvent.click(screen.getByRole("button", { name: "基于基础分支审查 (PR Style)" }));

    expect(handlers.onHighlightPreset).toHaveBeenCalledWith(1);
    expect(handlers.onChoosePreset).toHaveBeenCalledWith("baseBranch");
  });

  it("renders branch loading and empty states", () => {
    renderPrompt({
      step: "baseBranch",
      reviewPromptOverrides: {
        isLoadingBranches: true,
        branches: [],
      },
    });
    expect(screen.getByText("加载分支中…")).toBeTruthy();

    cleanup();
    renderPrompt({
      step: "baseBranch",
      reviewPromptOverrides: {
        isLoadingBranches: false,
        branches: [],
      },
    });
    expect(screen.getByText("未找到分支。")) .toBeTruthy();
  });

  it("supports branch hover/click interactions and confirm action", () => {
    const handlers = renderPrompt({
      step: "baseBranch",
      highlightedBranchIndex: 1,
      reviewPromptOverrides: {
        selectedBranch: "feature/a",
        branches: [{ name: "main", lastCommit: 100 }, { name: "feature/a", lastCommit: 99 }],
      },
    });

    expect(screen.getByRole("dialog", { name: "选择基础分支" })).toBeTruthy();
    const selected = screen.getByRole("option", { name: "feature/a" });
    expect(selected.getAttribute("aria-selected")).toBe("true");

    fireEvent.mouseEnter(screen.getByRole("option", { name: "main" }));
    fireEvent.click(screen.getByRole("option", { name: "main" }));
    fireEvent.click(screen.getByRole("button", { name: "Start review" }));

    expect(handlers.onHighlightBranch).toHaveBeenCalledWith(0);
    expect(handlers.onSelectBranchAtIndex).toHaveBeenCalledWith(0);
    expect(handlers.onSelectBranch).toHaveBeenCalledWith("main");
    expect(handlers.onConfirmBranch).toHaveBeenCalledTimes(1);
  });

  it("disables branch confirm button when selected branch is blank", () => {
    renderPrompt({
      step: "baseBranch",
      reviewPromptOverrides: {
        selectedBranch: "   ",
      },
    });

    const startButton = screen.getByRole("button", { name: "Start review" }) as HTMLButtonElement;
    expect(startButton.disabled).toBe(true);
  });

  it("renders commit loading, empty and list states with short sha", () => {
    renderPrompt({
      step: "commit",
      reviewPromptOverrides: {
        isLoadingCommits: true,
        commits: [],
      },
    });
    expect(screen.getByText("加载提交记录中…")).toBeTruthy();

    cleanup();
    renderPrompt({
      step: "commit",
      reviewPromptOverrides: {
        isLoadingCommits: false,
        commits: [],
      },
    });
    expect(screen.getByText("未找到提交记录。")) .toBeTruthy();

    cleanup();
    const handlers = renderPrompt({
      step: "commit",
      highlightedCommitIndex: 0,
      reviewPromptOverrides: {
        selectedCommitSha: "abcdef1234567890",
        commits: [{ sha: "abcdef1234567890", summary: "Fix bug", author: "A", timestamp: 1 }],
      },
    });

    const option = screen.getByRole("option", { name: /Fix bug/ });
    expect(option).toBeTruthy();
    expect(screen.getByText("abcdef1")).toBeTruthy();

    fireEvent.mouseEnter(option);
    fireEvent.click(option);
    fireEvent.click(screen.getByRole("button", { name: "Start review" }));

    expect(handlers.onHighlightCommit).toHaveBeenCalledWith(0);
    expect(handlers.onSelectCommitAtIndex).toHaveBeenCalledWith(0);
    expect(handlers.onSelectCommit).toHaveBeenCalledWith("abcdef1234567890", "Fix bug");
    expect(handlers.onConfirmCommit).toHaveBeenCalledTimes(1);
  });

  it("disables commit confirm button when no commit selected", () => {
    renderPrompt({
      step: "commit",
      reviewPromptOverrides: {
        selectedCommitSha: "",
      },
    });

    const startButton = screen.getByRole("button", { name: "Start review" }) as HTMLButtonElement;
    expect(startButton.disabled).toBe(true);
  });

  it("renders custom step with input update and submit boundary", () => {
    const handlers = renderPrompt({
      step: "custom",
      reviewPromptOverrides: {
        customInstructions: "review race conditions",
      },
    });

    expect(screen.getByRole("dialog", { name: "自定义审查指令" })).toBeTruthy();

    fireEvent.change(screen.getByRole("textbox", { name: "Instructions" }), {
      target: { value: "check a11y and edge cases" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Start review" }));

    expect(handlers.onUpdateCustomInstructions).toHaveBeenCalledWith("check a11y and edge cases");
    expect(handlers.onConfirmCustom).toHaveBeenCalledTimes(1);

    cleanup();
    renderPrompt({
      step: "custom",
      reviewPromptOverrides: {
        customInstructions: "   ",
      },
    });
    const startButton = screen.getByRole("button", { name: "Start review" }) as HTMLButtonElement;
    expect(startButton.disabled).toBe(true);
  });

  it("renders error path and supports close/back actions", () => {
    const handlers = renderPrompt({
      step: "custom",
      reviewPromptOverrides: {
        error: "Review target failed",
      },
    });

    expect(screen.getByText("Review target failed")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    expect(handlers.onShowPreset).toHaveBeenCalledTimes(1);
    expect(handlers.onClose).toHaveBeenCalledTimes(1);
  });

  it("disables interactive controls while submitting", () => {
    renderPrompt({
      step: "preset",
      reviewPromptOverrides: {
        isSubmitting: true,
      },
    });

    expect((screen.getByRole("button", { name: "审查提交" }) as HTMLButtonElement).disabled).toBe(true);

    cleanup();
    renderPrompt({
      step: "commit",
      reviewPromptOverrides: {
        isSubmitting: true,
        selectedCommitSha: "abcdef1234567890",
        commits: [{ sha: "abcdef1234567890", summary: "Fix bug", author: "A", timestamp: 1 }],
      },
    });

    expect((screen.getByRole("button", { name: "Back" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Start review" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("option", { name: /Fix bug/ }) as HTMLButtonElement).disabled).toBe(true);
  });
});
