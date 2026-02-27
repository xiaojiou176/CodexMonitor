// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspaceInfo } from "../../../types";
import {
  commitGit,
  fetchGit,
  generateCommitMessage,
  pullGit,
  pushGit,
  stageGitAll,
  syncGit,
} from "../../../services/tauri";
import { useGitCommitController } from "./useGitCommitController";

vi.mock("../../../services/tauri", () => ({
  commitGit: vi.fn(),
  fetchGit: vi.fn(),
  generateCommitMessage: vi.fn(),
  pullGit: vi.fn(),
  pushGit: vi.fn(),
  stageGitAll: vi.fn(),
  syncGit: vi.fn(),
}));

const workspace: WorkspaceInfo = {
  id: "workspace-1",
  name: "Workspace",
  path: "/tmp/workspace",
  connected: true,
  settings: { sidebarCollapsed: false },
};

type GitStatusState = {
  stagedFiles: Array<{ path: string; status: string; additions: number; deletions: number }>;
  unstagedFiles: Array<{ path: string; status: string; additions: number; deletions: number }>;
  branchName: string;
  files: Array<{ path: string; status: string; additions: number; deletions: number }>;
  totalAdditions: number;
  totalDeletions: number;
  error: string | null;
};

function makeGitStatus(overrides?: Partial<GitStatusState>): GitStatusState {
  return {
    branchName: "main",
    files: [],
    stagedFiles: [],
    unstagedFiles: [],
    totalAdditions: 0,
    totalDeletions: 0,
    error: null,
    ...overrides,
  };
}

function makeProps(overrides?:
  Partial<Parameters<typeof useGitCommitController>[0]>): Parameters<typeof useGitCommitController>[0] {
  return {
    activeWorkspace: workspace,
    activeWorkspaceId: workspace.id,
    activeWorkspaceIdRef: { current: workspace.id },
    gitStatus: makeGitStatus(),
    refreshGitStatus: vi.fn(),
    refreshGitLog: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(commitGit).mockResolvedValue(undefined);
  vi.mocked(fetchGit).mockResolvedValue(undefined);
  vi.mocked(generateCommitMessage).mockResolvedValue("feat: generated message");
  vi.mocked(pullGit).mockResolvedValue(undefined);
  vi.mocked(pushGit).mockResolvedValue(undefined);
  vi.mocked(stageGitAll).mockResolvedValue(undefined);
  vi.mocked(syncGit).mockResolvedValue(undefined);
});

describe("useGitCommitController", () => {
  it("short-circuits actions when workspace is not available", async () => {
    const { result } = renderHook(() =>
      useGitCommitController(
        makeProps({
          activeWorkspace: null,
          activeWorkspaceId: null,
          activeWorkspaceIdRef: { current: null },
        }),
      ),
    );

    await act(async () => {
      await result.current.onGenerateCommitMessage();
      await result.current.onCommit();
      await result.current.onCommitAndPush();
      await result.current.onCommitAndSync();
      await result.current.onPull();
      await result.current.onFetch();
      await result.current.onPush();
      await result.current.onSync();
    });

    expect(generateCommitMessage).not.toHaveBeenCalled();
    expect(commitGit).not.toHaveBeenCalled();
    expect(pullGit).not.toHaveBeenCalled();
    expect(fetchGit).not.toHaveBeenCalled();
    expect(pushGit).not.toHaveBeenCalled();
    expect(syncGit).not.toHaveBeenCalled();
  });

  it("generates a commit message for the active workspace", async () => {
    const { result } = renderHook(() => useGitCommitController(makeProps()));

    await act(async () => {
      await result.current.onGenerateCommitMessage();
    });

    expect(generateCommitMessage).toHaveBeenCalledWith("workspace-1");
    expect(result.current.commitMessage).toBe("feat: generated message");
    expect(result.current.commitMessageError).toBe(null);
    expect(result.current.commitMessageLoading).toBe(false);
  });

  it("does not apply generated message when active workspace ref changed", async () => {
    const activeWorkspaceIdRef = { current: "workspace-2" };
    const { result } = renderHook(() =>
      useGitCommitController(
        makeProps({
          activeWorkspaceIdRef,
        }),
      ),
    );

    await act(async () => {
      await result.current.onGenerateCommitMessage();
    });

    expect(generateCommitMessage).toHaveBeenCalledWith("workspace-1");
    expect(result.current.commitMessage).toBe("");
    expect(result.current.commitMessageError).toBe(null);
  });

  it("commits with staged files and refreshes status and log", async () => {
    const refreshGitStatus = vi.fn();
    const refreshGitLog = vi.fn();
    const { result } = renderHook(() =>
      useGitCommitController(
        makeProps({
          gitStatus: makeGitStatus({
            stagedFiles: [{ path: "src/a.ts", status: "M", additions: 1, deletions: 0 }],
          }),
          refreshGitStatus,
          refreshGitLog,
        }),
      ),
    );

    act(() => {
      result.current.onCommitMessageChange("  fix: trim message  ");
    });

    await act(async () => {
      await result.current.onCommit();
    });

    expect(stageGitAll).not.toHaveBeenCalled();
    expect(commitGit).toHaveBeenCalledWith("workspace-1", "fix: trim message");
    expect(refreshGitStatus).toHaveBeenCalledTimes(1);
    expect(refreshGitLog).toHaveBeenCalledTimes(1);
    expect(result.current.commitMessage).toBe("");
    expect(result.current.commitError).toBe(null);
  });

  it("auto-stages unstaged changes before commit", async () => {
    const { result } = renderHook(() =>
      useGitCommitController(
        makeProps({
          gitStatus: makeGitStatus({
            unstagedFiles: [{ path: "src/b.ts", status: "M", additions: 2, deletions: 1 }],
          }),
        }),
      ),
    );

    act(() => {
      result.current.onCommitMessageChange("feat: commit unstaged");
    });

    await act(async () => {
      await result.current.onCommit();
    });

    expect(stageGitAll).toHaveBeenCalledWith("workspace-1");
    expect(commitGit).toHaveBeenCalledWith("workspace-1", "feat: commit unstaged");
  });

  it("routes commit failure into commitError", async () => {
    vi.mocked(commitGit).mockRejectedValueOnce(new Error("commit failed"));
    const { result } = renderHook(() =>
      useGitCommitController(
        makeProps({
          gitStatus: makeGitStatus({
            stagedFiles: [{ path: "src/c.ts", status: "M", additions: 3, deletions: 0 }],
          }),
        }),
      ),
    );

    act(() => {
      result.current.onCommitMessageChange("fix: broken commit");
    });

    await act(async () => {
      await result.current.onCommit();
    });

    expect(result.current.commitError).toBe("commit failed");
    expect(result.current.commitLoading).toBe(false);
  });

  it("distinguishes commit and push errors in commit-and-push flow", async () => {
    const commitFailure = renderHook(() =>
      useGitCommitController(
        makeProps({
          gitStatus: makeGitStatus({
            stagedFiles: [{ path: "src/d.ts", status: "M", additions: 1, deletions: 0 }],
          }),
        }),
      ),
    );

    vi.mocked(commitGit).mockRejectedValueOnce(new Error("commit failed first"));

    act(() => {
      commitFailure.result.current.onCommitMessageChange("feat: commit and push");
    });

    await act(async () => {
      await commitFailure.result.current.onCommitAndPush();
    });

    expect(commitFailure.result.current.commitError).toBe("commit failed first");
    expect(commitFailure.result.current.pushError).toBe(null);
    expect(pushGit).not.toHaveBeenCalled();

    const pushFailure = renderHook(() =>
      useGitCommitController(
        makeProps({
          gitStatus: makeGitStatus({
            stagedFiles: [{ path: "src/e.ts", status: "M", additions: 1, deletions: 0 }],
          }),
        }),
      ),
    );

    vi.mocked(pushGit).mockRejectedValueOnce(new Error("push failed second"));

    act(() => {
      pushFailure.result.current.onCommitMessageChange("feat: commit and push 2");
    });

    await act(async () => {
      await pushFailure.result.current.onCommitAndPush();
    });

    expect(commitGit).toHaveBeenCalledWith("workspace-1", "feat: commit and push 2");
    expect(pushFailure.result.current.commitError).toBe(null);
    expect(pushFailure.result.current.pushError).toBe("push failed second");
    expect(pushFailure.result.current.commitMessage).toBe("");
  });

  it("tracks sync failure after successful commit-and-sync", async () => {
    vi.mocked(syncGit).mockRejectedValueOnce(new Error("sync failed"));
    const { result } = renderHook(() =>
      useGitCommitController(
        makeProps({
          gitStatus: makeGitStatus({
            stagedFiles: [{ path: "src/f.ts", status: "M", additions: 2, deletions: 0 }],
          }),
        }),
      ),
    );

    act(() => {
      result.current.onCommitMessageChange("feat: commit and sync");
    });

    await act(async () => {
      await result.current.onCommitAndSync();
    });

    expect(commitGit).toHaveBeenCalledWith("workspace-1", "feat: commit and sync");
    expect(syncGit).toHaveBeenCalledWith("workspace-1");
    expect(result.current.commitError).toBe(null);
    expect(result.current.syncError).toBe("sync failed");
    expect(result.current.syncLoading).toBe(false);
  });

  it("clears opposite-direction errors after successful pull/push/sync", async () => {
    const { result } = renderHook(() =>
      useGitCommitController(
        makeProps({
          gitStatus: makeGitStatus({
            stagedFiles: [{ path: "src/g.ts", status: "M", additions: 1, deletions: 1 }],
          }),
        }),
      ),
    );

    vi.mocked(pullGit).mockRejectedValueOnce(new Error("pull failed"));
    await act(async () => {
      await result.current.onPull();
    });
    expect(result.current.pullError).toBe("pull failed");

    await act(async () => {
      await result.current.onPush();
    });
    expect(result.current.pullError).toBe(null);
    expect(result.current.pushError).toBe(null);

    vi.mocked(pushGit).mockRejectedValueOnce(new Error("push failed"));
    await act(async () => {
      await result.current.onPush();
    });
    expect(result.current.pushError).toBe("push failed");

    await act(async () => {
      await result.current.onPull();
    });
    expect(result.current.pushError).toBe(null);

    await act(async () => {
      await result.current.onSync();
    });

    await waitFor(() => {
      expect(result.current.pullError).toBe(null);
      expect(result.current.pushError).toBe(null);
      expect(result.current.syncError).toBe(null);
    });
  });

  it("sets fetchError when fetch fails", async () => {
    vi.mocked(fetchGit).mockRejectedValueOnce(new Error("fetch failed"));
    const { result } = renderHook(() => useGitCommitController(makeProps()));

    await act(async () => {
      await result.current.onFetch();
    });

    expect(result.current.fetchError).toBe("fetch failed");
    expect(result.current.fetchLoading).toBe(false);
  });

  it("runs fetch without optional refreshGitLog callback", async () => {
    const refreshGitStatus = vi.fn();
    const { result } = renderHook(() =>
      useGitCommitController(
        makeProps({
          refreshGitStatus,
          refreshGitLog: undefined,
        }),
      ),
    );

    await act(async () => {
      await result.current.onFetch();
    });

    expect(fetchGit).toHaveBeenCalledWith("workspace-1");
    expect(refreshGitStatus).toHaveBeenCalledTimes(1);
  });

  it("surfaces sync errors from direct sync action", async () => {
    vi.mocked(syncGit).mockRejectedValueOnce(new Error("sync direct failed"));
    const { result } = renderHook(() => useGitCommitController(makeProps()));

    await act(async () => {
      await result.current.onSync();
    });

    expect(syncGit).toHaveBeenCalledWith("workspace-1");
    expect(result.current.syncError).toBe("sync direct failed");
    expect(result.current.syncLoading).toBe(false);
  });
});
