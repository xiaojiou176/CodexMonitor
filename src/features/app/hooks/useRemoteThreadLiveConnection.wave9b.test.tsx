/* @vitest-environment jsdom */
import "./useRemoteThreadLiveConnection.test";
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
  beforeEach(() => {
    vi.clearAllMocks();
    listenMock.mockResolvedValue(() => {});
    subscribeAppServerEventsMock.mockImplementation((_handler: (event: AppServerEvent) => void) => () => {});
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
});
