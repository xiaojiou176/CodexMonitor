# Testing Governance Dashboard

Generated automatically. Do not hand-edit.

## Snapshot

- Generated at (UTC): 2026-02-27T05:37:09.997Z
- Artifact root: `.runtime-cache/test_output`
- Overall status: **failed**
- Required reports available: 4/4
- Missing required reports: 0
- Parse errors: 0
- Stale required reports (> 24h): 1
- Unknown freshness reports: 0

## Freshness Semantics

- `Generated at` is dashboard generation time, not test execution time.
- `Last Update` uses artifact payload timestamp when parseable, otherwise file mtime.
- `Freshness` thresholds: `fresh <= 6h`, `aging <= 24h`, `stale > 24h`.
- If freshness is `stale` or `unknown`, treat pass/fail as potentially outdated and re-run the relevant gate.

## Auditable Evidence Contract (Real Chain)

The following conditions are required to claim "minimal real chain verified":

1. `live-preflight` report exists at `.runtime-cache/test_output/live-preflight/latest.json`.
2. `status` is `passed`.
3. `runAny` is `true`.
4. At least one entry in `checks[]` has `status = ok` (real probe succeeded).
5. If any check has `status = missing` or `status = failed`, CI summary must surface it explicitly.

If any condition above is not satisfied, the result must be treated as **failed**, not skipped-green.

## Required Gates

| Gate | Status | Last Update | Freshness | Age | Summary | Source |
| --- | --- | --- | --- | --- | --- | --- |
| Coverage Gate | failed | 2026-02-26 21:29:06 | fresh | 0.13h | statements 51.62% \| lines 51.62% \| functions 68.07% \| branches 75.60% \| failures 4 | `.runtime-cache/test_output/coverage-gate/latest.json` |
| Mutation Gate | unknown | 2026-02-27T05:28:07.366Z | fresh | 0.15h | mutationScore=n/a \| threshold=80.00% | `.runtime-cache/test_output/mutation-gate/latest.json` |
| Live Preflight | passed | 2026-02-27T05:25:11.396Z | fresh | 0.20h | runExternal=false \| runLlm=true \| reason=none | `.runtime-cache/test_output/live-preflight/latest.json` |
| Real LLM Smoke | passed | 2026-02-26T03:39:35.095Z | stale | 25.96h | model=gemini-3.1-pro-preview \| transport=chat.completions \| reason=none | `.runtime-cache/test_output/real-llm/latest.json` |

## Additional Reports

| Report | Status | Last Update | Freshness | Age | Summary | Source |
| --- | --- | --- | --- | --- | --- | --- |
| ci-fixes | missing | n/a | unknown | n/a | report not found | `.runtime-cache/test_output/ci-fixes/latest.json` |
| launchers | missing | n/a | unknown | n/a | report not found | `.runtime-cache/test_output/launchers/latest.json` |

## Missing Data

- None

## Parse Errors

- None

## Compatibility Opt-In Record (Refactor Batch)

- 触发原因（trigger reason）: 本批次包含 `compat` 相关规则文本与治理脚本路径变更，触发 `check:compat:option-log` 记录要求；同时完成 App/Threads/Daemon 拆分以降低大文件复杂度。
- 回退条件（rollback condition）: 若拆分后出现功能回归或门禁不稳定，则回退到拆分前文件结构（`src/App.tsx`、`src/features/threads/hooks/useThreadsReducer.ts`、`src-tauri/src/bin/codex_monitor_daemon.rs`）并保留新增测试与门禁脚本不回退。
- result_diff: 结果差异为“功能等价 + 结构重组”，新增 helper 模块并保持现有命令与对外行为不变；门禁可观测性增强，提交时需提供证据链。

## Lazy-Load Evidence (Refactor Batch)

- Runtime evidence:
  - `.runtime-cache/test_output/coverage-gate/latest.json`
  - `.runtime-cache/test_output/live-preflight/latest.json`
- Changed code files:
  - `src/App.tsx`
  - `src/features/app/utils/appUiHelpers.ts`
  - `src/features/threads/hooks/useThreadsReducer.ts`
  - `src/features/threads/hooks/threadReducerHelpers.ts`
  - `src-tauri/src/bin/codex_monitor_daemon.rs`
  - `src-tauri/src/bin/codex_monitor_daemon/meta.rs`
