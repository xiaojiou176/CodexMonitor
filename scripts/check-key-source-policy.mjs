#!/usr/bin/env node

import { execFileSync } from "node:child_process";

const FORBIDDEN_SOURCE_PATTERNS = [
  {
    name: "localStorage/sessionStorage secret source",
    regex: /\b(localStorage|sessionStorage)\.getItem\([^)]*(key|token|secret|password)/i,
  },
  {
    name: "document.cookie secret source",
    regex: /\bdocument\.cookie\b.*(key|token|secret|password)/i,
  },
  {
    name: "URL query secret source",
    regex: /\bURLSearchParams\b.*\.get\(["'`](api[_-]?key|token|secret|password)["'`]\)/i,
  },
  {
    name: "hardcoded key literal variable",
    regex: /\b[A-Z0-9_]*(API[_-]?KEY|TOKEN|SECRET|PASSWORD)\b\s*[:=]\s*['"][^'"]{8,}['"]/,
  },
];

const ALLOWED_SOURCE_HINTS = [
  "process.env",
  "import.meta.env",
  "dotenv",
  ".env",
  ".env.local",
];
const POLICY_EXEMPT_PATHS = [
  "scripts/check-key-source-policy.mjs",
];
const POLICY_EXEMPT_FILE_PATTERN = /\.test\.[cm]?[jt]sx?$/;

function runGit(args) {
  return execFileSync("git", args, { encoding: "utf8" });
}

function getStagedPatch() {
  return runGit(["diff", "--cached", "--unified=0", "--no-color", "--no-ext-diff"]);
}

function scanForbiddenSources(patchText) {
  const findings = [];
  const lines = patchText.split("\n");
  let currentFile = "";
  let newLineNumber = 0;

  for (const line of lines) {
    if (line.startsWith("+++ b/")) {
      currentFile = line.slice("+++ b/".length).trim();
      continue;
    }
    if (line.startsWith("@@")) {
      const match = line.match(/\+(\d+)(?:,\d+)?/);
      newLineNumber = match ? Number(match[1]) : 0;
      continue;
    }
    if (line.startsWith("+") && !line.startsWith("+++")) {
      const content = line.slice(1);
      const isPolicyExemptFile =
        POLICY_EXEMPT_PATHS.includes(currentFile) ||
        POLICY_EXEMPT_FILE_PATTERN.test(currentFile);
      if (isPolicyExemptFile) {
        newLineNumber += 1;
        continue;
      }
      for (const pattern of FORBIDDEN_SOURCE_PATTERNS) {
        if (pattern.regex.test(content)) {
          findings.push({
            file: currentFile || "<unknown>",
            line: newLineNumber,
            pattern: pattern.name,
          });
          break;
        }
      }
      newLineNumber += 1;
      continue;
    }
    if (line.startsWith(" ")) {
      newLineNumber += 1;
    }
  }

  return findings;
}

function main() {
  const patch = getStagedPatch();
  if (!patch.trim()) {
    console.log("[security][key-source] no staged diff, skipped.");
    return;
  }

  const findings = scanForbiddenSources(patch);
  if (findings.length === 0) {
    console.log("[security][key-source] policy check passed.");
    return;
  }

  console.error("[security][key-source] blocked. key source policy violated.");
  for (const item of findings) {
    console.error(`  - ${item.file}:${item.line} (${item.pattern})`);
  }
  console.error(`  allowed key sources: ${ALLOWED_SOURCE_HINTS.join(", ")}`);
  process.exit(1);
}

main();
