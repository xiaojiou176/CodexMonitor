import {
  deriveThreadVisualStatus,
  getThreadVisualStatusBadge,
  getThreadVisualStatusLabel,
} from "./threadStatus";
import { describe, expect, it } from "vitest";

describe("threadStatus", () => {
  it("keeps starting phase as processing during grace period", () => {
    const now = 100_000;
    const status = deriveThreadVisualStatus(
      {
        isProcessing: true,
        hasUnread: false,
        isReviewing: false,
        phase: "starting",
        turnStatus: "inProgress",
        processingStartedAt: now - 30_000,
      },
      now,
    );
    expect(status).toBe("processing");
  });

  it("marks long silence as waiting but not stalled in tool_running phase", () => {
    const now = 600_000;
    const status = deriveThreadVisualStatus(
      {
        isProcessing: true,
        hasUnread: false,
        isReviewing: false,
        phase: "tool_running",
        turnStatus: "inProgress",
        processingStartedAt: now - 4 * 60_000,
        lastActivityAt: now - 4 * 60_000,
      },
      now,
    );
    expect(status).toBe("waiting");
  });

  it("marks very long silence as stalled in tool_running phase", () => {
    const now = 1_200_000;
    const status = deriveThreadVisualStatus(
      {
        isProcessing: true,
        hasUnread: false,
        isReviewing: false,
        phase: "tool_running",
        turnStatus: "inProgress",
        processingStartedAt: now - 10 * 60_000,
        lastActivityAt: now - 9 * 60_000,
      },
      now,
    );
    expect(status).toBe("stalled");
  });

  it("uses processing age guard before stalled classification", () => {
    const now = 120_000;
    const status = deriveThreadVisualStatus(
      {
        isProcessing: true,
        hasUnread: false,
        isReviewing: false,
        phase: "streaming",
        turnStatus: "inProgress",
        processingStartedAt: now - 2 * 60_000,
        lastActivityAt: now - 2 * 60_000,
      },
      now,
    );
    expect(status).toBe("waiting");
  });

  it("keeps waiting_user as waiting", () => {
    const now = 10_000;
    const status = deriveThreadVisualStatus(
      {
        isProcessing: true,
        hasUnread: false,
        isReviewing: false,
        phase: "waiting_user",
        processingStartedAt: now - 1_000,
      },
      now,
    );
    expect(status).toBe("waiting");
  });

  it("keeps approval wait reason as waiting", () => {
    const now = 12_000;
    const status = deriveThreadVisualStatus(
      {
        isProcessing: true,
        hasUnread: false,
        isReviewing: false,
        turnStatus: "inProgress",
        waitReason: "approval",
      },
      now,
    );
    expect(status).toBe("waiting");
  });

  it("keeps retry wait reason as waiting (not error)", () => {
    const now = 12_000;
    const status = deriveThreadVisualStatus(
      {
        isProcessing: true,
        hasUnread: false,
        isReviewing: false,
        turnStatus: "inProgress",
        waitReason: "retry",
        retryState: "retrying",
      },
      now,
    );
    expect(status).toBe("waiting");
  });

  it("surfaces recent errors when not processing", () => {
    const now = 90_000;
    const status = deriveThreadVisualStatus(
      {
        isProcessing: false,
        hasUnread: false,
        isReviewing: false,
        lastErrorAt: now - 1_000,
      },
      now,
    );
    expect(status).toBe("error");
  });

  it("uses softer stalled copy", () => {
    expect(getThreadVisualStatusLabel("stalled")).toBe("长时间无响应（疑似卡住）");
    expect(getThreadVisualStatusBadge("stalled")).toBe("疑似卡住");
  });
});
