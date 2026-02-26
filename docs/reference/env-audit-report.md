# Environment Audit Report

Generated: 2026-02-26

## Executive Summary

1. Repo-wide broad env scan identifies `182` env-like keys (runtime + shell + OS + CI + release + test).
2. Strict governance-scope unique key count is `72`; product/runtime-focused keys remain a smaller subset (`18` by prefix scan).
3. `.env.example` is now governed by `config/env.schema.json` and validated by `scripts/env-doctor.mjs`.
4. Pre-commit and pre-push orchestrators now run env governance checks to prevent config drift.
5. Gemini is the default live LLM path; OpenAI/Anthropic env keys are treated as deprecated and blocked by `env-doctor`.

## Inventory Snapshot

- Full scan artifact: `.runtime-cache/env_audit_latest.json`
- Broad discovered keys: `182`
- Strict governance keys: `72`
- In `.env.example`: `10`
- `.env*` variants discovered: `4` (`.env`, `.env.example`, `.env.local`, `.testflight.local.env.example`)
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

Deprecated keys (blocked):
- `REAL_LLM_API_KEY`
- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`

## Evidence Paths

- Env schema: `config/env.schema.json`
- Env doctor: `scripts/env-doctor.mjs`
- Pre-commit orchestration: `scripts/precommit-orchestrated.mjs`
- Preflight orchestration: `scripts/preflight-orchestrated.mjs`
- Env matrix: `docs/reference/env-matrix.md`
