#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";

const rootDir = process.cwd();
const coverageRootDir = path.join(rootDir, ".runtime-cache", "coverage", "vitest-gate");
const reportDir = path.join(rootDir, ".runtime-cache", "test_output", "coverage-gate");
const baselinePath = path.join(reportDir, "baseline.json");
const repoBaselinePath = path.join(rootDir, "config", "coverage-gate-baseline.json");
const globalCoverageIncludePattern = "src/**/*.{ts,tsx}";
const globalMinimumThresholds = {
  statements: 85,
  lines: 85,
  functions: 85,
  branches: 85,
};
const supportedGateModes = new Set(["default", "strict"]);
const targetThresholdEnvConfig = {
  statements: {
    env: "COVERAGE_TARGET_STATEMENTS",
    legacyEnv: "COVERAGE_MIN_STATEMENTS",
    defaultValue: 85,
  },
  lines: {
    env: "COVERAGE_TARGET_LINES",
    legacyEnv: "COVERAGE_MIN_LINES",
    defaultValue: 85,
  },
  functions: {
    env: "COVERAGE_TARGET_FUNCTIONS",
    legacyEnv: "COVERAGE_MIN_FUNCTIONS",
    defaultValue: 85,
  },
  branches: {
    env: "COVERAGE_TARGET_BRANCHES",
    legacyEnv: "COVERAGE_MIN_BRANCHES",
    defaultValue: 85,
  },
};
const criticalScopeConfig = [
  {
    name: "threads",
    prefix: "src/features/threads/",
    thresholds: { statements: 95, lines: 95, functions: 95, branches: 92 },
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
  return { value: parsed, source: "env" };
}

export function resolveTargetThresholds() {
  const targetThresholds = {};
  const targetSources = {};
  for (const [metric, config] of Object.entries(targetThresholdEnvConfig)) {
    const primaryRaw = process.env[config.env];
    const fallbackRaw = process.env[config.legacyEnv];
    const envToUse = primaryRaw !== undefined && primaryRaw.trim() !== ""
      ? config.env
      : config.legacyEnv;
    const { value, source } = parseThresholdValue(metric, envToUse, config.defaultValue);
    targetThresholds[metric] = value;
    targetSources[metric] = {
      env: config.env,
      legacyEnv: config.legacyEnv,
      source: source === "default" ? "default" : (envToUse === config.env ? "env" : "legacy-env"),
    };
  }
  return { targetThresholds, targetSources };
}

export function parseGateMode(argv = process.argv.slice(2)) {
  const modeArg = argv.find((arg) => arg.startsWith("--mode="));
  if (!modeArg) {
    return "default";
  }
  const parsedMode = modeArg.slice("--mode=".length).trim().toLowerCase();
  if (!supportedGateModes.has(parsedMode)) {
    throw new Error(`Invalid --mode value: \"${parsedMode}\". Supported values: default, strict`);
  }
  return parsedMode;
}

export function runVitestCoverage(coverageDir) {
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
    "--coverage.exclude=src/**/*.test.ts",
    "--coverage.exclude=src/**/*.test.tsx",
    "--coverage.exclude=src/test/**",
    "--coverage.exclude=src/main.tsx",
    `--coverage.include=${globalCoverageIncludePattern}`,
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

export async function readBaselineThresholds(filePath) {
  try {
    const raw = await readFile(filePath, "utf-8");
    const parsed = JSON.parse(raw);
    const metrics = parsed?.metrics;
    if (!metrics || typeof metrics !== "object") {
      return null;
    }
    const normalized = {};
    for (const metric of Object.keys(globalMinimumThresholds)) {
      const value = metrics[metric];
      if (typeof value !== "number" || Number.isNaN(value) || value < 0 || value > 100) {
        return null;
      }
      normalized[metric] = Number(value.toFixed(2));
    }
    return normalized;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("ENOENT")) {
      return null;
    }
    const traceId = `coverage-baseline-${Date.now()}`;
    console.error("[coverage-gate][baseline-read-failed]", {
      traceId,
      requestId: traceId,
      status: "failed",
      error: message,
      baselinePath: filePath,
    });
    throw error;
  }
}

export function resolveRequiredThresholds(targetThresholds, baselineThresholds, targetSources = {}) {
  const requiredThresholds = {};
  for (const metric of Object.keys(globalMinimumThresholds)) {
    const target = targetThresholds[metric];
    const baseline = baselineThresholds?.[metric];
    if (baseline === undefined) {
      requiredThresholds[metric] = target;
      continue;
    }
    const source = targetSources?.[metric]?.source;
    if (source === "default") {
      requiredThresholds[metric] = baseline;
      continue;
    }
    requiredThresholds[metric] = Number(Math.max(target, baseline).toFixed(2));
  }
  return requiredThresholds;
}

export function buildMetricComparisons(actualValues, targetThresholds, baselineThresholds, requiredThresholds) {
  const comparisons = {};
  for (const metric of Object.keys(globalMinimumThresholds)) {
    const actual = actualValues[metric];
    const target = targetThresholds[metric];
    const baseline = baselineThresholds?.[metric] ?? null;
    const required = requiredThresholds[metric];
    comparisons[metric] = {
      actual,
      target,
      baseline,
      required,
      pass: actual >= required,
    };
  }
  return comparisons;
}

export function buildNextBaseline(actualValues, baselineThresholds) {
  const nextBaseline = {};
  for (const metric of Object.keys(globalMinimumThresholds)) {
    const baseline = baselineThresholds?.[metric] ?? 0;
    nextBaseline[metric] = Number(Math.max(actualValues[metric], baseline).toFixed(2));
  }
  return nextBaseline;
}

export async function writeBaselineThresholds(filePath, metrics, runId) {
  const baseline = {
    version: 1,
    runId,
    updatedAtUtc: new Date().toISOString(),
    includePattern: globalCoverageIncludePattern,
    metrics,
  };
  await writeFile(filePath, `${JSON.stringify(baseline, null, 2)}\n`, "utf-8");
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

function logCoverageSummary({
  gateMode,
  metricComparisons,
  criticalScopes,
  latestPath,
  runId,
  coverageDir,
  baselinePath: resolvedBaselinePath,
  baselineThresholds,
}) {
  console.log("\n[Coverage Gate]");
  console.log(`- mode: ${gateMode}`);
  console.log(`- run: ${runId}`);
  console.log(`- coverageDir: ${coverageDir}`);
  console.log(`- report: ${latestPath}`);
  console.log(`- baseline: ${resolvedBaselinePath} ${baselineThresholds ? "(loaded)" : "(missing)"}`);
  console.log(`- global (${globalCoverageIncludePattern}):`);
  for (const [metric, comparison] of Object.entries(metricComparisons)) {
    const baselineLabel = comparison.baseline === null ? "n/a" : formatPercent(comparison.baseline);
    const status = comparison.pass ? "PASS" : "FAIL";
    console.log(
      `  ${metric} current ${formatPercent(comparison.actual)} | baseline ${baselineLabel} | target ${formatPercent(comparison.target)} | required ${formatPercent(comparison.required)} | ${status}`,
    );
  }
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

  let gateMode;
  let targetThresholds;
  let targetSources;
  try {
    gateMode = parseGateMode();
    if (gateMode === "strict") {
      targetThresholds = { ...globalMinimumThresholds };
      targetSources = Object.fromEntries(
        Object.entries(targetThresholdEnvConfig).map(([metric, config]) => [
          metric,
          {
            env: config.env,
            legacyEnv: config.legacyEnv,
            source: "strict-fixed-85",
          },
        ]),
      );
    } else {
      const resolved = resolveTargetThresholds();
      targetThresholds = resolved.targetThresholds;
      targetSources = resolved.targetSources;
    }
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
  const baselineResolution = gateMode === "strict"
    ? { thresholds: null, resolvedPath: baselinePath }
    : (() => {
      return readBaselineThresholds(repoBaselinePath).then((repoBaseline) => {
        if (repoBaseline) {
          return { thresholds: repoBaseline, resolvedPath: repoBaselinePath };
        }
        return readBaselineThresholds(baselinePath).then((runtimeBaseline) => ({
          thresholds: runtimeBaseline,
          resolvedPath: runtimeBaseline ? baselinePath : repoBaselinePath,
        }));
      });
    })();
  const { thresholds: baselineThresholds, resolvedPath: resolvedBaselinePath } = await baselineResolution;
  const requiredThresholds = gateMode === "strict"
    ? { ...globalMinimumThresholds }
    : resolveRequiredThresholds(targetThresholds, baselineThresholds, targetSources);
  const metricComparisons = buildMetricComparisons(
    actualValues,
    targetThresholds,
    baselineThresholds,
    requiredThresholds,
  );
  const globalFailures = collectGlobalFailures(requiredThresholds, actualValues);
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
    gateMode,
    runId,
    timestampPst: new Date().toLocaleString("sv-SE", {
      timeZone: "America/Los_Angeles",
      hour12: false,
    }),
    targetThresholds,
    baselineThresholds,
    requiredThresholds,
    globalMinimumThresholds,
    thresholdSources: targetSources,
    globalCoverageIncludePattern,
    global: {
      includePattern: globalCoverageIncludePattern,
      targetThresholds,
      baselineThresholds,
      requiredThresholds,
      minimumThresholds: globalMinimumThresholds,
      coverage: actualValues,
      metricComparisons,
      failures: globalFailures,
    },
    critical: {
      scopes: criticalScopes,
      failures: criticalFailures,
    },
    coverage: actualValues,
    metricComparisons,
    criticalScopes,
    pass: failures.length === 0,
    failures,
    summaryPath,
    coverageDir,
    baselinePath: resolvedBaselinePath,
  };

  const latestPath = path.join(reportDir, "latest.json");
  await writeFile(latestPath, `${JSON.stringify(report, null, 2)}\n`, "utf-8");

  logCoverageSummary({
    gateMode,
    metricComparisons,
    criticalScopes,
    latestPath,
    runId,
    coverageDir,
    baselinePath: resolvedBaselinePath,
    baselineThresholds,
  });

  if (failures.length > 0) {
    logFailureShortfall(failures);
    process.exit(3);
  }

  if (gateMode === "default") {
    const nextBaseline = buildNextBaseline(actualValues, baselineThresholds);
    await writeBaselineThresholds(baselinePath, nextBaseline, runId);
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
