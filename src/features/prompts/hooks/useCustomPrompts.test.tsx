// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { WorkspaceInfo } from "../../../types";
import { getGlobalPromptsDir, getPromptsList } from "../../../services/tauri";
import { useCustomPrompts } from "./useCustomPrompts";

vi.mock("../../../services/tauri", () => ({
  createPrompt: vi.fn(),
  deletePrompt: vi.fn(),
  getPromptsList: vi.fn(),
  getGlobalPromptsDir: vi.fn(),
  getWorkspacePromptsDir: vi.fn(),
  movePrompt: vi.fn(),
  updatePrompt: vi.fn(),
}));

const workspace: WorkspaceInfo = {
  id: "ws-1",
  name: "Workspace",
  path: "/tmp/workspace",
  connected: false,
  settings: { sidebarCollapsed: false },
};

const workspace2: WorkspaceInfo = {
  id: "ws-2",
  name: "Workspace 2",
  path: "/tmp/workspace-2",
  connected: true,
  settings: { sidebarCollapsed: false },
};

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const getGlobalPromptsDirMock = vi.mocked(getGlobalPromptsDir);
const getPromptsListMock = vi.mocked(getPromptsList);

describe("useCustomPrompts", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when no workspace is selected", async () => {
    const { result } = renderHook(() =>
      useCustomPrompts({ activeWorkspace: null }),
    );

    let path: string | null = "unset";
    await act(async () => {
      path = await result.current.getGlobalPromptsDir();
    });

    expect(path).toBeNull();
    expect(getGlobalPromptsDirMock).not.toHaveBeenCalled();
  });

  it("requests the global prompts dir when a workspace is selected", async () => {
    getGlobalPromptsDirMock.mockResolvedValue("/tmp/.codex/prompts");
    const { result } = renderHook(() =>
      useCustomPrompts({ activeWorkspace: workspace }),
    );

    let path: string | null = null;
    await act(async () => {
      path = await result.current.getGlobalPromptsDir();
    });

    expect(getGlobalPromptsDirMock).toHaveBeenCalledWith("ws-1");
    expect(path).toBe("/tmp/.codex/prompts");
  });

  it("drops stale prompts responses when workspace switches", async () => {
    const ws1Prompts = createDeferred<any>();
    const ws2Prompts = createDeferred<any>();

    getPromptsListMock.mockImplementation((id: string) =>
      id === "ws-1" ? ws1Prompts.promise : ws2Prompts.promise,
    );

    const { result, rerender } = renderHook(
      ({ activeWorkspace }: { activeWorkspace: WorkspaceInfo }) =>
        useCustomPrompts({ activeWorkspace }),
      {
        initialProps: {
          activeWorkspace: { ...workspace, connected: true },
        },
      },
    );

    rerender({ activeWorkspace: workspace2 });

    ws2Prompts.resolve([
      { name: "prompt-ws2", path: "/tmp/ws2.md", content: "ws2" },
    ]);

    await waitFor(() => expect(result.current.prompts[0]?.name).toBe("prompt-ws2"));

    ws1Prompts.resolve([
      { name: "prompt-ws1", path: "/tmp/ws1.md", content: "ws1" },
    ]);

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.prompts[0]?.name).toBe("prompt-ws2");
  });
});
