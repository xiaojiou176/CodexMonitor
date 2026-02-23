# Upstream Patch Inventory

Track all local patch deltas that diverge from upstream.

## How to Use

- Add one row per logical patch or tightly coupled patch set.
- Update status after each upstream sync cycle.
- Remove rows when patch is merged upstream and dropped locally.

| Patch ID | Scope | Local Commit(s) | Upstream Baseline | Owner | Status | Conflict Notes | Drop Condition |
|---|---|---|---|---|---|---|---|
| PATCH-001 | _example_ | `abc1234` | `origin/main@<sha>` | `@owner` | Active | _none_ | Upstream ships equivalent feature |
