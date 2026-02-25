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

## 目录导航

- Tauri 命令入口：`src-tauri/src/lib.rs`
- Daemon 入口：`src-tauri/src/bin/codex_monitor_daemon.rs`
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

## 变更注意事项

- 共享领域逻辑优先进入 `src-tauri/src/shared/*`，不要在 app/daemon 各写一套。
- 新增后端能力时，按“shared core -> app command -> daemon method”顺序接线。
- 任何 IPC 变更都要与 `src/services/tauri.ts` 同步。
- 修改 JSON-RPC 结构时保持协议字段稳定，避免破坏现有 app-server 流。
