function normalizeUrlLine(line: string) {
  const trimmed = line.trim();
  if (!trimmed) {
    return null;
  }
  const withoutBullet = trimmed.replace(/^(?:[-*]|\d+\.)\s+/, "");
  if (!/^https?:\/\/\S+$/i.test(withoutBullet)) {
    return null;
  }
  return withoutBullet;
}

export function extractUrlLines(value: string) {
  const lines = value.split(/\r?\n/);
  const urls = lines
    .map((line) => normalizeUrlLine(line))
    .filter((line): line is string => Boolean(line));
  const nonEmptyLines = lines.filter((line) => line.trim().length > 0);
  if (nonEmptyLines.length === 0) {
    return null;
  }
  if (urls.length !== nonEmptyLines.length) {
    return null;
  }
  return urls;
}

type StateDumpFieldConfig = {
  tag: "task" | "phase" | "files_modified" | "pending" | "blockers";
  label: string;
  kind: "text" | "list";
  format?: (value: string) => string;
};

const STATE_DUMP_FIELDS: StateDumpFieldConfig[] = [
  { tag: "task", label: "任务", kind: "text" },
  { tag: "phase", label: "阶段", kind: "text" },
  {
    tag: "files_modified",
    label: "文件修改",
    kind: "list",
    format: (value) => `\`${value}\``,
  },
  { tag: "pending", label: "待处理", kind: "list" },
  { tag: "blockers", label: "阻塞", kind: "text" },
];

function parseStateDumpListValue(rawValue: string) {
  const trimmed = rawValue.trim();
  if (!trimmed) {
    return [];
  }

  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => String(item).trim())
          .filter((item) => item.length > 0);
      }
    } catch {
      const quotedItems = Array.from(
        trimmed.matchAll(/["']([^"']+)["']/g),
        (match) => match[1].trim(),
      ).filter((item) => item.length > 0);
      if (quotedItems.length > 0) {
        return quotedItems;
      }
    }
  }

  return trimmed
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*[-*+]\s+/, "").trim())
    .filter((line) => line.length > 0);
}

function parseStateDumpField(block: string, tag: StateDumpFieldConfig["tag"]) {
  const fieldPattern = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, "i");
  const match = block.match(fieldPattern);
  if (!match) {
    return null;
  }
  const rawValue = match[1].trim();
  return rawValue.length > 0 ? rawValue : null;
}

function toStateDumpMarkdown(fullMatch: string, block: string) {
  const lines = ["### 状态快照"];

  for (const field of STATE_DUMP_FIELDS) {
    const rawValue = parseStateDumpField(block, field.tag);
    if (!rawValue) {
      continue;
    }

    const values =
      field.kind === "list"
        ? parseStateDumpListValue(rawValue)
        : [rawValue.replace(/\s+/g, " ")];
    if (values.length === 0) {
      continue;
    }

    lines.push(`- ${field.label}`);
    for (const value of values) {
      lines.push(`  - ${field.format ? field.format(value) : value}`);
    }
  }

  if (lines.length === 1) {
    return fullMatch;
  }

  return `\n${lines.join("\n")}\n`;
}

export function normalizeStateDumpBlocks(value: string) {
  const segments = value.split(/(```[\s\S]*?```|~~~[\s\S]*?~~~)/g);
  return segments
    .map((segment, index) => {
      if (index % 2 === 1) {
        return segment;
      }
      return segment.replace(
        /<state_dump\b[^>]*>([\s\S]*?)<\/state_dump>/gi,
        (fullMatch, block) => toStateDumpMarkdown(fullMatch, block),
      );
    })
    .join("");
}

function isQuestionListItem(content: string) {
  const trimmed = content.trim();
  return (
    /^Q\d+\b/i.test(trimmed) ||
    /^Q\s*[:：]/i.test(trimmed) ||
    /^Question\s*\d*\b/i.test(trimmed) ||
    /^问题\s*\d*/.test(trimmed)
  );
}

function extractQaOptionToken(content: string) {
  const trimmed = content.trim();
  const optionMatch = trimmed.match(/^(?:选项\s*)?([A-H])(?:[).:：、]|\s)\s*(.+)$/i);
  if (!optionMatch) {
    return null;
  }
  if (!optionMatch[2]?.trim()) {
    return null;
  }
  return optionMatch[1].toUpperCase();
}

function isQaOptionDetailListItem(content: string) {
  const trimmed = content.trim();
  return /^(?:含义|动作|影响成本|影响\/成本|影响|成本|代价|风险|建议|说明|解释|why|how|impact|cost|trade-?off)\s*[:：]/i.test(
    trimmed,
  );
}

function normalizeQaOptionHierarchy(value: string) {
  const lines = value.split(/\r?\n/);
  let inFence = false;
  let activeQuestionIndent: number | null = null;
  let activeOptionSourceIndent: number | null = null;
  let activeOptionTargetIndent: number | null = null;
  let hasSeenOption = false;
  let hasSeenDetail = false;
  const spaces = (count: number) => " ".repeat(Math.max(0, count));

  const resetQaContext = () => {
    activeQuestionIndent = null;
    activeOptionSourceIndent = null;
    activeOptionTargetIndent = null;
    hasSeenOption = false;
    hasSeenDetail = false;
  };

  const normalized = lines.map((line) => {
    const fenceMatch = line.match(/^\s*(```|~~~)/);
    if (fenceMatch) {
      inFence = !inFence;
      resetQaContext();
      return line;
    }
    if (inFence || !line.trim()) {
      return line;
    }

    const listMatch = line.match(/^(\s*)([-*+]|\d+\.)\s+(.*)$/);
    if (!listMatch) {
      const leadingSpaces = line.match(/^\s*/)?.[0].length ?? 0;
      if (leadingSpaces === 0) {
        resetQaContext();
      }
      return line;
    }

    const rawIndent = listMatch[1].length;
    const marker = listMatch[2];
    const body = listMatch[3].trim();
    const renderLine = (indent: number) => `${spaces(indent)}${marker} ${body}`;

    if (isQuestionListItem(body)) {
      activeQuestionIndent = rawIndent;
      activeOptionSourceIndent = null;
      activeOptionTargetIndent = null;
      hasSeenOption = false;
      hasSeenDetail = false;
      return line;
    }

    if (activeQuestionIndent === null) {
      return line;
    }

    const optionToken = extractQaOptionToken(body);
    if (optionToken) {
      const optionIndent = activeQuestionIndent + 4;
      hasSeenOption = true;
      activeOptionSourceIndent = rawIndent;
      activeOptionTargetIndent = optionIndent;
      if (rawIndent !== optionIndent) {
        return renderLine(optionIndent);
      }
      return line;
    }

    if (
      hasSeenOption &&
      activeOptionTargetIndent !== null &&
      isQaOptionDetailListItem(body)
    ) {
      hasSeenDetail = true;
      const detailIndent = activeOptionTargetIndent + 4;
      if (rawIndent !== detailIndent) {
        return renderLine(detailIndent);
      }
      return line;
    }

    if (rawIndent <= activeQuestionIndent) {
      resetQaContext();
      return line;
    }

    if (
      activeOptionSourceIndent !== null &&
      rawIndent <= activeOptionSourceIndent &&
      !(hasSeenDetail && isQaOptionDetailListItem(body))
    ) {
      activeOptionSourceIndent = null;
      activeOptionTargetIndent = null;
    }

    return line;
  });

  return normalized.join("\n");
}

export function normalizeListIndentation(value: string) {
  const lines = value.split(/\r?\n/);
  let inFence = false;
  let activeOrderedItem = false;
  let orderedBaseIndent = 4;
  let orderedIndentOffset: number | null = null;

  const countLeadingSpaces = (line: string) =>
    line.match(/^\s*/)?.[0].length ?? 0;
  const spaces = (count: number) => " ".repeat(Math.max(0, count));
  const normalized = lines.map((line) => {
    const fenceMatch = line.match(/^\s*(```|~~~)/);
    if (fenceMatch) {
      inFence = !inFence;
      activeOrderedItem = false;
      orderedIndentOffset = null;
      return line;
    }
    if (inFence || !line.trim()) {
      return line;
    }

    const orderedMatch = line.match(/^(\s*)\d+\.\s+/);
    if (orderedMatch) {
      const rawIndent = orderedMatch[1].length;
      const normalizedIndent =
        rawIndent > 0 && rawIndent < 4 ? 4 : rawIndent;
      activeOrderedItem = true;
      orderedBaseIndent = normalizedIndent + 4;
      orderedIndentOffset = null;
      if (normalizedIndent !== rawIndent) {
        return `${spaces(normalizedIndent)}${line.trimStart()}`;
      }
      return line;
    }

    const bulletMatch = line.match(/^(\s*)([-*+])\s+/);
    if (bulletMatch) {
      const rawIndent = bulletMatch[1].length;
      let targetIndent = rawIndent;

      if (!activeOrderedItem && rawIndent > 0 && rawIndent < 4) {
        targetIndent = 4;
      }

      if (activeOrderedItem) {
        if (orderedIndentOffset === null && rawIndent < orderedBaseIndent) {
          orderedIndentOffset = orderedBaseIndent - rawIndent;
        }
        if (orderedIndentOffset !== null) {
          const adjustedIndent = rawIndent + orderedIndentOffset;
          if (adjustedIndent <= orderedBaseIndent + 12) {
            targetIndent = adjustedIndent;
          }
        }
      }

      if (targetIndent !== rawIndent) {
        return `${spaces(targetIndent)}${line.trimStart()}`;
      }
      return line;
    }

    const leadingSpaces = countLeadingSpaces(line);
    if (activeOrderedItem && leadingSpaces < orderedBaseIndent) {
      activeOrderedItem = false;
      orderedIndentOffset = null;
    }
    return line;
  });
  return normalizeQaOptionHierarchy(normalized.join("\n"));
}
