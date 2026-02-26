# Environment Audit Report

Generated: 2026-02-26

## Executive Summary

1. Current env governance status must be read from:
   - `npm run env:rationalize:check`
   - `docs/reference/env-final-report.md`
2. This report records governance conclusions and policy framing, not standalone current numeric totals.
3. Gemini remains the default live LLM route; deprecated key handling is enforced by checker + final report outputs.

## Four-Tier Classification (Current Policy)

| Tier | Definition | Typical Examples (Descriptive) | Allowed Location |
| --- | --- | --- | --- |
| Required | 必需项。缺失会导致对应模式不可运行。 | Dev 端口类、Live 主模型连接类 | `.env.example`（模板）+ 本地/CI/运行环境 |
| Optional | 可选项。缺失不阻断核心流程。 | 遥测、覆盖范围扩展、可选覆盖配置 | `.env.example`（可空模板）+ 本地/CI/运行环境 |
| Release-only | 发布链路专用。 | 签名/提审/分发相关配置 | 发布模板 + CI secrets/vars |
| Platform-only | 平台或基础设施专用。 | 平台 token、运行时注入变量、系统级配置 | CI/CD secrets/vars 或系统环境变量 |

## Current-State Canonical References

- Checker gate: `npm run env:rationalize:check`
- Final current report: `docs/reference/env-final-report.md`
- Supporting schema and validators:
  - `config/env.schema.json`
  - `scripts/env-rationalize.mjs`
  - `scripts/env-doctor.mjs`

## Historical Record

- historical: this report previously included point-in-time numeric inventory snapshots.
- historical: those snapshots are preserved only as historical context and are no longer authoritative for current counts.

## Evidence Paths

- Final report: `docs/reference/env-final-report.md`
- Env schema: `config/env.schema.json`
- Env doctor: `scripts/env-doctor.mjs`
- Env rationalize checker: `scripts/env-rationalize.mjs`
- Pre-commit orchestration: `scripts/precommit-orchestrated.mjs`
- Preflight orchestration: `scripts/preflight-orchestrated.mjs`
- Policy matrix: `docs/reference/env-matrix.md`
