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

function isMutationTarget(filePath) {
  if (!filePath.startsWith("src/features/threads/") && !filePath.startsWith("src/services/")) {
    return false;
  }
  if (filePath === "src/main.tsx") {
    return false;
  }
  if (filePath.startsWith("src/test/")) {
    return false;
  }
  return !filePath.endsWith(".test.ts") && !filePath.endsWith(".test.tsx");
}

function resolveDefaultMutateFiles() {
  const rgPrecheck = spawnSync(
    "rg",
    ["--files", "src/features/threads", "src/services", "-g", "*.ts", "-g", "*.tsx"],
    { cwd: rootDir, encoding: "utf8" },
  );
  const rawFileList = rgPrecheck.status === 0 && rgPrecheck.stdout.trim() !== ""
    ? rgPrecheck.stdout
    : (() => {
        const gitPrecheck = spawnSync(
          "git",
          ["ls-files", "src/features/threads", "src/services"],
          { cwd: rootDir, encoding: "utf8" },
        );
        if (gitPrecheck.status !== 0 || gitPrecheck.stdout.trim() === "") {
          throw new Error("mutation target precheck failed: no files found in default critical scopes");
        }
        return gitPrecheck.stdout;
      })();

  const files = rawFileList
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => line.endsWith(".ts") || line.endsWith(".tsx"))
    .filter(isMutationTarget);
  if (files.length === 0) {
    throw new Error("mutation target precheck failed: default scopes only matched test files");
  }
  return files;
}

function npmCommand() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

function localBinPath(binName) {
  const executable = process.platform === "win32" ? `${binName}.cmd` : binName;
  return path.join(rootDir, "node_modules", ".bin", executable);
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
    const mutate = mutateEnvRaw && mutateEnvRaw.trim() !== ""
      ? mutateEnvRaw
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)
      : resolveDefaultMutateFiles();

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

    const strykerBin = localBinPath("stryker");
    await new Promise((resolve, reject) => {
      const child = spawn(strykerBin, ["run", tempConfigPath], {
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
        reject(new Error(`mutation failed with exit code ${code ?? 1}`));
      });
    });

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
