#!/usr/bin/env node

import { execFileSync } from "node:child_process";

const MODE_RAW = (process.env.CRITICAL_LOG_GUARD_MODE ?? "warn").toLowerCase();
const MODE = MODE_RAW === "fail" ? "fail" : "warn";
const BYPASS = process.env.CRITICAL_LOG_GUARD_BYPASS === "1";
const DRY_RUN = process.argv.includes("--dry-run");

const SOURCE_FILE_RE = /\.(ts|tsx|js|jsx|mjs|cjs|rs)$/;
const CATCH_BLOCK_RE = /\bcatch\s*(?:\([^)]*\))?\s*\{/;
const THIRD_PARTY_API_RE = /\b(fetch\s*\(|axios\.(?:get|post|put|patch|delete|request)\s*\(|reqwest::|\.send\s*\()/;
const LOG_LINE_RE = /(logger\.|console\.(?:error|warn|info)|log\.(?:error|warn|info)|(?:tracing::)?(?:error|warn|info)!?\s*\()/;
const TRACE_FIELD_RE = /\b(traceId|trace_id|requestId|request_id)\b/;
const ERROR_FIELD_RE = /\b(error|err|code|status|statusCode|http_status)\b/;
const CONTEXT_WINDOW = 8;
const MAX_REPORTS = 20;

function runGit(args) {
  return execFileSync("git", args, { encoding: "utf8" });
}

function getStagedFiles() {
  const output = runGit(["diff", "--cached", "--name-only", "--diff-filter=ACMR"]);
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && SOURCE_FILE_RE.test(line));
}

function getStagedPatch() {
  return runGit(["diff", "--cached", "--unified=0", "--no-color", "--no-ext-diff"]);
}

function getStagedFileContent(filePath) {
  try {
    return runGit(["show", `:${filePath}`]);
  } catch {
    return "";
  }
}

function parseTargetsByFile(patchText) {
  const targets = new Map();
  const lines = patchText.split("\n");
  let currentFile = "";
  let newLineNumber = 0;

  for (const rawLine of lines) {
    if (rawLine.startsWith("+++ b/")) {
      currentFile = rawLine.slice("+++ b/".length).trim();
      continue;
    }

    if (rawLine.startsWith("@@")) {
      const match = rawLine.match(/\+(\d+)(?:,\d+)?/);
      newLineNumber = match ? Number(match[1]) : 0;
      continue;
    }

    if (rawLine.startsWith("+") && !rawLine.startsWith("+++")) {
      const content = rawLine.slice(1);
      const trimmed = content.trim();
      if (trimmed.startsWith("//") || trimmed.startsWith("#") || trimmed.startsWith("/*") || trimmed.startsWith("*")) {
        newLineNumber += 1;
        continue;
      }

      let type = "";
      if (CATCH_BLOCK_RE.test(content)) {
        type = "catch-block";
      } else if (THIRD_PARTY_API_RE.test(content)) {
        type = "third-party-api";
      }

      if (type) {
        if (!targets.has(currentFile)) {
          targets.set(currentFile, []);
        }
        targets.get(currentFile).push({ line: newLineNumber, type, snippet: trimmed.slice(0, 180) });
      }

      newLineNumber += 1;
      continue;
    }

    if (rawLine.startsWith(" ")) {
      newLineNumber += 1;
    }
  }

  return targets;
}

function hasStructuredLogNearby(fileLines, lineNumber) {
  const start = Math.max(1, lineNumber - CONTEXT_WINDOW);
  const end = Math.min(fileLines.length, lineNumber + CONTEXT_WINDOW);

  for (let i = start; i <= end; i += 1) {
    const line = fileLines[i - 1] ?? "";
    if (!LOG_LINE_RE.test(line)) {
      continue;
    }

    const windowText = fileLines.slice(i - 1, Math.min(fileLines.length, i + 3)).join("\n");
    if (TRACE_FIELD_RE.test(windowText) && ERROR_FIELD_RE.test(windowText)) {
      return true;
    }
  }

  return false;
}

function evaluate(targetsByFile) {
  const violations = [];
  let targetCount = 0;

  for (const [file, targets] of targetsByFile.entries()) {
    const fileContent = getStagedFileContent(file);
    if (!fileContent) {
      continue;
    }

    const lines = fileContent.split("\n");
    for (const target of targets) {
      targetCount += 1;
      if (!hasStructuredLogNearby(lines, target.line)) {
        violations.push({
          file,
          line: target.line,
          type: target.type,
          snippet: target.snippet,
        });
      }
    }
  }

  return { violations, targetCount };
}

function printFindings(header, findings) {
  console.error(header);
  for (const item of findings.slice(0, MAX_REPORTS)) {
    console.error(`  - ${item.file}:${item.line} [${item.type}] ${item.snippet}`);
  }
  if (findings.length > MAX_REPORTS) {
    console.error(`  - ...and ${findings.length - MAX_REPORTS} more`);
  }
}

function main() {
  if (BYPASS) {
    console.warn("[security][critical-logging] bypassed via CRITICAL_LOG_GUARD_BYPASS=1");
    return;
  }

  const files = getStagedFiles();
  if (files.length === 0) {
    console.log("[security][critical-logging] no staged source files, skipped.");
    return;
  }

  const patch = getStagedPatch();
  if (!patch.trim()) {
    console.log("[security][critical-logging] no staged diff, skipped.");
    return;
  }

  const targetsByFile = parseTargetsByFile(patch);
  const matchedFiles = [...targetsByFile.keys()].filter((file) => files.includes(file));

  if (matchedFiles.length === 0) {
    console.log("[security][critical-logging] no critical-path additions detected, passed.");
    return;
  }

  if (DRY_RUN) {
    const previewTargetCount = matchedFiles.reduce((count, file) => count + (targetsByFile.get(file)?.length ?? 0), 0);
    console.log(`[security][critical-logging][dry-run] mode=${MODE} staged_files=${files.length} targets=${previewTargetCount}`);
    return;
  }

  const scopedTargets = new Map(matchedFiles.map((file) => [file, targetsByFile.get(file) ?? []]));
  const { violations, targetCount } = evaluate(scopedTargets);

  if (violations.length === 0) {
    console.log(`[security][critical-logging] passed (${targetCount} critical path checks).`);
    return;
  }

  const modeLabel = MODE === "fail" ? "enforced" : "warn-only";
  const header = `[security][critical-logging] ${modeLabel}: missing structured log fields near critical path.`;

  if (MODE === "fail") {
    printFindings(header, violations);
    console.error("  required fields around logging: traceId/requestId + error/code/status.");
    console.error("  switch to warn mode: CRITICAL_LOG_GUARD_MODE=warn");
    process.exit(1);
  }

  console.warn(header);
  for (const item of violations.slice(0, MAX_REPORTS)) {
    console.warn(`  - ${item.file}:${item.line} [${item.type}] ${item.snippet}`);
  }
  if (violations.length > MAX_REPORTS) {
    console.warn(`  - ...and ${violations.length - MAX_REPORTS} more`);
  }
  console.warn("  currently warn-only. set CRITICAL_LOG_GUARD_MODE=fail to enforce.");
}

main();
