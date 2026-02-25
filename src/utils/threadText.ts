import type { ConversationItem, ThreadToolOutputMode, ThreadTranscriptOptions } from "../types";

// ── Markdown transcript builder ──
// Produces a well-structured Markdown document when copying a conversation,
// with clear visual separation between user messages, assistant responses,
// reasoning blocks, and tool calls.

function formatMessage(item: Extract<ConversationItem, { kind: "message" }>) {
  if (item.role === "user") {
    return `### 🧑 用户\n\n${item.text}`;
  }
  return `### 🤖 Codex\n\n${item.text}`;
}

function formatReasoning(item: Extract<ConversationItem, { kind: "reasoning" }>) {
  const parts: string[] = [];
  if (item.summary) {
    parts.push(item.summary);
  }
  if (item.content) {
    parts.push(item.content);
  }
  if (parts.length === 0) {
    return "";
  }
  return `<details>\n<summary>💭 推理过程</summary>\n\n${parts.join("\n\n")}\n\n</details>`;
}

function formatTool(
  item: Extract<ConversationItem, { kind: "tool" }>,
  mode: Exclude<ThreadToolOutputMode, "none">,
) {
  const sections: string[] = [];

  // Header with status indicator
  const statusIcon =
    item.status === "completed"
      ? "✅"
      : item.status === "failed"
        ? "❌"
        : "⏳";
  sections.push(`#### ${statusIcon} ${item.title}`);

  // Command / detail as code block
  if (item.detail) {
    sections.push(`\`\`\`\n${item.detail}\n\`\`\``);
  }

  // Output — only included in detailed mode
  if (mode === "detailed" && item.output && item.output.trim().length > 0) {
    const trimmedOutput = item.output.trim();
    if (trimmedOutput.split("\n").length > 10) {
      sections.push(
        `<details>\n<summary>输出（点击展开）</summary>\n\n\`\`\`\n${trimmedOutput}\n\`\`\`\n\n</details>`,
      );
    } else {
      sections.push(`\`\`\`\n${trimmedOutput}\n\`\`\``);
    }
  }

  if (
    mode === "compact" &&
    typeof item.durationMs === "number" &&
    Number.isFinite(item.durationMs)
  ) {
    sections.push(`**耗时：** ${item.durationMs}ms`);
  }

  // File changes
  if (item.changes && item.changes.length > 0) {
    const changeLines = item.changes
      .map((change) => `- \`${change.path}\`${change.kind ? ` (${change.kind})` : ""}`)
      .join("\n");
    sections.push(`**变更文件：**\n${changeLines}`);
  }

  return sections.join("\n\n");
}

function formatDiff(item: Extract<ConversationItem, { kind: "diff" }>) {
  const statusIcon =
    item.status === "completed"
      ? "✅"
      : item.status === "failed"
        ? "❌"
        : "📝";
  const header = `#### ${statusIcon} Diff: ${item.title}`;
  if (!item.diff || item.diff.trim().length === 0) {
    return header;
  }
  return `${header}\n\n\`\`\`diff\n${item.diff.trim()}\n\`\`\``;
}

function formatReview(item: Extract<ConversationItem, { kind: "review" }>) {
  const stateLabel =
    item.state === "completed"
      ? "✅ 审查完成"
      : "📋 审查中";
  return `#### ${stateLabel}\n\n${item.text}`;
}

function formatExplore(item: Extract<ConversationItem, { kind: "explore" }>) {
  const title = item.status === "exploring" ? "🔍 探索中" : "🔍 已探索";
  const lines = item.entries.map((entry) => {
    const prefix = entry.kind[0].toUpperCase() + entry.kind.slice(1);
    return `- **${prefix}** \`${entry.label}\`${entry.detail ? ` — ${entry.detail}` : ""}`;
  });
  return [`#### ${title}`, ...lines].join("\n");
}

function resolveToolOutputMode(options?: ThreadTranscriptOptions): ThreadToolOutputMode {
  if (options?.toolOutputMode) {
    return options.toolOutputMode;
  }
  // Backward compat: old includeToolOutput=false means compact mode.
  if (options?.includeToolOutput === false) {
    return "compact";
  }
  return "detailed";
}

export function buildThreadTranscript(
  items: ConversationItem[],
  options?: ThreadTranscriptOptions,
) {
  const includeUserInput = options?.includeUserInput !== false;
  const includeAssistantMessages = options?.includeAssistantMessages !== false;
  const toolOutputMode = resolveToolOutputMode(options);

  return items
    .map((item) => {
      switch (item.kind) {
        case "message":
          if (item.role === "user" && !includeUserInput) {
            return "";
          }
          if (item.role === "assistant" && !includeAssistantMessages) {
            return "";
          }
          return formatMessage(item);
        case "reasoning":
          return formatReasoning(item);
        case "explore":
          if (toolOutputMode === "none") {
            return "";
          }
          return formatExplore(item);
        case "tool":
          if (toolOutputMode === "none") {
            return "";
          }
          return formatTool(item, toolOutputMode);
        case "diff":
          if (toolOutputMode === "none") {
            return "";
          }
          return formatDiff(item);
        case "review":
          if (toolOutputMode === "none") {
            return "";
          }
          return formatReview(item);
      }
      return "";
    })
    .filter((value) => value.trim().length > 0)
    .join("\n\n---\n\n");
}
