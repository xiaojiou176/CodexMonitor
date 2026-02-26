#!/usr/bin/env node

import { execFileSync } from "node:child_process";

const SECRET_PATTERNS = [
  { name: "OpenAI key", regex: /\bsk-[A-Za-z0-9]{20,}\b/ },
  { name: "GitHub token", regex: /\bgh[pousr]_[A-Za-z0-9]{20,}\b/ },
  { name: "AWS access key", regex: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: "Bearer token literal", regex: /\bBearer\s+[A-Za-z0-9._-]{20,}\b/i },
  { name: "Private key block", regex: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/ },
  {
    name: "Possible hardcoded credential assignment",
    regex: /\b(api[_-]?key|token|secret|password|passwd|private[_-]?key)\b.{0,24}[:=].{0,16}['"][^'"$\s][^'"]{7,}['"]/i,
  },
];

function runGit(args) {
  return execFileSync("git", args, { encoding: "utf8" });
}

function getStagedFiles() {
  const output = runGit(["diff", "--cached", "--name-only", "--diff-filter=ACMR"]);
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function getStagedPatch() {
  return runGit(["diff", "--cached", "--unified=0", "--no-color", "--no-ext-diff"]);
}

function isTrackedEnvFile(path) {
  const lower = path.toLowerCase();
  if (!lower.includes(".env")) return false;
  if (lower.endsWith(".env.example")) return false;
  if (lower.includes(".env.example.")) return false;
  if (lower.includes(".example.env")) return false;
  return /(^|\/)\.env($|[.])/.test(lower);
}

function scanPatchForSecrets(patchText) {
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
      for (const pattern of SECRET_PATTERNS) {
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
  const stagedFiles = getStagedFiles();
  if (stagedFiles.length === 0) {
    console.log("[security][secrets] no staged files, skipped.");
    return;
  }

  const blockedEnvFiles = stagedFiles.filter((path) => isTrackedEnvFile(path));
  const findings = scanPatchForSecrets(getStagedPatch());

  if (blockedEnvFiles.length === 0 && findings.length === 0) {
    console.log("[security][secrets] staged scan passed.");
    return;
  }

  console.error("[security][secrets] blocked. secret leak risk detected.");
  if (blockedEnvFiles.length > 0) {
    console.error("  - tracked env files are not allowed:");
    for (const path of blockedEnvFiles) {
      console.error(`    - ${path}`);
    }
  }
  if (findings.length > 0) {
    console.error("  - suspicious secret patterns in staged additions:");
    for (const item of findings) {
      console.error(`    - ${item.file}:${item.line} (${item.pattern})`);
    }
  }
  console.error("  hint: move secrets to local .env/.env.local or terminal env vars; keep tracked files template-safe.");
  process.exit(1);
}

main();
