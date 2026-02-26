# Environment Variable Matrix

Last updated: 2026-02-26

## Scope

This matrix defines the canonical env governance model for this repo:

- Schema source of truth: `config/env.schema.json`
- Validation gate: `scripts/env-doctor.mjs`
- Runtime preflight: `scripts/real-llm-smoke.mjs`

## High-Level Inventory

- `canonical_count`: `11` (from `config/env.schema.json` canonical variables).
- `runtime_usage_count`: `12` (runtime-prefixed keys actually read by code paths scanned by `scripts/env-rationalize.mjs`).
- `broad_env_like_count`: `183` (broad env-like keys across code reads + `.env*` variants + shell/workflow env-style keys).
- Keys currently templated in `.env.example`: `5`.
- `.env*` variant files discovered: `4` (`.env`, `.env.example`, `.env.local`, `.testflight.local.env.example`).
- Keys currently present in local `.env` / `.env.local`: local-machine dependent and intentionally untracked.

## Four-Tier Ownership

| Tier | Scope | Allowed Location | Current Keys |
| --- | --- | --- | --- |
| Required | 本地开发必须项 | `.env.example` + `.env/.env.local` | `TAURI_DEV_PORT`, `TAURI_DEV_HMR_PORT`, `PLAYWRIGHT_WEB_PORT` |
| Optional | 本地开发可选项 | `.env.example`（空值模板）+ `.env/.env.local` | `VITE_SENTRY_DSN`, `TAURI_DEV_HOST` |
| Release-only | 发布流程专用 | `.testflight.local.env.example` + CI secrets/vars | `APP_ID`, `BUNDLE_ID`, `BETA_*`, `REVIEW_*`, `FEEDBACK_EMAIL`, `LOCALE` |
| Platform-only | 平台/运行环境专用 | CI/CD secrets/vars 或系统环境变量（不进 `.env.example`） | `GEMINI_API_KEY`, `REAL_LLM_BASE_URL`, `REAL_LLM_MODEL`, `REAL_LLM_TIMEOUT_MS`, `REAL_EXTERNAL_URL`, `CODEX_*`, `TAURI_SIGNING_*` |

## Canonical Local Runtime Keys

| Key | Required | Sensitive | Mode | Notes |
| --- | --- | --- | --- | --- |
| `VITE_SENTRY_DSN` | No | No | dev/prod | Frontend telemetry DSN. |
| `TAURI_DEV_HOST` | No | No | dev | Optional host override for remote device/browser testing. |
| `TAURI_DEV_PORT` | Yes (dev) | No | dev | App dev server port. |
| `TAURI_DEV_HMR_PORT` | Yes (dev) | No | dev | HMR port. |
| `PLAYWRIGHT_WEB_PORT` | Yes (dev/live) | No | dev/live | Local E2E web port. |
| `PLAYWRIGHT_BASE_URL` | No | No | dev/live | Optional base URL override. |
| `REAL_EXTERNAL_URL` | No | No | live | Optional real external browser target. |
| `GEMINI_API_KEY` | Yes (live) | Yes | live | Primary Gemini key. |
| `REAL_LLM_BASE_URL` | Yes (live) | No | live | Gemini OpenAI-compatible base. |
| `REAL_LLM_MODEL` | Yes (live) | No | live | Recommended: `gemini-3.1-pro-preview`. |
| `REAL_LLM_TIMEOUT_MS` | Yes (live) | No | live | Positive integer timeout in ms. |

## Deprecated Keys (Blocked)

- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`

If these are set, `env-doctor` fails.

## Governance Rules

1. `.env.example` is template-safe only (no real secrets).
2. Real keys only come from `.env`, `.env.local`, or terminal process environment.
3. Live mode requires `GEMINI_API_KEY` plus valid URLs.
4. `REAL_LLM_API_KEY` is deprecated and hard-failed by `env-doctor`.
5. Pre-commit and pre-push run `env-doctor` to block drift and invalid env config.
6. `scripts/real-llm-smoke.mjs` only accepts `GEMINI_API_KEY` for live LLM smoke.
7. `env:rationalize:check` now fails when `.env.example` contains keys not directly read by code paths.
8. `check:real-llm-alias-usage` blocks deprecated alias references outside `docs/*` and `config/env.schema.json`.
9. `preflight:doc-drift` enforces strong binding: env-sensitive file changes must include env governance docs updates.

## Commands

```bash
npm run env:doctor
npm run env:doctor:dev
npm run env:doctor:live
npm run env:doctor:staged
```

## Evidence

- Runtime artifacts:
  - `.runtime-cache/test_output/real-llm/latest.json`
  - `.runtime-cache/test_output/live-preflight/latest.json`
- Changed code references:
  - `scripts/preflight-doc-drift.mjs`
  - `scripts/check-real-llm-alias-usage.mjs`
