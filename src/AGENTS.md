# Frontend Agent Guide (`src/`)

## 模块目的

- 承载 React UI、交互编排、状态与事件订阅。
- 保持“组件展示、Hook 管状态、副作用走 services、纯函数放 utils”的边界。

## 技术栈

- React 19 + TypeScript
- Vite
- Vitest + Testing Library
- Playwright（E2E）

## 目录导航

- 组合入口：`src/App.tsx`
- 功能域：`src/features/*`
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

## 变更注意事项

- 不要在组件里直接调用 Tauri API；统一走 `src/services/tauri.ts`。
- 新增 Tauri 事件时，先在 `src/services/events.ts` 建 hub，再在 Hook/组件订阅。
- 复用 design-system 原语，避免在 feature CSS 重复实现通用壳层样式。
- 修改线程、设置、更新器或共享工具时，至少跑 `npm run test` + `npm run typecheck`。
