import { useCallback, useSyncExternalStore } from "react";

export type SidebarTicker = {
  getSnapshot: () => number;
  subscribe: (listener: () => void) => () => void;
  dispose: () => void;
};

export function createSidebarTicker(intervalMs = 1000): SidebarTicker {
  let snapshot = Date.now();
  let timer: ReturnType<typeof setTimeout> | null = null;
  const listeners = new Set<() => void>();

  const stop = () => {
    if (timer === null) {
      return;
    }
    clearInterval(timer);
    timer = null;
  };

  const start = () => {
    if (timer !== null) {
      return;
    }
    timer = setInterval(() => {
      snapshot = Date.now();
      listeners.forEach((listener) => listener());
    }, intervalMs);
  };

  return {
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener);
      if (listeners.size === 1) {
        start();
      }
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) {
          stop();
        }
      };
    },
    dispose: () => {
      stop();
      listeners.clear();
    },
  };
}

export function useSidebarTickerNow(ticker: SidebarTicker, enabled: boolean): number {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      if (!enabled) {
        return () => undefined;
      }
      return ticker.subscribe(onStoreChange);
    },
    [enabled, ticker],
  );
  const snapshot = useSyncExternalStore(subscribe, ticker.getSnapshot, ticker.getSnapshot);
  return enabled ? snapshot : ticker.getSnapshot();
}
