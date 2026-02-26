import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const globArgs = [
  "--files",
  "-g",
  "src/**/*.test.ts",
  "-g",
  "src/**/*.test.tsx",
  "-g",
  "e2e/**/*.spec.ts",
  "-g",
  "e2e/**/*.test.ts",
];

function listTestFiles() {
  const rgResult = spawnSync("rg", globArgs, {
    cwd: rootDir,
    encoding: "utf8",
  });
  if (!rgResult.error && rgResult.status === 0) {
    return rgResult.stdout
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
  }

  const gitLsFilesArgs = [
    "ls-files",
    "--",
    ":(glob)src/**/*.test.ts",
    ":(glob)src/**/*.test.tsx",
    ":(glob)e2e/**/*.spec.ts",
    ":(glob)e2e/**/*.test.ts",
  ];
  const gitResult = spawnSync("git", gitLsFilesArgs, {
    cwd: rootDir,
    encoding: "utf8",
  });
  if (!gitResult.error && gitResult.status === 0) {
    return gitResult.stdout
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
  }

  const rgError = rgResult.error ? `rg: ${rgResult.error.message}` : `rg exit=${rgResult.status}`;
  const gitError = gitResult.error ? `git: ${gitResult.error.message}` : `git exit=${gitResult.status}`;
  console.error(`[guard-placebo-assertions] Failed to enumerate test files (${rgError}; ${gitError})`);
  process.exit(2);
}

const files = listTestFiles();

const simpleLiteralPattern =
  /(?:true|false|null|undefined|-?\d+(?:\.\d+)?|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)/;
const sameLiteralAssertionPattern = new RegExp(
  `expect\\s*\\(\\s*(?<literal>${simpleLiteralPattern.source})\\s*\\)\\s*\\.\\s*(?:toBe|toEqual|toStrictEqual)\\s*\\(\\s*\\k<literal>\\s*\\)`,
  "gms",
);
const toBeDefinedPattern = /\bexpect\s*\([^\n)]*\)\s*\.\s*toBeDefined\s*\(\s*\)/gm;
const toBeDefinedAllowToken = "codex-allow-toBeDefined";

const findings = [];

const toLoc = (content, index) => {
  const untilMatch = content.slice(0, index);
  const line = untilMatch.split("\n").length;
  const lastNewline = untilMatch.lastIndexOf("\n");
  const col = index - lastNewline;
  return { line, col };
};

for (const relativePath of files) {
  const absolutePath = path.join(rootDir, relativePath);
  const content = readFileSync(absolutePath, "utf8");
  let sameLiteralMatch;
  let toBeDefinedMatch;

  while ((sameLiteralMatch = sameLiteralAssertionPattern.exec(content)) !== null) {
    const { line, col } = toLoc(content, sameLiteralMatch.index);

    findings.push({
      relativePath,
      line,
      col,
      code: "SAME_LITERAL_ASSERTION",
      message:
        "Do not assert identical literal values on both sides; assert behavior or a meaningful expected value.",
      snippet: sameLiteralMatch[0].replace(/\s+/g, " "),
    });
  }

  const lines = content.split("\n");
  while ((toBeDefinedMatch = toBeDefinedPattern.exec(content)) !== null) {
    const { line, col } = toLoc(content, toBeDefinedMatch.index);
    const currentLine = lines[line - 1] ?? "";
    const previousLine = lines[line - 2] ?? "";
    const allowListed =
      currentLine.includes(toBeDefinedAllowToken) || previousLine.includes(toBeDefinedAllowToken);

    if (allowListed) {
      continue;
    }

    findings.push({
      relativePath,
      line,
      col,
      code: "TO_BE_DEFINED_FORBIDDEN",
      message:
        "Low-value matcher `toBeDefined()` is forbidden by default. Use explicit matchers, or annotate the assertion line (or previous line) with `codex-allow-toBeDefined` when truly necessary.",
      snippet: toBeDefinedMatch[0].replace(/\s+/g, " "),
    });
  }
}

if (findings.length > 0) {
  console.error("[guard-placebo-assertions] Found forbidden low-signal assertions:");
  for (const finding of findings) {
    console.error(
      `- ${finding.relativePath}:${finding.line}:${finding.col} [${finding.code}] ${finding.message} -> ${finding.snippet}`,
    );
  }
  process.exit(1);
}

console.log("[guard-placebo-assertions] OK - no forbidden low-signal assertions found.");
