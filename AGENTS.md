# CodexMonitor Agent Guide

All docs must canonical, no past commentary, only live state.

## Project Summary
CodexMonitor is a Tauri app that orchestrates Codex agents across local workspaces.

- Frontend: React + Vite
- Backend (app): Tauri Rust process
- Backend (daemon): `src-tauri/src/bin/codex_monitor_daemon.rs`
- Shared backend domain logic: `src-tauri/src/shared/*`

## Environment Variables

Use repository-root `.env.example` as the canonical env template.
Canonical schema for env governance lives in `config/env.schema.json`.
Canonical matrix/audit docs live in `docs/reference/env-matrix.md` and `docs/reference/env-audit-report.md`.

- `VITE_SENTRY_DSN`: optional frontend telemetry DSN.
- `TAURI_DEV_HOST` / `TAURI_DEV_PORT` / `TAURI_DEV_HMR_PORT`: local dev host and ports.
- `PLAYWRIGHT_WEB_PORT` / `PLAYWRIGHT_BASE_URL`: E2E target port/base URL.

### Env Safety Policy

- Commit only template-safe values in tracked `.env*` files.
- Never commit real secrets, API keys, or production tokens.
- Use empty placeholders for sensitive keys and inject real values via local/devops environment.

### Package Manager and Lockfile Policy

- CodexMonitor uses npm as the source of truth (`packageManager: npm`).
- Keep root `package-lock.json` in sync with root `package.json` via `npm install --package-lock-only`.
- Do not maintain mixed lock strategies for the same package in this repo (for example `bun.lock` vs `package-lock.json`).

### App-Server Boolean Parsing Policy

- Never use `Boolean(rawValue)` for app-server payload fields.
- Parse booleans explicitly (`"true"`/`"false"`, `1`/`0`, or boolean literals) to avoid string coercion bugs.

### Terminal Tabs A11y Contract

- Use a real button element with `role="tab"` for each terminal tab trigger.
- Do not nest other interactive controls inside a tab trigger.
- Keep close actions as separate focusable controls so keyboard users can select and close tabs predictably.

## Backend Architecture

The backend separates shared domain logic from environment wiring.

- Shared domain/core logic: `src-tauri/src/shared/*`
- App wiring and platform concerns: feature folders + adapters
- Daemon wiring and transport concerns: `src-tauri/src/bin/codex_monitor_daemon.rs`

## Feature Folders

### Codex

- `src-tauri/src/codex/mod.rs`
- `src-tauri/src/codex/args.rs`
- `src-tauri/src/codex/home.rs`
- `src-tauri/src/codex/config.rs`

### Files

- `src-tauri/src/files/mod.rs`
- `src-tauri/src/files/io.rs`
- `src-tauri/src/files/ops.rs`
- `src-tauri/src/files/policy.rs`

### Dictation

- `src-tauri/src/dictation/mod.rs`
- `src-tauri/src/dictation/real.rs`
- `src-tauri/src/dictation/stub.rs`

### Workspaces

- `src-tauri/src/workspaces/*`

### Shared Core Layer

- `src-tauri/src/shared/*`

Root-level single-file features remain at `src-tauri/src/*.rs` (for example: `menu.rs`, `prompts.rs`, `terminal.rs`, `remote_backend.rs`).

## Shared Core Modules (Source of Truth)

Shared logic that must work in both the app and the daemon lives under `src-tauri/src/shared/`.

- `src-tauri/src/shared/codex_core.rs`
  - Threads, approvals, login/cancel, account, skills, config model
- `src-tauri/src/shared/workspaces_core.rs`
  - Workspace/worktree operations, persistence, sorting, git command helpers
- `src-tauri/src/shared/settings_core.rs`
  - App settings load/update, Codex config path
- `src-tauri/src/shared/files_core.rs`
  - File read/write logic
- `src-tauri/src/shared/git_core.rs`
  - Git command helpers and remote/branch logic
- `src-tauri/src/shared/worktree_core.rs`
  - Worktree naming/path helpers and clone destination helpers
- `src-tauri/src/shared/account.rs`
  - Account helper utilities and tests

## App/Daemon Pattern

Use this mental model when changing backend code:

1. Put shared logic in a shared core module.
2. Keep app and daemon code as thin adapters.
3. Pass environment-specific behavior via closures or small adapter helpers.

The app and daemon do not re-implement domain logic.

## Daemon Module Wrappers

The daemon defines wrapper modules named `codex` and `files` inside `src-tauri/src/bin/codex_monitor_daemon.rs`.

These wrappers re-export the daemon’s local modules:

- Codex: `codex_args`, `codex_home`, `codex_config`
- Files: `file_io`, `file_ops`, `file_policy`

Shared cores use `crate::codex::*` and `crate::files::*` paths. The daemon wrappers satisfy those paths without importing app-only modules.

## Key Paths

### Frontend

- Composition root: `src/App.tsx`
- Feature slices: `src/features/`
- Tauri IPC wrapper: `src/services/tauri.ts`
- Tauri event hub: `src/services/events.ts`
- Shared UI types: `src/types.ts`
- Thread item normalization: `src/utils/threadItems.ts`
- Styles: `src/styles/`

### Backend (App)

- Tauri command registry: `src-tauri/src/lib.rs`
- Codex adapters: `src-tauri/src/codex/*`
- Files adapters: `src-tauri/src/files/*`
- Dictation adapters: `src-tauri/src/dictation/*`
- Workspaces adapters: `src-tauri/src/workspaces/*`
- Shared core layer: `src-tauri/src/shared/*`
- Git feature: `src-tauri/src/git/mod.rs`

### Backend (Daemon)

- Daemon entrypoint: `src-tauri/src/bin/codex_monitor_daemon.rs`
- Daemon imports shared cores via `#[path = "../shared/mod.rs"] mod shared;`

## Architecture Guidelines

### Frontend Guidelines

- Composition root: keep orchestration in `src/App.tsx`.
- Components: presentational only. Props in, UI out. No Tauri IPC.
- Hooks: own state, side effects, and event wiring.
- Utils: pure helpers only in `src/utils/`.
- Services: all Tauri IPC goes through `src/services/`.
- Types: shared UI types live in `src/types.ts`.
- Styles: one CSS file per UI area under `src/styles/`.

Keep `src/App.tsx` lean:

- Keep it to wiring: hook composition, layout, and assembly.
- Move stateful logic/effects into hooks under `src/features/app/hooks/`.
- Keep Tauri IPC, menu listeners, and subscriptions out of `src/App.tsx`.

### Design System Usage

Use the design-system layer for shared UI shells and tokenized styling.

- Primitive component locations:
  - `src/features/design-system/components/modal/ModalShell.tsx`
  - `src/features/design-system/components/toast/ToastPrimitives.tsx`
  - `src/features/design-system/components/panel/PanelPrimitives.tsx`
  - `src/features/design-system/components/popover/PopoverPrimitives.tsx`
  - Toast sub-primitives: `ToastHeader`, `ToastActions`, `ToastError` (in `ToastPrimitives.tsx`)
  - Panel sub-primitives: `PanelMeta`, `PanelSearchField`, `PanelNavList`, `PanelNavItem` (in `PanelPrimitives.tsx`)
  - Popover sub-primitives: `PopoverMenuItem` (in `PopoverPrimitives.tsx`)
- Diff theming and style bridge:
  - `src/features/design-system/diff/diffViewerTheme.ts`
- DS token/style locations:
  - `src/styles/ds-tokens.css`
  - `src/styles/ds-modal.css`
  - `src/styles/ds-toast.css`
  - `src/styles/ds-panel.css`
  - `src/styles/ds-popover.css`
  - `src/styles/ds-diff.css`

Naming conventions:

- DS CSS classes use `.ds-*` prefixes.
- DS CSS variables use `--ds-*` prefixes.
- DS React primitives use `PascalCase` component names (`ModalShell`, `ToastCard`, `ToastHeader`, `ToastActions`, `ToastError`, `PanelFrame`, `PanelHeader`, `PanelMeta`, `PanelSearchField`, `PanelNavList`, `PanelNavItem`, `PopoverSurface`, `PopoverMenuItem`).
- Feature CSS should keep feature-prefixed classes (`.worktree-*`, `.update-*`) for content/layout specifics.

Do:

- Use DS primitives first for shared shells (modal wrappers, toast cards/viewports, panel shells/headers, popover/dropdown surfaces).
- Pull shared visual tokens from `--ds-*` variables.
- Keep feature styles focused on feature-specific layout/content, not duplicated shell chrome.
- Centralize shared animation/chrome in DS stylesheets when used by multiple feature families.

Don't:

- Recreate fixed modal backdrops/cards in feature CSS when `ModalShell` is used.
- Duplicate toast card chrome (background/border/shadow/padding/enter animation) per toast family.
- Duplicate panel shell layout/header alignment in feature styles when `PanelFrame`/`PanelHeader` already provide it.
- Recreate popover/dropdown shell chrome in feature CSS when `PopoverSurface`/`PopoverMenuItem` already provide it.
- Add new non-DS color constants for shared shells; add/extend DS tokens instead.

Migration guidance for new/updated components:

1. Start by wrapping UI in the closest DS primitive.
2. Migrate shared shell styles into DS CSS (`ds-*.css`) and delete redundant feature-level shell selectors.
3. Keep only feature-local classes for spacing/content/interaction details.
4. For legacy selectors that are still referenced, keep minimal compatibility aliases temporarily.
5. Remove compatibility aliases once callsites reach zero, then rerun lint/typecheck/tests.

Anti-duplication guidance:

- Before adding shell styles, search for existing DS token/primitive coverage.
- If two or more feature files need the same shell rule, move it to DS CSS immediately.
- Prefer extending DS primitives/tokens over introducing another feature-specific wrapper class.
- During refactors, remove unused legacy selectors once callsites are migrated.

Enforcement workflow:

- Lint guardrails for DS-targeted files live in `.eslintrc.cjs`.
- Popover guardrails are enforced for migrated popover files (`MainHeader`, `Sidebar`, `SidebarHeader`, `SidebarCornerActions`, `OpenAppMenu`, `LaunchScript*`, `ComposerInput`, `FilePreviewPopover`, `WorkspaceHome`) to require `PopoverSurface`/`PopoverMenuItem`.
- Codemod scripts live in `scripts/codemods/`:
  - `modal-shell-codemod.mjs`
  - `panel-shell-codemod.mjs`
  - `toast-shell-codemod.mjs`
- Run `npm run codemod:ds:dry` before UI shell migration PRs.
- Keep `npm run lint:ds`/`npm run lint` green for modal/toast/panel/popover/diff files.

### Backend Guidelines

- Shared logic goes in `src-tauri/src/shared/` first.
- App and daemon are thin adapters around shared cores.
- Avoid duplicating git/worktree/codex/settings/files logic in adapters.
- Prefer explicit, readable adapter helpers over clever abstractions.
- Do not folderize single-file features unless you are splitting them.

## Daemon: How and When to Add Code

The daemon runs backend logic outside the Tauri app.

### When to Update the Daemon

Update the daemon when one of these is true:

- A Tauri command is used in remote mode.
- The daemon exposes the same behavior over its JSON-RPC transport.
- Shared core behavior changes and the daemon wiring must pass new inputs.

### Where Code Goes

1. Shared behavior or domain logic:
   - Add or update code in `src-tauri/src/shared/*.rs`.
2. App-only behavior:
   - Update the app adapters or Tauri commands.
3. Daemon-only transport/wiring behavior:
   - Update `src-tauri/src/bin/codex_monitor_daemon.rs`.

### How to Add a New Backend Command

1. Implement the core logic in a shared module.
2. Wire it in the app.
   - Add a Tauri command in `src-tauri/src/lib.rs`.
   - Call the shared core from the appropriate adapter.
   - Mirror it in `src/services/tauri.ts`.
3. Wire it in the daemon.
   - Add a daemon method that calls the same shared core.
   - Add the JSON-RPC handler branch in `codex_monitor_daemon.rs`.

### Adapter Patterns to Reuse

- Shared git unit wrapper:
  - `workspaces_core::run_git_command_unit(...)`
- App spawn adapter:
  - `spawn_with_app(...)` in `src-tauri/src/workspaces/commands.rs`
- Daemon spawn adapter:
  - `spawn_with_client(...)` in `src-tauri/src/bin/codex_monitor_daemon.rs`
- Daemon wrapper modules:
  - `mod codex { ... }` and `mod files { ... }` in `codex_monitor_daemon.rs`

If you find yourself copying logic between app and daemon, extract it into `src-tauri/src/shared/`.

## App-Server Flow

- Backend spawns `codex app-server` using the `codex` binary.
- Initialize with `initialize` and then `initialized`.
- Do not send requests before initialization.
- JSON-RPC notifications stream over stdout.
- Threads are listed via `thread/list` and resumed via `thread/resume`.
- Archiving uses `thread/archive`.

## Event Stack (Tauri → React)

The app uses a shared event hub so each native event has one `listen` and many subscribers.

- Backend emits: `src-tauri/src/lib.rs` emits events to the main window.
- Frontend hub: `src/services/events.ts` defines `createEventHub` and module-level hubs.
- React subscription: use `useTauriEvent(subscribeX, handler)`.

### Adding a New Tauri Event

1. Emit the event in `src-tauri/src/lib.rs`.
2. Add a hub and `subscribeX` helper in `src/services/events.ts`.
3. Subscribe via `useTauriEvent` in a hook or component.
4. Update `src/services/events.test.ts` if you add new subscription helpers.

## Workspace Persistence

- Workspaces live in `workspaces.json` under the app data directory.
- Settings live in `settings.json` under the app data directory.
- On launch, the app connects each workspace once and loads its thread list.

## Common Changes (Where to Look First)

- UI layout or styling:
  - `src/features/*/components/*` and `src/styles/*`
- App-server events:
  - `src/features/app/hooks/useAppServerEvents.ts`
- Tauri IPC shape:
  - `src/services/tauri.ts` and `src-tauri/src/lib.rs`
- Shared backend behavior:
  - `src-tauri/src/shared/*`
- Workspaces/worktrees:
  - Shared core: `src-tauri/src/shared/workspaces_core.rs`
  - App adapters: `src-tauri/src/workspaces/*`
  - Daemon wiring: `src-tauri/src/bin/codex_monitor_daemon.rs`
- Settings and Codex config:
  - Shared core: `src-tauri/src/shared/settings_core.rs`
  - App adapters: `src-tauri/src/codex/config.rs`, `src-tauri/src/settings/mod.rs`
  - Daemon wiring: `src-tauri/src/bin/codex_monitor_daemon.rs`
- Files:
  - Shared core: `src-tauri/src/shared/files_core.rs`
  - App adapters: `src-tauri/src/files/*`
- Codex threads/approvals/login:
  - Shared core: `src-tauri/src/shared/codex_core.rs`
  - App adapters: `src-tauri/src/codex/*`
  - Daemon wiring: `src-tauri/src/bin/codex_monitor_daemon.rs`

## Threads Feature Split (Frontend)

`useThreads` is a composition layer that wires focused hooks and shared utilities.

- Orchestration: `src/features/threads/hooks/useThreads.ts`
- Actions: `src/features/threads/hooks/useThreadActions.ts`
- Approvals: `src/features/threads/hooks/useThreadApprovals.ts`
- Event handlers: `src/features/threads/hooks/useThreadEventHandlers.ts`
- Messaging: `src/features/threads/hooks/useThreadMessaging.ts`
- Storage: `src/features/threads/hooks/useThreadStorage.ts`
- Status helpers: `src/features/threads/hooks/useThreadStatus.ts`
- Selectors: `src/features/threads/hooks/useThreadSelectors.ts`
- Rate limits: `src/features/threads/hooks/useThreadRateLimits.ts`
- Collab links: `src/features/threads/hooks/useThreadLinking.ts`

## Running Locally

```bash
npm install
npm run start:dev
```

Tauri/Vite dev port defaults:

- App dev URL: `http://localhost:17420`
- Vite HMR: `17421`
- Playwright web port (`PLAYWRIGHT_WEB_PORT`): `17473`
- Auto-fallback search range: `17420-17520`

## iOS (WIP)

- iOS is supported as WIP.
- Simulator:
```bash
./scripts/build_run_ios.sh
```
- USB device:
```bash
./scripts/build_run_ios_device.sh --list-devices
./scripts/build_run_ios_device.sh --device "Dimillian’s iPhone" --team Z6P74P6T99
```
- If signing is not ready:
```bash
./scripts/build_run_ios_device.sh --open-xcode
```

## Release Build

```bash
npm run tauri:build
```

## Type Checking

```bash
npm run typecheck
```

## Tests

```bash
npm run test
```

```bash
npm run test:watch
```

## Validation

At the end of a task:

1. Run `npm run lint:strict`.
2. Run `npm run test:assertions:guard`.
3. Run `npm run guard:reuse-search`.
4. Run `npm run env:rationalize:check` for runtime-prefixed env drift.
5. Run `npm run env:doctor:dev` (or `npm run env:doctor:live` for live-integration work).
6. Run `npm run test` when you touched threads, settings, updater, shared utils, or backend cores.
7. Run `npm run typecheck`.
8. If you changed Rust backend code, run `npm run check:rust` and `npm run test:rust:lib-bins`.
9. Keep Husky hooks enabled (`pre-commit` and `pre-push`) so these checks run before pushing.

## 测试与质量铁律（2026-02）

This section is mandatory for all future AI code changes in this repository.

### 强制执行规范（MUST / 禁止）

1. Live 测试在具备条件时（真实 Key、外部服务可访问）必须读取真实 Key，并与真实外部 API/网页进行交互验证；禁止仅用本地 mock 替代该类验证。
2. Pre-Commit 前必须确保 lint 全绿；任何 error 或 warning 未清零都禁止提交。
3. Unit Test 覆盖率必须满足：全局 `>= 80%`，关键模块 `>= 95%`；任一阈值不达标视为未完成。
4. 禁止安慰剂断言（例如无业务价值断言、恒真断言）；Commit 前必须通过 assertion guard（`npm run test:assertions:guard`）。
5. 新增导出函数/组件/命令前必须先搜索复用候选；Commit 前必须通过复用门禁（`npm run guard:reuse-search`）。
6. 可并发执行的检查必须并发执行，禁止无理由串行；并发执行不得牺牲结果准确性与流程稳健性。
7. 长耗时测试（含 E2E/集成/端到端链路）必须输出心跳日志，持续报告当前阶段与进度，避免“静默运行”。
8. 执行长测试前，必须先执行短测试（lint、快速单测、核心 smoke）；短测试未通过时禁止进入长测试阶段。
9. Pre-Commit 必须执行文档漂移检查；凡代码行为、配置、命令、接口有变更，必须同步更新对应文档（含 README/参考文档/操作说明）。
10. AGENTS/CLAUDE 导航文档覆盖必须满足：根目录必须有导航入口；主要模块目录必须有可达导航或明确跳转说明，确保人类与 AI 可快速定位规则与入口。

### 验收标准（Gate）

1. Live 验证 Gate：有条件时必须提供真实外部交互证据（请求记录、响应摘要或测试日志）。
2. Lint Gate：`npm run lint:strict` 结果为零错误、零警告。
3. Coverage Gate：执行 `npm run test:coverage:gate`，并满足全局 `>= 80%`、关键模块 `>= 95%`。
4. Assertion Gate：`npm run test:assertions:guard` 必须通过。
5. 并发 Gate：可并发检查任务需有并发执行记录或等价日志证据。
6. Long-Test Heartbeat Gate：长测试日志必须出现连续心跳信息（阶段、时间、进度）。
7. Test-Order Gate：日志中能证明“短测试先于长测试”执行顺序。
8. Doc-Drift Gate：代码变更 PR/提交包含对应文档更新，或显式说明“无文档影响”的可审计理由。
9. 导航覆盖 Gate：根目录与主要模块目录导航文档齐备，路径可达且未失效。

## 文档与规则宪法（2026-02，14条）

本节与“测试与质量铁律（2026-02）”并行生效；若条款冲突，以“更严格、可验证、可审计”为准。

### 强制执行规范（MUST / 禁止，14条）

1. Live 测试在具备条件时（真实 Key、外部服务可访问）必须读取真实 Key，并与真实外部 API/网页进行交互验证；禁止仅用本地 mock 替代该类验证。
2. Pre-Commit 前必须确保 lint 全绿；任何 error 或 warning 未清零都禁止提交。
3. Unit Test 覆盖率必须满足：全局 `>= 80%`，关键模块 `>= 95%`；任一阈值不达标视为未完成。
4. 禁止安慰剂断言（例如无业务价值断言、恒真断言）；Commit 前必须通过 assertion guard（`npm run test:assertions:guard`）。
5. 可并发执行的检查必须并发执行，禁止无理由串行；并发执行不得牺牲结果准确性与流程稳健性。
6. 长耗时测试（含 E2E/集成/端到端链路）必须输出心跳日志，持续报告当前阶段与进度，避免“静默运行”。
7. 执行长测试前，必须先执行短测试（lint、快速单测、核心 smoke）；短测试未通过时禁止进入长测试阶段。
8. Pre-Commit 必须执行文档漂移检查；凡代码行为、配置、命令、接口有变更，必须同步更新对应文档（含 README/参考文档/操作说明）。
9. AGENTS/CLAUDE 导航文档覆盖必须满足：根目录必须有导航入口；主要模块目录必须有可达导航或明确跳转说明，确保人类与 AI 可快速定位规则与入口。
10. 文档读取必须“索引优先 + 懒加载”：先读根索引，再按任务只加载最小必要模块文档；禁止无差别全量展开导致上下文污染。
11. 模型策略为 `Gemini-only（当前默认）`：新任务默认走 Gemini 主链路，不得在未声明的情况下切到其他模型族。
12. `兼容可选（非默认）`：仅在 Gemini 不可用、能力缺口或外部硬约束时，才允许启用兼容路线；且必须记录触发条件、回退条件与结果差异。
13. 规则层级必须一致：根文档是宪法，模块文档是局部执行细则；模块规则不得弱化根规则，冲突时以根规则为准。
14. 所有结论必须证据化：至少包含命令/日志/变更文件/测试结果之一；“无证据结论”视为未完成。

### 验收标准（Gate，14项）

1. Live 验证 Gate：有条件时必须提供真实外部交互证据（请求记录、响应摘要或测试日志）。
2. Lint Gate：`npm run lint:strict` 结果为零错误、零警告。
3. Coverage Gate：执行 `npm run test:coverage:gate`，并满足全局 `>= 80%`、关键模块 `>= 95%`。
4. Assertion Gate：`npm run test:assertions:guard` 必须通过。
5. 并发 Gate：可并发检查任务需有并发执行记录或等价日志证据。
6. Long-Test Heartbeat Gate：长测试日志必须出现连续心跳信息（阶段、时间、进度）。
7. Test-Order Gate：日志中能证明“短测试先于长测试”执行顺序。
8. Doc-Drift Gate：代码变更 PR/提交包含对应文档更新，或显式说明“无文档影响”的可审计理由。
9. 导航覆盖 Gate：根目录与主要模块目录导航文档齐备，路径可达且未失效。
10. Lazy-Load Gate：执行记录体现“先读根索引，再按需加载模块文档”的最小化读取路径。
11. Gemini-Default Gate：任务日志/配置显示默认执行链路为 Gemini。
12. Compatibility-Opt-In Gate：若启用兼容路线，必须有显式触发原因、审批语句或任务注记，且标明非默认。
13. Rule-Hierarchy Gate：模块文档内容与根文档不冲突；若存在差异，已给出根文档优先的对齐说明。
14. Evidence Gate：每个关键结论都能追溯到可审计证据，不存在“口头通过”。

## 导航索引与懒加载协议

### 根索引（先读）

- `AGENTS.md`：仓库级规则宪法与 Gate（本文件）
- `CLAUDE.md`：仓库级执行摘要与最短路径

### 模块索引（按任务懒加载）

- 前端任务：`src/AGENTS.md` → `src/CLAUDE.md`
- 后端任务：`src-tauri/AGENTS.md` → `src-tauri/CLAUDE.md`

### 懒加载执行顺序（最小可执行）

1. 先读根索引，确认强制规范与 Gate。
2. 按任务域只加载一个模块文档族（`src/` 或 `src-tauri/`）。
3. 仅在出现跨域变更时，补读另一模块文档族。
4. 回写时检查根规则与模块细则一致，不得降级根规则。

## 模型策略（Gemini-only 当前）

- 默认：Gemini-only（当前），所有新任务默认使用 Gemini 路线。
- 兼容：仅可选、非默认，仅在出现明确阻塞时启用。
- 记录：一旦启用兼容路线，必须记录原因、影响面、回退计划与结果差异。

## Notes

- The window uses `titleBarStyle: "Overlay"` and macOS private APIs for transparency.
- Avoid breaking JSON-RPC format; the app-server is strict.
- App settings and Codex feature toggles are best-effort synced to `CODEX_HOME/config.toml`.
- UI preferences live in `localStorage`.
- GitHub issues require `gh` to be installed and authenticated.
- Custom prompts are loaded from `$CODEX_HOME/prompts` (or `~/.codex/prompts`).

## Error Toasts

- Use `pushErrorToast` from `src/services/toasts.ts` for user-facing errors.
- Toast wiring:
  - Hook: `src/features/notifications/hooks/useErrorToasts.ts`
  - UI: `src/features/notifications/components/ErrorToasts.tsx`
  - Styles: `src/styles/error-toasts.css`
