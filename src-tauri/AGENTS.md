# Backend Agent Guide (`src-tauri/`)

## 模块目的

- 提供 Tauri 命令、守护进程 JSON-RPC 与共享核心逻辑。
- 保持 app/daemon 双端行为一致，避免重复实现领域逻辑。

## 技术栈

- Rust 2021
- Tauri v2
- Tokio 异步运行时
- Serde / Serde JSON
- Git2、Reqwest

## 最小可执行导航（索引化 + 懒加载）

1. 先读根规则：`AGENTS.md`、`CLAUDE.md`。
2. 后端任务只加载：`src-tauri/AGENTS.md`、`src-tauri/CLAUDE.md`。
3. 仅当改动前端契约或 UI 联动时，再加载：`src/AGENTS.md`、`src/CLAUDE.md`。

## 14条强制规范（后端执行视角）

后端任务完全继承根 `AGENTS.md` 的“文档与规则宪法（2026-02，14条）”。

- 默认模型策略：Gemini-only（当前）。
- 兼容路线：仅可选、非默认，需记录触发原因与回退方案。

## 目录导航

- Tauri 命令入口：`src-tauri/src/lib.rs`
- Daemon 入口：`src-tauri/src/bin/codex_monitor_daemon.rs`
- Daemon meta helper：`src-tauri/src/bin/codex_monitor_daemon/meta.rs`
- 共享核心：`src-tauri/src/shared/*`
- 业务适配：`src-tauri/src/codex/`、`src-tauri/src/files/`、`src-tauri/src/workspaces/`
- 配置文件：`src-tauri/Cargo.toml`、`src-tauri/tauri.conf.json`

## 常用命令

```bash
npm run check:rust
cargo check --manifest-path src-tauri/Cargo.toml
cargo test --manifest-path src-tauri/Cargo.toml
```

## 测试入口

```bash
npm run check:rust
npm run test
```

说明：Rust 逻辑改动至少执行 `check:rust`；涉及共享核心行为建议补跑仓库 `npm run test`。

## Gate 对齐（后端最小清单）

- Rust Gate: `npm run check:rust`
- Lint Gate: `npm run lint:strict`
- Assertion Gate: `npm run test:assertions:guard`
- Test Gate: `npm run test`
- Doc-Drift Gate: 接口/配置/命令变化需同步文档

## 变更注意事项

- 共享领域逻辑优先进入 `src-tauri/src/shared/*`，不要在 app/daemon 各写一套。
- 新增后端能力时，按“shared core -> app command -> daemon method”顺序接线。
- 任何 IPC 变更都要与 `src/services/tauri.ts` 同步。
- 修改 JSON-RPC 结构时保持协议字段稳定，避免破坏现有 app-server 流。
