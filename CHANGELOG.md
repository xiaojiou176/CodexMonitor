# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- TBD

### Changed
- Improved responsive layout behavior across desktop/tablet views, including sidebar interactions and panel resizing flows.
- Expanded `threads` branch-coverage tests across reducer, messaging, actions, queue handling, and args profile parsing to harden guard/no-op/error paths.
- Evidence: `.runtime-cache/test_output/coverage-gate/latest.json`.
- Evidence code paths: `src/features/threads/hooks/useThreadsReducer.test.ts`, `src/features/threads/hooks/useThreadMessaging.test.tsx`, `src/features/threads/hooks/useThreadActions.test.tsx`, `src/features/threads/hooks/useQueuedSend.test.tsx`, `src/features/threads/hooks/useThreads.test.tsx`, `src/features/threads/utils/codexArgsProfiles.test.ts`.
- Updated related frontend tests and style rules to keep layout, settings, and thread/profile surfaces aligned with new UI behavior.
- Evidence: `.runtime-cache/test_output/live-preflight/latest.json` and `.runtime-cache/test_output/real-llm/latest.json` were used during local gate verification for this update.
- Evidence code paths: `src/App.tsx`, `src/features/layout/hooks/useResizablePanels.ts`, `src/features/settings/components/SettingsView.tsx`.
- Compatibility opt-in record:
  - Trigger reason: fallback compatibility wording appears in staged code/comments and is intentionally retained for migration-safe behavior.
  - Rollback condition: if Gemini-only path is fully verified without compatibility fallback, remove compatibility wording/branching and re-run full gates.
  - Result diff: no model provider switch introduced in runtime behavior; this commit only updates UI/layout logic while preserving existing compatibility text.
- Regenerated Tauri Apple/Android project artifacts and capability payloads to keep platform metadata synchronized with current app state.
- Updated iOS device build helper and generated bindings/project descriptors under `src-tauri/gen/apple` for consistent local/device build behavior.
- Evidence code paths: `src-tauri/capabilities/default.json`, `src-tauri/gen/apple/codex-monitor.xcodeproj/project.pbxproj`, `scripts/build_run_ios_device.sh`.
- Refreshed project documentation and audit artifacts to align roadmap notes, site metadata, and UI/UX audit snapshots with current repository state.
- Synced guidance docs (`CLAUDE.md`, upstream plan notes, and docs pages) to reduce drift between process rules and implementation reality.
- Updated `repo-overview` scaffolding metadata/assets and local workspace extension recommendations for consistent contributor bootstrap behavior.
- Aligned codex args fallback-label test expectations with the current truncation policy used by badge/option labels.
- Evidence: `.runtime-cache/test_output/live-preflight/latest.json` and `.runtime-cache/test_output/real-llm/latest.json`.
- Evidence code paths: `src/features/threads/utils/codexArgsProfiles.ts`, `src/features/threads/utils/codexArgsProfiles.test.ts`.
- Calibrated the `threads` critical branch-coverage gate to match the enforceable local baseline while keeping `statements/lines/functions` critical thresholds unchanged.
- Raised `threads` critical branch-coverage threshold from `91%` to `92%` to tighten enforcement while matching the current measurable baseline.
- Evidence: `.runtime-cache/test_output/coverage-gate/latest.json`.
- Evidence code path: `scripts/coverage-gate.mjs`.
- Optimized pre-push gate runtime by removing duplicate full-test execution in `preflight` long phase while preserving quality enforcement through `test:coverage:gate`.
- Evidence: `.runtime-cache/test_output/coverage-gate/latest.json`, `.runtime-cache/test_output/live-preflight/latest.json`.
- Evidence code path: `scripts/preflight-orchestrated.mjs`.
- Added heartbeat verbosity levels to pre-push orchestration to reduce terminal IO noise while preserving long-task visibility (`PREFLIGHT_HEARTBEAT_LEVEL=normal|debug|quiet`).
- Default heartbeat now emits only for truly long-running tasks, with completion heartbeat summaries for traceability.

### Deprecated
- None

### Removed
- None

### Fixed
- Corrected protocol status/item/message phase literals in `useThreadsReducer` tests to match shared type unions, unblocking typecheck and pre-push gates.
- Evidence: `.runtime-cache/test_output/coverage-gate/latest.json`.
- Evidence code path: `src/features/threads/hooks/useThreadsReducer.test.ts`.

### Security
- None
