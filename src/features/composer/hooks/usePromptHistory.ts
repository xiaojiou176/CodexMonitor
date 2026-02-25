import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, RefObject } from "react";

const HISTORY_LIMIT = 200;
const DEFAULT_HISTORY_KEY = "default";
const STORAGE_PREFIX = "codexmonitor.promptHistory.";

function getStorageKey(key: string) {
  return `${STORAGE_PREFIX}${key}`;
}

function readStoredHistory(key: string): string[] {
  if (typeof window === "undefined") {
    return [];
  }
  const raw = window.localStorage.getItem(getStorageKey(key));
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .filter((item): item is string => typeof item === "string")
      .slice(-HISTORY_LIMIT);
  } catch {
    return [];
  }
}

function writeStoredHistory(key: string, value: string[]) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    if (value.length === 0) {
      window.localStorage.removeItem(getStorageKey(key));
      return;
    }
    window.localStorage.setItem(getStorageKey(key), JSON.stringify(value));
  } catch {
    return;
  }
}

function serializeHistoryForStorage(value: string[]): string | null {
  if (value.length === 0) {
    return null;
  }
  return JSON.stringify(value);
}

type UsePromptHistoryOptions = {
  historyKey?: string | null;
  text: string;
  hasAttachments?: boolean;
  disabled: boolean;
  isAutocompleteOpen: boolean;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  setText: (next: string) => void;
  setSelectionStart: (next: number | null) => void;
};

type UsePromptHistoryResult = {
  handleHistoryKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  handleHistoryTextChange: (next: string) => void;
  recordHistory: (value: string) => void;
  resetHistoryNavigation: () => void;
};

export function usePromptHistory({
  historyKey,
  text,
  hasAttachments = false,
  disabled,
  isAutocompleteOpen,
  textareaRef,
  setText,
  setSelectionStart,
}: UsePromptHistoryOptions): UsePromptHistoryResult {
  const [historyByKey, setHistoryByKey] = useState<Record<string, string[]>>({});
  const [historyIndex, setHistoryIndex] = useState<number | null>(null);
  const draftBeforeHistoryRef = useRef("");
  const loadedKeysRef = useRef<Set<string>>(new Set());
  const skipNextWriteRef = useRef(false);
  const lastPersistedRawByKeyRef = useRef<Record<string, string | null>>({});
  const historyByKeyRef = useRef(historyByKey);
  const previousKeyRef = useRef(historyKey ?? DEFAULT_HISTORY_KEY);
  const activeKey = historyKey ?? DEFAULT_HISTORY_KEY;
  const history = useMemo(() => historyByKey[activeKey] ?? [], [activeKey, historyByKey]);

  useEffect(() => {
    historyByKeyRef.current = historyByKey;
  }, [historyByKey]);

  useEffect(() => {
    const previousKey = previousKeyRef.current;
    previousKeyRef.current = activeKey;
    const stored = readStoredHistory(activeKey);
    lastPersistedRawByKeyRef.current[activeKey] = serializeHistoryForStorage(stored);
    const previousHistory = historyByKeyRef.current[previousKey] ?? [];
    const shouldMigrateDefault =
      previousKey === DEFAULT_HISTORY_KEY &&
      activeKey !== DEFAULT_HISTORY_KEY &&
      stored.length === 0 &&
      previousHistory.length > 0;
    const nextHistory = shouldMigrateDefault ? previousHistory : stored;

    if (shouldMigrateDefault) {
      writeStoredHistory(activeKey, nextHistory);
      writeStoredHistory(previousKey, []);
      lastPersistedRawByKeyRef.current[activeKey] = serializeHistoryForStorage(nextHistory);
      lastPersistedRawByKeyRef.current[previousKey] = null;
    }
    setHistoryByKey((prev) => {
      const existingActive = prev[activeKey];
      const alreadyLoaded = loadedKeysRef.current.has(activeKey);
      return {
        ...prev,
        // Avoid clobbering in-memory history with stale storage when switching keys quickly.
        [activeKey]: alreadyLoaded && existingActive ? existingActive : nextHistory,
        ...(shouldMigrateDefault ? { [previousKey]: [] } : {}),
      };
    });
    loadedKeysRef.current.add(activeKey);
    skipNextWriteRef.current = true;
    setHistoryIndex(null);
    draftBeforeHistoryRef.current = "";
  }, [activeKey]);

  useEffect(() => {
    if (!loadedKeysRef.current.has(activeKey)) {
      return;
    }
    if (skipNextWriteRef.current) {
      skipNextWriteRef.current = false;
      return;
    }
    const nextRaw = serializeHistoryForStorage(history);
    if (lastPersistedRawByKeyRef.current[activeKey] === nextRaw) {
      return;
    }
    writeStoredHistory(activeKey, history);
    lastPersistedRawByKeyRef.current[activeKey] = nextRaw;
  }, [activeKey, history]);

  const resetHistoryNavigation = useCallback(() => {
    setHistoryIndex(null);
  }, []);

  const recordHistory = useCallback(
    (value: string) => {
      const trimmed = value.trim();
      if (!trimmed) {
        return;
      }
      const existing = historyByKeyRef.current[activeKey] ?? [];
      if (existing[existing.length - 1] === trimmed) {
        return;
      }
      const next = [...existing, trimmed].slice(-HISTORY_LIMIT);
      // Persist synchronously to avoid losing entries on fast key switches.
      const nextRaw = serializeHistoryForStorage(next);
      if (lastPersistedRawByKeyRef.current[activeKey] !== nextRaw) {
        writeStoredHistory(activeKey, next);
        lastPersistedRawByKeyRef.current[activeKey] = nextRaw;
      }
      loadedKeysRef.current.add(activeKey);
      setHistoryByKey((prev) => {
        const current = prev[activeKey] ?? [];
        if (current[current.length - 1] === trimmed) {
          return prev;
        }
        // Merge with any concurrent updates by recomputing from current state.
        const mergedNext = [...current, trimmed].slice(-HISTORY_LIMIT);
        return {
          ...prev,
          [activeKey]: mergedNext,
        };
      });
    },
    [activeKey],
  );

  const applyHistoryValue = useCallback(
    (nextValue: string) => {
      setText(nextValue);
      requestAnimationFrame(() => {
        const textarea = textareaRef.current;
        if (!textarea) {
          return;
        }
        textarea.focus();
        textarea.setSelectionRange(nextValue.length, nextValue.length);
        setSelectionStart(nextValue.length);
      });
    },
    [setSelectionStart, setText, textareaRef],
  );

  const handleHistoryKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (disabled || isAutocompleteOpen) {
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) {
        return;
      }
      if (event.key !== "ArrowUp" && event.key !== "ArrowDown") {
        return;
      }
      if (history.length === 0) {
        return;
      }
      const isNavigating = historyIndex !== null;
      const isEmpty = text.length === 0 && !hasAttachments;
      if (!isNavigating && !isEmpty) {
        return;
      }
      if (!isNavigating && event.key === "ArrowDown") {
        return;
      }

      event.preventDefault();
      if (!isNavigating) {
        draftBeforeHistoryRef.current = text;
        const nextIndex = history.length - 1;
        setHistoryIndex(nextIndex);
        applyHistoryValue(history[nextIndex]);
        return;
      }

      if (event.key === "ArrowUp") {
        const nextIndex = Math.max(0, historyIndex - 1);
        if (nextIndex !== historyIndex) {
          setHistoryIndex(nextIndex);
          applyHistoryValue(history[nextIndex]);
        }
        return;
      }

      if (historyIndex >= history.length - 1) {
        setHistoryIndex(null);
        applyHistoryValue(draftBeforeHistoryRef.current);
        return;
      }

      const nextIndex = historyIndex + 1;
      setHistoryIndex(nextIndex);
      applyHistoryValue(history[nextIndex]);
    },
    [
      applyHistoryValue,
      disabled,
      hasAttachments,
      history,
      historyIndex,
      isAutocompleteOpen,
      text,
    ],
  );

  const handleHistoryTextChange = useCallback(
    (_next: string) => {
      if (historyIndex !== null) {
        setHistoryIndex(null);
      }
    },
    [historyIndex],
  );

  return {
    handleHistoryKeyDown,
    handleHistoryTextChange,
    recordHistory,
    resetHistoryNavigation,
  };
}
