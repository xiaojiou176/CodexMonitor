#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";

const rootDir = process.cwd();
const coverageDir = path.join(rootDir, ".runtime-cache", "coverage", "vitest-gate");
const summaryPath = path.join(coverageDir, "coverage-summary.json");
const reportDir = path.join(rootDir, ".runtime-cache", "test_output", "coverage-gate");

const thresholds = {
  statements: Number(process.env.COVERAGE_MIN_STATEMENTS ?? 40),
  lines: Number(process.env.COVERAGE_MIN_LINES ?? 40),
  functions: Number(process.env.COVERAGE_MIN_FUNCTIONS ?? 50),
  branches: Number(process.env.COVERAGE_MIN_BRANCHES ?? 60),
};

function runVitestCoverage() {
  const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
  const args = [
    "exec",
    "--",
    "vitest",
    "run",
    "--coverage",
    "--coverage.provider=v8",
    "--coverage.reporter=text-summary",
    "--coverage.reporter=json-summary",
    `--coverage.reportsDirectory=${coverageDir}`,
    "--coverage.include=src/**/*.{ts,tsx}",
    "--coverage.exclude=src/**/*.test.ts",
    "--coverage.exclude=src/**/*.test.tsx",
    "--coverage.exclude=src/test/**",
    "--coverage.exclude=src/main.tsx",
    "--testTimeout=15000",
    "--hookTimeout=15000",
  ];

  return new Promise((resolve, reject) => {
    const child = spawn(npmCommand, args, {
      stdio: "inherit",
      env: process.env,
      cwd: rootDir,
    });

    child.on("error", reject);
    child.on("close", (code) => {
      resolve(code ?? 1);
    });
  });
}

function readPct(total, metric) {
  const value = total?.[metric]?.pct;
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new Error(`coverage-summary missing metric: ${metric}`);
  }
  return Number(value.toFixed(2));
}

function collectFailures(coverage) {
  const failures = [];
  for (const [metric, minValue] of Object.entries(thresholds)) {
    const actual = coverage[metric];
    if (actual < minValue) {
      failures.push({ metric, min: minValue, actual });
    }
  }
  return failures;
}

async function main() {
  await mkdir(reportDir, { recursive: true });

  const testExitCode = await runVitestCoverage();
  if (testExitCode !== 0) {
    console.error(`❌ Coverage run failed before threshold check (exit=${testExitCode})`);
    process.exit(testExitCode);
  }

  let summaryRaw;
  try {
    summaryRaw = await readFile(summaryPath, "utf-8");
  } catch (error) {
    console.error(`❌ Missing coverage summary: ${summaryPath}`);
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(2);
  }

  const summary = JSON.parse(summaryRaw);
  const total = summary?.total;
  const coverage = {
    statements: readPct(total, "statements"),
    lines: readPct(total, "lines"),
    functions: readPct(total, "functions"),
    branches: readPct(total, "branches"),
  };
  const failures = collectFailures(coverage);

  const report = {
    timestampPst: new Date().toLocaleString("sv-SE", {
      timeZone: "America/Los_Angeles",
      hour12: false,
    }),
    thresholds,
    coverage,
    pass: failures.length === 0,
    failures,
    summaryPath,
  };

  const latestPath = path.join(reportDir, "latest.json");
  await writeFile(latestPath, `${JSON.stringify(report, null, 2)}\n`, "utf-8");

  console.log("\n[Coverage Gate]");
  console.log(`- statements: ${coverage.statements}% (min ${thresholds.statements}%)`);
  console.log(`- lines: ${coverage.lines}% (min ${thresholds.lines}%)`);
  console.log(`- functions: ${coverage.functions}% (min ${thresholds.functions}%)`);
  console.log(`- branches: ${coverage.branches}% (min ${thresholds.branches}%)`);
  console.log(`- report: ${latestPath}`);

  if (failures.length > 0) {
    console.error("❌ Coverage gate failed");
    failures.forEach((failure) => {
      console.error(
        `  - ${failure.metric}: actual ${failure.actual}% < required ${failure.min}%`,
      );
    });
    process.exit(3);
  }

  console.log("✅ Coverage gate passed");
}

main().catch((error) => {
  console.error("❌ Coverage gate crashed");
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(4);
});
