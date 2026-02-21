# Upstream Sync Runbook

This runbook defines the standard process for maintaining local custom patches
while regularly syncing upstream updates.

## Branch Model

- `vendor/upstream`: mirror of upstream base, no product changes.
- `custom/main`: local patch stack rebased on `vendor/upstream`.
- `topic/*`: short-lived implementation branches.

## Default Remote Resolution

Sync scripts now auto-detect remote in this order:

1. `upstream`
2. `origin`

You can still override with `--upstream-remote <name>`.

## Routine Sync Steps

1. Dry-run:
   - `npm run sync:upstream:dry`
2. Full sync:
   - `npm run sync:upstream`
3. Verification:
   - `npm run sync:verify`
   - For quick divergence scan: `npm run sync:verify:fast`

## Conflict Handling

- Resolve conflicts on `custom/main` during rebase.
- Reuse conflict resolutions with `git rerere` where possible.
- Document notable conflict classes in patch inventory notes.

## Mandatory Validation Gates

- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `cd src-tauri && cargo check`

## Rollback

If rebase or validation is unstable:

1. Abort current rebase (`git rebase --abort`).
2. Return to last known good commit/tag.
3. Record failure reason and conflict summary in the patch inventory.
