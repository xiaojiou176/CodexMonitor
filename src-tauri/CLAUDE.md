# Backend CLAUDE Guide (`src-tauri/`)

## 模块目的

- 给后端改动提供稳定落点：共享核心优先、适配层最薄、协议不漂移。
- 覆盖 Tauri app 进程与 daemon 进程的统一行为约束。

## 技术栈

- Rust + Cargo
- Tauri 2
- Tokio / Serde

## 最小可执行导航（索引化 + 懒加载）

1. 根规则：`AGENTS.md`、`CLAUDE.md`。
2. 后端域：`src-tauri/AGENTS.md`、`src-tauri/CLAUDE.md`。
3. 涉及前端联动时，补读 `src/AGENTS.md`、`src/CLAUDE.md`。

## 14条规范与14项Gate对齐

- 完全继承根 `AGENTS.md` 的 14 条强制规范与 14 项 Gate。
- 本文件仅保留后端最短执行路径，不引入冲突性例外。

## Gemini 策略

- 默认：Gemini-only（当前）。
- 兼容：可选且非默认；启用时必须记录触发条件、影响面和回退方案。

## 目录导航

- App 主入口：`src-tauri/src/lib.rs`
- Daemon 主入口：`src-tauri/src/bin/codex_monitor_daemon.rs`
- 共享核心：`src-tauri/src/shared/`
- 业务模块：`src-tauri/src/codex/`、`src-tauri/src/files/`、`src-tauri/src/settings/`、`src-tauri/src/workspaces/`

## 常用命令

```bash
npm run check:rust
cargo check --manifest-path src-tauri/Cargo.toml
cargo test --manifest-path src-tauri/Cargo.toml
```

## 测试入口

```bash
npm run check:rust
npm run typecheck
npm run test
```

说明：后端 IPC 变更应连同前端类型与调用层一起验证，至少执行 `typecheck` 与 `test`。

## 变更注意事项

- `src-tauri/src/shared/*` 是 app 与 daemon 的事实来源，优先改这里。
- daemon 内 `mod codex` 与 `mod files` 包装模块用于满足 shared path，不要绕开这层直接复制逻辑。
- 新增命令后，确保 `src-tauri/src/lib.rs` 与 `src/services/tauri.ts` 一一对应。
- 涉及配置/路径行为时，核对 `settings_core`、`workspaces_core` 与 README 说明一致。
