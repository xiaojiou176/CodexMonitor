import { defineConfig, devices } from "@playwright/test";

// Env defaults are documented in `.env.example`.
const port = Number(process.env.PLAYWRIGHT_WEB_PORT ?? "17473");
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${port}`;
const hasRealExternalTarget = Boolean(process.env.REAL_EXTERNAL_URL?.trim());

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never" }]]
    : [["list"]],
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
      },
    },
  ],
  webServer: process.env.PLAYWRIGHT_BASE_URL || hasRealExternalTarget
    ? undefined
    : {
        command: `npm run dev -- --host 127.0.0.1 --port ${port}`,
        port,
        timeout: 120_000,
        reuseExistingServer: !process.env.CI,
      },
});
