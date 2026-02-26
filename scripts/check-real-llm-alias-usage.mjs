#!/usr/bin/env node

import { execFileSync } from "node:child_process";

const ALLOWED_PATHS = new Set([
  "scripts/real-llm-smoke.mjs",
  "scripts/env-doctor.mjs",
  "scripts/env-rationalize.mjs",
  "config/env.schema.json",
  "src/utils/realLlmSmoke.test.ts",
  "scripts/check-real-llm-alias-usage.mjs",
]);

function runRg() {
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
        "REAL_LLM_API_KEY",
        "src",
        "src-tauri",
        "scripts",
        "e2e",
        "config",
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
  const matches = runRg();
  const violations = [];

  for (const match of matches) {
    const separator = match.indexOf(":");
    if (separator === -1) {
      continue;
    }
    const filePath = match.slice(0, separator);
    if (!ALLOWED_PATHS.has(filePath)) {
      violations.push(match);
    }
  }

  if (violations.length > 0) {
    console.error("[env-alias-usage] FAIL: unexpected REAL_LLM_API_KEY references detected.");
    for (const violation of violations) {
      console.error(`  - ${violation}`);
    }
    console.error("[env-alias-usage] allowed files:");
    for (const filePath of ALLOWED_PATHS) {
      console.error(`  - ${filePath}`);
    }
    process.exit(1);
  }

  console.log("[env-alias-usage] passed.");
}

main();
