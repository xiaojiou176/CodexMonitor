#!/usr/bin/env node

import { access, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const ROOT_DIR = process.cwd();
const ARTIFACT_ROOT = path.join(ROOT_DIR, ".runtime-cache", "test_output");
const OUTPUT_PATH = path.join(
  ROOT_DIR,
  "docs",
  "reference",
  "testing-governance-dashboard.md",
);

const REQUIRED_ARTIFACTS = [
  { id: "coverage-gate", label: "Coverage Gate" },
  { id: "mutation-gate", label: "Mutation Gate" },
  { id: "live-preflight", label: "Live Preflight" },
  { id: "real-llm", label: "Real LLM Smoke" },
];
const FRESHNESS_FRESH_HOURS = 6;
const FRESHNESS_STALE_HOURS = 24;

function logCatch(context, error, extra = {}) {
  const traceId = `dashboard-gen-${Date.now()}`;
  console.warn("[testing-governance-dashboard][catch]", {
    traceId,
    requestId: traceId,
    status: "degraded",
    context,
    error: error instanceof Error ? error.message : String(error),
    ...extra,
  });
}

function toRelativePath(filePath) {
  return path.relative(ROOT_DIR, filePath).split(path.sep).join("/");
}

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch (error) {
    const traceId = `dashboard-gen-file-exists-${Date.now()}`;
    console.warn("[testing-governance-dashboard][file-exists-catch]", {
      traceId,
      requestId: traceId,
      status: "degraded",
      error: error instanceof Error ? error.message : String(error),
      filePath,
    });
    logCatch("fileExists", error, { filePath });
    return false;
  }
}

function normalizeStatus(value) {
  const raw = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!raw) {
    return "unknown";
  }
  if (raw === "pass" || raw === "passed" || raw === "ok" || raw === "success") {
    return "passed";
  }
  if (raw === "fail" || raw === "failed" || raw === "error") {
    return "failed";
  }
  if (raw === "skip" || raw === "skipped") {
    return "skipped";
  }
  return raw;
}

function inferArtifactStatus(report) {
  const data = report.data;
  if (typeof data?.pass === "boolean") {
    return data.pass ? "passed" : "failed";
  }
  if (typeof data?.status === "string") {
    return normalizeStatus(data.status);
  }
  return "unknown";
}

function formatMetric(value) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "n/a";
  }
  return `${value.toFixed(2)}%`;
}

function escapeTableCell(value) {
  return String(value).replaceAll("|", "\\|");
}

function formatTimestamp(report) {
  const data = report.data ?? {};
  if (typeof data.timestampPst === "string" && data.timestampPst.trim()) {
    return data.timestampPst;
  }
  if (typeof data.timestamp === "string" && data.timestamp.trim()) {
    return data.timestamp;
  }
  if (report.mtimeIso) {
    return report.mtimeIso;
  }
  return "n/a";
}

function parseDate(value) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return null;
  }
  return parsed;
}

function resolveFreshnessFromTimestamp(timestampMs, generatedAtMs) {
  if (typeof timestampMs !== "number" || Number.isNaN(timestampMs)) {
    return {
      freshness: "unknown",
      ageHours: null,
      ageLabel: "n/a",
    };
  }

  const ageHoursRaw = Math.max(0, (generatedAtMs - timestampMs) / (1000 * 60 * 60));
  const ageHours = Number(ageHoursRaw.toFixed(2));
  let freshness = "fresh";
  if (ageHours > FRESHNESS_STALE_HOURS) {
    freshness = "stale";
  } else if (ageHours > FRESHNESS_FRESH_HOURS) {
    freshness = "aging";
  }

  return {
    freshness,
    ageHours,
    ageLabel: `${ageHours.toFixed(2)}h`,
  };
}

function resolveTimestampInfo(report, generatedAtMs) {
  const data = report.data ?? {};
  const fromIso = parseDate(typeof data.timestamp === "string" ? data.timestamp : "");
  if (fromIso !== null) {
    return {
      display: data.timestamp,
      source: "payload.timestamp",
      ...resolveFreshnessFromTimestamp(fromIso, generatedAtMs),
    };
  }

  const fromPst = parseDate(typeof data.timestampPst === "string" ? data.timestampPst : "");
  if (fromPst !== null) {
    return {
      display: data.timestampPst,
      source: "payload.timestampPst",
      ...resolveFreshnessFromTimestamp(fromPst, generatedAtMs),
    };
  }

  const fromMtime = parseDate(report.mtimeIso);
  if (fromMtime !== null) {
    return {
      display: report.mtimeIso,
      source: "file.mtime",
      ...resolveFreshnessFromTimestamp(fromMtime, generatedAtMs),
    };
  }

  return {
    display: formatTimestamp(report),
    source: "none",
    ...resolveFreshnessFromTimestamp(null, generatedAtMs),
  };
}

function summarizeCoverage(data) {
  const coverage = data?.coverage ?? {};
  const failures = Array.isArray(data?.failures) ? data.failures.length : 0;
  return [
    `statements ${formatMetric(coverage.statements)}`,
    `lines ${formatMetric(coverage.lines)}`,
    `functions ${formatMetric(coverage.functions)}`,
    `branches ${formatMetric(coverage.branches)}`,
    `failures ${failures}`,
  ].join(" | ");
}

function summarizeLivePreflight(data) {
  const runExternal = typeof data?.runExternal === "boolean" ? data.runExternal : "n/a";
  const runLlm = typeof data?.runLlm === "boolean" ? data.runLlm : "n/a";
  const reason = typeof data?.reason === "string" && data.reason.trim() ? data.reason.trim() : "none";
  return `runExternal=${runExternal} | runLlm=${runLlm} | reason=${reason}`;
}

function summarizeRealLlm(data) {
  const model = typeof data?.model === "string" && data.model.trim() ? data.model.trim() : "n/a";
  const transport = typeof data?.transport === "string" && data.transport.trim()
    ? data.transport.trim()
    : "n/a";
  const reason = typeof data?.reason === "string" && data.reason.trim() ? data.reason.trim() : "none";
  return `model=${model} | transport=${transport} | reason=${reason}`;
}

function summarizeMutation(data) {
  const score = typeof data?.mutationScore === "number"
    ? `${data.mutationScore.toFixed(2)}%`
    : "n/a";
  const threshold = typeof data?.thresholdBreak === "number"
    ? `${data.thresholdBreak.toFixed(2)}%`
    : "n/a";
  return `mutationScore=${score} | threshold=${threshold}`;
}

function summarizeReport(report) {
  if (report.parseError) {
    return `parse error: ${report.parseError}`;
  }
  const data = report.data ?? {};
  if (report.id === "coverage-gate") {
    return summarizeCoverage(data);
  }
  if (report.id === "live-preflight") {
    return summarizeLivePreflight(data);
  }
  if (report.id === "real-llm") {
    return summarizeRealLlm(data);
  }
  if (report.id === "mutation-gate") {
    return summarizeMutation(data);
  }
  return `status=${inferArtifactStatus(report)}`;
}

function formatStatusCell(status) {
  if (status === "passed") {
    return "passed";
  }
  if (status === "failed") {
    return "failed";
  }
  if (status === "skipped") {
    return "skipped";
  }
  if (status === "missing") {
    return "missing";
  }
  if (status === "parse_error") {
    return "parse_error";
  }
  return "unknown";
}

function resolveOverallStatus(requiredRows, parseErrors) {
  if (requiredRows.some((row) => row.status === "failed")) {
    return "failed";
  }
  if (requiredRows.some((row) => row.status === "missing" || row.status === "parse_error")) {
    return "degraded";
  }
  if (parseErrors.length > 0) {
    return "degraded";
  }
  if (requiredRows.every((row) => row.status === "passed" || row.status === "skipped")) {
    return "passed";
  }
  return "degraded";
}

async function readLatestReport(artifactId) {
  const latestPath = path.join(ARTIFACT_ROOT, artifactId, "latest.json");
  if (!(await fileExists(latestPath))) {
    return {
      id: artifactId,
      latestPath,
      relativePath: toRelativePath(latestPath),
      missing: true,
    };
  }

  let mtimeIso = "";
  try {
    const fileStats = await stat(latestPath);
    mtimeIso = fileStats.mtime.toISOString();
  } catch (error) {
    const traceId = `dashboard-gen-stat-${Date.now()}`;
    console.warn("[testing-governance-dashboard][stat-catch]", {
      traceId,
      requestId: traceId,
      status: "degraded",
      error: error instanceof Error ? error.message : String(error),
      latestPath,
    });
    logCatch("readLatestReport:stat", error, { latestPath });
    mtimeIso = "";
  }

  try {
    const raw = await readFile(latestPath, "utf-8");
    const data = JSON.parse(raw);
    return {
      id: artifactId,
      latestPath,
      relativePath: toRelativePath(latestPath),
      missing: false,
      parseError: "",
      data,
      mtimeIso,
    };
  } catch (error) {
    const traceId = `dashboard-gen-parse-${Date.now()}`;
    console.warn("[testing-governance-dashboard][parse-catch]", {
      traceId,
      requestId: traceId,
      status: "degraded",
      error: error instanceof Error ? error.message : String(error),
      latestPath,
    });
    logCatch("readLatestReport:parse", error, { latestPath });
    const message = error instanceof Error ? error.message : String(error);
    return {
      id: artifactId,
      latestPath,
      relativePath: toRelativePath(latestPath),
      missing: false,
      parseError: message,
      data: null,
      mtimeIso,
    };
  }
}

async function discoverAdditionalArtifacts(knownIds) {
  if (!(await fileExists(ARTIFACT_ROOT))) {
    return [];
  }

  const entries = await readdir(ARTIFACT_ROOT, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => !knownIds.has(name))
    .sort((a, b) => a.localeCompare(b));
}

function buildMarkdown({ requiredRows, additionalRows, missingRows, parseErrors, generatedAt }) {
  const overallStatus = resolveOverallStatus(requiredRows, parseErrors);
  const availableCount = requiredRows.filter((row) => row.status !== "missing" && row.status !== "parse_error").length;
  const staleRequiredCount = requiredRows.filter((row) => row.freshness === "stale").length;
  const unknownFreshnessCount = requiredRows.filter(
    (row) => row.status !== "missing" && row.status !== "parse_error" && row.freshness === "unknown",
  ).length;

  const lines = [];
  lines.push("# Testing Governance Dashboard");
  lines.push("");
  lines.push("Generated automatically. Do not hand-edit.");
  lines.push("");
  lines.push("## Snapshot");
  lines.push("");
  lines.push(`- Generated at (UTC): ${generatedAt}`);
  lines.push(`- Artifact root: \`${toRelativePath(ARTIFACT_ROOT)}\``);
  lines.push(`- Overall status: **${overallStatus}**`);
  lines.push(`- Required reports available: ${availableCount}/${requiredRows.length}`);
  lines.push(`- Missing required reports: ${missingRows.length}`);
  lines.push(`- Parse errors: ${parseErrors.length}`);
  lines.push(`- Stale required reports (> ${FRESHNESS_STALE_HOURS}h): ${staleRequiredCount}`);
  lines.push(`- Unknown freshness reports: ${unknownFreshnessCount}`);
  lines.push("");
  lines.push("## Freshness Semantics");
  lines.push("");
  lines.push("- `Generated at` is dashboard generation time, not test execution time.");
  lines.push("- `Last Update` uses artifact payload timestamp when parseable, otherwise file mtime.");
  lines.push(`- ` + "`Freshness`" + ` thresholds: \`fresh <= ${FRESHNESS_FRESH_HOURS}h\`, \`aging <= ${FRESHNESS_STALE_HOURS}h\`, \`stale > ${FRESHNESS_STALE_HOURS}h\`.`);
  lines.push("- If freshness is `stale` or `unknown`, treat pass/fail as potentially outdated and re-run the relevant gate.");
  lines.push("");

  lines.push("## Required Gates");
  lines.push("");
  lines.push("| Gate | Status | Last Update | Freshness | Age | Summary | Source |");
  lines.push("| --- | --- | --- | --- | --- | --- | --- |");
  for (const row of requiredRows) {
    lines.push(
      `| ${escapeTableCell(row.label)} | ${escapeTableCell(formatStatusCell(row.status))} | ${escapeTableCell(row.lastUpdate)} | ${escapeTableCell(row.freshness)} | ${escapeTableCell(row.ageLabel)} | ${escapeTableCell(row.summary)} | \`${row.source}\` |`,
    );
  }
  lines.push("");

  if (additionalRows.length > 0) {
    lines.push("## Additional Reports");
    lines.push("");
    lines.push("| Report | Status | Last Update | Freshness | Age | Summary | Source |");
    lines.push("| --- | --- | --- | --- | --- | --- | --- |");
    for (const row of additionalRows) {
      lines.push(
        `| ${escapeTableCell(row.label)} | ${escapeTableCell(formatStatusCell(row.status))} | ${escapeTableCell(row.lastUpdate)} | ${escapeTableCell(row.freshness)} | ${escapeTableCell(row.ageLabel)} | ${escapeTableCell(row.summary)} | \`${row.source}\` |`,
      );
    }
    lines.push("");
  }

  lines.push("## Missing Data");
  lines.push("");
  if (missingRows.length === 0) {
    lines.push("- None");
  } else {
    for (const row of missingRows) {
      lines.push(`- ${row.label}: missing \`${row.source}\``);
    }
  }
  lines.push("");

  lines.push("## Parse Errors");
  lines.push("");
  if (parseErrors.length === 0) {
    lines.push("- None");
  } else {
    for (const item of parseErrors) {
      lines.push(`- ${item.label}: ${item.error} (\`${item.source}\`)`);
    }
  }
  lines.push("");

  return `${lines.join("\n")}\n`;
}

async function main() {
  const generatedAtIso = new Date().toISOString();
  const generatedAtMs = Date.parse(generatedAtIso);
  const requiredReports = await Promise.all(
    REQUIRED_ARTIFACTS.map((artifact) => readLatestReport(artifact.id)),
  );

  const knownIds = new Set(REQUIRED_ARTIFACTS.map((artifact) => artifact.id));
  const additionalIds = await discoverAdditionalArtifacts(knownIds);
  const additionalReports = await Promise.all(additionalIds.map((id) => readLatestReport(id)));

  const requiredRows = REQUIRED_ARTIFACTS.map((artifact) => {
    const report = requiredReports.find((item) => item.id === artifact.id);
    if (!report || report.missing) {
      return {
        id: artifact.id,
        label: artifact.label,
        status: "missing",
        lastUpdate: "n/a",
        freshness: "unknown",
        ageHours: null,
        ageLabel: "n/a",
        summary: "report not found",
        source: report?.relativePath ?? toRelativePath(path.join(ARTIFACT_ROOT, artifact.id, "latest.json")),
      };
    }
    if (report.parseError) {
      return {
        id: artifact.id,
        label: artifact.label,
        status: "parse_error",
        lastUpdate: report.mtimeIso || "n/a",
        freshness: "unknown",
        ageHours: null,
        ageLabel: "n/a",
        summary: "invalid JSON payload",
        source: report.relativePath,
        error: report.parseError,
      };
    }
    const timestampInfo = resolveTimestampInfo(report, generatedAtMs);
    return {
      id: artifact.id,
      label: artifact.label,
      status: inferArtifactStatus(report),
      lastUpdate: timestampInfo.display,
      freshness: timestampInfo.freshness,
      ageHours: timestampInfo.ageHours,
      ageLabel: timestampInfo.ageLabel,
      summary: summarizeReport(report),
      source: report.relativePath,
    };
  });

  const additionalRows = additionalReports.map((report) => {
    const label = report.id;
    if (report.missing) {
      return {
        id: report.id,
        label,
        status: "missing",
        lastUpdate: "n/a",
        freshness: "unknown",
        ageHours: null,
        ageLabel: "n/a",
        summary: "report not found",
        source: report.relativePath,
      };
    }
    if (report.parseError) {
      return {
        id: report.id,
        label,
        status: "parse_error",
        lastUpdate: report.mtimeIso || "n/a",
        freshness: "unknown",
        ageHours: null,
        ageLabel: "n/a",
        summary: "invalid JSON payload",
        source: report.relativePath,
        error: report.parseError,
      };
    }
    const timestampInfo = resolveTimestampInfo(report, generatedAtMs);
    return {
      id: report.id,
      label,
      status: inferArtifactStatus(report),
      lastUpdate: timestampInfo.display,
      freshness: timestampInfo.freshness,
      ageHours: timestampInfo.ageHours,
      ageLabel: timestampInfo.ageLabel,
      summary: summarizeReport(report),
      source: report.relativePath,
    };
  });

  const missingRows = requiredRows.filter((row) => row.status === "missing");
  const parseErrors = [...requiredRows, ...additionalRows]
    .filter((row) => row.status === "parse_error")
    .map((row) => ({
      label: row.label,
      source: row.source,
      error: row.error || "invalid JSON payload",
    }));

  const dashboard = buildMarkdown({
    requiredRows,
    additionalRows,
    missingRows,
    parseErrors,
    generatedAt: generatedAtIso,
  });

  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, dashboard, "utf-8");

  const overallStatus = resolveOverallStatus(requiredRows, parseErrors);
  console.log(`[testing-governance-dashboard] output=${toRelativePath(OUTPUT_PATH)}`);
  console.log(`[testing-governance-dashboard] overall_status=${overallStatus}`);
  console.log(`[testing-governance-dashboard] missing_required=${missingRows.length}`);
  console.log(`[testing-governance-dashboard] parse_errors=${parseErrors.length}`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  console.error("[testing-governance-dashboard] failed");
  console.error(message);
  process.exit(1);
});
