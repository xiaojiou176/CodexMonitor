#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const DEFAULT_MODEL = process.env.GEMINI_UIUX_MODEL || "gemini-3.0-flash";
const FALLBACK_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-1.5-flash"
];
const FRONTEND_EXTENSIONS = new Set([".tsx", ".jsx", ".css", ".scss", ".html"]);
const MAX_DIFF_CHARS = 14000;
const MAX_FILES_PER_REQUEST = 12;
const MAX_TOTAL_DIFF_CHARS = 90000;

function jsonOut(payload) {
  console.log(JSON.stringify(payload, null, 2));
}

function runGit(args) {
  return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function parseDotEnv(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const env = {};
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;

    let value = match[2];
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[match[1]] = value;
  }

  return env;
}

function resolveApiKey(repoRoot) {
  const fromEnv = (process.env.GEMINI_API_KEY || "").trim();
  if (fromEnv) return fromEnv;

  const dotEnv = parseDotEnv(path.join(repoRoot, ".env"));
  return (dotEnv.GEMINI_API_KEY || "").trim();
}

function unique(list) {
  return [...new Set(list.filter(Boolean))];
}

function normalizeFiles(rawFiles) {
  return unique(rawFiles)
    .map((file) => file.trim())
    .filter(Boolean)
    .map((file) => file.replace(/^\.\//, ""))
    .filter((file) => FRONTEND_EXTENSIONS.has(path.extname(file).toLowerCase()));
}

function chunk(list, size) {
  const result = [];
  for (let i = 0; i < list.length; i += size) {
    result.push(list.slice(i, i + size));
  }
  return result;
}

function getDiffFragment(file) {
  const attempts = [
    ["diff", "--cached", "--unified=0", "--", file],
    ["diff", "--unified=0", "HEAD~1", "HEAD", "--", file],
    ["diff", "--unified=0", "HEAD", "--", file]
  ];

  for (const args of attempts) {
    try {
      const diff = runGit(args);
      if (diff) {
        return diff.length > MAX_DIFF_CHARS ? `${diff.slice(0, MAX_DIFF_CHARS)}\n...[truncated]` : diff;
      }
    } catch {
      // Ignore and continue to fallback attempt.
    }
  }

  return "";
}

function buildPrompt(diffPayloads) {
  const schema = {
    summary: "string",
    findings: [
      {
        file: "string",
        severity: "error|warning|info",
        title: "string",
        evidence: "string",
        suggestion: "string"
      }
    ]
  };

  return [
    "You are a strict UI/UX reviewer for a React+Tauri project.",
    "Review ONLY the provided git diff hunks (not full files).",
    "Focus on accessibility, visual consistency, semantic HTML, interaction states, and design-token compliance.",
    "Escalate severity=error only for high-confidence blocking issues proven by exact evidence in the provided diff hunks.",
    "If evidence is incomplete or inferred, use severity=warning instead of error.",
    "Return valid JSON only with this schema:",
    JSON.stringify(schema),
    "Diff hunks:",
    JSON.stringify(diffPayloads)
  ].join("\n\n");
}

function extractModelText(apiResponse) {
  return (
    apiResponse?.candidates?.[0]?.content?.parts
      ?.map((part) => part?.text || "")
      .join("\n") || ""
  );
}

function parseModelJson(rawText) {
  const trimmed = rawText.trim();
  if (!trimmed) return { summary: "Model returned empty response.", findings: [] };

  const codeFenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidates = [];
  const fenced = codeFenceMatch ? codeFenceMatch[1].trim() : "";
  if (fenced) candidates.push(fenced);
  candidates.push(trimmed);

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    candidates.push(trimmed.slice(firstBrace, lastBrace + 1));
  }

  for (const candidate of unique(candidates)) {
    try {
      const parsed = JSON.parse(candidate);
      return {
        summary: typeof parsed.summary === "string" ? parsed.summary : "",
        findings: Array.isArray(parsed.findings) ? parsed.findings : []
      };
    } catch {
      // Try next candidate.
    }
  }

  return {
    summary: "Model output was not valid JSON; batch marked as non-blocking.",
    findings: [
      {
        file: "<model-output>",
        severity: "warning",
        title: "Invalid JSON output",
        evidence: trimmed.slice(0, 300),
        suggestion: "Tighten prompt formatting or model constraints if this persists."
      }
    ]
  };
}

function normalizeFindings(findings, fallbackFile) {
  return findings.map((item) => {
    const severity = String(item?.severity || "warning").toLowerCase();
    const safeSeverity = ["error", "warning", "info"].includes(severity) ? severity : "warning";

    return {
      file: typeof item?.file === "string" && item.file ? item.file : fallbackFile,
      severity: safeSeverity,
      title: typeof item?.title === "string" && item.title ? item.title : "UI/UX issue",
      evidence: typeof item?.evidence === "string" ? item.evidence : "",
      suggestion: typeof item?.suggestion === "string" ? item.suggestion : ""
    };
  });
}

function enforceConfidence(findings, batch) {
  const diffText = batch.map((item) => item.diff).join("\n");
  return findings.map((item) => {
    if (item.severity !== "error") {
      return item;
    }

    const evidence = (item.evidence || "").trim();
    if (!evidence) {
      return { ...item, severity: "warning" };
    }

    const firstLine = evidence.split("\n")[0]?.trim();
    if (!firstLine || !diffText.includes(firstLine)) {
      return { ...item, severity: "warning" };
    }

    return item;
  });
}

async function main() {
  let repoRoot = process.cwd();
  try {
    repoRoot = runGit(["rev-parse", "--show-toplevel"]);
  } catch {
    // Keep cwd fallback.
  }

  const apiKey = resolveApiKey(repoRoot);
  if (!apiKey) {
    jsonOut({
      status: "error",
      stage: "pre-push",
      reason: "missing_gemini_api_key",
      message: "GEMINI_API_KEY is required. Set it in environment variables or repository .env before push."
    });
    process.exit(1);
  }

  const incomingFiles = process.argv.slice(2);
  const frontendFiles = normalizeFiles(incomingFiles);

  if (frontendFiles.length === 0) {
    jsonOut({
      status: "skipped",
      stage: "pre-push",
      model: DEFAULT_MODEL,
      reason: "no_frontend_files",
      auditedFiles: 0,
      findings: [],
      errorCount: 0
    });
    return;
  }

  const allDiffPayloads = frontendFiles
    .map((file) => ({ file, diff: getDiffFragment(file) }))
    .filter((entry) => entry.diff);

  if (allDiffPayloads.length === 0) {
    jsonOut({
      status: "skipped",
      stage: "pre-push",
      model: DEFAULT_MODEL,
      reason: "no_diff_fragments",
      auditedFiles: 0,
      findings: [],
      errorCount: 0
    });
    return;
  }

  const modelCandidates = unique([DEFAULT_MODEL, ...FALLBACK_MODELS]);
  const limitedPayloads = [];
  let accumulatedChars = 0;
  for (const entry of allDiffPayloads) {
    if (accumulatedChars + entry.diff.length > MAX_TOTAL_DIFF_CHARS) break;
    limitedPayloads.push(entry);
    accumulatedChars += entry.diff.length;
  }

  const batches = chunk(limitedPayloads, MAX_FILES_PER_REQUEST);
  const allFindings = [];
  const summaries = [];

  let usedModel = DEFAULT_MODEL;
  for (const batch of batches) {
    const prompt = buildPrompt(batch);
    let response;
    let lastError = null;
    for (const candidate of modelCandidates) {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(candidate)}:generateContent?key=${encodeURIComponent(apiKey)}`;
      try {
        response = await fetch(endpoint, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.1,
              responseMimeType: "application/json"
            }
          })
        });
      } catch (error) {
        lastError = {
          reason: "network_or_request_failure",
          model: candidate,
          message: error instanceof Error ? error.message : String(error)
        };
        continue;
      }

      if (response.ok) {
        usedModel = candidate;
        lastError = null;
        break;
      }

      const body = await response.text();
      if (response.status === 404 || response.status === 400) {
        lastError = {
          reason: "gemini_api_model_unavailable",
          model: candidate,
          httpStatus: response.status,
          message: body.slice(0, 500)
        };
        response = null;
        continue;
      }

      jsonOut({
        status: "error",
        stage: "pre-push",
        model: candidate,
        reason: "gemini_api_error",
        httpStatus: response.status,
        message: body.slice(0, 500)
      });
      process.exit(1);
    }

    if (!response) {
      jsonOut({
        status: "error",
        stage: "pre-push",
        model: DEFAULT_MODEL,
        reason: "gemini_no_compatible_model",
        message: "No compatible Gemini Flash model was available.",
        detail: lastError
      });
      process.exit(1);
    }

    const apiResponse = await response.json();
    const modelText = extractModelText(apiResponse);
    const parsed = parseModelJson(modelText);
    const normalized = enforceConfidence(
      normalizeFindings(parsed.findings, batch[0]?.file || "<unknown>"),
      batch
    );
    if (parsed.summary) summaries.push(parsed.summary);
    allFindings.push(...normalized);
  }

  const errorCount = allFindings.filter((f) => f.severity === "error").length;
  const skippedFiles = allDiffPayloads.length - limitedPayloads.length;

  jsonOut({
    status: errorCount > 0 ? "failed" : "passed",
    stage: "pre-push",
    model: usedModel,
    auditedFiles: limitedPayloads.length,
    skippedFiles,
    summary: summaries.join(" ").trim(),
    findings: allFindings,
    errorCount
  });

  process.exit(errorCount > 0 ? 1 : 0);
}

main().catch((error) => {
  jsonOut({
    status: "error",
    stage: "pre-push",
    reason: "unexpected_exception",
    message: error instanceof Error ? error.message : String(error)
  });
  process.exit(1);
});
