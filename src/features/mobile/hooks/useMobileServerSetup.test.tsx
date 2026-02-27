// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listWorkspaces } from "../../../services/tauri";
import type { AppSettings } from "../../../types";
import { isMobilePlatform } from "../../../utils/platformPaths";
import { useMobileServerSetup } from "./useMobileServerSetup";

vi.mock("../../../services/tauri", () => ({
  listWorkspaces: vi.fn(),
}));

vi.mock("../../../utils/platformPaths", () => ({
  isMobilePlatform: vi.fn(),
}));

const listWorkspacesMock = vi.mocked(listWorkspaces);
const isMobilePlatformMock = vi.mocked(isMobilePlatform);

function buildSettings(overrides: Partial<AppSettings> = {}): AppSettings {
  return {
    remoteBackendProvider: "tcp",
    remoteBackendHost: "",
    remoteBackendToken: null,
    orbitWsUrl: null,
    ...overrides,
  } as AppSettings;
}

describe("useMobileServerSetup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isMobilePlatformMock.mockReturnValue(true);
    listWorkspacesMock.mockResolvedValue([]);
  });

  afterEach(() => {
    cleanup();
  });

  it("reports successful connectivity and hides wizard when backend is configured", async () => {
    const queueSaveSettings = vi.fn();
    const refreshWorkspaces = vi.fn().mockResolvedValue(undefined);

    const { result } = renderHook(() =>
      useMobileServerSetup({
        appSettings: buildSettings({
          remoteBackendHost: "desktop.tailnet.ts.net:4732",
          remoteBackendToken: "token",
        }),
        appSettingsLoading: false,
        queueSaveSettings,
        refreshWorkspaces,
      }),
    );

    await waitFor(() => {
      expect(result.current.showMobileSetupWizard).toBe(false);
    });

    expect(result.current.mobileSetupWizardProps.statusMessage).toBeNull();
    expect(result.current.mobileSetupWizardProps.statusError).toBe(false);
    expect(listWorkspacesMock).toHaveBeenCalled();
    expect(refreshWorkspaces).toHaveBeenCalled();
    expect(queueSaveSettings).not.toHaveBeenCalled();
  });

  it("shows connectivity failure when configured backend cannot be reached", async () => {
    listWorkspacesMock.mockRejectedValue(new Error("backend offline"));
    const queueSaveSettings = vi.fn();
    const refreshWorkspaces = vi.fn().mockResolvedValue(undefined);

    const { result } = renderHook(() =>
      useMobileServerSetup({
        appSettings: buildSettings({
          remoteBackendHost: "desktop.tailnet.ts.net:4732",
          remoteBackendToken: "old-token",
        }),
        appSettingsLoading: false,
        queueSaveSettings,
        refreshWorkspaces,
      }),
    );

    await waitFor(() => {
      expect(result.current.showMobileSetupWizard).toBe(true);
      expect(result.current.mobileSetupWizardProps.statusError).toBe(true);
      expect(result.current.mobileSetupWizardProps.statusMessage).toBe("backend offline");
    });
    expect(queueSaveSettings).not.toHaveBeenCalled();
  });

  it("supports retry from boundary-input failure to successful connect test", async () => {
    const queueSaveSettings = vi.fn().mockImplementation(async (next) => next);
    const refreshWorkspaces = vi.fn().mockResolvedValue(undefined);
    listWorkspacesMock.mockResolvedValue([{ id: "ws-1" }]);

    const { result } = renderHook(() =>
      useMobileServerSetup({
        appSettings: buildSettings({
          remoteBackendProvider: "tcp",
          remoteBackendHost: "desktop.tailnet.ts.net:4732",
          remoteBackendToken: "seed-token",
        }),
        appSettingsLoading: true,
        queueSaveSettings,
        refreshWorkspaces,
      }),
    );

    await act(async () => {
      result.current.mobileSetupWizardProps.onRemoteHostChange("   ");
      result.current.mobileSetupWizardProps.onRemoteTokenChange("   ");
    });
    await act(async () => {
      result.current.mobileSetupWizardProps.onConnectTest();
    });

    await waitFor(() => {
      expect(result.current.mobileSetupWizardProps.statusError).toBe(true);
    });

    expect(result.current.mobileSetupWizardProps.statusMessage).toBe(
      "Enter your desktop Tailscale host and token, then run Connect & test.",
    );
    expect(queueSaveSettings).not.toHaveBeenCalled();

    await act(async () => {
      result.current.mobileSetupWizardProps.onRemoteHostChange("  desktop.tailnet.ts.net:4732  ");
      result.current.mobileSetupWizardProps.onRemoteTokenChange("  refreshed-token  ");
    });
    await act(async () => {
      result.current.mobileSetupWizardProps.onConnectTest();
    });

    expect(queueSaveSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        backendMode: "remote",
        remoteBackendProvider: "tcp",
        remoteBackendHost: "desktop.tailnet.ts.net:4732",
        remoteBackendToken: "refreshed-token",
      }),
    );
    expect(result.current.mobileSetupWizardProps.statusError).toBe(false);
    expect(result.current.mobileSetupWizardProps.statusMessage).toBe(
      "Connected. 1 workspace available from your desktop backend.",
    );
    expect(refreshWorkspaces).toHaveBeenCalled();
  });

  it("surfaces save/connect failures as status errors", async () => {
    const queueSaveSettings = vi.fn().mockRejectedValue(new Error("save failed"));
    const refreshWorkspaces = vi.fn().mockResolvedValue(undefined);

    const { result } = renderHook(() =>
      useMobileServerSetup({
        appSettings: buildSettings({
          remoteBackendHost: "desktop.tailnet.ts.net:4732",
          remoteBackendToken: "token",
        }),
        appSettingsLoading: true,
        queueSaveSettings,
        refreshWorkspaces,
      }),
    );

    await act(async () => {
      result.current.mobileSetupWizardProps.onConnectTest();
    });

    await waitFor(() => {
      expect(result.current.mobileSetupWizardProps.statusError).toBe(true);
      expect(result.current.mobileSetupWizardProps.statusMessage).toBe("save failed");
    });

    expect(refreshWorkspaces).not.toHaveBeenCalled();
  });

  it("short-circuits on non-mobile runtime", async () => {
    isMobilePlatformMock.mockReturnValue(false);
    const queueSaveSettings = vi.fn();
    const refreshWorkspaces = vi.fn();

    const { result } = renderHook(() =>
      useMobileServerSetup({
        appSettings: buildSettings({
          remoteBackendHost: "desktop.tailnet.ts.net:4732",
          remoteBackendToken: "token",
        }),
        appSettingsLoading: false,
        queueSaveSettings,
        refreshWorkspaces,
      }),
    );

    expect(result.current.isMobileRuntime).toBe(false);
    expect(result.current.showMobileSetupWizard).toBe(false);
    expect(listWorkspacesMock).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.handleMobileConnectSuccess();
    });

    expect(refreshWorkspaces).not.toHaveBeenCalled();
    expect(queueSaveSettings).not.toHaveBeenCalled();
  });
});
