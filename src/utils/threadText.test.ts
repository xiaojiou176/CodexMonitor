import { describe, expect, it } from "vitest";
import type { ConversationItem } from "../types";
import { buildThreadTranscript } from "./threadText";

const TOOL_OUTPUT_BODY = "TOOL_OUTPUT_BODY_123";

function buildItems(): ConversationItem[] {
  return [
    {
      id: "msg-user",
      kind: "message",
      role: "user",
      text: "user message body",
    },
    {
      id: "msg-assistant",
      kind: "message",
      role: "assistant",
      text: "assistant message body",
    },
    {
      id: "explore-1",
      kind: "explore",
      status: "explored",
      entries: [{ kind: "read", label: "src/foo.ts", detail: "line 1-10" }],
    },
    {
      id: "tool-1",
      kind: "tool",
      toolType: "commandExecution",
      title: "Command: cat src/foo.ts",
      detail: "cat src/foo.ts",
      status: "completed",
      output: TOOL_OUTPUT_BODY,
      durationMs: 42,
    },
    {
      id: "diff-1",
      kind: "diff",
      title: "foo.ts update",
      diff: "+added line",
      status: "completed",
    },
    {
      id: "review-1",
      kind: "review",
      state: "completed",
      text: "review summary text",
    },
  ];
}

describe("buildThreadTranscript", () => {
  it("excludes user messages when includeUserInput=false", () => {
    const transcript = buildThreadTranscript(buildItems(), {
      includeUserInput: false,
    });

    expect(transcript).not.toContain("user message body");
    expect(transcript).toContain("assistant message body");
  });

  it("excludes assistant messages when includeAssistantMessages=false", () => {
    const transcript = buildThreadTranscript(buildItems(), {
      includeAssistantMessages: false,
    });

    expect(transcript).toContain("user message body");
    expect(transcript).not.toContain("assistant message body");
  });

  it("excludes tool/explore/diff/review when toolOutputMode=none", () => {
    const transcript = buildThreadTranscript(buildItems(), {
      toolOutputMode: "none",
    });

    expect(transcript).not.toContain("#### ✅ Command: cat src/foo.ts");
    expect(transcript).not.toContain("#### 🔍 已探索");
    expect(transcript).not.toContain("#### ✅ Diff: foo.ts update");
    expect(transcript).not.toContain("#### ✅ 审查完成");
  });

  it("includes compact tool summary but excludes tool output body when toolOutputMode=compact", () => {
    const transcript = buildThreadTranscript(buildItems(), {
      toolOutputMode: "compact",
    });

    expect(transcript).toContain("#### ✅ Command: cat src/foo.ts");
    expect(transcript).toContain("cat src/foo.ts");
    expect(transcript).toContain("**耗时：** 42ms");
    expect(transcript).not.toContain(TOOL_OUTPUT_BODY);
  });

  it("includes tool output body when toolOutputMode=detailed", () => {
    const transcript = buildThreadTranscript(buildItems(), {
      toolOutputMode: "detailed",
    });

    expect(transcript).toContain("#### ✅ Command: cat src/foo.ts");
    expect(transcript).toContain(TOOL_OUTPUT_BODY);
  });
});
