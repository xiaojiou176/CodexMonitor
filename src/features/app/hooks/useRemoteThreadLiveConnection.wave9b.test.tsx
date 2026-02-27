/* @vitest-environment jsdom */
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppServerEvent, WorkspaceInfo } from "../../../types";
import { useRemoteThreadLiveConnection } from "./useRemoteThreadLiveConnection";

const {
  listenMock,
  subscribeAppServerEventsMock,
  threadLiveSubscribeMock,
  threadLiveUnsubscribeMock,
} = vi.hoisted(() => ({
  listenMock: vi.fn(),
  subscribeAppServerEventsMock: vi.fn(),
  threadLiveSubscribeMock: vi.fn(),
  threadLiveUnsubscribeMock: vi.fn(),
}));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({
    listen: listenMock,
  }),
}));

vi.mock("../../../services/events", () => ({
  subscribeAppServerEvents: subscribeAppServerEventsMock,
}));

vi.mock("../../../services/tauri", () => ({
  threadLiveSubscribe: threadLiveSubscribeMock,
  threadLiveUnsubscribe: threadLiveUnsubscribeMock,
}));

function buildWorkspace(connected = true): WorkspaceInfo {
  return {
    id: "ws-1",
    name: "Workspace 1",
    path: "/tmp/ws-1",
    connected,
    settings: { sidebarCollapsed: false },
  };
}

async function flush() {
  await act(async () => {
    await new Promise<void>((resolve) => queueMicrotask(resolve));
  });
}

describe("useRemoteThreadLiveConnection wave-9b coverage", () => {
  const getAppServerEventHandler = () => {
    const latestCall = subscribeAppServerEventsMock.mock.calls.at(-1);
    if (!latestCall) {
      throw new Error("App server event handler was not registered");
    }
    return latestCall[0] as (event: AppServerEvent) => void;
  };

  const emitAppEvent = async (
    method: string,
    params: Record<string, unknown> = {},
    workspaceId = "ws-1",
  ) => {
    const handler = getAppServerEventHandler();
    await act(async () => {
      handler({
        workspace_id: workspaceId,
        message: {
          method,
          params,
        },
      });
    });
    await flush();
  };

  beforeEach(() => {
    vi.clearAllMocks();
    listenMock.mockResolvedValue(() => {});
    subscribeAppServerEventsMock.mockImplementation(
      (_handler: (event: AppServerEvent) => void) => () => {},
    );
    threadLiveSubscribeMock.mockResolvedValue(undefined);
    threadLiveUnsubscribeMock.mockResolvedValue(undefined);
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
  });

  it("keeps polling without subscribing when document is hidden", async () => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    const refreshThread = vi.fn().mockResolvedValue(undefined);

    const { result, unmount } = renderHook(() =>
      useRemoteThreadLiveConnection({
        backendMode: "remote",
        activeWorkspace: buildWorkspace(true),
        activeThreadId: "thread-1",
        refreshThread,
      }),
    );
    await flush();

    expect(result.current.connectionState).toBe("polling");
    expect(threadLiveSubscribeMock).not.toHaveBeenCalled();
    expect(refreshThread).not.toHaveBeenCalled();
    unmount();
  });

  it("reconnects on codex connected without rerunning resume refresh", async () => {
    const refreshThread = vi.fn().mockResolvedValue(undefined);

    renderHook(() =>
      useRemoteThreadLiveConnection({
        backendMode: "remote",
        activeWorkspace: buildWorkspace(true),
        activeThreadId: "thread-1",
        refreshThread,
      }),
    );
    await flush();

    refreshThread.mockClear();
    threadLiveSubscribeMock.mockClear();

    await emitAppEvent("codex/connected");
    expect(refreshThread).not.toHaveBeenCalled();
    expect(threadLiveSubscribeMock).toHaveBeenCalledWith("ws-1", "thread-1");
  });

  it("handles thread detach events and ignores non-matching activity", async () => {
    const refreshThread = vi.fn().mockResolvedValue(undefined);

    const { result } = renderHook(() =>
      useRemoteThreadLiveConnection({
        backendMode: "remote",
        activeWorkspace: buildWorkspace(true),
        activeThreadId: "thread-1",
        refreshThread,
      }),
    );
    await flush();
    await flush();
    refreshThread.mockClear();
    threadLiveSubscribeMock.mockClear();

    await emitAppEvent("thread/live_detached", { threadId: "thread-1" });
    expect(result.current.connectionState).toBe("polling");

    await emitAppEvent("item/started", { threadId: "thread-1" });
    expect(result.current.connectionState).toBe("polling");

    await emitAppEvent("item/started", { threadId: "thread-2" });
    expect(result.current.connectionState).toBe("polling");

    await emitAppEvent("thread/live_detached", { threadId: "thread-1" }, "ws-other");
    expect(result.current.connectionState).toBe("polling");
  });

  it("unsubscribes stale background thread subscriptions on rerender", async () => {
    const refreshThread = vi.fn().mockResolvedValue(undefined);

    const { rerender } = renderHook(
      ({ backgroundThreadIds }: { backgroundThreadIds: string[] }) =>
        useRemoteThreadLiveConnection({
          backendMode: "remote",
          activeWorkspace: buildWorkspace(true),
          activeThreadId: "thread-1",
          backgroundThreadIds,
          refreshThread,
        }),
      {
        initialProps: { backgroundThreadIds: ["thread-2", "thread-3"] },
      },
    );

    await flush();
    threadLiveUnsubscribeMock.mockClear();

    rerender({ backgroundThreadIds: ["thread-3"] });
    await flush();

    expect(threadLiveUnsubscribeMock).toHaveBeenCalledWith("ws-1", "thread-2");
    expect(threadLiveUnsubscribeMock).not.toHaveBeenCalledWith("ws-1", "thread-3");
  });

  it("ignores codex connected reconnect when document is hidden", async () => {
    const refreshThread = vi.fn().mockResolvedValue(undefined);

    renderHook(() =>
      useRemoteThreadLiveConnection({
        backendMode: "remote",
        activeWorkspace: buildWorkspace(true),
        activeThreadId: "thread-1",
        refreshThread,
      }),
    );

    await flush();
    threadLiveSubscribeMock.mockClear();
    refreshThread.mockClear();

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    await emitAppEvent("codex/connected");

    expect(threadLiveSubscribeMock).not.toHaveBeenCalled();
    expect(refreshThread).not.toHaveBeenCalled();
  });
});
