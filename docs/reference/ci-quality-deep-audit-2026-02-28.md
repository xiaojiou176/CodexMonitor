# CI Quality Deep Audit (2026-02-28)

## 审计范围与方法

### 范围
- CI 严格门禁链路：coverage gate、mutation gate、live preflight、E2E a11y。
- 假绿防线：断言防伪、mutation 执行策略、E2E skip 证据化。
- UI/a11y 语义修复：键盘可达性、角色语义、对比度修复与回归结果。

### 方法
- 读取并核验仓库内最新审计产物与门禁输出：
  - `.runtime-cache/test_output/coverage-gate/latest.json`
  - `.runtime-cache/test_output/mutation-gate/latest.json`
  - `.runtime-cache/test_output/live-preflight/latest.json`
  - `.runtime-cache/test_output/a11y-local/latest.log`
- 对照门禁实现路径与工作流配置：
  - `.github/workflows/ci.yml`
  - `.github/workflows/real-integration.yml`
  - `scripts/coverage-gate.mjs`
  - `scripts/mutation-gate.mjs`
  - `scripts/guard-placebo-assertions.mjs`
  - `scripts/check-playwright-report.mjs`

## 关键发现

1. 全局覆盖率未达标（未通过项）
- 严格门禁阈值：`85%`（statements/lines/functions/branches）。
- 当前全局覆盖率：
  - statements: `77.24%`
  - lines: `77.24%`
  - functions: `79.70%`
  - branches: `80.06%`
- 结论：全局覆盖率 `<85%`，coverage gate 为失败状态（`pass: false`）。

2. 关键域覆盖率达标（通过项）
- `threads`：`96.89/96.89/100/92.72`，满足 `95/95/95/92`。
- `services`：`96.54/96.54/98.4/95.18`，满足 `95/95/95/95`。
- 结论：关键域质量闸门通过，失败集中在全局覆盖面。

3. mutation 门禁当前为 dry-run（审计状态）
- 最新产物 `status: dry-run`，并保留受保护流（PR/main）执行约束策略。
- 结论：策略已收紧并保留证据上传链路，当前这份产物不构成一次完整“通过/失败”执行结论。

4. live preflight 可运行链路通过，外部链路缺少 URL
- `live-preflight` 状态为 `passed`。
- `REAL_EXTERNAL_URL` 缺失（外部浏览器链路本次不可运行）。
- LLM 相关检查可运行且网络可达。

5. UI/a11y 本地回归通过
- `a11y-local` 日志显示：`4 passed`。
- 语义和可访问性修复已纳入严格门禁轨道（含角色/键盘语义与对比度相关修复路径）。

## 已实施改进清单（文件路径）

### CI/mutation 严格增强
- `.github/workflows/ci.yml`
- `.github/workflows/real-integration.yml`
- `scripts/coverage-gate.mjs`
- `scripts/mutation-gate.mjs`
- `scripts/mutation-stryker.config.mjs`

### 假绿防线增强
- `scripts/guard-placebo-assertions.mjs`
- `scripts/check-playwright-report.mjs`
- `.github/workflows/ci.yml`

### UI/a11y 语义修复
- `e2e/a11y.spec.ts`
- `e2e/helpers/interactions.ts`
- `src/features/app/components/ThreadRowItem.tsx`
- `src/features/terminal/components/TerminalDock.tsx`
- `src/features/layout/hooks/useResizablePanels.ts`
- `src/styles/home.css`
- `src/styles/error-toasts.css`

## 验证结果（通过/失败）

| 验证项 | 结果 | 证据 |
|---|---|---|
| Coverage Gate (`85%`) | 失败 | `.runtime-cache/test_output/coverage-gate/latest.json` |
| Critical Scopes (`threads/services`) | 通过 | `.runtime-cache/test_output/coverage-gate/latest.json` |
| Mutation Gate Latest | 审计态（dry-run） | `.runtime-cache/test_output/mutation-gate/latest.json` |
| Live Preflight | 通过 | `.runtime-cache/test_output/live-preflight/latest.json` |
| 外部链路可运行性 | 失败（缺少 `REAL_EXTERNAL_URL`） | `.runtime-cache/test_output/live-preflight/latest.json` |
| Local A11y Sweep | 通过（4 passed） | `.runtime-cache/test_output/a11y-local/latest.log` |

## 下一轮达标计划（可量化）

1. 全局覆盖率达标计划（目标 85%）
- 目标：将 global statements/lines/functions/branches 全部提升到 `>=85%`。
- 差距（当前 -> 目标）：
  - statements: `77.24 -> 85`（+`7.76`）
  - lines: `77.24 -> 85`（+`7.76`）
  - functions: `79.70 -> 85`（+`5.30`）
  - branches: `80.06 -> 85`（+`4.94`）
- 执行标准：`npm run test:coverage:gate` 返回通过并生成新 `latest.json`（`pass: true`）。

2. mutation 执行态落地
- 目标：在受保护流（PR/main）产出非 dry-run 的 mutation 结果并保持门禁有效。
- 执行标准：`mutation-gate/latest.json` 产物状态可审计为执行态，并满足策略阈值。

3. live external 链路补齐
- 目标：补齐 `REAL_EXTERNAL_URL`，让 external 链路进入可运行状态。
- 执行标准：`live-preflight/latest.json` 中 external `runnable: true`。

4. UI/a11y 语义稳定性维持
- 目标：持续保持 a11y 扫描通过，并维持语义/键盘交互回归稳定。
- 执行标准：本地与 CI 的 a11y 任务持续通过，且无 `critical+serious` 阻断回归。
