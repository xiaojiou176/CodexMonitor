// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspaceInfo } from "../../../types";
import { pickWorkspacePath } from "../../../services/tauri";
import { useClonePrompt } from "./useClonePrompt";

vi.mock("../../../services/tauri", () => ({
  pickWorkspacePath: vi.fn(),
}));

const workspace: WorkspaceInfo = {
  id: "ws-1",
  name: "Repo",
  path: "/tmp/repo",
  connected: true,
  kind: "main",
  settings: { sidebarCollapsed: false },
};

describe("useClonePrompt", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("opens prompt, edits fields, and validates required inputs", async () => {
    const addCloneAgent = vi.fn();
    const connectWorkspace = vi.fn();
    const onSelectWorkspace = vi.fn();
    const resolveProjectContext = vi
      .fn()
      .mockReturnValue({ groupId: "g1", copiesFolder: "/tmp/copies" });
    const { result } = renderHook(() =>
      useClonePrompt({
        addCloneAgent,
        connectWorkspace,
        onSelectWorkspace,
        resolveProjectContext,
      }),
    );

    act(() => {
      result.current.openPrompt(workspace);
    });
    expect(result.current.clonePrompt?.copiesFolder).toBe("/tmp/copies");

    act(() => {
      result.current.updateCopyName(" ");
    });
    await act(async () => {
      await result.current.confirmPrompt();
    });
    expect(result.current.clonePrompt?.error).toBe("Copy name is required.");

    act(() => {
      result.current.updateCopyName("clone-x");
      result.current.clearCopiesFolder();
    });
    await act(async () => {
      await result.current.confirmPrompt();
    });
    expect(result.current.clonePrompt?.error).toBe("Copies folder is required.");
  });

  it("chooses and applies suggested folder, then runs happy path clone flow", async () => {
    const cloneWorkspace: WorkspaceInfo = {
      ...workspace,
      id: "clone-1",
      path: "/tmp/repo-copies/clone-1",
      connected: false,
      parentId: workspace.id,
    };
    const addCloneAgent = vi.fn().mockResolvedValue(cloneWorkspace);
    const connectWorkspace = vi.fn().mockResolvedValue(undefined);
    const onSelectWorkspace = vi.fn();
    const onCompactActivate = vi.fn();
    const persistProjectCopiesFolder = vi.fn().mockResolvedValue(undefined);
    const resolveProjectContext = vi
      .fn()
      .mockReturnValue({ groupId: "g1", copiesFolder: "/tmp/repo-copies" });
    vi.mocked(pickWorkspacePath).mockResolvedValue("/tmp/custom-copies");

    const { result } = renderHook(() =>
      useClonePrompt({
        addCloneAgent,
        connectWorkspace,
        onSelectWorkspace,
        resolveProjectContext,
        persistProjectCopiesFolder,
        onCompactActivate,
      }),
    );

    act(() => {
      result.current.openPrompt(workspace);
      result.current.useSuggestedCopiesFolder();
      result.current.updateCopyName("clone-one");
    });
    expect(result.current.clonePrompt?.copiesFolder).toBe("/tmp/repo-copies");

    await act(async () => {
      await result.current.chooseCopiesFolder();
    });
    expect(result.current.clonePrompt?.copiesFolder).toBe("/tmp/custom-copies");

    await act(async () => {
      await result.current.confirmPrompt();
    });

    expect(addCloneAgent).toHaveBeenCalledWith(workspace, "clone-one", "/tmp/custom-copies");
    expect(connectWorkspace).toHaveBeenCalledWith(cloneWorkspace);
    expect(onSelectWorkspace).toHaveBeenCalledWith("clone-1");
    expect(persistProjectCopiesFolder).toHaveBeenCalledWith("g1", "/tmp/custom-copies");
    expect(onCompactActivate).toHaveBeenCalled();
    expect(result.current.clonePrompt).toBeNull();
  });

  it("propagates clone errors and persistence warnings", async () => {
    const cloneWorkspace: WorkspaceInfo = {
      ...workspace,
      id: "clone-2",
      connected: true,
      parentId: workspace.id,
    };
    const onError = vi.fn();
    const addCloneAgent = vi
      .fn()
      .mockRejectedValueOnce(new Error("clone failed"))
      .mockResolvedValueOnce(cloneWorkspace);
    const connectWorkspace = vi.fn();
    const onSelectWorkspace = vi.fn();
    const persistProjectCopiesFolder = vi.fn().mockRejectedValue(new Error("persist failed"));
    const resolveProjectContext = vi
      .fn()
      .mockReturnValue({ groupId: "g1", copiesFolder: "/tmp/seed" });

    const { result } = renderHook(() =>
      useClonePrompt({
        addCloneAgent,
        connectWorkspace,
        onSelectWorkspace,
        resolveProjectContext,
        persistProjectCopiesFolder,
        onError,
      }),
    );

    act(() => {
      result.current.openPrompt(workspace);
      result.current.updateCopyName("clone-two");
      result.current.clearCopiesFolder();
      result.current.useSuggestedCopiesFolder();
    });

    await act(async () => {
      await result.current.confirmPrompt();
    });
    expect(result.current.clonePrompt?.error).toBe("clone failed");
    expect(onError).toHaveBeenCalledWith("clone failed");

    act(() => {
      result.current.cancelPrompt();
      result.current.openPrompt(workspace);
      result.current.updateCopyName("clone-three");
      result.current.clearCopiesFolder();
    });

    await act(async () => {
      await result.current.confirmPrompt();
    });
    expect(result.current.clonePrompt?.error).toBe("Copies folder is required.");

    act(() => {
      result.current.updateCopyName("clone-two");
      result.current.useSuggestedCopiesFolder();
    });
    await act(async () => {
      await result.current.confirmPrompt();
    });

    expect(onError).toHaveBeenCalledWith("persist failed");
    expect(result.current.clonePrompt).toBeNull();
  });
});
