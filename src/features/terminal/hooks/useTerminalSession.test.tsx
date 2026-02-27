// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspaceInfo } from "../../../types";
import { useTerminalSession } from "./useTerminalSession";
import {
  openTerminalSession,
  resizeTerminalSession,
  writeTerminalSession,
} from "../../../services/tauri";

type TerminalOutputHandler = (payload: {
  workspaceId: string;
  terminalId: string;
  data: string;
}) => void;
type TerminalExitHandler = (payload: {
  workspaceId: string;
  terminalId: string;
  exitCode?: number;
}) => void;

const mocks = vi.hoisted(() => {
  const state = {
    terminalOutputHandler: null as TerminalOutputHandler | null,
    terminalExitHandler: null as TerminalExitHandler | null,
    outputListenErrorHandler: null as ((error: unknown) => void) | null,
    exitListenErrorHandler: null as ((error: unknown) => void) | null,
  };
  const terminalInstances = [] as Array<{
    cols: number;
    rows: number;
    write: ReturnType<typeof vi.fn>;
    refresh: ReturnType<typeof vi.fn>;
    focus: ReturnType<typeof vi.fn>;
    reset: ReturnType<typeof vi.fn>;
    dispose: ReturnType<typeof vi.fn>;
    loadAddon: ReturnType<typeof vi.fn>;
    open: ReturnType<typeof vi.fn>;
    onData: ReturnType<typeof vi.fn>;
    inputDispose: ReturnType<typeof vi.fn>;
    onDataCallback: DataCallback | null;
    emitData: (data: string) => void;
  }>;
  const TerminalMockConstructor = vi.fn(() => {
    const instance = {
      cols: 80,
      rows: 24,
      write: vi.fn<(data: string) => void>(),
      refresh: vi.fn<(start: number, end: number) => void>(),
      focus: vi.fn<() => void>(),
      reset: vi.fn<() => void>(),
      dispose: vi.fn<() => void>(),
      loadAddon: vi.fn<(addon: unknown) => void>(),
      open: vi.fn<(element: HTMLElement) => void>(),
      inputDispose: vi.fn<() => void>(),
      onDataCallback: null as DataCallback | null,
      onData: vi.fn((callback: DataCallback) => {
        instance.onDataCallback = callback;
        return { dispose: instance.inputDispose };
      }),
      emitData(data: string) {
        instance.onDataCallback?.(data);
      },
    };
    terminalInstances.push(instance);
    return instance;
  });
  const subscribeTerminalOutputMock = vi.fn(
    (
      handler: TerminalOutputHandler,
      options?: { onError?: (error: unknown) => void },
    ) => {
      state.terminalOutputHandler = handler;
      state.outputListenErrorHandler = options?.onError ?? null;
      return () => {
        state.terminalOutputHandler = null;
        state.outputListenErrorHandler = null;
      };
    },
  );
  const subscribeTerminalExitMock = vi.fn(
    (
      handler: TerminalExitHandler,
      options?: { onError?: (error: unknown) => void },
    ) => {
      state.terminalExitHandler = handler;
      state.exitListenErrorHandler = options?.onError ?? null;
      return () => {
        state.terminalExitHandler = null;
        state.exitListenErrorHandler = null;
      };
    },
  );
  return {
    get terminalOutputHandler() {
      return state.terminalOutputHandler;
    },
    set terminalOutputHandler(value: TerminalOutputHandler | null) {
      state.terminalOutputHandler = value;
    },
    get terminalExitHandler() {
      return state.terminalExitHandler;
    },
    set terminalExitHandler(value: TerminalExitHandler | null) {
      state.terminalExitHandler = value;
    },
    get outputListenErrorHandler() {
      return state.outputListenErrorHandler;
    },
    set outputListenErrorHandler(value: ((error: unknown) => void) | null) {
      state.outputListenErrorHandler = value;
    },
    get exitListenErrorHandler() {
      return state.exitListenErrorHandler;
    },
    set exitListenErrorHandler(value: ((error: unknown) => void) | null) {
      state.exitListenErrorHandler = value;
    },
    terminalInstances,
    TerminalMockConstructor,
    subscribeTerminalOutputMock,
    subscribeTerminalExitMock,
  };
});

type DataCallback = (data: string) => void;

vi.mock("@xterm/xterm", () => ({
  Terminal: mocks.TerminalMockConstructor,
}));

vi.mock("@xterm/addon-fit", () => ({
  FitAddon: class {
    fit = vi.fn();
  },
}));

vi.mock("../../../services/events", () => ({
  subscribeTerminalOutput: mocks.subscribeTerminalOutputMock,
  subscribeTerminalExit: mocks.subscribeTerminalExitMock,
}));

vi.mock("../../../services/tauri", () => ({
  openTerminalSession: vi.fn(),
  resizeTerminalSession: vi.fn(),
  writeTerminalSession: vi.fn(),
}));

const baseWorkspace: WorkspaceInfo = {
  id: "workspace-1",
  name: "Workspace",
  path: "/tmp/workspace-1",
  connected: true,
  settings: { sidebarCollapsed: false },
};

describe("useTerminalSession", () => {
  beforeEach(() => {
    mocks.terminalOutputHandler = null;
    mocks.terminalExitHandler = null;
    mocks.outputListenErrorHandler = null;
    mocks.exitListenErrorHandler = null;
    mocks.terminalInstances.length = 0;
    vi.clearAllMocks();
    vi.mocked(openTerminalSession).mockResolvedValue(undefined);
    vi.mocked(resizeTerminalSession).mockResolvedValue(undefined);
    vi.mocked(writeTerminalSession).mockResolvedValue(undefined);
  });

  it("creates sessions, switches tabs, and restores buffered output", async () => {
    const onDebug = vi.fn();
    const { result, rerender } = renderHook(
      (props: { terminalId: string; isVisible: boolean }) =>
        useTerminalSession({
          activeWorkspace: baseWorkspace,
          activeTerminalId: props.terminalId,
          isVisible: props.isVisible,
          onDebug,
        }),
      {
        initialProps: { terminalId: "term-a", isVisible: false },
      },
    );

    act(() => {
      result.current.containerRef.current = document.createElement("div");
    });

    rerender({ terminalId: "term-a", isVisible: true });

    await waitFor(() => {
      expect(openTerminalSession).toHaveBeenCalledWith(
        "workspace-1",
        "term-a",
        80,
        24,
      );
      expect(result.current.status).toBe("ready");
      expect(result.current.readyKey).toBe("workspace-1:term-a");
    });

    const terminal = mocks.terminalInstances[0];
    act(() => {
      mocks.terminalOutputHandler?.({
        workspaceId: "workspace-1",
        terminalId: "term-a",
        data: "hello-a",
      });
    });
    await act(async () => {
      await new Promise<void>((resolve) => setTimeout(resolve, 40));
    });
    expect(terminal.write).toHaveBeenCalledWith("hello-a");

    rerender({ terminalId: "term-b", isVisible: true });

    await waitFor(() => {
      expect(openTerminalSession).toHaveBeenCalledWith(
        "workspace-1",
        "term-b",
        80,
        24,
      );
      expect(result.current.readyKey).toBe("workspace-1:term-b");
    });

    act(() => {
      mocks.terminalOutputHandler?.({
        workspaceId: "workspace-1",
        terminalId: "term-a",
        data: "buffered-a",
      });
      mocks.terminalOutputHandler?.({
        workspaceId: "workspace-1",
        terminalId: "term-b",
        data: "hello-b",
      });
    });
    await act(async () => {
      await new Promise<void>((resolve) => setTimeout(resolve, 40));
    });
    expect(terminal.write).toHaveBeenCalledWith("hello-b");

    rerender({ terminalId: "term-a", isVisible: true });

    await waitFor(() => {
      expect(result.current.readyKey).toBe("workspace-1:term-a");
      expect(openTerminalSession).toHaveBeenCalledTimes(2);
    });
    expect(terminal.reset).toHaveBeenCalled();
    expect(terminal.write).toHaveBeenCalledWith("hello-abuffered-a");
    expect(onDebug).not.toHaveBeenCalled();
  });

  it("handles terminal exit cleanup for active session", async () => {
    const onSessionExit = vi.fn();
    const { result, rerender } = renderHook(
      (props: { isVisible: boolean }) =>
        useTerminalSession({
          activeWorkspace: baseWorkspace,
          activeTerminalId: "term-a",
          isVisible: props.isVisible,
          onSessionExit,
        }),
      { initialProps: { isVisible: false } },
    );

    act(() => {
      result.current.containerRef.current = document.createElement("div");
    });
    rerender({ isVisible: true });

    await waitFor(() => {
      expect(result.current.status).toBe("ready");
      expect(result.current.hasSession).toBe(true);
    });

    act(() => {
      mocks.terminalExitHandler?.({
        workspaceId: "workspace-1",
        terminalId: "term-a",
      });
    });

    await waitFor(() => {
      expect(onSessionExit).toHaveBeenCalledWith("workspace-1", "term-a");
      expect(openTerminalSession).toHaveBeenCalledTimes(2);
      expect(result.current.readyKey).toBe("workspace-1:term-a");
    });
  });

  it("surfaces open-session failures as error state and debug entry", async () => {
    const onDebug = vi.fn();
    vi.mocked(openTerminalSession).mockRejectedValueOnce(new Error("open failed"));
    const { result, rerender } = renderHook(
      (props: { isVisible: boolean }) =>
        useTerminalSession({
          activeWorkspace: baseWorkspace,
          activeTerminalId: "term-a",
          isVisible: props.isVisible,
          onDebug,
        }),
      { initialProps: { isVisible: false } },
    );

    act(() => {
      result.current.containerRef.current = document.createElement("div");
    });
    rerender({ isVisible: true });

    await waitFor(() => {
      expect(result.current.status).toBe("error");
      expect(result.current.message).toBe("Failed to start terminal session.");
      expect(onDebug).toHaveBeenCalledTimes(1);
    });
  });

  it("ignores known write errors and drops further writes until session reopens", async () => {
    const onDebug = vi.fn();
    const { result, rerender } = renderHook(
      (props: { isVisible: boolean }) =>
        useTerminalSession({
          activeWorkspace: baseWorkspace,
          activeTerminalId: "term-a",
          isVisible: props.isVisible,
          onDebug,
        }),
      { initialProps: { isVisible: false } },
    );

    act(() => {
      result.current.containerRef.current = document.createElement("div");
    });
    rerender({ isVisible: true });

    await waitFor(() => {
      expect(result.current.status).toBe("ready");
      expect(result.current.hasSession).toBe(true);
    });

    const terminal = mocks.terminalInstances[0];
    vi.mocked(writeTerminalSession).mockRejectedValueOnce(new Error("broken pipe"));
    act(() => {
      terminal.emitData("ls -la\n");
    });
    await waitFor(() => {
      expect(writeTerminalSession).toHaveBeenCalledWith(
        "workspace-1",
        "term-a",
        "ls -la\n",
      );
    });
    expect(onDebug).not.toHaveBeenCalled();

    vi.mocked(writeTerminalSession).mockResolvedValue(undefined);
    act(() => {
      terminal.emitData("echo hi\n");
    });
    await act(async () => {
      await new Promise<void>((resolve) => queueMicrotask(resolve));
    });
    expect(writeTerminalSession).toHaveBeenCalledTimes(1);
  });

  it("reports unknown write failures as debug entries", async () => {
    const onDebug = vi.fn();
    const { result, rerender } = renderHook(
      (props: { isVisible: boolean }) =>
        useTerminalSession({
          activeWorkspace: baseWorkspace,
          activeTerminalId: "term-a",
          isVisible: props.isVisible,
          onDebug,
        }),
      { initialProps: { isVisible: false } },
    );

    act(() => {
      result.current.containerRef.current = document.createElement("div");
    });
    rerender({ isVisible: true });

    await waitFor(() => {
      expect(result.current.status).toBe("ready");
      expect(result.current.hasSession).toBe(true);
    });

    const terminal = mocks.terminalInstances[0];
    vi.mocked(writeTerminalSession).mockRejectedValueOnce(new Error("unexpected"));
    act(() => {
      terminal.emitData("pwd\n");
    });
    await waitFor(() => {
      expect(onDebug).toHaveBeenCalledTimes(1);
    });
  });

  it("sends debug entries for listener errors and output throttling notice", async () => {
    const onDebug = vi.fn();
    const { result, rerender } = renderHook(
      (props: { isVisible: boolean }) =>
        useTerminalSession({
          activeWorkspace: baseWorkspace,
          activeTerminalId: "term-a",
          isVisible: props.isVisible,
          onDebug,
        }),
      { initialProps: { isVisible: false } },
    );

    act(() => {
      result.current.containerRef.current = document.createElement("div");
    });
    rerender({ isVisible: true });

    await waitFor(() => {
      expect(result.current.status).toBe("ready");
    });

    const largeOutput = "x".repeat(140_000);
    act(() => {
      mocks.terminalOutputHandler?.({
        workspaceId: "workspace-1",
        terminalId: "term-a",
        data: largeOutput,
      });
    });
    await act(async () => {
      await new Promise<void>((resolve) => setTimeout(resolve, 40));
    });
    const terminal = mocks.terminalInstances[0];
    expect(terminal.write).toHaveBeenCalled();
    const writes = terminal.write.mock.calls.map((call) => String(call[0]));
    expect(
      writes.some((value) =>
        value.includes("terminal output throttled to keep UI responsive"),
      ),
    ).toBe(true);

    act(() => {
      mocks.outputListenErrorHandler?.(new Error("output listen failure"));
      mocks.exitListenErrorHandler?.(new Error("exit listen failure"));
    });
    expect(onDebug).toHaveBeenCalledTimes(2);
  });
});
