# Codex 0.103 升级影响评估（CodexMonitor）

Date: 2026-02-18
Target: `CodexMonitor`
Upstream reference: `codex-rs/app-server-protocol` (0.103 对应主线)

---

## 结论（拍板）

可以升级 Codex 到 0.103。

`CodexMonitor` 不需要做阻断级改造，但建议做 **1 项必要兼容修正**（避免误报协议不兼容）和 **2 项增强**（提升状态一致性与可观测性）。

---

## 证据摘要

1. `CodexMonitor` 当前主链路是 `codex app-server`，不是 `codex exec --json` 文本解析。
   - 证据：`src-tauri/src/backend/app_server.rs:295`（spawn workspace session 走 app-server）。

2. 上游 app-server v2 明确包含新通知：
   - `thread/archived`
   - `thread/unarchived`
   - `model/rerouted`
   - 证据：`第三方Repo参考/官方源码/OpenAI官方Repo/codex/codex-rs/app-server-protocol/src/protocol/common.rs:772`
   - 证据：`第三方Repo参考/官方源码/OpenAI官方Repo/codex/codex-rs/app-server-protocol/src/protocol/common.rs:773`
   - 证据：`第三方Repo参考/官方源码/OpenAI官方Repo/codex/codex-rs/app-server-protocol/src/protocol/common.rs:800`

3. `CodexMonitor` 当前支持方法清单不含上述 3 个方法。
   - 证据：`src/utils/appServerEvents.ts:3`

4. 对未支持方法，前端会报“协议事件不兼容”toast（每 30s 节流）。
   - 证据：`src/features/app/hooks/useAppServerEvents.ts:390`

5. 账户读取链路对 `~/.codex/auth.json` 的 key 兼容（`idToken`/`id_token`）已做容错，本次无需改。
   - 证据：`src-tauri/src/shared/account.rs:69`

---

## 需要改动（分级）

### A. 必须改（建议升级前完成）

1. 将以下方法加入受支持事件集合，避免误报协议不兼容：
   - `model/rerouted`
   - `thread/archived`
   - `thread/unarchived`

建议修改位置：
- `src/utils/appServerEvents.ts` 的 `SUPPORTED_APP_SERVER_METHODS`。

验收标准：
- 收到上述事件时不再出现“协议事件不兼容”toast。

### B. 建议改（升级后第一批）

1. 处理 `model/rerouted`：
   - 在 UI 中展示一次性提示（例如当前 turn 被 reroute）。
   - 更新 turn runtime meta 的 model（避免“选择模型”与“实际模型”显示漂移）。

2. 处理 `thread/archived|thread/unarchived`：
   - 本地线程列表状态同步（或触发轻量 thread/list 刷新）。
   - 保证多端/后台操作后侧栏状态一致。

建议修改位置：
- `src/features/app/hooks/useAppServerEvents.ts`
- `src/features/threads/hooks/useThreadTurnEvents.ts`
- `src/features/threads/hooks/useThreadsReducer.ts`

### C. 可不改（本次可延后）

1. `skills/remote/read|write` 新参数形态相关能力。
   - 当前 `CodexMonitor` 只用 `skills/list`，未调用 remote skills API。
   - 本次升级不构成阻断。

---

## 回归测试建议

1. 前端事件路由测试新增：
   - `model/rerouted` 不触发 unsupported toast。
   - `thread/archived`、`thread/unarchived` 不触发 unsupported toast。

2. 线程状态测试新增：
   - archived/unarchived 事件可正确反映到 `threadsByWorkspace`（或刷新触发）。

3. 模型可观测性测试新增：
   - 发生 `model/rerouted` 后，当前 turn 的 model 显示与事件一致。

---

## 风险与回滚

- 风险：若不做 A，升级后在命中新通知场景会出现误导性“协议不兼容”告警，影响信噪比。
- 回滚：前端兼容改动可独立回滚，不影响 app-server 连接主流程；升级失败可继续用当前 Codex 版本运行。

---

## 深挖补充 1：上游通知结构（字段级）

本节给出 0.103 相关新增通知的字段结构，避免实现阶段“先猜后改”。

1. `thread/archived`
   - 结构：`{ thread_id: string }`
   - 证据：`第三方Repo参考/官方源码/OpenAI官方Repo/codex/codex-rs/app-server-protocol/src/protocol/v2.rs:2919`

2. `thread/unarchived`
   - 结构：`{ thread_id: string }`
   - 证据：`第三方Repo参考/官方源码/OpenAI官方Repo/codex/codex-rs/app-server-protocol/src/protocol/v2.rs:2926`

3. `model/rerouted`
   - 结构：`{ thread_id, turn_id, from_model, to_model, reason }`
   - 证据：`第三方Repo参考/官方源码/OpenAI官方Repo/codex/codex-rs/app-server-protocol/src/protocol/v2.rs:3425`

---

## 深挖补充 2：CodexMonitor 现状映射（代码级）

1. 未支持方法会触发协议不兼容提示
   - 证据：`src/features/app/hooks/useAppServerEvents.ts:390`
   - 现象：未知方法命中后，30 秒节流 toast：`协议事件不兼容`

2. 当前支持列表不含上述 3 个方法
   - 证据：`src/utils/appServerEvents.ts:3`

3. Turn runtime meta 支持模型字段，具备接入 reroute 的承载位
   - 证据：`src/features/threads/hooks/useThreadsReducer.ts` 中 `ThreadTurnRuntimeMeta.model`
   - 证据：`src/features/threads/hooks/useThreadTurnEvents.ts:139`（`onTurnStarted` 会写 turn model）

4. 线程归档相关请求已存在（`thread/archive`），但事件侧缺 `thread/archived|unarchived` 同步
   - 证据：`src-tauri/src/shared/codex_core.rs:203`

---

## 深挖补充 3：实施级改造方案（一次性）

### 变更包 A（必须，低风险）

目标：消除误报 toast

- 文件：`src/utils/appServerEvents.ts`
- 动作：
  - 将 `model/rerouted`、`thread/archived`、`thread/unarchived` 加入 `SUPPORTED_APP_SERVER_METHODS`

预期：升级后命中新通知时不再走 unsupported 分支。

### 变更包 B（建议，中风险）

目标：状态一致性与可观测性

- 文件：`src/features/app/hooks/useAppServerEvents.ts`
- 动作：
  - 新增 `model/rerouted` 分支：抽取 `threadId/turnId/fromModel/toModel/reason`
  - 新增 `thread/archived`、`thread/unarchived` 分支：触发线程状态刷新或局部状态更新

- 文件：`src/features/threads/hooks/useThreadTurnEvents.ts`
- 动作：
  - 新增 handler：当 `model/rerouted` 命中当前 turn，更新 `turn meta model = toModel`

- 文件：`src/features/threads/hooks/useThreadsReducer.ts`
- 动作：
  - 增加 action（建议）：`setThreadTurnModelFromReroute`
  - 确保 assistant message 上展示模型与 reroute 后模型一致

---

## 深挖补充 4：测试矩阵（建议直接新增）

1. `src/utils/appServerEvents.test.ts`
   - 断言 `isSupportedAppServerMethod("model/rerouted") === true`
   - 断言 `isSupportedAppServerMethod("thread/archived") === true`
   - 断言 `isSupportedAppServerMethod("thread/unarchived") === true`

2. `src/features/app/hooks/useAppServerEvents.test.tsx`
   - 新增 case：上述 3 个方法输入时，不触发 `pushErrorToast`

3. `src/features/threads/hooks/useThreadTurnEvents.test.tsx`
   - 新增 case：`model/rerouted` 后，当前 turn model 更新为 `toModel`

4. 集成回归（建议命令）
   - `npm run test -- src/utils/appServerEvents.test.ts src/features/app/hooks/useAppServerEvents.test.tsx src/features/threads/hooks/useThreadTurnEvents.test.tsx`

---

## 深挖补充 5：不需要改的点（确认）

1. `auth.json` 兼容
   - `idToken` / `id_token` 双读取已覆盖
   - 证据：`src-tauri/src/shared/account.rs:69`

2. `codex exec --json` 事件解析
   - CodexMonitor 主链路为 app-server，不依赖 exec JSON 行解析作为核心通信机制
   - 证据：`src-tauri/src/backend/app_server.rs:295`

---

## 深挖补充 6：实施陷阱（避免返工）

1. 事件白名单是“双清单”约束，不是单点修改
   - 清单 A：`src/utils/appServerEvents.ts` 的 `SUPPORTED_APP_SERVER_METHODS`
   - 清单 B：`src/features/app/hooks/useAppServerEvents.ts` 的 `METHODS_ROUTED_IN_USE_APP_SERVER_EVENTS`
   - 若只改 A 不改 B，会触发对齐测试失败。
   - 证据：`src/utils/appServerEvents.test.ts:112`

2. 新增支持方法后，若暂不做完整业务处理，至少应作为 no-op 显式接收
   - 否则会掉回 unsupported 分支并提示“协议事件不兼容”。
   - 证据：`src/features/app/hooks/useAppServerEvents.ts:390`

3. `thread/archived|thread/unarchived` 不处理会导致“外部操作后本地列表延迟收敛”
   - 当前线程列表刷新主要依赖用户动作或显式 list/resume 流程，不是由这两个通知驱动。
   - 证据：`src/features/threads/hooks/useThreadActions.ts:573`
   - 证据：`src/features/threads/hooks/useThreads.ts:509`

---

## 深挖补充 7：协议语义边界（0.103）

1. `model/rerouted` 只在 v2 通知层发送，且包含 turn 级上下文
   - 字段：`threadId`, `turnId`, `fromModel`, `toModel`, `reason`
   - 证据：`第三方Repo参考/官方源码/OpenAI官方Repo/codex/codex-rs/app-server/src/bespoke_event_handling.rs:127`
   - 证据：`第三方Repo参考/官方源码/OpenAI官方Repo/codex/codex-rs/app-server/src/outgoing_message.rs:552`

2. `thread/archived` / `thread/unarchived` 为请求成功后的服务器通知（不是轮询快照）
   - archive 成功后发 `thread/archived`
   - unarchive 成功后发 `thread/unarchived`
   - 证据：`第三方Repo参考/官方源码/OpenAI官方Repo/codex/codex-rs/app-server/src/codex_message_processor.rs:2136`
   - 证据：`第三方Repo参考/官方源码/OpenAI官方Repo/codex/codex-rs/app-server/src/codex_message_processor.rs:2350`

3. `model/rerouted.reason` 当前枚举仅 1 个值，但应按“可扩展枚举”处理
   - 当前：`HighRiskCyberActivity`
   - 证据：`第三方Repo参考/官方源码/OpenAI官方Repo/codex/codex-rs/protocol/src/protocol.rs:1352`

---

## 深挖补充 8：审批与 remote skills 变更（本次确认为非阻断）

1. 上游审批事件新增 `approval_id`（用于区分子命令审批），但 CodexMonitor 当前审批应答仍走 JSON-RPC `request_id`，兼容不受阻
   - 上游证据：`codex-rs/protocol/src/approvals.rs`（`ExecApprovalRequestEvent.approval_id`）
   - 本地证据：`src/features/threads/hooks/useThreadApprovalEvents.ts:45`
   - 判断：属于可观测性增强点，而非必须改项

2. 上游 remote skills app-server 语义从 read/write 演进到 list/export，参数更严格
   - 上游证据：`codex-rs/app-server/src/codex_message_processor.rs`
   - 本地状态：CodexMonitor 当前主用 `skills/list`，未依赖 remote skills 接口
   - 判断：本轮升级对 CodexMonitor 主链路无阻断影响

3. `collab` 到 `multi_agent` 的内部重命名对当前 CodexMonitor 仍兼容
   - 上游仍保留 legacy alias：`collab` -> `Feature::Collab`
   - `config.schema` 同时可见 `collab` 与 `multi_agent` 键
   - 本地读写仍使用 `features.collab`：`src-tauri/src/codex/config.rs:16`
   - 判断：短期非阻断；后续可规划迁移到新键名以降低长期漂移风险

4. `Use V2 websockets if feature enabled` 不改变 CodexMonitor 的 app-server 协议契约
   - 上游提交主要在 `core/src/client.rs` 的 Responses websocket 使能逻辑
   - CodexMonitor 当前主链路是 app-server 会话，不消费 Responses websocket 客户端路径
   - 判断：非阻断，无需为该提交单独改造

---

## 一致性结论（CodexMonitor vs Codex 上游）

结论：**部分一致，存在既有协议支持漂移**。

1. 一致部分：
   - 主要事件流和 request 主链路可工作（`thread/start`、`turn/start`、`model/list`、`collaborationMode/list`）。
2. 不一致部分（既有问题）：
   - 上游 server notifications 里新增的 `model/rerouted`、`thread/archived`、`thread/unarchived` 尚未纳入本地支持列表。
3. 影响：
   - 命中上述事件时会误报“协议事件不兼容”，属于可观测性与体验问题，不是会话硬中断。
