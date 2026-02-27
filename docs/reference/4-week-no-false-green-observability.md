# 4-Week No False Green Observability

## Scope

- Wave: `Wave-7F`
- Observation Start (UTC): `2026-02-27`
- Observation Rule: each week records gate status and false-green incidents.

## Status Semantics

- `pass`: gate passed in the latest evidence.
- `fail`: gate failed in the latest evidence.
- `unknown`: evidence missing or not parseable.

## Weekly Observation Log

<!-- WAVE_7F_4W_OBS_TABLE_START -->
| Week | Window (UTC) | Coverage Gate | Mutation Gate | Assertion Guard | False Green Incidents | Updated At (UTC) | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| W1 | 2026-02-27..2026-03-05 | fail | unknown | unknown | 0 | 2026-02-27T08:32:12.496Z | docs/reference/testing-governance-dashboard.md |
| W2 | 2026-03-06..2026-03-12 | pending | pending | pending | 0 | - | docs/reference/testing-governance-dashboard.md |
| W3 | 2026-03-13..2026-03-19 | pending | pending | pending | 0 | - | docs/reference/testing-governance-dashboard.md |
| W4 | 2026-03-20..2026-03-26 | pending | pending | pending | 0 | - | docs/reference/testing-governance-dashboard.md |
<!-- WAVE_7F_4W_OBS_TABLE_END -->

## Operation

- Update command: `npm run obs:4w:no-false-green:update`
- Check command: `npm run check:4w:no-false-green`
- Strict check command: `npm run check:4w:no-false-green:strict`

## Notes

- This document is the canonical 4-week acceptance template for Wave-7F.
- `--update` syncs the current week from `docs/reference/testing-governance-dashboard.md`.
- `--check` validates structure and emits warnings for non-green or incident records.
- `--strict` turns warnings into non-zero exit for CI gate usage.
