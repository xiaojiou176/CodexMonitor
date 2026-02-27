import { describe, expect, it } from "vitest";
import type { ConversationItem } from "../types";
import {
  buildConversationItem,
  buildItemsFromThread,
  buildConversationItemFromThreadItem,
  getThreadCreatedTimestamp,
  getThreadTimestamp,
  isReviewingFromThread,
  mergeThreadItems,
  normalizeItem,
  prepareThreadItems,
  upsertItem,
} from "./threadItems";

describe("threadItems", () => {
  it("keeps long message text in normalizeItem", () => {
    const text = "a".repeat(21000);
    const item: ConversationItem = {
      id: "msg-1",
      kind: "message",
      role: "assistant",
      text,
    };
    const normalized = normalizeItem(item);
    expect(normalized.kind).toBe("message");
    if (normalized.kind === "message") {
      expect(normalized.text).toBe(text);
    }
  });

  it("preserves tool output for fileChange and commandExecution", () => {
    const output = "x".repeat(21000);
    const item: ConversationItem = {
      id: "tool-1",
      kind: "tool",
      toolType: "fileChange",
      title: "文件更改",
      detail: "",
      output,
    };
    const normalized = normalizeItem(item);
    expect(normalized.kind).toBe("tool");
    if (normalized.kind === "tool") {
      expect(normalized.output).toBe(output);
    }
  });

  it("truncates older tool output in prepareThreadItems", () => {
    const output = "y".repeat(21000);
    const items: ConversationItem[] = Array.from({ length: 41 }, (_, index) => ({
      id: `tool-${index}`,
      kind: "tool",
      toolType: "commandExecution",
      title: "Tool",
      detail: "",
      output,
    }));
    const prepared = prepareThreadItems(items);
    const firstOutput = prepared[0].kind === "tool" ? prepared[0].output : undefined;
    const secondOutput = prepared[1].kind === "tool" ? prepared[1].output : undefined;
    expect(firstOutput).not.toBe(output);
    expect(firstOutput?.endsWith("...")).toBeTruthy();
    expect(secondOutput).toBe(output);
  });

  it("keeps full thread history without client-side item cap", () => {
    const items: ConversationItem[] = Array.from({ length: 260 }, (_, index) => ({
      id: `msg-${index}`,
      kind: "message",
      role: "assistant",
      text: `message-${index}`,
    }));

    const prepared = prepareThreadItems(items);

    expect(prepared).toHaveLength(260);
    const first = prepared[0];
    const last = prepared[prepared.length - 1];
    expect(first.kind).toBe("message");
    expect(last.kind).toBe("message");
    if (first.kind === "message" && last.kind === "message") {
      expect(first.text).toBe("message-0");
      expect(last.text).toBe("message-259");
    }
  });

  it("drops assistant review summaries that duplicate completed review items", () => {
    const items: ConversationItem[] = [
      {
        id: "review-1",
        kind: "review",
        state: "completed",
        text: "Review summary",
      },
      {
        id: "msg-1",
        kind: "message",
        role: "assistant",
        text: "Review summary",
      },
    ];
    const prepared = prepareThreadItems(items);
    expect(prepared).toHaveLength(1);
    expect(prepared[0].kind).toBe("review");
  });

  it("summarizes explored reads and hides raw commands", () => {
    const items: ConversationItem[] = [
      {
        id: "cmd-1",
        kind: "tool",
        toolType: "commandExecution",
        title: "Command: cat src/foo.ts",
        detail: "",
        status: "completed",
        output: "",
      },
      {
        id: "cmd-2",
        kind: "tool",
        toolType: "commandExecution",
        title: "Command: sed -n '1,10p' src/bar.ts",
        detail: "",
        status: "completed",
        output: "",
      },
      {
        id: "msg-1",
        kind: "message",
        role: "assistant",
        text: "Done reading",
      },
    ];

    const prepared = prepareThreadItems(items);
    expect(prepared[0].kind).toBe("explore");
    if (prepared[0].kind === "explore") {
      expect(prepared[0].entries).toHaveLength(2);
      expect(prepared[0].entries[0].kind).toBe("read");
      expect(prepared[0].entries[0].label).toContain("foo.ts");
      expect(prepared[0].entries[1].kind).toBe("read");
      expect(prepared[0].entries[1].label).toContain("bar.ts");
    }
    expect(prepared.filter((item) => item.kind === "tool")).toHaveLength(0);
  });

  it("treats inProgress command status as exploring", () => {
    const items: ConversationItem[] = [
      {
        id: "cmd-1",
        kind: "tool",
        toolType: "commandExecution",
        title: "Command: rg RouterDestination src",
        detail: "",
        status: "inProgress",
        output: "",
      },
    ];

    const prepared = prepareThreadItems(items);
    expect(prepared).toHaveLength(1);
    expect(prepared[0].kind).toBe("explore");
    if (prepared[0].kind === "explore") {
      expect(prepared[0].status).toBe("exploring");
      expect(prepared[0].entries[0]?.kind).toBe("search");
    }
  });

  it("deduplicates explore entries when consecutive summaries merge", () => {
    const items: ConversationItem[] = [
      {
        id: "cmd-1",
        kind: "tool",
        toolType: "commandExecution",
        title: "Command: cat src/customPrompts.ts",
        detail: "",
        status: "completed",
        output: "",
      },
      {
        id: "cmd-2",
        kind: "tool",
        toolType: "commandExecution",
        title: "Command: cat src/customPrompts.ts",
        detail: "",
        status: "completed",
        output: "",
      },
    ];

    const prepared = prepareThreadItems(items);
    expect(prepared).toHaveLength(1);
    expect(prepared[0].kind).toBe("explore");
    if (prepared[0].kind === "explore") {
      expect(prepared[0].entries).toHaveLength(1);
      expect(prepared[0].entries[0].label).toContain("customPrompts.ts");
    }
  });

  it("preserves distinct read paths that share the same basename", () => {
    const items: ConversationItem[] = [
      {
        id: "cmd-1",
        kind: "tool",
        toolType: "commandExecution",
        title: "Command: cat src/foo/index.ts",
        detail: "",
        status: "completed",
        output: "",
      },
      {
        id: "cmd-2",
        kind: "tool",
        toolType: "commandExecution",
        title: "Command: cat tests/foo/index.ts",
        detail: "",
        status: "completed",
        output: "",
      },
    ];

    const prepared = prepareThreadItems(items);
    expect(prepared).toHaveLength(1);
    expect(prepared[0].kind).toBe("explore");
    if (prepared[0].kind === "explore") {
      expect(prepared[0].entries).toHaveLength(2);
      const details = prepared[0].entries.map((entry) => entry.detail ?? entry.label);
      expect(details).toContain("src/foo/index.ts");
      expect(details).toContain("tests/foo/index.ts");
    }
  });

  it("preserves multi-path read commands instead of collapsing to the last path", () => {
    const items: ConversationItem[] = [
      {
        id: "cmd-1",
        kind: "tool",
        toolType: "commandExecution",
        title: "Command: cat src/a.ts src/b.ts",
        detail: "",
        status: "completed",
        output: "",
      },
    ];

    const prepared = prepareThreadItems(items);
    expect(prepared).toHaveLength(1);
    expect(prepared[0].kind).toBe("explore");
    if (prepared[0].kind === "explore") {
      expect(prepared[0].entries).toHaveLength(2);
      const details = prepared[0].entries.map((entry) => entry.detail ?? entry.label);
      expect(details).toContain("src/a.ts");
      expect(details).toContain("src/b.ts");
    }
  });

  it("ignores glob patterns when summarizing rg --files commands", () => {
    const items: ConversationItem[] = [
      {
        id: "cmd-1",
        kind: "tool",
        toolType: "commandExecution",
        title: "Command: rg --files -g '*.ts' src",
        detail: "",
        status: "completed",
        output: "",
      },
    ];

    const prepared = prepareThreadItems(items);
    expect(prepared).toHaveLength(1);
    expect(prepared[0].kind).toBe("explore");
    if (prepared[0].kind === "explore") {
      expect(prepared[0].entries).toHaveLength(1);
      expect(prepared[0].entries[0].kind).toBe("list");
      expect(prepared[0].entries[0].label).toBe("src");
    }
  });

  it("skips rg glob flag values and keeps the actual search path", () => {
    const items: ConversationItem[] = [
      {
        id: "cmd-1",
        kind: "tool",
        toolType: "commandExecution",
        title: "Command: rg myQuery -g '*.ts' src",
        detail: "",
        status: "completed",
        output: "",
      },
    ];

    const prepared = prepareThreadItems(items);
    expect(prepared).toHaveLength(1);
    expect(prepared[0].kind).toBe("explore");
    if (prepared[0].kind === "explore") {
      expect(prepared[0].entries).toHaveLength(1);
      expect(prepared[0].entries[0].kind).toBe("search");
      expect(prepared[0].entries[0].label).toBe("myQuery in src");
    }
  });

  it("unwraps unquoted /bin/zsh -lc rg commands", () => {
    const items: ConversationItem[] = [
      {
        id: "cmd-1",
        kind: "tool",
        toolType: "commandExecution",
        title: 'Command: /bin/zsh -lc rg -n "RouterDestination" src',
        detail: "",
        status: "completed",
        output: "",
      },
    ];

    const prepared = prepareThreadItems(items);
    expect(prepared).toHaveLength(1);
    expect(prepared[0].kind).toBe("explore");
    if (prepared[0].kind === "explore") {
      expect(prepared[0].entries).toHaveLength(1);
      expect(prepared[0].entries[0].kind).toBe("search");
      expect(prepared[0].entries[0].label).toBe("RouterDestination in src");
    }
  });

  it("treats nl -ba as a read command", () => {
    const items: ConversationItem[] = [
      {
        id: "cmd-1",
        kind: "tool",
        toolType: "commandExecution",
        title: "Command: nl -ba src/foo.ts",
        detail: "",
        status: "completed",
        output: "",
      },
    ];

    const prepared = prepareThreadItems(items);
    expect(prepared).toHaveLength(1);
    expect(prepared[0].kind).toBe("explore");
    if (prepared[0].kind === "explore") {
      expect(prepared[0].entries).toHaveLength(1);
      expect(prepared[0].entries[0].kind).toBe("read");
      expect(prepared[0].entries[0].detail ?? prepared[0].entries[0].label).toBe(
        "src/foo.ts",
      );
    }
  });

  it("summarizes piped nl commands using the left-hand read", () => {
    const items: ConversationItem[] = [
      {
        id: "cmd-1",
        kind: "tool",
        toolType: "commandExecution",
        title: "Command: nl -ba src/foo.ts | sed -n '1,10p'",
        detail: "",
        status: "completed",
        output: "",
      },
    ];

    const prepared = prepareThreadItems(items);
    expect(prepared).toHaveLength(1);
    expect(prepared[0].kind).toBe("explore");
    if (prepared[0].kind === "explore") {
      expect(prepared[0].entries).toHaveLength(1);
      expect(prepared[0].entries[0].kind).toBe("read");
      expect(prepared[0].entries[0].detail ?? prepared[0].entries[0].label).toBe(
        "src/foo.ts",
      );
    }
  });

  it("does not trim pipes that appear inside quoted arguments", () => {
    const items: ConversationItem[] = [
      {
        id: "cmd-1",
        kind: "tool",
        toolType: "commandExecution",
        title: 'Command: rg "foo | bar" src',
        detail: "",
        status: "completed",
        output: "",
      },
    ];

    const prepared = prepareThreadItems(items);
    expect(prepared).toHaveLength(1);
    expect(prepared[0].kind).toBe("explore");
    if (prepared[0].kind === "explore") {
      expect(prepared[0].entries).toHaveLength(1);
      expect(prepared[0].entries[0].kind).toBe("search");
      expect(prepared[0].entries[0].label).toBe("foo | bar in src");
    }
  });

  it("keeps raw commands when they are not recognized", () => {
    const items: ConversationItem[] = [
      {
        id: "cmd-1",
        kind: "tool",
        toolType: "commandExecution",
        title: "Command: git status",
        detail: "",
        status: "completed",
        output: "",
      },
    ];
    const prepared = prepareThreadItems(items);
    expect(prepared).toHaveLength(1);
    expect(prepared[0].kind).toBe("tool");
  });

  it("keeps raw commands when they fail", () => {
    const items: ConversationItem[] = [
      {
        id: "cmd-1",
        kind: "tool",
        toolType: "commandExecution",
        title: "Command: cat src/foo.ts",
        detail: "",
        status: "failed",
        output: "No such file",
      },
    ];
    const prepared = prepareThreadItems(items);
    expect(prepared).toHaveLength(1);
    expect(prepared[0].kind).toBe("tool");
  });

  it("keeps raw command item when command text is empty after Command prefix", () => {
    const items: ConversationItem[] = [
      {
        id: "cmd-empty-1",
        kind: "tool",
        toolType: "commandExecution",
        title: "Command:   ",
        detail: "",
        status: "completed",
        output: "",
      },
    ];

    const prepared = prepareThreadItems(items);
    expect(prepared).toHaveLength(1);
    expect(prepared[0].kind).toBe("tool");
  });

  it("keeps raw command item when rg has no positional query", () => {
    const items: ConversationItem[] = [
      {
        id: "cmd-empty-2",
        kind: "tool",
        toolType: "commandExecution",
        title: "Command: rg -n --hidden",
        detail: "",
        status: "completed",
        output: "",
      },
    ];

    const prepared = prepareThreadItems(items);
    expect(prepared).toHaveLength(1);
    expect(prepared[0].kind).toBe("tool");
  });

  it("builds file change items with summary details", () => {
    const item = buildConversationItem({
      type: "fileChange",
      id: "change-1",
      status: "done",
      changes: [
        {
          path: "foo.txt",
          kind: "add",
          diff: "diff --git a/foo.txt b/foo.txt",
        },
      ],
    });
    expect(item).not.toBeNull();
    if (item && item.kind === "tool") {
      expect(item.title).toBe("文件更改");
      expect(item.detail).toBe("A foo.txt");
      expect(item.output).toContain("diff --git a/foo.txt b/foo.txt");
      expect(item.changes?.[0]?.path).toBe("foo.txt");
    }
  });

  it("merges thread items preferring non-empty remote tool output", () => {
    const remote: ConversationItem = {
      id: "tool-2",
      kind: "tool",
      toolType: "webSearch",
      title: "网页搜索",
      detail: "query",
      status: "ok",
      output: "short",
    };
    const local: ConversationItem = {
      id: "tool-2",
      kind: "tool",
      toolType: "webSearch",
      title: "网页搜索",
      detail: "query",
      output: "much longer output",
    };
    const merged = mergeThreadItems([remote], [local]);
    expect(merged).toHaveLength(1);
    expect(merged[0].kind).toBe("tool");
    if (merged[0].kind === "tool") {
      expect(merged[0].output).toBe("short");
      expect(merged[0].status).toBe("ok");
    }
  });

  it("keeps local tool output when remote output is empty", () => {
    const remote: ConversationItem = {
      id: "tool-3",
      kind: "tool",
      toolType: "webSearch",
      title: "网页搜索",
      detail: "query",
      status: "completed",
      output: " ",
    };
    const local: ConversationItem = {
      id: "tool-3",
      kind: "tool",
      toolType: "webSearch",
      title: "网页搜索",
      detail: "query",
      output: "streamed output",
    };
    const merged = mergeThreadItems([remote], [local]);
    expect(merged).toHaveLength(1);
    expect(merged[0].kind).toBe("tool");
    if (merged[0].kind === "tool") {
      expect(merged[0].output).toBe("streamed output");
      expect(merged[0].status).toBe("completed");
    }
  });

  it("keeps remote-only items and appends local-only items when merging", () => {
    const remoteOnly: ConversationItem = {
      id: "remote-only-1",
      kind: "message",
      role: "assistant",
      text: "remote",
    };
    const localOnly: ConversationItem = {
      id: "local-only-1",
      kind: "message",
      role: "assistant",
      text: "local",
    };

    const merged = mergeThreadItems([remoteOnly], [localOnly]);

    expect(merged).toHaveLength(2);
    expect(merged[0]).toEqual(remoteOnly);
    expect(merged[1]).toEqual(localOnly);
  });

  it("returns remote items directly when local list is empty", () => {
    const remoteOnly: ConversationItem = {
      id: "remote-only-2",
      kind: "message",
      role: "assistant",
      text: "remote-only",
    };

    const merged = mergeThreadItems([remoteOnly], []);

    expect(merged).toEqual([remoteOnly]);
  });

  it("preserves streamed plan output when completion item has empty output", () => {
    const existing: ConversationItem = {
      id: "plan-1",
      kind: "tool",
      toolType: "plan",
      title: "方案",
      detail: "Generating plan...",
      status: "in_progress",
      output: "## Plan\n- Step 1\n- Step 2",
    };
    const completed: ConversationItem = {
      id: "plan-1",
      kind: "tool",
      toolType: "plan",
      title: "方案",
      detail: "",
      status: "completed",
      output: "",
    };

    const next = upsertItem([existing], completed);
    expect(next).toHaveLength(1);
    expect(next[0].kind).toBe("tool");
    if (next[0].kind === "tool") {
      expect(next[0].output).toBe(existing.output);
      expect(next[0].status).toBe("completed");
    }
  });

  it("uses incoming tool output even when shorter than existing output", () => {
    const existing: ConversationItem = {
      id: "tool-4",
      kind: "tool",
      toolType: "webSearch",
      title: "网页搜索",
      detail: "query",
      status: "in_progress",
      output: "verbose streamed output that will be replaced",
    };
    const incoming: ConversationItem = {
      id: "tool-4",
      kind: "tool",
      toolType: "webSearch",
      title: "网页搜索",
      detail: "query",
      status: "completed",
      output: "final",
    };

    const next = upsertItem([existing], incoming);
    expect(next).toHaveLength(1);
    expect(next[0].kind).toBe("tool");
    if (next[0].kind === "tool") {
      expect(next[0].output).toBe("final");
      expect(next[0].status).toBe("completed");
    }
  });

  it("preserves streamed reasoning content when completion item is empty", () => {
    const existing: ConversationItem = {
      id: "reasoning-1",
      kind: "reasoning",
      summary: "Thinking",
      content: "More detail",
    };
    const completed: ConversationItem = {
      id: "reasoning-1",
      kind: "reasoning",
      summary: "",
      content: "",
    };

    const next = upsertItem([existing], completed);
    expect(next).toHaveLength(1);
    expect(next[0].kind).toBe("reasoning");
    if (next[0].kind === "reasoning") {
      expect(next[0].summary).toBe("Thinking");
      expect(next[0].content).toBe("More detail");
    }
  });

  it("builds user message text from mixed inputs", () => {
    const item = buildConversationItemFromThreadItem({
      type: "userMessage",
      id: "msg-1",
      content: [
        { type: "text", text: "Please" },
        { type: "skill", name: "Review" },
        { type: "image", url: "https://example.com/image.png" },
      ],
    });
    expect(item).not.toBeNull();
    if (item && item.kind === "message") {
      expect(item.role).toBe("user");
      expect(item.text).toBe("Please $Review");
      expect(item.images).toEqual(["https://example.com/image.png"]);
    }
  });

  it("builds agent message text from content blocks when text is empty", () => {
    const item = buildConversationItemFromThreadItem({
      type: "agentMessage",
      id: "agent-1",
      content: [
        { type: "output_text", text: "Hello " },
        { type: "output_text", text: "world" },
      ],
    });
    expect(item).not.toBeNull();
    if (item && item.kind === "message") {
      expect(item.role).toBe("assistant");
      expect(item.text).toBe("Hello world");
    }
  });

  it("keeps image-only user messages without placeholder text", () => {
    const item = buildConversationItemFromThreadItem({
      type: "userMessage",
      id: "msg-2",
      content: [{ type: "image", url: "https://example.com/only.png" }],
    });
    expect(item).not.toBeNull();
    if (item && item.kind === "message") {
      expect(item.role).toBe("user");
      expect(item.text).toBe("");
      expect(item.images).toEqual(["https://example.com/only.png"]);
    }
  });

  it("formats collab tool calls with receivers and agent states", () => {
    const item = buildConversationItem({
      type: "collabToolCall",
      id: "collab-1",
      tool: "handoff",
      status: "ok",
      senderThreadId: "thread-a",
      receiverThreadIds: ["thread-b"],
      newThreadId: "thread-c",
      prompt: "Coordinate work",
      agentStatus: { "agent-1": { status: "running" } },
    });
    expect(item).not.toBeNull();
    if (item && item.kind === "tool") {
      expect(item.title).toBe("协作: handoff");
      expect(item.detail).toContain("From thread-a");
      expect(item.detail).toContain("thread-b, thread-c");
      expect(item.output).toBe("Coordinate work\n\nagent-1: running");
    }
  });

  it("builds context compaction items", () => {
    const item = buildConversationItem({
      type: "contextCompaction",
      id: "compact-1",
      status: "inProgress",
    });
    expect(item).not.toBeNull();
    if (item && item.kind === "tool") {
      expect(item.toolType).toBe("contextCompaction");
      expect(item.title).toBe("上下文压缩");
      expect(item.status).toBe("inProgress");
    }
  });

  it("builds context compaction items from thread history", () => {
    const item = buildConversationItemFromThreadItem({
      type: "contextCompaction",
      id: "compact-2",
    });
    expect(item).not.toBeNull();
    if (item && item.kind === "tool") {
      expect(item.toolType).toBe("contextCompaction");
      expect(item.title).toBe("上下文压缩");
      expect(item.status).toBe("completed");
    }
  });

  it("parses ISO timestamps for thread updates", () => {
    const timestamp = getThreadTimestamp({ updated_at: "2025-01-01T00:00:00Z" });
    expect(timestamp).toBe(Date.parse("2025-01-01T00:00:00Z"));
  });

  it("returns 0 for invalid thread timestamps", () => {
    const timestamp = getThreadTimestamp({ updated_at: "not-a-date" });
    expect(timestamp).toBe(0);
  });

  it("parses created timestamps", () => {
    const timestamp = getThreadCreatedTimestamp({ created_at: "2025-01-01T00:00:00Z" });
    expect(timestamp).toBe(Date.parse("2025-01-01T00:00:00Z"));
  });

  it("avoids duplicating skill tokens when text and type:skill coexist", () => {
    const item = buildConversationItemFromThreadItem({
      type: "userMessage",
      id: "msg-skill-1",
      content: [
        { type: "text", text: "Please run $deep_debug now" },
        { type: "skill", name: "deep_debug" },
      ],
    });

    expect(item).not.toBeNull();
    if (item && item.kind === "message") {
      expect(item.role).toBe("user");
      expect(item.text).toBe("Please run $deep_debug now");
    }
  });

  it("avoids duplicating unicode skill tokens when text and type:skill coexist", () => {
    const item = buildConversationItemFromThreadItem({
      type: "userMessage",
      id: "msg-skill-2",
      content: [
        { type: "text", text: "请执行 $深度调试模式" },
        { type: "skill", name: "深度调试模式" },
      ],
    });

    expect(item).not.toBeNull();
    if (item && item.kind === "message") {
      expect(item.role).toBe("user");
      expect(item.text).toBe("请执行 $深度调试模式");
    }
  });

  it("avoids duplicating spaced unicode skill tokens when text and type:skill coexist", () => {
    const item = buildConversationItemFromThreadItem({
      type: "userMessage",
      id: "msg-skill-3",
      content: [
        { type: "text", text: "请执行 $ 深度调试模式" },
        { type: "skill", name: "深度调试模式" },
      ],
    });

    expect(item).not.toBeNull();
    if (item && item.kind === "message") {
      expect(item.role).toBe("user");
      expect(item.text).toBe("请执行 $ 深度调试模式");
    }
  });

  it("avoids duplicating full-width-dollar unicode skill tokens when text and type:skill coexist", () => {
    const item = buildConversationItemFromThreadItem({
      type: "userMessage",
      id: "msg-skill-4",
      content: [
        { type: "text", text: "请执行 ＄深度调试模式" },
        { type: "skill", name: "深度调试模式" },
      ],
    });

    expect(item).not.toBeNull();
    if (item && item.kind === "message") {
      expect(item.role).toBe("user");
      expect(item.text).toBe("请执行 ＄深度调试模式");
    }
  });

  it("avoids duplicating skill names that contain spaces when text and type:skill coexist", () => {
    const item = buildConversationItemFromThreadItem({
      type: "userMessage",
      id: "msg-skill-5",
      content: [
        { type: "text", text: "Please run $my skill now" },
        { type: "skill", name: "my skill" },
      ],
    });

    expect(item).not.toBeNull();
    if (item && item.kind === "message") {
      expect(item.role).toBe("user");
      expect(item.text).toBe("Please run $my skill now");
    }
  });

  it("appends skill token when existing mention only shares a prefix", () => {
    const item = buildConversationItemFromThreadItem({
      type: "userMessage",
      id: "msg-skill-6",
      content: [
        { type: "text", text: "Please run $deep_debugger now" },
        { type: "skill", name: "deep_debug" },
      ],
    });

    expect(item).not.toBeNull();
    if (item && item.kind === "message") {
      expect(item.role).toBe("user");
      expect(item.text).toBe("Please run $deep_debugger now $deep_debug");
    }
  });

  it("does not duplicate skill mention when casing differs", () => {
    const item = buildConversationItemFromThreadItem({
      type: "userMessage",
      id: "msg-skill-7",
      content: [
        { type: "text", text: "Please run $Deep_Debug now" },
        { type: "skill", name: "deep_debug" },
      ],
    });

    expect(item).not.toBeNull();
    if (item && item.kind === "message") {
      expect(item.role).toBe("user");
      expect(item.text).toBe("Please run $Deep_Debug now");
    }
  });

  it("normalizes commandExecution started status to inProgress", () => {
    const item = buildConversationItem({
      type: "commandExecution",
      id: "cmd-status-1",
      status: "started",
      command: ["rg", "needle", "src"],
    });

    expect(item).not.toBeNull();
    if (item && item.kind === "tool") {
      expect(item.status).toBe("inProgress");
    }
  });

  it("normalizes fileChange skipped status to declined", () => {
    const item = buildConversationItem({
      type: "fileChange",
      id: "file-status-1",
      status: "skipped",
      changes: [],
    });

    expect(item).not.toBeNull();
    if (item && item.kind === "tool") {
      expect(item.status).toBe("declined");
    }
  });

  it("keeps mcpToolCall rejected status raw when no mcp mapping applies", () => {
    const item = buildConversationItem({
      type: "mcpToolCall",
      id: "mcp-status-1",
      server: "server-a",
      tool: "doThing",
      status: "rejected",
    });

    expect(item).not.toBeNull();
    if (item && item.kind === "tool") {
      expect(item.status).toBe("rejected");
    }
  });

  it("uses rg --files fallback label when no path operand exists", () => {
    const items: ConversationItem[] = [
      {
        id: "cmd-path-1",
        kind: "tool",
        toolType: "commandExecution",
        title: "Command: rg --files",
        detail: "",
        status: "completed",
        output: "",
      },
    ];

    const prepared = prepareThreadItems(items);
    expect(prepared).toHaveLength(1);
    expect(prepared[0].kind).toBe("explore");
    if (prepared[0].kind === "explore") {
      expect(prepared[0].entries).toHaveLength(1);
      expect(prepared[0].entries[0].kind).toBe("list");
      expect(prepared[0].entries[0].label).toBe("rg --files");
    }
  });

  it("keeps raw tool item when chained command contains unsupported segment", () => {
    const items: ConversationItem[] = [
      {
        id: "cmd-path-2",
        kind: "tool",
        toolType: "commandExecution",
        title: "Command: cat src/foo.ts && git status",
        detail: "",
        status: "completed",
        output: "",
      },
    ];

    const prepared = prepareThreadItems(items);
    expect(prepared).toHaveLength(1);
    expect(prepared[0].kind).toBe("tool");
  });

  it("truncates old diff output in prepareThreadItems while keeping recent full output", () => {
    const longDiff = "d".repeat(21050);
    const items: ConversationItem[] = Array.from({ length: 41 }, (_, index) => ({
      id: `tool-diff-${index}`,
      kind: "tool",
      toolType: "commandExecution",
      title: "Tool",
      detail: "",
      output: "",
      changes: [{ path: `file-${index}.txt`, diff: longDiff }],
    }));

    const prepared = prepareThreadItems(items);
    expect(prepared[0].kind).toBe("tool");
    expect(prepared[1].kind).toBe("tool");
    if (prepared[0].kind === "tool" && prepared[1].kind === "tool") {
      expect(prepared[0].changes?.[0]?.diff).not.toBe(longDiff);
      expect(prepared[0].changes?.[0]?.diff?.endsWith("...")).toBe(true);
      expect(prepared[1].changes?.[0]?.diff).toBe(longDiff);
    }
  });

  it("does not truncate old tool output at exact 20000-char boundary", () => {
    const exact = "o".repeat(20000);
    const items: ConversationItem[] = Array.from({ length: 41 }, (_, index) => ({
      id: `tool-boundary-${index}`,
      kind: "tool",
      toolType: "webSearch",
      title: "Tool",
      detail: "",
      output: exact,
    }));

    const prepared = prepareThreadItems(items);
    expect(prepared[0].kind).toBe("tool");
    if (prepared[0].kind === "tool") {
      expect(prepared[0].output).toBe(exact);
      expect(prepared[0].output?.endsWith("...")).toBe(false);
    }
  });

  it("truncates old tool output at 20001 chars to 20000 with ellipsis", () => {
    const over = "p".repeat(20001);
    const items: ConversationItem[] = Array.from({ length: 41 }, (_, index) => ({
      id: `tool-boundary-over-${index}`,
      kind: "tool",
      toolType: "webSearch",
      title: "Tool",
      detail: "",
      output: over,
    }));

    const prepared = prepareThreadItems(items);
    expect(prepared[0].kind).toBe("tool");
    if (prepared[0].kind === "tool") {
      expect(prepared[0].output).not.toBe(over);
      expect(prepared[0].output?.length).toBe(20000);
      expect(prepared[0].output?.endsWith("...")).toBe(true);
    }
  });

  it("does not append duplicate skill token when mention contains punctuation boundary", () => {
    const item = buildConversationItemFromThreadItem({
      type: "userMessage",
      id: "msg-skill-8",
      content: [
        { type: "text", text: "请执行 $深度调试模式，完成后汇报。" },
        { type: "skill", name: "深度调试模式" },
      ],
    });

    expect(item).not.toBeNull();
    if (item && item.kind === "message") {
      expect(item.role).toBe("user");
      expect(item.text).toBe("请执行 $深度调试模式，完成后汇报。");
    }
  });

  it("does not append duplicate skill token when mention uses multi-space separated words", () => {
    const item = buildConversationItemFromThreadItem({
      type: "userMessage",
      id: "msg-skill-9",
      content: [
        { type: "text", text: "Please run $deep    debug   mode right away" },
        { type: "skill", name: "deep debug mode" },
      ],
    });

    expect(item).not.toBeNull();
    if (item && item.kind === "message") {
      expect(item.role).toBe("user");
      expect(item.text).toBe("Please run $deep    debug   mode right away");
    }
  });

  it("builds items from turns and drops invalid thread items", () => {
    const items = buildItemsFromThread({
      turns: [
        {
          items: [
            { type: "userMessage", id: "u-1", content: [{ type: "text", text: "hello" }] },
            { type: "agentMessage", id: "a-1", content: [{ type: "output_text", text: "world" }] },
            { type: "agentMessage", id: "", content: [{ type: "output_text", text: "ignored" }] },
          ],
        },
      ],
    });

    expect(items).toHaveLength(2);
    expect(items[0].kind).toBe("message");
    expect(items[1].kind).toBe("message");
  });

  it("tracks latest review mode state from thread history", () => {
    expect(
      isReviewingFromThread({
        turns: [
          { items: [{ type: "enteredReviewMode" }] },
          { items: [{ type: "exitedReviewMode" }] },
          { items: [{ type: "enteredReviewMode" }] },
        ],
      }),
    ).toBe(true);
    expect(
      isReviewingFromThread({
        turns: [{ items: [{ type: "enteredReviewMode" }, { type: "exitedReviewMode" }] }],
      }),
    ).toBe(false);
  });

  it("prefers local richer reasoning and diff content during merge", () => {
    const mergedReasoning = mergeThreadItems(
      [{ id: "r-1", kind: "reasoning", summary: "a", content: "b" }],
      [{ id: "r-1", kind: "reasoning", summary: "long", content: "content-expanded" }],
    );
    expect(mergedReasoning).toHaveLength(1);
    expect(mergedReasoning[0].kind).toBe("reasoning");
    if (mergedReasoning[0].kind === "reasoning") {
      expect(mergedReasoning[0].summary).toBe("long");
      expect(mergedReasoning[0].content).toBe("content-expanded");
    }

    const mergedDiff = mergeThreadItems(
      [{ id: "d-1", kind: "diff", title: "f.ts", diff: "a", status: null }],
      [{ id: "d-1", kind: "diff", title: "f.ts", diff: "expanded-diff", status: "completed" }],
    );
    expect(mergedDiff).toHaveLength(1);
    expect(mergedDiff[0].kind).toBe("diff");
    if (mergedDiff[0].kind === "diff") {
      expect(mergedDiff[0].diff).toBe("expanded-diff");
      expect(mergedDiff[0].status).toBe("completed");
    }
  });

});
