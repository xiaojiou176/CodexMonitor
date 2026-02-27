/* @vitest-environment jsdom */
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useUpdaterController } from "./useUpdaterController";

const {
  useUpdaterMock,
  useAgentSoundNotificationsMock,
  useAgentSystemNotificationsMock,
  useWindowFocusStateMock,
  useTauriEventMock,
  playNotificationSoundMock,
  subscribeUpdaterCheckMock,
  sendNotificationMock,
  checkForUpdatesMock,
  startUpdateMock,
  dismissMock,
} = vi.hoisted(() => ({
  useUpdaterMock: vi.fn(),
  useAgentSoundNotificationsMock: vi.fn(),
  useAgentSystemNotificationsMock: vi.fn(),
  useWindowFocusStateMock: vi.fn(),
  useTauriEventMock: vi.fn(),
  playNotificationSoundMock: vi.fn(),
  subscribeUpdaterCheckMock: vi.fn(),
  sendNotificationMock: vi.fn(),
  checkForUpdatesMock: vi.fn(),
  startUpdateMock: vi.fn(),
  dismissMock: vi.fn(),
}));

vi.mock("../../update/hooks/useUpdater", () => ({
  useUpdater: useUpdaterMock,
}));

vi.mock("../../notifications/hooks/useAgentSoundNotifications", () => ({
  useAgentSoundNotifications: useAgentSoundNotificationsMock,
}));

vi.mock("../../notifications/hooks/useAgentSystemNotifications", () => ({
  useAgentSystemNotifications: useAgentSystemNotificationsMock,
}));

vi.mock("../../layout/hooks/useWindowFocusState", () => ({
  useWindowFocusState: useWindowFocusStateMock,
}));

vi.mock("./useTauriEvent", () => ({
  useTauriEvent: useTauriEventMock,
}));

vi.mock("../../../utils/notificationSounds", () => ({
  playNotificationSound: playNotificationSoundMock,
}));

vi.mock("../../../services/events", () => ({
  subscribeUpdaterCheck: subscribeUpdaterCheckMock,
}));

vi.mock("../../../services/tauri", () => ({
  sendNotification: sendNotificationMock,
}));

describe("useUpdaterController", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    useUpdaterMock.mockReturnValue({
      state: { stage: "idle" },
      startUpdate: startUpdateMock,
      checkForUpdates: checkForUpdatesMock,
      dismiss: dismissMock,
    });
    useWindowFocusStateMock.mockReturnValue(false);
    sendNotificationMock.mockResolvedValue(undefined);

    subscribeUpdaterCheckMock.mockImplementation(
      (_handler: () => void, _options?: { onError?: (error: unknown) => void }) => () => {},
    );

    useTauriEventMock.mockImplementation(
      (
        subscribe: (handler: () => void) => () => void,
        handler: () => void,
        options?: { enabled?: boolean },
      ) => {
        if (options?.enabled === false) {
          return;
        }
        subscribe(() => {
          handler();
        });
      },
    );
  });

  it("wires updater hooks and handles updater-check menu events", () => {
    const onDebug = vi.fn();

    const { result } = renderHook(() =>
      useUpdaterController({
        notificationSoundsEnabled: true,
        systemNotificationsEnabled: true,
        onDebug,
        successSoundUrl: "success.mp3",
        errorSoundUrl: "error.mp3",
      }),
    );

    expect(useUpdaterMock).toHaveBeenCalledWith({ enabled: true, onDebug });
    expect(useAgentSoundNotificationsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: true,
        isWindowFocused: false,
        onDebug,
      }),
    );
    expect(useAgentSystemNotificationsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: true,
        isWindowFocused: false,
        onDebug,
      }),
    );
    expect(subscribeUpdaterCheckMock).toHaveBeenCalledTimes(1);
    const [updaterCheckHandler] = subscribeUpdaterCheckMock.mock.calls[0] ?? [];
    expect(updaterCheckHandler).toBeTypeOf("function");
    void updaterCheckHandler();
    expect(checkForUpdatesMock).toHaveBeenCalledWith({ announceNoUpdate: true });

    expect(result.current.startUpdate).toBe(startUpdateMock);
    expect(result.current.dismissUpdate).toBe(dismissMock);
  });

  it("logs updater menu subscription errors via onDebug", () => {
    const onDebug = vi.fn();
    subscribeUpdaterCheckMock.mockImplementation(
      (_handler: () => void, options?: { onError?: (error: unknown) => void }) => {
        options?.onError?.(new Error("menu-listener-failed"));
        return () => {};
      },
    );

    renderHook(() =>
      useUpdaterController({
        notificationSoundsEnabled: false,
        systemNotificationsEnabled: false,
        onDebug,
        successSoundUrl: "success.mp3",
        errorSoundUrl: "error.mp3",
      }),
    );

    expect(onDebug).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "error",
        label: "updater/menu-error",
        payload: "menu-listener-failed",
      }),
    );
  });

  it("toggles test notification sounds between success and error", () => {
    const onDebug = vi.fn();

    const { result } = renderHook(() =>
      useUpdaterController({
        notificationSoundsEnabled: true,
        systemNotificationsEnabled: false,
        onDebug,
        successSoundUrl: "success.mp3",
        errorSoundUrl: "error.mp3",
      }),
    );

    act(() => {
      result.current.handleTestNotificationSound();
      result.current.handleTestNotificationSound();
      result.current.handleTestNotificationSound();
    });

    expect(playNotificationSoundMock).toHaveBeenNthCalledWith(
      1,
      "success.mp3",
      "success",
      onDebug,
    );
    expect(playNotificationSoundMock).toHaveBeenNthCalledWith(
      2,
      "error.mp3",
      "error",
      onDebug,
    );
    expect(playNotificationSoundMock).toHaveBeenNthCalledWith(
      3,
      "success.mp3",
      "success",
      onDebug,
    );
  });

  it("sends or suppresses system test notifications based on settings", async () => {
    const onDebug = vi.fn();

    const { result, rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) =>
        useUpdaterController({
          notificationSoundsEnabled: false,
          systemNotificationsEnabled: enabled,
          onDebug,
          successSoundUrl: "success.mp3",
          errorSoundUrl: "error.mp3",
        }),
      {
        initialProps: { enabled: false },
      },
    );

    await act(async () => {
      await result.current.handleTestSystemNotification();
    });
    expect(sendNotificationMock).not.toHaveBeenCalled();

    rerender({ enabled: true });

    await act(async () => {
      await result.current.handleTestSystemNotification();
    });

    expect(sendNotificationMock).toHaveBeenCalledWith(
      "Test Notification",
      "This is a test notification from CodexMonitor.",
    );
  });

  it("logs system test notification errors", async () => {
    const onDebug = vi.fn();
    sendNotificationMock.mockRejectedValueOnce(new Error("notify failed"));

    const { result } = renderHook(() =>
      useUpdaterController({
        notificationSoundsEnabled: false,
        systemNotificationsEnabled: true,
        onDebug,
        successSoundUrl: "success.mp3",
        errorSoundUrl: "error.mp3",
      }),
    );

    await act(async () => {
      await result.current.handleTestSystemNotification();
      await Promise.resolve();
    });

    expect(onDebug).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "error",
        label: "notification/test-error",
        payload: "notify failed",
      }),
    );
  });
});
