#!/usr/bin/env node

import fs from "node:fs";

const ENV_EXAMPLE_PATH = ".env.example";
const SCHEMA_PATH = "config/env.schema.json";

function fail(message) {
  console.error(`[env-count-check] ${message}`);
  process.exit(1);
}

function failWithError(context, error) {
  const traceId = `env-count-${Date.now()}`;
  const normalizedError = error instanceof Error ? error.message : String(error);
  console.error("[env-count-check][error]", {
    traceId,
    requestId: traceId,
    status: "failed",
    context,
    error: normalizedError,
  });
  fail(`${context}: ${normalizedError}`);
}

function loadSchema(path) {
  let parsed;
  try {
    const raw = fs.readFileSync(path, "utf8");
    parsed = JSON.parse(raw);
  } catch (error) {
    const traceId = `env-count-${Date.now()}`;
    const normalizedError = error instanceof Error ? error.message : String(error);
    console.error("[env-count-check][catch]", {
      traceId,
      requestId: traceId,
      status: "failed",
      error: normalizedError,
      path,
    });
    failWithError(`failed to read/parse ${path}`, error);
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    fail(`${path} must be a JSON object.`);
  }

  if (!Array.isArray(parsed.variables)) {
    fail(`${path} must contain a top-level "variables" array.`);
  }

  for (const [index, entry] of parsed.variables.entries()) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      fail(`${path} variables[${index}] must be an object.`);
    }
    if (typeof entry.name !== "string" || entry.name.trim().length === 0) {
      fail(`${path} variables[${index}].name must be a non-empty string.`);
    }
  }

  return parsed;
}

function loadEnvKeys(path) {
  const raw = fs.readFileSync(path, "utf8");
  const keys = [];

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const equalIndex = trimmed.indexOf("=");
    if (equalIndex <= 0) {
      continue;
    }
    keys.push(trimmed.slice(0, equalIndex).trim());
  }

  return keys;
}

if (!fs.existsSync(ENV_EXAMPLE_PATH) || !fs.existsSync(SCHEMA_PATH)) {
  process.exit(0);
}

const envKeys = loadEnvKeys(ENV_EXAMPLE_PATH);
const schema = loadSchema(SCHEMA_PATH);
const requiredNames = schema.variables
  .filter((item) => item.requiredInExample === true)
  .map((item) => item.name);

const envSet = new Set(envKeys);
const missing = requiredNames.filter((name) => !envSet.has(name));

if (missing.length > 0) {
  fail(
    [
      `required variables missing from ${ENV_EXAMPLE_PATH}.`,
      `required count=${requiredNames.length}, env count=${envKeys.length}.`,
      `missing: ${missing.join(", ")}`,
    ].join(" "),
  );
}

process.exit(0);
