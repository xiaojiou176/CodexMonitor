#!/usr/bin/env node

import { spawnSync } from "node:child_process";

const DRY_RUN = process.argv.includes("--dry-run");
const MODE_ARG = process.argv.find((arg) => arg.startsWith("--mode="));
const MODE = MODE_ARG ? MODE_ARG.split("=")[1] : "staged";

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

function runGit(args) {
  const result = spawnSync("git", args, {
    encoding: "utf8",
  });

  if (result.error) {
    throw new Error(`git ${args.join(" ")} failed to start: ${result.error.message}`);
  }

  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || `git ${args.join(" ")} failed`);
  }

  return result.stdout;
}

function parseFiles(stdout) {
  return stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function getStagedFiles() {
  return parseFiles(runGit(["diff", "--name-only", "--cached"]));
}

function tryGit(args) {
  const result = spawnSync("git", args, { encoding: "utf8" });
  if (result.error || result.status !== 0) {
    return null;
  }
  return result.stdout.trim();
}

function resolveBaseRef() {
  const upstream = tryGit(["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"]);
  if (upstream) {
    return upstream;
  }

  const defaultRemote = tryGit(["symbolic-ref", "--quiet", "--short", "refs/remotes/origin/HEAD"]);
  if (defaultRemote) {
    return defaultRemote;
  }

  return "origin/main";
}

function getBranchFiles() {
  const baseRef = resolveBaseRef();
  const mergeBase = tryGit(["merge-base", baseRef, "HEAD"]);
  if (!mergeBase) {
    throw new Error(`Unable to resolve merge-base against ${baseRef}`);
  }
  const changed = runGit(["diff", "--name-only", `${mergeBase}..HEAD`]);
  return parseFiles(changed);
}

function getCandidateFiles() {
  if (MODE === "staged") {
    return getStagedFiles();
  }
  if (MODE === "branch") {
    return getBranchFiles();
  }
  throw new Error(`Unsupported mode "${MODE}". Expected --mode=staged or --mode=branch`);
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
  const changedFiles = getCandidateFiles();

  if (changedFiles.length === 0) {
    console.log(`[doc-drift] No ${MODE} changes. Skipping.`);
    return;
  }

  const docsTouched = changedFiles.filter((file) => matchesAny(DOC_FILES, file));
  const sensitiveTouched = changedFiles.filter((file) => matchesAny(DOC_DRIFT_SENSITIVE, file));

  if (sensitiveTouched.length === 0) {
    console.log("[doc-drift] No doc-sensitive staged changes. Gate passed.");
    return;
  }

  if (docsTouched.length > 0) {
    console.log(`[doc-drift] (${MODE}) Doc-sensitive changes detected and docs were updated. Gate passed.`);
    if (DRY_RUN) {
      logList("Sensitive files", sensitiveTouched);
      logList("Docs files", docsTouched);
    }
    return;
  }

  console.error(`[doc-drift] (${MODE}) Doc-sensitive changes detected without docs updates.`);
  logList("Sensitive files", sensitiveTouched);
  console.error("[doc-drift] Update at least one doc file:");
  console.error("[doc-drift] README.md / AGENTS.md / CLAUDE.md / src/{AGENTS,CLAUDE}.md / src-tauri/{AGENTS,CLAUDE}.md / CHANGELOG.md / docs/*");

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
