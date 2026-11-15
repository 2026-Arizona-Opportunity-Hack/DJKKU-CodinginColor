# Progress log

**Append-only.** Add new entries at the bottom. Never edit, reorder or delete an
earlier entry; if something was wrong, add a new entry that corrects it. This is
the honest history of what happened, and git blame shows who wrote it.

## Entry format

```
### YYYY-MM-DD [HH:MM MST]: <name> (lane X)
- Done: what changed (link the PR or issue)
- Next: what is planned
- Blocked: what is in the way (or "nothing")
```

Keep entries short. Times are Arizona time (MST). Link to issues and PRs
instead of repeating them.

## Log

### 2026-11-14: Krishna (lane E)
- Done: created the working branch and the docs scaffold (requirements,
  architecture, decisions, tradeoffs, audits, this log). Content comes from the
  team design plan, Nov 14 revision. Nothing is implemented yet.
- Next: scaffold the Vite app and deploy it to Cloudflare Pages; write the
  decision entries; draft the read API contract with Koen (lane A).
- Blocked: `gh` CLI not installed locally; Cloudflare Pages access to the org repo not yet confirmed.

### 2026-11-14: Umang (lane C)
- Done: checked GitHub for a scaffold or schema (none yet). Started lane C with
  pure logic in `lane-c-logic/`: learning gain math, paired-item scoring,
  group summary, CSV export with formula-injection guard, 20 passing Vitest
  tests. Decisions: [ADR 0019](adr/0019-learning-gain-definition.md),
  [ADR 0020](adr/0020-lane-c-logic-folder.md). Audit entry added. Handoff
  notes for lane A in `docs/handoffs/lane-c.md`.
- Next: zod authoring schemas (question types, answer-key split, YouTube
  validation, assessment pairs), then `lane_c_proposal.sql` to sync with Koen.
- Blocked: nothing. Waiting on a Vite scaffold and lane A schema before any UI.

### 2026-11-14: Umang (lane C)
- Done: opened PR #3 (gain math, CSV). Added zod authoring schemas in
  `lane-c-logic/src/schemas.ts`: question types, answer-key split, YouTube
  validation, modules, assessments and pair warnings. 52 tests pass. Wrote
  `supabase/migrations/lane_c_proposal.sql` (tables, RLS, `v_learning_gain`),
  clearly marked as an untested proposal. ADRs 0021 and 0022, tradeoffs, audit
  entry and lane A handoff updated.
- Next: get Koen to review the SQL proposal; SQL role tests once the Supabase
  CLI runs locally; studio UI as soon as a Vite scaffold is on main.
- Blocked: no app scaffold or lane A schema on main yet. SQL is unverified.


### 2026-11-14: Krishna (lane E)
- Done: scaffolded the app (Vite, React, TypeScript, Tailwind, React Router) with
  one folder per feature in `src/features/`, registered in `src/app/features.ts`;
  `functions/` with a health check and typed env; `shared/` and the `supabase/`
  layout; Vitest with first tests (Jad's stuck logic, a feature-registry guard); a
  CI workflow draft (lint, typecheck, test, build, gitleaks); and a fuller
  "Stack, commands and layout" section in `AGENTS.md` (lane ownership, recipes,
  conventions). Not pushed yet.
- Next: push in small PRs; connect Cloudflare Pages and verify `/api/health`; run
  CI on GitHub; add Lighthouse CI; write the OpenAPI contract with Koen.
- Blocked: Cloudflare access to the org repo is unconfirmed. Local Node must be
  22.12 or newer.

### 2026-11-14: Umang (lane C, correction)
- Done: merged Krishna's scaffold (PR #5) into `lane-c/gain-math` and fixed the
  overlaps. Corrections to my entry above: the learning gain ADR is now
  [0020](adr/0020-learning-gain-definition.md) (Krishna took 0019 for repo
  structure) and the folder ADR is [0021](adr/0021-lane-c-logic-folder.md),
  now superseded. Code moved from `lane-c-logic/` to `shared/authoring/`, as
  the scaffold rules require. Fixed Jad's review comment on PR #3: duplicate
  `pairKey` values are now excluded from gain and reported. Root `npm run lint`,
  `typecheck` and `test` pass (34 tests).
- Next: rebase PR #4 the same way (schemas move to `shared/authoring/`, add
  `zod`), then merge order #5, #3, #4.
- Blocked: PR #5 must merge first.

### 2026-11-14: Umang (lane C, correction)
- Done: merged the scaffold and PR #3 into PR #4's branch. ADR numbers moved
  again: keys split is now [0022](adr/0022-keys-split-from-content.md) and
  module versions is [0023](adr/0023-immutable-module-versions.md); earlier
  entries above that cite 0021/0022 mean these. Schemas moved to
  `shared/authoring/schemas.ts`; added `zod` as a root dependency (already in the
  decided stack).
- Next: merge order #5, #3, #4. SQL role tests once Koen reviews the proposal.
- Blocked: nothing.

### 2026-11-14: Umang (lane C, PR #4 review)
- Done: reviewed PR #4 (no teammate comments). Found and fixed two SQL issues:
  any instructor could read every draft, and inserts did not force
  `created_by`. Added `supabase/tests/lane_c_rls.test.ts` (12 per-role tests on
  PGlite, devDependency `@electric-sql/pglite`); a mutation check confirmed the
  tests fail when RLS is broken. Merged `main` into the branch.
- Next: koen to review the SQL; re-run the tests against lane A's real helpers;
  studio UI in `src/features/authoring/`.
- Blocked: nothing.

### 2026-11-14: Umang (lane C, covering lane A)
- Done: reviewed the lane A draft files and rebuilt them as one consolidated, tested
  database: 5 migrations, a seed, and 35 per-role tests against a real local Supabase
  (Docker). Shaped to lane C's content types and to the RPC names lane B's adapter calls.
  Adds the unlock engine, grading in SQL, one-shot tests, the authoring and publishing
  flow (`save_module_draft`, `submit_module`, `publish_module`, `new_module_version`),
  roster import, join and login codes, admin functions, staff invites, and views for the
  dashboards and the read API. Full list of findings in `docs/audits.md`. Docs:
  [ADR 0024](adr/0024-lane-a-database-design.md),
  [docs/contracts/database-api.md](contracts/database-api.md), `supabase/README.md`.
  New CI file `.github/workflows/db-tests.yml` (lane E: please check it).
- Next: lane B, D and E wire to the RPCs in the contract; studio UI calls `save_module_draft`.
- Blocked: nothing. Koen should review the rebuild against the original drafts.

### 2026-11-14: Krishna (lane E)
- Done: merged PRs #3, #4 and #5; `main` passes lint, typecheck and 78 tests. Read
  the organizers' CIC brief and recorded what it adds: the read API's consumer (CIC's
  existing dashboard), camps with no student accounts, slides as curriculum, prior art
  (NMTSA LMS), the P1/P2 menu, and logo/palette link. Proposals for the API shape and a
  `slides` activity kind are marked as ours, in `docs/requirements.md` and
  `docs/architecture.md`. Also recorded the mentors' Slack answers (guidance, not
  CIC's decision) in `docs/requirements.md`.
- Next: follow up with CIC on the dashboard (the tool was asked on Slack; header vs URL
  key, JSON vs CSV, totals and frequency were not); draft `docs/openapi.yaml` with Koen's
  view names; Cloudflare Pages deploy.
- Blocked: CIC's answers on the dashboard; Cloudflare access to the org repo.


### 2026-11-14: Umang (lane A)
- Done: added the migration `20261114160000_lane_a_session_and_staffing.sql`. `get_me()` gives the
  player and the sign-in redirect the user's role, display name and claimed class (it did not
  exist, so every `/learn` page errored in Supabase mode). `add_class_instructor` and
  `remove_class_instructor` let an admin staff a class, because the seeded demo classes had no
  instructor and `create_class` only makes the caller the instructor. 10 new DB tests (45 in `supabase/tests`). Contract and README updated, including the note on `next_activity`
  returning `null` when the next step is a pre or post test.
- Next: sign-in page (next PR) reads `get_me`; lane B checks `get_class_outline` when `next_activity` is null.
- Blocked: nothing.

### 2026-11-14: Umang (lane A, covering auth)
- Done: built the sign-in feature (M1) in `src/features/auth/`. `/sign-in` takes a student login code
  (anonymous session, then `claim_login_code`) or Google for staff; `/join/:joinCode` lists unclaimed names
  and claims one. A 12-character code typed into the student box goes to the join page, 16 is a login code.
  Shared `src/lib/session.ts` (`get_me` parsing, `useMe`, `homePathFor`, anonymous sign-in with a friendly
  429 message). The nav now follows the role, with a "no access" page for the wrong role (RLS is still the
  real gate), the home page sends signed-in people to their own screen, and `shared/roles.ts` now says
  `cic_admin` like the database. Demo mode (no Supabase URL) is labelled and keeps the mock player working.
  `supabase/config.toml` redirect URLs point at the Vite dev server. 42 new tests, including axe checks.
- Next: the player adapter reads `get_me` (its schema needs `class_id` and `class_name` to be nullable);
  the hosted project needs the Cloudflare Pages URL under Auth > URL Configuration.
- Blocked: nothing.

### 2026-11-14: Umang (lane A, covering the player)
- Done: made the student player work against the real database. The player now reads the
  real `get_me` shape (staff and students without a class get a plain message instead of an
  error). "Start here" no longer tells a new student they are finished: `next_activity` is null when
  a pre-test or post-test is next, so a new `nextStep` helper reads the outline and shows "Start:
  <module> pre-test", "Continue: <activity>" or "Finish: <module> post-test". The mock now
  matches the database on this (and on a module only counting as finished after its post-test).
  Self-register uses an anonymous session plus the `self_register` function (the `/api/self-register`
  endpoint never existed), copies device progress right away and shows the login code once.
  Progress numbers are rounded for display and a missing gain reads "Not yet". Checked on a
  local Supabase: a student who claims `DEMO-0000-0000-0001` is sent to the pre-test, and the first
  activity opens once it is taken. Only `src/features/player/` changed.
- Next: lane E's `/api/hint` stays behind `VITE_FEATURE_HINTS`; a browser pass over `/learn` on the hosted project.
- Blocked: nothing.

### 2026-11-14: Umang (lane A, covering instructor, 4a class setup)
- Done: instructor home at `/instructor` with the class in the URL (`/instructor/:classId`).
  New in `src/features/instructor/`: class picker, create-class form (zod in `shared/classes.ts`),
  class link card (`create_join_code`, shown once, copy buttons and a QR code), roster import
  now wired to the selected class (its own class dropdown is gone) with a "Print login sheet" button,
  a printable 2 x 4 login sheet (codes kept in memory only, QR drawn locally with the MIT `qrcode`
  library), and module assignment (`assign_module`). Every section has loading, empty and error
  states. Checked each call against a local Supabase as a real instructor (create, join code,
  roster, published modules, assign). The old dashboard is unchanged below the setup sections; 4b
  replaces it with real views. Jad built class creation and module assignment under `/admin`; these
  are separate instructor-side copies because features may not import each other.
- Next: 4b, the dashboard on real views.
- Blocked: nothing.

### 2026-11-14: Umang (lane A, deploy prep)
- Done: wrote [docs/deploy.md](deploy.md), the click-by-click Supabase and Cloudflare Pages
  guide (project, migrations and seed, Google and anonymous sign-in, URL configuration, raising the
  anonymous sign-in limit from 30 to 500, first admin, teammates, API key, and a check list). Local
  config now matches (`anonymous_users = 500`). README has a Live demo placeholder and Demo logins.
  Checked on local runs: Pages serves deep links such as `/learn/x` and `/join/...` without any
  config (a `_redirects` rule `/* /index.html 200` is rejected by Pages as an infinite loop, so none
  was added), `/api/*` still reaches the Functions, and the read API returns the two demo classes for
  a new key. Found and fixed in the docs: the SQL editor has no signed-in user, so `invite_staff`,
  `add_class_instructor` and `create_api_key` refuse to run there unless a `set_config` line comes
  first; the earlier README steps leaving that out were wrong. Also removed the "keep the limit
  low" advice and the duplicate "CIC Open" step for seeded projects.
- Next: someone with the Cloudflare and Supabase accounts follows the guide; paste the live URL into the README.
- Blocked: needs the human with the dashboard accounts.
### 2026-11-14: Umang (lane A, CI)
- Done: pinned the Supabase CLI in `.github/workflows/db-tests.yml` to 3.1.0. With `version: latest`
  the setup step asks the GitHub API for the newest release, and that call hit "rate limit exceeded"
  on the shared runners, so the database job failed in about 20 seconds on PRs #22 and #23 with no
  code problem (re-running it passed once). Lane E: this is your file area, please check it.
- Next: re-run the database job on open PRs after this lands.
- Blocked: nothing.
