# CodexMonitor CLAUDE Guide

本文件是仓库级文档索引，面向在本项目内执行任务的 Claude/Codex 类代理。

## 模块目的

- 给出仓库全局导航、执行入口和质量门禁。
- 约束改动优先级：先事实一致，再局部改动，再验证通过。
- 避免前后端、app/daemon 双实现漂移。

## 技术栈

- 前端：React 19 + Vite + TypeScript + Vitest + Playwright
- 桌面端：Tauri v2（Rust）
- 后端结构：App 适配层 + Daemon 适配层 + `src-tauri/src/shared/*` 共享核心

## 目录导航

- 根入口：`README.md`、`AGENTS.md`、`CLAUDE.md`
- 前端：`src/`
- Tauri 后端：`src-tauri/src/`
- 共享核心：`src-tauri/src/shared/`
- 守护进程入口：`src-tauri/src/bin/codex_monitor_daemon.rs`
- 文档索引：`docs/README.md`

## 常用命令

```bash
npm install
npm run start:dev
npm run tauri:build
```

## 测试入口

```bash
npm run lint:strict
npm run test:assertions:guard
npm run guard:reuse-search
npm run env:rationalize:check
npm run env:doctor:dev
npm run test
npm run typecheck
npm run check:rust
```

## 强制测试与评估标准（必须遵守）

以下 9 条为硬性约束，执行任务时必须满足，并与 `AGENTS.md` 的质量门禁语义保持一致。

1. **Live Preflight + 真实运行必须执行**  
   涉及联调、外部服务或端到端路径时，必须先做 live preflight，再做真实运行验证；存在可用 Key 时，禁止跳过真实运行。
2. **Pre-commit 门禁必须启用且通过**  
   本地与 CI 均必须执行并通过 `lint`、`assertion guard`、`reuse-search guard`、`doc-drift` 门禁；禁止绕过 pre-commit / pre-push 钩子。
3. **覆盖率阈值必须达标**  
   常规模块测试覆盖率不得低于 80%；核心业务路径不得低于 95%；低于阈值视为未完成。
4. **测试顺序必须“短测优先、长测后置”**  
   先运行快速测试（lint/unit/assertion guard/typecheck），再运行耗时测试（integration/e2e/full regression），避免长链路掩盖基础错误。
5. **并发执行为默认策略**  
   独立任务（如代码、测试、文档、巡检）应并发推进，减少串行等待；仅在存在明确依赖时串行。
6. **长任务必须持续心跳汇报**  
   长耗时任务需周期性输出进度心跳（当前阶段、已完成项、下一步、阻塞点），避免黑盒执行。
7. **评估结论必须证据化**  
   每次结论都必须绑定可复现证据（命令、输出、文件变更、测试结果）；无证据结论视为无效。
8. **失败闭环必须完成**  
   测试或门禁失败时必须立即修复并重跑，直到通过；不得以“已知问题”替代修复闭环。
9. **导航文档覆盖必须达标并持续维护**  
   根目录必须同时存在 `AGENTS.md` 与 `CLAUDE.md`；主要模块目录（例如 `src/`、`src-tauri/`）也必须同时存在 `AGENTS.md` 与 `CLAUDE.md`；内容至少覆盖模块目的、技术栈、导航索引。

## 文档与规则宪法（14条，对齐版）

此处与根 `AGENTS.md` 的“文档与规则宪法（2026-02，14条）”完全对齐执行；本文件提供执行摘要，不替代根规则。

### 14条强制规范（摘要）

1) Live 真实外部验证必须执行（有条件时）。  
2) Lint 必须零错误零警告。  
3) 覆盖率门槛：全局 `>=80%`、关键 `>=95%`。  
4) 禁止安慰剂断言，必须通过 assertion guard。  
5) 可并发检查默认并发。  
6) 长测试必须持续心跳。  
7) 测试顺序固定：短测先、长测后。  
8) 文档漂移检查必做。  
9) 导航文档覆盖必须完整。  
10) 文档读取采用“索引优先 + 懒加载”。  
11) 模型策略默认 Gemini-only。  
12) 兼容路线仅可选、非默认、需记录。  
13) 规则层级遵循“根文档优先”。  
14) 结论必须证据绑定。  

### 14项 Gate（摘要）

与根 `AGENTS.md` 的 14 项 Gate 同步，执行时以根文档条款与命令为准。

## 索引化与懒加载导航

1. 先读 `AGENTS.md`（规则宪法与 Gate）。
2. 再按任务域懒加载：
- 前端：`src/AGENTS.md`、`src/CLAUDE.md`
- 后端：`src-tauri/AGENTS.md`、`src-tauri/CLAUDE.md`
3. 跨域任务才补充加载另一域文档，避免全量展开。

## Gemini 策略（默认与兼容）

- 默认链路：Gemini-only（当前）。
- 兼容路线：非默认、按需启用、必须记录触发条件与回退策略。

## 变更注意事项

- 改后端领域逻辑时，优先改 `src-tauri/src/shared/*`，app/daemon 仅做薄适配。
- 改 Tauri IPC 时，同步更新 `src-tauri/src/lib.rs` 与 `src/services/tauri.ts`。
- 改事件流时，保持 `src/services/events.ts` 的单监听多订阅模式。
- 新增/变更命令后，确认 `README.md`、本文件、子模块文档不冲突。
