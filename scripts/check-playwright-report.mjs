import { readFileSync } from "node:fs";

const args = process.argv.slice(2);
const reportPath = args[0];
const label = args[1] ?? "playwright";
const enforceArg = args.find((arg) => arg.startsWith("--enforce="));
const enforceMode = enforceArg ? enforceArg.split("=")[1] : "fail";

if (!reportPath) {
  console.error("[check-playwright-report] Missing report path argument.");
  process.exit(2);
}

let parsed;
try {
  parsed = JSON.parse(readFileSync(reportPath, "utf8"));
} catch (error) {
  const traceId = `check-playwright-report-${Date.now()}`;
  console.error("[check-playwright-report][parse-failed]", {
    traceId,
    requestId: traceId,
    status: "failed",
    code: "REPORT_PARSE_FAILED",
    reportPath,
    error: error instanceof Error ? error.message : String(error),
  });
  process.exit(2);
}

const skippedFromStats = Number(parsed?.stats?.skipped ?? 0);

function countSkippedFromSuites(node) {
  if (!node || typeof node !== "object") {
    return 0;
  }
  let total = 0;
  if (Array.isArray(node.tests)) {
    for (const test of node.tests) {
      const outcome = String(test?.outcome ?? "").toLowerCase();
      if (outcome === "skipped") {
        total += 1;
      }
    }
  }
  if (Array.isArray(node.suites)) {
    for (const child of node.suites) {
      total += countSkippedFromSuites(child);
    }
  }
  return total;
}

const skippedFromSuites = Array.isArray(parsed?.suites)
  ? parsed.suites.reduce((sum, suite) => sum + countSkippedFromSuites(suite), 0)
  : 0;
const skipped = Math.max(skippedFromStats, skippedFromSuites);

if (skipped > 0) {
  const message = `[check-playwright-report] ${label}: skipped tests detected (${skipped}).`;
  if (enforceMode === "warn") {
    console.warn(`${message} Continuing in warn mode.`);
    process.exit(0);
  }
  console.error(`${message} Failing strict gate.`);
  process.exit(1);
}

console.log(`[check-playwright-report] ${label}: skipped tests = 0`);
