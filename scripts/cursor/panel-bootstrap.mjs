#!/usr/bin/env node

import { mkdir, stat } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import fs from "node:fs";

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

function hasFlag(flag) {
  return process.argv.includes(flag);
}

function isExecutableFile(filePath) {
  try {
    const entry = fs.statSync(filePath);
    if (!entry.isFile()) return false;
    if (process.platform === "win32") return true;
    fs.accessSync(filePath, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function hasCommand(command) {
  const pathValue = process.env.PATH;
  if (!pathValue) return false;

  const dirs = pathValue.split(path.delimiter).filter(Boolean);

  if (process.platform !== "win32") {
    return dirs.some((dir) => isExecutableFile(path.join(dir, command)));
  }

  const pathExtValue = process.env.PATHEXT ?? ".EXE;.CMD;.BAT;.COM";
  const exts = pathExtValue.split(";").filter(Boolean);
  const hasExtension = path.extname(command) !== "";

  for (const dir of dirs) {
    if (hasExtension) {
      if (isExecutableFile(path.join(dir, command))) return true;
      continue;
    }
    for (const ext of exts) {
      if (isExecutableFile(path.join(dir, `${command}${ext}`))) return true;
    }
  }

  return false;
}

function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, stdio: "inherit", env: process.env });
  if (result.error) {
    throw result.error;
  }
  if (typeof result.status === "number" && result.status !== 0) {
    throw new Error(`${command} exited with code ${result.status}`);
  }
}

async function existsPath(targetPath) {
  try {
    await stat(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const rootDir = process.cwd();
  const runDocker = hasFlag("--run-docker");
  const repoUrl = getArgValue("--repo-url", "https://github.com/siteboon/claudecodeui.git");
  const targetDir = path.resolve(
    rootDir,
    getArgValue("--target-dir", ".runtime-cache/cursor/panel/claudecodeui"),
  );

  await mkdir(path.dirname(targetDir), { recursive: true });

  const alreadyCloned = await existsPath(targetDir);
  const dockerCommand = hasCommand("docker")
    ? "docker"
    : hasCommand("docker-compose")
      ? "docker-compose"
      : null;

  console.log("[Cursor Panel Bootstrap]");
  console.log(`- repo: ${repoUrl}`);
  console.log(`- target: ${targetDir}`);
  console.log(`- mode: ${runDocker ? "run-docker" : "print-only"}`);

  if (!alreadyCloned) {
    console.log(`- clone: git clone ${repoUrl} ${targetDir}`);
    if (runDocker) {
      if (!hasCommand("git")) {
        throw new Error("git is required for --run-docker but was not found in PATH.");
      }
      run("git", ["clone", repoUrl, targetDir], rootDir);
    }
  } else {
    console.log("- clone: skipped (target already exists)");
  }

  console.log("\n[Next Commands]");
  if (dockerCommand === "docker") {
    console.log(`cd ${targetDir}`);
    console.log("docker compose up -d");
    console.log("docker compose logs -f --tail=100");
  } else if (dockerCommand === "docker-compose") {
    console.log(`cd ${targetDir}`);
    console.log("docker-compose up -d");
    console.log("docker-compose logs -f --tail=100");
  } else {
    console.log("⚠️ docker/docker-compose not found. Start panel manually in target directory.");
  }

  if (!runDocker) {
    console.log("\n✅ Print-only mode finished (no background services started).");
    return;
  }

  if (!dockerCommand) {
    throw new Error("docker or docker-compose is required for --run-docker.");
  }

  if (dockerCommand === "docker") {
    run("docker", ["compose", "up", "-d"], targetDir);
  } else {
    run("docker-compose", ["up", "-d"], targetDir);
  }

  console.log("\n✅ Panel started with Docker.");
  console.log(`- dir: ${targetDir}`);
}

main().catch((error) => {
  console.error("❌ Failed to bootstrap panel");
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});
