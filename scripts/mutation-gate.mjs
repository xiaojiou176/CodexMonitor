#!/usr/bin/env node

import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { spawn, spawnSync } from "node:child_process";
import { buildMutationConfig } from "./mutation-stryker.config.mjs";

const rootDir = process.cwd();
const reportDir = path.join(rootDir, ".runtime-cache", "test_output", "mutation-gate");
const runId = `${Date.now()}-${process.pid}`;
const tempConfigPath = path.join(rootDir, `.stryker-${runId}.config.mjs`);
const DRY_RUN = process.argv.includes("--dry-run");

const thresholdEnvRaw = process.env.MUTATION_MIN_SCORE;
const thresholdBreak = thresholdEnvRaw && thresholdEnvRaw.trim() !== ""
  ? Number(thresholdEnvRaw)
  : 80;
const mutateEnvRaw = process.env.MUTATION_MUTATE;

if (!Number.isFinite(thresholdBreak) || thresholdBreak < 0 || thresholdBreak > 100) {
  console.error(
    `❌ Invalid MUTATION_MIN_SCORE: "${thresholdEnvRaw}" must be a finite number in [0, 100]`,
  );
  process.exit(2);
}

const defaultMutate = [
  "src/features/threads/**/*.ts",
  "src/features/threads/**/*.tsx",
  "src/services/**/*.ts",
  "src/services/**/*.tsx",
  "!src/**/*.test.ts",
  "!src/**/*.test.tsx",
  "!src/test/**",
  "!src/main.tsx",
];
const mutate = mutateEnvRaw && mutateEnvRaw.trim() !== ""
  ? mutateEnvRaw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
  : defaultMutate;

function npmCommand() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

function runCommand(name, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(npmCommand(), args, {
      stdio: "inherit",
      env: process.env,
      cwd: rootDir,
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${name} failed with exit code ${code ?? 1}`));
    });
  });
}

async function main() {
  try {
    await mkdir(reportDir, { recursive: true });

    console.log("[mutation-gate] Phase 1/2: assertion guard (anti-placebo)");
    await runCommand("assertion-guard", ["run", "test:assertions:guard"]);

    const config = buildMutationConfig({ mutate, thresholdBreak });
    const configBody = `export default ${JSON.stringify(config, null, 2)};\n`;
    await writeFile(tempConfigPath, configBody, "utf-8");

    console.log("[mutation-gate] Phase 2/2: mutation testing (critical modules only)");
    console.log(`[mutation-gate] threshold.break=${thresholdBreak}`);
    console.log(`[mutation-gate] mutate=${mutate.join(", ")}`);
    console.log(`[mutation-gate] tempConfig=${tempConfigPath}`);

    if (DRY_RUN) {
      console.log("✅ Mutation gate dry-run passed (config generated, execution skipped)");
      return;
    }

    if (!mutateEnvRaw || mutateEnvRaw.trim() === "") {
      const precheck = spawnSync(
        "rg",
        ["--files", "src/features/threads", "src/services", "-g", "*.ts", "-g", "*.tsx"],
        {
          cwd: rootDir,
          encoding: "utf8",
        },
      );
      if (precheck.status !== 0 || precheck.stdout.trim() === "") {
        throw new Error("mutation target precheck failed: no files found in default critical scopes");
      }
    }

    await runCommand("mutation", [
      "exec",
      "--yes",
      "--package=typescript@5.8.3",
      "--package=@stryker-mutator/core@9.5.1",
      "--package=@stryker-mutator/vitest-runner@9.5.1",
      "--",
      "stryker",
      "run",
      tempConfigPath,
    ]);

    console.log("✅ Mutation gate passed");
  } finally {
    await unlink(tempConfigPath).catch(() => {});
  }
}

main().catch((error) => {
  console.error("❌ Mutation gate failed");
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
