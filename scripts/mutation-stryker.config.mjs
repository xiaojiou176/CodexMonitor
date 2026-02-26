export function buildMutationConfig({ mutate, thresholdBreak }) {
  return {
    testRunner: "vitest",
    checkers: [],
    mutate,
    ignorePatterns: [
      ".runtime-cache/**",
      ".stryker-tmp/**",
      ".git/**",
      "node_modules/**",
      "logs/**",
      "cache/**",
      ".cache/**",
      "build/**",
      "dist/**",
      "coverage/**",
      "playwright-report/**",
      "test-results/**",
      "src-tauri/target/**",
      "src-tauri/gen/**",
    ],
    vitest: {
      configFile: "vite.config.ts",
    },
    coverageAnalysis: "off",
    timeoutMS: 30_000,
    concurrency: 2,
    reporters: ["clear-text", "json"],
    jsonReporter: {
      fileName: ".runtime-cache/test_output/mutation-gate/stryker-report.json",
    },
    thresholds: {
      high: 90,
      low: 80,
      break: thresholdBreak,
    },
  };
}
