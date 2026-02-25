// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useRenameThreadPrompt } from "./useRenameThreadPrompt";

describe("useRenameThreadPrompt", () => {
  it("opens prompt with thread name and falls back to default label", () => {
    const renameThread = vi.fn();
    const { result } = renderHook(() =>
      useRenameThreadPrompt({
        threadsByWorkspace: {
          "ws-1": [{ id: "thread-1", name: "Alpha", updatedAt: 0 }],
        },
        renameThread,
      }),
    );

    act(() => {
      result.current.openRenamePrompt("ws-1", "thread-1");
    });
    expect(result.current.renamePrompt?.name).toBe("Alpha");

    act(() => {
      result.current.openRenamePrompt("ws-1", "unknown-thread");
    });
    expect(result.current.renamePrompt?.name).toBe("Thread");
  });

  it("confirms rename only when value is non-empty and changed", () => {
    const renameThread = vi.fn();
    const { result } = renderHook(() =>
      useRenameThreadPrompt({
        threadsByWorkspace: {
          "ws-1": [{ id: "thread-1", name: "Alpha", updatedAt: 0 }],
        },
        renameThread,
      }),
    );

    act(() => {
      result.current.openRenamePrompt("ws-1", "thread-1");
    });
    act(() => {
      result.current.handleRenamePromptChange("  Alpha ");
    });
    act(() => {
      result.current.handleRenamePromptConfirm();
    });
    expect(renameThread).not.toHaveBeenCalled();
    expect(result.current.renamePrompt).toBeNull();

    act(() => {
      result.current.openRenamePrompt("ws-1", "thread-1");
    });
    act(() => {
      result.current.handleRenamePromptChange("  Beta  ");
    });
    act(() => {
      result.current.handleRenamePromptConfirm();
    });

    expect(renameThread).toHaveBeenCalledWith("ws-1", "thread-1", "Beta");
    expect(result.current.renamePrompt).toBeNull();
  });

  it("does nothing when confirm/change happens without an active prompt and supports cancel", () => {
    const renameThread = vi.fn();
    const { result } = renderHook(() =>
      useRenameThreadPrompt({
        threadsByWorkspace: {},
        renameThread,
      }),
    );

    act(() => {
      result.current.handleRenamePromptChange("Beta");
      result.current.handleRenamePromptConfirm();
    });
    expect(renameThread).not.toHaveBeenCalled();

    act(() => {
      result.current.openRenamePrompt("ws-1", "thread-1");
      result.current.handleRenamePromptCancel();
    });
    expect(result.current.renamePrompt).toBeNull();
  });
});
