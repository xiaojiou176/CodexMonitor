# 官方同步深度执行方案（Feature-Domain，按可编译阶段推进）

> 适用仓库：`CodexMonitor`
> 当前日期：2026-02-23
> 目标：在不牺牲本地 43 个提交价值的前提下，逐阶段吸收 `origin/main` 的 66 个提交，并保证每阶段可编译可验证。

---

## 0. 事实基线（本计划依赖的真实数据）

### 0.1 当前分叉状态

- 基线稳定分支：`custom/main`
- 当前集成分支：`integration/phase1-workspace-thread-v2-20260223`
- 分叉计数（`origin/main...HEAD`）：
  - 官方独有：`66`
  - 本地独有：`43`

### 0.2 一次性 merge 冲突规模（预演）

- 冲突文件总数：`28`

冲突文件（最新预演）：

1. `docs/codebase-map.md`
2. `docs/mobile-ios-cloudflare-blueprint.md`
3. `src-tauri/src/bin/codex_monitor_daemon/rpc/codex.rs`
4. `src-tauri/src/bin/codex_monitor_daemon/rpc/git.rs`
5. `src-tauri/src/bin/codex_monitor_daemon/rpc/workspace.rs`
6. `src-tauri/src/remote_backend/orbit_ws_transport.rs`
7. `src-tauri/src/shared/git_ui_core/commands.rs`
8. `src-tauri/src/shared/git_ui_core/tests.rs`
9. `src-tauri/src/shared/workspaces_core/connect.rs`
10. `src-tauri/src/shared/workspaces_core/crud_persistence.rs`
11. `src-tauri/src/shared/workspaces_core/helpers.rs`
12. `src-tauri/src/shared/workspaces_core/worktree.rs`
13. `src/features/app/orchestration/useThreadCodexOrchestration.ts`
14. `src/features/app/orchestration/useThreadOrchestration.ts`
15. `src/features/git/hooks/usePullRequestReviewActions.ts`
16. `src/features/models/utils/modelListResponse.ts`
17. `src/features/settings/components/sections/SettingsSectionContainers.tsx`
18. `src/features/settings/hooks/useSettingsCodexSection.ts`
19. `src/features/settings/hooks/useSettingsDefaultModels.test.tsx`
20. `src/features/settings/hooks/useSettingsDefaultModels.ts`
21. `src/features/settings/hooks/useSettingsFeaturesSection.ts`
22. `src/features/settings/hooks/useSettingsGitSection.ts`
23. `src/features/settings/hooks/useSettingsServerSection.ts`
24. `src/features/settings/hooks/useSettingsViewOrchestration.ts`
25. `src/features/threads/hooks/useThreadCodexParams.test.tsx`
26. `src/features/threads/hooks/useThreadCodexParams.ts`
27. `src/features/threads/utils/threadCodexParamsSeed.test.ts`
28. `src/features/threads/utils/threadCodexParamsSeed.ts`

### 0.3 为什么之前 phase1 失败（根因）

不是“冲突没解完”，而是“契约层未与领域层同阶段迁移”：

1. `types`、`tauri bridge`、`app orchestration`、`shared mod/lib.rs` 与 workspace/thread 改动不同步。
2. 只按冲突文件合并会漏掉大量“无冲突但有新接口依赖”的文件。
3. 一次性 `git add -A` 污染 index（`.runtime-cache`、`.codex` 等）。

---

## 1. 总体策略（不是按前后端，是按功能域 + 契约层）

### 1.1 阶段拓扑

1. `Phase 0`：防护与可观测准备
2. `Phase 1`：Workspace + Thread + Contract Layer
3. `Phase 2`：Git 全栈
4. `Phase 3`：Settings + Mobile + About
5. `Phase 4`：Cross-cutting + Docs/Tooling 收口

### 1.2 强制规则

1. 每阶段必须全绿再进下一阶段：
   - `npm run lint`
   - `npm run typecheck`
   - 该域 targeted tests
   - `cd src-tauri && cargo check`
2. 解决冲突禁止 `git add -A`。
3. 只能按白名单路径 `git add <file...>`。
4. 两轮修复仍不绿则回滚并拆子阶段。

---

## 2. Phase 0（半天）

### 2.1 目标

确保“可回滚、可追踪、可复现冲突”。

### 2.2 执行步骤

```bash
git checkout custom/main
git fetch --all --prune
git status --short
git rev-list --left-right --count origin/main...HEAD

# 预演冲突（不提交）
git checkout -b tmp/merge-preview-20260223
git merge --no-commit --no-ff origin/main || true
git diff --name-only --diff-filter=U > /tmp/upstream_conflicts_latest.txt
git merge --abort
git checkout custom/main
git branch -D tmp/merge-preview-20260223
```

### 2.3 DoD

- 冲突清单可复现。
- `git status` 干净。
- `.runtime-cache/.codex/test-results` 不进入 index。

---

## 3. Phase 1（核心战役）：Workspace + Thread + Contract Layer

## 3.1 范围边界（必须同进同出）

### A. 领域文件（112 个中的主域）

- `src/features/workspaces/**`
- `src/features/threads/**`
- `src-tauri/src/workspaces/**`
- `src-tauri/src/shared/workspaces_core/**`

### B. 编排与契约文件（必须绑定）

- `src/features/app/orchestration/useThreadCodexOrchestration.ts`
- `src/features/app/orchestration/useThreadOrchestration.ts`
- `src/App.tsx`
- `src/types.ts`
- `src/services/tauri.ts`
- `src-tauri/src/lib.rs`
- `src-tauri/src/shared/mod.rs`

> 原则：Phase1 不只搬业务逻辑，要把接口层同步到“能编译”的闭环。

## 3.2 Phase1 冲突逐文件决策

### 取 upstream（theirs）

1. `src-tauri/src/shared/workspaces_core/connect.rs`
2. `src-tauri/src/shared/workspaces_core/crud_persistence.rs`
3. `src-tauri/src/shared/workspaces_core/helpers.rs`
4. `src-tauri/src/shared/workspaces_core/worktree.rs`
5. `src/features/app/orchestration/useThreadCodexOrchestration.ts`
6. `src/features/app/orchestration/useThreadOrchestration.ts`
7. `src/features/threads/hooks/useThreadCodexParams.test.tsx`
8. `src/features/threads/hooks/useThreadCodexParams.ts`
9. `src/features/threads/utils/threadCodexParamsSeed.test.ts`
10. `src/features/threads/utils/threadCodexParamsSeed.ts`

### 非 Phase1 冲突（先保留本地 or 延后）

- Git 组：
  - `src-tauri/src/shared/git_ui_core/commands.rs`
  - `src-tauri/src/shared/git_ui_core/tests.rs`
  - `src/features/git/hooks/usePullRequestReviewActions.ts`
- Settings/Mobile 组：
  - `src/features/settings/components/sections/SettingsSectionContainers.tsx`
  - `src/features/settings/hooks/useSettingsCodexSection.ts`
  - `src/features/settings/hooks/useSettingsDefaultModels.test.tsx`
  - `src/features/settings/hooks/useSettingsDefaultModels.ts`
  - `src/features/settings/hooks/useSettingsFeaturesSection.ts`
  - `src/features/settings/hooks/useSettingsGitSection.ts`
  - `src/features/settings/hooks/useSettingsServerSection.ts`
  - `src/features/settings/hooks/useSettingsViewOrchestration.ts`
- Docs/other：
  - `docs/codebase-map.md`
  - `docs/mobile-ios-cloudflare-blueprint.md`
  - `src-tauri/src/bin/codex_monitor_daemon/rpc/codex.rs`
  - `src-tauri/src/bin/codex_monitor_daemon/rpc/git.rs`
  - `src-tauri/src/bin/codex_monitor_daemon/rpc/workspace.rs`
  - `src-tauri/src/remote_backend/orbit_ws_transport.rs`
  - `src/features/models/utils/modelListResponse.ts`

## 3.3 Phase1 执行脚本（严格白名单）

```bash
# 1) 从稳定基线开新分支
git checkout custom/main
git checkout -b integration/phase1-workspace-thread-v3-20260223

# 2) 触发 merge（不提交）
git merge --no-commit --no-ff origin/main || true

# 3) 按决策处理冲突（示例：phase1文件取theirs）
git checkout --theirs src-tauri/src/shared/workspaces_core/connect.rs
git checkout --theirs src-tauri/src/shared/workspaces_core/crud_persistence.rs
git checkout --theirs src-tauri/src/shared/workspaces_core/helpers.rs
git checkout --theirs src-tauri/src/shared/workspaces_core/worktree.rs
git checkout --theirs src/features/app/orchestration/useThreadCodexOrchestration.ts
git checkout --theirs src/features/app/orchestration/useThreadOrchestration.ts
git checkout --theirs src/features/threads/hooks/useThreadCodexParams.test.tsx
git checkout --theirs src/features/threads/hooks/useThreadCodexParams.ts
git checkout --theirs src/features/threads/utils/threadCodexParamsSeed.test.ts
git checkout --theirs src/features/threads/utils/threadCodexParamsSeed.ts

# 4) 非phase1冲突先按策略手动选ours/theirs并逐文件add
# 禁止 git add -A

# 5) 白名单暂存（示例）
git add src/features/workspaces
git add src/features/threads
git add src-tauri/src/workspaces
git add src-tauri/src/shared/workspaces_core
git add src/features/app/orchestration/useThreadCodexOrchestration.ts
git add src/features/app/orchestration/useThreadOrchestration.ts
git add src/App.tsx src/types.ts src/services/tauri.ts src-tauri/src/lib.rs src-tauri/src/shared/mod.rs

# 6) 检查是否还有未解冲突
git diff --name-only --diff-filter=U
```

## 3.4 Phase1 编译错误“标准处置顺序”

按顺序修，避免来回震荡：

1. `TS2307` 路径别名缺失（`@/...`）
2. `types.ts` 导出不一致（接口新增/改名）
3. `services/tauri.ts` 方法签名漂移
4. `App.tsx` 传参接口漂移
5. Rust `shared/mod.rs` 未导出模块
6. Rust `lib.rs` tauri command 列表与实现不匹配
7. `workspaces_core` 子模块拆分/API 迁移

## 3.5 Phase1 验收门禁

```bash
npm run lint
npm run typecheck
npm run test -- src/features/threads src/features/workspaces
cd src-tauri && cargo check && cd ..
```

### Phase1 DoD

- 上述门禁全绿。
- `git diff --name-only --diff-filter=U` 为空。
- 形成单独提交：
  - `merge(phase1): sync workspace+thread domain with upstream`。

---

## 4. Phase 2：Git 全栈

## 4.1 范围

- `src/features/git/**`
- `src-tauri/src/git/**`
- `src-tauri/src/shared/git_*`、`src-tauri/src/shared/git_ui_core/**`
- Git 相关 app hooks 与 bridge/types 的必要联动

## 4.2 冲突优先处理文件

1. `src-tauri/src/shared/git_ui_core/commands.rs`
2. `src-tauri/src/shared/git_ui_core/tests.rs`
3. `src/features/git/hooks/usePullRequestReviewActions.ts`

## 4.3 验收门禁

```bash
npm run lint
npm run typecheck
npm run test -- src/features/git
cd src-tauri && cargo check && cd ..
```

---

## 5. Phase 3：Settings + Mobile + About

## 5.1 范围

- `src/features/settings/**`
- `src/features/mobile/**`
- `src/features/about/**`
- `src-tauri/src/settings/**`
- 必要的 shared/settings 与通知链路

## 5.2 冲突优先处理文件

1. `src/features/settings/components/sections/SettingsSectionContainers.tsx`
2. `src/features/settings/hooks/useSettingsCodexSection.ts`
3. `src/features/settings/hooks/useSettingsDefaultModels.test.tsx`
4. `src/features/settings/hooks/useSettingsDefaultModels.ts`
5. `src/features/settings/hooks/useSettingsFeaturesSection.ts`
6. `src/features/settings/hooks/useSettingsGitSection.ts`
7. `src/features/settings/hooks/useSettingsServerSection.ts`
8. `src/features/settings/hooks/useSettingsViewOrchestration.ts`

## 5.3 验收门禁

```bash
npm run lint
npm run typecheck
npm run test -- src/features/settings src/features/mobile
cd src-tauri && cargo check && cd ..
```

---

## 6. Phase 4：Cross-cutting/Docs/Tooling 收口

## 6.1 范围

- 文档、脚本、其余跨域代码
- `docs/*`, `scripts/*`, 以及剩余未吞并 upstream 变更

## 6.2 验收门禁

```bash
npm run lint
npm run typecheck
npm run test
cd src-tauri && cargo check && cd ..
```

---

## 7. 风险矩阵与熔断规则

## 7.1 风险矩阵

1. 风险：modify/delete 架构分叉
   - 表现：官方文件存在，本地路径被删
   - 缓解：先保可编译路径，阶段内补桥接，不做“立即删回”
2. 风险：契约漂移引发雪崩报错
   - 表现：TS/Rust 同时大面积签名不匹配
   - 缓解：优先修 `types + bridge + lib/shared mod`
3. 风险：index 污染
   - 表现：`.runtime-cache`、`.codex` 进入 staged
   - 缓解：禁止 `git add -A`，仅白名单 add

## 7.2 熔断条件

满足任一条立即停止本阶段并回滚：

1. 连续 2 轮修复后 `typecheck` 错误总量不降反升。
2. 出现 >3 个域外模块被迫重构才能过编译。
3. 再次出现索引污染。

回滚步骤：

```bash
git merge --abort || true
git reset --hard <phase-start-sha>
```

---

## 8. 交付与汇报模板（每阶段必须产出）

```text
## Phase X 完成情况
- 范围：
- 冲突文件（已处理）：
- 额外引入的契约依赖：
- 验证结果：
  - lint:
  - typecheck:
  - tests:
  - cargo check:
- 剩余分叉计数（origin/main...HEAD）：
- 下阶段入口：
```

---

## 9. 立即执行建议（下一步）

从 `custom/main` 新开：`integration/phase1-workspace-thread-v3-20260223`，严格按 Phase1 白名单推进，并在首轮冲突处理后立即跑 `typecheck + cargo check`，先验证契约层闭环。
