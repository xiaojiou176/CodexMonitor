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

### Deprecated
- None

### Removed
- None

### Fixed
- TBD

### Security
- None
