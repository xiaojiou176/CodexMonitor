# 变更路由指南（Change Routing Guide）

本文用于快速判断“一个改动应该落到哪个目录/文件”，并统一改动前后的检查动作，降低误改和重复实现风险。

## 1. 常见任务改动落点决策表

| 任务场景 | 正确改动落点（优先） | 相关文件示例 | 不应直接改动（常见误区） |
| --- | --- | --- | --- |
| Workspace / Worktree 业务规则、排序、持久化 | `src-tauri/src/shared/workspaces_core.rs` | `src-tauri/src/workspaces/*`（仅适配层） | 只在 `src-tauri/src/workspaces/*` 或 daemon 里复制一份业务逻辑 |
| Codex 线程、审批、登录取消、配置模型等核心逻辑 | `src-tauri/src/shared/codex_core.rs` | `src-tauri/src/codex/*`、`src-tauri/src/bin/codex_monitor_daemon.rs`（接线） | App 和 daemon 各写一套实现 |
| 设置读取/更新、Codex 配置路径模型 | `src-tauri/src/shared/settings_core.rs` | `src-tauri/src/settings/mod.rs`、`src-tauri/src/codex/config.rs` | 在 UI 或单侧适配层硬编码配置逻辑 |
| 文件读写策略与核心行为 | `src-tauri/src/shared/files_core.rs` | `src-tauri/src/files/*` | 在多个 adapter 里重复处理 I/O 规则 |
| Git 远端/分支通用逻辑 | `src-tauri/src/shared/git_core.rs` | `src-tauri/src/git/mod.rs`、`src-tauri/src/shared/workspaces_core.rs` | 在命令层散落拼接 git 逻辑 |
| Worktree 命名、路径推导、clone 目标计算 | `src-tauri/src/shared/worktree_core.rs` | `src-tauri/src/workspaces/*` | 在 UI 或 daemon 重复实现命名规则 |
| 新增后端能力（App + Daemon 都需要） | 先放 `src-tauri/src/shared/*.rs`，再接 app/daemon | `src-tauri/src/lib.rs`、`src-tauri/src/bin/codex_monitor_daemon.rs`、`src/services/tauri.ts` | 只接 Tauri command，不补 daemon；或只补 daemon，不补前端 IPC |
| Daemon 传输层/JSON-RPC 路由变更 | `src-tauri/src/bin/codex_monitor_daemon.rs` | 同文件中的 handler 分支、wrapper module | 把传输层逻辑塞进 shared core |
| 新增 Tauri 事件（后端 emit 到前端订阅） | 后端 emit + 前端 hub 订阅成对修改 | `src-tauri/src/lib.rs`、`src/services/events.ts`、`src/features/**/hooks/*` | 在组件里直接 `listen`，绕过统一 event hub |
| UI Shell（Modal/Toast/Panel/Popover）样式与结构 | 先用 design-system primitives | `src/features/design-system/components/**`、`src/styles/ds-*.css` | 在 feature CSS 重建 shell 背景/边框/阴影/动画 |
| UI 功能逻辑（状态/副作用） | feature hooks / services | `src/features/*/hooks/*`、`src/services/tauri.ts` | 把副作用写进纯展示组件 |
| `src/App.tsx` 改动 | 仅保留组装与编排 | `src/features/app/hooks/useAppServerEvents.ts` 等 | 把 IPC、事件订阅、重状态逻辑长期堆在 `src/App.tsx` |
| 线程功能改动 | 走 threads hooks 分层 | `src/features/threads/hooks/useThreads.ts` 及分拆 hooks | 在一个大 hook 或组件里混合所有职责 |
| 错误提示（Toast） | 统一走 toasts 服务与通知层 | `src/services/toasts.ts`、`src/features/notifications/hooks/useErrorToasts.ts` | 在任意组件临时拼接错误 UI |

## 2. 改动前检查清单

> 目标：先定位“应该改哪里”，再动手，避免改错层。

1. 明确改动归属：是“共享业务逻辑”还是“适配/接线”还是“纯 UI 展示”。
2. 检查是否 App 和 Daemon 都受影响：
   - 若共享能力变更，优先改 `src-tauri/src/shared/*`。
   - 再确认 `src-tauri/src/lib.rs` 与 `src-tauri/src/bin/codex_monitor_daemon.rs` 是否都要接线。
3. 前端改动先判断是否是 DS Shell：
   - 若是 Modal/Toast/Panel/Popover 外壳，优先 `src/features/design-system/components/*` + `src/styles/ds-*.css`。
   - feature 文件只保留业务内容与布局细节。
4. IPC/事件改动确认配对项：
   - IPC：`src/services/tauri.ts` 与 `src-tauri/src/lib.rs` 同步。
   - 事件：`src/services/events.ts` 与后端 emit 同步。
5. 确认是否触发文档同步：接口、流程、验证策略有变化时，同步 `docs/` 与 `AGENTS.md` 相关段落。

## 3. 改动后验证清单

> 按“改动类型”执行最小充分验证。以下命令来自仓库现有约定。

| 验证项 | 命令 | 适用条件 |
| --- | --- | --- |
| Lint | `npm run lint` | 所有前端/通用改动默认执行 |
| Typecheck | `npm run typecheck` | 触及 TypeScript/前端接口类型时执行 |
| 测试 | `npm run test` | 改动了 threads、settings、updater、shared utils 或 backend cores 时执行 |
| Rust 检查 | `cargo check`（在 `src-tauri` 目录） | 任何 Rust 后端改动（shared/app/daemon）必须执行 |

推荐执行顺序：
1. `npm run lint`
2. `npm run typecheck`
3. `npm run test`（按适用条件）
4. `cd src-tauri && cargo check`（按适用条件）

## 4. 高频误改风险与反模式

| 反模式（不要做） | 风险 | 正确替代路径 |
| --- | --- | --- |
| 在 app adapter 和 daemon 各自复制业务逻辑 | 行为漂移，线上表现不一致 | 抽到 `src-tauri/src/shared/*.rs`，两侧做薄适配 |
| 在 `src/App.tsx` 累积状态、副作用、IPC | 组件过重，维护成本陡增 | 移到 `src/features/app/hooks/*` 或对应 feature hooks |
| 组件里直接做 Tauri IPC | 测试困难、耦合升高 | 统一走 `src/services/tauri.ts` |
| 跳过 event hub，组件直接订阅原生事件 | 监听重复、清理不一致 | 通过 `src/services/events.ts` 的订阅函数 + `useTauriEvent` |
| 复刻 DS Shell 样式到 feature CSS | 视觉碎片化、样式漂移 | 使用 `ModalShell/ToastPrimitives/PanelPrimitives/PopoverPrimitives`，共享样式放 `src/styles/ds-*.css` |
| 新增后端命令只改一端（只 app 或只 daemon） | 远程/本地模式行为不一致 | shared core 实现后，app command、daemon JSON-RPC、前端 `tauri.ts` 三处对齐 |
| 修改共享逻辑却只跑前端校验 | Rust 编译失败滞后暴露 | Rust 变更后必须在 `src-tauri` 执行 `cargo check` |
| 变更接口或行为不更新文档 | 文档漂移，协作误判 | 同步更新 `docs/` 与 `AGENTS.md` 的对应章节 |

## 5. 快速路由口诀

1. 先问“这是不是共享业务规则？”是则优先 `src-tauri/src/shared/*`。
2. 再问“这是接线还是核心？”接线改 adapter/daemon，核心回 shared。
3. UI 外壳统一走 design-system primitives，业务内容才放 feature。
4. 能复用现有分层就不新增旁路实现。
5. 每次改动都按适用条件完成 `lint/typecheck/test/cargo check`。
