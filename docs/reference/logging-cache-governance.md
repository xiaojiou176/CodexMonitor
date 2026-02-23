# Logging and Cache Governance

## Logging Policy

CodexMonitor uses structured local logs for audit-relevant errors and warnings.

- Storage: app data `logs/`
- Format: JSONL (one event per line)
- Rotation threshold: 10 MiB per active file
- Retention: max 5 files, max age 14 days

Implementation:

- Core logic: `src-tauri/src/shared/logging_core.rs`
- Tauri command bridge: `append_structured_log`
- Frontend logger service: `src/services/logger.ts`

## Runtime Cache Policy

In-memory caches must be bounded by size and (where needed) TTL.

Current bounded policies:

- `useGitDiffs`: max 32 keys, TTL 5 minutes
- `useGitStatus`: max 64 keys, TTL 60 seconds
- `useOpenAppIcons`: max 256 keys, TTL 1 hour
- `fileTypeIcons`: max 512 keys (LRU)

Shared utility: `src/utils/boundedCache.ts`

## Startup Cleanup

On app startup:

- Prune stale log files by age and max file count.
- Prune stale `.runtime-cache` files older than retention threshold.

## Operational Rules

- Logging failures must not block primary product flows.
- Cache eviction is expected behavior; components must tolerate misses.
- New long-lived caches must use bounded storage before merge.
