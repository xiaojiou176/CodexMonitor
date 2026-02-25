import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import type { DebugEntry, TerminalStatus, WorkspaceInfo } from "../../../types";
import { buildErrorDebugEntry } from "../../../utils/debugEntries";
import {
  subscribeTerminalExit,
  subscribeTerminalOutput,
  type TerminalExitEvent,
  type TerminalOutputEvent,
} from "../../../services/events";
import {
  openTerminalSession,
  resizeTerminalSession,
  writeTerminalSession,
} from "../../../services/tauri";

const MAX_BUFFER_CHARS = 200_000;
const TERMINAL_FLUSH_INTERVAL_MS = 24;
const MAX_PENDING_OUTPUT_CHARS = 120_000;
const OUTPUT_THROTTLED_NOTICE =
  "\r\n[CodexMonitor] terminal output throttled to keep UI responsive.\r\n";

type UseTerminalSessionOptions = {
  activeWorkspace: WorkspaceInfo | null;
  activeTerminalId: string | null;
  isVisible: boolean;
  onDebug?: (entry: DebugEntry) => void;
  onSessionExit?: (workspaceId: string, terminalId: string) => void;
};

type TerminalAppearance = {
  theme: {
    background: string;
    foreground: string;
    cursor: string;
    selection?: string;
  };
  fontFamily: string;
};

export type TerminalSessionState = {
  status: TerminalStatus;
  message: string;
  containerRef: RefObject<HTMLDivElement | null>;
  hasSession: boolean;
  readyKey: string | null;
  cleanupTerminalSession: (workspaceId: string, terminalId: string) => void;
};

function appendBuffer(existing: string | undefined, data: string): string {
  const next = (existing ?? "") + data;
  if (next.length <= MAX_BUFFER_CHARS) {
    return next;
  }
  return next.slice(next.length - MAX_BUFFER_CHARS);
}

function shouldIgnoreTerminalError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();
  return (
    lower.includes("terminal session not found") ||
    lower.includes("broken pipe") ||
    lower.includes("input/output error") ||
    lower.includes("os error 5") ||
    lower.includes("eio") ||
    lower.includes("not connected") ||
    lower.includes("closed")
  );
}

function getTerminalAppearance(container: HTMLElement | null): TerminalAppearance {
  if (typeof window === "undefined") {
    return {
      theme: {
        background: "transparent",
        foreground: "white",
        cursor: "white",
      },
      fontFamily: "Menlo, Monaco, \"Courier New\", monospace",
    };
  }

  const target = container ?? document.documentElement;
  const styles = getComputedStyle(target);
  const background =
    styles.getPropertyValue("--terminal-background").trim() ||
    styles.getPropertyValue("--surface-debug").trim() ||
    styles.getPropertyValue("--surface-panel").trim() ||
    "black";
  const foreground =
    styles.getPropertyValue("--terminal-foreground").trim() ||
    styles.getPropertyValue("--text-stronger").trim() ||
    "white";
  const cursor =
    styles.getPropertyValue("--terminal-cursor").trim() || foreground;
  const selection = styles.getPropertyValue("--terminal-selection").trim();
  const fontFamily =
    styles.getPropertyValue("--terminal-font-family").trim() ||
    styles.getPropertyValue("--code-font-family").trim() ||
    "Menlo, Monaco, \"Courier New\", monospace";

  return {
    theme: {
      background,
      foreground,
      cursor,
      selection: selection || undefined,
    },
    fontFamily,
  };
}

export function useTerminalSession({
  activeWorkspace,
  activeTerminalId,
  isVisible,
  onDebug,
  onSessionExit,
}: UseTerminalSessionOptions): TerminalSessionState {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const inputDisposableRef = useRef<{ dispose: () => void } | null>(null);
  const openedSessionsRef = useRef<Set<string>>(new Set());
  const outputBuffersRef = useRef<Map<string, string>>(new Map());
  const pendingOutputRef = useRef<Map<string, string>>(new Map());
  const overflowedKeysRef = useRef<Set<string>>(new Set());
  const flushTimerRef = useRef<number | null>(null);
  const activeKeyRef = useRef<string | null>(null);
  const renderedKeyRef = useRef<string | null>(null);
  const activeWorkspaceRef = useRef<WorkspaceInfo | null>(null);
  const activeTerminalIdRef = useRef<string | null>(null);
  const [status, setStatus] = useState<TerminalStatus>("idle");
  const [message, setMessage] = useState("Open a terminal to start a session.");
  const [hasSession, setHasSession] = useState(false);
  const [readyKey, setReadyKey] = useState<string | null>(null);
  const [sessionResetCounter, setSessionResetCounter] = useState(0);
  const cleanupTerminalSession = useCallback((workspaceId: string, terminalId: string) => {
    const key = `${workspaceId}:${terminalId}`;
    outputBuffersRef.current.delete(key);
    openedSessionsRef.current.delete(key);
    if (readyKey === key) {
      setReadyKey(null);
    }
    setSessionResetCounter((prev) => prev + 1);
    if (activeKeyRef.current === key) {
      terminalRef.current?.reset();
      setHasSession(false);
      setStatus("idle");
      setMessage("Open a terminal to start a session.");
    }
  }, [readyKey]);

  const activeKey = useMemo(() => {
    if (!activeWorkspace || !activeTerminalId) {
      return null;
    }
    return `${activeWorkspace.id}:${activeTerminalId}`;
  }, [activeTerminalId, activeWorkspace]);

  useEffect(() => {
    activeKeyRef.current = activeKey;
    activeWorkspaceRef.current = activeWorkspace;
    activeTerminalIdRef.current = activeTerminalId;
  }, [activeKey, activeTerminalId, activeWorkspace]);

  const writeToTerminal = useCallback((data: string) => {
    terminalRef.current?.write(data);
  }, []);

  const flushPendingOutput = useCallback(() => {
    flushTimerRef.current = null;
    const key = activeKeyRef.current;
    if (!key) {
      return;
    }
    const chunk = pendingOutputRef.current.get(key);
    if (!chunk) {
      return;
    }
    pendingOutputRef.current.delete(key);
    const hasOverflow = overflowedKeysRef.current.delete(key);
    writeToTerminal(hasOverflow ? `${OUTPUT_THROTTLED_NOTICE}${chunk}` : chunk);
    if (pendingOutputRef.current.has(key) && terminalRef.current) {
      flushTimerRef.current = window.setTimeout(flushPendingOutput, TERMINAL_FLUSH_INTERVAL_MS);
    }
  }, [writeToTerminal]);

  const schedulePendingOutputFlush = useCallback(() => {
    if (flushTimerRef.current !== null || !terminalRef.current) {
      return;
    }
    flushTimerRef.current = window.setTimeout(flushPendingOutput, TERMINAL_FLUSH_INTERVAL_MS);
  }, [flushPendingOutput]);

  const refreshTerminal = useCallback(() => {
    const terminal = terminalRef.current;
    if (!terminal) {
      return;
    }
    const lastRow = Math.max(0, terminal.rows - 1);
    terminal.refresh(0, lastRow);
    terminal.focus();
  }, []);

  const syncActiveBuffer = useCallback(
    (key: string) => {
      const term = terminalRef.current;
      if (!term) {
        return;
      }
      pendingOutputRef.current.delete(key);
      overflowedKeysRef.current.delete(key);
      term.reset();
      const buffered = outputBuffersRef.current.get(key);
      if (buffered) {
        term.write(buffered);
      }
      refreshTerminal();
    },
    [refreshTerminal],
  );

  useEffect(() => {
    const unlisten = subscribeTerminalOutput(
      (payload: TerminalOutputEvent) => {
        const { workspaceId, terminalId, data } = payload;
        const key = `${workspaceId}:${terminalId}`;
        const next = appendBuffer(outputBuffersRef.current.get(key), data);
        outputBuffersRef.current.set(key, next);
        if (activeKeyRef.current === key && terminalRef.current) {
          const currentPending = pendingOutputRef.current.get(key) ?? "";
          let pending = currentPending + data;
          if (pending.length > MAX_PENDING_OUTPUT_CHARS) {
            pending = pending.slice(pending.length - MAX_PENDING_OUTPUT_CHARS);
            overflowedKeysRef.current.add(key);
          }
          pendingOutputRef.current.set(key, pending);
          schedulePendingOutputFlush();
        }
      },
      {
        onError: (error) => {
          onDebug?.(buildErrorDebugEntry("terminal listen error", error));
        },
      },
    );
    return () => {
      unlisten();
    };
  }, [onDebug, schedulePendingOutputFlush]);

  useEffect(() => {
    const unlisten = subscribeTerminalExit(
      (payload: TerminalExitEvent) => {
        cleanupTerminalSession(payload.workspaceId, payload.terminalId);
        onSessionExit?.(payload.workspaceId, payload.terminalId);
      },
      {
        onError: (error) => {
          onDebug?.(buildErrorDebugEntry("terminal exit listen error", error));
        },
      },
    );
    return () => {
      unlisten();
    };
  }, [cleanupTerminalSession, onDebug, onSessionExit]);

  useEffect(() => {
    if (!isVisible) {
      if (flushTimerRef.current !== null) {
        window.clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }
      pendingOutputRef.current.clear();
      overflowedKeysRef.current.clear();
      inputDisposableRef.current?.dispose();
      inputDisposableRef.current = null;
      if (terminalRef.current) {
        terminalRef.current.dispose();
        terminalRef.current = null;
      }
      fitAddonRef.current = null;
      renderedKeyRef.current = null;
      return;
    }

    if (!terminalRef.current && containerRef.current) {
      const appearance = getTerminalAppearance(containerRef.current);
      const terminal = new Terminal({
        cursorBlink: true,
        fontSize: 12,
        fontFamily: appearance.fontFamily,
        allowTransparency: true,
        theme: appearance.theme,
        scrollback: 5000,
      });
      const fitAddon = new FitAddon();
      terminal.loadAddon(fitAddon);
      terminal.open(containerRef.current);
      fitAddon.fit();
      terminalRef.current = terminal;
      fitAddonRef.current = fitAddon;

      inputDisposableRef.current = terminal.onData((data: string) => {
        const workspace = activeWorkspaceRef.current;
        const terminalId = activeTerminalIdRef.current;
        if (!workspace || !terminalId) {
          return;
        }
        const key = `${workspace.id}:${terminalId}`;
        if (!openedSessionsRef.current.has(key)) {
          return;
        }
        void writeTerminalSession(workspace.id, terminalId, data).catch((error) => {
          if (shouldIgnoreTerminalError(error)) {
            openedSessionsRef.current.delete(key);
            return;
          }
          onDebug?.(buildErrorDebugEntry("terminal write error", error));
        });
      });
    }
  }, [isVisible, onDebug]);

  useEffect(() => {
    return () => {
      if (flushTimerRef.current !== null) {
        window.clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }
      pendingOutputRef.current.clear();
      overflowedKeysRef.current.clear();
      inputDisposableRef.current?.dispose();
      inputDisposableRef.current = null;
      if (terminalRef.current) {
        terminalRef.current.dispose();
        terminalRef.current = null;
      }
      fitAddonRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!isVisible) {
      setHasSession(false);
      setReadyKey(null);
      return;
    }
    if (!activeWorkspace || !activeTerminalId) {
      setStatus("idle");
      setMessage("Open a terminal to start a session.");
      setHasSession(false);
      setReadyKey(null);
      return;
    }
    if (!terminalRef.current || !fitAddonRef.current) {
      setStatus("idle");
      setMessage("Preparing terminal...");
      setHasSession(false);
      setReadyKey(null);
      return;
    }
    const key = `${activeWorkspace.id}:${activeTerminalId}`;
    const fitAddon = fitAddonRef.current;
    fitAddon.fit();

    const cols = terminalRef.current.cols;
    const rows = terminalRef.current.rows;
    const openSession = async () => {
      setStatus("connecting");
      setMessage("Starting terminal session...");
      if (!openedSessionsRef.current.has(key)) {
        await openTerminalSession(activeWorkspace.id, activeTerminalId, cols, rows);
        openedSessionsRef.current.add(key);
      }
      setStatus("ready");
      setMessage("Terminal ready.");
      setHasSession(true);
      setReadyKey(key);
      if (renderedKeyRef.current !== key) {
        syncActiveBuffer(key);
        renderedKeyRef.current = key;
      } else {
        refreshTerminal();
      }
    };

    openSession().catch((error) => {
      setStatus("error");
      setMessage("Failed to start terminal session.");
      onDebug?.(buildErrorDebugEntry("terminal open error", error));
    });
  }, [
    activeTerminalId,
    activeWorkspace,
    isVisible,
    onDebug,
    refreshTerminal,
    syncActiveBuffer,
    sessionResetCounter,
  ]);

  useEffect(() => {
    if (!isVisible || !activeKey || !terminalRef.current || !fitAddonRef.current) {
      return;
    }
    schedulePendingOutputFlush();
    fitAddonRef.current.fit();
    refreshTerminal();
  }, [activeKey, isVisible, refreshTerminal, schedulePendingOutputFlush]);

  useEffect(() => {
    if (
      !isVisible ||
      !terminalRef.current ||
      !activeWorkspace ||
      !activeTerminalId ||
      !hasSession
    ) {
      return;
    }
    const fitAddon = fitAddonRef.current;
    const terminal = terminalRef.current;
    if (!fitAddon) {
      return;
    }

    const resize = () => {
      fitAddon.fit();
      const key = `${activeWorkspace.id}:${activeTerminalId}`;
      resizeTerminalSession(
        activeWorkspace.id,
        activeTerminalId,
        terminal.cols,
        terminal.rows,
      ).catch((error) => {
        if (shouldIgnoreTerminalError(error)) {
          openedSessionsRef.current.delete(key);
          return;
        }
        onDebug?.(buildErrorDebugEntry("terminal resize error", error));
      });
    };

    const observer = new ResizeObserver(() => {
      resize();
    });

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    resize();

    return () => {
      observer.disconnect();
    };
  }, [activeTerminalId, activeWorkspace, hasSession, isVisible, onDebug]);

  return {
    status,
    message,
    containerRef,
    hasSession,
    readyKey,
    cleanupTerminalSession,
  };
}
