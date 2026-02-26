#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const CWD = process.cwd();
const MODE_ARG = process.argv.find((arg) => arg.startsWith("--mode="));
const MODE = MODE_ARG ? MODE_ARG.split("=", 2)[1] : "dev";
const SCHEMA_PATH = path.join(CWD, "config", "env.schema.json");
const EXAMPLE_PATH = path.join(CWD, ".env.example");
const LOCAL_PATH = path.join(CWD, ".env.local");
const ROOT_ENV_PATH = path.join(CWD, ".env");

function parseEnvFile(filePath) {
  if (!existsSync(filePath)) {
    return {};
  }
  const content = readFileSync(filePath, "utf8");
  const out = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }
    const match = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) {
      continue;
    }
    const key = match[1];
    let value = match[2].trim();
    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function hasValue(value) {
  return typeof value === "string" && value.trim() !== "";
}

function isLikelySecret(value) {
  if (!hasValue(value)) {
    return false;
  }
  return /(^AIza|^sk-|^gh[pousr]_|\bAKIA[0-9A-Z]{16}\b|-----BEGIN)/.test(value);
}

function safeSourceFor(key, rootEnv, localEnv) {
  if (hasValue(process.env[key])) {
    return "process env";
  }
  if (hasValue(rootEnv[key])) {
    return ".env";
  }
  if (hasValue(localEnv[key])) {
    return ".env.local";
  }
  return "missing";
}

function resolveKeyValue(key, rootEnv, localEnv) {
  if (hasValue(process.env[key])) {
    return process.env[key];
  }
  if (hasValue(rootEnv[key])) {
    return rootEnv[key];
  }
  if (hasValue(localEnv[key])) {
    return localEnv[key];
  }
  return "";
}

function validateUrlMaybe(urlValue) {
  if (!hasValue(urlValue)) {
    return true;
  }
  try {
    const url = new URL(urlValue);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function main() {
  if (!existsSync(SCHEMA_PATH)) {
    throw new Error(`missing schema: ${SCHEMA_PATH}`);
  }

  const schema = JSON.parse(readFileSync(SCHEMA_PATH, "utf8"));
  const specs = Array.isArray(schema.variables) ? schema.variables : [];
  const deprecated = Array.isArray(schema.deprecatedKeys) ? schema.deprecatedKeys : [];

  const exampleEnv = parseEnvFile(EXAMPLE_PATH);
  const rootEnv = parseEnvFile(ROOT_ENV_PATH);
  const localEnv = parseEnvFile(LOCAL_PATH);

  const errors = [];
  const warnings = [];

  const knownKeys = new Set(specs.map((item) => item.name));
  const exampleKeys = Object.keys(exampleEnv);

  for (const key of exampleKeys) {
    if (!knownKeys.has(key) && schema.allowUnknownInExample !== true) {
      errors.push(`.env.example contains unknown key not in schema: ${key}`);
    }
  }

  for (const spec of specs) {
    const key = spec.name;
    const inExample = Object.prototype.hasOwnProperty.call(exampleEnv, key);

    if (spec.requiredInExample && !inExample) {
      errors.push(`.env.example missing required key: ${key}`);
    }

    if (spec.sensitive && inExample && isLikelySecret(exampleEnv[key])) {
      errors.push(`.env.example must not include real secret value: ${key}`);
    }

    if (Array.isArray(spec.modesRequired) && spec.modesRequired.includes(MODE)) {
      const value = resolveKeyValue(key, rootEnv, localEnv);
      if (!hasValue(value)) {
        if (MODE === "live") {
          errors.push(`mode=${MODE} requires key: ${key}`);
        } else {
          warnings.push(`mode=${MODE} missing key (non-blocking): ${key}`);
        }
      }
    }
  }

  for (const key of deprecated) {
    if (hasValue(process.env[key]) || hasValue(rootEnv[key]) || hasValue(localEnv[key])) {
      errors.push(`deprecated key is set and must be removed: ${key}`);
    }
  }

  const geminiKey = resolveKeyValue("GEMINI_API_KEY", rootEnv, localEnv);

  const realLlmBaseUrl = resolveKeyValue("REAL_LLM_BASE_URL", rootEnv, localEnv);
  if (!validateUrlMaybe(realLlmBaseUrl)) {
    errors.push("REAL_LLM_BASE_URL must be a valid http(s) URL");
  }

  const externalUrl = resolveKeyValue("REAL_EXTERNAL_URL", rootEnv, localEnv);
  if (hasValue(externalUrl) && !validateUrlMaybe(externalUrl)) {
    errors.push("REAL_EXTERNAL_URL must be a valid http(s) URL when set");
  }

  const timeoutRaw = resolveKeyValue("REAL_LLM_TIMEOUT_MS", rootEnv, localEnv);
  if (hasValue(timeoutRaw)) {
    const timeoutMs = Number(timeoutRaw);
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
      errors.push("REAL_LLM_TIMEOUT_MS must be a positive number");
    }
  }

  const sourcesReport = [
    "GEMINI_API_KEY",
    "REAL_LLM_BASE_URL",
    "REAL_LLM_MODEL",
    "REAL_LLM_TIMEOUT_MS",
    "REAL_EXTERNAL_URL",
  ].map((key) => `${key}=${safeSourceFor(key, rootEnv, localEnv)}`);

  if (MODE === "live" && !hasValue(geminiKey)) {
    errors.push("mode=live requires GEMINI_API_KEY");
  }

  console.log(`[env-doctor] mode=${MODE}`);
  console.log(`[env-doctor] schemaKeys=${specs.length} exampleKeys=${exampleKeys.length}`);
  console.log("[env-doctor] source report:");
  for (const line of sourcesReport) {
    console.log(`  - ${line}`);
  }

  if (warnings.length > 0) {
    console.log("[env-doctor] warnings:");
    for (const warning of warnings) {
      console.log(`  - ${warning}`);
    }
  }

  if (errors.length > 0) {
    console.error("[env-doctor] failed:");
    for (const error of errors) {
      console.error(`  - ${error}`);
    }
    process.exit(1);
  }

  console.log("[env-doctor] passed.");
}

main();
