// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspaceInfo } from "../../../types";
import { useWorkspaceDialogs } from "./useWorkspaceDialogs";

const askMock = vi.fn();
const messageMock = vi.fn();
const isMobilePlatformMock = vi.fn();
const pickWorkspacePathMock = vi.fn();

vi.mock("@tauri-apps/plugin-dialog", () => ({
  ask: (...args: unknown[]) => askMock(...args),
  message: (...args: unknown[]) => messageMock(...args),
}));

vi.mock("../../../utils/platformPaths", () => ({
  isMobilePlatform: () => isMobilePlatformMock(),
}));

vi.mock("../../../services/tauri", () => ({
  pickWorkspacePath: () => pickWorkspacePathMock(),
}));

describe("useWorkspaceDialogs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isMobilePlatformMock.mockReturnValue(false);
    pickWorkspacePathMock.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uses desktop picker when not mobile remote and returns selected path", async () => {
    pickWorkspacePathMock.mockResolvedValue("/tmp/ws");
    const { result } = renderHook(() => useWorkspaceDialogs());

    await expect(result.current.requestWorkspacePaths("local")).resolves.toEqual([
      "/tmp/ws",
    ]);
    expect(pickWorkspacePathMock).toHaveBeenCalledTimes(1);
  });

  it("uses desktop picker and returns [] when selection is canceled", async () => {
    pickWorkspacePathMock.mockResolvedValue(null);
    const { result } = renderHook(() => useWorkspaceDialogs());

    await expect(result.current.requestWorkspacePaths("local")).resolves.toEqual([]);
  });

  it("opens mobile remote prompt, validates empty input, parses payload, and closes", async () => {
    isMobilePlatformMock.mockReturnValue(true);
    const { result } = renderHook(() => useWorkspaceDialogs());

    let pending!: Promise<string[]>;
    await act(async () => {
      pending = result.current.requestWorkspacePaths("remote");
    });
    expect(result.current.mobileRemoteWorkspacePathPrompt).toEqual({
      value: "",
      error: null,
    });

    act(() => {
      result.current.submitMobileRemoteWorkspacePathPrompt();
    });
    expect(result.current.mobileRemoteWorkspacePathPrompt?.error).toBe(
      "Enter at least one absolute directory path.",
    );

    act(() => {
      result.current.updateMobileRemoteWorkspacePathInput(
        " /tmp/a, /tmp/b;\n/tmp/c ",
      );
    });
    act(() => {
      result.current.submitMobileRemoteWorkspacePathPrompt();
    });

    await expect(pending).resolves.toEqual(["/tmp/a", "/tmp/b", "/tmp/c"]);
    expect(result.current.mobileRemoteWorkspacePathPrompt).toBeNull();
  });

  it("cancels mobile prompt and resolves pending request with []", async () => {
    isMobilePlatformMock.mockReturnValue(true);
    const { result } = renderHook(() => useWorkspaceDialogs());

    let pending!: Promise<string[]>;
    await act(async () => {
      pending = result.current.requestWorkspacePaths("remote");
    });
    act(() => {
      result.current.cancelMobileRemoteWorkspacePathPrompt();
    });

    await expect(pending).resolves.toEqual([]);
    expect(result.current.mobileRemoteWorkspacePathPrompt).toBeNull();
  });

  it("resolves previous pending mobile request before opening a new one", async () => {
    isMobilePlatformMock.mockReturnValue(true);
    const { result } = renderHook(() => useWorkspaceDialogs());

    let first!: Promise<string[]>;
    let second!: Promise<string[]>;
    await act(async () => {
      first = result.current.requestWorkspacePaths("remote");
      second = result.current.requestWorkspacePaths("remote");
    });

    await expect(first).resolves.toEqual([]);
    act(() => {
      result.current.updateMobileRemoteWorkspacePathInput("/tmp/new");
    });
    act(() => {
      result.current.submitMobileRemoteWorkspacePathPrompt();
    });
    await expect(second).resolves.toEqual(["/tmp/new"]);
  });

  it("resolves pending mobile prompt on unmount (callback boundary)", async () => {
    isMobilePlatformMock.mockReturnValue(true);
    const { result, unmount } = renderHook(() => useWorkspaceDialogs());

    let pending!: Promise<string[]>;
    await act(async () => {
      pending = result.current.requestWorkspacePaths("remote");
    });
    unmount();

    await expect(pending).resolves.toEqual([]);
  });

  it("reports add-workspaces issues with warning and error variants", async () => {
    const { result } = renderHook(() => useWorkspaceDialogs());

    await act(async () => {
      await result.current.showAddWorkspacesResult({
        added: [],
        firstAdded: null,
        skippedExisting: [],
        skippedInvalid: [],
        failures: [],
      });
    });
    expect(messageMock).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.showAddWorkspacesResult({
        added: [{ id: "ws-1" } as WorkspaceInfo],
        firstAdded: { id: "ws-1" } as WorkspaceInfo,
        skippedExisting: ["/tmp/existing"],
        skippedInvalid: ["/tmp/file"],
        failures: [],
      });
    });
    expect(messageMock).toHaveBeenCalledWith(
      expect.stringContaining("Added 1 workspace."),
      expect.objectContaining({
        title: "Some workspaces were skipped",
        kind: "warning",
      }),
    );

    await act(async () => {
      await result.current.showAddWorkspacesResult({
        added: [],
        firstAdded: null,
        skippedExisting: [],
        skippedInvalid: [],
        failures: [
          { path: "/tmp/a", message: "A" },
          { path: "/tmp/b", message: "B" },
          { path: "/tmp/c", message: "C" },
          { path: "/tmp/d", message: "D" },
        ],
      });
    });
    expect(messageMock).toHaveBeenLastCalledWith(
      expect.stringContaining("…and 1 more"),
      {
        title: "Some workspaces failed to add",
        kind: "error",
      },
    );
  });

  it("builds workspace/worktree removal confirmations with fallback names", async () => {
    askMock.mockResolvedValue(true);
    const { result } = renderHook(() => useWorkspaceDialogs());

    const workspaces = [
      { id: "main", name: "Main Workspace" } as WorkspaceInfo,
      { id: "wt-1", parentId: "main" } as WorkspaceInfo,
      { id: "wt-2", parentId: "main" } as WorkspaceInfo,
    ];

    await expect(
      result.current.confirmWorkspaceRemoval(workspaces, "main"),
    ).resolves.toBe(true);
    expect(askMock).toHaveBeenCalledWith(
      expect.stringContaining("This will also delete 2 worktrees on disk."),
      expect.objectContaining({ title: "Delete Workspace", kind: "warning" }),
    );

    await result.current.confirmWorktreeRemoval([], "missing");
    expect(askMock).toHaveBeenLastCalledWith(
      expect.stringContaining('delete "this worktree"'),
      expect.objectContaining({ title: "Delete Worktree", kind: "warning" }),
    );
  });

  it("shows removal errors for Error and non-Error payloads", async () => {
    const { result } = renderHook(() => useWorkspaceDialogs());

    await result.current.showWorkspaceRemovalError(new Error("workspace failed"));
    expect(messageMock).toHaveBeenCalledWith("workspace failed", {
      title: "Delete workspace failed",
      kind: "error",
    });

    await result.current.showWorktreeRemovalError("worktree failed");
    expect(messageMock).toHaveBeenLastCalledWith("worktree failed", {
      title: "Delete worktree failed",
      kind: "error",
    });
  });
});
