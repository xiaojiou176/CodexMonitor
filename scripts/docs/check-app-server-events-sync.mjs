#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..", "..");
const methodsSourcePath = path.join(repoRoot, "src/utils/appServerEvents.ts");
const docsPath = path.join(repoRoot, "docs/app-server-events.md");

const BLOCK_START = "<!-- AUTO-GENERATED:SUPPORTED_APP_SERVER_METHODS:START -->";
const BLOCK_END = "<!-- AUTO-GENERATED:SUPPORTED_APP_SERVER_METHODS:END -->";

function readFile(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function parseSupportedMethods(sourceText) {
  const blockMatch = sourceText.match(
    /SUPPORTED_APP_SERVER_METHODS\s*=\s*\[(?<block>[\s\S]*?)\]\s*as const/,
  );
  if (!blockMatch?.groups?.block) {
    throw new Error("Could not parse SUPPORTED_APP_SERVER_METHODS from appServerEvents.ts");
  }
  return [...blockMatch.groups.block.matchAll(/"([^"]+)"/g)].map((entry) => entry[1]);
}

function parseDocMethods(docText) {
  const startIndex = docText.indexOf(BLOCK_START);
  const endIndex = docText.indexOf(BLOCK_END);
  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
    throw new Error(
      `Could not find controlled block markers in docs/app-server-events.md (${BLOCK_START} ... ${BLOCK_END})`,
    );
  }
  const blockContent = docText.slice(startIndex + BLOCK_START.length, endIndex);
  return blockContent
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => line.replace(/^- `?/, "").replace(/`$/, "").trim());
}

function formatList(items) {
  return items.map((item) => `- ${item}`).join("\n");
}

const sourceText = readFile(methodsSourcePath);
const docText = readFile(docsPath);
const sourceMethods = parseSupportedMethods(sourceText);
const docMethods = parseDocMethods(docText);

const mismatch =
  sourceMethods.length !== docMethods.length ||
  sourceMethods.some((value, index) => value !== docMethods[index]);

if (mismatch) {
  console.error("app-server events docs drift detected.");
  console.error("\nExpected (from src/utils/appServerEvents.ts):");
  console.error(formatList(sourceMethods));
  console.error("\nActual (from docs controlled block):");
  console.error(formatList(docMethods));
  process.exit(1);
}

console.log("app-server events docs are in sync.");
