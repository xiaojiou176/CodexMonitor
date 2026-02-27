#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const ROOT_DIR = process.cwd();
const OBS_DOC_PATH = path.join(
  ROOT_DIR,
  "docs",
  "reference",
  "4-week-no-false-green-observability.md",
);
const DASHBOARD_PATH = path.join(
  ROOT_DIR,
  "docs",
  "reference",
  "testing-governance-dashboard.md",
);

const TABLE_START = "<!-- WAVE_7F_4W_OBS_TABLE_START -->";
const TABLE_END = "<!-- WAVE_7F_4W_OBS_TABLE_END -->";
const START_DATE_MARKER = "Observation Start (UTC):";

function normalizeGateStatus(raw) {
  const value = String(raw || "").trim().toLowerCase();
  if (value === "passed" || value === "pass") {
    return "pass";
  }
  if (value === "failed" || value === "fail") {
    return "fail";
  }
  if (value === "skipped" || value === "skip") {
    return "skip";
  }
  if (!value || value === "missing" || value === "unknown" || value === "n/a") {
    return "unknown";
  }
  return "unknown";
}

function parseDashboardStatusByGate(markdown) {
  const lines = markdown.split("\n");
  const result = {
    coverage: "unknown",
    mutation: "unknown",
    assertion: "unknown",
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("| ")) {
      continue;
    }
    if (trimmed.startsWith("| Gate |") || trimmed.startsWith("| --- |")) {
      continue;
    }
    const cells = trimmed
      .split("|")
      .map((cell) => cell.trim())
      .filter((cell, index, array) => !(index === 0 || index === array.length - 1));
    if (cells.length < 2) {
      continue;
    }

    const gate = cells[0];
    const status = normalizeGateStatus(cells[1]);

    if (gate === "Coverage Gate") {
      result.coverage = status;
    } else if (gate === "Mutation Gate") {
      result.mutation = status;
    } else if (gate === "Assertion Guard") {
      result.assertion = status;
    }
  }

  return result;
}

function extractObservationStartDate(markdown) {
  const line = markdown
    .split("\n")
    .find((entry) => entry.includes(START_DATE_MARKER));
  if (!line) {
    throw new Error(`Missing marker: ${START_DATE_MARKER}`);
  }
  const matched = line.match(/`(\d{4}-\d{2}-\d{2})`/);
  if (!matched) {
    throw new Error("Observation start date must use `YYYY-MM-DD` format");
  }
  const parsed = Date.parse(`${matched[1]}T00:00:00Z`);
  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid observation start date: ${matched[1]}`);
  }
  return parsed;
}

function parseTableRows(markdown) {
  const start = markdown.indexOf(TABLE_START);
  const end = markdown.indexOf(TABLE_END);
  if (start < 0 || end < 0 || end <= start) {
    throw new Error("Observation table markers are missing or invalid");
  }

  const tableSection = markdown.slice(start + TABLE_START.length, end).trim();
  const lines = tableSection.split("\n").map((line) => line.trim()).filter(Boolean);

  const dataLines = lines.filter((line) => /^\|\sW\d\s\|/.test(line));
  if (dataLines.length !== 4) {
    throw new Error(`Expected 4 weekly rows, got ${dataLines.length}`);
  }

  const rows = dataLines.map((line) => {
    const cells = line
      .split("|")
      .map((cell) => cell.trim())
      .filter((cell, index, array) => !(index === 0 || index === array.length - 1));
    if (cells.length !== 8) {
      throw new Error(`Invalid row column count (${cells.length}): ${line}`);
    }
    return {
      week: cells[0],
      window: cells[1],
      coverageGate: cells[2],
      mutationGate: cells[3],
      assertionGuard: cells[4],
      falseGreenIncidents: cells[5],
      updatedAtUtc: cells[6],
      evidence: cells[7],
    };
  });

  return { rows, start, end };
}

function replaceTableRows(markdown, rows) {
  const start = markdown.indexOf(TABLE_START);
  const end = markdown.indexOf(TABLE_END);
  const tableLines = [
    "| Week | Window (UTC) | Coverage Gate | Mutation Gate | Assertion Guard | False Green Incidents | Updated At (UTC) | Evidence |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
    ...rows.map(
      (row) =>
        `| ${row.week} | ${row.window} | ${row.coverageGate} | ${row.mutationGate} | ${row.assertionGuard} | ${row.falseGreenIncidents} | ${row.updatedAtUtc} | ${row.evidence} |`,
    ),
  ];

  const before = markdown.slice(0, start + TABLE_START.length);
  const after = markdown.slice(end);
  return `${before}\n${tableLines.join("\n")}\n${after}`;
}

function getCurrentWeekIndex(startDateMs) {
  const nowMs = Date.now();
  const elapsedDays = Math.floor((nowMs - startDateMs) / (24 * 60 * 60 * 1000));
  if (elapsedDays < 0) {
    return 0;
  }
  const week = Math.floor(elapsedDays / 7);
  return Math.max(0, Math.min(3, week));
}

function validateRows(rows) {
  const warnings = [];

  rows.forEach((row) => {
    const incidents = Number.parseInt(row.falseGreenIncidents, 10);
    if (Number.isNaN(incidents) || incidents < 0) {
      warnings.push(`${row.week}: false green incidents should be a non-negative integer`);
    }
    if (!row.evidence) {
      warnings.push(`${row.week}: evidence path is empty`);
    }
    if (row.coverageGate === "pending" || row.mutationGate === "pending" || row.assertionGuard === "pending") {
      warnings.push(`${row.week}: contains pending gate value`);
    }
  });

  return warnings;
}

async function main() {
  const shouldUpdate = process.argv.includes("--update");
  const strict = process.argv.includes("--strict");

  const [obsDocRaw, dashboardRaw] = await Promise.all([
    readFile(OBS_DOC_PATH, "utf-8"),
    readFile(DASHBOARD_PATH, "utf-8"),
  ]);

  const startDateMs = extractObservationStartDate(obsDocRaw);
  const { rows } = parseTableRows(obsDocRaw);
  const dashboardStatus = parseDashboardStatusByGate(dashboardRaw);

  if (shouldUpdate) {
    const weekIndex = getCurrentWeekIndex(startDateMs);
    const now = new Date().toISOString();
    const target = rows[weekIndex];
    target.coverageGate = dashboardStatus.coverage;
    target.mutationGate = dashboardStatus.mutation;
    target.assertionGuard = dashboardStatus.assertion;
    target.updatedAtUtc = now;
    target.evidence = "docs/reference/testing-governance-dashboard.md";

    const nextMarkdown = replaceTableRows(obsDocRaw, rows);
    await writeFile(OBS_DOC_PATH, nextMarkdown, "utf-8");
    console.log(`[4w-no-false-green] updated ${target.week}`);
  }

  const updatedRaw = shouldUpdate ? await readFile(OBS_DOC_PATH, "utf-8") : obsDocRaw;
  const { rows: updatedRows } = parseTableRows(updatedRaw);
  const warnings = validateRows(updatedRows);

  console.log(`[4w-no-false-green] rows=${updatedRows.length}`);
  console.log(
    `[4w-no-false-green] status=${updatedRows
      .map((row) => `${row.week}:${row.coverageGate}/${row.mutationGate}/${row.assertionGuard}/incidents=${row.falseGreenIncidents}`)
      .join(", ")}`,
  );

  if (warnings.length > 0) {
    warnings.forEach((warning) => {
      console.warn(`[4w-no-false-green][warn] ${warning}`);
    });
    if (strict) {
      process.exit(1);
    }
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  console.error("[4w-no-false-green] failed");
  console.error(message);
  process.exit(1);
});
