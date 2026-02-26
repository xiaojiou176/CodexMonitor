# Env Final Delivery Report

Date: 2026-02-26

## Final Counts (Single Source of Truth)

- canonical_count: **11**
- runtime_usage_count: **12**
- broad_env_like_count: **183**
- .env variant files: **4**
- .env union keys: **21**

## Env Variant Files

- `.env` (5 keys)
- `.env.example` (5 keys)
- `.env.local` (5 keys)
- `.testflight.local.env.example` (11 keys)

## Full Key Inventory (Requirement #1)

Complete inventory is listed in this file under `## Full Key Inventory` (183 keys, same-day generated state, no historical merge).

## Keep / Migrate / Remove (Requirement #2)

### Keep (canonical schema)
- `GEMINI_API_KEY`
- `PLAYWRIGHT_BASE_URL`
- `PLAYWRIGHT_WEB_PORT`
- `REAL_EXTERNAL_URL`
- `REAL_LLM_BASE_URL`
- `REAL_LLM_MODEL`
- `REAL_LLM_TIMEOUT_MS`
- `TAURI_DEV_HMR_PORT`
- `TAURI_DEV_HOST`
- `TAURI_DEV_PORT`
- `VITE_SENTRY_DSN`

### Migrate (moved out of .env.example)
- `REAL_EXTERNAL_URL`
- `GEMINI_API_KEY`
- `REAL_LLM_BASE_URL`
- `REAL_LLM_MODEL`
- `REAL_LLM_TIMEOUT_MS`

### Remove / Block
- `ANTHROPIC_API_KEY`
- `OPENAI_API_KEY`
- `REAL_LLM_API_KEY`

## Unique Source List (Requirement #3)

Requested unique-source categories:

| Source | Count | Keys |
| --- | ---: | --- |
| `.env` | 5 | `PLAYWRIGHT_WEB_PORT`, `TAURI_DEV_HMR_PORT`, `TAURI_DEV_HOST`, `TAURI_DEV_PORT`, `VITE_SENTRY_DSN` |
| `CI secrets` | 11 | `APPLE_API_ISSUER_ID`, `APPLE_API_KEY_ID`, `APPLE_API_PRIVATE_KEY_B64`, `APPLE_CERTIFICATE_P12`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_TEAM_ID`, `CODESIGN_IDENTITY`, `GITHUB_TOKEN`, `NOTARY_PROFILE_NAME`, `TAURI_SIGNING_PRIVATE_KEY_B64`, `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` |
| `release template` | 11 | `APP_ID`, `BETA_DESCRIPTION`, `BETA_GROUP_NAME`, `BUNDLE_ID`, `FEEDBACK_EMAIL`, `LOCALE`, `REVIEW_CONTACT_EMAIL`, `REVIEW_CONTACT_PHONE`, `REVIEW_FIRST_NAME`, `REVIEW_LAST_NAME`, `REVIEW_NOTES` |

Note: Inventory also includes `code/script internal` (152 keys) and `mixed(.env,CI secrets)` (5 keys), retained in the full table for audit completeness.

## Mixed-Source Keys Hard List (Requirement #4)

| Key | Current Source | Remediation Status | Final Governance |
| --- | --- | --- | --- |
| `GEMINI_API_KEY` | mixed(.env,CI secrets) | ✅ 已整改：从 `.env.example` 迁出 | Local `.env/.env.local` for dev-live, CI secret for pipeline live |
| `REAL_EXTERNAL_URL` | mixed(.env,CI secrets) | ✅ 已整改：从 `.env.example` 迁出 | Local `.env/.env.local` for local external testing, CI secret/var for CI live |
| `REAL_LLM_BASE_URL` | mixed(.env,CI secrets) | ✅ 已整改：从 `.env.example` 迁出 | Local `.env/.env.local` or CI secret/var |
| `REAL_LLM_MODEL` | mixed(.env,CI secrets) | ✅ 已整改：从 `.env.example` 迁出 | Local `.env/.env.local` or CI secret/var |
| `REAL_LLM_TIMEOUT_MS` | mixed(.env,CI secrets) | ✅ 已整改：从 `.env.example` 迁出 | Local `.env/.env.local` or CI secret/var |

## Alias Retirement Evidence (Requirement #5)

- Deprecated list contains alias: `config/env.schema.json`
- Deprecated aliases in schema: `REAL_LLM_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`
- Alias gate command: `npm run check:real-llm-alias-usage`
- Alias gate policy source: `scripts/check-real-llm-alias-usage.mjs`
- Phase-3 gate hardening commit: `189cd176`

## Gate Pass Log Summary (Requirement #6)

Latest execution summary is documented in this section after running:

- `npm run check:real-llm-alias-usage`
- `npm run env:rationalize:check`
- `npm run preflight:doc-drift`
- `npm run precommit:orchestrated`

### Result Snapshot

| Command | Status | Key Log |
| --- | --- | --- |
| `npm run check:real-llm-alias-usage` | ✅ passed | `[env-alias-usage] passed.` |
| `npm run env:rationalize:check` | ✅ passed | `unknown runtime keys=0`, `template_unread_keys=0`, `[env-rationalize] passed.` |
| `npm run preflight:doc-drift` | ✅ passed | `[doc-drift] No staged changes. Skipping.` |
| `npm run precommit:orchestrated` | ✅ passed | `[precommit] All gates passed.` |

## Phase 3 Gate Hardening (Current)

- `check-real-llm-alias-usage` now blocks all keys listed in `config/env.schema.json -> deprecatedKeys` outside controlled allowlist paths.
- `preflight-doc-drift` now requires this file (`docs/reference/env-final-report.md`) to be changed whenever env/workflow-sensitive files change.
- `env:rationalize:check` remains dual-blocking:
  - block unknown runtime-prefixed keys (not in schema/allowlist)
  - block `.env.example` keys that are not directly read in code

## Before vs After Variable Count Comparison (Requirement #7)

| Metric | Before | After |
| --- | ---: | ---: |
| .env.example keys | 10 | 5 |
| canonical_count | 12 | 11 |
| runtime_usage_count | n/a | 12 |
| broad_env_like_count | 182 (historical) | 183 |
| mixed-source keys | 5 | 5 (all moved out of `.env.example`) |
| deprecated aliases in active runtime paths | unknown | 0 (enforced by gate) |

ASCII Trend:

- .env.example: `##########` -> `#####`
- canonical_count: `############` -> `###########`

## Full Key Inventory

| Key | Unique Source | In Schema | Deprecated |
| --- | --- | --- | --- |
| `ADD_FILE_SOURCES` | code/script internal | no | no |
| `ADD_FILE_TARGETS` | code/script internal | no | no |
| `AESBITS` | code/script internal | no | no |
| `ALLOW_DIRTY` | code/script internal | no | no |
| `APPDATA` | code/script internal | no | no |
| `APPLESCRIPT_FILE` | code/script internal | no | no |
| `APPLE_API_ISSUER_ID` | CI secrets | no | no |
| `APPLE_API_KEY_ID` | CI secrets | no | no |
| `APPLE_API_PRIVATE_KEY_B64` | CI secrets | no | no |
| `APPLE_CERTIFICATE_P12` | CI secrets | no | no |
| `APPLE_CERTIFICATE_PASSWORD` | CI secrets | no | no |
| `APPLE_DEVELOPMENT_TEAM` | code/script internal | no | no |
| `APPLE_TEAM_ID` | CI secrets | no | no |
| `APPLICATION_CLAUSE` | code/script internal | no | no |
| `APPLICATION_LINK` | code/script internal | no | no |
| `APP_ARCH_DIR` | code/script internal | no | no |
| `APP_ID` | release template | no | no |
| `APP_PATH` | code/script internal | no | no |
| `BACKGROUND_CLAUSE` | code/script internal | no | no |
| `BACKGROUND_FILE` | code/script internal | no | no |
| `BACKGROUND_FILE_NAME` | code/script internal | no | no |
| `BASELINE_RANGE` | code/script internal | no | no |
| `BASH_SOURCE` | code/script internal | no | no |
| `BETA_DESCRIPTION` | release template | no | no |
| `BETA_GROUP_ID` | code/script internal | no | no |
| `BETA_GROUP_ID)` | code/script internal | no | no |
| `BETA_GROUP_NAME` | release template | no | no |
| `BLESS` | code/script internal | no | no |
| `BUILD_EXIT` | code/script internal | no | no |
| `BUILD_ID` | code/script internal | no | no |
| `BUILD_NUMBER` | code/script internal | no | no |
| `BUILD_NUMBER)` | code/script internal | no | no |
| `BUILD_UPLOADED_AT` | code/script internal | no | no |
| `BUILD_VERSION` | code/script internal | no | no |
| `BUNDLE_ID` | release template | no | no |
| `CARGO_CFG_TARGET_OS` | code/script internal | no | no |
| `CARGO_MANIFEST_DIR` | code/script internal | no | no |
| `CARGO_PKG_NAME` | code/script internal | no | no |
| `CARGO_PKG_VERSION` | code/script internal | no | no |
| `CDMG_SUPPORT_DIR` | code/script internal | no | no |
| `CDMG_VERSION` | code/script internal | no | no |
| `CI` | code/script internal | no | no |
| `CLEAN_BUILD` | code/script internal | no | no |
| `CODESIGN_IDENTITY` | CI secrets | no | no |
| `CODEX_HOME` | code/script internal | no | no |
| `CODEX_MONITOR_DAEMON_TOKEN` | code/script internal | no | no |
| `CODEX_MONITOR_ORBIT_AUTH_URL` | code/script internal | no | no |
| `CODEX_MONITOR_ORBIT_RUNNER_NAME` | code/script internal | no | no |
| `CODEX_MONITOR_ORBIT_TOKEN` | code/script internal | no | no |
| `COVERAGE_MIN_STATEMENTS` | code/script internal | no | no |
| `CRITICAL_LOG_GUARD_BYPASS` | code/script internal | no | no |
| `CRITICAL_LOG_GUARD_MODE` | code/script internal | no | no |
| `CURRENT_BRANCH` | code/script internal | no | no |
| `CUSTOM_BRANCH` | code/script internal | no | no |
| `CUSTOM_SIZE` | code/script internal | no | no |
| `DEFAULT_ENV_FILE` | code/script internal | no | no |
| `DESKTOP_DIR` | code/script internal | no | no |
| `DEV` | code/script internal | no | no |
| `DEVELOPMENT_TEAM` | code/script internal | no | no |
| `DEVICE` | code/script internal | no | no |
| `DEV_NAME` | code/script internal | no | no |
| `DISK_IMAGE_SIZE` | code/script internal | no | no |
| `DISK_IMAGE_SIZE_CUSTOM` | code/script internal | no | no |
| `DMG_DIR` | code/script internal | no | no |
| `DMG_DIRNAME` | code/script internal | no | no |
| `DMG_NAME` | code/script internal | no | no |
| `DMG_PATH` | code/script internal | no | no |
| `DMG_TEMP_NAME` | code/script internal | no | no |
| `DRY_RUN` | code/script internal | no | no |
| `ENABLE_ENCRYPTION` | code/script internal | no | no |
| `ENTITLEMENTS_PATH` | code/script internal | no | no |
| `ENV_DOCTOR_STRICT_REAL_LLM_ALIAS` | code/script internal | no | no |
| `ENV_FILE` | code/script internal | no | no |
| `ERROR_1728_WORKAROUND_SLEEP_INTERVAL` | code/script internal | no | no |
| `EULA_FORMAT` | code/script internal | no | no |
| `EULA_RESOURCES_FILE` | code/script internal | no | no |
| `EULA_RSRC` | code/script internal | no | no |
| `FALLBACK_APP` | code/script internal | no | no |
| `FEEDBACK_EMAIL` | release template | no | no |
| `FILESYSTEM` | code/script internal | no | no |
| `FILESYSTEM_ARGUMENTS` | code/script internal | no | no |
| `FORMAT` | code/script internal | no | no |
| `GEMINI_API_KEY` | mixed(.env,CI secrets) | yes | no |
| `GITHUB_OUTPUT` | code/script internal | no | no |
| `GITHUB_STEP_SUMMARY` | code/script internal | no | no |
| `GITHUB_TOKEN` | CI secrets | no | no |
| `HDIUTIL_FILTER` | code/script internal | no | no |
| `HDIUTIL_VERBOSITY` | code/script internal | no | no |
| `HIDING_CLAUSE` | code/script internal | no | no |
| `HOME` | code/script internal | no | no |
| `ICON_SIZE` | code/script internal | no | no |
| `IMAGEKEY` | code/script internal | no | no |
| `IOS_APP_ICONSET_DIR` | code/script internal | no | no |
| `IPA_PATH` | code/script internal | no | no |
| `IS_DIRTY` | code/script internal | no | no |
| `LANG` | code/script internal | no | no |
| `LC_ALL` | code/script internal | no | no |
| `LD_LIBRARY_PATH` | code/script internal | no | no |
| `LIST_DEVICES` | code/script internal | no | no |
| `LLVM_CONFIG_PATH` | code/script internal | no | no |
| `LOCALAPPDATA` | code/script internal | no | no |
| `LOCALE` | release template | no | no |
| `LOG_DIR` | code/script internal | no | no |
| `LOG_FILE` | code/script internal | no | no |
| `MB_SIZE` | code/script internal | no | no |
| `MIN_DISK_IMAGE_SIZE` | code/script internal | no | no |
| `MODE` | code/script internal | no | no |
| `MOUNT_DIR` | code/script internal | no | no |
| `MOUNT_DIR)` | code/script internal | no | no |
| `MOUNT_RANDOM_PATH` | code/script internal | no | no |
| `MUTATION_MIN_SCORE` | code/script internal | no | no |
| `MUTATION_MUTATE` | code/script internal | no | no |
| `NC` | code/script internal | no | no |
| `NODE_VERSION` | code/script internal | no | no |
| `NOINTERNET` | code/script internal | no | no |
| `NOTARIZE` | code/script internal | no | no |
| `NOTARY_PROFILE_NAME` | CI secrets | no | no |
| `NPM_BIN` | code/script internal | no | no |
| `NVM_DIR` | code/script internal | no | no |
| `OPEN_XCODE` | code/script internal | no | no |
| `OS_FULL_VERSION` | code/script internal | no | no |
| `OS_MAJOR_VERSION` | code/script internal | no | no |
| `OUT_DIR` | code/script internal | no | no |
| `PATH` | code/script internal | no | no |
| `PATHEXT` | code/script internal | no | no |
| `PLAYWRIGHT_BASE_URL` | code/script internal | yes | no |
| `PLAYWRIGHT_WEB_PORT` | .env | yes | no |
| `POSITION_CLAUSE` | code/script internal | no | no |
| `PRECOMMIT_COMPLIANCE_MODE` | code/script internal | no | no |
| `PROGRAMDATA` | code/script internal | no | no |
| `QL_CLAUSE` | code/script internal | no | no |
| `QL_LINK` | code/script internal | no | no |
| `REAL_EXTERNAL_URL` | mixed(.env,CI secrets) | yes | no |
| `REAL_LLM_API_KEY` | code/script internal | no | yes |
| `REAL_LLM_BASE_URL` | mixed(.env,CI secrets) | yes | no |
| `REAL_LLM_MODEL` | mixed(.env,CI secrets) | yes | no |
| `REAL_LLM_TIMEOUT_MS` | mixed(.env,CI secrets) | yes | no |
| `REPOSITION_HIDDEN_FILES_CLAUSE` | code/script internal | no | no |
| `REPO_DIR` | code/script internal | no | no |
| `REPO_ROOT` | code/script internal | no | no |
| `REUSE_GUARD_BYPASS` | code/script internal | no | no |
| `REVIEW_CONTACT_EMAIL` | release template | no | no |
| `REVIEW_CONTACT_PHONE` | release template | no | no |
| `REVIEW_FIRST_NAME` | release template | no | no |
| `REVIEW_LAST_NAME` | release template | no | no |
| `REVIEW_NOTES` | release template | no | no |
| `ROOT_DIR` | code/script internal | no | no |
| `RUST_VERSION` | code/script internal | no | no |
| `SANDBOX_SAFE` | code/script internal | no | no |
| `SCRIPT_DIR` | code/script internal | no | no |
| `SET_TIMEOUT` | code/script internal | no | no |
| `SHELL` | code/script internal | no | no |
| `SIGNATURE` | code/script internal | no | no |
| `SIMULATOR_NAME` | code/script internal | no | no |
| `SKIP_BUILD` | code/script internal | no | no |
| `SKIP_GATES` | code/script internal | no | no |
| `SKIP_JENKINS` | code/script internal | no | no |
| `SKIP_SUBMIT` | code/script internal | no | no |
| `SOURCE_SIZE)` | code/script internal | no | no |
| `SRC_FOLDER` | code/script internal | no | no |
| `STRICT` | code/script internal | no | no |
| `TARGET` | code/script internal | no | no |
| `TAURI_DEV_HMR_PORT` | .env | yes | no |
| `TAURI_DEV_HOST` | .env | yes | no |
| `TAURI_DEV_PORT` | .env | yes | no |
| `TAURI_SIGNING_PRIVATE_KEY_B64` | CI secrets | no | no |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | CI secrets | no | no |
| `TESTFLIGHT_ENV_FILE` | code/script internal | no | no |
| `TEXT_SIZE` | code/script internal | no | no |
| `UPLOAD_STARTED_AT` | code/script internal | no | no |
| `UPSTREAM_BRANCH` | code/script internal | no | no |
| `UPSTREAM_REMOTE` | code/script internal | no | no |
| `USERPROFILE` | code/script internal | no | no |
| `USER_MODE` | code/script internal | no | no |
| `VENDOR_BRANCH` | code/script internal | no | no |
| `VITE_SENTRY_DSN` | .env | yes | no |
| `VOLUME_ICON_FILE` | code/script internal | no | no |
| `VOLUME_NAME` | code/script internal | no | no |
| `WEBKIT_DISABLE_COMPOSITING_MODE` | code/script internal | no | no |
| `WINH` | code/script internal | no | no |
| `WINW` | code/script internal | no | no |
| `WINX` | code/script internal | no | no |
| `WINY` | code/script internal | no | no |
| `XDG_DATA_HOME` | code/script internal | no | no |

## Artifacts

- `.runtime-cache/reports/env-key-inventory.json`
- `.runtime-cache/env_audit_total_keys.txt`
- `.runtime-cache/test_output/real-llm/latest.json`
- `.runtime-cache/test_output/live-preflight/latest.json`
