# Environment Audit Report

Generated: 2026-02-26

## Executive Summary

1. Repo-wide env scan currently identifies `80` env-like keys (runtime + OS + CI + release + test).
2. Product/runtime-focused keys are a smaller subset (`18` by prefix scan), and only a core subset should be managed in local `.env` templates.
3. `.env.example` is now governed by `config/env.schema.json` and validated by `scripts/env-doctor.mjs`.
4. Pre-commit and pre-push orchestrators now run env governance checks to prevent config drift.
5. Gemini is the default live LLM path; OpenAI/Anthropic env keys are treated as deprecated and blocked by `env-doctor`.

## Inventory Snapshot

- Full scan artifact: `.runtime-cache/env_inventory.json`
- Total discovered keys: `80`
- In `.env.example`: `10`
- In local `.env` (machine-local): `5` at scan time
- In local `.env.local` (machine-local): `5` at scan time
- In `.testflight.local.env.example`: `11`

## Required vs Optional (Local Runtime)

Required in dev:
- `TAURI_DEV_PORT`
- `TAURI_DEV_HMR_PORT`
- `PLAYWRIGHT_WEB_PORT`

Required in live:
- `GEMINI_API_KEY`
- `REAL_LLM_BASE_URL`
- `REAL_LLM_MODEL`
- `REAL_LLM_TIMEOUT_MS`

Optional:
- `VITE_SENTRY_DSN`
- `TAURI_DEV_HOST`
- `PLAYWRIGHT_BASE_URL`
- `REAL_EXTERNAL_URL`

Deprecated/blocked:
- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`

Deprecated alias (compatibility-only):
- `REAL_LLM_API_KEY` (retirement target: 2026-06-01)
- CI strict mode can enforce retirement immediately with `ENV_DOCTOR_STRICT_REAL_LLM_ALIAS=1`.

## Evidence Paths

- Env schema: `config/env.schema.json`
- Env doctor: `scripts/env-doctor.mjs`
- Pre-commit orchestration: `scripts/precommit-orchestrated.mjs`
- Preflight orchestration: `scripts/preflight-orchestrated.mjs`
- Env matrix: `docs/reference/env-matrix.md`
