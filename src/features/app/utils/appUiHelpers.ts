import type { GitFileStatus } from "../../../types";

export const MESSAGE_FONT_SIZE_STORAGE_NAME = "codexmonitor.messageFontSize";
const MESSAGE_FONT_SIZE_MIN = 11;
const MESSAGE_FONT_SIZE_MAX = 16;
const MESSAGE_FONT_SIZE_DEFAULT = 13;

export type DiffLineStats = {
  additions: number;
  deletions: number;
};

export function clampMessageFontSize(value: number): number {
  if (!Number.isFinite(value)) {
    return MESSAGE_FONT_SIZE_DEFAULT;
  }
  return Math.min(
    MESSAGE_FONT_SIZE_MAX,
    Math.max(MESSAGE_FONT_SIZE_MIN, Math.round(value)),
  );
}

export function loadMessageFontSize(): number {
  if (typeof window === "undefined") {
    return MESSAGE_FONT_SIZE_DEFAULT;
  }
  try {
    const raw = window.localStorage.getItem(MESSAGE_FONT_SIZE_STORAGE_NAME);
    if (!raw) {
      return MESSAGE_FONT_SIZE_DEFAULT;
    }
    return clampMessageFontSize(Number(raw));
  } catch (error) {
    const traceId = `font-size-storage-${Date.now()}`;
    console.warn("[app-ui][font-size-load-failed]", {
      traceId,
      requestId: traceId,
      status: "failed",
      error: error instanceof Error ? error.message : String(error),
      storage: MESSAGE_FONT_SIZE_STORAGE_NAME,
    });
    return MESSAGE_FONT_SIZE_DEFAULT;
  }
}

export function countDiffLineStats(diffText: string): DiffLineStats {
  let additions = 0;
  let deletions = 0;
  for (const line of diffText.split("\n")) {
    if (
      !line ||
      line.startsWith("+++") ||
      line.startsWith("---") ||
      line.startsWith("diff --git") ||
      line.startsWith("@@") ||
      line.startsWith("index ") ||
      line.startsWith("\\ No newline")
    ) {
      continue;
    }
    if (line.startsWith("+")) {
      additions += 1;
    } else if (line.startsWith("-")) {
      deletions += 1;
    }
  }
  return { additions, deletions };
}

export function applyDiffStatsToFiles(
  files: GitFileStatus[],
  statsByPath: Record<string, DiffLineStats>,
): GitFileStatus[] {
  return files.map((file) => {
    const stats = statsByPath[file.path];
    if (!stats) {
      return file;
    }
    return {
      ...file,
      additions: stats.additions,
      deletions: stats.deletions,
    };
  });
}
