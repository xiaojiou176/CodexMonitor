# Critical Flows

本文只记录当前仓库中可追溯的关键链路，所有节点均基于真实文件路径。

## 1) Thread 生命周期链路（start/resume/send/interrupt/archive）

### 入口点
- 前端 IPC 入口：`src/services/tauri.ts:352`（`startThread`）、`src/services/tauri.ts:968`（`resumeThread`）、`src/services/tauri.ts:372`（`sendUserMessage`）、`src/services/tauri.ts:402`（`interruptTurn`）、`src/services/tauri.ts:972`（`archiveThread`）与 `src/services/tauri.ts:976`（`archiveThreads`）。
- Tauri 命令注册：`src-tauri/src/lib.rs:235` 到 `src-tauri/src/lib.rs:249`。

### 关键中转
- App 侧核心实现：`src-tauri/src/shared/codex_core.rs:94`（`start_thread_core`）、`src-tauri/src/shared/codex_core.rs:110`（`resume_thread_core`）、`src-tauri/src/shared/codex_core.rs:378`（`send_user_message_core`）、`src-tauri/src/shared/codex_core.rs:450`（`turn_interrupt_core`）、`src-tauri/src/shared/codex_core.rs:205`（`archive_thread_core`）、`src-tauri/src/shared/codex_core.rs:230`（`archive_threads_core`）。
- Daemon RPC 转发：`src-tauri/src/bin/codex_monitor_daemon/rpc.rs:341`（start）、`src-tauri/src/bin/codex_monitor_daemon/rpc.rs:345`（resume）、`src-tauri/src/bin/codex_monitor_daemon/rpc.rs:404`（send）、`src-tauri/src/bin/codex_monitor_daemon/rpc.rs:432`（interrupt）、`src-tauri/src/bin/codex_monitor_daemon/rpc.rs:373`（archive）。

### 状态更新点
- 启动与恢复线程后的状态入库：`src/features/threads/hooks/useThreadActions.ts:258`（start）与 `src/features/threads/hooks/useThreadActions.ts:251`（resume in-flight 管理）。
- turn 事件驱动状态机：`src/features/threads/hooks/useThreadTurnEvents.ts:181`（`onTurnStarted`）与 `src/features/threads/hooks/useThreadTurnEvents.ts:235`（`onTurnCompleted`）。
- reducer 的状态结构与 action 定义：`src/features/threads/hooks/useThreadsReducer.ts:151` 与 `src/features/threads/hooks/useThreadsReducer.ts:176`。

### 常见失败点
- workspace 未连接：`src-tauri/src/shared/codex_core.rs:35` 返回 `"workspace not connected"`。
- `resume` 方法兼容性：`src-tauri/src/shared/codex_core.rs:122` 到 `src-tauri/src/shared/codex_core.rs:135`，`thread/resume` 不可用时降级 `thread/read`。
- 空消息/非法提及：`src-tauri/src/shared/codex_core.rs:372`（`empty user message`）、`src-tauri/src/shared/codex_core.rs:335` 到 `src-tauri/src/shared/codex_core.rs:364`（mention 校验失败）。
- 中断时机竞态：`src/features/threads/hooks/useThreadTurnEvents.ts:203` 到 `src/features/threads/hooks/useThreadTurnEvents.ts:208`（pending interrupt 在 turn started 时补发）。

### 最小验证方法
1. 在 UI 中新建线程并发送一句话，确认出现 `thread/start` 与 `turn/start`。
2. 在处理中触发 interrupt，确认线程 phase 进入 `interrupted`（`src/features/threads/hooks/useThreadTurnEvents.ts:255`）。
3. 归档单线程与批量线程，确认列表移除逻辑（`src/features/threads/hooks/useThreadActions.ts:114`、`src/features/threads/hooks/useThreadActions.ts:185`）。
4. 若后端不支持 `thread/resume`，验证 fallback 到 `thread/read` 不报错（`src-tauri/src/shared/codex_core.rs:132`）。

## 2) Workspace/Worktree 链路（add/connect/rename/remove/apply changes）

### 入口点
- 前端 IPC：`src/services/tauri.ts:240`（add workspace）、`src/services/tauri.ts:263`（add worktree）、`src/services/tauri.ts:348`（connect）、`src/services/tauri.ts:309`（rename）、`src/services/tauri.ts:301`/`src/services/tauri.ts:305`（remove）、`src/services/tauri.ts:324`（apply worktree changes）。
- 前端业务入口：`src/features/workspaces/hooks/useWorkspaces.ts:233`（add workspace）、`src/features/workspaces/hooks/useWorkspaces.ts:293`（add worktree）、`src/features/workspaces/hooks/useWorkspaces.ts:397`（connect）、`src/features/workspaces/hooks/useWorkspaces.ts:793`（rename）、`src/features/workspaces/hooks/useWorkspaces.ts:673`（remove workspace）、`src/features/workspaces/hooks/useWorkspaces.ts:737`（remove worktree）。

### 关键中转
- Tauri command 适配与 remote 分流：`src-tauri/src/workspaces/commands.rs:98`（add workspace）、`src-tauri/src/workspaces/commands.rs:156`（add worktree）、`src-tauri/src/workspaces/commands.rs:509`（connect）、`src-tauri/src/workspaces/commands.rs:327`（rename）、`src-tauri/src/workspaces/commands.rs:265`/`src-tauri/src/workspaces/commands.rs:297`（remove）、`src-tauri/src/workspaces/commands.rs:437`（apply changes）。
- shared core 主实现：`src-tauri/src/shared/workspaces_core.rs:192`（add workspace）、`src-tauri/src/shared/workspaces_core.rs:717`（add worktree）、`src-tauri/src/shared/workspaces_core.rs:397`（apply worktree changes）、`src-tauri/src/shared/workspaces_core.rs:424`（apply inner）。
- daemon RPC 路由：`src-tauri/src/bin/codex_monitor_daemon/rpc.rs:197` 到 `src-tauri/src/bin/codex_monitor_daemon/rpc.rs:249`，以及 `src-tauri/src/bin/codex_monitor_daemon/rpc.rs:602`（apply changes）。

### 状态更新点
- `setWorkspaces` 与 `setActiveWorkspaceId`：`src/features/workspaces/hooks/useWorkspaces.ts:248`、`src/features/workspaces/hooks/useWorkspaces.ts:327`、`src/features/workspaces/hooks/useWorkspaces.ts:420`、`src/features/workspaces/hooks/useWorkspaces.ts:769`、`src/features/workspaces/hooks/useWorkspaces.ts:820`。
- 删除中的 UI 状态：`src/features/workspaces/hooks/useWorkspaces.ts:755` 到 `src/features/workspaces/hooks/useWorkspaces.ts:789`。
- rename prompt 与 upstream prompt 状态：`src/features/workspaces/hooks/useRenameWorktreePrompt.ts:39`、`src/features/workspaces/hooks/useRenameWorktreePrompt.ts:156`。

### 常见失败点
- 非目录路径：`src-tauri/src/shared/workspaces_core.rs:205`。
- 从 worktree 再创建 worktree：`src-tauri/src/shared/workspaces_core.rs:773`。
- apply changes 前置条件失败：父仓库有未提交变更（`src-tauri/src/shared/workspaces_core.rs:433`）、无可应用 patch（`src-tauri/src/shared/workspaces_core.rs:477`）、3-way apply 冲突（`src-tauri/src/shared/workspaces_core.rs:520`）。
- worktree 类型校验失败：`src-tauri/src/shared/workspaces_core.rs:407` 与 `src-tauri/src/shared/workspaces_core.rs:175`。

### 最小验证方法
1. add workspace 后应立即出现在 sidebar，且 `connected=true`（`src/features/workspaces/hooks/useWorkspaces.ts:248`）。
2. add worktree 后应能自动选中并可执行 connect（`src/features/workspaces/hooks/useWorktreePrompt.ts:207` 到 `src/features/workspaces/hooks/useWorktreePrompt.ts:210`）。
3. rename worktree 后刷新为服务端返回值（`src/features/workspaces/hooks/useWorkspaces.ts:819` 到 `src/features/workspaces/hooks/useWorkspaces.ts:823`）。
4. apply worktree changes 在父仓库 dirty 时必须返回明确错误文本（`src-tauri/src/shared/workspaces_core.rs:435`）。

## 3) Git/GitHub 链路（status/diff/stage/commit/push/PR）

### 入口点
- 前端 IPC：`src/services/tauri.ts:489`（status）、`src/services/tauri.ts:502`（diff）、`src/services/tauri.ts:523`/`src/services/tauri.ts:527`（stage）、`src/services/tauri.ts:543`（commit）、`src/services/tauri.ts:550`（push）、`src/services/tauri.ts:575`（PR list）、`src/services/tauri.ts:582`（PR diff）、`src/services/tauri.ts:592`（PR comments）。
- Tauri 注册：`src-tauri/src/lib.rs:256` 到 `src-tauri/src/lib.rs:275`。

### 关键中转
- remote/local 分发：`src-tauri/src/git/mod.rs:13`（`call_remote_if_enabled`）及各命令 `try_remote_*` 宏（例如 `src-tauri/src/git/mod.rs:72`、`src-tauri/src/git/mod.rs:166`）。
- shared git UI core：
  - status：`src-tauri/src/shared/git_ui_core.rs:567`
  - diff：`src-tauri/src/shared/git_ui_core.rs:839`
  - stage file/all：`src-tauri/src/shared/git_ui_core.rs:693`、`src-tauri/src/shared/git_ui_core.rs:707`
  - commit：`src-tauri/src/shared/git_ui_core.rs:771`
  - push：`src-tauri/src/shared/git_ui_core.rs:783`
  - PR list/diff/comments（通过 `gh`）：`src-tauri/src/shared/git_ui_core.rs:1289`、`src-tauri/src/shared/git_ui_core.rs:1357`、`src-tauri/src/shared/git_ui_core.rs:1399`
- daemon RPC：`src-tauri/src/bin/codex_monitor_daemon/rpc.rs:620` 到 `src-tauri/src/bin/codex_monitor_daemon/rpc.rs:730`。

### 状态更新点
- Git 状态缓存与失效：
  - 读取缓存：`src-tauri/src/shared/git_ui_core.rs:42`
  - 写缓存：`src-tauri/src/shared/git_ui_core.rs:56`
  - 变更后失效：`src-tauri/src/shared/git_ui_core.rs:703`、`src-tauri/src/shared/git_ui_core.rs:714`、`src-tauri/src/shared/git_ui_core.rs:779`、`src-tauri/src/shared/git_ui_core.rs:790`。
- 统计字段更新：`src-tauri/src/shared/git_ui_core.rs:681` 到 `src-tauri/src/shared/git_ui_core.rs:688`。

### 常见失败点
- git 命令失败统一错误出口：`src-tauri/src/shared/git_ui_core.rs:143` 到 `src-tauri/src/shared/git_ui_core.rs:168`。
- push 上游分支不一致或缺失：`src-tauri/src/shared/git_ui_core.rs:268` 到 `src-tauri/src/shared/git_ui_core.rs:276`。
- pull 策略冲突（divergent branches）自动回退逻辑：`src-tauri/src/shared/git_ui_core.rs:286` 到 `src-tauri/src/shared/git_ui_core.rs:326`。
- GitHub 链路依赖 `gh` CLI 且命令失败会直接透传 stderr：`src-tauri/src/shared/git_ui_core.rs:1315` 到 `src-tauri/src/shared/git_ui_core.rs:1327`、`src-tauri/src/shared/git_ui_core.rs:1381` 到 `src-tauri/src/shared/git_ui_core.rs:1393`。
- 当前仓库未发现“创建 PR”命令入口；现有实现为 PR 查询/差异/评论读取链路（同上）。

### 最小验证方法
1. 改一行文件后调用 status/diff，确认有 staged/unstaged 明细。
2. stage + commit + push 顺序执行，确认每步后 `get_git_status` 变化符合预期。
3. 在已配置 GitHub 远程且 `gh auth` 可用时，验证 PR 列表与 PR diff 可拉取。
4. 故意使 `gh` 不可用或未登录，确认错误被 UI 捕获并展示（stderr 文案）。

## 4) 本地/远端模式链路（TCP/Orbit daemon 连接与关键分支）

### 入口点
- 设置页模式/提供方切换：`src/features/settings/components/sections/SettingsServerSection.tsx:170`（backend mode）、`src/features/settings/components/sections/SettingsServerSection.tsx:195`（provider: tcp/orbit）。
- TCP/Orbit 操作入口：`src/services/tauri.ts:789`（`tailscale_daemon_start`）、`src/services/tauri.ts:797`（`tailscale_daemon_status`）、`src/services/tauri.ts:752`（`orbitConnectTest`）、`src/services/tauri.ts:768`（`orbitRunnerStart`）。

### 关键中转
- remote backend 网关：`src-tauri/src/remote_backend/mod.rs:87`（`is_remote_mode`）、`src-tauri/src/remote_backend/mod.rs:92`（`call_remote`）、`src-tauri/src/remote_backend/mod.rs:159`（`ensure_remote_backend`）。
- 传输层：
  - TCP：`src-tauri/src/remote_backend/tcp_transport.rs:11`
  - Orbit WS：`src-tauri/src/remote_backend/orbit_ws_transport.rs:20`
- provider 配置分支：`src-tauri/src/remote_backend/mod.rs:206` 到 `src-tauri/src/remote_backend/mod.rs:233`。
- 启动时后台守护进程策略：`src-tauri/src/lib.rs:125` 到 `src-tauri/src/lib.rs:185`（TCP/Orbit + local/remote 分支）。

### 状态更新点
- 远端连接状态位：`src-tauri/src/remote_backend/mod.rs:64`（`connected`）与 `src-tauri/src/remote_backend/mod.rs:69`（断连判定）。
- 断连重试白名单：`src-tauri/src/remote_backend/mod.rs:122` 到 `src-tauri/src/remote_backend/mod.rs:156`（仅读操作可重试，`send_user_message`/`start_thread` 不重试）。
- TCP daemon runtime 状态刷新：`src-tauri/src/tailscale/mod.rs:185` 到 `src-tauri/src/tailscale/mod.rs:235`。
- Orbit runner 状态与版本约束：`src-tauri/src/orbit/mod.rs:241` 到 `src-tauri/src/orbit/mod.rs:294`。

### 常见失败点
- 远端连接失败：TCP `connect` 报错（`src-tauri/src/remote_backend/tcp_transport.rs:17`），Orbit relay 连接报错（`src-tauri/src/remote_backend/orbit_ws_transport.rs:27` 到 `src-tauri/src/remote_backend/orbit_ws_transport.rs:29`）。
- Orbit provider 缺少 `orbitWsUrl`：`src-tauri/src/remote_backend/mod.rs:227`。
- 断连后写操作不自动重试（如 `send_user_message`）：`src-tauri/src/remote_backend/mod.rs:262` 到 `src-tauri/src/remote_backend/mod.rs:264`（测试断言）。
- Tailscale CLI 不存在：`src-tauri/src/tailscale/mod.rs:81` 到 `src-tauri/src/tailscale/mod.rs:89`。

### 最小验证方法
1. 切到 `remote + tcp`，填写 host/token，验证可连接并执行只读命令（如 `list_workspaces`）。
2. 切到 `remote + orbit`，先跑 `orbit_connect_test` 再 `orbit_runner_start`，确认状态为 running。
3. 人为断网后，验证 `resume_thread` 可触发重连重试而 `send_user_message` 不重试（符合白名单）。
4. 切回 `local`，验证桌面命令仍走本地实现分支（非 remote transport）。

## 5) 链路总览（跨链路统一检查点）

### 入口点
- 统一前端 IPC 门面：`src/services/tauri.ts`。
- 统一后端命令注册：`src-tauri/src/lib.rs:211`。

### 关键中转
- App 侧 adapter：`src-tauri/src/workspaces/commands.rs`、`src-tauri/src/git/mod.rs`、`src-tauri/src/codex/mod.rs`。
- shared core：`src-tauri/src/shared/codex_core.rs`、`src-tauri/src/shared/workspaces_core.rs`、`src-tauri/src/shared/git_ui_core.rs`。
- daemon RPC：`src-tauri/src/bin/codex_monitor_daemon/rpc.rs`。

### 状态更新点
- 前端状态主 reducer：`src/features/threads/hooks/useThreadsReducer.ts`。
- workspace 列表状态：`src/features/workspaces/hooks/useWorkspaces.ts`。
- daemon/runtime 状态：`src-tauri/src/tailscale/mod.rs`、`src-tauri/src/orbit/mod.rs`。

### 常见失败点
- workspace not found / not connected / command unavailable。
- remote 断连与 provider 配置缺失。
- git/gh 外部命令失败导致的链路中断。

### 最小验证方法
1. 本地模式完整跑通：workspace add -> thread start/send -> git status/stage/commit。
2. 远端 TCP 跑通读操作与至少一条写操作。
3. 远端 Orbit 跑通 connect test + runner start + thread resume。
4. 验证错误路径：刻意制造一次连接失败与一次 git/gh 失败，确认错误可见且可恢复。
