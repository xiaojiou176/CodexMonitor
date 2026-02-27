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

function createTaskRunner(name, args, options = {}) {
  const { heartbeatMs = 0 } = options;

  return (signal) => new Promise((resolve, reject) => {
    if (DRY_RUN) {
      console.log(`[precommit][dry-run] ${name}: npm ${args.join(" ")}`);
      resolve();
      return;
    }

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
      reject(error);
    });

    child.on("close", (code, rawSignal) => {
      cleanup();
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

async function main() {
  const complianceMode = process.env.PRECOMMIT_COMPLIANCE_MODE === "warn" ? "warn" : "fail";

  console.log("[precommit] Phase 1/3: doc drift gate");
  await runTask("preflight:doc-drift", ["run", "preflight:doc-drift", ...(DRY_RUN ? ["--", "--dry-run"] : [])]);

  console.log("[precommit] Phase 2/3: security + compliance gates (parallel)");
  await runParallelTasks("Phase 2 security + compliance gates", [
    createTaskRunner("check:secrets:staged", ["run", "check:secrets:staged"]),
    createTaskRunner("check:keys:source-policy", ["run", "check:keys:source-policy"]),
    createTaskRunner("check:real-llm-alias-usage", ["run", "check:real-llm-alias-usage"]),
    createTaskRunner("check:critical-path-logging", [
      "run",
      "check:critical-path-logging",
      ...(DRY_RUN ? ["--", "--dry-run"] : []),
    ]),
    createTaskRunner("env:doctor:staged", ["run", "env:doctor:staged"]),
    createTaskRunner("env:rationalize:check", ["run", "env:rationalize:check"]),
    createTaskRunner("check:lazy-load:evidence-gate", [
      "run",
      "check:lazy-load:evidence-gate",
      "--",
      `--enforce=${complianceMode}`,
      ...(DRY_RUN ? ["--dry-run"] : []),
    ]),
    createTaskRunner("check:compat:option-log", [
      "run",
      "check:compat:option-log",
      "--",
      `--enforce=${complianceMode}`,
      ...(DRY_RUN ? ["--dry-run"] : []),
    ]),
  ]);

  console.log("[precommit] Phase 3/3: parallel fast gates");
  await runParallelTasks("Parallel fast gates", [
    createTaskRunner("test:assertions:guard", ["run", "test:assertions:guard"], { heartbeatMs: HEARTBEAT_MS }),
    createTaskRunner("guard:reuse-search", ["run", "guard:reuse-search"], { heartbeatMs: HEARTBEAT_MS }),
    createTaskRunner("lint:strict", ["run", "lint:strict"], { heartbeatMs: HEARTBEAT_MS }),
  ]);

  console.log("[precommit] All gates passed.");
}

main().catch((error) => {
  console.error("[precommit] Failed:", error instanceof Error ? error.message : String(error));
  process.exit(1);
});
