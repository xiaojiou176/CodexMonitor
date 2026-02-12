#!/usr/bin/env node

import { readFile } from "node:fs/promises";
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
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) return false;
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

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'"'"'`)}'`;
}

function sanitizeWindowName(value, index) {
  const fallback = `agent-${index + 1}`;
  const text = (value || fallback).toLowerCase().replace(/[^a-z0-9_-]+/g, "-");
  return text.slice(0, 28) || fallback;
}

function buildAgentInvocation(session) {
  if (session.startCommand && typeof session.startCommand === "string") {
    return session.startCommand;
  }

  const runtime = hasCommand("cursor-agent") ? "cursor-agent" : "cursor";

  if (session.resumeId && typeof session.resumeId === "string") {
    if (runtime === "cursor-agent") {
      return `cursor-agent --resume=${shellQuote(session.resumeId)}`;
    }
    return `cursor agent --resume=${shellQuote(session.resumeId)}`;
  }

  const prompt =
    typeof session.prompt === "string" && session.prompt.trim().length > 0
      ? session.prompt.trim()
      : "Summarize workspace status and propose the next focused coding steps.";

  if (runtime === "cursor-agent") {
    return `cursor-agent ${shellQuote(prompt)}`;
  }
  return `cursor agent ${shellQuote(prompt)}`;
}

function runCommand(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit" });
  if (result.error) {
    throw result.error;
  }
  if (typeof result.status === "number" && result.status !== 0) {
    throw new Error(`${command} exited with code ${result.status}`);
  }
}

function hasTmuxSession(name) {
  const check = spawnSync("tmux", ["has-session", "-t", name], { stdio: "ignore" });
  return check.status === 0;
}

async function main() {
  const rootDir = process.cwd();
  const manifestPath = path.resolve(
    rootDir,
    getArgValue("--manifest", ".runtime-cache/cursor/cursor-agents.manifest.json"),
  );
  const mode = getArgValue("--mode", "print");
  const attach = hasFlag("--attach");
  const dryRun = hasFlag("--dry-run");
  const selected = getArgValue("--only", "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  const raw = await readFile(manifestPath, "utf-8");
  const manifest = JSON.parse(raw);

  if (!Array.isArray(manifest.sessions) || manifest.sessions.length === 0) {
    throw new Error(`No sessions found in manifest: ${manifestPath}`);
  }

  const sessions =
    selected.length === 0
      ? manifest.sessions
      : manifest.sessions.filter((entry) => selected.includes(entry.name));

  if (sessions.length === 0) {
    throw new Error(
      `No matching sessions after --only filter (${selected.join(", ") || "none"}).`,
    );
  }

  const commands = sessions.map((session, index) => {
    const repoPath = path.resolve(rootDir, session.repoPath ?? ".");
    const invoke = buildAgentInvocation(session);
    return {
      name: session.name ?? `agent-${index + 1}`,
      windowName: sanitizeWindowName(session.name, index),
      repoPath,
      command: `cd ${shellQuote(repoPath)} && ${invoke}`,
    };
  });

  if (mode === "print") {
    console.log(`[Cursor Sessions] manifest=${manifestPath}`);
    for (const item of commands) {
      console.log(`\n## ${item.name}`);
      console.log(item.command);
    }
    return;
  }

  if (mode !== "tmux") {
    throw new Error(`Unsupported mode: ${mode}. Expected print|tmux.`);
  }

  if (!hasCommand("tmux")) {
    throw new Error("tmux is required for --mode=tmux but was not found in PATH.");
  }

  const tmuxSessionName = manifest.tmuxSessionName || "cursor-agents";
  const shell = process.env.SHELL || "/bin/bash";

  if (dryRun) {
    console.log(`[Dry Run] tmux session: ${tmuxSessionName}`);
    console.log(
      `tmux new-session -d -s ${tmuxSessionName} -n ${commands[0].windowName} ${shellQuote(
        `${shell} -lc ${shellQuote(commands[0].command)}`,
      )}`,
    );
    for (const item of commands.slice(1)) {
      console.log(
        `tmux new-window -t ${tmuxSessionName} -n ${item.windowName} ${shellQuote(
          `${shell} -lc ${shellQuote(item.command)}`,
        )}`,
      );
    }
    if (attach) {
      console.log(`tmux attach -t ${tmuxSessionName}`);
    }
    return;
  }

  if (hasTmuxSession(tmuxSessionName)) {
    throw new Error(
      `tmux session already exists: ${tmuxSessionName}. Close it or use a different tmuxSessionName in manifest.`,
    );
  }

  const first = commands[0];
  runCommand("tmux", [
    "new-session",
    "-d",
    "-s",
    tmuxSessionName,
    "-n",
    first.windowName,
    `${shell} -lc ${shellQuote(first.command)}`,
  ]);

  for (const item of commands.slice(1)) {
    runCommand("tmux", [
      "new-window",
      "-t",
      tmuxSessionName,
      "-n",
      item.windowName,
      `${shell} -lc ${shellQuote(item.command)}`,
    ]);
  }

  console.log(`✅ Started tmux session: ${tmuxSessionName}`);
  console.log(`- windows: ${commands.length}`);

  if (attach) {
    runCommand("tmux", ["attach", "-t", tmuxSessionName]);
  } else {
    console.log(`- attach: tmux attach -t ${tmuxSessionName}`);
  }
}

main().catch((error) => {
  console.error("❌ Failed to prepare Cursor sessions");
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});
