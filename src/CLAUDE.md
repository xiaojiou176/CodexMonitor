# Frontend CLAUDE Guide (`src/`)

## 模块目的

- 为前端任务提供最短可执行路径：定位文件、改动边界、验证入口。
- 确保 UI 改动与 Tauri IPC/事件契约保持一致。

## 技术栈

- React 19、TypeScript、Vite
- ESLint、Vitest、Playwright

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
npm run test:coverage
```

## 变更注意事项

- 组件层只负责渲染与交互，不承载跨模块副作用。
- 改 IPC 参数结构时，前后端字段必须同步；特别注意布尔值显式解析，不用 `Boolean(rawValue)`。
- 终端 Tab 触发器继续使用 `button[role=\"tab\"]`，关闭按钮保持独立可聚焦控件。
- 变更设计系统相关样式时，优先扩展 `--ds-*` token 与 `ds-*` 样式文件。
