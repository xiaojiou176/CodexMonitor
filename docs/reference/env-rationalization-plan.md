# Env Rationalization Plan

Last updated: 2026-02-26

## Snapshot

- Runtime-prefixed keys discovered in repo: `12`
- Canonical schema keys: `12`
- Non-template allowlist keys: `7`
- Unknown runtime-prefixed keys: `0`

## Keep (Canonical Schema)

- `GEMINI_API_KEY`
- `PLAYWRIGHT_BASE_URL`
- `PLAYWRIGHT_WEB_PORT`
- `REAL_EXTERNAL_URL`
- `REAL_LLM_API_KEY`
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

## Compatibility Alias Candidates (Future Reduction)

- `REAL_LLM_API_KEY`

## Direct-Usage Gap Candidates

- `GEMINI_API_KEY`
- `REAL_LLM_BASE_URL`
- `REAL_LLM_MODEL`
- `REAL_LLM_TIMEOUT_MS`

## Governance Rules

1. New runtime-prefixed env keys must be added to `config/env.schema.json` or `config/env.runtime-allowlist.json`.
2. `npm run env:rationalize:check` blocks drift during pre-commit.
3. Alias candidates should be removed only after all callsites migrate to canonical keys.
4. `npm run check:real-llm-alias-usage` blocks new alias references outside approved compatibility files.

## Evidence (Latest Round)

- Runtime artifacts:
  - `.runtime-cache/test_output/real-llm/latest.json`
  - `.runtime-cache/test_output/live-preflight/latest.json`
- Changed code references:
  - `scripts/real-llm-smoke.mjs`
  - `src/utils/realLlmSmoke.test.ts`
  - `scripts/env-doctor.mjs`
  - `scripts/check-real-llm-alias-usage.mjs`
  - `scripts/precommit-orchestrated.mjs`
  - `.github/workflows/ci.yml`
  - `package.json`

## Compatibility Opt-In Record

- 触发原因: 为兼容尚未迁移完成的本地环境，保留 `REAL_LLM_API_KEY` 作为短期兼容输入，但内部主路径已切换为 `GEMINI_API_KEY`。
- 回退条件: 若迁移期间出现真实阻断，可临时在本地继续设置 `REAL_LLM_API_KEY`；CI 严格模式保持不放开。
- 结果差异: 脚本与预检报告的主键展示统一为 `GEMINI_API_KEY`，`REAL_LLM_API_KEY` 仅用于兼容映射并输出退役告警。
