import { describe, expect, it } from "vitest";
import {
  ACTIVE_THREAD_STALE_MS,
  COMMAND_EXECUTION_SILENCE_STALE_MS,
  WORKSPACE_SILENCE_STALE_MS,
  evaluateThreadStaleState,
  hasRunningCommandExecution,
  resolveSilenceThresholdMs,
} from "./threadStalePolicy";

describe("threadStalePolicy", () => {
  it("detects running command status from the most recent commandExecution tool event", () => {
    const items = [
      { kind: "tool", toolType: "search", status: "running" },
      { kind: "tool", toolType: "commandExecution", status: " completed " },
      { kind: "tool", toolType: "commandExecution", status: "in_progress" },
    ] as const;

    expect(hasRunningCommandExecution(items as never)).toBe(true);
  });

  it("treats completed or failed commandExecution statuses as not running", () => {
    expect(
      hasRunningCommandExecution(
        [{ kind: "tool", toolType: "commandExecution", status: "done" }] as never,
      ),
    ).toBe(false);
    expect(
      hasRunningCommandExecution(
        [{ kind: "tool", toolType: "commandExecution", status: "failed" }] as never,
      ),
    ).toBe(false);
  });

  it("uses duration fallback when commandExecution status is empty", () => {
    expect(
      hasRunningCommandExecution(
        [{ kind: "tool", toolType: "commandExecution", status: " ", durationMs: null }] as never,
      ),
    ).toBe(true);
    expect(
      hasRunningCommandExecution(
        [{ kind: "tool", toolType: "commandExecution", status: "", durationMs: 120 }] as never,
      ),
    ).toBe(false);
  });

  it("returns workspace silence threshold when no running command exists", () => {
    expect(resolveSilenceThresholdMs(false)).toBe(WORKSPACE_SILENCE_STALE_MS);
  });

  it("returns command-execution silence threshold when running command exists", () => {
    expect(resolveSilenceThresholdMs(true)).toBe(COMMAND_EXECUTION_SILENCE_STALE_MS);
  });

  it("returns non-stale state when startedAt is missing or invalid", () => {
    expect(
      evaluateThreadStaleState({
        now: 1_000,
        startedAt: null,
        lastAliveAt: null,
        hasRunningCommandExecution: false,
      }),
    ).toEqual({
      isStale: false,
      processingAgeMs: 0,
      silenceMs: 0,
      silenceThresholdMs: WORKSPACE_SILENCE_STALE_MS,
    });

    expect(
      evaluateThreadStaleState({
        now: 1_000,
        startedAt: Number.NaN,
        lastAliveAt: null,
        hasRunningCommandExecution: true,
      }),
    ).toEqual({
      isStale: false,
      processingAgeMs: 0,
      silenceMs: 0,
      silenceThresholdMs: COMMAND_EXECUTION_SILENCE_STALE_MS,
    });
  });

  it("marks thread as stale only when processing age and silence exceed thresholds", () => {
    const now = 1_000_000;
    const startedAt = now - ACTIVE_THREAD_STALE_MS;
    const lastAliveAt = now - COMMAND_EXECUTION_SILENCE_STALE_MS;

    expect(
      evaluateThreadStaleState({
        now,
        startedAt,
        lastAliveAt,
        hasRunningCommandExecution: true,
      }),
    ).toEqual({
      isStale: true,
      processingAgeMs: ACTIVE_THREAD_STALE_MS,
      silenceMs: COMMAND_EXECUTION_SILENCE_STALE_MS,
      silenceThresholdMs: COMMAND_EXECUTION_SILENCE_STALE_MS,
    });

    expect(
      evaluateThreadStaleState({
        now,
        startedAt: now - ACTIVE_THREAD_STALE_MS + 1,
        lastAliveAt,
        hasRunningCommandExecution: true,
      }).isStale,
    ).toBe(false);
  });

  it("falls back to processing age when no valid alive signal exists", () => {
    const now = 2_000_000;
    const startedAt = now - ACTIVE_THREAD_STALE_MS - 5_000;

    expect(
      evaluateThreadStaleState({
        now,
        startedAt,
        lastAliveAt: undefined,
        hasRunningCommandExecution: false,
      }),
    ).toEqual({
      isStale: true,
      processingAgeMs: ACTIVE_THREAD_STALE_MS + 5_000,
      silenceMs: ACTIVE_THREAD_STALE_MS + 5_000,
      silenceThresholdMs: WORKSPACE_SILENCE_STALE_MS,
    });

    expect(
      evaluateThreadStaleState({
        now,
        startedAt,
        lastAliveAt: Number.POSITIVE_INFINITY,
        hasRunningCommandExecution: false,
      }).silenceMs,
    ).toBe(ACTIVE_THREAD_STALE_MS + 5_000);
  });

  it("clamps negative processing and silence durations to zero", () => {
    const result = evaluateThreadStaleState({
      now: 500,
      startedAt: 1_000,
      lastAliveAt: 2_000,
      hasRunningCommandExecution: false,
    });

    expect(result.processingAgeMs).toBe(0);
    expect(result.silenceMs).toBe(0);
    expect(result.isStale).toBe(false);
  });
});
