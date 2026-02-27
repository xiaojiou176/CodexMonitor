// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NO_THREAD_SCOPE_SUFFIX } from "../../threads/utils/threadCodexParamsSeed";
import { useThreadCodexOrchestration } from "./useThreadCodexOrchestration";

const mockUseThreadCodexParams = vi.hoisted(() => vi.fn());

vi.mock("../../threads/hooks/useThreadCodexParams", () => ({
  useThreadCodexParams: (...args: unknown[]) => mockUseThreadCodexParams(...args),
}));

describe("useThreadCodexOrchestration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseThreadCodexParams.mockReturnValue({
      version: 7,
      getThreadCodexParams: vi.fn(),
      patchThreadCodexParams: vi.fn(),
    });
  });

  it("returns initial orchestration state and refs", () => {
    const activeWorkspaceIdForParamsRef = { current: "ws-1" as string | null };
    const { result } = renderHook(() =>
      useThreadCodexOrchestration({ activeWorkspaceIdForParamsRef }),
    );

    expect(result.current.accessMode).toBe("current");
    expect(result.current.preferredModelId).toBeNull();
    expect(result.current.preferredEffort).toBeNull();
    expect(result.current.preferredCollabModeId).toBeNull();
    expect(result.current.preferredCodexArgsOverride).toBeNull();
    expect(result.current.threadCodexSelectionKey).toBeNull();
    expect(result.current.threadCodexParamsVersion).toBe(7);
    expect(result.current.activeThreadIdRef.current).toBeNull();
    expect(result.current.pendingNewThreadSeedRef.current).toBeNull();
  });

  it("persists with no-thread suffix when active thread id is absent", () => {
    const patchThreadCodexParams = vi.fn();
    mockUseThreadCodexParams.mockReturnValue({
      version: 1,
      getThreadCodexParams: vi.fn(),
      patchThreadCodexParams,
    });
    const activeWorkspaceIdForParamsRef = { current: "ws-9" as string | null };

    const { result } = renderHook(() =>
      useThreadCodexOrchestration({ activeWorkspaceIdForParamsRef }),
    );

    act(() => {
      result.current.persistThreadCodexParams({ modelId: "gpt-5" });
    });

    expect(patchThreadCodexParams).toHaveBeenCalledWith("ws-9", NO_THREAD_SCOPE_SUFFIX, {
      modelId: "gpt-5",
    });
  });

  it("persists using active thread id when present", () => {
    const patchThreadCodexParams = vi.fn();
    mockUseThreadCodexParams.mockReturnValue({
      version: 1,
      getThreadCodexParams: vi.fn(),
      patchThreadCodexParams,
    });
    const activeWorkspaceIdForParamsRef = { current: "ws-2" as string | null };

    const { result } = renderHook(() =>
      useThreadCodexOrchestration({ activeWorkspaceIdForParamsRef }),
    );

    act(() => {
      result.current.activeThreadIdRef.current = "thread-22";
      result.current.persistThreadCodexParams({ effort: "high" });
    });

    expect(patchThreadCodexParams).toHaveBeenCalledWith("ws-2", "thread-22", {
      effort: "high",
    });
  });

  it("skips persisting when workspace id is missing", () => {
    const patchThreadCodexParams = vi.fn();
    mockUseThreadCodexParams.mockReturnValue({
      version: 1,
      getThreadCodexParams: vi.fn(),
      patchThreadCodexParams,
    });
    const activeWorkspaceIdForParamsRef = { current: null as string | null };

    const { result } = renderHook(() =>
      useThreadCodexOrchestration({ activeWorkspaceIdForParamsRef }),
    );

    act(() => {
      result.current.persistThreadCodexParams({ collaborationModeId: "pair" });
    });

    expect(patchThreadCodexParams).not.toHaveBeenCalled();
  });
});
