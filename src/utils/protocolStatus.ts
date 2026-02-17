import type {
  ProtocolItemStatus,
  ProtocolMessagePhase,
  ProtocolTurnStatus,
} from "../types";

const FINAL_TURN_STATUS_SET = new Set<ProtocolTurnStatus>([
  "completed",
  "interrupted",
  "failed",
]);

function normalizeStatusToken(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim().toLowerCase().replace(/[_\-\s]/g, "");
}

export function normalizeTurnStatus(value: unknown): ProtocolTurnStatus | null {
  const token = normalizeStatusToken(value);
  if (token === "inprogress" || token === "running") {
    return "inProgress";
  }
  if (token === "completed" || token === "success" || token === "succeeded") {
    return "completed";
  }
  if (token === "interrupted" || token === "cancelled" || token === "canceled") {
    return "interrupted";
  }
  if (token === "failed" || token === "error" || token === "errored") {
    return "failed";
  }
  return null;
}

export function isTurnTerminalStatus(
  status: ProtocolTurnStatus | null | undefined,
): boolean {
  return Boolean(status && FINAL_TURN_STATUS_SET.has(status));
}

export function normalizeCommandOrFileItemStatus(
  value: unknown,
): ProtocolItemStatus | null {
  const token = normalizeStatusToken(value);
  if (token === "inprogress" || token === "running" || token === "started") {
    return "inProgress";
  }
  if (token === "completed" || token === "success" || token === "succeeded") {
    return "completed";
  }
  if (
    token === "declined" ||
    token === "rejected" ||
    token === "cancelled" ||
    token === "canceled" ||
    token === "skipped"
  ) {
    return "declined";
  }
  if (token === "failed" || token === "error" || token === "errored") {
    return "failed";
  }
  return null;
}

export function normalizeMcpOrCollabItemStatus(
  value: unknown,
): Exclude<ProtocolItemStatus, "declined"> | null {
  const token = normalizeStatusToken(value);
  if (token === "inprogress" || token === "running" || token === "started") {
    return "inProgress";
  }
  if (token === "completed" || token === "success" || token === "succeeded") {
    return "completed";
  }
  if (token === "failed" || token === "error" || token === "errored") {
    return "failed";
  }
  return null;
}

export function normalizeMessagePhase(value: unknown): ProtocolMessagePhase {
  const token = normalizeStatusToken(value);
  if (token === "commentary") {
    return "commentary";
  }
  if (token === "finalanswer" || token === "final") {
    return "finalAnswer";
  }
  return "unknown";
}

export function normalizeWillRetry(value: unknown): boolean {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return value !== 0;
  }
  if (typeof value === "string") {
    const token = value.trim().toLowerCase();
    return token === "true" || token === "1" || token === "yes";
  }
  return false;
}

export function toWireItemStatus(
  status: ProtocolItemStatus | null | undefined,
): string {
  if (!status) {
    return "";
  }
  return status;
}

export function hasInProgressItemStatus(
  statuses: Record<string, ProtocolItemStatus> | null | undefined,
): boolean {
  if (!statuses) {
    return false;
  }
  return Object.values(statuses).some((status) => status === "inProgress");
}

export function normalizeMcpProgressMessage(params: Record<string, unknown>) {
  const messageValue = params.message ?? params.progress_message ?? null;
  if (typeof messageValue === "string" && messageValue.trim().length > 0) {
    return messageValue.trim();
  }
  const progressValue = params.progress;
  if (typeof progressValue === "number" && Number.isFinite(progressValue)) {
    return `progress: ${progressValue}`;
  }
  if (typeof progressValue === "string" && progressValue.trim().length > 0) {
    return progressValue.trim();
  }
  return null;
}
