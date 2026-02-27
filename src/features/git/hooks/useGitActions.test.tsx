// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ask } from "@tauri-apps/plugin-dialog";
import {
  applyWorktreeChanges,
  revertGitAll,
  revertGitFile,
  stageGitAll,
  stageGitFile,
  unstageGitFile,
} from "../../../services/tauri";
import type { WorkspaceInfo } from "../../../types";
import { useGitActions } from "./useGitActions";

vi.mock("@tauri-apps/plugin-dialog", () => ({
  ask: vi.fn(),
}));

vi.mock("../../../services/tauri", () => ({
  applyWorktreeChanges: vi.fn(),
  revertGitAll: vi.fn(),
  revertGitFile: vi.fn(),
  stageGitAll: vi.fn(),
  stageGitFile: vi.fn(),
  unstageGitFile: vi.fn(),
}));

const workspace: WorkspaceInfo = {
  id: "workspace-1",
  name: "CodexMonitor",
  path: "/tmp/codex",
  connected: true,
  settings: { sidebarCollapsed: false },
};

const worktreeWorkspace: WorkspaceInfo = {
  ...workspace,
  id: "worktree-1",
  kind: "worktree",
};

const secondWorkspace: WorkspaceInfo = {
  ...workspace,
  id: "workspace-2",
};

const flushMicrotasks = () =>
  new Promise<void>((resolve) => {
    queueMicrotask(resolve);
  });

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

describe("useGitActions", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("returns early when no active workspace", async () => {
    const onRefreshGitStatus = vi.fn();
    const onRefreshGitDiffs = vi.fn();

    const { result } = renderHook(() =>
      useGitActions({
        activeWorkspace: null,
        onRefreshGitStatus,
        onRefreshGitDiffs,
      }),
    );

    await act(async () => {
      await result.current.stageGitFile("a.ts");
      await result.current.stageGitAll();
      await result.current.unstageGitFile("a.ts");
      await result.current.revertGitFile("a.ts");
      await result.current.revertAllGitChanges();
      await result.current.applyWorktreeChanges();
    });

    expect(stageGitFile).not.toHaveBeenCalled();
    expect(stageGitAll).not.toHaveBeenCalled();
    expect(unstageGitFile).not.toHaveBeenCalled();
    expect(revertGitFile).not.toHaveBeenCalled();
    expect(revertGitAll).not.toHaveBeenCalled();
    expect(applyWorktreeChanges).not.toHaveBeenCalled();
    expect(ask).not.toHaveBeenCalled();
    expect(onRefreshGitStatus).not.toHaveBeenCalled();
    expect(onRefreshGitDiffs).not.toHaveBeenCalled();
  });

  it.each([
    {
      name: "stageGitFile",
      invoke: (hook: ReturnType<typeof useGitActions>) => hook.stageGitFile("file.ts"),
      service: stageGitFile,
      expectedArgs: [workspace.id, "file.ts"],
    },
    {
      name: "stageGitAll",
      invoke: (hook: ReturnType<typeof useGitActions>) => hook.stageGitAll(),
      service: stageGitAll,
      expectedArgs: [workspace.id],
    },
    {
      name: "unstageGitFile",
      invoke: (hook: ReturnType<typeof useGitActions>) =>
        hook.unstageGitFile("file.ts"),
      service: unstageGitFile,
      expectedArgs: [workspace.id, "file.ts"],
    },
    {
      name: "revertGitFile",
      invoke: (hook: ReturnType<typeof useGitActions>) => hook.revertGitFile("file.ts"),
      service: revertGitFile,
      expectedArgs: [workspace.id, "file.ts"],
    },
  ])(
    "$name refreshes git data on success",
    async ({ invoke, service, expectedArgs }) => {
      const onRefreshGitStatus = vi.fn();
      const onRefreshGitDiffs = vi.fn();
      vi.mocked(service).mockResolvedValueOnce(undefined);

      const { result } = renderHook(() =>
        useGitActions({
          activeWorkspace: workspace,
          onRefreshGitStatus,
          onRefreshGitDiffs,
        }),
      );

      await act(async () => {
        await invoke(result.current);
      });

      expect(service).toHaveBeenCalledWith(...expectedArgs);
      expect(onRefreshGitStatus).toHaveBeenCalledTimes(1);
      expect(onRefreshGitDiffs).toHaveBeenCalledTimes(1);
    },
  );

  it.each([
    {
      name: "stageGitFile",
      invoke: (hook: ReturnType<typeof useGitActions>) => hook.stageGitFile("file.ts"),
      service: stageGitFile,
    },
    {
      name: "stageGitAll",
      invoke: (hook: ReturnType<typeof useGitActions>) => hook.stageGitAll(),
      service: stageGitAll,
    },
    {
      name: "unstageGitFile",
      invoke: (hook: ReturnType<typeof useGitActions>) =>
        hook.unstageGitFile("file.ts"),
      service: unstageGitFile,
    },
    {
      name: "revertGitFile",
      invoke: (hook: ReturnType<typeof useGitActions>) => hook.revertGitFile("file.ts"),
      service: revertGitFile,
    },
  ])(
    "$name reports error and still refreshes when request fails",
    async ({ invoke, service }) => {
      const onRefreshGitStatus = vi.fn();
      const onRefreshGitDiffs = vi.fn();
      const onError = vi.fn();
      const error = new Error("boom");
      vi.mocked(service).mockRejectedValueOnce(error);

      const { result } = renderHook(() =>
        useGitActions({
          activeWorkspace: workspace,
          onRefreshGitStatus,
          onRefreshGitDiffs,
          onError,
        }),
      );

      await act(async () => {
        await invoke(result.current);
      });

      expect(onError).toHaveBeenCalledWith(error);
      expect(onRefreshGitStatus).toHaveBeenCalledTimes(1);
      expect(onRefreshGitDiffs).toHaveBeenCalledTimes(1);
    },
  );

  it("skips refresh if workspace changes before file action settles", async () => {
    const onRefreshGitStatus = vi.fn();
    const onRefreshGitDiffs = vi.fn();
    const pending = deferred<void>();
    vi.mocked(stageGitFile).mockReturnValueOnce(pending.promise);

    const { result, rerender } = renderHook(
      ({ activeWorkspace }: { activeWorkspace: WorkspaceInfo }) =>
        useGitActions({
          activeWorkspace,
          onRefreshGitStatus,
          onRefreshGitDiffs,
        }),
      { initialProps: { activeWorkspace: workspace } },
    );

    const stagePromise = result.current.stageGitFile("file.ts");

    rerender({ activeWorkspace: secondWorkspace });

    await act(async () => {
      pending.resolve(undefined);
      await stagePromise;
    });

    expect(onRefreshGitStatus).not.toHaveBeenCalled();
    expect(onRefreshGitDiffs).not.toHaveBeenCalled();
  });

  it("reverts all changes when user confirms", async () => {
    const onRefreshGitStatus = vi.fn();
    const onRefreshGitDiffs = vi.fn();
    vi.mocked(ask).mockResolvedValueOnce(true);
    vi.mocked(revertGitAll).mockResolvedValueOnce(undefined);

    const { result } = renderHook(() =>
      useGitActions({
        activeWorkspace: workspace,
        onRefreshGitStatus,
        onRefreshGitDiffs,
      }),
    );

    await act(async () => {
      await result.current.revertAllGitChanges();
    });

    expect(ask).toHaveBeenCalledOnce();
    expect(revertGitAll).toHaveBeenCalledWith(workspace.id);
    expect(onRefreshGitStatus).toHaveBeenCalledTimes(1);
    expect(onRefreshGitDiffs).toHaveBeenCalledTimes(1);
  });

  it("does nothing when revert-all dialog is canceled", async () => {
    const onRefreshGitStatus = vi.fn();
    const onRefreshGitDiffs = vi.fn();
    vi.mocked(ask).mockResolvedValueOnce(false);

    const { result } = renderHook(() =>
      useGitActions({
        activeWorkspace: workspace,
        onRefreshGitStatus,
        onRefreshGitDiffs,
      }),
    );

    await act(async () => {
      await result.current.revertAllGitChanges();
    });

    expect(revertGitAll).not.toHaveBeenCalled();
    expect(onRefreshGitStatus).not.toHaveBeenCalled();
    expect(onRefreshGitDiffs).not.toHaveBeenCalled();
  });

  it("reports revert-all errors", async () => {
    const onRefreshGitStatus = vi.fn();
    const onRefreshGitDiffs = vi.fn();
    const onError = vi.fn();
    const error = new Error("revert failed");
    vi.mocked(ask).mockResolvedValueOnce(true);
    vi.mocked(revertGitAll).mockRejectedValueOnce(error);

    const { result } = renderHook(() =>
      useGitActions({
        activeWorkspace: workspace,
        onRefreshGitStatus,
        onRefreshGitDiffs,
        onError,
      }),
    );

    await act(async () => {
      await result.current.revertAllGitChanges();
    });

    expect(onError).toHaveBeenCalledWith(error);
    expect(onRefreshGitStatus).not.toHaveBeenCalled();
    expect(onRefreshGitDiffs).not.toHaveBeenCalled();
  });

  it("applies worktree changes and auto-clears success state", async () => {
    vi.mocked(applyWorktreeChanges).mockResolvedValueOnce(undefined);

    const { result } = renderHook(() =>
      useGitActions({
        activeWorkspace: worktreeWorkspace,
        onRefreshGitStatus: vi.fn(),
        onRefreshGitDiffs: vi.fn(),
      }),
    );

    await act(async () => {
      await result.current.applyWorktreeChanges();
    });

    expect(applyWorktreeChanges).toHaveBeenCalledWith(worktreeWorkspace.id);
    expect(result.current.worktreeApplyLoading).toBe(false);
    expect(result.current.worktreeApplyError).toBeNull();
    expect(result.current.worktreeApplySuccess).toBe(true);

    await act(async () => {
      vi.advanceTimersByTime(2500);
      await flushMicrotasks();
    });

    expect(result.current.worktreeApplySuccess).toBe(false);
  });

  it("stores stringified worktree apply errors", async () => {
    vi.mocked(applyWorktreeChanges).mockRejectedValueOnce("bad apply");

    const { result } = renderHook(() =>
      useGitActions({
        activeWorkspace: worktreeWorkspace,
        onRefreshGitStatus: vi.fn(),
        onRefreshGitDiffs: vi.fn(),
      }),
    );

    await act(async () => {
      await result.current.applyWorktreeChanges();
    });

    expect(result.current.worktreeApplyLoading).toBe(false);
    expect(result.current.worktreeApplySuccess).toBe(false);
    expect(result.current.worktreeApplyError).toBe("bad apply");
  });

  it("ignores stale worktree results after workspace switches", async () => {
    const pending = deferred<void>();
    vi.mocked(applyWorktreeChanges).mockReturnValueOnce(pending.promise);

    const { result, rerender } = renderHook(
      ({ activeWorkspace }: { activeWorkspace: WorkspaceInfo }) =>
        useGitActions({
          activeWorkspace,
          onRefreshGitStatus: vi.fn(),
          onRefreshGitDiffs: vi.fn(),
        }),
      { initialProps: { activeWorkspace: worktreeWorkspace } },
    );

    let applyPromise!: Promise<void>;
    await act(async () => {
      applyPromise = result.current.applyWorktreeChanges();
    });

    rerender({ activeWorkspace: secondWorkspace });

    await act(async () => {
      pending.resolve(undefined);
      await applyPromise;
    });

    expect(result.current.worktreeApplyLoading).toBe(false);
    expect(result.current.worktreeApplyError).toBeNull();
    expect(result.current.worktreeApplySuccess).toBe(false);
  });
});
