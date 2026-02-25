#!/usr/bin/env node

import { spawn } from "node:child_process";

const DRY_RUN = process.argv.includes("--dry-run");
const HEARTBEAT_MS = 20_000;

function npmCommand() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

function runTask(name, args, options = {}) {
  const { heartbeatMs = 0 } = options;

  if (DRY_RUN) {
    console.log(`[precommit][dry-run] ${name}: npm ${args.join(" ")}`);
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const child = spawn(npmCommand(), args, {
      stdio: "inherit",
      env: process.env,
    });

    let heartbeatTimer = null;
    if (heartbeatMs > 0) {
      heartbeatTimer = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startedAt) / 1000);
        console.log(`[heartbeat][precommit] ${name} still running (${elapsed}s)`);
      }, heartbeatMs);
    }

    child.on("error", (error) => {
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
      }
      reject(error);
    });

    child.on("close", (code) => {
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
      }
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${name} failed with exit code ${code ?? 1}`));
    });
  });
}

async function main() {
  console.log("[precommit] Phase 1/2: doc drift gate");
  await runTask("preflight:doc-drift", ["run", "preflight:doc-drift", ...(DRY_RUN ? ["--", "--dry-run"] : [])]);

  console.log("[precommit] Phase 2/2: parallel fast gates");
  const results = await Promise.allSettled([
    runTask("test:assertions:guard", ["run", "test:assertions:guard"], { heartbeatMs: HEARTBEAT_MS }),
    runTask("lint:strict", ["run", "lint:strict"], { heartbeatMs: HEARTBEAT_MS }),
  ]);
  const failed = results.filter((result) => result.status === "rejected");
  if (failed.length > 0) {
    const messages = failed.map((result) => result.reason?.message ?? String(result.reason));
    throw new Error(`Parallel fast gates failed:\n- ${messages.join("\n- ")}`);
  }

  console.log("[precommit] All gates passed.");
}

main().catch((error) => {
  console.error("[precommit] Failed:", error instanceof Error ? error.message : String(error));
  process.exit(1);
});
