# 0021. Lane C pure logic lives in its own folder until the app exists

Status: Superseded (the scaffold landed in PR #5; the code now lives in `shared/authoring/`)
Date: 2026-11-14

## Context
No Vite scaffold or Supabase schema existed on `main` when lane C started. Pure
logic (gain math, CSV export, authoring schemas) needs neither.

## Decision
Put it in `lane-c-logic/` with its own `package.json`, Vitest and TypeScript,
mirroring Jad's `lane-d-logic/`. When the Vite app lands, move the files to
`src/lib/` and delete the folder in a small PR. Code in it has no UI or
network imports, so the move is a copy.

## Alternatives considered
- Wait for the scaffold: wastes hours.
- Create the root `package.json` ourselves: likely to conflict with whoever
  scaffolds the real app.

## Consequences
Two `package.json` files for a while. CI does not run these tests until the
root setup exists; run `npm test` inside `lane-c-logic/`.
