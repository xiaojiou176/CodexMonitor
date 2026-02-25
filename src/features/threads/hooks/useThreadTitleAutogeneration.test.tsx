// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { ConversationItem, ThreadSummary } from "../../../types";
import { generateRunMetadata } from "../../../services/tauri";
import { useThreadTitleAutogeneration } from "./useThreadTitleAutogeneration";

vi.mock("../../../services/tauri", () => ({
  generateRunMetadata: vi.fn(),
}));

describe("useThreadTitleAutogeneration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function setup({
    enabled = true,
    initialCustomName,
    threadName = "New Agent",
    existingItems = [],
  }: {
    enabled?: boolean;
    initialCustomName?: string;
    threadName?: string;
    existingItems?: ConversationItem[];
  } = {}) {
    let customName = initialCustomName;
    const getCustomName = vi.fn(() => customName);
    const renameThread = vi.fn((_workspaceId: string, _threadId: string, title: string) => {
      customName = title;
    });

    const itemsByThreadRef = {
      current: { "thread-1": existingItems },
    };
    const threadsByWorkspaceRef = {
      current: {
        "ws-1": [
          { id: "thread-1", name: threadName, updatedAt: 0 } as ThreadSummary,
        ],
      },
    };

    const { result } = renderHook(() =>
      useThreadTitleAutogeneration({
        enabled,
        itemsByThreadRef,
        threadsByWorkspaceRef,
        getCustomName,
        renameThread,
      }),
    );

    return {
      result,
      getCustomName,
      renameThread,
      setCustomName: (value: string) => {
        customName = value;
      },
    };
  }

  it("generates and persists a title for the first user message in a new thread", async () => {
    vi.mocked(generateRunMetadata).mockResolvedValue({
      title: "Generated Title",
      worktreeName: "feat/generated-title",
    });
    const { result, renameThread } = setup();

    await act(async () => {
      await result.current.onUserMessageCreated("ws-1", "thread-1", "Hello there");
    });

    expect(generateRunMetadata).toHaveBeenCalledWith("ws-1", "Hello there");
    expect(renameThread).toHaveBeenCalledWith("ws-1", "thread-1", "Generated Title");
  });

  it("does nothing when disabled", async () => {
    const { result } = setup({ enabled: false });

    await act(async () => {
      await result.current.onUserMessageCreated("ws-1", "thread-1", "Hello there");
    });

    expect(generateRunMetadata).not.toHaveBeenCalled();
  });

  it("does not override custom names", async () => {
    const { result } = setup({ initialCustomName: "Custom" });

    await act(async () => {
      await result.current.onUserMessageCreated("ws-1", "thread-1", "Hello there");
    });

    expect(generateRunMetadata).not.toHaveBeenCalled();
  });

  it("does not run when a user message already exists", async () => {
    const { result } = setup({
      existingItems: [{ id: "user-1", kind: "message", role: "user", text: "Old" }],
    });

    await act(async () => {
      await result.current.onUserMessageCreated("ws-1", "thread-1", "Hello there");
    });

    expect(generateRunMetadata).not.toHaveBeenCalled();
  });

  it("avoids duplicate generation while in flight", async () => {
    let resolvePromise!: (value: { title: string; worktreeName: string }) => void;
    const pending = new Promise<{ title: string; worktreeName: string }>((resolve) => {
      resolvePromise = resolve;
    });
    vi.mocked(generateRunMetadata).mockReturnValue(pending);

    const { result } = setup();

    const p1 = result.current.onUserMessageCreated("ws-1", "thread-1", "Hello there");
    const p2 = result.current.onUserMessageCreated("ws-1", "thread-1", "Hello there again");

    expect(generateRunMetadata).toHaveBeenCalledTimes(1);

    resolvePromise({ title: "Generated Title", worktreeName: "feat/x" });
    await act(async () => {
      await Promise.all([p1, p2]);
    });
  });

  it("does not override if a custom name appears while generating", async () => {
    let resolvePromise!: (value: { title: string; worktreeName: string }) => void;
    const pending = new Promise<{ title: string; worktreeName: string }>((resolve) => {
      resolvePromise = resolve;
    });
    vi.mocked(generateRunMetadata).mockReturnValue(pending);

    const { result, renameThread, setCustomName } = setup();

    const promise = result.current.onUserMessageCreated("ws-1", "thread-1", "Hello there");
    setCustomName("Manual rename");
    resolvePromise({ title: "Generated Title", worktreeName: "feat/x" });

    await act(async () => {
      await promise;
    });

    expect(renameThread).not.toHaveBeenCalled();
  });

  it("skips rename when generated title is blank after normalization", async () => {
    vi.mocked(generateRunMetadata).mockResolvedValue({
      title: "   ",
      worktreeName: "feat/blank",
    });
    const { result, renameThread } = setup();

    await act(async () => {
      await result.current.onUserMessageCreated("ws-1", "thread-1", "Need a title");
    });

    expect(generateRunMetadata).toHaveBeenCalledWith("ws-1", "Need a title");
    expect(renameThread).not.toHaveBeenCalled();
  });

  it("records debug details when metadata generation throws", async () => {
    vi.mocked(generateRunMetadata).mockRejectedValue(new Error("metadata failed"));
    const onDebug = vi.fn();

    const { result } = renderHook(() =>
      useThreadTitleAutogeneration({
        enabled: true,
        itemsByThreadRef: { current: { "thread-1": [] } },
        threadsByWorkspaceRef: {
          current: {
            "ws-1": [{ id: "thread-1", name: "New Agent", updatedAt: 0 }],
          },
        },
        getCustomName: vi.fn(() => undefined),
        renameThread: vi.fn(),
        onDebug,
      }),
    );

    await act(async () => {
      await result.current.onUserMessageCreated("ws-1", "thread-1", "trigger failure");
    });

    expect(onDebug).toHaveBeenCalledTimes(1);
    expect(onDebug).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "error",
        label: "thread/title autogen error",
        payload: "metadata failed",
      }),
    );
  });

  it("records non-Error failures as string payloads", async () => {
    vi.mocked(generateRunMetadata).mockRejectedValue("branch suggestion unavailable");
    const onDebug = vi.fn();

    const { result } = renderHook(() =>
      useThreadTitleAutogeneration({
        enabled: true,
        itemsByThreadRef: { current: { "thread-1": [] } },
        threadsByWorkspaceRef: {
          current: {
            "ws-1": [{ id: "thread-1", name: "New Agent", updatedAt: 0 }],
          },
        },
        getCustomName: vi.fn(() => undefined),
        renameThread: vi.fn(),
        onDebug,
      }),
    );

    await act(async () => {
      await result.current.onUserMessageCreated("ws-1", "thread-1", "trigger non-error failure");
    });

    expect(onDebug).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "error",
        label: "thread/title autogen error",
        payload: "branch suggestion unavailable",
      }),
    );
  });

  it("skips generation when workspace or thread id is missing", async () => {
    const { result } = setup();

    await act(async () => {
      await result.current.onUserMessageCreated("", "thread-1", "hello");
      await result.current.onUserMessageCreated("ws-1", "", "hello");
    });

    expect(generateRunMetadata).not.toHaveBeenCalled();
  });

  it("cleans image and skill markers before metadata generation", async () => {
    vi.mocked(generateRunMetadata).mockResolvedValue({
      title: "Generated clean title",
      worktreeName: "feat/clean",
    });
    const { result } = setup({ threadName: "Agent 12" });

    await act(async () => {
      await result.current.onUserMessageCreated(
        "ws-1",
        "thread-1",
        "   [image x2]   summarize   $debug_mode   this   change  ",
      );
    });

    expect(generateRunMetadata).toHaveBeenCalledWith("ws-1", "summarize this change");
  });

  it("cleans mixed multimedia markers before metadata generation", async () => {
    vi.mocked(generateRunMetadata).mockResolvedValue({
      title: "Generated clean title",
      worktreeName: "feat/clean-media",
    });
    const { result } = setup({ threadName: "Agent AB12" });

    await act(async () => {
      await result.current.onUserMessageCreated(
        "ws-1",
        "thread-1",
        " [IMAGE] [image] please inspect this clip $branch_hint ",
      );
    });

    expect(generateRunMetadata).toHaveBeenCalledWith("ws-1", "please inspect this clip");
  });

  it("skips generation when thread name is not auto-generated", async () => {
    const { result } = setup({ threadName: "Manual project planning" });

    await act(async () => {
      await result.current.onUserMessageCreated("ws-1", "thread-1", "hello world");
    });

    expect(generateRunMetadata).not.toHaveBeenCalled();
  });

  it("skips generation when cleaned prompt becomes empty", async () => {
    const { result } = setup();

    await act(async () => {
      await result.current.onUserMessageCreated(
        "ws-1",
        "thread-1",
        "   [image x2]   $debug_mode   $safe_mode   ",
      );
    });

    expect(generateRunMetadata).not.toHaveBeenCalled();
  });

  it("keeps autogeneration enabled when thread snapshot is missing", async () => {
    vi.mocked(generateRunMetadata).mockResolvedValue({
      title: "Recovered title",
      worktreeName: "feat/recovered",
    });
    const renameThread = vi.fn();
    const { result } = renderHook(() =>
      useThreadTitleAutogeneration({
        enabled: true,
        itemsByThreadRef: { current: { "thread-1": [] } },
        threadsByWorkspaceRef: { current: { "ws-1": [] } },
        getCustomName: vi.fn(() => undefined),
        renameThread,
      }),
    );

    await act(async () => {
      await result.current.onUserMessageCreated("ws-1", "thread-1", "name this");
    });

    expect(generateRunMetadata).toHaveBeenCalledWith("ws-1", "name this");
    expect(renameThread).toHaveBeenCalledWith("ws-1", "thread-1", "Recovered title");
  });

  it("truncates long cleaned prompts before metadata generation", async () => {
    vi.mocked(generateRunMetadata).mockResolvedValue({
      title: "Long prompt title",
      worktreeName: "feat/long-prompt",
    });
    const { result, renameThread } = setup();
    const longPrompt = `start ${"x".repeat(1300)}`;

    await act(async () => {
      await result.current.onUserMessageCreated("ws-1", "thread-1", longPrompt);
    });

    const calledPrompt = vi.mocked(generateRunMetadata).mock.calls[0]?.[1];
    expect(calledPrompt).toHaveLength(1200);
    expect(renameThread).toHaveBeenCalledWith("ws-1", "thread-1", "Long prompt title");
  });

  it("truncates generated titles longer than the max thread name length", async () => {
    vi.mocked(generateRunMetadata).mockResolvedValue({
      title: "This generated title is definitely longer than thirty eight chars",
      worktreeName: "feat/long-title",
    });
    const { result, renameThread } = setup();

    await act(async () => {
      await result.current.onUserMessageCreated("ws-1", "thread-1", "title me");
    });

    const renamedTitle = renameThread.mock.calls[0]?.[2];
    expect(renamedTitle).toHaveLength(39);
    expect(renamedTitle.endsWith("…")).toBe(true);
  });

  it("skips generation for empty user text", async () => {
    const { result } = setup();

    await act(async () => {
      await result.current.onUserMessageCreated("ws-1", "thread-1", "");
    });

    expect(generateRunMetadata).not.toHaveBeenCalled();
  });

  it("skips rename when branch suggestion succeeds but title is absent", async () => {
    vi.mocked(generateRunMetadata).mockResolvedValue({
      title: "",
      worktreeName: "feat/suggested-branch",
    });
    const { result, renameThread } = setup();

    await act(async () => {
      await result.current.onUserMessageCreated("ws-1", "thread-1", "plan branch only");
    });

    expect(generateRunMetadata).toHaveBeenCalledWith("ws-1", "plan branch only");
    expect(renameThread).not.toHaveBeenCalled();
  });
});
