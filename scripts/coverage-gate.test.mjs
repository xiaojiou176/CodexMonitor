import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  aggregateScopeCoverage,
  collectCriticalScopeFailures,
  collectGlobalFailures,
  normalizePath,
  parseThresholdValue,
  readPct,
} from "./coverage-gate.mjs";

describe("coverage-gate helpers", () => {
  const originalEnv = {
    COVERAGE_MIN_STATEMENTS: process.env.COVERAGE_MIN_STATEMENTS,
  };

  afterEach(() => {
    if (originalEnv.COVERAGE_MIN_STATEMENTS === undefined) {
      delete process.env.COVERAGE_MIN_STATEMENTS;
    } else {
      process.env.COVERAGE_MIN_STATEMENTS = originalEnv.COVERAGE_MIN_STATEMENTS;
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
});
