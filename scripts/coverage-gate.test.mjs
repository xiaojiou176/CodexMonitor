import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  aggregateScopeCoverage,
  buildMetricComparisons,
  buildNextBaseline,
  collectCriticalScopeFailures,
  collectGlobalFailures,
  normalizePath,
  parseThresholdValue,
  parseGateMode,
  readPct,
  readBaselineThresholds,
  resolveRequiredThresholds,
  resolveTargetThresholds,
  writeBaselineThresholds,
} from "./coverage-gate.mjs";

describe("coverage-gate helpers", () => {
  const originalEnv = {
    COVERAGE_MIN_STATEMENTS: process.env.COVERAGE_MIN_STATEMENTS,
    COVERAGE_MIN_LINES: process.env.COVERAGE_MIN_LINES,
    COVERAGE_MIN_FUNCTIONS: process.env.COVERAGE_MIN_FUNCTIONS,
    COVERAGE_MIN_BRANCHES: process.env.COVERAGE_MIN_BRANCHES,
    COVERAGE_TARGET_STATEMENTS: process.env.COVERAGE_TARGET_STATEMENTS,
    COVERAGE_TARGET_LINES: process.env.COVERAGE_TARGET_LINES,
    COVERAGE_TARGET_FUNCTIONS: process.env.COVERAGE_TARGET_FUNCTIONS,
    COVERAGE_TARGET_BRANCHES: process.env.COVERAGE_TARGET_BRANCHES,
  };

  afterEach(() => {
    for (const [envKey, envValue] of Object.entries(originalEnv)) {
      if (envValue === undefined) {
        delete process.env[envKey];
      } else {
        process.env[envKey] = envValue;
      }
    }
  });

  it("parseThresholdValue uses default when env value is missing", () => {
    delete process.env.COVERAGE_MIN_STATEMENTS;
    assert.deepEqual(
      parseThresholdValue("statements", "COVERAGE_MIN_STATEMENTS", 43),
      { value: 43, source: "default" },
    );
  });

  it("parseThresholdValue validates finite range", () => {
    process.env.COVERAGE_MIN_STATEMENTS = "101";
    assert.throws(
      () => parseThresholdValue("statements", "COVERAGE_MIN_STATEMENTS", 43),
      /must be between 0 and 100/,
    );
  });

  it("parseGateMode defaults to default and supports strict", () => {
    assert.equal(parseGateMode([]), "default");
    assert.equal(parseGateMode(["--mode=strict"]), "strict");
    assert.throws(
      () => parseGateMode(["--mode=unknown"]),
      /Supported values: default, strict/,
    );
  });

  it("resolveTargetThresholds supports target env and legacy env fallback", () => {
    delete process.env.COVERAGE_TARGET_STATEMENTS;
    process.env.COVERAGE_MIN_STATEMENTS = "72.5";
    process.env.COVERAGE_TARGET_LINES = "81";
    delete process.env.COVERAGE_MIN_LINES;
    delete process.env.COVERAGE_TARGET_FUNCTIONS;
    delete process.env.COVERAGE_MIN_FUNCTIONS;
    delete process.env.COVERAGE_TARGET_BRANCHES;
    delete process.env.COVERAGE_MIN_BRANCHES;

    const { targetThresholds, targetSources } = resolveTargetThresholds();
    assert.equal(targetThresholds.statements, 72.5);
    assert.equal(targetSources.statements.source, "legacy-env");
    assert.equal(targetThresholds.lines, 81);
    assert.equal(targetSources.lines.source, "env");
    assert.equal(targetThresholds.functions, 80);
    assert.equal(targetSources.functions.source, "default");
  });

  it("normalizes windows-style paths", () => {
    assert.equal(normalizePath("src\\features\\skills.ts"), "src/features/skills.ts");
  });

  it("aggregates coverage for files under a scope prefix", () => {
    const summary = {
      total: {},
      "src/features/threads/a.ts": {
        statements: { covered: 6, total: 10 },
        lines: { covered: 8, total: 10 },
        functions: { covered: 4, total: 5 },
        branches: { covered: 3, total: 6 },
      },
      "src/features/threads/b.ts": {
        statements: { covered: 3, total: 5 },
        lines: { covered: 4, total: 5 },
        functions: { covered: 1, total: 2 },
        branches: { covered: 2, total: 4 },
      },
      "src/services/c.ts": {
        statements: { covered: 1, total: 2 },
        lines: { covered: 1, total: 2 },
        functions: { covered: 1, total: 1 },
        branches: { covered: 1, total: 2 },
      },
    };
    const result = aggregateScopeCoverage(summary, "src/features/threads/");
    assert.equal(result.fileCount, 2);
    assert.deepEqual(result.coverage, {
      statements: 60,
      lines: 80,
      functions: 71.43,
      branches: 50,
    });
  });

  it("collectGlobalFailures and collectCriticalScopeFailures return failed metrics", () => {
    const globalFailures = collectGlobalFailures(
      { statements: 50, lines: 50, functions: 70, branches: 80 },
      { statements: 60, lines: 49, functions: 69, branches: 80 },
    );
    assert.deepEqual(globalFailures, [
      { metric: "lines", min: 50, actual: 49, shortfall: 1 },
      { metric: "functions", min: 70, actual: 69, shortfall: 1 },
    ]);

    const criticalFailures = collectCriticalScopeFailures([
      {
        name: "threads",
        prefix: "src/features/threads/",
        fileCount: 0,
        thresholds: { statements: 60, lines: 60, functions: 70, branches: 60 },
        coverage: { statements: 0, lines: 0, functions: 0, branches: 0 },
      },
      {
        name: "services",
        prefix: "src/services/",
        fileCount: 1,
        thresholds: { statements: 30, lines: 30, functions: 30, branches: 70 },
        coverage: { statements: 40, lines: 30, functions: 31, branches: 69.5 },
      },
    ]);
    assert.deepEqual(criticalFailures, [
      {
        scope: "threads",
        prefix: "src/features/threads/",
        metric: "files",
        min: 1,
        actual: 0,
        shortfall: 1,
      },
      {
        scope: "services",
        prefix: "src/services/",
        metric: "branches",
        min: 70,
        actual: 69.5,
        shortfall: 0.5,
      },
    ]);
  });

  it("readPct returns normalized metric precision and rejects missing metrics", () => {
    assert.equal(readPct({ lines: { pct: 66.666 } }, "lines"), 66.67);
    assert.throws(() => readPct({}, "lines"), /coverage-summary missing metric/);
  });

  it("baseline thresholds are loaded/written and required threshold prevents regression", async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), "coverage-gate-"));
    const baselineFile = path.join(tempDir, "baseline.json");
    const baselineMetrics = {
      statements: 66,
      lines: 67,
      functions: 68,
      branches: 69,
    };

    await writeBaselineThresholds(baselineFile, baselineMetrics, "run-1");
    const loadedBaseline = await readBaselineThresholds(baselineFile);
    assert.deepEqual(loadedBaseline, baselineMetrics);

    const targetThresholds = {
      statements: 60,
      lines: 80,
      functions: 65,
      branches: 70,
    };
    const requiredThresholds = resolveRequiredThresholds(targetThresholds, loadedBaseline, {
      statements: { source: "default" },
      lines: { source: "env" },
      functions: { source: "legacy-env" },
      branches: { source: "default" },
    });
    assert.deepEqual(requiredThresholds, {
      statements: 66,
      lines: 80,
      functions: 68,
      branches: 69,
    });

    const comparisons = buildMetricComparisons(
      { statements: 66.2, lines: 79.2, functions: 68, branches: 70.1 },
      targetThresholds,
      loadedBaseline,
      requiredThresholds,
    );
    assert.equal(comparisons.statements.pass, true);
    assert.equal(comparisons.lines.pass, false);

    assert.deepEqual(
      buildNextBaseline(
        { statements: 67, lines: 66, functions: 68.2, branches: 70 },
        loadedBaseline,
      ),
      { statements: 67, lines: 67, functions: 68.2, branches: 70 },
    );
  });

  it("strict mode semantics use fixed 80 and do not rely on baseline", () => {
    const strictRequired = {
      statements: 80,
      lines: 80,
      functions: 80,
      branches: 80,
    };
    const strictComparisons = buildMetricComparisons(
      { statements: 80, lines: 79.99, functions: 85, branches: 80.01 },
      strictRequired,
      null,
      strictRequired,
    );
    assert.equal(strictComparisons.statements.pass, true);
    assert.equal(strictComparisons.lines.pass, false);
    assert.equal(strictComparisons.functions.pass, true);
    assert.equal(strictComparisons.branches.pass, true);
  });
});
