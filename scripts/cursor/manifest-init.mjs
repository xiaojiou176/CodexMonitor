#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

function getArgValue(flag, fallback = null) {
  const direct = process.argv.find((entry) => entry.startsWith(`${flag}=`));
  if (direct) {
    return direct.slice(flag.length + 1);
  }

  const index = process.argv.findIndex((entry) => entry === flag);
  if (index >= 0 && process.argv[index + 1]) {
    return process.argv[index + 1];
  }

  return fallback;
}

const force = process.argv.includes("--force");
const rootDir = process.cwd();
const manifestPath = path.resolve(
  rootDir,
  getArgValue("--manifest", ".runtime-cache/cursor/cursor-agents.manifest.json"),
);

const templatePath = path.resolve(
  rootDir,
  "docs/examples/cursor-agents.manifest.example.json",
);

async function main() {
  await mkdir(path.dirname(manifestPath), { recursive: true });

  if (!force) {
    try {
      await readFile(manifestPath, "utf-8");
      console.log(`Manifest already exists: ${manifestPath}`);
      console.log("Use --force to overwrite.");
      process.exit(0);
    } catch {
      // continue
    }
  }

  const templateRaw = await readFile(templatePath, "utf-8");
  const template = JSON.parse(templateRaw);

  if (Array.isArray(template.sessions) && template.sessions.length > 0) {
    template.sessions[0].repoPath = rootDir;
  }

  await writeFile(manifestPath, `${JSON.stringify(template, null, 2)}\n`, "utf-8");

  console.log("✅ Cursor agent manifest initialized");
  console.log(`- template: ${templatePath}`);
  console.log(`- output:   ${manifestPath}`);
}

main().catch((error) => {
  console.error("❌ Failed to initialize manifest");
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});
