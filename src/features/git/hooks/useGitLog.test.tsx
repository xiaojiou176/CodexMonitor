// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GitLogEntry, WorkspaceInfo } from "../../../types";
import { getGitLog } from "../../../services/tauri";
import { useGitLog } from "./useGitLog";

vi.mock("../../../services/tauri", () => ({
  getGitLog: vi.fn(),
}));

const workspace: WorkspaceInfo = {
  id: "workspace-1",
  name: "CodexMonitor",
  path: "/tmp/codex",
  connected: true,
  settings: { sidebarCollapsed: false },
};

const secondaryWorkspace: WorkspaceInfo = {
  id: "workspace-2",
  name: "CodexMonitor Secondary",
  path: "/tmp/codex-secondary",
  connected: true,
  settings: { sidebarCollapsed: false },
};

const makeEntries = (prefix: string): GitLogEntry[] => [
  {
    hash: `${prefix}-hash-1`,
    shortHash: `${prefix}1`,
    subject: `${prefix} subject`,
    author: `${prefix} author`,
    date: "2026-02-27T00:00:00.000Z",
    refs: "",
  },
];

const makeLogResponse = (prefix: string) => ({
  entries: makeEntries(prefix),
  total: 1,
  ahead: 0,
  behind: 0,
  aheadEntries: [],
  behindEntries: [],
  upstream: "origin/main",
});

const flushMicrotaskQueue = () =>
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

describe("useGitLog", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("loads git log and updates loading state", async () => {
    const pending = deferred<ReturnType<typeof makeLogResponse>>();
    const getGitLogMock = vi.mocked(getGitLog);
    getGitLogMock.mockReturnValueOnce(pending.promise);

    const { result } = renderHook(() => useGitLog(workspace, true));

    await act(async () => {
      await flushMicrotaskQueue();
    });

    expect(getGitLogMock).toHaveBeenCalledWith(workspace.id);
    expect(result.current.isLoading).toBe(true);
    expect(result.current.error).toBeNull();

    await act(async () => {
      pending.resolve(makeLogResponse("main"));
      await flushMicrotaskQueue();
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.entries).toEqual(makeEntries("main"));
    expect(result.current.total).toBe(1);
  });

  it("refresh fetches newest git log data", async () => {
    const getGitLogMock = vi.mocked(getGitLog);
    getGitLogMock
      .mockResolvedValueOnce(makeLogResponse("first"))
      .mockResolvedValueOnce(makeLogResponse("manual"));

    const { result } = renderHook(() => useGitLog(workspace, true));

    await act(async () => {
      await flushMicrotaskQueue();
    });

    expect(result.current.entries).toEqual(makeEntries("first"));

    await act(async () => {
      await result.current.refresh();
    });

    expect(getGitLogMock).toHaveBeenCalledTimes(2);
    expect(result.current.entries).toEqual(makeEntries("manual"));
  });

  it("captures refresh errors and resets log state", async () => {
    const getGitLogMock = vi.mocked(getGitLog);
    getGitLogMock
      .mockResolvedValueOnce(makeLogResponse("stable"))
      .mockRejectedValueOnce(new Error("git log failed"));

    const { result } = renderHook(() => useGitLog(workspace, true));

    await act(async () => {
      await flushMicrotaskQueue();
    });

    expect(result.current.entries).toEqual(makeEntries("stable"));

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.entries).toEqual([]);
    expect(result.current.total).toBe(0);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe("git log failed");
  });

  it("resets and ignores stale responses when workspace dependency changes", async () => {
    const firstPending = deferred<ReturnType<typeof makeLogResponse>>();
    const secondPending = deferred<ReturnType<typeof makeLogResponse>>();
    const getGitLogMock = vi.mocked(getGitLog);
    getGitLogMock
      .mockReturnValueOnce(firstPending.promise)
      .mockReturnValueOnce(secondPending.promise);

    const { result, rerender } = renderHook(
      ({ active, enabled }: { active: WorkspaceInfo | null; enabled: boolean }) =>
        useGitLog(active, enabled),
      { initialProps: { active: workspace, enabled: true } },
    );

    await act(async () => {
      await flushMicrotaskQueue();
    });

    rerender({ active: secondaryWorkspace, enabled: true });

    await act(async () => {
      await flushMicrotaskQueue();
    });

    expect(getGitLogMock).toHaveBeenCalledWith("workspace-1");
    expect(getGitLogMock).toHaveBeenCalledWith("workspace-2");
    expect(result.current.entries).toEqual([]);

    await act(async () => {
      secondPending.resolve(makeLogResponse("secondary"));
      await flushMicrotaskQueue();
    });

    expect(result.current.entries).toEqual(makeEntries("secondary"));

    await act(async () => {
      firstPending.resolve(makeLogResponse("stale"));
      await flushMicrotaskQueue();
    });

    expect(result.current.entries).toEqual(makeEntries("secondary"));
  });
});
