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
- Local git gates also block staged secret patterns and commit-message secret patterns.

## Environment Variable Guidance

- Use environment variables for local machine-specific values only.
- Prefer explicit settings UI fields for stable application behavior.
- Keep `.env` usage limited to script workflows; document required keys per script.
- Key source policy: keys/tokens/secrets are only allowed from terminal environment variables or local `.env`/`.env.local` loading flows.
- Forbidden key sources: hardcoded literals, query string parameters, browser storage, cookies, or committed non-template env files.
- Canonical env schema is defined in `config/env.schema.json`.
- Env drift/validity gate is `npm run env:doctor` (also executed in pre-commit/pre-push orchestrated flows).
- Runtime-prefixed env key drift gate is `npm run env:rationalize:check`.
- Canonical env matrix is documented in `docs/reference/env-matrix.md`.

## Security Gates (Local)

- `npm run check:secrets:staged`: scans staged added lines for secret-like literals and blocks tracked `.env*` files except example templates.
- `npm run check:keys:source-policy`: blocks staged code that reads secrets from forbidden sources.
- `npm run check:commit-message:secrets -- <commit-msg-file>`: blocks secret-like material in commit messages.

## Validation and Guardrails

- Type-level defaults and normalization live in:
  - `src-tauri/src/types.rs`
  - `src/features/settings/hooks/useAppSettings.ts`
- Config file reads/writes are centralized through:
  - `src-tauri/src/shared/files_core.rs`
  - `src-tauri/src/shared/config_toml_core.rs`
