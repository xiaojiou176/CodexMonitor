#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

const CWD = process.cwd();
const SELF_PATH = "scripts/check-real-llm-alias-usage.mjs";
const SCHEMA_PATH = path.join(CWD, "config", "env.schema.json");
const ALLOWED_PATH_PATTERNS = [
  /^docs\//,
  /^config\/env\.schema\.json$/,
  /^scripts\/check-real-llm-alias-usage\.mjs$/,
];

function loadAliasKeys() {
  const schema = JSON.parse(readFileSync(SCHEMA_PATH, "utf8"));
  const deprecatedKeys = Array.isArray(schema.deprecatedKeys) ? schema.deprecatedKeys : [];
  return [...new Set(deprecatedKeys.filter((key) => typeof key === "string" && key.trim() !== ""))];
}

function runRg(aliasKey) {
  try {
    const output = execFileSync(
      "rg",
      [
        "-n",
        "--no-heading",
        "--glob",
        "!node_modules/**",
        "--glob",
        "!.git/**",
        "--glob",
        "!dist/**",
        "--glob",
        "!.runtime-cache/**",
        aliasKey,
        ".",
      ],
      { encoding: "utf8" },
    );
    return output
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  } catch (error) {
    const stdout = error?.stdout;
    if (typeof stdout === "string" && stdout.trim() !== "") {
      return stdout
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
    }
    return [];
  }
}

function main() {
  const aliasKeys = loadAliasKeys();
  if (aliasKeys.length === 0) {
    console.log("[env-alias-usage] passed (no alias keys configured).");
    return;
  }

  const violations = [];
  for (const aliasKey of aliasKeys) {
    const matches = runRg(aliasKey);
    for (const match of matches) {
      const firstColon = match.indexOf(":");
      const rawPath = firstColon === -1 ? match : match.slice(0, firstColon);
      const filePath = rawPath.replace(/^\.\//, "");
      const allowed = ALLOWED_PATH_PATTERNS.some((pattern) => pattern.test(filePath));
      if (!allowed) {
        violations.push(match);
      }
    }
  }

  if (violations.length > 0) {
    console.error("[env-alias-usage] FAIL: deprecated alias references are forbidden.");
    for (const violation of violations) {
      console.error(`  - ${violation}`);
    }
    console.error("[env-alias-usage] allowed locations:");
    console.error("  - docs/*");
    console.error("  - config/env.schema.json");
    console.error(`  - ${SELF_PATH}`);
    process.exit(1);
  }

  console.log("[env-alias-usage] passed.");
}

main();
