#!/usr/bin/env node

import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const DRY_RUN = process.argv.includes("--dry-run");
const MODE_ARG = process.argv.find((arg) => arg.startsWith("--mode="));
const ENFORCE_ARG = process.argv.find((arg) => arg.startsWith("--enforce="));
const MODE = MODE_ARG ? MODE_ARG.split("=")[1] : "staged";
const ENFORCE = ENFORCE_ARG ? ENFORCE_ARG.split("=")[1] : "fail";

const NOTE_FILE_PATTERNS = [
  /^README\.md$/,
  /^CHANGELOG\.md$/,
  /^AGENTS\.md$/,
  /^CLAUDE\.md$/,
  /^docs\/.+\.(?:md|txt)$/,
  /^\.runtime-cache\/.+\.(?:md|txt|json|log)$/,
  /(?:^|\/)(?:pr|pull[_-]?request|change(?:log)?|audit|report|summary|evidence|handoff)[^/]*\.(?:md|txt|json)$/i,
];

const CODE_FILE_HINTS = [/^src\//, /^src-tauri\//, /^scripts\//, /^package\.json$/, /^\.github\//];

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

function getStagedFiles() {
  return parseFiles(runGit(["diff", "--name-only", "--cached"]));
}

function resolveBaseRef() {
  const upstream = tryGit(["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"]);
  if (upstream) return upstream;

  const defaultRemote = tryGit(["symbolic-ref", "--quiet", "--short", "refs/remotes/origin/HEAD"]);
  if (defaultRemote) return defaultRemote;

  return "origin/main";
}

function getBranchFiles() {
  const baseRef = resolveBaseRef();
  const mergeBase = tryGit(["merge-base", baseRef, "HEAD"]);
  if (!mergeBase) {
    throw new Error(`Unable to resolve merge-base against ${baseRef}`);
  }
  return parseFiles(runGit(["diff", "--name-only", `${mergeBase}..HEAD`]));
}

function getCandidateFiles() {
  if (MODE === "staged") return getStagedFiles();
  if (MODE === "branch") return getBranchFiles();
  throw new Error(`Unsupported mode \"${MODE}\". Expected --mode=staged or --mode=branch`);
}

function listRuntimeEvidenceFiles(root) {
  try {
    const out = [];
    const entries = readdirSync(root);
    for (const entry of entries) {
      const full = path.join(root, entry);
      const stat = statSync(full);
      if (stat.isDirectory()) {
        for (const nested of listRuntimeEvidenceFiles(full)) {
          out.push(path.join(entry, nested));
        }
        continue;
      }
      out.push(entry);
    }
    return out;
  } catch {
    return [];
  }
}

function isNoteFile(file) {
  return NOTE_FILE_PATTERNS.some((pattern) => pattern.test(file));
}

function isCodeHintFile(file) {
  return CODE_FILE_HINTS.some((pattern) => pattern.test(file));
}

function readTextSafe(file) {
  try {
    return readFileSync(file, "utf8");
  } catch {
    return "";
  }
}

function logList(title, values) {
  console.log(`[lazy-load-evidence] ${title}`);
  for (const value of values) {
    console.log(`  - ${value}`);
  }
}

function maybeFail(message) {
  if (ENFORCE === "warn" || DRY_RUN) {
    console.warn(`[lazy-load-evidence] WARN: ${message}`);
    return;
  }
  console.error(`[lazy-load-evidence] FAIL: ${message}`);
  process.exit(1);
}

function main() {
  if (!["fail", "warn"].includes(ENFORCE)) {
    throw new Error(`Unsupported --enforce=${ENFORCE}. Expected warn|fail.`);
  }

  const changedFiles = getCandidateFiles();
  if (changedFiles.length === 0) {
    console.log(`[lazy-load-evidence] No ${MODE} changes. Skipping.`);
    return;
  }

  const noteFiles = changedFiles.filter((file) => isNoteFile(file));
  const codeFiles = changedFiles.filter((file) => isCodeHintFile(file));

  if (codeFiles.length === 0) {
    console.log("[lazy-load-evidence] No code-sensitive changes detected. Gate passed.");
    return;
  }

  if (noteFiles.length === 0) {
    maybeFail("Code-sensitive changes detected, but no PR/change/audit note file was updated.");
    return;
  }

  const runtimeEvidenceRoot = ".runtime-cache/test_output";
  const runtimeEvidenceFiles = listRuntimeEvidenceFiles(runtimeEvidenceRoot)
    .map((relative) => path.posix.join(runtimeEvidenceRoot, relative.replaceAll(path.sep, "/")))
    .slice(0, 200);

  const codeEvidenceCandidates = codeFiles.slice(0, 200);

  let hasRuntimeEvidenceRef = false;
  let hasChangedFileRef = false;

  for (const noteFile of noteFiles) {
    const content = readTextSafe(noteFile);
    if (!content) continue;

    if (!hasRuntimeEvidenceRef && content.includes(".runtime-cache/test_output/")) {
      hasRuntimeEvidenceRef = true;
    }

    if (!hasRuntimeEvidenceRef) {
      hasRuntimeEvidenceRef = runtimeEvidenceFiles.some((p) => content.includes(p));
    }

    if (!hasChangedFileRef) {
      hasChangedFileRef = codeEvidenceCandidates.some((p) => content.includes(p));
    }

    if (hasRuntimeEvidenceRef && hasChangedFileRef) break;
  }

  if (!hasRuntimeEvidenceRef || !hasChangedFileRef) {
    if (!hasRuntimeEvidenceRef) {
      maybeFail("Missing evidence reference to .runtime-cache/test_output artifacts in note/audit files.");
    }
    if (!hasChangedFileRef) {
      maybeFail("Missing evidence reference to changed code files in note/audit files.");
    }

    if (DRY_RUN) {
      logList("Changed code files", codeFiles);
      logList("Note files", noteFiles);
    }
    return;
  }

  console.log(`[lazy-load-evidence] (${MODE}) Gate passed (${ENFORCE} mode).`);
  if (DRY_RUN) {
    logList("Note files", noteFiles);
  }
}

try {
  main();
} catch (error) {
  console.error("[lazy-load-evidence] Failed:", error instanceof Error ? error.message : String(error));
  process.exit(2);
}
