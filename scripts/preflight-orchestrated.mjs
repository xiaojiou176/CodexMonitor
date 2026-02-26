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
    console.log(`[preflight][dry-run] ${name}: npm ${args.join(" ")}`);
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
        console.log(`[heartbeat][preflight] ${name} still running (${elapsed}s)`);
      }, heartbeatMs);
    }

    child.on("error", (error) => {
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
      }
      reject(new Error(`${name} failed to start: ${error.message}`));
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

async function runParallelLongTasks(tasks) {
  const results = await Promise.allSettled(tasks);
  const failed = results.filter((result) => result.status === "rejected");
  if (failed.length === 0) {
    return;
  }

  const messages = failed.map((result) => result.reason?.message ?? String(result.reason));
  throw new Error(`Parallel long tasks failed:\n- ${messages.join("\n- ")}`);
}

async function main() {
  console.log("[preflight] Phase 1/2: short gates before long jobs");
  await runTask(
    "preflight:doc-drift (branch)",
    ["run", "preflight:doc-drift", ...(DRY_RUN ? ["--", "--dry-run", "--mode=branch"] : ["--", "--mode=branch"])],
    { heartbeatMs: HEARTBEAT_MS },
  );
  await runTask("preflight:quick", ["run", "preflight:quick"], { heartbeatMs: HEARTBEAT_MS });

  console.log("[preflight] Phase 2/2: long jobs in parallel with heartbeat");
  await runParallelLongTasks([
    runTask("test", ["run", "test"], { heartbeatMs: HEARTBEAT_MS }),
    runTask("test:coverage:gate", ["run", "test:coverage:gate"], { heartbeatMs: HEARTBEAT_MS }),
    runTask("check:rust", ["run", "check:rust"], { heartbeatMs: HEARTBEAT_MS }),
    runTask("test:e2e:smoke", ["run", "test:e2e:smoke"], { heartbeatMs: HEARTBEAT_MS }),
    runTask("test:live:preflight", ["run", "test:live:preflight"], { heartbeatMs: HEARTBEAT_MS }),
  ]);

  console.log("[preflight] All gates passed.");
}

main().catch((error) => {
  console.error("[preflight] Failed:", error instanceof Error ? error.message : String(error));
  process.exit(1);
});
