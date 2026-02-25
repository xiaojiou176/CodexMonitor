import { describe, expect, it } from "vitest";
import {
  asNumber,
  asString,
  extractReviewThreadId,
  extractRpcErrorMessage,
  normalizePlanStepStatus,
  normalizePlanUpdate,
  normalizeRateLimits,
  normalizeRootPath,
  normalizeStringList,
  normalizeTokenUsage,
  parseReviewTarget,
} from "./threadNormalize";

describe("primitive normalizers", () => {
  it("normalizes strings and numbers across mixed inputs", () => {
    expect(asString("hello")).toBe("hello");
    expect(asString(123)).toBe("123");
    expect(asString(null)).toBe("");

    expect(asNumber(42)).toBe(42);
    expect(asNumber(" 14 ")).toBe(14);
    expect(asNumber("nan")).toBe(0);
  });

  it("normalizes string lists and root paths", () => {
    expect(normalizeStringList(["a", 2, "", null])).toEqual(["a", "2"]);
    expect(normalizeStringList("solo")).toEqual(["solo"]);
    expect(normalizeStringList("")).toEqual([]);

    expect(normalizeRootPath("C:\\workspace\\foo\\\\")).toBe("C:/workspace/foo");
    expect(normalizeRootPath("/tmp/path///")).toBe("/tmp/path");
  });
});

describe("rpc extractors", () => {
  it("extracts rpc error messages from common response shapes", () => {
    expect(extractRpcErrorMessage(null)).toBeNull();
    expect(extractRpcErrorMessage({})).toBeNull();
    expect(extractRpcErrorMessage({ error: "boom" })).toBe("boom");
    expect(extractRpcErrorMessage({ error: { message: "bad request" } })).toBe("bad request");
    expect(extractRpcErrorMessage({ error: { code: 500 } })).toBe("Request failed.");
    expect(extractRpcErrorMessage({ error: 1 })).toBe("Request failed.");
  });

  it("extracts review thread id from both result and top-level payload", () => {
    expect(
      extractReviewThreadId({
        result: { review_thread_id: "thread-1" },
      }),
    ).toBe("thread-1");

    expect(
      extractReviewThreadId({
        reviewThreadId: "thread-2",
      }),
    ).toBe("thread-2");

    expect(extractReviewThreadId({ result: {} })).toBeNull();
    expect(extractReviewThreadId(null)).toBeNull();
  });
});

describe("usage and rate-limit normalization", () => {
  it("normalizes token usage for camelCase and snake_case payloads", () => {
    expect(
      normalizeTokenUsage({
        total: { total_tokens: "12", inputTokens: 3, cached_input_tokens: "4" },
        last: { output_tokens: "5", reasoningOutputTokens: "6" },
        model_context_window: "8192",
      }),
    ).toEqual({
      total: {
        totalTokens: 12,
        inputTokens: 3,
        cachedInputTokens: 4,
        outputTokens: 0,
        reasoningOutputTokens: 0,
      },
      last: {
        totalTokens: 0,
        inputTokens: 0,
        cachedInputTokens: 0,
        outputTokens: 5,
        reasoningOutputTokens: 6,
      },
      modelContextWindow: 8192,
    });
  });

  it("normalizes rate-limits with clamp, fallback, null clears and planType behavior", () => {
    const previous = {
      primary: { usedPercent: 30, windowDurationMins: 60, resetsAt: 1000 },
      secondary: { usedPercent: 20, windowDurationMins: null, resetsAt: null },
      credits: { hasCredits: true, unlimited: false, balance: "3.00" },
      planType: "pro",
    };

    expect(
      normalizeRateLimits(
        {
          primary: { used_percent: 125, window_duration_mins: "90", resets_at: 2000 },
          secondary: { remaining: 70 },
          credits: { has_credits: false, unlimited: true, balance: null },
          plan_type: "team",
        },
        previous,
      ),
    ).toEqual({
      primary: { usedPercent: 100, windowDurationMins: 90, resetsAt: 2000 },
      secondary: { usedPercent: 30, windowDurationMins: null, resetsAt: null },
      credits: { hasCredits: false, unlimited: true, balance: null },
      planType: "team",
    });

    expect(
      normalizeRateLimits(
        {
          primary: null,
          secondary: [],
          credits: "invalid",
          planType: 123,
        } as never,
        previous,
      ),
    ).toEqual({
      primary: null,
      secondary: previous.secondary,
      credits: previous.credits,
      planType: null,
    });

    expect(normalizeRateLimits({}, previous)).toEqual(previous);
  });
});

describe("plan and review normalization", () => {
  it("normalizes plan status variants", () => {
    expect(normalizePlanStepStatus("in_progress")).toBe("inProgress");
    expect(normalizePlanStepStatus("in-progress")).toBe("inProgress");
    expect(normalizePlanStepStatus("completed")).toBe("completed");
    expect(normalizePlanStepStatus("unexpected")).toBe("pending");
  });
});

describe("normalizePlanUpdate", () => {
  it("normalizes a plan when the payload uses an array", () => {
    expect(
      normalizePlanUpdate("turn-1", " Note ", [{ step: "Do it", status: "in_progress" }]),
    ).toEqual({
      turnId: "turn-1",
      explanation: "Note",
      steps: [{ step: "Do it", status: "inProgress" }],
    });
  });

  it("normalizes a plan when the payload uses an object with steps", () => {
    expect(
      normalizePlanUpdate("turn-2", null, {
        explanation: "Hello",
        steps: [{ step: "Ship it", status: "completed" }],
      }),
    ).toEqual({
      turnId: "turn-2",
      explanation: "Hello",
      steps: [{ step: "Ship it", status: "completed" }],
    });
  });

  it("returns null when there is no explanation or steps", () => {
    expect(normalizePlanUpdate("turn-3", "", { steps: [] })).toBeNull();
  });

  it("normalizes object payload variants with items and fallback explanation fields", () => {
    expect(
      normalizePlanUpdate("turn-4", null, {
        note: " from note ",
        items: [
          { text: "  First ", status: "completed" },
          { title: "Second", status: "in progress" },
          { status: "completed" },
          "invalid",
        ],
      }),
    ).toEqual({
      turnId: "turn-4",
      explanation: "from note",
      steps: [
        { step: "  First ", status: "completed" },
        { step: "Second", status: "inProgress" },
      ],
    });
  });
});

describe("parseReviewTarget", () => {
  it("parses uncommitted/base/commit/custom forms", () => {
    expect(parseReviewTarget("   ")).toEqual({ type: "uncommittedChanges" });
    expect(parseReviewTarget("/review")).toEqual({ type: "uncommittedChanges" });
    expect(parseReviewTarget("/review base main")).toEqual({
      type: "baseBranch",
      branch: "main",
    });
    expect(parseReviewTarget("/review commit abc123 Fix bug")).toEqual({
      type: "commit",
      sha: "abc123",
      title: "Fix bug",
    });
    expect(parseReviewTarget("/review custom check docs")).toEqual({
      type: "custom",
      instructions: "check docs",
    });
    expect(parseReviewTarget("/review compare release")).toEqual({
      type: "custom",
      instructions: "compare release",
    });
  });
});
