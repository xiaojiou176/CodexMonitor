#!/usr/bin/env node

import { spawn } from "node:child_process";

const DRY_RUN = process.argv.includes("--dry-run");
const HEARTBEAT_MS = 20_000;

function npmCommand() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

function runCommand(command, args, options = {}) {
  const { heartbeatMs = 0 } = options;

  if (DRY_RUN) {
    console.log(`[precommit][dry-run] ${command} ${args.join(" ")}`);
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const child = spawn(command, args, {
      stdio: "inherit",
      env: process.env,
    });

    let heartbeatTimer = null;
    if (heartbeatMs > 0) {
      heartbeatTimer = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startedAt) / 1000);
        console.log(`[heartbeat][precommit] ${command} ${args.join(" ")} still running (${elapsed}s)`);
      }, heartbeatMs);
    }

    child.on("error", (error) => {
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
      }
      reject(new Error(`${command} failed to start: ${error.message}`));
    });

    child.on("close", (code) => {
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
      }
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} ${args.join(" ")} failed with exit code ${code ?? 1}`));
    });
  });
}

function createCommandTaskRunner(name, command, args, options = {}) {
  const { heartbeatMs = 0 } = options;

  return async () => {
    try {
      await runCommand(command, args, { heartbeatMs });
    } catch (error) {
      const traceId = `precommit-command-task-${Date.now()}`;
      console.error("[precommit][command-task-failed]", {
        traceId,
        requestId: traceId,
        status: "failed",
        code: "PRECOMMIT_COMMAND_TASK_FAILED",
        task: name,
        command,
        args,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error(`${name} failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  };
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

function getStagedFiles() {
  if (DRY_RUN) {
    return [];
  }

  const command = process.platform === "win32" ? "git.exe" : "git";
  return new Promise((resolve, reject) => {
    const child = spawn(command, ["diff", "--name-only", "--cached"], {
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      reject(new Error(`git diff failed to start: ${error.message}`));
    });
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || `git diff --name-only --cached failed with exit code ${code ?? 1}`));
        return;
      }
      resolve(
        stdout
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean),
      );
    });
  });
}

async function main() {
  const complianceMode = process.env.PRECOMMIT_COMPLIANCE_MODE === "warn" ? "warn" : "fail";
  const stagedFiles = await getStagedFiles();
  const hasTsLikeChanges = stagedFiles.some((file) => /^(src\/|scripts\/|config\/|e2e\/|.*\.ts$|.*\.tsx$|tsconfig(\..+)?\.json$)/.test(file));
  const hasWorkflowChanges = stagedFiles.some((file) => /^\.github\/workflows\/.+\.ya?ml$/.test(file));
  const hasRustChanges = stagedFiles.some((file) => /^src-tauri\/.+\.rs$/.test(file));

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
  const phase3Tasks = [
    createTaskRunner("test:assertions:guard", ["run", "test:assertions:guard"], { heartbeatMs: HEARTBEAT_MS }),
    createTaskRunner("guard:reuse-search", ["run", "guard:reuse-search"], { heartbeatMs: HEARTBEAT_MS }),
    createTaskRunner("lint:strict", ["run", "lint:strict"], { heartbeatMs: HEARTBEAT_MS }),
  ];

  if (hasTsLikeChanges) {
    phase3Tasks.push(
      createTaskRunner("typecheck:ci", ["run", "typecheck:ci"], { heartbeatMs: HEARTBEAT_MS }),
    );
  }

  if (hasWorkflowChanges) {
    phase3Tasks.push(
      createCommandTaskRunner("workflow-hygiene(actionlint)", "actionlint", ["-color"], { heartbeatMs: HEARTBEAT_MS }),
    );
  }

  if (hasRustChanges) {
    phase3Tasks.push(
      createTaskRunner("check:rust", ["run", "check:rust"], { heartbeatMs: HEARTBEAT_MS }),
    );
  }

  await runParallelTasks("Parallel fast gates", phase3Tasks);

  console.log("[precommit] All gates passed.");
}

main().catch((error) => {
  console.error("[precommit] Failed:", error instanceof Error ? error.message : String(error));
  process.exit(1);
});
