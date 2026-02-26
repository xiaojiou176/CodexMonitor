// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getAccountRateLimits } from "../../../services/tauri";
import { normalizeRateLimits } from "../utils/threadNormalize";
import { useThreadRateLimits } from "./useThreadRateLimits";

vi.mock("../../../services/tauri", () => ({
  getAccountRateLimits: vi.fn(),
}));

describe("useThreadRateLimits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("refreshes rate limits on connect and dispatches normalized data", async () => {
    const dispatch = vi.fn();
    const onDebug = vi.fn();
    const rawRateLimits = {
      primary: {
        used_percent: "25",
        window_duration_mins: 60,
        resets_at: 12345,
      },
    };

    vi.mocked(getAccountRateLimits).mockResolvedValue({
      result: { rate_limits: rawRateLimits },
    });

    renderHook(() =>
      useThreadRateLimits({
        activeWorkspaceId: "ws-1",
        activeWorkspaceConnected: true,
        dispatch,
        onDebug,
      }),
    );

    await waitFor(() => {
      expect(getAccountRateLimits).toHaveBeenCalledWith("ws-1");
    });

    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith({
        type: "setRateLimits",
        workspaceId: "ws-1",
        rateLimits: normalizeRateLimits(rawRateLimits),
      });
    });

    expect(onDebug).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "client",
        label: "account/rateLimits/read",
        payload: { workspaceId: "ws-1" },
      }),
    );
    expect(onDebug).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "server",
        label: "account/rateLimits/read response",
        payload: { result: { rate_limits: rawRateLimits } },
      }),
    );
  });

  it("allows manual refresh with an explicit workspace id", async () => {
    const dispatch = vi.fn();
    const rawRateLimits = {
      primary: { usedPercent: 10, windowDurationMins: 30, resetsAt: 777 },
    };

    vi.mocked(getAccountRateLimits).mockResolvedValue({
      rateLimits: rawRateLimits,
    });

    const { result } = renderHook(() =>
      useThreadRateLimits({
        activeWorkspaceId: "ws-1",
        activeWorkspaceConnected: false,
        dispatch,
      }),
    );

    await act(async () => {
      await result.current.refreshAccountRateLimits("ws-2");
    });

    expect(getAccountRateLimits).toHaveBeenCalledWith("ws-2");
    expect(dispatch).toHaveBeenCalledWith({
      type: "setRateLimits",
      workspaceId: "ws-2",
      rateLimits: normalizeRateLimits(rawRateLimits),
    });
  });

  it("does not auto-refresh again when accessor callback identity changes", async () => {
    const dispatch = vi.fn();

    vi.mocked(getAccountRateLimits).mockResolvedValue({
      result: { rate_limits: {} },
    });

    const { rerender } = renderHook(
      ({
        getCurrentRateLimits,
      }: {
        getCurrentRateLimits: (workspaceId: string) => null;
      }) =>
        useThreadRateLimits({
          activeWorkspaceId: "ws-1",
          activeWorkspaceConnected: true,
          dispatch,
          getCurrentRateLimits,
        }),
      {
        initialProps: {
          getCurrentRateLimits: () => null,
        },
      },
    );

    await waitFor(() => {
      expect(getAccountRateLimits).toHaveBeenCalledTimes(1);
    });

    rerender({
      getCurrentRateLimits: () => null,
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(getAccountRateLimits).toHaveBeenCalledTimes(1);
  });

  it("reports errors via debug callback without dispatching", async () => {
    const dispatch = vi.fn();
    const onDebug = vi.fn();

    vi.mocked(getAccountRateLimits).mockRejectedValue(new Error("Nope"));

    const { result } = renderHook(() =>
      useThreadRateLimits({
        activeWorkspaceId: "ws-1",
        dispatch,
        onDebug,
      }),
    );

    await act(async () => {
      await result.current.refreshAccountRateLimits();
    });

    expect(dispatch).not.toHaveBeenCalled();
    expect(onDebug).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "error",
        label: "account/rateLimits/read error",
        payload: "Nope",
      }),
    );
  });

  it("returns early when neither explicit workspace id nor active workspace id exists", async () => {
    const dispatch = vi.fn();
    const onDebug = vi.fn();
    const { result } = renderHook(() =>
      useThreadRateLimits({
        activeWorkspaceId: null,
        dispatch,
        onDebug,
      }),
    );

    await act(async () => {
      await result.current.refreshAccountRateLimits();
    });

    expect(getAccountRateLimits).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
    expect(onDebug).not.toHaveBeenCalled();
  });

  it("does not dispatch when payload has no rate limits object", async () => {
    const dispatch = vi.fn();
    vi.mocked(getAccountRateLimits).mockResolvedValue({
      result: { note: "no limits" },
    } as unknown as Awaited<ReturnType<typeof getAccountRateLimits>>);

    const { result } = renderHook(() =>
      useThreadRateLimits({
        activeWorkspaceId: "ws-1",
        dispatch,
      }),
    );

    await act(async () => {
      await result.current.refreshAccountRateLimits();
    });

    expect(getAccountRateLimits).toHaveBeenCalledWith("ws-1");
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("stringifies non-Error failures in debug payload", async () => {
    const dispatch = vi.fn();
    const onDebug = vi.fn();
    vi.mocked(getAccountRateLimits).mockRejectedValue("network-down");

    const { result } = renderHook(() =>
      useThreadRateLimits({
        activeWorkspaceId: "ws-1",
        dispatch,
        onDebug,
      }),
    );

    await act(async () => {
      await result.current.refreshAccountRateLimits();
    });

    expect(dispatch).not.toHaveBeenCalled();
    expect(onDebug).toHaveBeenCalledWith(
      expect.objectContaining({
        label: "account/rateLimits/read error",
        payload: "network-down",
      }),
    );
  });

  it("merges partial payloads with previous workspace rate limits", async () => {
    const dispatch = vi.fn();
    const previousRateLimits = {
      primary: {
        usedPercent: 42,
        windowDurationMins: 60,
        resetsAt: 12345,
      },
      secondary: {
        usedPercent: 70,
        windowDurationMins: 10080,
        resetsAt: 99999,
      },
      credits: {
        hasCredits: true,
        unlimited: false,
        balance: "5",
      },
      planType: "pro",
    } as const;

    vi.mocked(getAccountRateLimits).mockResolvedValue({
      result: {
        rate_limits: {
          primary: { resets_at: 88888 },
          secondary: {},
        },
      },
    });

    const { result } = renderHook(() =>
      useThreadRateLimits({
        activeWorkspaceId: "ws-1",
        dispatch,
        getCurrentRateLimits: () => previousRateLimits,
      }),
    );

    await act(async () => {
      await result.current.refreshAccountRateLimits();
    });

    expect(dispatch).toHaveBeenCalledWith({
      type: "setRateLimits",
      workspaceId: "ws-1",
      rateLimits: {
        primary: {
          usedPercent: 42,
          windowDurationMins: 60,
          resetsAt: 88888,
        },
        secondary: {
          usedPercent: 70,
          windowDurationMins: 10080,
          resetsAt: 99999,
        },
        credits: {
          hasCredits: true,
          unlimited: false,
          balance: "5",
        },
        planType: "pro",
      },
    });
  });
});
