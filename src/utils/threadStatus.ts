import { hasInProgressItemStatus } from "./protocolStatus";

type ThreadStatusSnapshot = {
  isProcessing: boolean;
  hasUnread: boolean;
  isReviewing: boolean;
  phase?: string;
  processingStartedAt?: number | null;
  lastActivityAt?: number | null;
  lastErrorAt?: number | null;
  lastErrorMessage?: string | null;
  turnStatus?: "inProgress" | "completed" | "interrupted" | "failed" | null;
  activeItemStatuses?: Record<string, "inProgress" | "completed" | "failed" | "declined">;
  messagePhase?: "commentary" | "finalAnswer" | "unknown";
  waitReason?: "none" | "approval" | "user_input" | "tool_wait" | "retry";
  retryState?: "none" | "retrying";
};

export type ThreadVisualStatus =
  | "processing"
  | "waiting"
  | "stalled"
  | "reviewing"
  | "unread"
  | "ready"
  | "error";

const WAITING_AFTER_MS = 8_000;
const STALLED_AFTER_MS = 3 * 60_000;
const STARTING_GRACE_MS = 45_000;
const TOOL_RUNNING_WAITING_AFTER_MS = 45_000;
const TOOL_RUNNING_STALLED_AFTER_MS = 8 * 60_000;
const ERROR_HIGHLIGHT_MS = 5 * 60_000;

export function deriveThreadVisualStatus(
  status: ThreadStatusSnapshot | null | undefined,
  now = Date.now(),
): ThreadVisualStatus {
  if (!status) {
    return "ready";
  }

  const hasRecentError =
    typeof status.lastErrorAt === "number" &&
    Number.isFinite(status.lastErrorAt) &&
    now - status.lastErrorAt <= ERROR_HIGHLIGHT_MS;

  if (!status.isProcessing && hasRecentError) {
    return "error";
  }

  // Protocol-first precedence: terminal turn state > explicit wait reasons
  // > active item/message-phase signals > time-based fallback heuristics.
  if (status.turnStatus === "failed" && status.retryState !== "retrying") {
    return "error";
  }

  if (status.turnStatus === "completed" && !status.isProcessing) {
    if (status.hasUnread) {
      return "unread";
    }
    return "ready";
  }

  if (status.turnStatus === "interrupted" && !status.isProcessing) {
    if (status.hasUnread) {
      return "unread";
    }
    return "ready";
  }

  if (status.isReviewing) {
    return "reviewing";
  }

  if (
    status.waitReason === "approval" ||
    status.waitReason === "user_input" ||
    status.waitReason === "retry" ||
    status.phase === "waiting_user"
  ) {
    return "waiting";
  }

  const turnInProgress = status.turnStatus === "inProgress";
  if (hasInProgressItemStatus(status.activeItemStatuses)) {
    return "processing";
  }

  if (
    turnInProgress &&
    (status.messagePhase === "commentary" || status.messagePhase === "finalAnswer")
  ) {
    return "processing";
  }

  if (status.isProcessing || turnInProgress) {
    const processingAgeMs =
      typeof status.processingStartedAt === "number" && Number.isFinite(status.processingStartedAt)
        ? Math.max(0, now - status.processingStartedAt)
        : 0;
    if (status.phase === "starting" && processingAgeMs < STARTING_GRACE_MS) {
      return "processing";
    }
    const activityBase =
      status.lastActivityAt ?? status.processingStartedAt ?? null;
    const quietForMs =
      typeof activityBase === "number" && Number.isFinite(activityBase)
        ? Math.max(0, now - activityBase)
        : 0;
    // `tool_running` often represents long-running command/tool work with sparse output.
    // Keep this threshold much wider to reduce false stuck positives.
    const waitingAfterMs =
      status.phase === "tool_running"
        ? TOOL_RUNNING_WAITING_AFTER_MS
        : WAITING_AFTER_MS;
    const stalledAfterMs =
      status.phase === "tool_running"
        ? TOOL_RUNNING_STALLED_AFTER_MS
        : STALLED_AFTER_MS;
    if (
      turnInProgress &&
      status.retryState !== "retrying" &&
      processingAgeMs >= STALLED_AFTER_MS &&
      quietForMs >= stalledAfterMs
    ) {
      return "stalled";
    }
    if (quietForMs >= waitingAfterMs) {
      return "waiting";
    }
    return "processing";
  }

  if (status.hasUnread) {
    return "unread";
  }

  return "ready";
}

export function getThreadVisualStatusLabel(status: ThreadVisualStatus): string {
  switch (status) {
    case "processing":
      return "运行中";
    case "waiting":
      return "等待响应";
    case "stalled":
      return "长时间无响应（疑似卡住）";
    case "reviewing":
      return "审查中";
    case "unread":
      return "有未读消息";
    case "error":
      return "发生错误";
    default:
      return "空闲";
  }
}

export function getThreadVisualStatusBadge(status: ThreadVisualStatus): string | null {
  switch (status) {
    case "processing":
      return "运行中";
    case "waiting":
      return "等待";
    case "stalled":
      return "疑似卡住";
    case "reviewing":
      return "审查";
    case "unread":
      return "未读";
    case "error":
      return "错误";
    default:
      return null;
  }
}
