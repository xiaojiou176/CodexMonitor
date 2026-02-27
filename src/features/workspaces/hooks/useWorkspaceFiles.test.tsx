// @vitest-environment jsdom
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspaceInfo } from "../../../types";
import { getWorkspaceFiles } from "../../../services/tauri";
import { useWorkspaceFiles } from "./useWorkspaceFiles";

vi.mock("../../../services/tauri", () => ({
  getWorkspaceFiles: vi.fn(),
}));

const connectedWorkspace: WorkspaceInfo = {
  id: "ws-1",
  name: "Repo",
  path: "/tmp/repo",
  connected: true,
  kind: "main",
  settings: { sidebarCollapsed: false },
};

describe("useWorkspaceFiles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads file list for connected workspace and supports manual refresh", async () => {
    vi.mocked(getWorkspaceFiles).mockResolvedValue(["a.ts", "b.ts"]);
    const onDebug = vi.fn();

    const { result } = renderHook(() =>
      useWorkspaceFiles({
        activeWorkspace: connectedWorkspace,
        onDebug,
      }),
    );

    await waitFor(() => {
      expect(result.current.files).toEqual(["a.ts", "b.ts"]);
      expect(result.current.isLoading).toBe(false);
    });

    vi.mocked(getWorkspaceFiles).mockResolvedValueOnce(["a.ts", "b.ts"]);
    const changed = await result.current.refreshFiles({ silent: true });
    expect(changed).toBe(false);
    expect(onDebug).toHaveBeenCalled();
  });

  it("ignores stale response when workspace changes mid-flight", async () => {
    let resolveFirst: ((value: string[]) => void) | undefined;
    vi.mocked(getWorkspaceFiles)
      .mockImplementationOnce(
        () =>
          new Promise<string[]>((resolve) => {
            resolveFirst = resolve;
          }),
      )
      .mockResolvedValueOnce(["new.ts"]);

    const { result, rerender } = renderHook(
      ({ workspace }: { workspace: WorkspaceInfo | null }) =>
        useWorkspaceFiles({
          activeWorkspace: workspace,
        }),
      { initialProps: { workspace: connectedWorkspace } },
    );

    const nextWorkspace: WorkspaceInfo = { ...connectedWorkspace, id: "ws-2" };
    rerender({ workspace: nextWorkspace });
    resolveFirst?.(["stale.ts"]);

    await waitFor(() => {
      expect(result.current.files).toEqual(["new.ts"]);
      expect(result.current.isLoading).toBe(false);
    });
  });

  it("short-circuits when disabled or disconnected", async () => {
    const disconnectedWorkspace: WorkspaceInfo = {
      ...connectedWorkspace,
      connected: false,
    };
    const { result } = renderHook(() =>
      useWorkspaceFiles({
        activeWorkspace: disconnectedWorkspace,
        enabled: false,
      }),
    );

    expect(await result.current.refreshFiles()).toBe(false);
    expect(result.current.files).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(getWorkspaceFiles).not.toHaveBeenCalled();
  });
});
