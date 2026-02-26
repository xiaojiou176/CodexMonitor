#!/usr/bin/env node

import { spawn } from "node:child_process";

function truthy(value) {
  if (!value) {
    return false;
  }
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

function npxCommand() {
  return process.platform === "win32" ? "npx.cmd" : "npx";
}

async function main() {
  const skip =
    truthy(process.env.SKIP_UI_SMOKE) ||
    truthy(process.env.PREFLIGHT_SKIP_UI_SMOKE);

  if (skip) {
    console.log("[smoke-ui] SKIP: SKIP_UI_SMOKE/PREFLIGHT_SKIP_UI_SMOKE requested.");
    return;
  }

  const extraArgs = process.argv.slice(2);
  await new Promise((resolve, reject) => {
    const child = spawn(
      npxCommand(),
      ["playwright", "test", "e2e/smoke.spec.ts", ...extraArgs],
      {
        stdio: "inherit",
        env: process.env,
      },
    );

    child.on("error", (error) => {
      reject(new Error(`test:smoke:ui failed to start: ${error.message}`));
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`test:smoke:ui failed with exit code ${code ?? 1}`));
    });
  });
}

main().catch((error) => {
  console.error("[smoke-ui] Failed:", error instanceof Error ? error.message : String(error));
  process.exit(1);
});
