# Frontend CLAUDE Guide (`src/`)

## 模块目的

- 为前端任务提供最短可执行路径：定位文件、改动边界、验证入口。
- 确保 UI 改动与 Tauri IPC/事件契约保持一致。

## 技术栈

- React 19、TypeScript、Vite
- ESLint、Vitest、Playwright

## 最小可执行导航（索引化 + 懒加载）

1. 根规则先行：`AGENTS.md` → `CLAUDE.md`。
2. 前端任务加载：`src/AGENTS.md` → `src/CLAUDE.md`。
3. 仅跨域时补读：`src-tauri/AGENTS.md`、`src-tauri/CLAUDE.md`。

## 14条规范与14项Gate对齐

- 完全继承根 `AGENTS.md` 的 14 条强制规范与 14 项 Gate。
- 本文件只做前端执行摘要，不新增与根规则冲突的例外。

## Gemini 策略

- 默认：Gemini-only（当前）。
- 兼容：可选且非默认；启用时必须记录触发条件、影响面和回退方案。

## 目录导航

- App 组装层：`src/App.tsx`
- 功能模块：`src/features/`
- Tauri IPC：`src/services/tauri.ts`
- 原生事件总线：`src/services/events.ts`
- 工具函数：`src/utils/`
- 样式系统：`src/styles/`、`src/features/design-system/`

## 常用命令

```bash
npm run dev
npm run lint:strict
npm run typecheck
```

## 测试入口

```bash
npm run test
npm run test:e2e:smoke
npm run test:coverage:gate
```

## Hook Gate 对齐

- pre-commit Phase 2（并行）包含 `check:critical-path-logging` 在内的安全与合规 gate，遵循 `scripts/precommit-orchestrated.mjs`。
- pre-push（`npm run preflight:orchestrated`）Phase 2 执行中强并行任务：`npm run test` + `npm run check:rust`。

## 门禁分层（pre-commit < pre-push < CI）

1. pre-commit：快速防线，偏 staged 风险拦截。
2. pre-push：中强防线，执行基线门禁 + `test`/`check:rust` 并行任务。
3. CI：最严格最终裁决，负责高成本门禁与证据归档。
- a11y：`npx playwright test e2e/a11y.spec.ts --project=chromium`（`ci.yml`）。
- interaction-sweep：`npx playwright test e2e/interaction-sweep.spec.ts --project=chromium`（`ci.yml`）。
- strict main 真链路：`real-integration.yml`（main 双链路强制，不可 silent skip-green）。
- 视觉回归：`ci.yml` 的 `visual-regression`（`chromatic.yml` 为手动补跑）。

## 变更注意事项

- 组件层只负责渲染与交互，不承载跨模块副作用。
- 改 IPC 参数结构时，前后端字段必须同步；特别注意布尔值显式解析，不用 `Boolean(rawValue)`。
- 终端 Tab 触发器继续使用 `button[role=\"tab\"]`，关闭按钮保持独立可聚焦控件。
- 变更设计系统相关样式时，优先扩展 `--ds-*` token 与 `ds-*` 样式文件。
