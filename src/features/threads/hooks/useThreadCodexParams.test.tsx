// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  loadThreadCodexParams,
  saveThreadCodexParams,
  STORAGE_KEY_THREAD_CODEX_PARAMS,
} from "../utils/threadStorage";
import { useThreadCodexParams } from "./useThreadCodexParams";

vi.mock("../utils/threadStorage", () => ({
  STORAGE_KEY_THREAD_CODEX_PARAMS: "thread-codex-params",
  loadThreadCodexParams: vi.fn(),
  saveThreadCodexParams: vi.fn(),
  makeThreadCodexParamsKey: (workspaceId: string, threadId: string) =>
    `${workspaceId}:${threadId}`,
}));

describe("useThreadCodexParams", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(loadThreadCodexParams).mockReturnValue({});
  });

  it("sanitizes loaded entries and patches persisted state", () => {
    vi.mocked(loadThreadCodexParams).mockReturnValue({
      "ws-1:thread-1": {
        modelId: "gpt-5",
        effort: "high",
        accessMode: "invalid",
        collaborationModeId: 123,
        codexArgsOverride: 123,
        updatedAt: "now",
      },
    } as never);
    vi.spyOn(Date, "now").mockReturnValue(42_000);

    const { result } = renderHook(() => useThreadCodexParams());

    expect(result.current.getThreadCodexParams("ws-1", "thread-1")).toEqual({
      modelId: "gpt-5",
      effort: "high",
      accessMode: null,
      collaborationModeId: null,
      codexArgsOverride: null,
      updatedAt: 0,
    });

    act(() => {
      result.current.patchThreadCodexParams("ws-1", "thread-1", {
        codexArgsOverride: "--config /repo/.codex.toml",
        accessMode: "current",
      });
    });

    expect(saveThreadCodexParams).toHaveBeenCalledWith({
      "ws-1:thread-1": {
        modelId: "gpt-5",
        effort: "high",
        accessMode: "current",
        collaborationModeId: null,
        codexArgsOverride: "--config /repo/.codex.toml",
        updatedAt: 42000,
      },
    });
  });

  it("deletes existing entries and ignores missing keys", () => {
    vi.mocked(loadThreadCodexParams).mockReturnValue({
      "ws-1:thread-1": {
        modelId: null,
        effort: null,
        accessMode: null,
        collaborationModeId: null,
        codexArgsOverride: null,
        updatedAt: 1,
      },
    });

    const { result } = renderHook(() => useThreadCodexParams());

    act(() => {
      result.current.deleteThreadCodexParams("ws-1", "missing");
    });
    expect(saveThreadCodexParams).not.toHaveBeenCalled();

    act(() => {
      result.current.deleteThreadCodexParams("ws-1", "thread-1");
    });
    expect(saveThreadCodexParams).toHaveBeenCalledWith({});
  });

  it("refreshes state on matching storage event and ignores unrelated events", () => {
    vi.mocked(loadThreadCodexParams)
      .mockReturnValueOnce({})
      .mockReturnValueOnce({
        "ws-1:thread-1": {
          modelId: "gpt-5",
          effort: null,
          accessMode: "current",
          collaborationModeId: null,
          codexArgsOverride: undefined,
          updatedAt: 5,
        },
      } as never);

    const { result } = renderHook(() => useThreadCodexParams());

    expect(result.current.version).toBe(0);

    act(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: "other-key" }));
    });
    expect(result.current.version).toBe(0);

    act(() => {
      window.dispatchEvent(
        new StorageEvent("storage", { key: STORAGE_KEY_THREAD_CODEX_PARAMS }),
      );
    });

    expect(result.current.version).toBe(1);
    expect(result.current.getThreadCodexParams("ws-1", "thread-1")?.codexArgsOverride).toBe(
      undefined,
    );
  });

  it("sanitizes codexArgsOverride variants and returns null for invalid entries", () => {
    vi.mocked(loadThreadCodexParams).mockReturnValue({
      "ws-1:undefined-override": {
        modelId: "gpt-5",
        codexArgsOverride: undefined,
      },
      "ws-1:string-override": {
        modelId: "gpt-5",
        codexArgsOverride: "--profile safe",
      },
      "ws-1:missing-override": {
        modelId: "gpt-5",
      },
      "ws-1:invalid": "bad-entry",
    } as never);

    const { result } = renderHook(() => useThreadCodexParams());

    expect(result.current.getThreadCodexParams("ws-1", "undefined-override")).toEqual({
      modelId: "gpt-5",
      effort: null,
      accessMode: null,
      collaborationModeId: null,
      codexArgsOverride: undefined,
      updatedAt: 0,
    });
    expect(result.current.getThreadCodexParams("ws-1", "string-override")).toEqual({
      modelId: "gpt-5",
      effort: null,
      accessMode: null,
      collaborationModeId: null,
      codexArgsOverride: "--profile safe",
      updatedAt: 0,
    });
    expect(result.current.getThreadCodexParams("ws-1", "missing-override")).toEqual({
      modelId: "gpt-5",
      effort: null,
      accessMode: null,
      collaborationModeId: null,
      codexArgsOverride: undefined,
      updatedAt: 0,
    });
    expect(result.current.getThreadCodexParams("ws-1", "invalid")).toBeNull();
  });

  it("keeps valid accessMode and collaborationModeId values", () => {
    vi.mocked(loadThreadCodexParams).mockReturnValue({
      "ws-1:thread-1": {
        modelId: "gpt-5",
        effort: "medium",
        accessMode: "current",
        collaborationModeId: "collab-1",
        codexArgsOverride: null,
        updatedAt: 9,
      },
    } as never);

    const { result } = renderHook(() => useThreadCodexParams());

    expect(result.current.getThreadCodexParams("ws-1", "thread-1")).toEqual({
      modelId: "gpt-5",
      effort: "medium",
      accessMode: "current",
      collaborationModeId: "collab-1",
      codexArgsOverride: null,
      updatedAt: 9,
    });
  });

  it("falls back to defaults when patching over an invalid stored entry", () => {
    vi.mocked(loadThreadCodexParams).mockReturnValue({
      "ws-1:thread-1": "invalid-entry",
    } as never);
    vi.spyOn(Date, "now").mockReturnValue(777);

    const { result } = renderHook(() => useThreadCodexParams());

    act(() => {
      result.current.patchThreadCodexParams("ws-1", "thread-1", {
        modelId: "gpt-5-mini",
      });
    });

    expect(saveThreadCodexParams).toHaveBeenCalledWith({
      "ws-1:thread-1": {
        modelId: "gpt-5-mini",
        effort: null,
        accessMode: null,
        collaborationModeId: null,
        codexArgsOverride: null,
        updatedAt: 777,
      },
    });
  });

  it("removes storage listener on unmount", () => {
    const addSpy = vi.spyOn(window, "addEventListener");
    const removeSpy = vi.spyOn(window, "removeEventListener");

    const { unmount } = renderHook(() => useThreadCodexParams());
    const storageCall = addSpy.mock.calls.find((call) => call[0] === "storage");

    unmount();

    expect(storageCall?.[0]).toBe("storage");
    expect(storageCall?.[1]).toEqual(expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith("storage", storageCall?.[1]);
  });
});
