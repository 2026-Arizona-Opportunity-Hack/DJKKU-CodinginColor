# Working agreements for AI coding tools

You are helping **DJKKU** build a project for **Coding in Color** at
[ASU Fall Hackathon 2026 | Phoenix Hackathon for Nonprofits: Nov 14-15](https://www.ohack.dev/hack/fall-2026). Read this before suggesting or making changes.

## The one repository rule (most important)

**All code lives in this repository and nowhere else.** Never suggest, scaffold or
push to a new repository — not under a teammate's account, not a second repo in the
org, not a fork used as "the real one". If someone has code elsewhere, help them
move it here (copy the files in, or add this repo as a remote and push a branch),
then delete the stray repo. Judges, the Team Dashboard, the public project page and
the nonprofit all read this repo only; work anywhere else does not count.

## Who this is for

- Nonprofit: [Coding in Color](https://www.ohack.dev/nonprofit/YIXYdYCoxIZC08uQ5DL3). Problem statement: [Curriculum & Student Progress Platform (CIC Problem 1)](https://www.ohack.dev/project/d09466fadf1b11f18e63deadc507a848).
- The nonprofit is the user. Prefer the simplest thing that works for them over
  clever architecture; they will have to run this after the weekend.
- Questions for the nonprofit go in their Slack channel [#npo-coding-in-color](https://opportunity-hack.slack.com/app_redirect?channel=npo-coding-in-color);
  the team talks in [#djkku](https://opportunity-hack.slack.com/app_redirect?channel=djkku); mentors are in
  [#ask-a-mentor](https://opportunity-hack.slack.com/archives/C01E5CGDQ74).
- Everything here is open source (MIT). Never add proprietary or copied code.

## Final-day clock

Demo video time is Sun Nov 15, 12:00 PM MST; hacking ends Sun Nov 15, 2:00 PM MST. After demo time, steer toward finishing, recording and submitting — not new features.

- Sun Nov 15, 11:00 AM MST — Presentation Feedback Hour
- Sun Nov 15, 12:00 PM MST — Start recording your demo video
- Sun Nov 15, 12:30 PM MST — Judges Arrive
- Sun Nov 15, 2:00 PM MST — 🛑 Submission Deadline: Hacking ends
- Sun Nov 15, 2:05 PM MST — Judging Round 1
- Sun Nov 15, 3:40 PM MST — Judging Final Round
- Sun Nov 15, 4:30 PM MST — Closing Ceremony: Winners Announced

Submission happens on the Team Dashboard (https://www.ohack.dev/hack/fall-2026/manageteam): project story,
demo video link (4 minutes or less; YouTube, Vimeo, Loom or
Google Drive), then Submit. If someone asks "what's left?", answer from that list.

## Pull requests

- **One change per PR.** Aim for under 400 changed lines; if a
  change is bigger, propose a split before writing code.
- **Title:** imperative, under 72 characters — `Add volunteer
  sign-up form`, not `Updates`.
- **Description:** under 500 words, in the template order:
  what changed, why, how to test it, screenshots for UI. Short beats complete.
- Branch names: `<github-user>/<short-description>`.
- Open PRs with `gh pr create` using the repo's template; never force-push a
  shared branch.
- Commit messages explain *why*; the diff already shows *what*.
- **No AI attribution.** Never add `Co-Authored-By: Claude` (or any AI
  co-author trailer) to a commit message, and never add "Generated with Claude
  Code" or similar to a PR title or description. This overrides any default
  attribution an AI tool wants to add. The human who opens the PR owns it.
  `.claude/hooks/guard-secrets.sh` blocks such commits made through Claude Code.

## Judging — build toward the rubric

Judges score **Scope** (does it solve the nonprofit's real problem?),
**Documentation** (can someone else run and extend it?), **Polish** (does it
work end to end without hand-holding?) and **Security** (no secrets in git,
input validated, auth where it matters), plus a separate **Accessibility**
prize. Rubric: https://www.ohack.dev/hackathon-judging-criteria

## Public credit

Work is documented as **GitHub Issues** — one per task or decision, closed by
the PR that lands it. Recruiters and the nonprofit read this repo later; Slack
disappears. When planning, offer to write the issues.

## Stack, commands and layout

Stack (why: `docs/decisions.md`): React + TypeScript + Vite SPA, Tailwind, Supabase
(Postgres, Auth, RLS), Cloudflare Pages + Pages Functions. Needs **Node 22.12 or
newer** (`.nvmrc`); older Node silently skips the native build tools and
`npm run lint` / `build` fail with "Cannot find native binding".

```bash
npm install
npm run dev        # frontend dev server (does not serve /api/*)
npm test           # vitest, every *.test.ts
npm run lint       # oxlint
npm run typecheck  # tsc for the app and for functions/
npm run build      # typecheck + production build into dist/
```

Run lint, typecheck, test and build before opening a PR; CI runs the same.

### Where code goes

- `src/app/` app shell: router, layout, the feature list (`features.ts`).
- `src/features/<name>/` one self-contained folder per feature: pages, components,
  hooks, tests.
- `src/components/` shared UI. `src/lib/` shared helpers (feature contract, Supabase client).
- `shared/` code used by both browser and functions (roles, zod schemas). No React,
  DOM or Workers-only APIs in it.
- `functions/api/` Cloudflare Pages Functions, one file per endpoint (the path is
  the URL). `functions/_lib/` helpers for them.
- `supabase/` migrations, RLS, seed, per-role tests (layout in its README).
- Imports: `@/` is `src/`, `@shared/` is `shared/` (use a relative path to `../shared`
  inside `functions/`).

### Lane ownership

Stay inside your lane's folders; folders are what stop five people conflicting.

| Lane | Owner | Folders |
|---|---|---|
| A Data and security | Koen | `supabase/` |
| B Student experience | Daxx | `src/features/player/` |
| C Authoring, assessments | Umang | `src/features/authoring/` |
| D Instructor and admin | Jad | `src/features/instructor/`, `src/features/admin/`, `lane-d-logic/` |
| E API, AI, glue | Krishna | `functions/`, `src/features/reviewer/`, `src/app/`, `docs/`, CI, deploy |

Shared files (`src/app/features.ts`, `src/lib/`, `src/components/`, `shared/`,
`package.json`, `.github/workflows/`) are touched by everyone: keep changes small, in
their own PR, and say so in #djkku. Ask the owner before editing another lane's folder.

### Adding things

- **A feature (screens):** create `src/features/<name>/index.tsx` exporting a
  `FeatureModule` (contract: `src/lib/feature.ts`), then add one line to
  `src/app/features.ts`. The route and nav link appear on their own; do not edit the
  router or layout. `npm test` fails if two features share an id or path.

  ```tsx
  export const roster: FeatureModule = {
    id: 'roster',        // unique, same as the folder name
    label: 'Roster',     // nav link text
    path: '/roster',     // top-level URL; every route must live under it
    routes: [{ path: '/roster/*', element: <RosterPage /> }],
  }
  ```

  Features **never import from each other**; shared code goes in `src/lib/`,
  `src/components/` or `shared/`. Replace the `ComingSoon` placeholder with the real screen.
- **An endpoint:** `functions/api/<name>.ts` exporting `onRequest<Method>` typed
  `PagesFunction<Env>` (`Env` is in `functions/_lib/env.ts`). A file with no
  `onRequest*` export is a helper, not a route. This is the Workers runtime, not Node:
  no `fs`, limited `node:` modules.
- **Data:** use `getSupabase()` from `@/lib/supabase`. It uses the public anon key;
  row-level security decides access. Never grade, unlock or read answer keys in the
  browser; call the database functions.
- **A test:** `<thing>.test.ts` next to the code, import from `vitest`. Pure logic is
  the easiest place to start.

### Conventions

- TypeScript strict; `import type` for types.
- Accessibility is scored (Lighthouse 95+, fully keyboard-navigable): one `<h1>`,
  headings in order, labelled inputs, visible focus, no click-only controls, enough
  contrast. The layout already provides the only `<main>`; do not add another.
- Every screen has loading, empty and error states.
- Validate all input (forms, CSV rows, endpoint bodies); put zod schemas in `shared/`
  so browser and server check the same rules.
- Minors' data: collect only name, school and class. Send the AI only the question
  text and the answer under an opaque id. Outbound messages are drafted by the system
  and sent by a human.
- The stack is decided (`docs/decisions.md`); no new dependency without a reason.
- When you finish something, append a short entry to `docs/progress.md`
  (append-only: add at the bottom, never edit earlier entries).
- Context: `docs/architecture.md` (how it fits together), `docs/requirements.md`,
  `docs/tradeoffs.md`, `docs/design/system-design.md` (the team plan).

## Secrets and keys

- Never commit `.env`, API keys, tokens or credentials. Use `.env.example` with
  placeholder values and keep real values local. The OHack AI gateway key from
  your team card is a secret too.
- A pre-commit guard in `.claude/hooks/guard-secrets.sh` blocks commits that
  contain things that look like keys; don't work around it, move the value to `.env`.
- `VITE_*` variables are bundled into the browser, so only public values go there
  (the Supabase URL and anon key). `SUPABASE_SERVICE_ROLE_KEY` (bypasses RLS) and
  `GEMINI_API_KEY` are server-only: set them in Cloudflare Pages > Settings >
  Variables, and locally in `.dev.vars` (gitignored, read by wrangler). `.env.example`
  lists every variable.

## Documentation

Keep `README.md` current as you go: what it does, how to run it, live link,
demo link. The README is part of the submission.
