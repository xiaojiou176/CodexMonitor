# Dependency Maintenance Policy

## Scope

This policy covers JavaScript (`npm`) and Rust (`cargo`) dependencies used by
CodexMonitor.

## Baseline Cadence

- Weekly: run dependency audit checks and review high/critical findings.
- Monthly: evaluate minor/patch upgrades for core dependencies.
- On security advisory: run emergency patch cycle.

## Required Gates

- JavaScript:
  - `npm audit --audit-level=high`
- Rust:
  - `cargo audit`
- Secrets:
  - `gitleaks` scan in CI

## Upgrade Process

1. Create a dedicated branch.
2. Upgrade dependencies in small, reviewable batches.
3. Run repository quality gates:
   - `npm run lint`
   - `npm run typecheck`
   - `npm run test`
   - `npm run test:e2e:smoke`
   - `cd src-tauri && cargo check && cargo test`
4. Merge only with green CI and no unresolved high/critical advisories.

## Ownership

- Repository maintainers own the dependency update cadence.
- PR authors must include upgrade impact notes when touching major versions.
