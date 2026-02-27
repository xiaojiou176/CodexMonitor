# Frontend Agent Guide (`src/`)

## 模块目的

- 承载 React UI、交互编排、状态与事件订阅。
- 保持“组件展示、Hook 管状态、副作用走 services、纯函数放 utils”的边界。

## 技术栈

- React 19 + TypeScript
- Vite
- Vitest + Testing Library
- Playwright（E2E）

## 最小可执行导航（索引化 + 懒加载）

1. 先读根规则：`AGENTS.md`、`CLAUDE.md`。
2. 进入前端域后只加载：`src/AGENTS.md`、`src/CLAUDE.md`。
3. 仅当涉及 Tauri/Rust/daemon 时，再懒加载：`src-tauri/AGENTS.md`、`src-tauri/CLAUDE.md`。

## 14条强制规范（前端执行视角）

前端任务必须遵循根 `AGENTS.md` 的“文档与规则宪法（2026-02，14条）”，本文件不降级任何根规则。

- 默认模型策略：Gemini-only（当前）。
- 兼容路线：仅可选、非默认，且必须记录触发原因与回退条件。

## 目录导航

- 组合入口：`src/App.tsx`
- App UI helper：`src/features/app/utils/appUiHelpers.ts`
- 功能域：`src/features/*`
- Threads reducer helper：`src/features/threads/hooks/threadReducerHelpers.ts`
- IPC 与事件：`src/services/tauri.ts`、`src/services/events.ts`
- 工具与纯函数：`src/utils/*`
- 样式：`src/styles/*`（含 design-system `ds-*` 样式）
- 共享类型：`src/types.ts`

## 常用命令

```bash
npm run dev
npm run start:dev
npm run lint:strict
npm run typecheck
```

## 测试入口

```bash
npm run test
npm run test:watch
npm run test:e2e:smoke
npm run test:assertions:guard
```

## Gate 对齐（前端最小清单）

- Lint Gate: `npm run lint:strict`
- Assertion Gate: `npm run test:assertions:guard`
- Coverage Gate: `npm run test:coverage:gate`（强制阈值：全局 `>=80%`，关键模块 `>=95%`）
- Type Gate: `npm run typecheck`
- Doc-Drift Gate: 行为/配置/接口变更需同步文档
- Pre-commit Phase 2（并行）含：`check:critical-path-logging`、`check:secrets:staged`、`check:keys:source-policy`、`check:real-llm-alias-usage`、`env:doctor:staged`、`env:rationalize:check`、`check:lazy-load:evidence-gate`、`check:compat:option-log`
- Pre-push 新规则（仓库级强制）：`npm run preflight:orchestrated` 的 Phase 2 同时执行 `npm run test` 与 `npm run check:rust`

## 分层治理口径（前端执行视角）

1. `pre-commit`：快速防线，优先拦截 staged 风险。
2. `pre-push`：中强防线，执行基线门禁 + `test`/`check:rust` 并行任务。
3. `CI`：最终裁决，门禁强度最高。
- `a11y` gate：`npx playwright test e2e/a11y.spec.ts --project=chromium`（`.github/workflows/ci.yml`）。
- `interaction-sweep` gate：`npx playwright test e2e/interaction-sweep.spec.ts --project=chromium`（`.github/workflows/ci.yml`）。
- strict main 真链路 gate：`.github/workflows/real-integration.yml`（main 双链路强制）。
- 视觉 gate：`.github/workflows/ci.yml` 的 `visual-regression`（`chromatic.yml` 仅手动补跑）。

## 变更注意事项

- 不要在组件里直接调用 Tauri API；统一走 `src/services/tauri.ts`。
- 新增 Tauri 事件时，先在 `src/services/events.ts` 建 hub，再在 Hook/组件订阅。
- 复用 design-system 原语，避免在 feature CSS 重复实现通用壳层样式。
- 修改线程、设置、更新器或共享工具时，至少跑 `npm run test` + `npm run typecheck`。
