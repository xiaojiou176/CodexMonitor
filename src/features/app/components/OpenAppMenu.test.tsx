// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OPEN_APP_STORAGE_KEY } from "../constants";
import { OpenAppMenu } from "./OpenAppMenu";

const revealItemInDirMock = vi.hoisted(() => vi.fn());
const openWorkspaceInMock = vi.hoisted(() => vi.fn());
const captureExceptionMock = vi.hoisted(() => vi.fn());
const pushErrorToastMock = vi.hoisted(() => vi.fn());

vi.mock("@tauri-apps/plugin-opener", () => ({
  revealItemInDir: (...args: unknown[]) => revealItemInDirMock(...args),
}));

vi.mock("../../../services/tauri", () => ({
  openWorkspaceIn: (...args: unknown[]) => openWorkspaceInMock(...args),
}));

vi.mock("@sentry/react", () => ({
  captureException: (...args: unknown[]) => captureExceptionMock(...args),
}));

vi.mock("../../../services/toasts", () => ({
  pushErrorToast: (...args: unknown[]) => pushErrorToastMock(...args),
}));

const BASE_PATH = "/tmp/codex-monitor";

const BASE_TARGETS = [
  {
    id: "vscode",
    label: "VS Code",
    kind: "app" as const,
    appName: "Visual Studio Code",
    args: ["--reuse-window"],
  },
  {
    id: "cli",
    label: "CLI",
    kind: "command" as const,
    command: "code",
    args: ["--new-window"],
  },
  {
    id: "finder",
    label: "Finder",
    kind: "finder" as const,
    args: [],
  },
];

function renderMenu(props?: Partial<ComponentProps<typeof OpenAppMenu>>) {
  const onSelectOpenAppId = vi.fn();
  render(
    <OpenAppMenu
      path={BASE_PATH}
      openTargets={BASE_TARGETS}
      selectedOpenAppId="vscode"
      onSelectOpenAppId={onSelectOpenAppId}
      {...props}
    />,
  );
  return { onSelectOpenAppId };
}

describe("OpenAppMenu", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    openWorkspaceInMock.mockResolvedValue(undefined);
    revealItemInDirMock.mockResolvedValue(undefined);
    pushErrorToastMock.mockReturnValue("toast-id");
  });

  afterEach(() => {
    cleanup();
  });

  it("renders dropdown options and highlights current selection", () => {
    renderMenu();

    fireEvent.click(screen.getByRole("button", { name: "选择编辑器" }));

    expect(screen.getByRole("menu")).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "VS Code" }).className).toContain("is-active");
    expect(screen.getByRole("menuitem", { name: "CLI" })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "Finder" })).toBeTruthy();
  });

  it("opens workspace with currently selected app target", async () => {
    renderMenu({ selectedOpenAppId: "vscode" });

    fireEvent.click(screen.getByRole("button", { name: "在 VS Code 中打开" }));

    await waitFor(() => {
      expect(openWorkspaceInMock).toHaveBeenCalledWith(BASE_PATH, {
        appName: "Visual Studio Code",
        args: ["--reuse-window"],
      });
    });
  });

  it("selects command target, persists selection, and invokes callback", async () => {
    const { onSelectOpenAppId } = renderMenu();

    fireEvent.click(screen.getByRole("button", { name: "选择编辑器" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "CLI" }));

    await waitFor(() => {
      expect(onSelectOpenAppId).toHaveBeenCalledWith("cli");
      expect(openWorkspaceInMock).toHaveBeenCalledWith(BASE_PATH, {
        command: "code",
        args: ["--new-window"],
      });
    });

    expect(window.localStorage.getItem(OPEN_APP_STORAGE_KEY)).toBe("cli");
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("disables primary action and menu item for empty command target", () => {
    const disabledTargets = [
      {
        id: "broken-command",
        label: "Broken Command",
        kind: "command" as const,
        command: "   ",
        args: [],
      },
      BASE_TARGETS[0],
    ];
    const { onSelectOpenAppId } = renderMenu({
      openTargets: disabledTargets,
      selectedOpenAppId: "broken-command",
    });

    const openButton = screen.getByRole("button", { name: "在 Broken Command 中打开" });
    expect(openButton.getAttribute("disabled")).not.toBeNull();
    expect(openButton.getAttribute("title")).toBe("请先在设置中配置命令");

    fireEvent.click(openButton);
    expect(openWorkspaceInMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "选择编辑器" }));
    const disabledItem = screen.getByRole("menuitem", { name: "Broken Command" });
    expect(disabledItem.getAttribute("disabled")).not.toBeNull();

    fireEvent.click(disabledItem);
    expect(onSelectOpenAppId).not.toHaveBeenCalled();
  });

  it("opens finder target via revealItemInDir", async () => {
    renderMenu({ selectedOpenAppId: "finder" });

    fireEvent.click(screen.getByRole("button", { name: "在 Finder 中打开" }));

    await waitFor(() => {
      expect(revealItemInDirMock).toHaveBeenCalledWith(BASE_PATH);
    });
    expect(openWorkspaceInMock).not.toHaveBeenCalled();
  });

  it("falls back to default targets when openTargets is empty", () => {
    renderMenu({ openTargets: [] });

    fireEvent.click(screen.getByRole("button", { name: "选择编辑器" }));
    const items = screen.getAllByRole("menuitem");
    expect(items.length).toBeGreaterThan(0);
  });

  it("shows app-name guidance when app target is missing appName", () => {
    const missingAppNameTargets = [
      {
        id: "broken-app",
        label: "Broken App",
        kind: "app" as const,
        appName: "   ",
        args: [],
      },
      BASE_TARGETS[0],
    ];
    renderMenu({
      openTargets: missingAppNameTargets,
      selectedOpenAppId: "broken-app",
    });

    const openButton = screen.getByRole("button", { name: "在 Broken App 中打开" });
    expect(openButton.getAttribute("disabled")).not.toBeNull();
    expect(openButton.getAttribute("title")).toBe("请先在设置中配置应用名称");
  });

  it("reports errors to sentry and toast when opening fails", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    openWorkspaceInMock.mockRejectedValue("open failed");
    renderMenu({ selectedOpenAppId: "vscode" });

    fireEvent.click(screen.getByRole("button", { name: "在 VS Code 中打开" }));

    await waitFor(() => {
      expect(captureExceptionMock).toHaveBeenCalledTimes(1);
      expect(pushErrorToastMock).toHaveBeenCalledWith({
        title: "无法打开工作区",
        message: "open failed",
      });
    });

    const [capturedError, capturedContext] = captureExceptionMock.mock.calls[0] as [
      Error,
      Record<string, unknown>,
    ];
    expect(capturedError).toBeInstanceOf(Error);
    expect(capturedError.message).toBe("open failed");
    expect(capturedContext).toMatchObject({
      tags: { feature: "open-app-menu" },
      extra: {
        path: BASE_PATH,
        targetId: "vscode",
      },
    });

    warnSpy.mockRestore();
  });

  it("reports error instance directly when opening fails", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const failure = new Error("instance failure");
    openWorkspaceInMock.mockRejectedValue(failure);
    renderMenu({ selectedOpenAppId: "vscode" });

    fireEvent.click(screen.getByRole("button", { name: "在 VS Code 中打开" }));

    await waitFor(() => {
      expect(captureExceptionMock).toHaveBeenCalledWith(
        failure,
        expect.objectContaining({
          tags: { feature: "open-app-menu" },
        }),
      );
    });

    warnSpy.mockRestore();
  });
});
