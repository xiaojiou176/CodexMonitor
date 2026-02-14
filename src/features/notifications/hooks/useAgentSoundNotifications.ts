import { useCallback, useMemo, useRef } from "react";
import errorSoundUrl from "../../../assets/error-notification.mp3";
import successSoundUrl from "../../../assets/success-notification.mp3";
import type { DebugEntry } from "../../../types";
import { playNotificationSound } from "../../../utils/notificationSounds";
import { useAppServerEvents } from "../../app/hooks/useAppServerEvents";

const DEFAULT_MIN_DURATION_MS = 60_000; // 1 minute

type SoundNotificationOptions = {
  enabled: boolean;
  isWindowFocused: boolean;
  minDurationMs?: number;
  isSubAgentThread?: (workspaceId: string, threadId: string) => boolean;
  onDebug?: (entry: DebugEntry) => void;
};

function buildThreadKey(workspaceId: string, threadId: string) {
  return `${workspaceId}:${threadId}`;
}

function buildTurnKey(workspaceId: string, turnId: string) {
  return `${workspaceId}:${turnId}`;
}

export function useAgentSoundNotifications({
  enabled,
  isWindowFocused,
  minDurationMs = DEFAULT_MIN_DURATION_MS,
  isSubAgentThread,
  onDebug,
}: SoundNotificationOptions) {
  const turnStartById = useRef(new Map<string, number>());
  const turnStartByThread = useRef(new Map<string, number>());
  const lastPlayedAtByThread = useRef(new Map<string, number>());

  const playSound = useCallback(
    (url: string, label: "success" | "error") => {
      playNotificationSound(url, label, onDebug);
    },
    [onDebug],
  );

  const consumeDuration = useCallback(
    (workspaceId: string, threadId: string, turnId: string) => {
      const threadKey = buildThreadKey(workspaceId, threadId);
      let startedAt: number | undefined;

      if (turnId) {
        const turnKey = buildTurnKey(workspaceId, turnId);
        startedAt = turnStartById.current.get(turnKey);
        turnStartById.current.delete(turnKey);
      }

      if (startedAt === undefined) {
        startedAt = turnStartByThread.current.get(threadKey);
      }

      if (startedAt !== undefined) {
        turnStartByThread.current.delete(threadKey);
        return Date.now() - startedAt;
      }

      return null;
    },
    [],
  );

  const recordStartIfMissing = useCallback(
    (workspaceId: string, threadId: string) => {
      const threadKey = buildThreadKey(workspaceId, threadId);
      if (!turnStartByThread.current.has(threadKey)) {
        turnStartByThread.current.set(threadKey, Date.now());
      }
    },
    [],
  );

  const shouldPlaySound = useCallback(
    (durationMs: number | null, threadKey: string) => {
      if (durationMs === null) {
        return false;
      }
      if (!enabled) {
        return false;
      }
      if (durationMs < minDurationMs) {
        return false;
      }
      if (isWindowFocused) {
        return false;
      }
      const lastPlayedAt = lastPlayedAtByThread.current.get(threadKey);
      if (lastPlayedAt && Date.now() - lastPlayedAt < 1500) {
        return false;
      }
      lastPlayedAtByThread.current.set(threadKey, Date.now());
      return true;
    },
    [enabled, isWindowFocused, minDurationMs],
  );

  const handleTurnStarted = useCallback(
    (workspaceId: string, threadId: string, turnId: string) => {
      if (isSubAgentThread?.(workspaceId, threadId)) {
        return;
      }
      const startedAt = Date.now();
      turnStartByThread.current.set(
        buildThreadKey(workspaceId, threadId),
        startedAt,
      );
      if (turnId) {
        turnStartById.current.set(buildTurnKey(workspaceId, turnId), startedAt);
      }
    },
    [isSubAgentThread],
  );

  const handleTurnCompleted = useCallback(
    (workspaceId: string, threadId: string, turnId: string) => {
      if (isSubAgentThread?.(workspaceId, threadId)) {
        return;
      }
      const durationMs = consumeDuration(workspaceId, threadId, turnId);
      const threadKey = buildThreadKey(workspaceId, threadId);
      if (!shouldPlaySound(durationMs, threadKey)) {
        return;
      }
      playSound(successSoundUrl, "success");
    },
    [consumeDuration, isSubAgentThread, playSound, shouldPlaySound],
  );

  const handleTurnError = useCallback(
    (
      workspaceId: string,
      threadId: string,
      turnId: string,
      payload: { message: string; willRetry: boolean },
    ) => {
      if (isSubAgentThread?.(workspaceId, threadId)) {
        return;
      }
      if (payload.willRetry) {
        return;
      }
      const durationMs = consumeDuration(workspaceId, threadId, turnId);
      const threadKey = buildThreadKey(workspaceId, threadId);
      if (!shouldPlaySound(durationMs, threadKey)) {
        return;
      }
      playSound(errorSoundUrl, "error");
    },
    [consumeDuration, isSubAgentThread, playSound, shouldPlaySound],
  );

  const handleItemStarted = useCallback(
    (workspaceId: string, threadId: string) => {
      if (isSubAgentThread?.(workspaceId, threadId)) {
        return;
      }
      recordStartIfMissing(workspaceId, threadId);
    },
    [isSubAgentThread, recordStartIfMissing],
  );

  const handleAgentMessageDelta = useCallback(
    (event: { workspaceId: string; threadId: string }) => {
      if (isSubAgentThread?.(event.workspaceId, event.threadId)) {
        return;
      }
      recordStartIfMissing(event.workspaceId, event.threadId);
    },
    [isSubAgentThread, recordStartIfMissing],
  );

  const handleAgentMessageCompleted = useCallback(
    (event: { workspaceId: string; threadId: string }) => {
      if (isSubAgentThread?.(event.workspaceId, event.threadId)) {
        return;
      }
      const durationMs = consumeDuration(event.workspaceId, event.threadId, "");
      const threadKey = buildThreadKey(event.workspaceId, event.threadId);
      if (!shouldPlaySound(durationMs, threadKey)) {
        return;
      }
      playSound(successSoundUrl, "success");
    },
    [consumeDuration, isSubAgentThread, playSound, shouldPlaySound],
  );

  const handlers = useMemo(
    () => ({
      onTurnStarted: handleTurnStarted,
      onTurnCompleted: handleTurnCompleted,
      onTurnError: handleTurnError,
      onItemStarted: handleItemStarted,
      onAgentMessageDelta: handleAgentMessageDelta,
      onAgentMessageCompleted: handleAgentMessageCompleted,
    }),
    [
      handleAgentMessageCompleted,
      handleAgentMessageDelta,
      handleItemStarted,
      handleTurnCompleted,
      handleTurnError,
      handleTurnStarted,
    ],
  );

  useAppServerEvents(handlers);
}
