#!/usr/bin/env node

import { spawn } from "node:child_process";

const DRY_RUN = process.argv.includes("--dry-run");
const HEARTBEAT_LEVEL = (process.env.PREFLIGHT_HEARTBEAT_LEVEL ?? "normal").toLowerCase();

const HEARTBEAT_CONFIG = {
  quiet: { intervalMs: 90_000, minElapsedMs: 120_000 },
  normal: { intervalMs: 60_000, minElapsedMs: 60_000 },
  debug: { intervalMs: 20_000, minElapsedMs: 20_000 },
};

function resolveHeartbeatConfig() {
  if (HEARTBEAT_LEVEL in HEARTBEAT_CONFIG) {
    return HEARTBEAT_CONFIG[HEARTBEAT_LEVEL];
  }
  return HEARTBEAT_CONFIG.normal;
}

function npmCommand() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

function runTask(name, args, options = {}) {
  const { heartbeatMs = 0 } = options;
  const { minElapsedMs } = resolveHeartbeatConfig();

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
    let emittedHeartbeat = false;
    if (heartbeatMs > 0) {
      heartbeatTimer = setInterval(() => {
        const elapsedMs = Date.now() - startedAt;
        if (elapsedMs < minElapsedMs) {
          return;
        }
        emittedHeartbeat = true;
        const elapsed = Math.floor(elapsedMs / 1000);
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
      if (heartbeatMs > 0 && emittedHeartbeat) {
        const totalSeconds = Math.floor((Date.now() - startedAt) / 1000);
        console.log(`[heartbeat][preflight] ${name} completed (${totalSeconds}s)`);
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
  const { intervalMs } = resolveHeartbeatConfig();
  const heartbeatMs = HEARTBEAT_LEVEL === "quiet" ? 0 : intervalMs;
  console.log("[preflight] Phase 1/2: short gates before long jobs");
  await runTask(
    "preflight:doc-drift (branch)",
    ["run", "preflight:doc-drift", ...(DRY_RUN ? ["--", "--dry-run", "--mode=branch"] : ["--", "--mode=branch"])],
    { heartbeatMs },
  );
  await runTask("env:rationalize:check", ["run", "env:rationalize:check"], { heartbeatMs });
  await runTask("env:doctor:dev", ["run", "env:doctor:dev"], { heartbeatMs });
  await runTask("preflight:quick", ["run", "preflight:quick"], { heartbeatMs });

  console.log("[preflight] Phase 2/2: long jobs in parallel with heartbeat");
  await runParallelLongTasks([
    runTask("test:coverage:gate", ["run", "test:coverage:gate"], { heartbeatMs }),
    runTask("check:rust", ["run", "check:rust"], { heartbeatMs }),
    runTask("test:smoke:ui", ["run", "test:smoke:ui"], { heartbeatMs }),
    runTask("test:live:preflight", ["run", "test:live:preflight"], { heartbeatMs }),
  ]);

  console.log("[preflight] All gates passed.");
}

main().catch((error) => {
  console.error("[preflight] Failed:", error instanceof Error ? error.message : String(error));
  process.exit(1);
});
