# Env Rationalization Plan

Last updated: 2026-02-26

## Plan Baseline

Current-state numeric truth is centralized and must be read from:
- `npm run env:rationalize:check`
- `docs/reference/env-final-report.md`

This plan defines governance actions and layering rules only; it does not maintain standalone current numeric snapshots.

## Four-Level Layering (Current Policy)

| Level | Definition | Decision Rule |
| --- | --- | --- |
| Required | 必需层。缺失即阻断对应运行模式。 | 必须纳入治理并在模板或平台注入路径可追踪 |
| Optional | 可选层。缺失不阻断主路径。 | 可保留为空模板或运行时可选注入 |
| Release-only | 发布专用层。只在发布链路生效。 | 不混入普通本地开发模板要求 |
| Platform-only | 平台专用层。由平台/系统注入。 | 不以通用本地模板作为主承载 |

## Governance Rules

1. New runtime-prefixed keys must be governed by schema/allowlist policy.
2. `npm run env:rationalize:check` is the drift gate for current-state consistency.
3. `docs/reference/env-final-report.md` is the documentation-level current-state authority.
4. Plan docs can describe policy and layering, but must not publish competing current numeric counts.
5. Any retained legacy numbers must be explicitly tagged as `historical`.

## Historical Notes

- historical: earlier versions tracked direct count snapshots in this plan.
- historical: those numeric snapshots are retired from current plan content to prevent drift.

## Evidence (Latest Run Source)

- Checker command: `npm run env:rationalize:check`
- Final report: `docs/reference/env-final-report.md`
- Runtime artifacts:
  - `.runtime-cache/test_output/real-llm/latest.json`
  - `.runtime-cache/test_output/live-preflight/latest.json`
- Implementation reference:
  - `scripts/env-rationalize.mjs`
