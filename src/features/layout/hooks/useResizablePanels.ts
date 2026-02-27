import type {
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
} from "react";
import { useCallback, useEffect, useRef, useState } from "react";

const STORAGE_KEY_SIDEBAR = "codexmonitor.sidebarWidth";
const STORAGE_KEY_RIGHT_PANEL = "codexmonitor.rightPanelWidth";
const STORAGE_KEY_PLAN_PANEL = "codexmonitor.planPanelHeight";
const STORAGE_KEY_TERMINAL_PANEL = "codexmonitor.terminalPanelHeight";
const STORAGE_KEY_DEBUG_PANEL = "codexmonitor.debugPanelHeight";
const MIN_SIDEBAR_WIDTH = 220;
const MAX_SIDEBAR_WIDTH = 420;
const MIN_RIGHT_PANEL_WIDTH = 270;
const MAX_RIGHT_PANEL_WIDTH = 420;
const MIN_PLAN_PANEL_HEIGHT = 140;
const MAX_PLAN_PANEL_HEIGHT = 420;
const MIN_TERMINAL_PANEL_HEIGHT = 140;
const MAX_TERMINAL_PANEL_HEIGHT = 480;
const MIN_DEBUG_PANEL_HEIGHT = 120;
const MAX_DEBUG_PANEL_HEIGHT = 420;
const DEFAULT_SIDEBAR_WIDTH = 280;
const DEFAULT_RIGHT_PANEL_WIDTH = 230;
const DEFAULT_PLAN_PANEL_HEIGHT = 220;
const DEFAULT_TERMINAL_PANEL_HEIGHT = 220;
const DEFAULT_DEBUG_PANEL_HEIGHT = 180;
const KEYBOARD_RESIZE_STEP = 16;

type ResizeState = {
  type: "sidebar" | "right-panel" | "plan-panel" | "terminal-panel" | "debug-panel";
  startX: number;
  startY: number;
  startWidth: number;
  startHeight: number;
};

const CSS_VAR_MAP: Record<ResizeState["type"], string> = {
  sidebar: "--sidebar-width",
  "right-panel": "--right-panel-width",
  "plan-panel": "--plan-panel-height",
  "terminal-panel": "--terminal-panel-height",
  "debug-panel": "--debug-panel-height",
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function readStoredWidth(key: string, fallback: number, min: number, max: number) {
  if (typeof window === "undefined") {
    return fallback;
  }
  const raw = window.localStorage.getItem(key);
  if (!raw) {
    return fallback;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return clamp(parsed, min, max);
}

type ResizeType = ResizeState["type"];

const RESIZE_LIMITS: Record<ResizeType, { min: number; max: number }> = {
  sidebar: {
    min: MIN_SIDEBAR_WIDTH,
    max: MAX_SIDEBAR_WIDTH,
  },
  "right-panel": {
    min: MIN_RIGHT_PANEL_WIDTH,
    max: MAX_RIGHT_PANEL_WIDTH,
  },
  "plan-panel": {
    min: MIN_PLAN_PANEL_HEIGHT,
    max: MAX_PLAN_PANEL_HEIGHT,
  },
  "terminal-panel": {
    min: MIN_TERMINAL_PANEL_HEIGHT,
    max: MAX_TERMINAL_PANEL_HEIGHT,
  },
  "debug-panel": {
    min: MIN_DEBUG_PANEL_HEIGHT,
    max: MAX_DEBUG_PANEL_HEIGHT,
  },
};

export function useResizablePanels() {
  const [sidebarWidth, setSidebarWidth] = useState(() =>
    readStoredWidth(
      STORAGE_KEY_SIDEBAR,
      DEFAULT_SIDEBAR_WIDTH,
      MIN_SIDEBAR_WIDTH,
      MAX_SIDEBAR_WIDTH,
    ),
  );
  const [rightPanelWidth, setRightPanelWidth] = useState(() =>
    readStoredWidth(
      STORAGE_KEY_RIGHT_PANEL,
      DEFAULT_RIGHT_PANEL_WIDTH,
      MIN_RIGHT_PANEL_WIDTH,
      MAX_RIGHT_PANEL_WIDTH,
    ),
  );
  const [planPanelHeight, setPlanPanelHeight] = useState(() =>
    readStoredWidth(
      STORAGE_KEY_PLAN_PANEL,
      DEFAULT_PLAN_PANEL_HEIGHT,
      MIN_PLAN_PANEL_HEIGHT,
      MAX_PLAN_PANEL_HEIGHT,
    ),
  );
  const [terminalPanelHeight, setTerminalPanelHeight] = useState(() =>
    readStoredWidth(
      STORAGE_KEY_TERMINAL_PANEL,
      DEFAULT_TERMINAL_PANEL_HEIGHT,
      MIN_TERMINAL_PANEL_HEIGHT,
      MAX_TERMINAL_PANEL_HEIGHT,
    ),
  );
  const [debugPanelHeight, setDebugPanelHeight] = useState(() =>
    readStoredWidth(
      STORAGE_KEY_DEBUG_PANEL,
      DEFAULT_DEBUG_PANEL_HEIGHT,
      MIN_DEBUG_PANEL_HEIGHT,
      MAX_DEBUG_PANEL_HEIGHT,
    ),
  );
  const resizeRef = useRef<ResizeState | null>(null);
  const rafRef = useRef<number | null>(null);
  // Holds the latest DOM-written value during drag; committed on mouseUp.
  const lastValueRef = useRef<number | null>(null);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY_SIDEBAR, String(sidebarWidth));
  }, [sidebarWidth]);

  useEffect(() => {
    window.localStorage.setItem(
      STORAGE_KEY_RIGHT_PANEL,
      String(rightPanelWidth),
    );
  }, [rightPanelWidth]);

  useEffect(() => {
    window.localStorage.setItem(
      STORAGE_KEY_PLAN_PANEL,
      String(planPanelHeight),
    );
  }, [planPanelHeight]);

  useEffect(() => {
    window.localStorage.setItem(
      STORAGE_KEY_TERMINAL_PANEL,
      String(terminalPanelHeight),
    );
  }, [terminalPanelHeight]);

  useEffect(() => {
    window.localStorage.setItem(
      STORAGE_KEY_DEBUG_PANEL,
      String(debugPanelHeight),
    );
  }, [debugPanelHeight]);

  useEffect(() => {
    // During drag we bypass React state and write the CSS variable directly
    // on the .app element. This avoids per-frame React re-renders of the
    // entire component tree. We commit to React state only on mouseUp.
    function applyResize(event: MouseEvent) {
      if (!resizeRef.current) {
        return;
      }
      const appEl = document.querySelector<HTMLElement>(".app");
      if (!appEl) return;

      let next: number;
      const state = resizeRef.current;

      if (state.type === "sidebar") {
        const delta = event.clientX - state.startX;
        next = clamp(state.startWidth + delta, MIN_SIDEBAR_WIDTH, MAX_SIDEBAR_WIDTH);
      } else if (state.type === "right-panel") {
        const delta = event.clientX - state.startX;
        next = clamp(state.startWidth - delta, MIN_RIGHT_PANEL_WIDTH, MAX_RIGHT_PANEL_WIDTH);
      } else if (state.type === "plan-panel") {
        const delta = event.clientY - state.startY;
        next = clamp(state.startHeight - delta, MIN_PLAN_PANEL_HEIGHT, MAX_PLAN_PANEL_HEIGHT);
      } else if (state.type === "terminal-panel") {
        const delta = event.clientY - state.startY;
        next = clamp(state.startHeight - delta, MIN_TERMINAL_PANEL_HEIGHT, MAX_TERMINAL_PANEL_HEIGHT);
      } else {
        const delta = event.clientY - state.startY;
        next = clamp(state.startHeight - delta, MIN_DEBUG_PANEL_HEIGHT, MAX_DEBUG_PANEL_HEIGHT);
      }

      // Direct DOM write — zero React overhead during drag
      appEl.style.setProperty(CSS_VAR_MAP[state.type], `${next}px`);
      // Stash the latest value so we can commit on mouseUp
      lastValueRef.current = next;
    }

    // Throttle mouse-move with requestAnimationFrame for smoother resize
    function handleMouseMove(event: MouseEvent) {
      if (!resizeRef.current) {
        return;
      }
      if (rafRef.current !== null) {
        return; // already scheduled
      }
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        applyResize(event);
      });
    }

    function handleMouseUp() {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      if (!resizeRef.current) {
        return;
      }
      // Commit final value to React state (single re-render)
      const panelType = resizeRef.current.type;
      const finalValue = lastValueRef.current;
      if (finalValue !== null) {
        switch (panelType) {
          case "sidebar":
            setSidebarWidth(finalValue);
            break;
          case "right-panel":
            setRightPanelWidth(finalValue);
            break;
          case "plan-panel":
            setPlanPanelHeight(finalValue);
            break;
          case "terminal-panel":
            setTerminalPanelHeight(finalValue);
            break;
          case "debug-panel":
            setDebugPanelHeight(finalValue);
            break;
        }
        lastValueRef.current = null;
      }
      resizeRef.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      // Remove the is-resizing class so transitions resume
      document.querySelector(".app")?.classList.remove("is-resizing");
    }

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  /** Add is-resizing class to disable CSS transitions during drag */
  function markResizing() {
    document.querySelector(".app")?.classList.add("is-resizing");
  }

  const onSidebarResizeStart = useCallback(
    (event: ReactMouseEvent) => {
      resizeRef.current = {
        type: "sidebar",
        startX: event.clientX,
        startY: event.clientY,
        startWidth: sidebarWidth,
        startHeight: planPanelHeight,
      };
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      markResizing();
    },
    [planPanelHeight, sidebarWidth],
  );

  const onRightPanelResizeStart = useCallback(
    (event: ReactMouseEvent) => {
      resizeRef.current = {
        type: "right-panel",
        startX: event.clientX,
        startY: event.clientY,
        startWidth: rightPanelWidth,
        startHeight: planPanelHeight,
      };
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      markResizing();
    },
    [planPanelHeight, rightPanelWidth],
  );

  const onPlanPanelResizeStart = useCallback(
    (event: ReactMouseEvent) => {
      resizeRef.current = {
        type: "plan-panel",
        startX: event.clientX,
        startY: event.clientY,
        startWidth: rightPanelWidth,
        startHeight: planPanelHeight,
      };
      document.body.style.cursor = "row-resize";
      document.body.style.userSelect = "none";
      markResizing();
    },
    [planPanelHeight, rightPanelWidth],
  );

  const onTerminalPanelResizeStart = useCallback(
    (event: ReactMouseEvent) => {
      resizeRef.current = {
        type: "terminal-panel",
        startX: event.clientX,
        startY: event.clientY,
        startWidth: rightPanelWidth,
        startHeight: terminalPanelHeight,
      };
      document.body.style.cursor = "row-resize";
      document.body.style.userSelect = "none";
      markResizing();
    },
    [rightPanelWidth, terminalPanelHeight],
  );

  const onDebugPanelResizeStart = useCallback(
    (event: ReactMouseEvent) => {
      resizeRef.current = {
        type: "debug-panel",
        startX: event.clientX,
        startY: event.clientY,
        startWidth: rightPanelWidth,
        startHeight: debugPanelHeight,
      };
      document.body.style.cursor = "row-resize";
      document.body.style.userSelect = "none";
      markResizing();
    },
    [debugPanelHeight, rightPanelWidth],
  );

  const applyKeyboardResize = useCallback(
    (type: ResizeType, nextValue: number) => {
      const { min, max } = RESIZE_LIMITS[type];
      const clamped = clamp(nextValue, min, max);
      switch (type) {
        case "sidebar":
          setSidebarWidth(clamped);
          break;
        case "right-panel":
          setRightPanelWidth(clamped);
          break;
        case "plan-panel":
          setPlanPanelHeight(clamped);
          break;
        case "terminal-panel":
          setTerminalPanelHeight(clamped);
          break;
        case "debug-panel":
          setDebugPanelHeight(clamped);
          break;
      }
    },
    [],
  );

  const handleResizeKeyDown = useCallback(
    (
      event: ReactKeyboardEvent<HTMLDivElement>,
      type: ResizeType,
      currentValue: number,
      shrinkKeys: string[],
      growKeys: string[],
    ) => {
      if (event.key === "Home") {
        event.preventDefault();
        applyKeyboardResize(type, RESIZE_LIMITS[type].min);
        return;
      }
      if (event.key === "End") {
        event.preventDefault();
        applyKeyboardResize(type, RESIZE_LIMITS[type].max);
        return;
      }
      if (shrinkKeys.includes(event.key)) {
        event.preventDefault();
        applyKeyboardResize(type, currentValue - KEYBOARD_RESIZE_STEP);
        return;
      }
      if (growKeys.includes(event.key)) {
        event.preventDefault();
        applyKeyboardResize(type, currentValue + KEYBOARD_RESIZE_STEP);
      }
    },
    [applyKeyboardResize],
  );

  const onSidebarResizeKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      handleResizeKeyDown(event, "sidebar", sidebarWidth, ["ArrowLeft"], ["ArrowRight"]);
    },
    [handleResizeKeyDown, sidebarWidth],
  );

  const onRightPanelResizeKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      handleResizeKeyDown(
        event,
        "right-panel",
        rightPanelWidth,
        ["ArrowRight"],
        ["ArrowLeft"],
      );
    },
    [handleResizeKeyDown, rightPanelWidth],
  );

  const onPlanPanelResizeKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      handleResizeKeyDown(event, "plan-panel", planPanelHeight, ["ArrowDown"], ["ArrowUp"]);
    },
    [handleResizeKeyDown, planPanelHeight],
  );

  const onTerminalPanelResizeKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      handleResizeKeyDown(
        event,
        "terminal-panel",
        terminalPanelHeight,
        ["ArrowDown"],
        ["ArrowUp"],
      );
    },
    [handleResizeKeyDown, terminalPanelHeight],
  );

  return {
    sidebarWidth,
    rightPanelWidth,
    planPanelHeight,
    terminalPanelHeight,
    debugPanelHeight,
    onSidebarResizeStart,
    onRightPanelResizeStart,
    onPlanPanelResizeStart,
    onTerminalPanelResizeStart,
    onDebugPanelResizeStart,
    onSidebarResizeKeyDown,
    onRightPanelResizeKeyDown,
    onPlanPanelResizeKeyDown,
    onTerminalPanelResizeKeyDown,
    sidebarResizeMin: MIN_SIDEBAR_WIDTH,
    sidebarResizeMax: MAX_SIDEBAR_WIDTH,
    rightPanelResizeMin: MIN_RIGHT_PANEL_WIDTH,
    rightPanelResizeMax: MAX_RIGHT_PANEL_WIDTH,
    planPanelResizeMin: MIN_PLAN_PANEL_HEIGHT,
    planPanelResizeMax: MAX_PLAN_PANEL_HEIGHT,
    terminalPanelResizeMin: MIN_TERMINAL_PANEL_HEIGHT,
    terminalPanelResizeMax: MAX_TERMINAL_PANEL_HEIGHT,
  };
}
