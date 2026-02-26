# Environment Variable Matrix

Last updated: 2026-02-26

## Scope

This matrix defines the canonical env governance model for this repo.

Current single source of truth for counts and current-state inventory:
- `npm run env:rationalize:check`
- `docs/reference/env-final-report.md`

This document is policy-focused and intentionally does not publish standalone current numeric totals.

## Four-Tier Ownership (Current Policy)

| Tier | Definition | Allowed Location |
| --- | --- | --- |
| Required | 必需项。缺失会导致对应流程无法运行（按运行模式判定 dev/live/release）。 | `.env.example`（模板占位）+ 本地环境（`.env`/`.env.local`）或 CI/运行环境 |
| Optional | 可选项。缺失不阻断主流程，但会影响增强能力或覆盖范围。 | `.env.example`（可空模板）+ 本地环境或 CI/运行环境 |
| Release-only | 发布专用项。仅在签名、分发、提审、发布流水线中生效。 | 发布模板文件（如 `.testflight.local.env.example`）+ CI secrets/vars |
| Platform-only | 平台专用项。仅在平台/基础设施/运行时注入，不作为通用本地模板要求。 | CI/CD secrets/vars 或系统环境变量 |

## Governance Rules

1. `.env.example` is template-safe only (no real secrets).
2. Real keys only come from local runtime env (`.env`/`.env.local`) or process environment/CI secrets.
3. Current-state counts and inventory decisions must be read from `npm run env:rationalize:check` and `docs/reference/env-final-report.md`.
4. Deprecated or blocked keys are governed by checker output and final report, not by duplicated local-number snapshots in this file.
5. Any historical number, if retained for context, must be marked explicitly as `historical`.

## Historical Notes

- historical: this file previously contained point-in-time standalone counts and local snapshots.
- historical: those numeric snapshots are retired to avoid drift and conflicting "current" interpretations.

## Commands

```bash
npm run env:rationalize:check
npm run env:doctor
npm run env:doctor:dev
npm run env:doctor:live
npm run env:doctor:staged
```

## Evidence

- Current-state canonical report: `docs/reference/env-final-report.md`
- Runtime artifacts:
  - `.runtime-cache/test_output/real-llm/latest.json`
  - `.runtime-cache/test_output/live-preflight/latest.json`
