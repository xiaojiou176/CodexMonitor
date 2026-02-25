#!/usr/bin/env node

import { spawnSync } from "node:child_process";

const DRY_RUN = process.argv.includes("--dry-run");

const DOC_FILES = [
  /^README\.md$/,
  /^AGENTS\.md$/,
  /^CLAUDE\.md$/,
  /^src\/AGENTS\.md$/,
  /^src\/CLAUDE\.md$/,
  /^src-tauri\/AGENTS\.md$/,
  /^src-tauri\/CLAUDE\.md$/,
  /^CHANGELOG\.md$/,
  /^docs\//,
];

const DOC_DRIFT_SENSITIVE = [
  /^src\//,
  /^src-tauri\//,
  /^package\.json$/,
  /^\.husky\//,
  /^scripts\//,
  /^vite\.config\.ts$/,
  /^playwright(?:\.[^/]+)?\.config\.ts$/,
  /^\.env\.example$/,
];

function getStagedFiles() {
  const result = spawnSync("git", ["diff", "--name-only", "--cached"], {
    encoding: "utf8",
  });

  if (result.error) {
    throw new Error(`Failed to inspect staged files: ${result.error.message}`);
  }

  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || "git diff --cached failed");
  }

  return result.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function matchesAny(patterns, file) {
  return patterns.some((pattern) => pattern.test(file));
}

function logList(title, values) {
  console.log(`[doc-drift] ${title}`);
  for (const value of values) {
    console.log(`  - ${value}`);
  }
}

function main() {
  const stagedFiles = getStagedFiles();

  if (stagedFiles.length === 0) {
    console.log("[doc-drift] No staged files. Skipping.");
    return;
  }

  const docsTouched = stagedFiles.filter((file) => matchesAny(DOC_FILES, file));
  const sensitiveTouched = stagedFiles.filter((file) => matchesAny(DOC_DRIFT_SENSITIVE, file));

  if (sensitiveTouched.length === 0) {
    console.log("[doc-drift] No doc-sensitive staged changes. Gate passed.");
    return;
  }

  if (docsTouched.length > 0) {
    console.log("[doc-drift] Doc-sensitive changes detected and docs were updated. Gate passed.");
    if (DRY_RUN) {
      logList("Sensitive files", sensitiveTouched);
      logList("Docs files", docsTouched);
    }
    return;
  }

  console.error("[doc-drift] Doc-sensitive changes detected without staged docs updates.");
  logList("Sensitive files", sensitiveTouched);
  console.error(
    "[doc-drift] Stage at least one doc file (README.md / AGENTS.md / CLAUDE.md / src/{AGENTS,CLAUDE}.md / src-tauri/{AGENTS,CLAUDE}.md / CHANGELOG.md / docs/*).",
  );

  if (DRY_RUN) {
    console.log("[doc-drift] Dry-run mode: reporting only.");
    return;
  }

  process.exit(1);
}

try {
  main();
} catch (error) {
  console.error("[doc-drift] Failed:", error instanceof Error ? error.message : String(error));
  process.exit(2);
}
