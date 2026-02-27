#!/usr/bin/env node

import { spawn } from "node:child_process";

const DRY_RUN = process.argv.includes("--dry-run");
const QUICK_ONLY = process.argv.includes("--quick-only");
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

function createTaskRunner(name, args, options = {}) {
  const { heartbeatMs = 0 } = options;
  const { minElapsedMs } = resolveHeartbeatConfig();

  return (signal) => new Promise((resolve, reject) => {
    if (DRY_RUN) {
      console.log(`[preflight][dry-run] ${name}: npm ${args.join(" ")}`);
      resolve();
      return;
    }

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

    const cleanup = () => {
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
      }
      signal.removeEventListener("abort", onAbort);
    };

    const onAbort = () => {
      if (!child.killed) {
        child.kill("SIGTERM");
      }
    };

    signal.addEventListener("abort", onAbort, { once: true });

    child.on("error", (error) => {
      cleanup();
      reject(new Error(`${name} failed to start: ${error.message}`));
    });

    child.on("close", (code, rawSignal) => {
      cleanup();
      if (heartbeatMs > 0 && emittedHeartbeat) {
        const totalSeconds = Math.floor((Date.now() - startedAt) / 1000);
        console.log(`[heartbeat][preflight] ${name} completed (${totalSeconds}s)`);
      }
      if (code === 0) {
        resolve();
        return;
      }
      if (signal.aborted && rawSignal === "SIGTERM") {
        reject(new Error(`${name} cancelled due to earlier gate failure`));
        return;
      }
      reject(new Error(`${name} failed with exit code ${code ?? 1}`));
    });
  });
}

async function runParallelTasks(label, taskFactories) {
  if (taskFactories.length === 0) {
    return;
  }

  const controller = new AbortController();
  const failures = [];
  const promises = taskFactories.map((runTaskFactory) => runTaskFactory(controller.signal).catch((error) => {
    failures.push(error);
    if (!controller.signal.aborted) {
      controller.abort();
    }
    throw error;
  }));

  await Promise.allSettled(promises);

  if (failures.length > 0) {
    const messages = failures.map((error) => error?.message ?? String(error));
    throw new Error(`${label} failed:\n- ${messages.join("\n- ")}`);
  }
}

function quickTasks(heartbeatMs) {
  return [
    createTaskRunner("typecheck", ["run", "typecheck"], { heartbeatMs }),
  ];
}

async function main() {
  const { intervalMs } = resolveHeartbeatConfig();
  const heartbeatMs = HEARTBEAT_LEVEL === "quiet" ? 0 : intervalMs;
  if (QUICK_ONLY) {
    console.log("[preflight:quick] Running quick gates in parallel");
    await runParallelTasks("preflight:quick gates", quickTasks(heartbeatMs));
    console.log("[preflight:quick] All quick gates passed.");
    return;
  }

  console.log("[preflight] Phase 1/2: short gates before long jobs");
  await runTask(
    "preflight:doc-drift (branch)",
    ["run", "preflight:doc-drift", ...(DRY_RUN ? ["--", "--dry-run", "--mode=branch"] : ["--", "--mode=branch"])],
    { heartbeatMs },
  );
  await runParallelTasks("Phase 1 short gates", [
    createTaskRunner("env:rationalize:check", ["run", "env:rationalize:check"], { heartbeatMs }),
    createTaskRunner("env:doctor:dev", ["run", "env:doctor:dev"], { heartbeatMs }),
    createTaskRunner("preflight:quick", ["run", "preflight:quick"], { heartbeatMs }),
  ]);

  console.log("[preflight] Phase 2/2: long jobs in parallel with heartbeat");
  await runParallelTasks("Parallel long tasks", [
    createTaskRunner("test:coverage:gate", ["run", "test:coverage:gate"], { heartbeatMs }),
    createTaskRunner("check:rust", ["run", "check:rust"], { heartbeatMs }),
    createTaskRunner("test:smoke:ui", ["run", "test:smoke:ui"], { heartbeatMs }),
    createTaskRunner("test:live:preflight", ["run", "test:live:preflight"], { heartbeatMs }),
  ]);

  console.log("[preflight] All gates passed.");
}

main().catch((error) => {
  console.error("[preflight] Failed:", error instanceof Error ? error.message : String(error));
  process.exit(1);
});
