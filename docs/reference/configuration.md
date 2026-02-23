# Configuration Reference

## Sources of Configuration

CodexMonitor reads configuration from these layers:

1. App persisted settings: `settings.json` under Tauri app data directory.
2. Workspace persisted data: `workspaces.json` under Tauri app data directory.
3. Codex global config: `$CODEX_HOME/config.toml` (or `~/.codex/config.toml`).
4. Runtime environment variables (selected flows).

## Priority Rules

- Explicit runtime inputs (command args / request payloads) override defaults.
- Persisted app settings override compile-time defaults.
- When `CODEX_HOME` is set, it overrides home-based fallback paths.
- Missing optional settings fall back to safe defaults in `src-tauri/src/types.rs`.

## Sensitive Values

- Sensitive remote backend values must not be copied into docs/examples.
- Keep local env files outside version control.
- CI secret scanning is enabled (`gitleaks` in `.github/workflows/ci.yml`).

## Environment Variable Guidance

- Use environment variables for local machine-specific values only.
- Prefer explicit settings UI fields for stable application behavior.
- Keep `.env` usage limited to script workflows; document required keys per script.

## Validation and Guardrails

- Type-level defaults and normalization live in:
  - `src-tauri/src/types.rs`
  - `src/features/settings/hooks/useAppSettings.ts`
- Config file reads/writes are centralized through:
  - `src-tauri/src/shared/files_core.rs`
  - `src-tauri/src/shared/config_toml_core.rs`
