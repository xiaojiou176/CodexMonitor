# Environment Variable Matrix

Last updated: 2026-02-26

## Scope

This matrix defines the canonical env governance model for this repo:

- Schema source of truth: `config/env.schema.json`
- Validation gate: `scripts/env-doctor.mjs`
- Runtime preflight: `scripts/real-llm-smoke.mjs`

## High-Level Inventory

- Total discovered env-like keys in repo scan: `80` (includes OS/CI/build/test/release/runtime keys).
- App/product-prefixed keys (`VITE_`, `TAURI_`, `PLAYWRIGHT_`, `REAL_`, `GEMINI_`, `CODEX_`, `CODEX_MONITOR_`): `18`.
- Keys currently templated in `.env.example`: `10`.
- Keys currently present in local `.env` / `.env.local`: local-machine dependent and intentionally untracked.

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
| `REAL_LLM_API_KEY` | No (deprecated alias) | Yes | live | Compatibility-only alias, planned retirement on 2026-06-01. |
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
4. If both `GEMINI_API_KEY` and `REAL_LLM_API_KEY` are set but inconsistent, `env-doctor` warns.
5. Pre-commit and pre-push run `env-doctor` to block drift and invalid env config.
6. CI can enable strict alias retirement via `ENV_DOCTOR_STRICT_REAL_LLM_ALIAS=1`.

## Commands

```bash
npm run env:doctor
npm run env:doctor:dev
npm run env:doctor:live
npm run env:doctor:staged
```
