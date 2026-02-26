# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- TBD

### Changed
- Improved responsive layout behavior across desktop/tablet views, including sidebar interactions and panel resizing flows.
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

### Deprecated
- None

### Removed
- None

### Fixed
- TBD

### Security
- None
