# CodexMonitor

![CodexMonitor](screenshot.png)

CodexMonitor is a Tauri app for orchestrating multiple Codex agents across local workspaces. It provides a sidebar to manage projects, a home screen for quick actions, and a conversation view backed by the Codex app-server protocol.

## Features

### Workspaces & Threads

- Add and persist workspaces, group/sort them, and jump into recent agent activity from the home dashboard.
- Spawn one `codex app-server` per workspace, resume threads, and track unread/running state.
- Worktree and clone agents for isolated work; worktrees live under the app data directory (legacy `.codex-worktrees` supported).
- Thread management: pin/rename/archive/copy, per-thread drafts, and stop/interrupt in-flight turns.
- Optional remote backend (daemon) mode for running Codex on another machine.
- Remote setup helpers for self-hosted connectivity (Orbit actions + Tailscale detection/host bootstrap for TCP mode).

### Composer & Agent Controls

- Compose with queueing plus image attachments (picker, drag/drop, paste).
- Autocomplete for skills (`$`), prompts (`/prompts:`), reviews (`/review`), and file paths (`@`).
- Model picker, collaboration modes (when enabled), reasoning effort, access mode, and context usage ring.
- Dictation with hold-to-talk shortcuts and live waveform (Whisper).
- Render reasoning/tool/diff items and handle approval prompts.

### Git & GitHub

- Diff stats, staged/unstaged file diffs, revert/stage controls, and commit log.
- Branch list with checkout/create plus upstream ahead/behind counts.
- GitHub Issues and Pull Requests via `gh` (lists, diffs, comments) and open commits/PRs in the browser.
- PR composer: "Ask PR" to send PR context into a new agent thread.

### Files & Prompts

- File tree with search, file-type icons, and Reveal in Finder/Explorer.
- Prompt library for global/workspace prompts: create/edit/delete/move and run in current or new threads.

### UI & Experience

- Resizable sidebar/right/plan/terminal/debug panels with persisted sizes.
- Responsive layouts (desktop/tablet/phone) with tabbed navigation.
- Sidebar usage and credits meter for account rate limits plus a home usage snapshot.
- Terminal dock with multiple tabs for background commands (experimental).
- In-app updates with toast-driven download/install, debug panel copy/clear, sound notifications, plus platform-specific window effects (macOS overlay title bar + vibrancy) and a reduced transparency toggle.

## Requirements

- Node.js + npm
- Rust toolchain (stable)
- CMake (required for native dependencies; dictation/Whisper uses it)
- LLVM/Clang (required on Windows to build dictation dependencies via bindgen)
- Codex CLI installed and available as `codex` in `PATH` (or configure a custom Codex binary in app/workspace settings)
- Git CLI (used for worktree operations)
- GitHub CLI (`gh`) for GitHub Issues/PR integrations (optional)

If you hit native build errors, run:

```bash
npm run doctor
```

## Getting Started

Install dependencies:

```bash
npm install
```

Run in dev mode:

```bash
npm run start:dev
```

(Equivalent direct command: `npm run tauri:dev`.)

Dev ports:

- Default Vite/Tauri dev port: `17420`
- Default HMR port: `17421`
- Default Playwright web port (`PLAYWRIGHT_WEB_PORT`): `17473`
- Auto-fallback search range: `17420-17520`

## Containerized Consistency (Dev Container)

This project now includes a minimal containerized dev skeleton for environment consistency:

- `.devcontainer/devcontainer.json`
- `docker-compose.dev.yml`

Quick start:

1. Open this repo in VS Code with the Dev Containers extension.
2. Run `Dev Containers: Reopen in Container`.
3. Inside the container, run `npm run start:dev` (same command as local).

Notes:

- Local development flow remains unchanged; container usage is optional.
- The container is set up for Node + Rust + Playwright friendly development/test workflows.

### Optional: Create a desktop shortcut

Create a one-click desktop launcher:

```bash
npm run shortcut:desktop
```

- macOS: creates `~/Desktop/CodexMonitor-Dev.command`
- Linux: creates `~/Desktop/CodexMonitor-Dev.desktop`

You can then double-click the shortcut to launch CodexMonitor in dev mode.

## Cursor Agent Control Plane (No IDE)

This repository now includes a practical control-plane workflow for running multiple Cursor Agent sessions without opening multiple IDE windows.

Quick commands:

```bash
npm run cursor:doctor
npm run cursor:manifest:init
npm run cursor:sessions:print
npm run cursor:sessions:tmux
```

Optional panel bootstrap (claudecodeui):

```bash
npm run cursor:panel:bootstrap
npm run cursor:panel:bootstrap:docker
```

Canonical runbook:

- `docs/cursor-control-plane.md`
- `docs/examples/cursor-agents.manifest.example.json`

## iOS Support (WIP)

iOS support is currently in progress.

- Current status: mobile layout runs, remote backend flow is wired, and iOS defaults to remote backend mode.
- Current limits: terminal and dictation remain unavailable on mobile builds.
- Desktop behavior is unchanged: macOS/Linux/Windows remain local-first unless remote mode is explicitly selected.

### iOS + Tailscale Setup (TCP)

Use this when connecting the iOS app to a desktop-hosted daemon over your Tailscale tailnet.

1. Install and sign in to Tailscale on both desktop and iPhone (same tailnet).
2. On desktop CodexMonitor, open `Settings > Server`.
3. Keep `Remote provider` set to `TCP (wip)`.
4. Set a `Remote backend token`.
5. Start the desktop daemon with `Start daemon` (in `Mobile access daemon`).
6. In `Tailscale helper`, use `Detect Tailscale` and note the suggested host (for example `your-mac.your-tailnet.ts.net:4732`).
7. On iOS CodexMonitor, open `Settings > Server`.
8. Set `Connection type` to `TCP`.
9. Enter the desktop Tailscale host and the same token.
10. Tap `Connect & test` and confirm it succeeds.

Notes:

- The desktop daemon must stay running while iOS is connected.
- If the test fails, confirm both devices are online in Tailscale and that host/token match desktop settings.
- If you want to use Orbit instead of Tailscale TCP, switch `Connection type` to `Orbit` on iOS and use your desktop Orbit websocket URL/token.

### iOS Prerequisites

- Xcode + Command Line Tools installed.
- Rust iOS targets installed:

```bash
rustup target add aarch64-apple-ios aarch64-apple-ios-sim
# Optional (Intel Mac simulator builds):
rustup target add x86_64-apple-ios
```

- Apple signing configured (development team).
  - Set `bundle.iOS.developmentTeam` in `src-tauri/tauri.ios.conf.json` (preferred), or
  - pass `--team <TEAM_ID>` to the device script.

### Run on iOS Simulator

```bash
./scripts/build_run_ios.sh
```

Options:

- `--simulator "<name>"` to target a specific simulator.
- `--target aarch64-sim|x86_64-sim` to override architecture.
- `--skip-build` to reuse the current app bundle.
- `--no-clean` to preserve `src-tauri/gen/apple/build` between builds.

### Run on USB Device

List discoverable devices:

```bash
./scripts/build_run_ios_device.sh --list-devices
```

Build, install, and launch on a specific device:

```bash
./scripts/build_run_ios_device.sh --device "<device name or identifier>" --team <TEAM_ID>
```

Additional options:

- `--target aarch64` to override architecture.
- `--skip-build` to reuse the current app bundle.
- `--bundle-id <id>` to launch a non-default bundle identifier.

First-time device setup usually requires:

1. iPhone unlocked and trusted with this Mac.
2. Developer Mode enabled on iPhone.
3. Pairing/signing approved in Xcode at least once.

If signing is not ready yet, open Xcode from the script flow:

```bash
./scripts/build_run_ios_device.sh --open-xcode
```

### iOS TestFlight Release (Scripted)

Use the end-to-end script to archive, upload, configure compliance, assign beta group, and submit for beta review.

```bash
./scripts/release_testflight_ios.sh
```

The script auto-loads release metadata from `.testflight.local.env` (gitignored).
For new setups, copy `.testflight.local.env.example` to `.testflight.local.env` and fill values.

## Release Build

Build the production Tauri bundle:

```bash
npm run tauri:build
```

Artifacts will be in `src-tauri/target/release/bundle/` (platform-specific subfolders).

### Windows (opt-in)

Windows builds are opt-in and use a separate Tauri config file to avoid macOS-only window effects.

```bash
npm run tauri:build:win
```

Artifacts will be in:

- `src-tauri/target/release/bundle/nsis/` (installer exe)
- `src-tauri/target/release/bundle/msi/` (msi)

Note: building from source on Windows requires LLVM/Clang (for `bindgen` / `libclang`) in addition to CMake.

## Type Checking

Run the TypeScript checker (no emit):

```bash
npm run typecheck
```

Note: `npm run build` also runs `tsc` before bundling the frontend.

## Validation

Recommended validation commands:

```bash
npm run lint:strict
npm run test:assertions:guard
npm run test
npm run typecheck
npm run test:coverage:gate
npm run test:coverage:gate:strict
npm run check:rust
npm run test:rust:lib-bins
```

## Storybook and Chromatic

Run Storybook locally:

```bash
npm run storybook
```

Build static Storybook output (used by Chromatic):

```bash
npm run build-storybook
```

`build-storybook` is hardened for this repository layout:

- builds from a temporary safe path to avoid `[]` path parsing issues
- excludes heavy directories from the temporary build workspace (`src-tauri/gen`, `target`, `node_modules`, `.runtime-cache`, `.git`, existing `storybook-static`)
- reuses root `node_modules` via symlink (no duplicate dependency copy)
- syncs final output back to root `storybook-static`

Publish to Chromatic:

```bash
npm run chromatic
```

`chromatic` runs with `--storybook-build-dir storybook-static`, so it always publishes the output produced by `npm run build-storybook`.

## Governance Layers (`pre-commit < pre-push < CI`)

Quality gates are intentionally layered by strictness to avoid policy drift:

1. `pre-commit` (fast frontline, local)
   - Entry: `npm run precommit:orchestrated`
   - Focus: staged doc-drift + staged security/compliance + assertion/lint fail-fast.
2. `pre-push` (medium-strength frontline, local)
   - Entry: `npm run preflight:orchestrated`
   - Phase 1 baseline set: `preflight:doc-drift (branch)` + `env:rationalize:check` + `env:doctor:dev` + `preflight:quick` + `test:assertions:guard` + `guard:reuse-search` + `lint:strict`.
   - Phase 2 medium parallel set: `npm run test` + `npm run check:rust`.
3. `CI` (strict final arbitration, remote)
   - Workflow jobs enforce the heaviest checks and evidence upload, including coverage/mutation/E2E/a11y/interaction sweeps and release-facing integration checks.
   - `main` and `pull_request` now always run in full mode (`run_js_tests/run_e2e/run_rust_tests=true`) regardless scoped-change detection, preventing skip-green on review branch and default branch.
   - CI type checking now uses `npm run typecheck:ci` (product code strict check, test/story files excluded) so legacy test typing debt cannot mask product regressions.
  - Strict-main integration gate: `.github/workflows/real-integration.yml` supports strict dual-chain enforcement on `main` (`preflight` + `external-e2e` + `real-llm`) when repository variable `REAL_INTEGRATIONS_STRICT_MAIN=true`; otherwise it runs in advisory mode with explicit warnings/summaries.
  - Visual gate: `.github/workflows/ci.yml` job `visual-regression` always enforces a local Storybook build gate, and additionally runs Chromatic cloud diff when `CHROMATIC_PROJECT_TOKEN` is available.
   - Functional hard gate: `.github/workflows/ci.yml` job `e2e-functional-regression` runs deterministic full functional suite (`smoke + interaction + workspace lifecycle + approval + worktree`) across `chromium + webkit`, enforced by `required-gate`.
   - Key journeys are now cross-engine guarded by `e2e-key-journeys` matrix (`chromium + webkit`).
   - `.github/workflows/chromatic.yml` is standalone/manual (`workflow_dispatch`) for manual re-runs and diagnostics.
   - Accessibility and interaction gates: `.github/workflows/ci.yml` runs `npx playwright test e2e/a11y.spec.ts --project=chromium` and `npx playwright test e2e/interaction-sweep.spec.ts --project=chromium`.

Coverage gate policy (`scripts/coverage-gate.mjs`):

- Global minimum thresholds are fixed at `>=80` for `statements`, `lines`, `functions`, and `branches`.
- Default mode (`npm run test:coverage:gate`) is ratcheted sustainability mode:
  - Without explicit env targets, required threshold follows baseline (`baseline.json`) to prevent regression and only ratchets upward.
  - With explicit `COVERAGE_TARGET_*` (or legacy `COVERAGE_MIN_*`), required becomes `max(explicit_target, baseline)` per metric.
- Strict mode (`npm run test:coverage:gate:strict`) ignores baseline input and enforces fixed global `80/80/80/80`.
- Critical scope thresholds are hard-gated as implemented:
  - `src/features/threads/`: `statements>=95`, `lines>=95`, `functions>=95`, `branches>=92`
  - `src/services/`: `statements>=95`, `lines>=95`, `functions>=95`, `branches>=95`
- Gate is fail-fast:
  - If tests fail, the gate exits immediately.
  - If a threshold env override is set below the enforced baseline, the gate exits with config error.
- Report output includes the gate mode (`default` or `strict`) so CI logs clearly show which policy ran.
- Failure output includes metric/module + exact shortfall (`required - actual`).

Git hooks are enforced with Husky:

- `pre-commit`: runs `npm run precommit:orchestrated`
  - Phase 1: `preflight:doc-drift` checks staged files and requires staged docs updates for doc-sensitive changes (`README.md`, `AGENTS.md`, `CLAUDE.md`, `src/{AGENTS,CLAUDE}.md`, `src-tauri/{AGENTS,CLAUDE}.md`, `CHANGELOG.md`, or `docs/*`).
  - Phase 2 (parallel security + compliance gates): `check:secrets:staged`, `check:keys:source-policy`, `check:real-llm-alias-usage`, `check:critical-path-logging`, `env:doctor:staged`, `env:rationalize:check`, `check:lazy-load:evidence-gate`, and `check:compat:option-log`.
  - Critical-path logging gate checks newly staged critical-path additions (`catch` blocks / third-party API calls) for structured log context (`traceId`/`requestId` + `error`/`code`/`status`) and defaults to fail mode unless `CRITICAL_LOG_GUARD_MODE=warn`.
  - Phase 3: runs `test:assertions:guard`, `guard:reuse-search`, and `lint:strict` in parallel.
- `commit-msg`: runs secret scan and conventional-commit lint:
  - `npm run check:commit-message:secrets -- "$1"`
  - `npx --no-install commitlint --edit "$1"`
- `pre-push`: runs `npm run preflight:orchestrated`
  - Phase 1 (baseline): `preflight:doc-drift (branch)` + `env:rationalize:check` + `env:doctor:dev` + `preflight:quick` (reserved quick lane, currently no-op) + `test:assertions:guard` + `guard:reuse-search` + `lint:strict`.
  - Phase 2 (parallel medium jobs): `check:rust`.
  - Heartbeat cadence is controlled by `PREFLIGHT_HEARTBEAT_LEVEL` (`quiet`/`normal`/`debug`), default `normal` cadence (60s interval, 60s minimum elapsed before emission).
  - Parallel failure output preserves task names, so gate failures are directly attributable to the failing job.

### Pre-commit Governance Usage

Install pre-commit (Python toolchain) and register local hooks:

```bash
python3 -m pip install pre-commit
pre-commit install
```

Run all configured hooks against the full repository:

```bash
pre-commit run --all-files
```

Update pinned hook versions in `.pre-commit-config.yaml`:

```bash
pre-commit autoupdate
```

How pre-commit and Husky work together in this repo:

- Husky is the default Git hook gateway for Node/Rust quality gates (`.husky/*` + `npm run precommit:orchestrated` / `npm run preflight:orchestrated`).
- pre-commit is complementary and useful for full-repo/manual governance scans and optional CI alignment.
- pre-commit now includes `oxipng` (lossless PNG optimization) and runs the local `stylelint-uiux` hook in autofix mode (`--fix`) during `pre-commit`.
- Gemini UI/UX `pre-push` audit degrades to a warning-level `skipped` result when `GEMINI_API_KEY` is missing; with a key present, it still runs the full audit.
- Hook/audit implementation references: `.pre-commit-config.yaml`, `scripts/gemini-uiux-audit.mjs`.
- Example runtime evidence artifacts: `.runtime-cache/test_output/coverage-gate/latest.json`, `.runtime-cache/test_output/live-preflight/latest.json`.
- Keep both green: use Husky for commit-time orchestration, and use `pre-commit run --all-files` for periodic full baseline checks.

UI smoke gate command:

```bash
npm run test:smoke:ui
```

- Runs `e2e/smoke.spec.ts` against the local app target.
- Supports optional skip flags: `SKIP_UI_SMOKE=1` or `PREFLIGHT_SKIP_UI_SMOKE=1`.
- Implementation references: `scripts/test-smoke-ui.mjs`, `scripts/preflight-orchestrated.mjs`, `package.json`.
- Runtime evidence artifacts: `.runtime-cache/test_output/live-preflight/latest.json`, `.runtime-cache/test_output/real-llm/latest.json`.

Dry-run commands:

```bash
npm run preflight:doc-drift:dry
npm run precommit:orchestrated:dry
npm run preflight:orchestrated:dry
npm run env:doctor:dev
npm run env:doctor:live
npm run env:rationalize
```

Security gate commands:

```bash
npm run check:secrets:staged
npm run check:keys:source-policy
npm run check:real-llm-alias-usage
npm run check:commit-message:secrets -- .git/COMMIT_EDITMSG
```

Assertion guard policy:

- `expect(...).toBeDefined()` is forbidden by default.
- Literal self-assertions like `expect("x").toBe("x")` are forbidden.
- If `toBeDefined()` is genuinely required, annotate the assertion line (or the line above) with `codex-allow-toBeDefined`.

One-shot full-repo quality gate (TS/React + tests + Rust):

```bash
npm run test:repo
```

Optional live preflight for real integrations (non-default for local runs):

```bash
npm run test:live:preflight
```

- Checks live prerequisites for both external browser test and real LLM smoke.
- Verifies variable presence and source (`process env` / `.env.local` / `.env` / `~/.zshrc`) without printing secret values.
- Preflight report now includes `envDiagnostics` with per-variable `present`, `source`, `runnable`, and key-safe preview fields (API key stays redacted).
- Performs network reachability checks:
  - `REAL_EXTERNAL_URL` target URL (if configured)
  - `REAL_LLM_BASE_URL/v1/models` with auth (if LLM vars are configured)
- Writes a machine-readable report to `.runtime-cache/test_output/live-preflight/latest.json`.
- In GitHub Actions, exports `run_any`, `run_external`, `run_llm`, `status`, and `reason` outputs for conditional workflow steps.

Optional real external Playwright check (non-default, non-gating):

```bash
npm run test:e2e:external
```

- Uses `REAL_EXTERNAL_URL` from your environment.
- If `REAL_EXTERNAL_URL` is not set, the test exits early with a visible reason.
- Uses `playwright.external.config.ts`, so it does not boot the local Vite dev server.
- Retries are enabled (up to 2) for transient network/infra failures.
- Intended for real-world integration probing and scheduled/manual CI runs, not required local or PR gates.

Optional real LLM/API key smoke test (non-default, non-gating):

```bash
npm run test:real:llm
```

- Required env:
  - `REAL_LLM_BASE_URL` (Gemini OpenAI-compatible base URL, example: `https://generativelanguage.googleapis.com/v1beta/openai`)
  - `GEMINI_API_KEY` (required)
- Env source resolution:
  - First uses current process environment (including exported zsh variables).
  - If missing, falls back to repo `.env.local`, then repo `.env`, then `~/.zshrc`.
  - If only key is present, base URL defaults to `https://generativelanguage.googleapis.com/v1beta/openai`.
- Optional env:
  - `REAL_LLM_MODEL` (if omitted, script auto-selects the first model from `/v1/models`)
  - `REAL_LLM_TIMEOUT_MS` (default `20000`)
- Flow:
  - Calls `/v1/models` first to validate connectivity and resolve model.
  - Sends a minimal generation request via `/v1/responses`.
  - Falls back to `/v1/chat/completions` if `/v1/responses` is unavailable.
  - Fails unless a non-empty generated text/output is returned (HTTP 200 alone is not enough).
- Safety:
  - If required env vars are missing, script prints a clear `SKIP` reason and exits `0`.
  - Script logs each LLM env source/presence/runnability; key values are always redacted.
  - Writes a machine-readable report to `.runtime-cache/test_output/real-llm/latest.json`.

Combined optional real checks:

```bash
npm run test:real
```

- Runs external Playwright check, then runs real LLM smoke test.
- Workflow policy: `.github/workflows/real-integration.yml` runs on `main` push plus manual/weekly schedules.
- On `main`, strict mode is enabled: external chain and LLM chain must both be runnable and both succeed, otherwise workflow fails (no silent skip-green).
- The strict gate writes a step summary section listing missing/failed prerequisites (for example missing `REAL_EXTERNAL_URL`, `REAL_LLM_BASE_URL`, or `GEMINI_API_KEY`) and diagnostics.
- On non-`main` triggers, the workflow keeps conditional execution for external E2E and real LLM jobs.
- Long-running workflow steps emit 20s heartbeat logs to avoid no-output timeout ambiguity.

## Documentation

- Docs index: `docs/README.md`
- Agent docs (root): `AGENTS.md`, `CLAUDE.md`
- Agent docs (frontend): `src/AGENTS.md`, `src/CLAUDE.md`
- Agent docs (backend): `src-tauri/AGENTS.md`, `src-tauri/CLAUDE.md`
- App-server compatibility reference: `docs/app-server-events.md`
- Configuration reference: `docs/reference/configuration.md`
- Environment matrix reference: `docs/reference/env-matrix.md`
- Environment final report: `docs/reference/env-final-report.md`
- Logging/cache governance: `docs/reference/logging-cache-governance.md`
- Dependency maintenance policy: `docs/reference/dependency-maintenance.md`
- Upstream sync runbook: `docs/upstream-sync-runbook.md`
- Upstream patch inventory template: `docs/upstream-patch-inventory.md`

## Upstream Sync Commands

- Dry run: `npm run sync:upstream:dry`
- Execute sync: `npm run sync:upstream`
- Quick verification: `npm run sync:verify:fast`
- Full verification: `npm run sync:verify`

Default remote detection order is `upstream` then `origin`.

## Project Structure

```
src/
  features/         feature-sliced UI + hooks
  services/         Tauri IPC wrapper
  styles/           split CSS by area
  types.ts          shared types
src-tauri/
  src/lib.rs        Tauri app backend command registry
  src/bin/codex_monitor_daemon.rs  remote daemon JSON-RPC process
  src/shared/       shared backend core used by app + daemon
  src/workspaces/   workspace/worktree adapters
  src/codex/        codex app-server adapters
  src/files/        file adapters
  tauri.conf.json   window configuration
```

## Notes

- Workspaces persist to `workspaces.json` under the app data directory.
- App settings persist to `settings.json` under the app data directory (theme, backend mode/provider, remote endpoints/tokens, Codex path, default access mode, UI scale).
- Feature settings are supported in the UI and synced to `$CODEX_HOME/config.toml` (or `~/.codex/config.toml`) on load/save. Stable: Collaboration modes (`features.collaboration_modes`), personality (`personality`), Steer mode (`features.steer`), and Background terminal (`features.unified_exec`). Experimental: Collab mode (`features.collab`) and Apps (`features.apps`).
- On launch and on window focus, the app reconnects and refreshes thread lists for each workspace.
- Threads are restored by filtering `thread/list` results using the workspace `cwd`.
- Selecting a thread always calls `thread/resume` to refresh messages from disk.
- CLI sessions appear if their `cwd` matches the workspace path; they are not live-streamed unless resumed.
- The app uses `codex app-server` over stdio; see `src-tauri/src/lib.rs` and `src-tauri/src/codex/`.
- The remote daemon entrypoint is `src-tauri/src/bin/codex_monitor_daemon.rs`; shared domain logic lives in `src-tauri/src/shared/`.
- Codex home resolves from workspace settings (if set), then legacy `.codexmonitor/`, then `$CODEX_HOME`/`~/.codex`.
- Worktree agents live under the app data directory (`worktrees/<workspace-id>`); legacy `.codex-worktrees/` paths remain supported, and the app no longer edits repo `.gitignore` files.
- UI state (panel sizes, reduced transparency toggle, recent thread activity) is stored in `localStorage`.
- Custom prompts load from `$CODEX_HOME/prompts` (or `~/.codex/prompts`) with optional frontmatter description/argument hints.

## Compatibility Opt-In Record

- 触发原因: 本次引入兼容识别与门禁审计脚本，确保在 Gemini-only 主路径下仍可审计兼容场景。
- 回退条件: 若兼容门禁导致误报或阻塞开发，先回退到 Gemini-only 严格路径并关闭兼容提示检查。
- 结果差异: 默认运行逻辑不变，新增的是门禁校验、证据日志和提交前合规拦截行为。
- 证据路径: `.runtime-cache/test_output/coverage-gate/latest.json` 与 `.runtime-cache/test_output/real-llm/latest.json`。
- 本次相关改动文件: `src/features/threads/hooks/useQueuedSend.test.tsx`、`src/features/threads/hooks/useThreadsReducer.test.ts`、`src-tauri/src/shared/agents_config_core.rs`。

## Tauri IPC Surface

Frontend calls live in `src/services/tauri.ts` and map to commands in `src-tauri/src/lib.rs`. The current surface includes:

- Settings/config/files: `get_app_settings`, `update_app_settings`, `get_codex_config_path`, `get_config_model`, `file_read`, `file_write`, `codex_doctor`, `menu_set_accelerators`, `append_structured_log`.
- Workspaces/worktrees: `list_workspaces`, `is_workspace_path_dir`, `add_workspace`, `add_clone`, `add_worktree`, `worktree_setup_status`, `worktree_setup_mark_ran`, `rename_worktree`, `rename_worktree_upstream`, `apply_worktree_changes`, `update_workspace_settings`, `update_workspace_codex_bin`, `remove_workspace`, `remove_worktree`, `connect_workspace`, `list_workspace_files`, `read_workspace_file`, `open_workspace_in`, `get_open_app_icon`.
- Threads/turns/reviews: `start_thread`, `fork_thread`, `compact_thread`, `list_threads`, `resume_thread`, `archive_thread`, `set_thread_name`, `send_user_message`, `turn_interrupt`, `respond_to_server_request`, `start_review`, `remember_approval_rule`, `get_commit_message_prompt`, `generate_commit_message`, `generate_run_metadata`.
- Account/models/collaboration: `model_list`, `account_rate_limits`, `account_read`, `skills_list`, `apps_list`, `collaboration_mode_list`, `codex_login`, `codex_login_cancel`, `list_mcp_server_status`.
- Git/GitHub: `get_git_status`, `list_git_roots`, `get_git_diffs`, `get_git_log`, `get_git_commit_diff`, `get_git_remote`, `stage_git_file`, `stage_git_all`, `unstage_git_file`, `revert_git_file`, `revert_git_all`, `commit_git`, `push_git`, `pull_git`, `fetch_git`, `sync_git`, `list_git_branches`, `checkout_git_branch`, `create_git_branch`, `get_github_issues`, `get_github_pull_requests`, `get_github_pull_request_diff`, `get_github_pull_request_comments`.
- Prompts: `prompts_list`, `prompts_create`, `prompts_update`, `prompts_delete`, `prompts_move`, `prompts_workspace_dir`, `prompts_global_dir`.
- Terminal/dictation/notifications/usage: `terminal_open`, `terminal_write`, `terminal_resize`, `terminal_close`, `dictation_model_status`, `dictation_download_model`, `dictation_cancel_download`, `dictation_remove_model`, `dictation_request_permission`, `dictation_start`, `dictation_stop`, `dictation_cancel`, `send_notification_fallback`, `is_macos_debug_build`, `local_usage_snapshot`.
- Remote backend helpers: `orbit_connect_test`, `orbit_sign_in_start`, `orbit_sign_in_poll`, `orbit_sign_out`, `orbit_runner_start`, `orbit_runner_stop`, `orbit_runner_status`, `tailscale_status`, `tailscale_daemon_command_preview`, `tailscale_daemon_start`, `tailscale_daemon_stop`, `tailscale_daemon_status`.
