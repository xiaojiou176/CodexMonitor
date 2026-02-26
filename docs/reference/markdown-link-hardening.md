# Markdown Link Hardening Audit

Date: 2026-02-26

## Scope

- Harden markdown URL protocol checks against mixed-case and obfuscated unsafe schemes.
- Keep allowed external protocols explicit and case-insensitive (`http`, `https`, `mailto`).

## Changed Code

- `src/features/messages/components/Markdown.tsx`
- `src/features/messages/components/Messages.test.tsx`

## Evidence Artifacts

- `.runtime-cache/test_output/live-preflight/latest.json`
- `.runtime-cache/test_output/real-llm/latest.json`

## Validation

- Unit coverage added for:
  - mixed-case allowed protocols remain clickable
  - obfuscated javascript-like protocols are blocked
