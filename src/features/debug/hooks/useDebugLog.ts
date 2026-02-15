import { useCallback, useRef, useState } from "react";
import type { DebugEntry } from "../../../types";

const MAX_DEBUG_ENTRIES = 200;
const ANSI_ESCAPE_CHAR = String.fromCharCode(27);
const ANSI_SEQUENCE_PATTERN = new RegExp(`${ANSI_ESCAPE_CHAR}\\[[0-9;]*m`, "g");

function toReadablePayload(payload: unknown): string {
  if (payload === undefined) {
    return "";
  }
  if (typeof payload === "string") {
    return payload
      .replace(/\\u001b|\\u001B|\\x1b/gi, ANSI_ESCAPE_CHAR)
      .replace(ANSI_SEQUENCE_PATTERN, "");
  }
  try {
    return JSON.stringify(payload, null, 2);
  } catch {
    return String(payload);
  }
}

function summarizePayload(payload: unknown): unknown {
  if (Array.isArray(payload)) {
    return { _type: "array", count: payload.length, sample: payload.slice(0, 5) };
  }
  if (payload && typeof payload === "object") {
    const obj = payload as Record<string, unknown>;
    const summarized: Record<string, unknown> = {};
    for (const key of Object.keys(obj)) {
      if (Array.isArray(obj[key])) {
        summarized[key] = { _type: "array", count: (obj[key] as unknown[]).length };
      } else {
        summarized[key] = obj[key];
      }
    }
    return summarized;
  }
  return payload;
}

export function useDebugLog() {
  const [debugOpen, setDebugOpenState] = useState(false);
  const [debugEntries, setDebugEntries] = useState<DebugEntry[]>([]);
  const [hasDebugAlerts, setHasDebugAlerts] = useState(false);
  const [debugPinned, setDebugPinned] = useState(false);
  const debugOpenRef = useRef(debugOpen);
  debugOpenRef.current = debugOpen;

  const isAlertEntry = useCallback((entry: DebugEntry) => {
    if (entry.source === "error" || entry.source === "stderr") {
      return true;
    }
    const label = entry.label.toLowerCase();
    if (label.includes("warn") || label.includes("warning")) {
      return true;
    }
    if (typeof entry.payload === "string") {
      const payload = entry.payload.toLowerCase();
      return payload.includes("warn") || payload.includes("warning");
    }
    return false;
  }, []);

  const addDebugEntry = useCallback(
    (entry: DebugEntry) => {
      const isAlert = isAlertEntry(entry);
      if (!debugOpenRef.current && !isAlert) {
        return;
      }
      if (isAlert) {
        setHasDebugAlerts(true);
      }
      const compactEntry = { ...entry, payload: summarizePayload(entry.payload) };
      setDebugEntries((prev) => [...prev, compactEntry].slice(-MAX_DEBUG_ENTRIES));
    },
    [isAlertEntry],
  );

  const handleCopyDebug = useCallback(async () => {
    const text = debugEntries
      .map((entry) => {
        const timestamp = new Date(entry.timestamp).toLocaleTimeString();
        const payload = toReadablePayload(entry.payload);
        return [entry.source.toUpperCase(), timestamp, entry.label, payload]
          .filter(Boolean)
          .join("\n");
      })
      .join("\n\n");
    if (text) {
      await navigator.clipboard.writeText(text);
    }
  }, [debugEntries]);

  const clearDebugEntries = useCallback(() => {
    setDebugEntries([]);
    setHasDebugAlerts(false);
  }, []);

  const setDebugOpen = useCallback(
    (next: boolean | ((prev: boolean) => boolean)) => {
      setDebugOpenState((prev) => {
        const resolved = typeof next === "function" ? next(prev) : next;
        if (resolved) {
          setDebugPinned(true);
        }
        return resolved;
      });
    },
    [],
  );

  const showDebugButton = hasDebugAlerts || debugOpen || debugPinned;

  return {
    debugOpen,
    setDebugOpen,
    debugEntries,
    hasDebugAlerts,
    showDebugButton,
    addDebugEntry,
    handleCopyDebug,
    clearDebugEntries,
  };
}
