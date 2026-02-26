# Env Rationalization Plan

Last updated: 2026-02-26

## Snapshot

- Runtime-prefixed keys discovered in repo: `12`
- Canonical schema keys: `11`
- Broad env-like keys discovered in repo: `180`
- Non-template allowlist keys: `7`
- Unknown runtime-prefixed keys: `0`

## Keep (Canonical Schema)

- `GEMINI_API_KEY`
- `PLAYWRIGHT_BASE_URL`
- `PLAYWRIGHT_WEB_PORT`
- `REAL_EXTERNAL_URL`
- `REAL_LLM_BASE_URL`
- `REAL_LLM_MODEL`
- `REAL_LLM_TIMEOUT_MS`
- `TAURI_DEV_HMR_PORT`
- `TAURI_DEV_HOST`
- `TAURI_DEV_PORT`
- `VITE_SENTRY_DSN`

## Keep (Non-template Allowlist)

- `CODEX_HOME`
- `CODEX_MONITOR_DAEMON_TOKEN`
- `CODEX_MONITOR_ORBIT_AUTH_URL`
- `CODEX_MONITOR_ORBIT_RUNNER_NAME`
- `CODEX_MONITOR_ORBIT_TOKEN`
- `TAURI_SIGNING_PRIVATE_KEY_B64`
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`

## Unknown Runtime Keys (Must Govern)

- (none)

## Deprecated Runtime Keys (Blocked)

- `REAL_LLM_API_KEY`

## Direct-Usage Gap Candidates

- (none)

## Governance Rules

1. New runtime-prefixed env keys must be added to `config/env.schema.json` or `config/env.runtime-allowlist.json`.
2. `npm run env:rationalize:check` blocks drift during pre-commit.
3. Deprecated runtime keys are blocked from runtime codepaths.

## Evidence (Latest Run)

- Runtime artifacts:
  - `.runtime-cache/test_output/real-llm/latest.json`
  - `.runtime-cache/test_output/live-preflight/latest.json`
- Changed code references:
  - `scripts/env-rationalize.mjs`
