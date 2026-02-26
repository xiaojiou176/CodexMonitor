#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const DRY_RUN = process.argv.includes("--dry-run");
const MODE_ARG = process.argv.find((arg) => arg.startsWith("--mode="));
const ENFORCE_ARG = process.argv.find((arg) => arg.startsWith("--enforce="));
const MODE = MODE_ARG ? MODE_ARG.split("=")[1] : "staged";
const ENFORCE = ENFORCE_ARG ? ENFORCE_ARG.split("=")[1] : "fail";

const NON_GEMINI_HINTS = [
  /\bgpt-[\w-]+\b/i,
  /\bopenai\b/i,
  /\banthropic\b/i,
  /\bclaude\b/i,
  /\bqwen\b/i,
  /\bdeepseek\b/i,
  /\bllama\b/i,
  /\bmistral\b/i,
  /\bcompat(?:ibility)?\b/i,
  /\bfallback\b/i,
  /非Gemini|非默认/i,
];

const NOTE_FILE_PATTERNS = [
  /^README\.md$/,
  /^CHANGELOG\.md$/,
  /^AGENTS\.md$/,
  /^CLAUDE\.md$/,
  /^docs\/.+\.(?:md|txt)$/,
  /(?:^|\/)(?:pr|pull[_-]?request|change(?:log)?|audit|report|summary|evidence|handoff)[^/]*\.(?:md|txt|json)$/i,
];

const REQUIRED_FIELDS = [
  {
    key: "trigger_reason",
    regex: /(trigger\s*(reason|condition)|触发原因|触发条件|compat(?:ibility)?[_-]?trigger[_-]?reason)/i,
    label: "触发原因",
  },
  {
    key: "rollback_condition",
    regex: /(rollback\s*(condition|plan)|回退条件|回滚条件|回退策略|compat(?:ibility)?[_-]?rollback)/i,
    label: "回退条件",
  },
  {
    key: "result_diff",
    regex: /(result\s*diff|结果差异|差异说明|impact\s*diff|compat(?:ibility)?[_-]?result[_-]?diff)/i,
    label: "结果差异",
  },
];

function runGit(args) {
  const result = spawnSync("git", args, { encoding: "utf8" });
  if (result.error) {
    throw new Error(`git ${args.join(" ")} failed to start: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || `git ${args.join(" ")} failed`);
  }
  return result.stdout;
}

function tryGit(args) {
  const result = spawnSync("git", args, { encoding: "utf8" });
  if (result.error || result.status !== 0) {
    return null;
  }
  return result.stdout.trim();
}

function parseFiles(stdout) {
  return stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function resolveBaseRef() {
  const upstream = tryGit(["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"]);
  if (upstream) return upstream;

  const defaultRemote = tryGit(["symbolic-ref", "--quiet", "--short", "refs/remotes/origin/HEAD"]);
  if (defaultRemote) return defaultRemote;

  return "origin/main";
}

function getChangedFilesAndPatch() {
  if (MODE === "staged") {
    return {
      files: parseFiles(runGit(["diff", "--name-only", "--cached"])),
      patch: runGit(["diff", "--cached", "--unified=0", "--no-color", "--no-ext-diff"]),
    };
  }

  if (MODE === "branch") {
    const baseRef = resolveBaseRef();
    const mergeBase = tryGit(["merge-base", baseRef, "HEAD"]);
    if (!mergeBase) {
      throw new Error(`Unable to resolve merge-base against ${baseRef}`);
    }
    return {
      files: parseFiles(runGit(["diff", "--name-only", `${mergeBase}..HEAD`])),
      patch: runGit(["diff", "--unified=0", "--no-color", "--no-ext-diff", `${mergeBase}..HEAD`]),
    };
  }

  throw new Error(`Unsupported mode \"${MODE}\". Expected --mode=staged or --mode=branch`);
}

function addedLinesOnly(patch) {
  return patch
    .split("\n")
    .filter((line) => line.startsWith("+") && !line.startsWith("+++"))
    .map((line) => line.slice(1));
}

function isNoteFile(file) {
  return NOTE_FILE_PATTERNS.some((pattern) => pattern.test(file));
}

function readTextSafe(file) {
  try {
    return readFileSync(file, "utf8");
  } catch {
    return "";
  }
}

function maybeFail(message) {
  if (ENFORCE === "warn" || DRY_RUN) {
    console.warn(`[compat-option] WARN: ${message}`);
    return;
  }
  console.error(`[compat-option] FAIL: ${message}`);
  process.exit(1);
}

function main() {
  if (!["fail", "warn"].includes(ENFORCE)) {
    throw new Error(`Unsupported --enforce=${ENFORCE}. Expected warn|fail.`);
  }

  const { files, patch } = getChangedFilesAndPatch();
  if (files.length === 0) {
    console.log(`[compat-option] No ${MODE} changes. Skipping.`);
    return;
  }

  const added = addedLinesOnly(patch);
  const nonGeminiDetected = added.some((line) => NON_GEMINI_HINTS.some((pattern) => pattern.test(line)));

  if (!nonGeminiDetected) {
    console.log(`[compat-option] (${MODE}) Gemini-only default preserved. Gate passed.`);
    return;
  }

  const noteFiles = files.filter((file) => isNoteFile(file));
  if (noteFiles.length === 0) {
    maybeFail("Detected non-Gemini/compatibility change without any opt-in note or audit file update.");
    return;
  }

  const mergedNoteText = noteFiles.map((file) => readTextSafe(file)).join("\n");
  const missing = REQUIRED_FIELDS.filter((field) => !field.regex.test(mergedNoteText));

  if (missing.length > 0) {
    maybeFail(`Missing compatibility opt-in record fields: ${missing.map((item) => item.label).join(", ")}.`);
    return;
  }

  console.log(`[compat-option] (${MODE}) opt-in record complete (${ENFORCE} mode).`);
}

try {
  main();
} catch (error) {
  console.error("[compat-option] Failed:", error instanceof Error ? error.message : String(error));
  process.exit(2);
}
