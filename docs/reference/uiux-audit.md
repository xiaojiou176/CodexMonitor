# UI/UX Audit Hooks

## Scope
This repository enforces two UI/UX gates:

1. `pre-commit`: static UI/UX linting via Stylelint (`.stylelintrc.json`)
2. `pre-push`: Gemini intelligent UI/UX audit via `scripts/gemini-uiux-audit.mjs`

## Pre-commit (Stylelint)
- Hook id: `stylelint-uiux`
- Target files: `*.css`, `*.scss`
- Rule focus:
  - disallow invalid hex
  - disallow `!important`
  - enforce valid CSS properties/selectors
  - design-token guard: color properties must use `var(...)` instead of hardcoded hex/rgb/hsl

## Pre-push (Gemini)
- Hook id: `gemini-uiux-audit`
- Default model: `gemini-3.0-flash`
- Key source priority:
  1. `GEMINI_API_KEY` environment variable
  2. repository root `.env`
- File scope: `tsx/jsx/css/scss/html`
- Diff scope: git diff hunks only (prefers `--cached`, then `HEAD~1..HEAD`, then `HEAD`)

The script prints JSON and exits non-zero when:
- `GEMINI_API_KEY` is missing
- Gemini API/network call fails
- model returns `severity: "error"` findings

## Manual run examples
```bash
node scripts/gemini-uiux-audit.mjs src/App.tsx src/styles/app.css
pre-commit run --all-files
pre-commit run --all-files --hook-stage pre-push
```
