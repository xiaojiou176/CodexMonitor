# CodexMonitor 仓库深度地图

## 1. 系统级架构地图

```mermaid
graph TB
  subgraph FE[Frontend: React + Vite]
    APP[src/App.tsx\n组合根]
    TAURI_TS[src/services/tauri.ts\ninvoke/插件调用入口]
    EVENTS_TS[src/services/events.ts\nTauri 事件 Hub]
    APP_EVENTS[src/features/app/hooks/useAppServerEvents.ts\n协议方法路由]
    THREADS[src/features/threads/hooks/useThreads.ts\n线程状态消费]
  end

  subgraph APPBACK[Tauri App: 进程内后端]
    LIB[src-tauri/src/lib.rs\ncommand 注册]
    ADAPTERS[src-tauri/src/{codex,workspaces,git,files,...}\n薄适配层]
    EVENT_SINK[src-tauri/src/event_sink.rs\nemit app-server-event/terminal-*]
  end

  subgraph CORE[Shared Core: 领域核心]
    SHARED[src-tauri/src/shared/*\n*_core 纯领域逻辑]
  end

  subgraph DAEMON[Daemon: 独立后端]
    DMAIN[src-tauri/src/bin/codex_monitor_daemon.rs\nJSON-RPC/WS/TCP]
    DWIRE[daemon wrappers: mod codex/mod files]
  end

  subgraph EXT[外部 CLI / Runtime]
    CODEX[Codex CLI: codex app-server]
    DCLI[Daemon Binary: codex_monitor_daemon]
    TAILSCALE[tailscale CLI]
  end

  APP --> TAURI_TS --> LIB
  LIB --> ADAPTERS --> SHARED
  ADAPTERS --> EVENT_SINK --> EVENTS_TS --> APP_EVENTS --> THREADS

  ADAPTERS --> CODEX
  ADAPTERS --> DCLI
  ADAPTERS --> TAILSCALE

  DMAIN --> DWIRE --> SHARED
  DMAIN --> CODEX
```

### 1.1 分层职责（Frontend / Tauri App / Shared Core / Daemon / 外部 CLI）

- `Frontend` 负责 UI 组合、状态消费、事件订阅与用户交互，不直接持有后端实现细节。
- `Tauri App` 负责 command 注册、运行时模式分派（local/remote）、平台能力接线。
- `Shared Core` 负责跨 App/Daemon 复用的领域逻辑（workspace/git/codex/settings/files/prompts 等）。
- `Daemon` 负责独立进程场景下的 JSON-RPC 服务与事件广播，复用同一套 shared core。
- `外部 CLI` 负责实际执行面：`codex app-server`、`codex_monitor_daemon`、`tailscale`。

## 2. 关键目录职责清单（放什么 / 不放什么）

| 目录 | 放什么 | 不放什么 |
|---|---|---|
| `src/` | 前端应用代码（React、hooks、services、styles、utils） | Rust 后端实现、CLI 启动逻辑 |
| `src/features/` | 按业务切片组织的组件与 hooks | 直接 `invoke` 细节（应走 `src/services/tauri.ts`） |
| `src/services/` | Tauri IPC/事件桥接与通用前端服务 | 业务状态机（应放 feature hooks） |
| `src/styles/` | 样式与 design-system token/primitive 样式 | 业务流程逻辑 |
| `src-tauri/src/lib.rs` | Tauri command 注册、应用生命周期、插件注册 | 复杂领域算法（应下沉 shared core） |
| `src-tauri/src/{codex,workspaces,git,files,...}` | App 适配层：参数整形、remote/local 分派、调用 core | 重复实现 shared 领域逻辑 |
| `src-tauri/src/shared/` | App/Daemon 共享核心逻辑（`*_core.rs`） | Tauri UI 事件/窗口 API 细节 |
| `src-tauri/src/backend/` | Codex app-server 会话、协议收发、事件模型 | 前端状态消费逻辑 |
| `src-tauri/src/bin/codex_monitor_daemon.rs` | Daemon 服务入口、RPC 路由、事件广播 | 前端 UI/样式 |
| `src-tauri/src/remote_backend/` | 远端传输层（TCP/Orbit WS）、通知转发到 Tauri 事件总线 | 业务状态 reducer |
| `docs/` | 架构、运行手册、参考文档 | 源码实现 |

## 3. 命令契约映射（invoke -> lib.rs command -> adapter/core）

### 3.1 契约总则

- 前端统一从 `src/services/tauri.ts` 调用 `invoke(...)`。
- 后端统一在 `src-tauri/src/lib.rs` 的 `generate_handler![]` 注册 command。
- App 适配层优先走 `shared/*_core.rs`，必要时做 remote 分派：
  - `remote_backend::is_remote_mode(...)` 为 `true` 时走 `remote_backend::call_remote(...)`。
  - 否则走本地 core。

### 3.2 分域映射

| 领域 | Frontend invoke（`src/services/tauri.ts`） | command 注册（`src-tauri/src/lib.rs`） | Adapter 实现 | Core 落点 |
|---|---|---|---|---|
| Settings | `get_app_settings` / `update_app_settings` / `get_codex_config_path` | `settings::*` | `src-tauri/src/settings/mod.rs` | `shared/settings_core.rs` |
| Files | `file_read` / `file_write` | `files::*` | `src-tauri/src/files/mod.rs` | `shared/files_core.rs` |
| Workspaces | `list_workspaces` / `add_workspace` / `add_worktree` / `remove_workspace` / `rename_worktree` / `connect_workspace` / `open_workspace_in` 等 | `workspaces::*` | `src-tauri/src/workspaces/commands.rs` | `shared/workspaces_core.rs` + `shared/worktree_core.rs` + `shared/git_core.rs` |
| Codex Thread/Turn | `start_thread` / `resume_thread` / `send_user_message` / `turn_steer` / `turn_interrupt` / `start_review` / `list_threads` / `archive_thread(s)` 等 | `codex::*` | `src-tauri/src/codex/mod.rs` | `shared/codex_core.rs` |
| Codex Auxiliary | `codex_doctor` / `codex_update` / `generate_commit_message` / `generate_run_metadata` | `codex::*` | `src-tauri/src/codex/mod.rs` | `shared/codex_aux_core.rs` + `shared/codex_update_core.rs` |
| Agents Config | `get_agents_settings` / `set_agents_core_settings` / `create_agent` / `update_agent` / `delete_agent` / `read/write_agent_config_toml` | `codex::*` | `src-tauri/src/codex/mod.rs` | `shared/agents_config_core.rs` |
| Git / GitHub | `get_git_status` / `stage_git_file` / `commit_git` / `sync_git` / `get_github_pull_requests` 等 | `git::*` | `src-tauri/src/git/mod.rs` | `shared/git_ui_core.rs` |
| Prompts | `prompts_list/create/update/delete/move` + `prompts_workspace_dir/global_dir` | `prompts::*` | `src-tauri/src/prompts.rs` | `shared/prompts_core.rs` |
| Local Usage | `local_usage_snapshot` | `local_usage::local_usage_snapshot` | `src-tauri/src/local_usage.rs` | `shared/local_usage_core.rs` |
| Orbit | `orbit_connect_test` / `orbit_sign_in_*` / `orbit_runner_*` | `orbit::*` | `src-tauri/src/orbit/mod.rs` | `shared/orbit_core.rs` + `shared/settings_core.rs` |
| Tailscale | `tailscale_status` / `tailscale_daemon_*` | `tailscale::*` | `src-tauri/src/tailscale/mod.rs` | `tailscale/core.rs` + `tailscale/daemon_commands.rs` |
| Terminal | `terminal_open/write/resize/close` | `terminal::*` | `src-tauri/src/terminal.rs` | 适配层内实现（PTY + `EventSink`），不走 shared core |
| Dictation | `dictation_*` | `dictation::*` | `src-tauri/src/dictation/{real,stub}.rs` | 平台实现分支（`mod.rs` 选择 real/stub），不走 shared core |
| Notification fallback | `is_macos_debug_build` / `send_notification_fallback` | `notifications::*` | `src-tauri/src/notifications.rs` | 适配层直连系统能力 |
| Menu/Platform | `menu_set_accelerators` / `is_mobile_runtime` | `menu::*` / `is_mobile_runtime` | `src-tauri/src/menu*.rs` / `src-tauri/src/lib.rs` | 平台接线逻辑 |

### 3.3 契约细节（关键）

- `respondToUserInputRequest(...)` 在前端不走独立 command，而是复用 `respond_to_server_request` 契约（仅 `result` 结构不同）。
- `sendNotification(...)` 优先走 `@tauri-apps/plugin-notification`，仅 fallback 才调用 `send_notification_fallback` invoke。
- `pickWorkspacePath()` / `pickImageFiles()` 使用 `@tauri-apps/plugin-dialog`，不是 invoke command。

## 4. 事件链路（events.ts 与 useAppServerEvents.ts）

### 4.1 传输路径

#### 本地模式

1. `src-tauri/src/backend/app_server.rs` 读取 `codex app-server` stdout/stderr。
2. 解析为 `AppServerEvent` 后经 `EventSink` 发出。
3. `src-tauri/src/event_sink.rs` 将事件 `app.emit("app-server-event", ...)` 到前端。
4. `src/services/events.ts` 的 `createEventHub("app-server-event")` 负责单监听、多订阅分发。
5. `src/features/app/hooks/useAppServerEvents.ts` 按 method 路由到 typed handlers。
6. 业务消费落点（示例）：
   - `src/features/threads/hooks/useThreads.ts`
   - `src/features/notifications/hooks/useAgentSystemNotifications.ts`
   - `src/features/notifications/hooks/useAgentResponseRequiredNotifications.ts`

#### 远端模式

1. 远端通知进入 `src-tauri/src/remote_backend/transport.rs`。
2. `dispatch_incoming_line(...)` 将 `app-server-event` / `terminal-output` / `terminal-exit` 转发为同名 Tauri 事件。
3. 前端消费路径与本地模式一致（`events.ts` -> `useAppServerEvents.ts` -> 业务 hooks）。

### 4.2 方法路由与消费落点（核心方法）

| 方法（App Server Method） | useAppServerEvents 路由 | 主要消费落点 |
|---|---|---|
| `codex/connected` | `onWorkspaceConnected` | `useThreads.ts` 刷新 workspace/account 信息 |
| `codex/disconnected` | `onWorkspaceDisconnected` | `useThreads.ts` stale guard 与状态恢复 |
| `item/agentMessage/delta` | `onAgentMessageDelta`（带 16ms 批量合并） | `useThreadItemEvents` 更新消息流 |
| `item/completed` | `onItemCompleted` + agent message completed | `useThreadItemEvents` / 通知 hooks |
| `turn/started` | `onTurnStarted` | `useThreadTurnEvents` 更新 turn 状态 |
| `turn/completed` | `onTurnCompleted` | `useThreadTurnEvents` + `useAgentSystemNotifications` |
| `turn/plan/updated` | `onTurnPlanUpdated` | `useThreadTurnEvents` plan 区域 |
| `turn/diff/updated` | `onTurnDiffUpdated` | 线程 diff 状态 |
| `item/tool/requestUserInput` | `onRequestUserInput` | `useThreadUserInputEvents` + ResponseRequired 通知 |
| `account/rateLimits/updated` | `onAccountRateLimitsUpdated` | 账户额度状态 |
| `account/login/completed` | `onAccountLoginCompleted` | 账户刷新与 UI 同步 |

## 5. 外部 CLI 与运行时边界

- `Codex CLI`：`src-tauri/src/backend/app_server.rs` 通过 `codex app-server` 启动，握手顺序 `initialize` -> `initialized`。
- `Daemon Binary`：`src-tauri/src/daemon_binary.rs` 解析 `codex_monitor_daemon` 可执行路径，供 Orbit/TCP daemon 启停使用。
- `Tailscale CLI`：`src-tauri/src/tailscale/mod.rs` 解析并调用 `tailscale` 二进制（含多平台候选路径）。
- `Codex 参数与 HOME`：`src-tauri/src/codex/args.rs`、`src-tauri/src/codex/home.rs`、`src-tauri/src/codex/config.rs` 负责 `codex args`、`CODEX_HOME`、`config.toml` 解析与写回。

## 6. 关键证据文件（本地图基于事实生成）

- `src/services/tauri.ts`
- `src-tauri/src/lib.rs`
- `src-tauri/src/codex/mod.rs`
- `src-tauri/src/workspaces/commands.rs`
- `src-tauri/src/git/mod.rs`
- `src-tauri/src/files/mod.rs`
- `src-tauri/src/settings/mod.rs`
- `src-tauri/src/prompts.rs`
- `src-tauri/src/local_usage.rs`
- `src-tauri/src/orbit/mod.rs`
- `src-tauri/src/tailscale/mod.rs`
- `src-tauri/src/terminal.rs`
- `src-tauri/src/dictation/mod.rs`
- `src-tauri/src/notifications.rs`
- `src-tauri/src/backend/app_server.rs`
- `src-tauri/src/backend/events.rs`
- `src-tauri/src/event_sink.rs`
- `src-tauri/src/remote_backend/transport.rs`
- `src-tauri/src/bin/codex_monitor_daemon.rs`
- `src-tauri/src/shared/mod.rs`
- `src-tauri/src/daemon_binary.rs`
- `src/features/app/hooks/useAppServerEvents.ts`
- `src/services/events.ts`
- `src/features/threads/hooks/useThreads.ts`
- `src/features/threads/hooks/useThreadEventHandlers.ts`
- `src/features/notifications/hooks/useAgentSystemNotifications.ts`
- `src/features/notifications/hooks/useAgentResponseRequiredNotifications.ts`
