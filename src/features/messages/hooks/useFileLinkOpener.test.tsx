// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { OpenAppTarget } from "../../../types";
import { useFileLinkOpener } from "./useFileLinkOpener";

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

vi.mock("@tauri-apps/api/menu", () => ({
  Menu: { new: vi.fn() },
  MenuItem: { new: vi.fn() },
  PredefinedMenuItem: { new: vi.fn() },
}));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: vi.fn(() => ({ scaleFactor: () => 1 })),
}));

vi.mock("@tauri-apps/api/dpi", () => ({
  LogicalPosition: class LogicalPosition {
    x: number;
    y: number;

    constructor(x: number, y: number) {
      this.x = x;
      this.y = y;
    }
  },
}));

describe("useFileLinkOpener", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    openWorkspaceInMock.mockResolvedValue(undefined);
    revealItemInDirMock.mockResolvedValue(undefined);
  });

  it("resolves relative path with line suffix and opens selected app target", async () => {
    const openTargets: OpenAppTarget[] = [
      {
        id: "vscode",
        label: "VS Code",
        kind: "app",
        appName: "Visual Studio Code",
        args: ["--reuse-window"],
      },
    ];

    const { result } = renderHook(() => useFileLinkOpener("/workspace", openTargets, "vscode"));

    await act(async () => {
      await result.current.openFileLink("src/main.ts:12:8");
    });

    expect(openWorkspaceInMock).toHaveBeenCalledWith("/workspace/src/main.ts", {
      appName: "Visual Studio Code",
      args: ["--reuse-window"],
    });
    expect(revealItemInDirMock).not.toHaveBeenCalled();
  });

  it("falls back to first target when selected target id is missing", async () => {
    const openTargets: OpenAppTarget[] = [
      {
        id: "cli",
        label: "CLI",
        kind: "command",
        command: "code",
        args: ["--new-window"],
      },
    ];

    const { result } = renderHook(() => useFileLinkOpener(null, openTargets, "missing-target"));

    await act(async () => {
      await result.current.openFileLink("docs/readme.md:7");
    });

    expect(openWorkspaceInMock).toHaveBeenCalledWith("docs/readme.md", {
      command: "code",
      args: ["--new-window"],
    });
  });

  it("uses revealItemInDir for finder target and strips line suffix", async () => {
    const openTargets: OpenAppTarget[] = [
      {
        id: "finder",
        label: "Finder",
        kind: "finder",
        args: [],
      },
    ];

    const { result } = renderHook(() => useFileLinkOpener("/workspace", openTargets, "finder"));

    await act(async () => {
      await result.current.openFileLink("/tmp/report.log:99");
    });

    expect(revealItemInDirMock).toHaveBeenCalledWith("/tmp/report.log");
    expect(openWorkspaceInMock).not.toHaveBeenCalled();
  });

  it("reports errors when opening fails", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    openWorkspaceInMock.mockRejectedValue("open failed");

    const openTargets: OpenAppTarget[] = [
      {
        id: "vscode",
        label: "VS Code",
        kind: "app",
        appName: "Visual Studio Code",
        args: [],
      },
    ];

    const { result } = renderHook(() => useFileLinkOpener("/workspace", openTargets, "vscode"));

    await act(async () => {
      await result.current.openFileLink("src/error.ts:3");
    });

    expect(captureExceptionMock).toHaveBeenCalledTimes(1);
    const [capturedError, capturedContext] = captureExceptionMock.mock.calls[0] as [
      Error,
      Record<string, unknown>,
    ];
    expect(capturedError).toBeInstanceOf(Error);
    expect(capturedError.message).toBe("open failed");
    expect(capturedContext).toMatchObject({
      tags: {
        feature: "file-link-open",
      },
      extra: {
        rawPath: "src/error.ts:3",
        resolvedPath: "/workspace/src/error.ts",
        workspacePath: "/workspace",
        targetId: "vscode",
        targetKind: "app",
        targetAppName: "Visual Studio Code",
        targetCommand: null,
      },
    });
    expect(pushErrorToastMock).toHaveBeenCalledWith({
      title: "Couldn’t open file",
      message: "open failed",
    });

    warnSpy.mockRestore();
  });

  it("does nothing for invalid command target", async () => {
    const openTargets: OpenAppTarget[] = [
      {
        id: "broken-command",
        label: "Broken Command",
        kind: "command",
        command: "   ",
        args: [],
      },
    ];

    const { result } = renderHook(() =>
      useFileLinkOpener("/workspace", openTargets, "broken-command"),
    );

    await act(async () => {
      await result.current.openFileLink("src/ignored.ts:1");
    });

    expect(openWorkspaceInMock).not.toHaveBeenCalled();
    expect(revealItemInDirMock).not.toHaveBeenCalled();
    expect(captureExceptionMock).not.toHaveBeenCalled();
    expect(pushErrorToastMock).not.toHaveBeenCalled();
  });
});
