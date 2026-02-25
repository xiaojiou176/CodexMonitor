// @vitest-environment jsdom
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getAccountInfo } from "../../../services/tauri";
import { useThreadAccountInfo } from "./useThreadAccountInfo";

vi.mock("../../../services/tauri", () => ({
  getAccountInfo: vi.fn(),
}));

describe("useThreadAccountInfo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("refreshes account info on connect and dispatches snapshot", async () => {
    vi.mocked(getAccountInfo).mockResolvedValue({
      result: {
        account: { type: "chatgpt", email: "user@example.com", planType: "pro" },
        requiresOpenaiAuth: false,
      },
    });

    const dispatch = vi.fn();

    renderHook(() =>
      useThreadAccountInfo({
        activeWorkspaceId: "ws-1",
        activeWorkspaceConnected: true,
        dispatch,
      }),
    );

    await waitFor(() => {
      expect(getAccountInfo).toHaveBeenCalledWith("ws-1");
    });

    expect(dispatch).toHaveBeenCalledWith({
      type: "setAccountInfo",
      workspaceId: "ws-1",
      account: {
        type: "chatgpt",
        email: "user@example.com",
        planType: "pro",
        requiresOpenaiAuth: false,
      },
    });
  });

  it("normalizes snake_case auth flags and invalid account payloads", async () => {
    vi.mocked(getAccountInfo).mockResolvedValue({
      result: {
        requires_openai_auth: true,
      },
    });

    const dispatch = vi.fn();

    renderHook(() =>
      useThreadAccountInfo({
        activeWorkspaceId: "ws-1",
        activeWorkspaceConnected: true,
        dispatch,
      }),
    );

    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith({
        type: "setAccountInfo",
        workspaceId: "ws-1",
        account: {
          type: "unknown",
          email: null,
          planType: null,
          requiresOpenaiAuth: true,
        },
      });
    });
  });

  it("normalizes top-level account fields, trims blanks, and keeps unknown auth as null", async () => {
    vi.mocked(getAccountInfo).mockResolvedValue({
      account: { type: "APIKEY", email: "   ", planType: "   " },
      requiresOpenaiAuth: "unknown",
    } as unknown as Awaited<ReturnType<typeof getAccountInfo>>);

    const dispatch = vi.fn();

    renderHook(() =>
      useThreadAccountInfo({
        activeWorkspaceId: "ws-1",
        activeWorkspaceConnected: true,
        dispatch,
      }),
    );

    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith({
        type: "setAccountInfo",
        workspaceId: "ws-1",
        account: {
          type: "apikey",
          email: null,
          planType: null,
          requiresOpenaiAuth: null,
        },
      });
    });
  });

  it("does nothing when no workspace id is available", async () => {
    const dispatch = vi.fn();

    const { result } = renderHook(() =>
      useThreadAccountInfo({
        activeWorkspaceId: null,
        activeWorkspaceConnected: true,
        dispatch,
      }),
    );

    await result.current.refreshAccountInfo();

    expect(getAccountInfo).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("reports fetch failures through debug logger without dispatching", async () => {
    vi.mocked(getAccountInfo).mockRejectedValueOnce(new Error("network down"));
    const dispatch = vi.fn();
    const onDebug = vi.fn();

    renderHook(() =>
      useThreadAccountInfo({
        activeWorkspaceId: "ws-1",
        activeWorkspaceConnected: true,
        dispatch,
        onDebug,
      }),
    );

    await waitFor(() => {
      expect(onDebug).toHaveBeenCalledWith(
        expect.objectContaining({
          source: "error",
          label: "account/read error",
          payload: "network down",
        }),
      );
    });

    expect(dispatch).not.toHaveBeenCalled();
  });

  it("logs non-Error failures with stringified payload", async () => {
    vi.mocked(getAccountInfo).mockRejectedValueOnce("service unavailable");
    const dispatch = vi.fn();
    const onDebug = vi.fn();

    renderHook(() =>
      useThreadAccountInfo({
        activeWorkspaceId: "ws-1",
        activeWorkspaceConnected: true,
        dispatch,
        onDebug,
      }),
    );

    await waitFor(() => {
      expect(onDebug).toHaveBeenCalledWith(
        expect.objectContaining({
          source: "error",
          label: "account/read error",
          payload: "service unavailable",
        }),
      );
    });
    expect(dispatch).not.toHaveBeenCalled();
  });
});
