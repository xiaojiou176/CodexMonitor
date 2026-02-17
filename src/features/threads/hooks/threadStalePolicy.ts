import type { ConversationItem } from "../../../types";

/**
 * Processing must last at least 3 minutes before stale recovery is considered.
 */
export const ACTIVE_THREAD_STALE_MS = 3 * 60_000;

/**
 * Default silence threshold for event inactivity.
 */
export const WORKSPACE_SILENCE_STALE_MS = 90_000;

/**
 * commandExecution can stay silent longer while still healthy.
 */
export const COMMAND_EXECUTION_SILENCE_STALE_MS = 8 * 60_000;

type EvaluateThreadStaleStateOptions = {
  now: number;
  startedAt: number | null | undefined;
  lastAliveAt: number | null | undefined;
  hasRunningCommandExecution: boolean;
};

export type ThreadStaleState = {
  isStale: boolean;
  processingAgeMs: number;
  silenceMs: number;
  silenceThresholdMs: number;
};

export function hasRunningCommandExecution(
  items: ConversationItem[] | undefined,
): boolean {
  const entries = items ?? [];
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const item = entries[index];
    if (item.kind !== "tool" || item.toolType !== "commandExecution") {
      continue;
    }
    const status = (item.status ?? "").trim().toLowerCase();
    if (!status) {
      return item.durationMs == null;
    }
    if (/(complete|completed|success|succeeded|done)/.test(status)) {
      return false;
    }
    if (/(fail|failed|error|canceled|cancelled|aborted|interrupted)/.test(status)) {
      return false;
    }
    return /(pending|running|processing|started|in[_ -]?progress|inprogress|executing)/.test(
      status,
    );
  }
  return false;
}

export function resolveSilenceThresholdMs(
  hasRunningCommand: boolean,
): number {
  return hasRunningCommand
    ? COMMAND_EXECUTION_SILENCE_STALE_MS
    : WORKSPACE_SILENCE_STALE_MS;
}

export function evaluateThreadStaleState({
  now,
  startedAt,
  lastAliveAt,
  hasRunningCommandExecution: hasRunningCommand,
}: EvaluateThreadStaleStateOptions): ThreadStaleState {
  const silenceThresholdMs = resolveSilenceThresholdMs(hasRunningCommand);
  if (!startedAt || !Number.isFinite(startedAt) || startedAt <= 0) {
    return {
      isStale: false,
      processingAgeMs: 0,
      silenceMs: 0,
      silenceThresholdMs,
    };
  }

  const processingAgeMs = Math.max(0, now - startedAt);
  const hasAliveSignal =
    typeof lastAliveAt === "number"
    && Number.isFinite(lastAliveAt)
    && lastAliveAt > 0;
  const silenceMs = hasAliveSignal
    ? Math.max(0, now - (lastAliveAt as number))
    : processingAgeMs;
  const isStale =
    processingAgeMs >= ACTIVE_THREAD_STALE_MS
    && silenceMs >= silenceThresholdMs;

  return {
    isStale,
    processingAgeMs,
    silenceMs,
    silenceThresholdMs,
  };
}
