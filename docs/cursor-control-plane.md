# Cursor Agent Control Plane (No IDE)

This runbook provides a practical path to run and manage multiple Cursor Agent sessions without opening Cursor IDE windows.

## Architecture

- Execution layer (official): `cursor-agent` or `cursor` CLI.
- Session orchestration layer: `scripts/cursor/sessions.mjs` + manifest.
- Panel layer (optional): `claudecodeui` bootstrap via `scripts/cursor/panel-bootstrap.mjs`.
- History/asset layer (optional): external read-only browser/export tools.

## Quick Start

1. Check runtime prerequisites:

```bash
npm run cursor:doctor
```

2. Initialize local manifest:

```bash
npm run cursor:manifest:init
```

This creates:

- `.runtime-cache/cursor/cursor-agents.manifest.json`

3. Review generated commands (no side effects):

```bash
npm run cursor:sessions:print
```

4. Start all sessions in one tmux session:

```bash
npm run cursor:sessions:tmux
```

5. Attach to tmux if needed:

```bash
tmux attach -t cursor-agents
```

## Manifest Schema

Reference file:

- `docs/examples/cursor-agents.manifest.example.json`

Fields:

- `tmuxSessionName`: tmux session namespace.
- `sessions[]`: each logical agent workspace.
  - `name`: stable human-readable identifier.
  - `repoPath`: workspace root path.
  - `prompt`: used for new session start.
  - `resumeId`: used for restoring existing chat.
  - `startCommand`: explicit override command (highest priority).

Command precedence per session:

1. `startCommand`
2. `resumeId`
3. `prompt`

## Optional Panel Bootstrap

Print bootstrap commands only:

```bash
npm run cursor:panel:bootstrap
```

Clone and start panel with Docker:

```bash
npm run cursor:panel:bootstrap:docker
```

Defaults:

- Repo: `https://github.com/siteboon/claudecodeui.git`
- Target: `.runtime-cache/cursor/panel/claudecodeui`

## Safety Notes

- Keep execution authority in official CLI (`cursor-agent`/`cursor`), use panel as orchestration UX.
- Use read-only history tools first before granting wider local storage/token access.
- Keep panel/runtime data under `.runtime-cache/` to avoid repository pollution.
