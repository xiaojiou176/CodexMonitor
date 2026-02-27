# 测试深度加强治理 Plan

## 0. 文档目标与愿景

本计划用于把当前仓库从“测试能跑通”升级到“真绿可证明（不是假绿）”。

核心愿景：

1. 所有关键功能在合并前有可验证证据，不依赖口头判断。
2. 任何“假绿”路径（可跳过、可绕过、误统计）都被系统性消除。
3. 测试、门禁、文档、环境治理形成可持续工程系统，而不是一次性运动。
4. 在不牺牲开发速度的前提下，通过并发编排提高治理效率。

---

## 1. 执行摘要（当前状态）

综合主审与 8 个并发子审计结论，当前仓库整体成熟度判断：

- 治理成熟度：`7.6 / 10`
- 状态定位：`强门禁编排 + 中等真实性 + 可维护性压力上升`

一句话判断：

“这不是一个裸奔仓库，但还不是‘可证明真绿’仓库。”

### Wave-9 最新进展（2026-02-27）

- 本波完成 `App` 周边可测性拆分契约验证与高缺口 hook/component 补测：
  - `src/features/app/utils/appUiHelpers.ts`
  - `src/features/app/utils/appUiHelpers.contract.test.ts`
  - `src/features/app/hooks/useGitHubPanelController.test.tsx`
  - `src/features/app/hooks/usePlanReadyActions.test.tsx`
  - `src/features/app/hooks/useRemoteThreadLiveConnection.wave9b.test.tsx`
  - `src/features/composer/components/ReviewInlinePrompt.test.tsx`
  - `src/features/workspaces/components/WorkspaceHome.test.tsx`
  - `src/features/settings/components/SettingsView.features-layout-shortcuts.test.tsx`
- 全量 strict 覆盖门禁结果已提升到：
  - `statements/lines: 70.08%`
  - `functions: 75.31%`
  - `branches: 77.86%`
- 判定：已稳定通过全量测试与 strict gate 执行链路，但距离 `80/80/80/80` 终态仍有约 `9.92pp / 4.69pp / 2.14pp` 差距，下一阶段需继续并发冲刺 `App.tsx` 与 `threadItems.ts` 高 ROI 缺口。

### Wave-10 最新进展（2026-02-27）

- 本波并发 6 路完成高 ROI 测试补强与 App 可测性拆分：
  - `src/utils/threadItems.test.ts`
  - `src/features/app/components/Sidebar.test.tsx`
  - `src/features/git/components/GitDiffPanel.test.tsx`
  - `src/features/files/components/FileTreePanel.test.tsx`
  - `src/features/workspaces/hooks/useWorkspaces.test.tsx`
  - `src/features/settings/components/SettingsView.test.tsx`
  - `src/features/settings/components/SettingsView.features-layout-shortcuts.test.tsx`
  - `src/features/settings/components/SettingsView.codex-overrides.test.tsx`
  - `src/features/app/utils/appUiHelpers.ts`
  - `src/features/app/utils/appUiHelpers.contract.test.ts`
  - `src/App.tsx`
- strict 覆盖门禁进一步提升到：
  - `statements/lines: 70.61%`
  - `functions: 75.80%`
  - `branches: 78.27%`
- 当前最大瓶颈仍是 `src/App.tsx`（未覆盖行约 3375），已确认为下一阶段主攻目标；其余高缺口文件已进入 70-80% 区间的持续抬升阶段。

### Wave-11 最新进展（2026-02-27）

- 本波继续并发补齐 0%/低覆盖 hook，并完成 `App.tsx` 第二轮可测性拆分：
  - `src/features/app/hooks/useAppMenuEvents.test.tsx`（新增）
  - `src/features/dictation/hooks/useDictation.test.tsx`（新增）
  - `src/features/app/hooks/useDictationController.test.tsx`（新增）
  - `src/features/mobile/hooks/useMobileServerSetup.test.tsx`（新增）
  - `src/features/app/utils/appUiHelpers.ts`（新增派生函数）
  - `src/features/app/utils/appUiHelpers.contract.test.ts`（新增 parity 契约）
  - `src/App.tsx`（替换为 helper 调用，行为不变）
- strict 覆盖门禁继续提升到：
  - `statements/lines: 71.52%`
  - `functions: 76.10%`
  - `branches: 78.36%`
- 距离 80 终态剩余差距：
  - `lines/statements: 8.48pp`
  - `functions: 3.90pp`
  - `branches: 1.64pp`
- 结论：增速稳定，但若要冲到 80，必须进入 `App.tsx` 主体结构化拆分与主流程集成测试并行攻坚阶段（仅靠局部补测已接近收益递减）。

---

## 2. 当前已做到什么（优势盘点）

### 2.1 门禁编排基础扎实

已有本地与 CI 双层门禁链路，且支持短测先行、长测并发、心跳日志：

- 本地：
  - `pre-commit` -> `precommit:orchestrated`
  - `pre-push` -> `preflight:orchestrated`
- CI：
  - lint/typecheck/test/coverage/mutation/e2e/security/rust tests 等分层 job

关键证据：

- `.husky/pre-commit:4`
- `.husky/pre-push:4`
- `scripts/precommit-orchestrated.mjs:140`
- `scripts/preflight-orchestrated.mjs:189`
- `.github/workflows/ci.yml:675`

### 2.2 防假绿机制已有基础设施

- assertion guard 已落地并进 CI。
- anti-placebo 脚本已存在。
- coverage gate 与 mutation gate 已接入。

关键证据：

- `package.json:60`
- `.github/workflows/ci.yml:207`
- `scripts/guard-placebo-assertions.mjs:64`
- `scripts/coverage-gate.mjs:13`
- `scripts/mutation-gate.mjs:15`

### 2.3 文档与环境治理已体系化起步

- env schema / matrix / audit 文档存在。
- doc drift 检查存在。
- env doctor / env rationalize 具备自动检查能力。

关键证据：

- `config/env.schema.json:1`
- `docs/reference/env-matrix.md`
- `docs/reference/env-audit-report.md`
- `scripts/preflight-doc-drift.mjs:21`
- `scripts/env-doctor.mjs:111`

### 2.4 前端基础交互与可访问性意识已建立

- 已有 smoke E2E。
- 已覆盖部分按钮可见性、可点击与键盘交互测试。
- Playwright trace/screenshot 与 artifact 上传已有基础。

关键证据：

- `e2e/smoke.spec.ts:14`
- `src/features/layout/components/PanelTabs.test.tsx:13`
- `playwright.config.ts:22`
- `.github/workflows/ci.yml:525`

---

## 3. 当前没做到什么（关键缺口）

以下缺口是从“真绿可证明”视角定义，不是“有没有测试”的浅层视角。

### 3.1 P0 级（必须先堵住）

1. 覆盖率“全局”并非全仓，存在统计假象。
   - 目前 include 范围主要是关键目录，不是 `src/**`。
   - 证据：`scripts/coverage-gate.mjs:76`、`scripts/coverage-gate.mjs:97`

2. mutation 阶段在 CI 中显式跳过 assertion guard。
   - 降低“低质量断言”防线强度。
   - 证据：`.github/workflows/ci.yml:440`、`scripts/mutation-gate.mjs:22`

3. real integration 可整体 skip 且仍是绿状态。
   - 有条件缺失时没有失败，导致“真链路未验证也绿”。
   - 证据：`.github/workflows/real-integration.yml:54`、`scripts/real-llm-smoke.mjs:625`

4. Rust 本地 gate 只 check 不 test。
   - 本地可能“编译绿、行为红”。
   - 证据：`package.json:82`、`package.json:83`

5. env-count-check 与 schema 结构不一致。
   - 读取 `schema.properties`，而 schema 实为 `variables[]`。
   - 证据：`.pre-commit-config.yaml:244`、`config/env.schema.json:10`

### 3.2 P1 级（真绿深度不足）

1. E2E 关键业务旅程不足，且 smoke 存在前端 mock 注入。
   - 证据：`e2e/smoke.spec.ts:98`、`e2e/smoke.spec.ts:103`

2. 前端缺视觉回归与 a11y 自动化 gate。
   - 证据：`package.json:6`、`package.json:117`

3. 浏览器矩阵不足（主要 Chromium）。
   - 证据：`playwright.config.ts:24`、`playwright.config.ts:26`

4. 文档与实际门禁存在口径漂移。
   - 证据：`README.md:305`、`src/AGENTS.md:59`、`package.json:49`

5. Rust 共享核心仍有关键无测模块。
   - 证据：`src-tauri/src/shared/git_core.rs:23`、`src-tauri/src/shared/process_core.rs:22`

### 3.3 P2 级（长期工程能力）

1. 超大文件导致维护风险和回归风险增高。
   - 代表文件：
   - `src/App.tsx`
   - `src-tauri/src/bin/codex_monitor_daemon.rs`
   - `src/features/threads/hooks/useThreadsReducer.ts`

2. release 与 CI 的部分策略口径尚未完全统一（例如依赖审计口径）。
   - 证据：`.github/workflows/ci.yml:548`、`.github/workflows/release.yml:302`

---

## 4. 目标态定义（什么叫“完美”）

本仓库“完美”定义不是“0 bug 幻觉”，而是以下 6 条同时成立：

1. **可证明**：每个关键结论都有机器可审计证据（日志、报告、工件、门禁状态）。
2. **可阻断**：关键风险路径无 silent skip、无隐性 bypass、无统计错觉。
3. **可复现**：本地、CI、release 的结论一致，环境口径一致。
4. **可追溯**：失败可定位到具体阶段、具体规则、具体变更。
5. **可扩展**：新增模块可低成本接入同一治理体系。
6. **可持续**：规则与文档同构，不靠个人记忆维持。

---

## 5. 分阶段实施路线图

## Phase 1（第 1-2 周）：P0 假绿封口战

目标：先把“能绕过去的绿”变成“绕不过去的绿”。

任务：

1. coverage gate 改为“双层门禁”：
   - 全仓 global（`src/**/*.{ts,tsx}`）>= 80
   - 关键域 strict（threads/services）>= 95

2. 移除 mutation job 的 assertion guard 跳过开关。

3. 修复 `env-count-check` 与 schema 字段不匹配问题。

4. pre-push 增加 Rust 行为测试（至少 `cargo test --lib --bins`）。

5. 把关键路径日志守卫从 warn 升级为 fail（至少在 CI 侧）。

成功标准（DoD）：

- 无 `MUTATION_SKIP_ASSERTION_GUARD=true` 配置。
- coverage gate 报告明确包含全仓统计与关键域统计。
- env-count-check 能真实失败并阻断错误。
- pre-push 出现 Rust tests 执行日志。
- CI 中关键路径日志守卫为阻断态。

---

## Phase 2（第 3-5 周）：真实链路补强战

目标：让“关键 workflow 真跑过”成为合并前可证事实。

任务：

1. 新增至少 3 条关键旅程 E2E（禁止 mock Tauri invoke）：
   - 添加工作区 -> 连接 -> 创建/恢复会话
   - 审批/中断流程
   - worktree 创建/切换流程

2. 浏览器矩阵扩到 Chromium + WebKit（最小可行）。

3. real integration 分层：
   - 必跑：最小真链路 smoke（不可 skip）
   - 可选：深度外部依赖验证（可按环境触发）

4. 统一 Playwright 失败证据策略：
   - CI / release / real-integration 统一上传 trace、screenshot、report。

成功标准（DoD）：

- PR 必过关键旅程 smoke（不可跳过）。
- main 分支有跨浏览器最小矩阵结果。
- 每次 E2E 失败都可在 artifact 中复盘。
- `run_external=false` 不再等同于“整体验证完成”。

---

## Phase 3（第 6-8 周）：前端“按钮可用 + UI不崩”体系战

目标：形成“交互 + 视觉 + 可访问性”三位一体前端质量门禁。

任务：

1. 引入 a11y 自动化 gate（axe 或 lighthouse-ci）。

2. 引入视觉回归 gate（二选一）：
   - Playwright screenshot baseline（先落地）
   - 或 Chromatic/Percy（外部服务）

3. 新增“交互元素巡检”E2E：
   - 关键页面遍历按钮/可交互元素
   - 断言 visible/enabled/focusable + Enter/Space 激活
   - 避免 `evaluate(click)` 绕过真实可点击性

成功标准（DoD）：

- 视觉 diff / a11y 违规能阻断合并。
- 关键页面交互元素巡检稳定运行。
- 前端“按钮无反应”类问题在 CI 可稳定复现并被阻断。

---

## Phase 4（第 9-12 周）：文档同构与可维护性治理战

目标：把治理系统从“能跑”升级为“长期不退化”。

任务：

1. 对齐 README / AGENTS / CLAUDE 与真实 gate 命令。

2. 建立“治理状态看板”产物：
   - coverage、mutation、live、doc-drift、a11y、visual 汇总。

3. 拆分超大文件（优先：
   - `src/App.tsx`
   - `src-tauri/src/bin/codex_monitor_daemon.rs`
   - `src/features/threads/hooks/useThreadsReducer.ts`
   ）

4. 统一 CI 与 release 审计策略口径（含 `npm audit` 策略）。

成功标准（DoD）：

- 文档命令与脚本命令零漂移。
- 治理报告可一页判断“是否真绿”。
- 关键超大文件完成第一阶段拆分，复杂度下降有量化证据。

---

## 6. 并发执行编排（SubAgent 并发提效）

每个 Phase 可采用“并发批次”执行，减少串行等待。

### 批次模板（推荐）

Batch A（并发 4）：

1. CI/Gate 代理：改 workflows 与 gate 脚本。
2. 测试体系代理：补 E2E/集成/Rust tests。
3. 前端质量代理：a11y/visual/交互巡检。
4. 文档治理代理：README/AGENTS/报告模板同步。

Batch B（并发 3）：

1. 安全与环境代理：env/schema/secret/audit 策略对齐。
2. 可维护性代理：超大文件拆分与回归测试。
3. 评估代理：治理得分、趋势报告、回归对比。

并发规则：

1. 同一文件禁止并发写。
2. 拆分前先声明 ownership（文件级责任）。
3. 每批次结束统一回归：lint/typecheck/tests/coverage/mutation/ci dry run。

---

## 7. 外部能力引入建议（可选）

如果团队接受引入外部 Repo/服务，优先级如下：

1. 视觉回归平台：
   - `Chromatic`（Storybook 生态强）
   - `Percy`（跨框架成熟）

2. 前端 a11y / 性能门禁：
   - `axe-core`
   - `lighthouse-ci`

3. 变异测试可视化平台（若需）：
   - 使用 Stryker 报告聚合到 CI artifact + dashboard

选择原则：

1. 先引入低侵入、可快速见效的工具。
2. 所有外部依赖必须纳入成本与可维护性评估。
3. 任何引入要有 fallback，不把关键门禁绑死在单一 SaaS。

---

## 8. 最终验收标准（终态 Gate）

当且仅当以下条件同时满足，才判定“真绿治理体系上线成功”：

1. P0 缺口全部关闭（覆盖率语义、mutation 跳过、real skip、Rust 本地 test、env-count-check）。
2. 关键业务旅程 E2E 在 PR 必跑且不可跳过。
3. UI 具备视觉与 a11y 双门禁。
4. CI / release / 文档策略零漂移。
5. 失败可复盘证据完整（trace/screenshot/report/log）。
6. 连续 4 周无“假绿导致的线上回归”事故。

---

## 9. 决策点（需你拍板）

以下是需要你明确选择的决策点。若不拍板，后续执行会卡在分岔路径。

### D1. 真实集成门禁强度

Context：
当前 real-integration 存在 skip 即绿路径。我们需要定义“没有真实外部验证时是否允许合并”。

选项：

1. `严格模式（推荐）`：main 分支必须跑最小真链路，不满足则阻断。
2. `折中模式`：PR 允许 skip，但 main/release 必须真链路通过。
3. `宽松模式`：继续可选，仅做报告不阻断。

### D2. 视觉回归方案

Context：
要建立 UI 崩坏防线，需要决定是本地基线方案还是 SaaS 方案。

选项：

1. `Chromatic`（推荐，Storybook 体系成熟）
2. `Playwright screenshot baseline`（纯内建、无外部付费）
3. `Percy`

### D3. 浏览器矩阵最低标准

Context：
目前主要 Chromium，需要确定最低跨浏览器保证。

选项：

1. `Chromium + WebKit（推荐）`
2. `Chromium + Firefox`
3. `Chromium only`（保持现状，不推荐）

### D4. Rust 本地门禁强度

Context：
当前 pre-push 只 `cargo check`。提升后会增加本地等待时间。

选项：

1. `pre-push 强制 cargo test（推荐）`
2. `仅 CI 强制，本地维持 check`
3. `按变更范围触发 Rust tests（折中）`

### D5. 外部工具引入策略

Context：
你明确表示不排斥引入外部 Repo/能力，需要决定预算和依赖策略。

选项：

1. `积极引入（推荐）`：视觉 + a11y + 报表工具逐步引入。
2. `保守引入`：只引一个（先视觉或先 a11y）。
3. `纯内建`：全部基于现有栈自行实现。

---

## 9.1 决策结果（已拍板，2026-02-27）

以下决策由 Owner 于 `2026-02-27` 正式拍板，作为本 Plan 的唯一执行基线：

1. `D1 真实集成门禁强度`：`A 严格模式`
   - 规则：`main` 分支必须通过“最小真链路”验证，否则禁止合并/发布。

2. `D2 视觉回归方案`：`A Chromatic`
   - 规则：前端视觉回归以 Chromatic 为主门禁，视觉变化需显式审阅。

3. `D3 浏览器矩阵最低标准`：`A Chromium + WebKit`
   - 规则：关键旅程至少在 Chromium 与 WebKit 两套引擎通过。

4. `D4 Rust 本地门禁强度`：`A pre-push 强制 cargo test`
   - 规则：本地 pre-push 必跑 Rust 行为测试，禁止仅靠 CI 兜底。

5. `D5 外部工具引入策略`：`A 积极引入`
   - 规则：按 Phase 逐步引入外部能力（Chromatic/a11y/报表），以“可验证收益”为准入标准。

执行约束：

1. 本节决策优先级高于文档内其他“可选项”描述。
2. 后续若需变更，必须新增“决策变更记录”（含变更原因、影响面、回滚方案）。

---

## 9.2 决策变更记录（预留）

当前为空。首次变更时按以下模板追加：

1. 变更日期：
2. 变更项（D1-D5）：
3. 原决策 -> 新决策：
4. 变更原因：
5. 影响评估：
6. 回滚条件：

---

## 10. 立即执行清单（拍板后 48 小时内可启动）

1. 建立治理执行分支与任务看板。
2. 按 Phase 1 分配并发子任务 ownership。
3. 开始 P0 修复并跑全套回归。
4. 发布第一版“真绿周报”（包含当前基线与已关闭缺口）。

---

## 10.1 执行前基线快照（必须先记录）

为保证“治理改进可量化”，第一天必须固化以下基线数据到 `docs/reference/`（或 `.runtime-cache/test_output/`）：

1. 覆盖率基线：
   - `npm run test:coverage:gate`
   - 保存 `coverage-summary.json` 与 gate 输出（含 global/critical）。

2. 变异测试基线：
   - `npm run test:mutation:gate`
   - 保存 mutation score、targets、是否 skip assertion guard。

3. 真链路基线：
   - `npm run test:live:preflight`
   - 记录 run_any、run_external、run_llm、skip reason。

4. 前端交互基线：
   - `npm run test:e2e:smoke`
   - 记录通过率、失败用例、trace artifact 是否完整。

5. Rust 基线：
   - `npm run check:rust`
   - 额外执行 `cargo test --manifest-path src-tauri/Cargo.toml --lib --bins`
   - 记录本地耗时与失败分布。

---

## 10.2 统一 KPI（用于每周治理周报）

每周必须输出一份治理周报，最少包含以下 KPI：

1. Gate 通过率：
   - pre-commit 通过率
   - pre-push 通过率
   - CI 主流程通过率

2. 假绿风险 KPI：
   - skip 即绿次数（real integration）
   - bypass 开关触发次数（如 guard bypass）
   - coverage global 与 critical 差异波动

3. 质量真实性 KPI：
   - 关键旅程 E2E 通过率
   - 可复盘失败比例（有 trace/screenshot/report）
   - 线上回归中“测试未覆盖”占比

4. 工程可持续 KPI：
   - 超大文件数量与行数变化
   - 文档漂移阻断次数
   - 文档-脚本一致性抽检通过率

---

## 10.3 Phase 1 详细工作包（文件级）

### WP1-1 覆盖率语义修正（P0）

目标：

- 让 global 覆盖率变成“真全仓统计”，避免局部统计伪装成全局。

拟修改文件：

- `scripts/coverage-gate.mjs`
- `package.json`（如需新增脚本）
- `README.md`、`src/AGENTS.md`、`src/CLAUDE.md`（同步命令口径）

验收证据：

1. gate 输出同时显示：
   - `global(src/**)`
   - `critical(threads/services)`
2. 任意改动非 critical 代码造成 coverage 降低时，global gate 可正确失败。

---

### WP1-2 移除 mutation 阶段 assertion guard 跳过（P0）

目标：

- 保证 mutation 运行期间同样受断言质量门禁约束。

拟修改文件：

- `.github/workflows/ci.yml`
- `.github/workflows/mutation-weekly.yml`
- `scripts/mutation-gate.mjs`（如需日志增强）

验收证据：

1. CI 日志中不再出现 `MUTATION_SKIP_ASSERTION_GUARD=true`。
2. assertion guard 失败会阻断 mutation pipeline。

---

### WP1-3 修复 env-count-check（P0）

目标：

- 消除“检查存在但实际无效”的假门禁。

拟修改文件：

- `.pre-commit-config.yaml`
- （可选）新增 `scripts/check-env-count.mjs` 取代 inline node one-liner

验收证据：

1. 通过构造 `.env.example` 少字段场景，钩子必须失败。
2. schema 改动后检查逻辑仍可工作（避免写死路径结构）。

---

### WP1-4 pre-push 增加 Rust 行为测试（P0）

目标：

- 把 Rust 行为正确性从“仅 CI 兜底”升级为“本地先拦截”。

拟修改文件：

- `scripts/preflight-orchestrated.mjs`
- `package.json`（增加轻量 rust test 脚本）
- `README.md`（执行时长与策略说明）

验收证据：

1. pre-push 日志出现 rust test 阶段。
2. 人为引入 Rust 行为错误后，可在本地 pre-push 失败。

---

### WP1-5 关键日志守卫升级为 fail（P0）

目标：

- 让关键 catch/外部请求无结构化日志不再“警告通过”。

拟修改文件：

- `scripts/check-critical-path-logging.mjs`
- `.github/workflows/ci.yml`
- `README.md`（日志规范与失败说明）

验收证据：

1. 默认模式为 fail（至少 CI）。
2. 缺失关键日志字段能阻断 PR。

---

## 10.4 Phase 2 详细工作包（关键旅程真链路）

### WP2-1 关键旅程 E2E 三条主线

建议用例（最小版本）：

1. `workspace_lifecycle.spec.ts`
   - 添加 workspace -> 连接 -> 拉取线程列表 -> 恢复线程
2. `approval_interrupt.spec.ts`
   - 触发审批 -> 执行批准/拒绝 -> 中断流程 -> 状态回写
3. `worktree_flow.spec.ts`
   - 创建 worktree -> 切换 -> 状态校验 -> 清理

关键约束：

1. 禁止用前端注入 mock 代替真实链路。
2. 允许使用测试数据隔离，但不允许绕过关键 IPC 路径。

拟修改文件：

- `e2e/*.spec.ts`
- `playwright.config.ts`
- `.github/workflows/ci.yml`
- `.github/workflows/release.yml`

验收证据：

1. PR 必跑关键旅程 smoke。
2. 每个失败用例都有 trace/screenshot/report。

---

### WP2-2 浏览器矩阵升级

建议：

- PR：Chromium 必跑 + WebKit 关键旅程 smoke
- main/release：Chromium + WebKit 全关键旅程

验收证据：

1. CI summary 能区分各浏览器通过率。
2. WebKit 专属失败可独立定位。

---

### WP2-3 real integration 分层门禁化

目标：

- 让“可选深度验证”与“必跑最小真链路”边界清晰。

设计：

1. `必跑层`：
   - 不依赖外部重资源
   - 必须为 blocking check
2. `扩展层`：
   - 外部服务、长耗时、成本更高
   - 可按分支/时间策略执行

验收证据：

1. main/release 不存在“核心真链路全 skipped 仍绿”。
2. skip 必须带结构化原因与显式状态标记。

---

## 10.5 Phase 3 详细工作包（UI 完整性）

### WP3-1 a11y gate

推荐最小落地：

1. 关键页面（主页、侧栏、终端区）跑 axe。
2. 违规级别中 `serious/critical` 阻断，`minor` 警告。

拟修改文件：

- 新增 `scripts/a11y-gate.*`
- `.github/workflows/ci.yml`
- `package.json`

验收证据：

1. a11y 报告作为 artifact 上传。
2. serious/critical 问题可阻断合并。

---

### WP3-2 视觉回归 gate

两条可执行路线（拍板后选一）：

1. 内建：Playwright screenshot baseline
2. SaaS：Chromatic / Percy

统一要求：

1. 必须支持 PR diff 展示。
2. 必须支持失败追溯到组件/页面。
3. 必须形成“可审批”机制（视觉变更不是 silent 通过）。

验收证据：

1. 每个 PR 可见视觉差异摘要。
2. 未审批的视觉差异无法合并（按你拍板强度执行）。

---

### WP3-3 交互元素巡检

目标：

- 系统性降低“按钮无响应、可点但无效、键盘不可达”等问题漏网。

最低检查项：

1. 可见（visible）
2. 可用（enabled）
3. 可聚焦（focusable）
4. Click 激活有效
5. Enter/Space 激活有效

验收证据：

1. 巡检结果按页面输出通过率。
2. 失败点可定位到 selector + route + trace。

---

## 10.6 Phase 4 详细工作包（可持续治理）

### WP4-1 文档同构工程

目标：

- 规则文本与执行现实完全一致。

范围：

- `README.md`
- `AGENTS.md`
- `src/AGENTS.md`
- `src/CLAUDE.md`
- `src-tauri/AGENTS.md`

验收证据：

1. 命令抽检：文档中每个命令都可执行且与当前脚本一致。
2. 文档漂移检查覆盖新增门禁项。

---

### WP4-2 治理状态看板

建议输出文件：

- `docs/reference/testing-governance-dashboard.md`
- 附件：
  - coverage latest
  - mutation latest
  - live preflight latest
  - e2e matrix latest
  - a11y/visual latest

验收证据：

1. 单文档可读出“当前是否真绿”。
2. 可对比上周趋势并定位退化来源。

---

### WP4-3 超大文件治理（结构性风险收敛）

目标：

- 降低复杂度，减少改动爆炸半径。

第一批拆分目标：

1. `src/App.tsx`
2. `src-tauri/src/bin/codex_monitor_daemon.rs`
3. `src/features/threads/hooks/useThreadsReducer.ts`

验收证据：

1. 文件行数下降到阶段目标（由你拍板阈值）。
2. 拆分后回归测试全绿，行为等价。

---

## 10.7 并发实施蓝图（可直接调度 SubAgent）

### Wave 1（P0 封口，建议并发 6）

1. Agent-A：coverage gate 语义修正
2. Agent-B：mutation skip 移除
3. Agent-C：env-count-check 修复
4. Agent-D：Rust pre-push tests 接入
5. Agent-E：critical logging fail 化
6. Agent-F：文档口径同步

汇合验收：

1. 跑 `npm run precommit:orchestrated`
2. 跑 `npm run preflight:orchestrated`
3. 跑 CI dry-run 等效任务（本地可执行子集）

### Wave 2（真链路，建议并发 5）

1. Agent-A：关键旅程 E2E-1
2. Agent-B：关键旅程 E2E-2
3. Agent-C：关键旅程 E2E-3
4. Agent-D：浏览器矩阵与 artifacts
5. Agent-E：real integration 分层

### Wave 3（UI 完整性，建议并发 4）

1. Agent-A：a11y gate
2. Agent-B：视觉回归 gate
3. Agent-C：交互巡检
4. Agent-D：文档与门禁绑定

### Wave 4（可持续化，建议并发 4）

1. Agent-A：治理看板
2. Agent-B：文档同构
3. Agent-C：App.tsx 拆分
4. Agent-D：daemon/reducer 拆分

---

## 10.8 风险、缓解与回滚策略

### 风险 R1：门禁增强导致 CI 时长明显上升

缓解：

1. PR 跑最小关键集，main/release 跑全量。
2. 引入并行分片与缓存。
3. 给长测增加心跳与超时策略。

回滚：

1. 降级非核心 gate 到 warning（限时 1 周）。
2. 保留核心阻断项不回滚（coverage/assertion/关键旅程 smoke）。

### 风险 R2：视觉回归噪声过高

缓解：

1. 固化字体、时区、动画、随机种子。
2. 先在关键页面试点，再全量推广。

回滚：

1. 暂时把视觉 gate 从 blocking 调整为 required review。

### 风险 R3：真实集成外部依赖不稳定

缓解：

1. 分层：必跑最小真链路 + 可选深度链路。
2. 失败分类（代码失败 vs 网络波动）并限制重试次数。

回滚：

1. 主链路保留最小真链路阻断，外部深度链路转夜间任务。

---

## 10.9 验收证据模板（每个 PR 必须填写）

建议新增 `PR_TEMPLATE` 章节（可复用以下模板）：

1. 变更范围：
   - 影响模块：
   - 风险级别：

2. 测试证据：
   - 单测：
   - E2E：
   - 覆盖率：
   - 变异测试：
   - Rust：

3. 真链路证据：
   - live preflight 结果：
   - run_external / run_llm 状态：
   - skip reason（若有）：

4. UI 证据（如涉及前端）：
   - a11y 报告：
   - 视觉 diff：
   - 交互巡检：

5. 文档一致性：
   - 已更新文档：
   - 无文档影响说明：

---

## 10.10 阶段退出条件（Exit Criteria）

每个 Phase 结束必须满足“退出条件”，否则禁止进入下一阶段：

1. 任务完成率 >= 90%
2. 对应 Phase 的 P0/P1 风险项关闭率 >= 90%
3. 回归套件连续 5 次通过率 >= 95%
4. 文档更新完成并通过 doc-drift 检查
5. 周报已产出并有趋势对比

---

## 11. 本计划的证据来源（审计输入）

本计划来自“主审 + 8 个并发子审计”的交叉验收结果，重点证据包含：

- `scripts/coverage-gate.mjs:76`
- `scripts/mutation-gate.mjs:22`
- `.github/workflows/ci.yml:440`
- `.github/workflows/real-integration.yml:54`
- `package.json:82`
- `.pre-commit-config.yaml:244`
- `config/env.schema.json:10`
- `e2e/smoke.spec.ts:98`
- `README.md:305`
- `src/AGENTS.md:59`

---

## 12. 结语

“完美”不是把风险说成不存在，而是把风险变成可测、可证、可阻断、可持续治理。

从当前仓库基础看，我们离“真绿可证明”已经不远。  
下一步关键不在于再加多少工具，而在于先封住 P0 假绿口，再把真实性验证做成默认路径。

这份 Plan 既是技术路线，也是执行契约。拍板后即可进入并发实施。

---

## 13. 执行状态快照（2026-02-27）

以下为本轮并发实施后的状态（主审验收）：

### 13.1 已完成波次

1. Wave 1（P0 假绿封口）  
- ✅ 完成：coverage 语义修正（global + critical 双层）  
- ✅ 完成：移除 mutation 跳过 assertion guard  
- ✅ 完成：env-count-check 修复为读取 `variables[]`  
- ✅ 完成：pre-push 强制 Rust `cargo test --lib --bins`  
- ✅ 完成：critical logging guard 默认 fail（CI 阻断）  
- ✅ 完成：README/AGENTS/模块文档口径同步

### 13.1A Coverage 终态策略（default + strict 并存）

已落地最终策略（`2026-02-27`）：

1. `default`（`npm run test:coverage:gate`）  
- 目标：可持续治理，不允许基线回退。  
- 规则：默认以 baseline 作为 required（防回退）；仅当显式设置 `COVERAGE_TARGET_*`/`COVERAGE_MIN_*` 时，按 `required = max(explicit_target, baseline)` 提升门槛。baseline 仅上升不下降。  
- 用途：日常门禁与持续演进。

2. `strict`（`npm run test:coverage:gate:strict`）  
- 目标：提供固定强校准口径。  
- 规则：全局四指标按固定 `>=80` 判断，不读取 baseline。  
- 用途：统一“绝对 80 线”核验与回归对比。

3. 报告可区分模式  
- gate 输出与 `latest.json` 均包含 `gateMode`，明确标识 `default` 或 `strict`，避免口径混淆。

2. Wave 2（关键真链路）  
- ✅ 完成：新增 3 条关键旅程 E2E（workspace/approval/worktree）  
- ✅ 完成：浏览器矩阵接入 Chromium + WebKit  
- ✅ 完成：CI/release E2E 工件上传统一  
- ✅ 完成：real-integration 在 main 严格门禁（无 silent skip 即绿）

3. Wave 3（UI 完整性）  
- ✅ 完成：新增 a11y gate（critical 阻断，serious 报告）  
- ✅ 完成：新增 interaction sweep（visible/enabled/focusable + click/Enter/Space）  
- ✅ 完成：CI/release 接入 a11y 与 interaction-sweep 质量门  
- ✅ 完成：Chromatic workflow 接入（`.github/workflows/chromatic.yml`）  
- ✅ 完成：Storybook/Chromatic 基础配置与示例 Story 落地

4. Wave 4（可持续化）  
- ✅ 完成：治理看板生成脚本与单页看板文档  
- ✅ 完成：`App.tsx` 第一阶段拆分（提取 UI helper）  
- ✅ 完成：`useThreadsReducer.ts` 第一阶段拆分（提取 reducer helper）  
- ✅ 完成：`codex_monitor_daemon.rs` 第一阶段拆分（提取 meta 模块）

### 13.2 仍需持续治理的“债务型”事项

以下不是“任务未执行”，而是执行后暴露出的真实质量债务，需要持续迭代：

1. 全仓 global coverage 未达 80（当前约 51.68）  
- 说明：这是语义修正后真实暴露，不是脚本故障。  

2. mutation latest 报告产物存在缺口（看板显示 missing）  
- 说明：需要在日常/CI 跑批里稳定产出 latest.json。  

3. Storybook 在仓库路径含 `[]` 时，直接 `npx storybook build --config-dir .storybook` 仍有上游识别缺陷  
- 说明：已通过脚本绕行（绝对 config-dir + 临时无特殊字符路径）接入，不阻塞 Chromatic 流程。

### 13.2A 最小真链路“不可 silent skip 即绿”落地规则（2026-02-27）

本规则作为 D1 严格模式的执行细则，要求 CI 与编排脚本同时满足：

1. `.github/workflows/real-integration.yml`
- 对 `main`、`workflow_dispatch`、`schedule` 触发执行严格门禁。
- 严格门禁必须校验：
  - `runAny=true`
  - `status=passed`
  - `checks[]` 中至少 1 条 `status=ok`
- 若不满足任一条件，工作流必须失败，不允许“跳过但绿”。

2. `scripts/preflight-orchestrated.mjs`
- 增加 `PREFLIGHT_REQUIRE_LIVE` 严格校验开关（CI 默认开启）。
- 当开关开启时，必须读取 `.runtime-cache/test_output/live-preflight/latest.json` 并执行同等判定：
  - `runAny=true`
  - `status=passed`
  - `ok` 检查数 >= 1
- 判定失败时必须直接中断 preflight。

3. 审计证据要求
- 必须保留并可追溯：
  - `live-preflight/latest.json`
  - GitHub Step Summary 中的 strict gate 结果
  - 失败时的 missing/failed prerequisites 列表
- 无上述证据视为“未完成真链路验证”。

### 13.3 当前验收口径

1. 结构性任务：已完成  
2. 门禁接线：已完成  
3. 可执行验证：lint/typecheck/check:rust/workflow-yaml/新增 E2E 均已通过  
4. 债务项：已被明确暴露并纳入后续治理待办

### 13.4 Coverage 冲刺 Wave-1（2026-02-27）

本波次目标：优先补齐高 ROI 测试面，验证“新增测试可稳定运行 + 不引入假绿”。

1. 本波次新增/增强测试文件
- `src/features/app/components/MainHeader.test.tsx`（新增，9 tests）
- `src/features/files/components/FileTreePanel.test.tsx`（新增，5 tests）
- `src/features/git/components/GitDiffViewer.test.tsx`（新增，5 tests）
- `src/features/workspaces/hooks/useWorkspaces.test.tsx`（增强到 26 tests）

2. 关键覆盖提升（单文件可审计）
- `MainHeader.tsx`：约 `73.27% -> 86.63%`（Statements/Lines），分支覆盖显著提升。
- `FileTreePanel.tsx`：从低覆盖提升到可用区间，覆盖加载态/空态/折叠筛选/错误提示核心分支。
- `GitDiffViewer.tsx`：新增真实渲染+交互+异常路径测试，覆盖提升到高可用区间（Statements/Lines > 80%）。
- `useWorkspaces.ts`：函数覆盖接近完整，语句覆盖显著提升（约 `49.15% -> 76.65%`）。

3. 本波次回归结果
- 新增/增强测试文件全部单测通过。
- 全量严格门禁仍未达标：`global coverage 56.73% / 75.90% / 69.83% / 56.73%`（S/B/F/L，阈值均为 80%）。
- 结论：本波次已确认“增量有效”，但距离 strict 80% 仍有系统性差距，需要继续并发波次推进。

4. Wave-2 优先级（并发执行）
- `src/features/settings/components/SettingsView.tsx`
- `src/features/app/components/Sidebar.tsx`
- `src/features/git/components/GitDiffPanelModeContent.tsx`
- `src/features/composer/components/ComposerInput.tsx`
- `src/features/app/components/OpenAppMenu.tsx`

### 13.5 Coverage 冲刺 Wave-2（2026-02-27）

本波次目标：并发攻坚 5 个高未覆盖文件，验证“单文件提升可转化为全量 strict 提升”。

1. 本波次新增/增强测试文件
- `src/features/app/components/Sidebar.test.tsx`（增强）
- `src/features/settings/components/SettingsView.test.tsx`（增强）
- `src/features/settings/components/SettingsView.features-layout-shortcuts.test.tsx`（增强）
- `src/features/git/components/GitDiffPanelModeContent.test.tsx`（新增）
- `src/features/composer/components/ComposerInput.behavior.test.tsx`（新增）
- `src/features/app/components/OpenAppMenu.test.tsx`（新增）

2. 单文件覆盖收益（关键样本）
- `Sidebar.tsx`: `74.74% -> 83.44%`（Lines/Statements）
- `SettingsView.tsx`: `64.88% -> 70.23%`（Lines/Statements），Branches 提升到 `84.10%`
- `GitDiffPanelModeContent.tsx`: 从低覆盖提升到 `95.08%`（Lines/Statements）
- `ComposerInput.tsx`: 从 `49.03%` 提升到 `89.51%`（Lines/Statements），Branches 到 `80.32%`
- `OpenAppMenu.tsx`: 从 `4.64%` 提升到 `89.02%`（Lines/Statements）

3. 全量 strict gate 结果
- `npm run test:coverage:gate:strict`
- 全量测试：`150 files / 1428 tests` 全通过。
- 覆盖率提升到：
  - Statements `59.05%`
  - Lines `59.05%`
  - Functions `70.94%`
  - Branches `76.63%`
- 结论：Wave-2 已证明并发补测路径有效，但距离 `80/80/80/80` 仍存在系统缺口。

4. Wave-3 聚焦（继续并发）
- 优先 0% 大文件且可测入口：
  - `src/features/app/hooks/useGitCommitController.ts`
  - `src/features/app/components/CommandPalette.tsx`
  - `src/features/app/components/AppLayout.tsx`
  - `src/features/app/components/LaunchScriptButton.tsx`
  - `src/features/git/hooks/useGitActions.ts`
- 同步评估超大文件策略：
  - `src/App.tsx`（3432 行，0%）需拆分+契约测试协同推进。

### 13.6 Coverage 冲刺 Wave-3（2026-02-27）

本波次目标：继续并发清理 0% 高体量入口文件，优先覆盖可独立验证的 Hook/组件。

1. 本波次新增测试文件
- `src/features/app/hooks/useGitCommitController.test.tsx`
- `src/features/app/components/CommandPalette.test.tsx`
- `src/features/app/components/AppLayout.test.tsx`
- `src/features/app/components/LaunchScriptButton.test.tsx`
- `src/features/git/hooks/useGitActions.test.tsx`

2. 单文件覆盖样本（Wave-3 结果）
- `useGitCommitController.ts`：Statements `96.19%` / Branches `85.54%`
- `CommandPalette.tsx`：Statements `100%` / Branches `97.82%`
- `AppLayout.tsx`：Statements/Branches/Functions/Lines `100%`
- `LaunchScriptButton.tsx`：Statements `95.77%` / Branches `89.47%`
- `useGitActions.ts`：Statements `94.64%` / Branches `90.56%`

3. 全量 strict gate 结果
- `npm run test:coverage:gate:strict`
- 全量测试：`155 files / 1473 tests` 全通过。
- 覆盖率提升到：
  - Statements `60.63%`
  - Lines `60.63%`
  - Functions `71.11%`
  - Branches `76.92%`

4. 差距与下一波策略
- 与 strict 80 的差距仍主要来自：
  - `src/App.tsx`（3432 行，0%）
  - `src/types.ts`、`layoutNodes/types.ts` 等低可执行价值文件
  - 多个 0% 的 orchestration/hook 入口文件
- Wave-4 将并发推进：
- `useThreadOrchestration.ts`
- `useTerminalSession.ts`
- `DebugPanel.tsx`
- `buildPrimaryNodes.tsx`
- `DesktopLayout.tsx`

### 13.7 Coverage 冲刺 Wave-4（2026-02-27）

本波次目标：并发推进 5 个高未覆盖入口（含 4 个 0% 文件），继续抬升 strict 全局覆盖。

1. 本波次新增测试文件
- `src/features/app/orchestration/useThreadOrchestration.test.tsx`
- `src/features/terminal/hooks/useTerminalSession.test.tsx`
- `src/features/debug/components/DebugPanel.test.tsx`
- `src/features/layout/hooks/layoutNodes/buildPrimaryNodes.test.tsx`
- `src/features/app/components/AppModals.test.tsx`

2. 单文件覆盖样本（Wave-4 结果）
- `useThreadOrchestration.ts`: Statements `97.07%`, Branches `79.62%`
- `useTerminalSession.ts`: Statements `83.49%`, Branches `79.54%`
- `DebugPanel.tsx`: Statements `87.83%`, Branches `84.16%`
- `buildPrimaryNodes.tsx`: Statements `99.35%`, Branches `81.25%`
- `AppModals.tsx`: Statements/Branches/Functions/Lines `100%`

3. 全量 strict gate 结果
- `npm run test:coverage:gate:strict`
- 全量测试：`160 files / 1503 tests` 全通过。
- 覆盖率提升到：
  - Statements `63.30%`
  - Lines `63.30%`
  - Functions `71.87%`
  - Branches `77.12%`

4. 当前瓶颈（仍阻塞 strict 80）
- 超大未覆盖文件：
  - `src/App.tsx`（3432 行，0%）
  - `src/types.ts`（761 行，0%）
  - `src/features/layout/hooks/layoutNodes/types.ts`（507 行，0%）
- 低覆盖高体量但可测文件：
  - `PromptPanel.tsx`（2.82%）
  - `useTerminalSession.ts`（已拉升但仍有残余）
  - `SettingsView.tsx`（70.23%）

### 13.8 Coverage 冲刺 Wave-5（2026-02-27）

本波次目标：继续并发清理低覆盖大文件与核心 util，优先提升全局 statements/lines。

1. 本波次新增测试文件
- `src/features/prompts/components/PromptPanel.test.tsx`
- `src/utils/customPrompts.test.ts`
- `src/features/layout/components/DesktopLayout.test.tsx`
- `src/features/workspaces/components/WorkspaceHomeRunControls.test.tsx`
- `src/features/app/hooks/useComposerController.test.tsx`

2. 单文件覆盖样本（Wave-5 结果）
- `PromptPanel.tsx`: Statements `95.75%`, Branches `80.16%`
- `customPrompts.ts`: Statements `91.61%`, Branches `87.90%`
- `DesktopLayout.tsx`: Statements/Branches/Functions/Lines `100%`
- `WorkspaceHomeRunControls.tsx`: Statements `96.29%`, Branches `86.04%`
- `useComposerController.ts`: Statements `100%`, Branches `95%`

3. 全量 strict gate 结果
- `npm run test:coverage:gate:strict`
- 全量测试：`165 files / 1554 tests` 全通过。
- 覆盖率提升到：
  - Statements `65.58%`
  - Lines `65.58%`
  - Functions `73.53%`
  - Branches `77.41%`

4. 当前差距
- 距离 strict 80 还差：
  - Statements/Lines `14.42pp`
  - Functions `6.47pp`
  - Branches `2.59pp`
- 主要结构性阻塞仍在 `src/App.tsx`（3432 行 0%）与大批 type-only/orchestration 文件。

### 13.9 Coverage 冲刺 Wave-6（2026-02-28）

本波次目标：继续并发补测 0% 大文件，并完成 `App.tsx` 可测性拆分（不改行为）+ 契约测试。

1. 本波次新增测试文件
- `src/features/workspaces/components/WorkspaceHomeHistory.test.tsx`
- `src/features/git/components/ImageDiffCard.test.tsx`
- `src/features/app/utils/appUiHelpers.contract.test.ts`

2. 本波次重构文件（仅可测性拆分）
- `src/features/app/utils/appUiHelpers.ts`
- `src/App.tsx`

3. 单文件覆盖样本（Wave-6 结果）
- `WorkspaceHomeHistory.tsx`: Statements `100%`, Branches `97.67%`
- `ImageDiffCard.tsx`: Statements `88.83%`, Branches `82.75%`
- `appUiHelpers` 契约测试：覆盖 `tabletTab`、`GitHub panel lazy-load`、`compact connection state` 三组语义等价断言

4. 全量 strict gate 结果
- `npm run test:coverage:gate:strict`
- 全量测试：`168 files / 1568 tests` 全通过。
- 覆盖率提升到：
  - Statements `66.25%`
  - Lines `66.25%`
  - Functions `73.75%`
  - Branches `77.54%`

5. 当前差距
- 距离 strict 80 仍差：
  - Statements/Lines `13.75pp`
  - Functions `6.25pp`
  - Branches `2.46pp`

### 13.10 Coverage 冲刺 Wave-7（2026-02-28）

本波次目标：继续并发压缩 0% hook 并推进 `App.tsx` 周边可测性拆分，同时落地 4 周时间型验收自动化。

1. 本波次新增测试文件
- `src/features/notifications/hooks/useAgentSystemNotifications.test.tsx`
- `src/features/app/hooks/useWorkspaceDialogs.test.tsx`
- `src/features/messages/hooks/useFileLinkOpener.test.tsx`
- `src/features/notifications/hooks/useAgentSoundNotifications.test.ts`
- `src/features/app/hooks/useWorkspaceCycling.test.ts`
- `src/features/app/utils/appUiHelpers.contract.test.ts`（增强）

2. 本波次重构/治理文件
- `src/features/app/utils/appUiHelpers.ts`（新增 `buildGitStatusForPanel`、`buildAppCssVars`）
- `src/App.tsx`（替换对应内联计算为 helper 调用，行为不变）
- `docs/reference/4-week-no-false-green-observability.md`（新增）
- `scripts/check-4w-no-false-green.mjs`（新增）
- `docs/reference/configuration.md`、`package.json`（新增观测脚本入口）

3. 单文件覆盖样本（Wave-7 结果）
- `useAgentSystemNotifications.ts`: Statements `100%`, Branches `94.36%`
- `useWorkspaceDialogs.ts`: Statements `97.53%`, Branches `79.66%`
- `useWorkspaceCycling.ts`: Statements `92.30%`, Branches `76.92%`
- `useAgentSoundNotifications.ts`: Statements `86.95%`, Branches `64.28%`
- `Image/File` 打开链路（`useFileLinkOpener.ts`）已建立专测与错误路径验证

4. 全量 strict gate 结果
- `npm run test:coverage:gate:strict`
- 全量测试：`173 files / 1603 tests` 全通过。
- 覆盖率提升到：
  - Statements `67.84%`
  - Lines `67.84%`
  - Functions `74.28%`
  - Branches `77.64%`

5. 时间型验收（4周）落地状态
- 已具备自动更新命令：`npm run obs:4w:no-false-green:update`
- 已具备检查命令：`npm run check:4w:no-false-green`（严格：`:strict`）
- 当前观测状态：`W1=fail/unknown/unknown`，`W2-W4=pending`（等待自然时间窗口）

### 13.11 Coverage 冲刺 Wave-8（2026-02-28）

本波次目标：继续并发压缩 0% 高缺口 hook 与 git 数据面板逻辑。

1. 本波次新增测试文件
- `src/features/app/hooks/useWorkspaceController.test.tsx`
- `src/features/git/hooks/useGitLog.test.tsx`
- `src/features/git/hooks/useGitDiffs.test.tsx`
- `src/features/git/hooks/useGitBranches.test.tsx`
- `src/features/git/components/GitHubPanelData.test.tsx`

2. 单文件覆盖样本（Wave-8）
- `useWorkspaceController.ts`: Statements `100%`, Branches `76.47%`
- `useGitLog.ts`: 新增专测并覆盖加载/刷新/错误/依赖变化主分支
- `useGitDiffs.ts`: Statements `97.27%`, Branches `86.66%`
- `useGitBranches.ts`: 新增专测并覆盖加载/排序/过滤/错误主分支
- `GitHubPanelData.tsx`: 定向覆盖 `100%`（S/B/F/L）

3. 全量 strict gate 结果
- `npm run test:coverage:gate:strict`
- 全量测试：`178 files / 1624 tests` 全通过。
- 覆盖率提升到：
  - Statements `68.87%`
  - Lines `68.87%`
  - Functions `74.49%`
  - Branches `77.65%`

4. 当前差距
- 距离 strict 80 仍差：
  - Statements/Lines `11.13pp`
  - Functions `5.51pp`
  - Branches `2.35pp`
- 结构性阻塞仍集中在：
  - `src/App.tsx` 超大体量
  - `src/types.ts`、`layoutNodes/types.ts` 等 type-heavy 文件

## 14. Lazy-Load Evidence（Refactor Batch）

- Runtime evidence references:
  - `.runtime-cache/test_output/coverage-gate/latest.json`
  - `.runtime-cache/test_output/live-preflight/latest.json`
- Changed code references:
  - `src/App.tsx`
  - `src/features/app/utils/appUiHelpers.ts`
  - `src/features/threads/hooks/useThreadsReducer.ts`
  - `src/features/threads/hooks/threadReducerHelpers.ts`
  - `src-tauri/src/bin/codex_monitor_daemon.rs`
  - `src-tauri/src/bin/codex_monitor_daemon/meta.rs`
