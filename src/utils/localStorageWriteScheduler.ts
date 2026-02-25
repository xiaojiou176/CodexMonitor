type LocalStorageWriteSchedulerOptions = {
  debounceMs?: number;
  maxWaitMs?: number;
};

type PendingWrite = {
  run: () => void;
  firstScheduledAt: number;
  debounceTimer: number | null;
  maxWaitTimer: number | null;
  debounceMs: number;
};

const DEFAULT_DEBOUNCE_MS = 120;
const DEFAULT_MAX_WAIT_MS = 1_000;

const pendingWrites = new Map<string, PendingWrite>();
let listenersAttached = false;

function clearTimers(entry: PendingWrite) {
  if (entry.debounceTimer !== null) {
    window.clearTimeout(entry.debounceTimer);
    entry.debounceTimer = null;
  }
  if (entry.maxWaitTimer !== null) {
    window.clearTimeout(entry.maxWaitTimer);
    entry.maxWaitTimer = null;
  }
}

function flushWrite(key: string) {
  const entry = pendingWrites.get(key);
  if (!entry) {
    return;
  }
  clearTimers(entry);
  pendingWrites.delete(key);
  entry.run();
}

function attachLifecycleFlushListeners() {
  if (listenersAttached || typeof window === "undefined" || typeof document === "undefined") {
    return;
  }
  listenersAttached = true;

  const flushAll = () => {
    flushScheduledLocalStorageWrites();
  };

  window.addEventListener("pagehide", flushAll);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      flushAll();
    }
  });
}

export function scheduleLocalStorageWrite(
  key: string,
  run: () => void,
  options: LocalStorageWriteSchedulerOptions = {},
) {
  if (typeof window === "undefined") {
    run();
    return;
  }
  attachLifecycleFlushListeners();

  const debounceMs = Math.max(0, Math.floor(options.debounceMs ?? DEFAULT_DEBOUNCE_MS));
  const maxWaitMs = Math.max(debounceMs, Math.floor(options.maxWaitMs ?? DEFAULT_MAX_WAIT_MS));
  const now = Date.now();
  const existing = pendingWrites.get(key);
  const firstScheduledAt = existing?.firstScheduledAt ?? now;
  const elapsed = now - firstScheduledAt;
  const remainingMaxWait = Math.max(0, maxWaitMs - elapsed);

  if (existing) {
    clearTimers(existing);
  }

  const entry: PendingWrite = {
    run,
    firstScheduledAt,
    debounceTimer: null,
    maxWaitTimer: null,
    debounceMs,
  };

  entry.debounceTimer = window.setTimeout(() => {
    flushWrite(key);
  }, debounceMs);
  entry.maxWaitTimer = window.setTimeout(() => {
    flushWrite(key);
  }, remainingMaxWait);

  pendingWrites.set(key, entry);
}

export function flushScheduledLocalStorageWrites(key?: string) {
  if (typeof key === "string") {
    flushWrite(key);
    return;
  }
  Array.from(pendingWrites.keys()).forEach((pendingKey) => {
    flushWrite(pendingKey);
  });
}

export function __resetLocalStorageWriteSchedulerForTests() {
  flushScheduledLocalStorageWrites();
  pendingWrites.clear();
}
