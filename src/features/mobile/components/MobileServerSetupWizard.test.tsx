// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { MobileServerSetupWizardProps } from "./MobileServerSetupWizard";
import { MobileServerSetupWizard } from "./MobileServerSetupWizard";

function buildProps(
  overrides: Partial<MobileServerSetupWizardProps> = {},
): MobileServerSetupWizardProps {
  return {
    provider: "tcp",
    remoteHostDraft: "desktop.tailnet.ts.net:4732",
    orbitWsUrlDraft: "",
    remoteTokenDraft: "seed-token",
    busy: false,
    checking: false,
    statusMessage: null,
    statusError: false,
    onProviderChange: vi.fn(),
    onRemoteHostChange: vi.fn(),
    onOrbitWsUrlChange: vi.fn(),
    onRemoteTokenChange: vi.fn(),
    onConnectTest: vi.fn(),
    ...overrides,
  };
}

describe("MobileServerSetupWizard", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders TCP step by default and switches to Orbit step", () => {
    const onProviderChange = vi.fn();
    const { rerender } = render(
      <MobileServerSetupWizard
        {...buildProps({
          provider: "tcp",
          onProviderChange,
        })}
      />,
    );

    expect(screen.getByLabelText("Tailscale host")).not.toBeNull();
    expect(screen.queryByLabelText("Orbit websocket URL")).toBeNull();
    expect(
      screen.getByText(
        "Use the Tailscale host from desktop Server settings and keep the desktop daemon running.",
      ),
    ).not.toBeNull();

    fireEvent.change(screen.getByLabelText("Connection type"), {
      target: { value: "orbit" },
    });
    expect(onProviderChange).toHaveBeenCalledWith("orbit");

    rerender(
      <MobileServerSetupWizard
        {...buildProps({
          provider: "orbit",
          orbitWsUrlDraft: "wss://orbit.example/ws",
          onProviderChange,
        })}
      />,
    );

    expect(screen.queryByLabelText("Tailscale host")).toBeNull();
    expect(screen.getByLabelText("Orbit websocket URL")).not.toBeNull();
    expect(
      screen.getByText("Use the Orbit websocket URL and token from desktop Server settings."),
    ).not.toBeNull();
  });

  it("disables controls and shows correct button label for busy/checking states", () => {
    const { rerender } = render(
      <MobileServerSetupWizard
        {...buildProps({
          busy: true,
          checking: false,
        })}
      />,
    );

    const connectButton = screen.getByRole("button", { name: "连接中..." });
    expect(connectButton.getAttribute("disabled")).not.toBeNull();
    expect(screen.getByLabelText("Connection type").getAttribute("disabled")).not.toBeNull();
    expect(screen.getByLabelText("Tailscale host").getAttribute("disabled")).not.toBeNull();
    expect(screen.getByLabelText("Remote backend token").getAttribute("disabled")).not.toBeNull();

    rerender(
      <MobileServerSetupWizard
        {...buildProps({
          busy: false,
          checking: true,
        })}
      />,
    );

    expect(screen.getByRole("button", { name: "检查中..." }).getAttribute("disabled")).not.toBeNull();
  });

  it("renders error status and triggers field/action callbacks", () => {
    const onRemoteHostChange = vi.fn();
    const onRemoteTokenChange = vi.fn();
    const onConnectTest = vi.fn();

    const { container } = render(
      <MobileServerSetupWizard
        {...buildProps({
          provider: "tcp",
          statusMessage: "backend offline",
          statusError: true,
          onRemoteHostChange,
          onRemoteTokenChange,
          onConnectTest,
        })}
      />,
    );

    fireEvent.change(screen.getByLabelText("Tailscale host"), {
      target: { value: "new.tailnet.ts.net:4732" },
    });
    fireEvent.change(screen.getByLabelText("Remote backend token"), {
      target: { value: "refreshed-token" },
    });
    fireEvent.click(screen.getByRole("button", { name: "连接并测试" }));

    expect(onRemoteHostChange).toHaveBeenCalledWith("new.tailnet.ts.net:4732");
    expect(onRemoteTokenChange).toHaveBeenCalledWith("refreshed-token");
    expect(onConnectTest).toHaveBeenCalledTimes(1);

    const status = screen.getByRole("status");
    expect(status.textContent).toContain("backend offline");
    const errorStatus = container.querySelector(
      ".mobile-setup-wizard-status.mobile-setup-wizard-status-error",
    );
    expect(errorStatus).not.toBeNull();
  });

  it("triggers orbit url callback in orbit step", () => {
    const onOrbitWsUrlChange = vi.fn();

    render(
      <MobileServerSetupWizard
        {...buildProps({
          provider: "orbit",
          orbitWsUrlDraft: "wss://old.example/ws",
          onOrbitWsUrlChange,
        })}
      />,
    );

    fireEvent.change(screen.getByLabelText("Orbit websocket URL"), {
      target: { value: "wss://new.example/ws" },
    });

    expect(onOrbitWsUrlChange).toHaveBeenCalledWith("wss://new.example/ws");
  });
});
