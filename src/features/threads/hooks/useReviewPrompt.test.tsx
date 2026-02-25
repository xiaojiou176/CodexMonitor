// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { getGitLog, listGitBranches } from "../../../services/tauri";
import type { GitLogResponse, WorkspaceInfo } from "../../../types";
import { useReviewPrompt } from "./useReviewPrompt";

vi.mock("../../../services/tauri", () => ({
  listGitBranches: vi.fn(),
  getGitLog: vi.fn(),
}));

const WORKSPACE: WorkspaceInfo = {
  id: "ws-1",
  name: "Workspace 1",
  path: "/tmp/ws-1",
  connected: true,
  settings: { sidebarCollapsed: false },
};

const resolvedBranchPayload = {
  result: {
    branches: [
      { name: "feature/a", last_commit: 10 },
      { name: "main", lastCommit: 99 },
      { name: "feature/b", lastCommit: 20 },
      { name: "", lastCommit: 1000 },
    ],
  },
};

const resolvedCommitPayload: GitLogResponse = {
  total: 3,
  ahead: 0,
  behind: 0,
  aheadEntries: [],
  behindEntries: [],
  upstream: null,
  entries: [
    { sha: "", summary: "invalid", author: "n/a", timestamp: 1 },
    { sha: "sha-1", summary: "first commit", author: "alice", timestamp: 2 },
    { sha: "sha-2", summary: "", author: "bob", timestamp: 3 },
  ],
};

describe("useReviewPrompt", () => {
  it("keeps default state and no-ops when there is no active workspace", () => {
    const startReviewTarget = vi.fn().mockResolvedValue(true);
    const { result } = renderHook(() =>
      useReviewPrompt({
        activeWorkspace: null,
        activeThreadId: null,
        startReviewTarget,
      }),
    );

    act(() => {
      result.current.openReviewPrompt();
    });

    expect(result.current.reviewPrompt).toBeNull();

    const preventDefault = vi.fn();
    const handled = result.current.handleReviewPromptKeyDown({
      key: "Escape",
      preventDefault,
    });
    expect(handled).toBe(false);
    expect(preventDefault).not.toHaveBeenCalled();
    expect(startReviewTarget).not.toHaveBeenCalled();
  });

  it("opens, loads branches/commits, and applies expected defaults", async () => {
    vi.mocked(listGitBranches).mockResolvedValue(resolvedBranchPayload);
    vi.mocked(getGitLog).mockResolvedValue(resolvedCommitPayload);
    const startReviewTarget = vi.fn().mockResolvedValue(true);
    const onDebug = vi.fn();

    const { result } = renderHook(() =>
      useReviewPrompt({
        activeWorkspace: WORKSPACE,
        activeThreadId: "thread-1",
        onDebug,
        startReviewTarget,
      }),
    );

    act(() => {
      result.current.openReviewPrompt();
    });

    expect(result.current.reviewPrompt?.isLoadingBranches).toBe(true);
    expect(result.current.reviewPrompt?.isLoadingCommits).toBe(true);

    await waitFor(() => {
      expect(result.current.reviewPrompt?.isLoadingBranches).toBe(false);
      expect(result.current.reviewPrompt?.isLoadingCommits).toBe(false);
    });

    expect(result.current.reviewPrompt?.branches.map((branch) => branch.name)).toEqual([
      "main",
      "feature/b",
      "feature/a",
    ]);
    expect(result.current.reviewPrompt?.commits.map((commit) => commit.sha)).toEqual([
      "sha-1",
      "sha-2",
    ]);
    expect(result.current.reviewPrompt?.selectedBranch).toBe("main");
    expect(result.current.reviewPrompt?.selectedCommitSha).toBe("sha-1");
    expect(result.current.reviewPrompt?.selectedCommitTitle).toBe("first commit");
    expect(onDebug).toHaveBeenCalledWith(
      expect.objectContaining({
        label: "review/prompt load",
        source: "client",
      }),
    );
    expect(onDebug).toHaveBeenCalledWith(
      expect.objectContaining({
        label: "review/prompt load response",
        source: "server",
      }),
    );
  });

  it("handles open failure payloads and preserves empty defaults", async () => {
    vi.mocked(listGitBranches).mockRejectedValue(new Error("branch failed"));
    vi.mocked(getGitLog).mockResolvedValue({ result: { entries: "bad-payload" } } as unknown as GitLogResponse);
    const startReviewTarget = vi.fn().mockResolvedValue(true);
    const onDebug = vi.fn();

    const { result } = renderHook(() =>
      useReviewPrompt({
        activeWorkspace: WORKSPACE,
        activeThreadId: "thread-1",
        onDebug,
        startReviewTarget,
      }),
    );

    act(() => {
      result.current.openReviewPrompt();
    });

    await waitFor(() => {
      expect(result.current.reviewPrompt?.isLoadingBranches).toBe(false);
      expect(result.current.reviewPrompt?.isLoadingCommits).toBe(false);
    });

    expect(result.current.reviewPrompt?.branches).toEqual([]);
    expect(result.current.reviewPrompt?.commits).toEqual([]);
    expect(result.current.reviewPrompt?.selectedBranch).toBe("");
    expect(result.current.reviewPrompt?.selectedCommitSha).toBe("");
    expect(onDebug).toHaveBeenCalledWith(
      expect.objectContaining({
        label: "review/prompt load response",
        payload: expect.objectContaining({
          branchesError: "branch failed",
          commitsError: null,
        }),
      }),
    );
  });

  it("supports close and escape behavior on root and child steps", async () => {
    vi.mocked(listGitBranches).mockResolvedValue(resolvedBranchPayload);
    vi.mocked(getGitLog).mockResolvedValue(resolvedCommitPayload);
    const startReviewTarget = vi.fn().mockResolvedValue(true);

    const { result } = renderHook(() =>
      useReviewPrompt({
        activeWorkspace: WORKSPACE,
        activeThreadId: "thread-1",
        startReviewTarget,
      }),
    );

    act(() => {
      result.current.openReviewPrompt();
    });
    await waitFor(() => {
      expect(result.current.reviewPrompt?.isLoadingBranches).toBe(false);
    });

    act(() => {
      result.current.choosePreset("custom");
    });
    expect(result.current.reviewPrompt?.step).toBe("custom");

    const childEscape = vi.fn();
    act(() => {
      result.current.handleReviewPromptKeyDown({
        key: "Escape",
        preventDefault: childEscape,
      });
    });
    expect(childEscape).toHaveBeenCalledTimes(1);
    expect(result.current.reviewPrompt?.step).toBe("preset");

    const rootEscape = vi.fn();
    act(() => {
      result.current.handleReviewPromptKeyDown({
        key: "Escape",
        preventDefault: rootEscape,
      });
    });
    expect(rootEscape).toHaveBeenCalledTimes(1);
    expect(result.current.reviewPrompt).toBeNull();
  });

  it("validates branch/commit/custom required fields and clears errors when updated", async () => {
    vi.mocked(listGitBranches).mockResolvedValue(resolvedBranchPayload);
    vi.mocked(getGitLog).mockResolvedValue(resolvedCommitPayload);
    const startReviewTarget = vi.fn().mockResolvedValue(true);

    const { result } = renderHook(() =>
      useReviewPrompt({
        activeWorkspace: WORKSPACE,
        activeThreadId: "thread-1",
        startReviewTarget,
      }),
    );

    act(() => {
      result.current.openReviewPrompt();
    });
    await waitFor(() => {
      expect(result.current.reviewPrompt?.isLoadingBranches).toBe(false);
    });

    act(() => {
      result.current.choosePreset("baseBranch");
      result.current.selectBranch("   ");
    });
    await act(async () => {
      await result.current.confirmBranch();
    });
    expect(result.current.reviewPrompt?.error).toBe("Choose a base branch.");

    act(() => {
      result.current.selectBranch("main");
    });
    expect(result.current.reviewPrompt?.error).toBeNull();

    act(() => {
      result.current.choosePreset("commit");
      result.current.selectCommit("   ", "   ");
    });
    await act(async () => {
      await result.current.confirmCommit();
    });
    expect(result.current.reviewPrompt?.error).toBe("Choose a commit to review.");

    act(() => {
      result.current.selectCommit("sha-1", "first commit");
    });
    expect(result.current.reviewPrompt?.error).toBeNull();

    act(() => {
      result.current.choosePreset("custom");
      result.current.updateCustomInstructions("   ");
    });
    await act(async () => {
      await result.current.confirmCustom();
    });
    expect(result.current.reviewPrompt?.error).toBe("Enter custom review instructions.");

    act(() => {
      result.current.updateCustomInstructions("Review security edge cases");
    });
    expect(result.current.reviewPrompt?.error).toBeNull();
  });

  it("submits uncommitted and commit targets, including commit title omission when empty", async () => {
    vi.mocked(listGitBranches).mockResolvedValue(resolvedBranchPayload);
    vi.mocked(getGitLog).mockResolvedValue(resolvedCommitPayload);
    const startReviewTarget = vi
      .fn()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);

    const { result } = renderHook(() =>
      useReviewPrompt({
        activeWorkspace: WORKSPACE,
        activeThreadId: "thread-1",
        startReviewTarget,
      }),
    );

    act(() => {
      result.current.openReviewPrompt();
    });
    await waitFor(() => {
      expect(result.current.reviewPrompt?.isLoadingBranches).toBe(false);
    });

    await act(async () => {
      result.current.choosePreset("uncommitted");
    });
    await waitFor(() => {
      expect(result.current.reviewPrompt?.isSubmitting).toBe(false);
    });
    expect(result.current.reviewPrompt).not.toBeNull();
    expect(startReviewTarget).toHaveBeenCalledWith(
      { type: "uncommittedChanges" },
      "ws-1",
    );

    act(() => {
      result.current.choosePreset("commit");
      result.current.selectCommit("sha-custom", "   ");
    });
    await act(async () => {
      await result.current.confirmCommit();
    });

    expect(startReviewTarget).toHaveBeenLastCalledWith(
      { type: "commit", sha: "sha-custom" },
      "ws-1",
    );
    expect(result.current.reviewPrompt).toBeNull();
  });

  it("records thrown submit errors and keeps prompt open", async () => {
    vi.mocked(listGitBranches).mockResolvedValue(resolvedBranchPayload);
    vi.mocked(getGitLog).mockResolvedValue(resolvedCommitPayload);
    const startReviewTarget = vi.fn().mockRejectedValue(new Error("submit boom"));
    const onDebug = vi.fn();

    const { result } = renderHook(() =>
      useReviewPrompt({
        activeWorkspace: WORKSPACE,
        activeThreadId: "thread-1",
        onDebug,
        startReviewTarget,
      }),
    );

    act(() => {
      result.current.openReviewPrompt();
    });
    await waitFor(() => {
      expect(result.current.reviewPrompt?.isLoadingBranches).toBe(false);
    });

    act(() => {
      result.current.choosePreset("custom");
      result.current.updateCustomInstructions("run full review");
    });
    await act(async () => {
      await result.current.confirmCustom();
    });

    await waitFor(() => {
      expect(result.current.reviewPrompt?.isSubmitting).toBe(false);
    });
    expect(result.current.reviewPrompt).not.toBeNull();
    expect(onDebug).toHaveBeenCalledWith(
      expect.objectContaining({
        label: "review/start threw",
        source: "error",
        payload: "submit boom",
      }),
    );
  });

  it("closes prompt when workspace/thread snapshot mismatches after open", async () => {
    vi.mocked(listGitBranches).mockResolvedValue(resolvedBranchPayload);
    vi.mocked(getGitLog).mockResolvedValue(resolvedCommitPayload);
    const startReviewTarget = vi.fn().mockResolvedValue(true);
    const onDebug = vi.fn();

    const { result, rerender } = renderHook(
      (props: { activeThreadId: string | null; activeWorkspace: WorkspaceInfo | null }) =>
        useReviewPrompt({
          activeWorkspace: props.activeWorkspace,
          activeThreadId: props.activeThreadId,
          onDebug,
          startReviewTarget,
        }),
      {
        initialProps: {
          activeWorkspace: WORKSPACE,
          activeThreadId: "thread-1",
        },
      },
    );

    act(() => {
      result.current.openReviewPrompt();
    });
    await waitFor(() => {
      expect(result.current.reviewPrompt).not.toBeNull();
    });

    rerender({
      activeWorkspace: WORKSPACE,
      activeThreadId: "thread-2",
    });

    await waitFor(() => {
      expect(result.current.reviewPrompt).toBeNull();
    });
    expect(onDebug).toHaveBeenCalledWith(
      expect.objectContaining({
        label: "review/prompt close mismatch",
        source: "client",
      }),
    );
  });

  it("covers keyboard navigation branches for preset, branch, commit and submitting states", async () => {
    vi.mocked(listGitBranches).mockResolvedValue(resolvedBranchPayload);
    vi.mocked(getGitLog).mockResolvedValue(resolvedCommitPayload);
    let resolveSubmit: ((value: boolean) => void) | null = null;
    const startReviewTarget = vi.fn().mockImplementation(
      () =>
        new Promise<boolean>((resolve) => {
          resolveSubmit = resolve;
        }),
    );

    const { result } = renderHook(() =>
      useReviewPrompt({
        activeWorkspace: WORKSPACE,
        activeThreadId: "thread-1",
        startReviewTarget,
      }),
    );

    act(() => {
      result.current.openReviewPrompt();
    });
    await waitFor(() => {
      expect(result.current.reviewPrompt?.isLoadingBranches).toBe(false);
    });

    const presetArrow = vi.fn();
    act(() => {
      result.current.handleReviewPromptKeyDown({
        key: "ArrowDown",
        preventDefault: presetArrow,
      });
    });
    expect(presetArrow).toHaveBeenCalledTimes(1);
    expect(result.current.highlightedPresetIndex).toBe(1);

    act(() => {
      result.current.choosePreset("baseBranch");
    });
    const branchArrow = vi.fn();
    act(() => {
      result.current.handleReviewPromptKeyDown({
        key: "ArrowDown",
        preventDefault: branchArrow,
      });
    });
    expect(branchArrow).toHaveBeenCalledTimes(1);
    expect(result.current.reviewPrompt?.selectedBranch).toBe("feature/b");

    act(() => {
      result.current.choosePreset("commit");
    });
    const commitArrow = vi.fn();
    act(() => {
      result.current.handleReviewPromptKeyDown({
        key: "ArrowDown",
        preventDefault: commitArrow,
      });
    });
    expect(commitArrow).toHaveBeenCalledTimes(1);
    expect(result.current.reviewPrompt?.selectedCommitSha).toBe("sha-2");
    expect(result.current.reviewPrompt?.selectedCommitTitle).toBe("sha-2");

    await act(async () => {
      void result.current.confirmCommit();
    });
    await waitFor(() => {
      expect(result.current.reviewPrompt?.isSubmitting).toBe(true);
    });

    const blockSubmit = vi.fn();
    act(() => {
      result.current.handleReviewPromptKeyDown({
        key: "Enter",
        preventDefault: blockSubmit,
      });
    });
    expect(blockSubmit).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveSubmit?.(false);
    });
    await waitFor(() => {
      expect(result.current.reviewPrompt?.isSubmitting).toBe(false);
    });
  });

  it("handles keydown edge paths for empty lists, wrapped indexes and ignored keys", async () => {
    vi.mocked(listGitBranches).mockResolvedValue({ branches: [] });
    vi.mocked(getGitLog).mockResolvedValue({ total: 0, ahead: 0, behind: 0, aheadEntries: [], behindEntries: [], upstream: null, entries: [] });
    const startReviewTarget = vi.fn().mockResolvedValue(true);

    const { result } = renderHook(() =>
      useReviewPrompt({
        activeWorkspace: WORKSPACE,
        activeThreadId: "thread-1",
        startReviewTarget,
      }),
    );

    act(() => {
      result.current.openReviewPrompt();
    });
    await waitFor(() => {
      expect(result.current.reviewPrompt?.isLoadingBranches).toBe(false);
      expect(result.current.reviewPrompt?.isLoadingCommits).toBe(false);
    });

    const unhandled = vi.fn();
    const wasHandled = result.current.handleReviewPromptKeyDown({
      key: "Tab",
      preventDefault: unhandled,
    });
    expect(wasHandled).toBe(false);
    expect(unhandled).not.toHaveBeenCalled();

    act(() => {
      result.current.setHighlightedPresetIndex(0);
    });
    const presetUp = vi.fn();
    act(() => {
      result.current.handleReviewPromptKeyDown({
        key: "ArrowUp",
        preventDefault: presetUp,
      });
    });
    expect(presetUp).toHaveBeenCalledTimes(1);
    expect(result.current.highlightedPresetIndex).toBe(3);

    const chooseByEnter = vi.fn();
    await act(async () => {
      result.current.handleReviewPromptKeyDown({
        key: "Enter",
        preventDefault: chooseByEnter,
      });
    });
    expect(chooseByEnter).toHaveBeenCalledTimes(1);
    expect(result.current.reviewPrompt?.step).toBe("custom");

    act(() => {
      result.current.showPresetStep();
      result.current.choosePreset("baseBranch");
    });
    const baseBranchArrow = vi.fn();
    act(() => {
      result.current.handleReviewPromptKeyDown({
        key: "ArrowDown",
        preventDefault: baseBranchArrow,
      });
    });
    expect(baseBranchArrow).toHaveBeenCalledTimes(1);
    expect(result.current.reviewPrompt?.selectedBranch).toBe("");

    act(() => {
      result.current.choosePreset("commit");
    });
    const commitArrow = vi.fn();
    act(() => {
      result.current.handleReviewPromptKeyDown({
        key: "ArrowUp",
        preventDefault: commitArrow,
      });
    });
    expect(commitArrow).toHaveBeenCalledTimes(1);
    expect(result.current.reviewPrompt?.selectedCommitSha).toBe("");

    const shiftEnter = vi.fn();
    const shiftHandled = result.current.handleReviewPromptKeyDown({
      key: "Enter",
      shiftKey: true,
      preventDefault: shiftEnter,
    });
    expect(shiftHandled).toBe(false);
    expect(shiftEnter).not.toHaveBeenCalled();
  });

  it("ignores stale async open responses after workspace switches", async () => {
    let resolveBranches: ((value: unknown) => void) | null = null;
    let resolveCommits: ((value: GitLogResponse | PromiseLike<GitLogResponse>) => void) | null = null;
    vi.mocked(listGitBranches).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveBranches = resolve;
        }),
    );
    vi.mocked(getGitLog).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveCommits = resolve;
        }),
    );

    const startReviewTarget = vi.fn().mockResolvedValue(true);
    const workspaceTwo: WorkspaceInfo = { ...WORKSPACE, id: "ws-2", name: "Workspace 2" };

    const { result, rerender } = renderHook(
      (props: { activeThreadId: string | null; activeWorkspace: WorkspaceInfo | null }) =>
        useReviewPrompt({
          activeWorkspace: props.activeWorkspace,
          activeThreadId: props.activeThreadId,
          startReviewTarget,
        }),
      {
        initialProps: {
          activeWorkspace: WORKSPACE,
          activeThreadId: "thread-1",
        },
      },
    );

    act(() => {
      result.current.openReviewPrompt();
    });

    rerender({ activeWorkspace: workspaceTwo, activeThreadId: "thread-1" });
    await waitFor(() => {
      expect(result.current.reviewPrompt).toBeNull();
    });

    await act(async () => {
      resolveBranches?.({ branches: [{ name: "main", lastCommit: 1 }] });
      resolveCommits?.({ total: 1, ahead: 0, behind: 0, aheadEntries: [], behindEntries: [], upstream: null, entries: [{ sha: "sha-x", summary: "late", author: "a", timestamp: 1 }] });
      await Promise.resolve();
    });

    expect(result.current.reviewPrompt).toBeNull();
  });

  it("handles rejected branch payload with non-Error reason", async () => {
    vi.mocked(listGitBranches).mockRejectedValue("branch rejected as string");
    vi.mocked(getGitLog).mockResolvedValue(resolvedCommitPayload);
    const startReviewTarget = vi.fn().mockResolvedValue(true);
    const onDebug = vi.fn();

    const { result } = renderHook(() =>
      useReviewPrompt({
        activeWorkspace: WORKSPACE,
        activeThreadId: "thread-1",
        onDebug,
        startReviewTarget,
      }),
    );

    act(() => {
      result.current.openReviewPrompt();
    });

    await waitFor(() => {
      expect(result.current.reviewPrompt?.isLoadingBranches).toBe(false);
      expect(result.current.reviewPrompt?.isLoadingCommits).toBe(false);
    });

    expect(result.current.reviewPrompt?.branches).toEqual([]);
    expect(result.current.reviewPrompt?.commits.map((entry) => entry.sha)).toEqual(["sha-1", "sha-2"]);
    expect(onDebug).toHaveBeenCalledWith(
      expect.objectContaining({
        label: "review/prompt load response",
        payload: expect.objectContaining({
          branchesError: "branch rejected as string",
          commitsError: null,
        }),
      }),
    );
  });

  it("is no-op safe for branch/commit/custom actions before prompt is opened", async () => {
    const startReviewTarget = vi.fn().mockResolvedValue(true);
    const { result } = renderHook(() =>
      useReviewPrompt({
        activeWorkspace: WORKSPACE,
        activeThreadId: "thread-1",
        startReviewTarget,
      }),
    );

    act(() => {
      result.current.showPresetStep();
      result.current.selectBranch("main");
      result.current.selectBranchAtIndex(1);
      result.current.selectCommit("sha-1", "first");
      result.current.selectCommitAtIndex(1);
      result.current.updateCustomInstructions("hello");
      result.current.choosePreset("baseBranch");
    });
    await act(async () => {
      await result.current.confirmBranch();
      await result.current.confirmCommit();
      await result.current.confirmCustom();
    });

    expect(result.current.reviewPrompt).toBeNull();
    expect(startReviewTarget).not.toHaveBeenCalled();
  });

  it("falls back to baseBranch when highlighted preset index is out of range", async () => {
    vi.mocked(listGitBranches).mockResolvedValue({
      branches: [{ name: "release", lastCommit: 10 }],
    });
    vi.mocked(getGitLog).mockResolvedValue({ total: 0, ahead: 0, behind: 0, aheadEntries: [], behindEntries: [], upstream: null, entries: [] });
    const startReviewTarget = vi.fn().mockResolvedValue(true);

    const { result } = renderHook(() =>
      useReviewPrompt({
        activeWorkspace: WORKSPACE,
        activeThreadId: "thread-1",
        startReviewTarget,
      }),
    );

    act(() => {
      result.current.openReviewPrompt();
    });
    await waitFor(() => {
      expect(result.current.reviewPrompt?.isLoadingBranches).toBe(false);
      expect(result.current.reviewPrompt?.isLoadingCommits).toBe(false);
    });

    act(() => {
      result.current.setHighlightedPresetIndex(99);
    });
    const preventDefault = vi.fn();
    await act(async () => {
      result.current.handleReviewPromptKeyDown({
        key: "Enter",
        preventDefault,
      });
    });

    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(result.current.reviewPrompt?.step).toBe("baseBranch");
    expect(result.current.reviewPrompt?.selectedBranch).toBe("release");
  });
});
