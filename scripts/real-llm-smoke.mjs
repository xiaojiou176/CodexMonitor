#!/usr/bin/env node

import { appendFileSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import process from "node:process";
import path from "node:path";
import { pathToFileURL } from "node:url";

const DEFAULT_TIMEOUT_MS = 20000;
const PREFLIGHT_TIMEOUT_MS = 8000;
const GENERATION_PROMPT = "Reply with exactly one short word: pong";
const REPORT_DIR = path.join(process.cwd(), ".runtime-cache", "test_output", "real-llm");
const REPORT_PATH = path.join(REPORT_DIR, "latest.json");
const PREFLIGHT_REPORT_DIR = path.join(
  process.cwd(),
  ".runtime-cache",
  "test_output",
  "live-preflight",
);
const PREFLIGHT_REPORT_PATH = path.join(PREFLIGHT_REPORT_DIR, "latest.json");
const LLM_SOURCE_KEYS = [
  "REAL_LLM_BASE_URL",
  "GEMINI_API_KEY",
  "REAL_LLM_MODEL",
  "REAL_LLM_TIMEOUT_MS",
];
const PREFLIGHT_SOURCE_KEYS = ["REAL_EXTERNAL_URL", ...LLM_SOURCE_KEYS];

function cleanEnvValue(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeBaseUrl(baseUrl) {
  return baseUrl.replace(/\/+$/, "");
}

function isGeminiOpenAiCompatibleBase(baseUrl) {
  return /\/v1beta\/openai$/i.test(baseUrl);
}

function buildApiUrl(baseUrl, endpointPath) {
  const normalizedPath = endpointPath.startsWith("/") ? endpointPath : `/${endpointPath}`;
  const baseEndsWithV1 = /\/v1$/i.test(baseUrl);
  const geminiOpenAiBase = isGeminiOpenAiCompatibleBase(baseUrl);
  const shouldStripV1Prefix = geminiOpenAiBase || baseEndsWithV1;
  const resolvedPath = shouldStripV1Prefix
    ? normalizedPath.replace(/^\/v1(?=\/|$)/i, "")
    : normalizedPath;
  return `${baseUrl}${resolvedPath}`;
}

function parseTimeoutMs(rawTimeout) {
  if (!rawTimeout) {
    return DEFAULT_TIMEOUT_MS;
  }
  const parsed = Number(rawTimeout);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_TIMEOUT_MS;
  }
  return Math.floor(parsed);
}

export function parseKeyValueLines(content) {
  const result = {};
  const lines = String(content).split(/\r?\n/);
  for (const rawLine of lines) {
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
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

function readParsedFile(filePath, readText) {
  try {
    return parseKeyValueLines(readText(filePath));
  } catch {
    return {};
  }
}

function hasEnvValue(value) {
  return Boolean(cleanEnvValue(value));
}

function isValidHttpUrl(value) {
  const normalized = cleanEnvValue(value);
  if (!normalized) {
    return false;
  }
  try {
    const parsed = new URL(normalized);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function redactSecret(value) {
  const normalized = cleanEnvValue(value);
  if (!normalized) {
    return "";
  }
  if (normalized.length <= 8) {
    return "***";
  }
  return `${normalized.slice(0, 4)}...${normalized.slice(-2)}`;
}

function resolveEnvSourceLabel(filePath, cwd) {
  if (filePath === path.join(cwd, ".env")) {
    return ".env";
  }
  return filePath;
}

function resolveAliasSource(sourceKey, sources) {
  const sourceLabel = sources[sourceKey] ?? "unknown";
  return `${sourceKey} (${sourceLabel})`;
}

function addGithubOutput(key, value) {
  const outputPath = cleanEnvValue(process.env.GITHUB_OUTPUT);
  if (!outputPath) {
    return;
  }
  try {
    appendFileSync(outputPath, `${key}=${String(value).replace(/\r?\n/g, " ")}\n`, "utf-8");
  } catch {
    // Best effort only.
  }
}

function appendGithubSummary(lines) {
  const summaryPath = cleanEnvValue(process.env.GITHUB_STEP_SUMMARY);
  if (!summaryPath) {
    return;
  }
  const body = `${lines.join("\n")}\n`;
  try {
    appendFileSync(summaryPath, body, "utf-8");
  } catch {
    // Best effort only.
  }
}

export function resolveEffectiveEnvWithSources(seedEnv = process.env, options = {}) {
  const cwd = options.cwd ?? process.cwd();
  const readText = options.readText ?? ((filePath) => readFileSync(filePath, "utf-8"));
  const effective = { ...seedEnv };
  const sources = {};
  for (const [key, value] of Object.entries(seedEnv)) {
    if (hasEnvValue(value)) {
      sources[key] = "process env";
    }
  }

  const fallbackFiles = [path.join(cwd, ".env")];

  for (const filePath of fallbackFiles) {
    const parsed = readParsedFile(filePath, readText);
    const sourceLabel = resolveEnvSourceLabel(filePath, cwd);
    for (const [key, value] of Object.entries(parsed)) {
      if (!hasEnvValue(effective[key]) && hasEnvValue(value)) {
        effective[key] = value;
        sources[key] = sourceLabel;
      }
    }
  }

  if (!hasEnvValue(effective.GEMINI_API_KEY) && hasEnvValue(effective.REAL_LLM_API_KEY)) {
    effective.GEMINI_API_KEY = cleanEnvValue(effective.REAL_LLM_API_KEY);
    sources.GEMINI_API_KEY = resolveAliasSource("REAL_LLM_API_KEY", sources);
  }
  if (!hasEnvValue(effective.REAL_LLM_BASE_URL) && hasEnvValue(effective.GEMINI_API_KEY)) {
    effective.REAL_LLM_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai";
    sources.REAL_LLM_BASE_URL = "default (GEMINI_API_KEY present)";
  }

  return { effective, sources };
}

export function resolveEffectiveEnv(seedEnv = process.env, options = {}) {
  return resolveEffectiveEnvWithSources(seedEnv, options).effective;
}

export function resolveConfig(env = process.env) {
  const baseUrl = cleanEnvValue(env.REAL_LLM_BASE_URL);
  const apiKey = cleanEnvValue(env.GEMINI_API_KEY) || cleanEnvValue(env.REAL_LLM_API_KEY);
  const requestedModel = cleanEnvValue(env.REAL_LLM_MODEL);
  const timeoutMs = parseTimeoutMs(cleanEnvValue(env.REAL_LLM_TIMEOUT_MS));

  const missing = [];
  if (!baseUrl) {
    missing.push("REAL_LLM_BASE_URL");
  }
  if (!apiKey) {
    missing.push("GEMINI_API_KEY");
  }

  if (missing.length > 0) {
    return {
      shouldSkip: true,
      reason: `missing required env: ${missing.join(", ")}`,
    };
  }

  return {
    shouldSkip: false,
    baseUrl: normalizeBaseUrl(baseUrl),
    apiKey,
    requestedModel,
    timeoutMs,
  };
}

function buildAuthHeaders(apiKey) {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
}

function createTimeoutSignal(timeoutMs) {
  return AbortSignal.timeout(timeoutMs);
}

function buildStatusError(endpointPath, status) {
  const error = new Error(`${endpointPath} failed with status ${status}`);
  error.name = "HttpStatusError";
  error.status = status;
  return error;
}

function getErrorStatus(error) {
  if (typeof error?.status === "number") {
    return error.status;
  }
  return null;
}

async function requestJson(url, { method, headers, body, timeoutMs }) {
  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    signal: createTimeoutSignal(timeoutMs),
  });

  const rawText = await response.text();
  let parsedBody = null;
  if (rawText.trim()) {
    try {
      parsedBody = JSON.parse(rawText);
    } catch {
      parsedBody = null;
    }
  }

  return {
    ok: response.ok,
    status: response.status,
    body: parsedBody,
    rawText,
  };
}

export function extractModelIds(modelsPayload) {
  const modelEntries = Array.isArray(modelsPayload?.data) ? modelsPayload.data : [];
  const ids = [];
  for (const entry of modelEntries) {
    if (typeof entry?.id === "string" && entry.id.trim()) {
      ids.push(entry.id.trim());
    }
  }
  return ids;
}

export function selectModel(modelIds, requestedModel) {
  if (requestedModel) {
    return requestedModel;
  }
  const normalizedIds = modelIds
    .map((id) => (typeof id === "string" ? id.trim() : ""))
    .filter(Boolean);
  const pureGemini = normalizedIds.find(
    (id) => /gemini/i.test(id) && !/(claude|gpt|openai|anthropic)/i.test(id),
  );
  if (pureGemini) {
    return pureGemini;
  }
  const geminiBranded = normalizedIds.find((id) => /gemini/i.test(id));
  if (geminiBranded) {
    return geminiBranded;
  }
  return normalizedIds[0] ?? "";
}

function extractTextFromPart(part) {
  if (typeof part?.text === "string") {
    return part.text.trim();
  }
  if (typeof part?.content === "string") {
    return part.content.trim();
  }
  return "";
}

export function extractGeneratedText(payload) {
  if (typeof payload?.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  if (Array.isArray(payload?.output)) {
    for (const outputItem of payload.output) {
      const parts = Array.isArray(outputItem?.content) ? outputItem.content : [];
      for (const part of parts) {
        const text = extractTextFromPart(part);
        if (text) {
          return text;
        }
      }
    }
  }

  const firstChoice = payload?.choices?.[0];
  if (typeof firstChoice?.message?.content === "string" && firstChoice.message.content.trim()) {
    return firstChoice.message.content.trim();
  }
  if (Array.isArray(firstChoice?.message?.content)) {
    for (const part of firstChoice.message.content) {
      const text = extractTextFromPart(part);
      if (text) {
        return text;
      }
    }
  }

  return "";
}

function extractChatCompletionsText(payload) {
  const firstChoice = payload?.choices?.[0];
  const message = firstChoice?.message;
  if (typeof message?.content === "string" && message.content.trim()) {
    return message.content.trim();
  }
  if (Array.isArray(message?.content)) {
    for (const part of message.content) {
      const text = extractTextFromPart(part);
      if (text) {
        return text;
      }
    }
  }
  if (Array.isArray(message?.parts)) {
    for (const part of message.parts) {
      const text = extractTextFromPart(part);
      if (text) {
        return text;
      }
    }
  }

  if (Array.isArray(payload?.candidates)) {
    for (const candidate of payload.candidates) {
      const parts = Array.isArray(candidate?.content?.parts) ? candidate.content.parts : [];
      for (const part of parts) {
        const text = extractTextFromPart(part);
        if (text) {
          return text;
        }
      }
    }
  }

  if (typeof firstChoice?.text === "string" && firstChoice.text.trim()) {
    return firstChoice.text.trim();
  }

  return "";
}

function sanitizeSnippet(value) {
  return value.replace(/\s+/g, " ").trim().slice(0, 120);
}

async function writeRunReport(report) {
  await mkdir(REPORT_DIR, { recursive: true });
  await writeFile(
    REPORT_PATH,
    `${JSON.stringify(
      {
        ...report,
        timestamp: new Date().toISOString(),
      },
      null,
      2,
    )}\n`,
    "utf-8",
  );
}

async function writePreflightReport(report) {
  await mkdir(PREFLIGHT_REPORT_DIR, { recursive: true });
  await writeFile(
    PREFLIGHT_REPORT_PATH,
    `${JSON.stringify(
      {
        ...report,
        timestamp: new Date().toISOString(),
      },
      null,
      2,
    )}\n`,
    "utf-8",
  );
}

function assertNonEmptyOutput(text) {
  if (!text || !text.trim()) {
    throw new Error("generation succeeded but returned empty output");
  }
}

async function fetchAvailableModels(config) {
  const endpointPath = "/v1/models";
  const response = await requestJson(buildApiUrl(config.baseUrl, endpointPath), {
    method: "GET",
    headers: buildAuthHeaders(config.apiKey),
    timeoutMs: config.timeoutMs,
  });

  if (!response.ok) {
    throw buildStatusError(endpointPath, response.status);
  }

  const ids = extractModelIds(response.body);
  if (ids.length === 0 && !config.requestedModel) {
    throw new Error("/v1/models returned no selectable models");
  }

  const model = selectModel(ids, config.requestedModel);
  if (!model) {
    throw new Error("unable to resolve model for generation test");
  }

  return { model, modelIds: ids };
}

async function generateViaResponses(config, model) {
  const endpointPath = "/v1/responses";
  const response = await requestJson(buildApiUrl(config.baseUrl, endpointPath), {
    method: "POST",
    headers: buildAuthHeaders(config.apiKey),
    body: {
      model,
      input: GENERATION_PROMPT,
      max_output_tokens: 32,
    },
    timeoutMs: config.timeoutMs,
  });

  if (!response.ok) {
    throw buildStatusError(endpointPath, response.status);
  }

  return extractGeneratedText(response.body);
}

async function generateViaChatCompletions(config, model) {
  const endpointPath = "/v1/chat/completions";
  const maxTokens = isGeminiOpenAiCompatibleBase(config.baseUrl) ? 512 : 32;
  const response = await requestJson(buildApiUrl(config.baseUrl, endpointPath), {
    method: "POST",
    headers: buildAuthHeaders(config.apiKey),
    body: {
      model,
      messages: [
        {
          role: "user",
          content: GENERATION_PROMPT,
        },
      ],
      max_tokens: maxTokens,
    },
    timeoutMs: config.timeoutMs,
  });

  if (!response.ok) {
    throw buildStatusError(endpointPath, response.status);
  }

  return extractChatCompletionsText(response.body);
}

function extractLlmEnvSourceReport(effectiveEnv, sources) {
  const report = {};
  for (const key of LLM_SOURCE_KEYS) {
    report[key] = {
      source: sources[key] ?? "missing",
      present: hasEnvValue(effectiveEnv[key]),
    };
  }
  return report;
}

function buildEnvDiagnostics(effectiveEnv, sources, keys) {
  const diagnostics = {};
  for (const key of keys) {
    const rawValue = cleanEnvValue(effectiveEnv[key]);
    const present = Boolean(rawValue);
    let runnable = present;
    let note = present ? "configured" : "missing";
    if (key === "REAL_LLM_BASE_URL" || key === "REAL_EXTERNAL_URL") {
      runnable = present && isValidHttpUrl(rawValue);
      note = present ? (runnable ? "http(s) url is valid" : "invalid url format") : "missing";
    }
    if (key === "REAL_LLM_TIMEOUT_MS") {
      runnable = present ? Number.isFinite(Number(rawValue)) && Number(rawValue) > 0 : true;
      note = present
        ? runnable
          ? "valid positive number"
          : "invalid timeout; default will be used"
        : "optional; default timeout will be used";
    }
    if (key === "REAL_LLM_MODEL") {
      runnable = true;
      note = present ? "configured" : "optional; auto-select from /v1/models";
    }
    if (key === "GEMINI_API_KEY") {
      runnable = present;
      note = present ? "configured (redacted)" : "missing";
    }
    diagnostics[key] = {
      source: sources[key] ?? "missing",
      present,
      runnable,
      note,
      preview: key === "GEMINI_API_KEY" ? redactSecret(rawValue) : undefined,
    };
  }
  return diagnostics;
}

function printLlmEnvSourceSummary(effectiveEnv, sources) {
  const sourceReport = buildEnvDiagnostics(effectiveEnv, sources, LLM_SOURCE_KEYS);
  for (const [key, info] of Object.entries(sourceReport)) {
    const suffix = key === "GEMINI_API_KEY" ? " (value redacted)" : "";
    console.log(
      `[real-llm-smoke] env ${key}: present=${info.present ? "yes" : "no"} runnable=${info.runnable ? "yes" : "no"} source=${info.source}${suffix}`,
    );
  }
  return sourceReport;
}

function toBooleanOutput(value) {
  return value ? "true" : "false";
}

async function probeUrl(url, options = {}) {
  const timeoutMs = options.timeoutMs ?? PREFLIGHT_TIMEOUT_MS;
  const headers = options.headers ?? {};
  const response = await fetch(url, {
    method: "GET",
    headers,
    signal: createTimeoutSignal(timeoutMs),
  });
  return {
    ok: response.ok,
    status: response.status,
    statusText: response.statusText,
  };
}

export async function runLivePreflight(seedEnv = process.env) {
  const { effective, sources } = resolveEffectiveEnvWithSources(seedEnv);
  const externalUrl = cleanEnvValue(effective.REAL_EXTERNAL_URL);
  const llmConfig = resolveConfig(effective);
  const envDiagnostics = buildEnvDiagnostics(effective, sources, PREFLIGHT_SOURCE_KEYS);
  const checks = [];
  const failures = [];
  const warnings = [];

  checks.push({
    name: "REAL_EXTERNAL_URL",
    status: externalUrl ? "present" : "missing",
    source: sources.REAL_EXTERNAL_URL ?? "missing",
    message: externalUrl ? "configured for external browser test" : "not set; external browser test will be skipped",
  });

  const llmSources = extractLlmEnvSourceReport(effective, sources);
  const missingLlm = llmConfig.shouldSkip ? llmConfig.reason : "";
  for (const key of ["REAL_LLM_BASE_URL", "GEMINI_API_KEY"]) {
    const keyPresent = llmSources[key].present;
    checks.push({
      name: key,
      status: keyPresent ? "present" : "missing",
      source: llmSources[key].source,
      message: keyPresent
        ? key === "GEMINI_API_KEY"
          ? "configured (value redacted)"
          : "configured"
        : "missing; real llm smoke will be skipped",
    });
  }
  checks.push({
    name: "REAL_LLM_MODEL",
    status: llmSources.REAL_LLM_MODEL.present ? "present" : "optional",
    source: llmSources.REAL_LLM_MODEL.source,
    message: llmSources.REAL_LLM_MODEL.present
      ? "configured"
      : "optional; first /v1/models result will be used",
  });

  const runExternal = Boolean(externalUrl);
  const runLlm = !llmConfig.shouldSkip;
  const runAny = runExternal || runLlm;

  if (!runAny) {
    const reason = `No runnable live checks. ${missingLlm}`;
    console.log(`[live-preflight] SKIP: ${reason}`);
    const report = {
      status: "skipped",
      reason,
      runAny,
      runExternal,
      runLlm,
      checks,
      envDiagnostics,
    };
    await writePreflightReport(report);
    addGithubOutput("run_any", toBooleanOutput(runAny));
    addGithubOutput("run_external", toBooleanOutput(runExternal));
    addGithubOutput("run_llm", toBooleanOutput(runLlm));
    addGithubOutput("status", "skipped");
    addGithubOutput("reason", reason);
    appendGithubSummary([
      "## Live Preflight",
      "",
      "- Status: skipped",
      `- Reason: ${reason}`,
      `- Report: \`${PREFLIGHT_REPORT_PATH}\``,
    ]);
    return report;
  }

  if (runExternal) {
    try {
      const response = await probeUrl(externalUrl);
      checks.push({
        name: "external-network",
        status: "ok",
        source: "network",
        message: `${externalUrl} reachable (status ${response.status})`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push(`REAL_EXTERNAL_URL unreachable: ${message}`);
      checks.push({
        name: "external-network",
        status: "failed",
        source: "network",
        message,
      });
    }
  }

  if (runLlm) {
    const modelsUrl = buildApiUrl(llmConfig.baseUrl, "/v1/models");
    try {
      const response = await probeUrl(modelsUrl, {
        headers: buildAuthHeaders(llmConfig.apiKey),
      });
      if (!response.ok) {
        throw new Error(`status ${response.status} ${response.statusText}`.trim());
      }
      checks.push({
        name: "llm-network",
        status: "ok",
        source: "network",
        message: `${modelsUrl} reachable with auth`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push(`REAL_LLM network/auth check failed: ${message}`);
      checks.push({
        name: "llm-network",
        status: "failed",
        source: "network",
        message,
      });
    }
  } else {
    warnings.push(missingLlm);
  }

  const status = failures.length > 0 ? "failed" : "passed";
  const reason = failures.length > 0 ? failures.join("; ") : warnings.join("; ");

  console.log(`[live-preflight] status=${status}`);
  for (const check of checks) {
    console.log(
      `[live-preflight] ${check.name} | ${check.status} | source=${check.source} | ${check.message}`,
    );
  }
  if (reason) {
    console.log(`[live-preflight] note: ${reason}`);
  }

  const report = {
    status,
    reason,
    runAny,
    runExternal,
    runLlm,
    checks,
    llmEnvSources: llmSources,
    envDiagnostics,
    runnability: {
      external: runExternal,
      llm: runLlm,
      any: runAny,
    },
  };
  await writePreflightReport(report);
  addGithubOutput("run_any", toBooleanOutput(runAny));
  addGithubOutput("run_external", toBooleanOutput(runExternal));
  addGithubOutput("run_llm", toBooleanOutput(runLlm));
  addGithubOutput("status", status);
  addGithubOutput("reason", reason || "none");
  appendGithubSummary([
    "## Live Preflight",
    "",
    `- Status: ${status}`,
    `- run_external: ${runExternal}`,
    `- run_llm: ${runLlm}`,
    `- Reason: ${reason || "none"}`,
    `- Report: \`${PREFLIGHT_REPORT_PATH}\``,
  ]);

  if (status === "failed") {
    throw new Error(reason || "live preflight failed");
  }
  return report;
}

export async function runRealLlmSmoke(env = process.env) {
  const { effective: effectiveEnv, sources } = resolveEffectiveEnvWithSources(env);
  const envSources = printLlmEnvSourceSummary(effectiveEnv, sources);
  const config = resolveConfig(effectiveEnv);
  if (config.shouldSkip) {
    console.log(`[real-llm-smoke] SKIP: ${config.reason}`);
    await writeRunReport({
      status: "skipped",
      reason: config.reason,
      envSources,
      runnability: { llm: false, reason: config.reason },
    });
    console.log(`[real-llm-smoke] report: ${REPORT_PATH}`);
    return { status: "skipped", reason: config.reason };
  }

  console.log(
    `[real-llm-smoke] starting connectivity check against ${config.baseUrl} (timeout ${config.timeoutMs}ms)`,
  );

  const { model, modelIds } = await fetchAvailableModels(config);
  const autoSelected = !config.requestedModel;
  console.log(
    `[real-llm-smoke] using model: ${model} (${autoSelected ? "auto-selected" : "from REAL_LLM_MODEL"})`,
  );
  if (modelIds.length > 0) {
    console.log(`[real-llm-smoke] models discovered: ${modelIds.length}`);
  }

  let outputText = "";
  let transport = "responses";
  try {
    outputText = await generateViaResponses(config, model);
    assertNonEmptyOutput(outputText);
  } catch (responsesError) {
    const responsesStatus = getErrorStatus(responsesError);
    const shouldFallback =
      isGeminiOpenAiCompatibleBase(config.baseUrl) &&
      (responsesStatus === 400 || responsesStatus === 404);
    if (!shouldFallback) {
      throw responsesError;
    }
    transport = "chat.completions";
    console.log(
      `[real-llm-smoke] /v1/responses unavailable on Gemini-compatible endpoint; fallback to /v1/chat/completions`,
    );
    outputText = await generateViaChatCompletions(config, model);
    assertNonEmptyOutput(outputText);
    if (responsesError instanceof Error) {
      console.log(`[real-llm-smoke] fallback reason: ${responsesError.message}`);
    }
  }

  const snippet = sanitizeSnippet(outputText);
  console.log(
    `[real-llm-smoke] PASS via ${transport} | output_length=${outputText.length} | sample="${snippet}"`,
  );
  await writeRunReport({
    status: "passed",
    baseUrl: config.baseUrl,
    model,
    transport,
    outputLength: outputText.length,
    outputSample: snippet,
    envSources,
    runnability: { llm: true, reason: "required vars configured and network checks passed" },
  });
  console.log(`[real-llm-smoke] report: ${REPORT_PATH}`);
  return { status: "passed", model, transport, output: outputText };
}

const entryArg = process.argv[1];
const isMainModule = entryArg
  ? import.meta.url === pathToFileURL(path.resolve(entryArg)).href
  : false;

if (isMainModule) {
  const runMode = cleanEnvValue(process.argv[2]);
  const handler = runMode === "--preflight" ? runLivePreflight : runRealLlmSmoke;
  handler().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    if (runMode === "--preflight") {
      writePreflightReport({
        status: "failed",
        reason: message,
      }).catch(() => {
        // Best effort reporting only.
      });
      console.error(`[live-preflight] FAIL: ${message}`);
    } else {
      writeRunReport({
        status: "failed",
        error: message,
      }).catch(() => {
        // Best effort reporting only.
      });
      console.error(`[real-llm-smoke] FAIL: ${message}`);
    }
    process.exit(1);
  });
}
