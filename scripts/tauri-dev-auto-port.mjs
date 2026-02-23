import { createServer } from "node:net";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, "..");

const DEFAULT_PORT = 17420;
const MAX_PORT = 17520;

function isPortAvailableOnHost(port, host) {
  return new Promise((resolveAvailable) => {
    const server = createServer();
    server.unref();
    server.on("error", () => resolveAvailable(false));
    server.listen(port, host, () => {
      server.close(() => resolveAvailable(true));
    });
  });
}

async function isPortAvailable(port) {
  const hostChecks = await Promise.all([
    isPortAvailableOnHost(port, undefined),
    isPortAvailableOnHost(port, "127.0.0.1"),
    isPortAvailableOnHost(port, "::1"),
  ]);
  return hostChecks.every(Boolean);
}

async function pickDevPorts() {
  for (let port = DEFAULT_PORT; port <= MAX_PORT; port += 1) {
    const hmrPort = port + 1;
    const [portFree, hmrPortFree] = await Promise.all([
      isPortAvailable(port),
      isPortAvailable(hmrPort),
    ]);

    if (portFree && hmrPortFree) {
      return { port, hmrPort };
    }
  }

  throw new Error(
    `[tauri:dev] No available dev ports in range ${DEFAULT_PORT}-${MAX_PORT + 1}.`,
  );
}

async function writeTauriConfig(port) {
  const baseConfigPath = resolve(repoRoot, "src-tauri/tauri.conf.json");
  const baseConfig = JSON.parse(await readFile(baseConfigPath, "utf8"));
  const nextConfig = {
    ...baseConfig,
    build: {
      ...baseConfig.build,
      beforeDevCommand: `npm run dev -- --port ${port} --strictPort`,
      devUrl: `http://localhost:${port}`,
    },
  };

  const targetPath = resolve(
    repoRoot,
    ".runtime-cache/tauri/tauri.dev.auto-port.json",
  );
  await mkdir(dirname(targetPath), { recursive: true });
  await writeFile(targetPath, `${JSON.stringify(nextConfig, null, 2)}\n`, "utf8");
  return targetPath;
}

async function main() {
  const { port, hmrPort } = await pickDevPorts();
  const isDefaultPort = port === DEFAULT_PORT;
  console.log(
    isDefaultPort
      ? `[tauri:dev] Using default dev port ${port}.`
      : `[tauri:dev] Port ${DEFAULT_PORT} is busy, using ${port} instead.`,
  );

  const tauriConfigPath = await writeTauriConfig(port);
  const npmBin = process.platform === "win32" ? "npm.cmd" : "npm";
  const child = spawn(
    npmBin,
    [
      "exec",
      "tauri",
      "--",
      "dev",
      "--config",
      tauriConfigPath,
      ...process.argv.slice(2),
    ],
    {
      cwd: repoRoot,
      stdio: "inherit",
      env: {
        ...process.env,
        TAURI_DEV_PORT: String(port),
        TAURI_DEV_HMR_PORT: String(hmrPort),
      },
    },
  );

  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 0);
  });

  child.on("error", (error) => {
    console.error(`[tauri:dev] Failed to start tauri: ${error.message}`);
    process.exit(1);
  });
}

main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : `[tauri:dev] ${String(error)}`,
  );
  process.exit(1);
});
