#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const CWD = process.cwd();
const CHECK_ONLY = process.argv.includes("--check");
const WRITE_REPORT = process.argv.includes("--write-report") || !CHECK_ONLY;

const SCHEMA_PATH = path.join(CWD, "config", "env.schema.json");
const ALLOWLIST_PATH = path.join(CWD, "config", "env.runtime-allowlist.json");
const REPORT_PATH = path.join(CWD, "docs", "reference", "env-rationalization-plan.md");
const ENV_ACCESS_PATTERNS = [
  "process\\.env\\.[A-Z0-9_]+",
  "import\\.meta\\.env\\.[A-Z0-9_]+",
  "env::var\\(\"[A-Z0-9_]+\"\\)",
  "env::var_os\\(\"[A-Z0-9_]+\"\\)",
  "env!\\(\"[A-Z0-9_]+\"\\)",
];
const ENV_VARIANT_FILES = [".env", ".env.example", ".env.local", ".testflight.local.env.example"];

function parseEnvFile(filePath) {
  const content = readFileSync(filePath, "utf8");
  const keys = [];
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }
    const match = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/);
    if (match) {
      keys.push(match[1]);
    }
  }
  return keys;
}

function parseEnvFileSafe(filePath) {
  if (!existsSync(filePath)) {
    return [];
  }
  return parseEnvFile(filePath);
}

function runRg(patterns) {
  try {
    const output = execFileSync(
      "rg",
      [
        "-n",
        "--no-heading",
        "--glob",
        "!node_modules/**",
        "--glob",
        "!.git/**",
        "--glob",
        "!dist/**",
        "--glob",
        "!.runtime-cache/**",
        "--glob",
        "!docs/**",
        "--glob",
        "!audit/**",
        "-e",
        patterns[0],
        "-e",
        patterns[1],
        "-e",
        patterns[2],
        "-e",
        patterns[3],
        "-e",
        patterns[4],
        "src",
        "src-tauri",
        "scripts",
        "e2e",
        "playwright.config.ts",
        "playwright.external.config.ts",
        "vite.config.ts",
      ],
      { encoding: "utf8", cwd: CWD },
    );
    return output
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  } catch (error) {
    const stdout = error?.stdout;
    if (typeof stdout === "string" && stdout.trim() !== "") {
      return stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    }
    return [];
  }
}

function runRgSingle(pattern, searchPaths) {
  try {
    const output = execFileSync(
      "rg",
      [
        "-n",
        "--no-heading",
        "--glob",
        "!node_modules/**",
        "--glob",
        "!.git/**",
        "--glob",
        "!dist/**",
        "--glob",
        "!.runtime-cache/**",
        "-e",
        pattern,
        ...searchPaths,
      ],
      { encoding: "utf8", cwd: CWD },
    );
    return output
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  } catch (error) {
    const stdout = error?.stdout;
    if (typeof stdout === "string" && stdout.trim() !== "") {
      return stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    }
    return [];
  }
}

function extractEnvKeys(lines) {
  const keys = [];
  const keyRegexes = [
    /process\.env\.([A-Z0-9_]+)/g,
    /import\.meta\.env\.([A-Z0-9_]+)/g,
    /env::var\("([A-Z0-9_]+)"\)/g,
    /env::var_os\("([A-Z0-9_]+)"\)/g,
    /env!\("([A-Z0-9_]+)"\)/g,
  ];
  for (const line of lines) {
    for (const regex of keyRegexes) {
      let match = regex.exec(line);
      while (match) {
        keys.push(match[1]);
        match = regex.exec(line);
      }
    }
  }
  return keys;
}

function uniqueSorted(values) {
  return [...new Set(values)].sort();
}

function isGovernedRuntimeKey(key) {
  return /^(VITE_|TAURI_|PLAYWRIGHT_|REAL_|GEMINI_|CODEX_|CODEX_MONITOR_)/.test(key);
}

function toBullets(values) {
  if (values.length === 0) {
    return "- (none)";
  }
  return values.map((value) => `- \`${value}\``).join("\n");
}

function main() {
  const schema = JSON.parse(readFileSync(SCHEMA_PATH, "utf8"));
  const allowlist = JSON.parse(readFileSync(ALLOWLIST_PATH, "utf8"));

  const schemaKeys = uniqueSorted((schema.variables || []).map((item) => item.name));
  const allowlistKeys = uniqueSorted(allowlist.nonTemplateRuntimeKeys || []);
  const templateKeys = uniqueSorted(parseEnvFile(path.join(CWD, ".env.example")));

  const runtimeKeysDiscovered = uniqueSorted(
    extractEnvKeys(runRg(ENV_ACCESS_PATTERNS)).filter((key) => isGovernedRuntimeKey(key)),
  );
  const envVariantKeys = uniqueSorted(
    ENV_VARIANT_FILES.flatMap((fileName) => parseEnvFileSafe(path.join(CWD, fileName))),
  );
  const shellAssignmentKeys = uniqueSorted(
    runRgSingle(
      "\\b([A-Z][A-Z0-9_]*)\\s*=",
      ["scripts", ".github/workflows"],
    )
      .map((line) => line.match(/\b([A-Z][A-Z0-9_]*)\s*=/)?.[1] ?? "")
      .filter(Boolean),
  );
  const workflowSecretVarKeys = uniqueSorted(
    runRgSingle(
      "\\$\\{\\{\\s*(?:vars|secrets)\\.([A-Z0-9_]+)",
      [".github/workflows"],
    )
      .map((line) => line.match(/\$\{\{\s*(?:vars|secrets)\.([A-Z0-9_]+)/)?.[1] ?? "")
      .filter(Boolean),
  );
  const broadEnvLikeKeys = uniqueSorted([
    ...extractEnvKeys(runRg(ENV_ACCESS_PATTERNS)),
    ...envVariantKeys,
    ...shellAssignmentKeys,
    ...workflowSecretVarKeys,
  ]);

  const canonicalCount = schemaKeys.length;
  const runtimeUsageCount = runtimeKeysDiscovered.length;
  const broadEnvLikeCount = broadEnvLikeKeys.length;

  const known = new Set([...schemaKeys, ...allowlistKeys]);
  const unknownRuntimeKeys = runtimeKeysDiscovered.filter((key) => !known.has(key));

  const directUsageGapCandidates = templateKeys.filter((key) => !runtimeKeysDiscovered.includes(key));
  const deprecatedRuntimeKeys = uniqueSorted((schema.deprecatedKeys || []).filter((key) => /^REAL_/.test(key)));

  console.log(`[env-rationalize] canonical_count=${canonicalCount}`);
  console.log(`[env-rationalize] runtime_usage_count=${runtimeUsageCount}`);
  console.log(`[env-rationalize] broad_env_like_count=${broadEnvLikeCount}`);
  console.log(`[env-rationalize] runtime discovered=${runtimeUsageCount}`);
  console.log(`[env-rationalize] schema keys=${canonicalCount}`);
  console.log(`[env-rationalize] allowlist keys=${allowlistKeys.length}`);
  console.log(`[env-rationalize] unknown runtime keys=${unknownRuntimeKeys.length}`);
  console.log(`[env-rationalize] template_unread_keys=${directUsageGapCandidates.length}`);

  if (unknownRuntimeKeys.length > 0) {
    console.error("[env-rationalize] unknown runtime-prefixed keys detected:");
    for (const key of unknownRuntimeKeys) {
      console.error(`  - ${key}`);
    }
  }
  if (directUsageGapCandidates.length > 0) {
    console.error("[env-rationalize] .env.example contains keys not directly read by code:");
    for (const key of directUsageGapCandidates) {
      console.error(`  - ${key}`);
    }
    console.error(
      "[env-rationalize] move non-local keys out of .env.example (release template or CI secrets).",
    );
  }

  if (WRITE_REPORT) {
    const report = `# Env Rationalization Plan

Last updated: 2026-02-26

## Snapshot

- Runtime-prefixed keys discovered in repo: \`${runtimeKeysDiscovered.length}\`
- Canonical schema keys: \`${schemaKeys.length}\`
- Broad env-like keys discovered in repo: \`${broadEnvLikeCount}\`
- Non-template allowlist keys: \`${allowlistKeys.length}\`
- Unknown runtime-prefixed keys: \`${unknownRuntimeKeys.length}\`

## Keep (Canonical Schema)

${toBullets(schemaKeys)}

## Keep (Non-template Allowlist)

${toBullets(allowlistKeys)}

## Unknown Runtime Keys (Must Govern)

${toBullets(unknownRuntimeKeys)}

## Deprecated Runtime Keys (Blocked)

${toBullets(deprecatedRuntimeKeys)}

## Direct-Usage Gap Candidates

${toBullets(directUsageGapCandidates)}

## Governance Rules

1. New runtime-prefixed env keys must be added to \`config/env.schema.json\` or \`config/env.runtime-allowlist.json\`.
2. \`npm run env:rationalize:check\` blocks drift during pre-commit.
3. Deprecated runtime keys are blocked from runtime codepaths.

## Evidence (Latest Run)

- Runtime artifacts:
  - \`.runtime-cache/test_output/real-llm/latest.json\`
  - \`.runtime-cache/test_output/live-preflight/latest.json\`
- Changed code references:
  - \`scripts/env-rationalize.mjs\`
`;
    mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
    writeFileSync(REPORT_PATH, report, "utf8");
    console.log(`[env-rationalize] report written: ${REPORT_PATH}`);
  }

  if (unknownRuntimeKeys.length > 0) {
    process.exit(1);
  }
  if (directUsageGapCandidates.length > 0) {
    process.exit(1);
  }

  console.log("[env-rationalize] passed.");
}

main();
