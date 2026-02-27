// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspaceInfo } from "../../../types";
import { useTerminalController } from "./useTerminalController";
import { closeTerminalSession } from "../../../services/tauri";
import { buildErrorDebugEntry } from "../../../utils/debugEntries";
import { useTerminalSession } from "./useTerminalSession";
import { useTerminalTabs } from "./useTerminalTabs";

vi.mock("../../../services/tauri", () => ({
  closeTerminalSession: vi.fn(),
}));

vi.mock("../../../utils/debugEntries", () => ({
  buildErrorDebugEntry: vi.fn(),
}));

vi.mock("./useTerminalSession", () => ({
  useTerminalSession: vi.fn(),
}));

vi.mock("./useTerminalTabs", () => ({
  useTerminalTabs: vi.fn(),
}));

type TabsMock = {
  terminals: Array<{ id: string; title: string }>;
  activeTerminalId: string | null;
  createTerminal: ReturnType<typeof vi.fn>;
  ensureTerminalWithTitle: ReturnType<typeof vi.fn>;
  closeTerminal: ReturnType<typeof vi.fn>;
  setActiveTerminal: ReturnType<typeof vi.fn>;
  ensureTerminal: ReturnType<typeof vi.fn>;
};

type SessionStateMock = {
  status: "idle" | "ready" | "error";
  message: string;
  containerRef: { current: HTMLDivElement | null };
  hasSession: boolean;
  readyKey: string | null;
  cleanupTerminalSession: ReturnType<typeof vi.fn>;
};

const workspace: WorkspaceInfo = {
  id: "workspace-1",
  name: "Workspace",
  path: "/tmp/workspace-1",
  connected: true,
  settings: { sidebarCollapsed: false },
};

describe("useTerminalController", () => {
  let tabsState: TabsMock;
  let sessionState: SessionStateMock;
  let capturedTabsOptions: { onCloseTerminal?: (workspaceId: string, terminalId: string) => Promise<void> | void } | null;
  let capturedSessionOptions: { onSessionExit?: (workspaceId: string, terminalId: string) => void } | null;

  beforeEach(() => {
    vi.clearAllMocks();

    tabsState = {
      terminals: [{ id: "term-1", title: "Terminal 1" }],
      activeTerminalId: "term-1",
      createTerminal: vi.fn(),
      ensureTerminalWithTitle: vi.fn(),
      closeTerminal: vi.fn(),
      setActiveTerminal: vi.fn(),
      ensureTerminal: vi.fn(),
    };

    sessionState = {
      status: "idle",
      message: "idle",
      containerRef: { current: null },
      hasSession: false,
      readyKey: null,
      cleanupTerminalSession: vi.fn(),
    };

    capturedTabsOptions = null;
    capturedSessionOptions = null;

    vi.mocked(useTerminalTabs).mockImplementation((options) => {
      capturedTabsOptions = options;
      return tabsState;
    });

    vi.mocked(useTerminalSession).mockImplementation((options) => {
      capturedSessionOptions = options;
      return sessionState;
    });

    vi.mocked(closeTerminalSession).mockResolvedValue(undefined);
    vi.mocked(buildErrorDebugEntry).mockImplementation((title, error) => ({
      title,
      error,
    }));
  });

  it("ensures a terminal when panel is open and workspace is active", () => {
    const onDebug = vi.fn();
    renderHook(() =>
      useTerminalController({
        activeWorkspaceId: "workspace-1",
        activeWorkspace: workspace,
        terminalOpen: true,
        onDebug,
      }),
    );

    expect(tabsState.ensureTerminal).toHaveBeenCalledWith("workspace-1");
  });

  it("handles select/new/close actions with workspace guards", () => {
    const onCloseTerminalPanel = vi.fn();
    const onDebug = vi.fn();
    const { result, rerender } = renderHook(
      (props: { activeWorkspaceId: string | null }) =>
        useTerminalController({
          activeWorkspaceId: props.activeWorkspaceId,
          activeWorkspace: workspace,
          terminalOpen: false,
          onCloseTerminalPanel,
          onDebug,
        }),
      { initialProps: { activeWorkspaceId: "workspace-1" } },
    );

    act(() => {
      result.current.onSelectTerminal("term-2");
      result.current.onNewTerminal();
      result.current.onCloseTerminal("term-1");
    });

    expect(tabsState.setActiveTerminal).toHaveBeenCalledWith("workspace-1", "term-2");
    expect(tabsState.createTerminal).toHaveBeenCalledWith("workspace-1");
    expect(tabsState.closeTerminal).toHaveBeenCalledWith("workspace-1", "term-1");
    expect(onCloseTerminalPanel).toHaveBeenCalledTimes(1);

    rerender({ activeWorkspaceId: null });
    act(() => {
      result.current.onSelectTerminal("term-3");
      result.current.onNewTerminal();
      result.current.onCloseTerminal("term-1");
    });

    expect(tabsState.setActiveTerminal).toHaveBeenCalledTimes(1);
    expect(tabsState.createTerminal).toHaveBeenCalledTimes(1);
    expect(tabsState.closeTerminal).toHaveBeenCalledTimes(1);
  });

  it("closes panel from onSessionExit only for the last active tab in active workspace", () => {
    const onCloseTerminalPanel = vi.fn();
    const onDebug = vi.fn();

    renderHook(() =>
      useTerminalController({
        activeWorkspaceId: "workspace-1",
        activeWorkspace: workspace,
        terminalOpen: false,
        onCloseTerminalPanel,
        onDebug,
      }),
    );

    act(() => {
      capturedSessionOptions?.onSessionExit?.("workspace-1", "term-1");
      capturedSessionOptions?.onSessionExit?.("workspace-2", "term-1");
    });

    expect(tabsState.closeTerminal).toHaveBeenNthCalledWith(1, "workspace-1", "term-1");
    expect(tabsState.closeTerminal).toHaveBeenNthCalledWith(2, "workspace-2", "term-1");
    expect(onCloseTerminalPanel).toHaveBeenCalledTimes(1);
  });

  it("ignores known close-session errors and reports unknown ones", async () => {
    const onDebug = vi.fn();

    renderHook(() =>
      useTerminalController({
        activeWorkspaceId: "workspace-1",
        activeWorkspace: workspace,
        terminalOpen: false,
        onDebug,
      }),
    );

    vi.mocked(closeTerminalSession).mockRejectedValueOnce(
      new Error("Terminal session not found"),
    );

    await capturedTabsOptions?.onCloseTerminal?.("workspace-1", "term-1");

    expect(sessionState.cleanupTerminalSession).toHaveBeenCalledWith(
      "workspace-1",
      "term-1",
    );
    expect(onDebug).not.toHaveBeenCalled();

    const closeError = new Error("permission denied");
    vi.mocked(closeTerminalSession).mockRejectedValueOnce(closeError);

    await capturedTabsOptions?.onCloseTerminal?.("workspace-1", "term-2");

    expect(buildErrorDebugEntry).toHaveBeenCalledWith(
      "terminal close error",
      closeError,
    );
    expect(onDebug).toHaveBeenCalledWith({
      title: "terminal close error",
      error: closeError,
    });
  });

  it("restarts sessions and rethrows unknown close failures", async () => {
    const onDebug = vi.fn();
    const { result } = renderHook(() =>
      useTerminalController({
        activeWorkspaceId: "workspace-1",
        activeWorkspace: workspace,
        terminalOpen: false,
        onDebug,
      }),
    );

    await result.current.restartTerminalSession("workspace-1", "term-1");

    expect(closeTerminalSession).toHaveBeenCalledWith("workspace-1", "term-1");
    expect(sessionState.cleanupTerminalSession).toHaveBeenCalledWith(
      "workspace-1",
      "term-1",
    );

    vi.mocked(closeTerminalSession).mockRejectedValueOnce(
      new Error("Terminal session not found"),
    );

    await expect(
      result.current.restartTerminalSession("workspace-1", "term-2"),
    ).resolves.toBeUndefined();
    expect(onDebug).not.toHaveBeenCalled();

    const restartError = new Error("boom");
    vi.mocked(closeTerminalSession).mockRejectedValueOnce(restartError);

    await expect(
      result.current.restartTerminalSession("workspace-1", "term-3"),
    ).rejects.toThrow("boom");

    expect(buildErrorDebugEntry).toHaveBeenCalledWith(
      "terminal close error",
      restartError,
    );
    expect(onDebug).toHaveBeenCalledWith({
      title: "terminal close error",
      error: restartError,
    });
  });

  it("passes through terminal session state and ensureTerminalWithTitle", () => {
    const onDebug = vi.fn();
    const { result } = renderHook(() =>
      useTerminalController({
        activeWorkspaceId: "workspace-1",
        activeWorkspace: workspace,
        terminalOpen: false,
        onDebug,
      }),
    );

    expect(result.current.terminalState).toBe(sessionState);
    expect(result.current.ensureTerminalWithTitle).toBe(
      tabsState.ensureTerminalWithTitle,
    );
  });
});
