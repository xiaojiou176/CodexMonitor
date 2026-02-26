#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";

const rootDir = process.cwd();
const coverageRootDir = path.join(rootDir, ".runtime-cache", "coverage", "vitest-gate");
const reportDir = path.join(rootDir, ".runtime-cache", "test_output", "coverage-gate");
const globalMinimumThresholds = {
  statements: 80,
  lines: 80,
  functions: 80,
  branches: 80,
};
const thresholdEnvConfig = {
  statements: { env: "COVERAGE_MIN_STATEMENTS", defaultValue: 80 },
  lines: { env: "COVERAGE_MIN_LINES", defaultValue: 80 },
  functions: { env: "COVERAGE_MIN_FUNCTIONS", defaultValue: 80 },
  branches: { env: "COVERAGE_MIN_BRANCHES", defaultValue: 80 },
};
const criticalScopeConfig = [
  {
    name: "threads",
    prefix: "src/features/threads/",
    thresholds: { statements: 95, lines: 95, functions: 95, branches: 95 },
  },
  {
    name: "services",
    prefix: "src/services/",
    thresholds: { statements: 95, lines: 95, functions: 95, branches: 95 },
  },
];

export function buildRunId() {
  const random = Math.random().toString(36).slice(2, 8);
  return `${Date.now()}-${process.pid}-${random}`;
}

export function parseThresholdValue(metric, envKey, defaultValue) {
  const raw = process.env[envKey];
  if (raw === undefined || raw.trim() === "") {
    return { value: defaultValue, source: "default" };
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid ${envKey} value: "${raw}" is not a finite number`);
  }
  if (parsed < 0 || parsed > 100) {
    throw new Error(`Invalid ${envKey} value: "${raw}" must be between 0 and 100`);
  }
  const floorValue = globalMinimumThresholds[metric];
  if (parsed < floorValue) {
    throw new Error(
      `Invalid ${envKey} value: "${raw}" is below enforced minimum ${floorValue}`,
    );
  }
  return { value: parsed, source: "env" };
}

export function resolveThresholds() {
  const thresholds = {};
  const thresholdSources = {};
  for (const [metric, config] of Object.entries(thresholdEnvConfig)) {
    const { value, source } = parseThresholdValue(metric, config.env, config.defaultValue);
    thresholds[metric] = value;
    thresholdSources[metric] = { env: config.env, source };
  }
  return { thresholds, thresholdSources };
}

export function runVitestCoverage(coverageDir) {
  const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
  const scopedCoverageIncludes = criticalScopeConfig.map(
    (scope) => `${scope.prefix}**/*.{ts,tsx}`,
  );
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
    "--coverage.exclude=src/**/*.test.ts",
    "--coverage.exclude=src/**/*.test.tsx",
    "--coverage.exclude=src/test/**",
    "--coverage.exclude=src/main.tsx",
    "--testTimeout=15000",
    "--hookTimeout=15000",
  ];
  for (const includePattern of scopedCoverageIncludes) {
    args.push(`--coverage.include=${includePattern}`);
  }

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

export function readPct(total, metric) {
  const value = total?.[metric]?.pct;
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new Error(`coverage-summary missing metric: ${metric}`);
  }
  return Number(value.toFixed(2));
}

export function normalizePath(value) {
  return String(value).replaceAll("\\", "/");
}

export function aggregateScopeCoverage(summary, prefix) {
  const normalizedPrefix = normalizePath(prefix);
  const metricTotals = {
    statements: { covered: 0, total: 0 },
    lines: { covered: 0, total: 0 },
    functions: { covered: 0, total: 0 },
    branches: { covered: 0, total: 0 },
  };

  let fileCount = 0;
  for (const [filePath, metrics] of Object.entries(summary)) {
    if (filePath === "total") {
      continue;
    }
    const normalizedPath = normalizePath(filePath);
    if (
      !normalizedPath.startsWith(normalizedPrefix) &&
      !normalizedPath.includes(`/${normalizedPrefix}`)
    ) {
      continue;
    }
    fileCount += 1;
    for (const metric of Object.keys(metricTotals)) {
      metricTotals[metric].covered += metrics?.[metric]?.covered ?? 0;
      metricTotals[metric].total += metrics?.[metric]?.total ?? 0;
    }
  }

  const coverage = {};
  for (const metric of Object.keys(metricTotals)) {
    const totals = metricTotals[metric];
    coverage[metric] = totals.total > 0
      ? Number(((totals.covered / totals.total) * 100).toFixed(2))
      : 0;
  }

  return {
    fileCount,
    coverage,
  };
}

export function collectGlobalFailures(thresholds, actualValues) {
  const failures = [];
  for (const [metric, minValue] of Object.entries(thresholds)) {
    const actual = actualValues[metric];
    if (actual < minValue) {
      failures.push({
        metric,
        min: minValue,
        actual,
        shortfall: Number((minValue - actual).toFixed(2)),
      });
    }
  }
  return failures;
}

export function collectCriticalScopeFailures(criticalScopes) {
  const failures = [];
  for (const scope of criticalScopes) {
    if (scope.fileCount === 0) {
      failures.push({
        scope: scope.name,
        prefix: scope.prefix,
        metric: "files",
        min: 1,
        actual: 0,
        shortfall: 1,
      });
      continue;
    }
    for (const [metric, minValue] of Object.entries(scope.thresholds)) {
      const actual = scope.coverage[metric];
      if (actual < minValue) {
        failures.push({
          scope: scope.name,
          prefix: scope.prefix,
          metric,
          min: minValue,
          actual,
          shortfall: Number((minValue - actual).toFixed(2)),
        });
      }
    }
  }
  return failures;
}

function formatPercent(value) {
  return `${Number(value).toFixed(2)}%`;
}

function logCoverageSummary({ actualValues, thresholds, criticalScopes, latestPath, runId, coverageDir }) {
  console.log("\n[Coverage Gate]");
  console.log(`- run: ${runId}`);
  console.log(`- coverageDir: ${coverageDir}`);
  console.log(`- report: ${latestPath}`);
  console.log("- global:");
  console.log(
    `  statements ${formatPercent(actualValues.statements)} (min ${formatPercent(thresholds.statements)})`,
  );
  console.log(`  lines ${formatPercent(actualValues.lines)} (min ${formatPercent(thresholds.lines)})`);
  console.log(
    `  functions ${formatPercent(actualValues.functions)} (min ${formatPercent(thresholds.functions)})`,
  );
  console.log(
    `  branches ${formatPercent(actualValues.branches)} (min ${formatPercent(thresholds.branches)})`,
  );
  console.log("- critical scopes:");
  for (const scope of criticalScopes) {
    console.log(`  ${scope.name} | files=${scope.fileCount} | prefix=${scope.prefix}`);
    console.log(
      `    statements ${formatPercent(scope.coverage.statements)} (min ${formatPercent(scope.thresholds.statements)})`,
    );
    console.log(
      `    lines ${formatPercent(scope.coverage.lines)} (min ${formatPercent(scope.thresholds.lines)})`,
    );
    console.log(
      `    functions ${formatPercent(scope.coverage.functions)} (min ${formatPercent(scope.thresholds.functions)})`,
    );
    console.log(
      `    branches ${formatPercent(scope.coverage.branches)} (min ${formatPercent(scope.thresholds.branches)})`,
    );
  }
}

function logFailureShortfall(failures) {
  if (failures.length === 0) {
    return;
  }

  const globalFailures = failures.filter((failure) => !failure.scope);
  const scopedFailures = failures.filter((failure) => failure.scope);
  console.error("❌ Coverage gate failed");

  if (globalFailures.length > 0) {
    console.error("  Global shortfall:");
    for (const failure of globalFailures) {
      console.error(
        `    - ${failure.metric}: actual ${formatPercent(failure.actual)} < required ${formatPercent(failure.min)} | shortfall ${formatPercent(failure.shortfall)}`,
      );
    }
  }

  if (scopedFailures.length > 0) {
    console.error("  Critical scope shortfall:");
    for (const failure of scopedFailures) {
      const scopeLabel = `${failure.scope} (${failure.prefix})`;
      if (failure.metric === "files") {
        console.error(
          `    - ${scopeLabel} files: actual ${failure.actual} < required ${failure.min} | shortfall ${failure.shortfall}`,
        );
        continue;
      }
      console.error(
        `    - ${scopeLabel} ${failure.metric}: actual ${formatPercent(failure.actual)} < required ${formatPercent(failure.min)} | shortfall ${formatPercent(failure.shortfall)}`,
      );
    }
  }
}

export async function main() {
  await mkdir(reportDir, { recursive: true });
  const runId = buildRunId();
  const coverageDir = path.join(coverageRootDir, runId);
  const summaryPath = path.join(coverageDir, "coverage-summary.json");

  let thresholds;
  let thresholdSources;
  try {
    const resolved = resolveThresholds();
    thresholds = resolved.thresholds;
    thresholdSources = resolved.thresholdSources;
  } catch (error) {
    console.error("❌ Invalid coverage threshold configuration");
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(2);
  }

  const testExitCode = await runVitestCoverage(coverageDir);
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
  const actualValues = {
    statements: readPct(total, "statements"),
    lines: readPct(total, "lines"),
    functions: readPct(total, "functions"),
    branches: readPct(total, "branches"),
  };
  const globalFailures = collectGlobalFailures(thresholds, actualValues);
  const criticalScopes = criticalScopeConfig.map((scopeConfig) => {
    const { fileCount, coverage } = aggregateScopeCoverage(summary, scopeConfig.prefix);
    return {
      ...scopeConfig,
      fileCount,
      coverage,
    };
  });
  const criticalFailures = collectCriticalScopeFailures(criticalScopes);
  const failures = [...globalFailures, ...criticalFailures];

  const report = {
    runId,
    timestampPst: new Date().toLocaleString("sv-SE", {
      timeZone: "America/Los_Angeles",
      hour12: false,
    }),
    thresholds,
    globalMinimumThresholds,
    thresholdSources,
    coverage: actualValues,
    criticalScopes,
    pass: failures.length === 0,
    failures,
    summaryPath,
    coverageDir,
  };

  const latestPath = path.join(reportDir, "latest.json");
  await writeFile(latestPath, `${JSON.stringify(report, null, 2)}\n`, "utf-8");

  logCoverageSummary({ actualValues, thresholds, criticalScopes, latestPath, runId, coverageDir });

  if (failures.length > 0) {
    logFailureShortfall(failures);
    process.exit(3);
  }

  console.log("✅ Coverage gate passed");
}

function isMainModule() {
  const entryArg = process.argv[1];
  if (!entryArg) {
    return false;
  }
  return import.meta.url === pathToFileURL(entryArg).href;
}

if (isMainModule()) {
  main().catch((error) => {
    console.error("❌ Coverage gate crashed");
    console.error(error instanceof Error ? error.stack ?? error.message : String(error));
    process.exit(4);
  });
}
