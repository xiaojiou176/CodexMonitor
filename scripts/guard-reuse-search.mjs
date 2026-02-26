#!/usr/bin/env node

import { spawnSync } from "node:child_process";

const BYPASS = process.env.REUSE_GUARD_BYPASS === "1";
const SOURCE_FILE_RE = /^(src\/.*\.(ts|tsx|js|jsx)|src-tauri\/src\/.*\.rs)$/;
const SYMBOL_BLACKLIST = new Set(["main", "init", "run", "handle", "render", "test"]);
const MAX_REPORTS = 5;

if (BYPASS) {
  console.warn("[guard-reuse-search] bypassed via REUSE_GUARD_BYPASS=1");
  process.exit(0);
}

function run(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, {
    encoding: "utf8",
    ...options,
  });

  if (result.error) {
    throw new Error(`${cmd} ${args.join(" ")} failed: ${result.error.message}`);
  }
  return result;
}

function getStagedSourceFiles() {
  const diff = run("git", ["diff", "--cached", "--name-only", "--diff-filter=ACMR"]);
  if (diff.status !== 0) {
    throw new Error(diff.stderr.trim() || "failed to read staged files");
  }
  return diff.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && SOURCE_FILE_RE.test(line));
}

function extractAddedSymbols(file) {
  const diff = run("git", ["diff", "--cached", "--unified=0", "--", file]);
  if (diff.status !== 0) {
    throw new Error(diff.stderr.trim() || `failed to read staged diff for ${file}`);
  }

  const patterns = [
    /^\+\s*export\s+(?:async\s+)?function\s+([A-Za-z_][A-Za-z0-9_]*)\b/,
    /^\+\s*export\s+const\s+([A-Za-z_][A-Za-z0-9_]*)\b/,
    /^\+\s*export\s+class\s+([A-Za-z_][A-Za-z0-9_]*)\b/,
    /^\+\s*pub\s+(?:async\s+)?fn\s+([A-Za-z_][A-Za-z0-9_]*)\b/,
  ];

  const symbols = new Set();
  for (const line of diff.stdout.split("\n")) {
    if (!line.startsWith("+") || line.startsWith("+++")) {
      continue;
    }
    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (!match) {
        continue;
      }
      const symbol = match[1];
      if (!SYMBOL_BLACKLIST.has(symbol) && symbol.length >= 4) {
        symbols.add(symbol);
      }
    }
  }
  return [...symbols];
}

function searchSymbol(symbol) {
  const rg = run("rg", [
    "-n",
    "-w",
    "-F",
    "--hidden",
    "--glob",
    "!.git",
    "--glob",
    "!node_modules",
    "--glob",
    "!dist",
    "--glob",
    "!build",
    symbol,
    "src",
    "src-tauri/src",
  ]);

  if (rg.status !== 0 && rg.status !== 1) {
    throw new Error(rg.stderr.trim() || `rg failed for symbol ${symbol}`);
  }
  if (rg.status === 1) {
    return [];
  }
  return rg.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function main() {
  const files = getStagedSourceFiles();
  if (files.length === 0) {
    console.log("[guard-reuse-search] no staged source files, skipped.");
    return;
  }

  const symbolOrigins = new Map();
  for (const file of files) {
    for (const symbol of extractAddedSymbols(file)) {
      if (!symbolOrigins.has(symbol)) {
        symbolOrigins.set(symbol, new Set());
      }
      symbolOrigins.get(symbol).add(file);
    }
  }

  if (symbolOrigins.size === 0) {
    console.log("[guard-reuse-search] no newly exported symbols detected, passed.");
    return;
  }

  const violations = [];
  for (const [symbol, originFiles] of symbolOrigins.entries()) {
    const matches = searchSymbol(symbol);
    const reused = matches.filter((line) => {
      const path = line.split(":")[0];
      return !originFiles.has(path);
    });
    if (reused.length > 0) {
      violations.push({
        symbol,
        originFiles: [...originFiles],
        matches: reused.slice(0, MAX_REPORTS),
      });
    }
  }

  if (violations.length > 0) {
    console.error("[guard-reuse-search] duplicate/reuse risk detected. Search before writing:");
    for (const item of violations) {
      console.error(`- symbol: ${item.symbol}`);
      console.error(`  staged: ${item.originFiles.join(", ")}`);
      for (const match of item.matches) {
        console.error(`  existing: ${match}`);
      }
    }
    console.error("[guard-reuse-search] Reuse existing implementation or rename/refactor before commit.");
    console.error("[guard-reuse-search] Temporary bypass: REUSE_GUARD_BYPASS=1 (must document reason).");
    process.exit(1);
  }

  console.log(`[guard-reuse-search] passed (${symbolOrigins.size} new symbol checks).`);
}

try {
  main();
} catch (error) {
  console.error("[guard-reuse-search] failed:", error instanceof Error ? error.message : String(error));
  process.exit(2);
}
