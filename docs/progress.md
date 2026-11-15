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

### 2026-11-14: Umang (lane C, authoring studio 6a)
- Done: first half of the authoring studio at `/author`. Shared contract helpers in
  `shared/authoring/schemas.ts`: optional `conceptId` on every activity and test item (the database
  needs a concept per test item for learning gain), `slugify`, `toDraftPayload` (exactly the
  `save_module_draft` JSON, keys split from content with `splitQuestion`) and `fromDraftRows` (the
  inverse, with ordering restored from the key and half-finished drafts still opening), all with
  tests including a full round trip. In `src/features/authoring/`: the typed API layer, "My modules"
  (status, Edit, New version), and the module editor (lessons and activities add, rename, delete,
  move up or down; video link with a live check, reading with a markdown preview and no raw HTML,
  required switch, concept picker with "New concept..."; Save draft with "Saved at", plain-language
  database errors, and a warning before leaving with unsaved changes). Published and submitted
  modules open read-only. Only CIC admins and instructors with `can_author` get in. Questions and the
  test builder are 6b; check, worksheet and exit activities keep any questions already saved.
  Checked on a local Supabase as a real author and admin: save, reload (module, pre-test and post-test
  come back equal), save again, submit, admin publish, frozen after publish, new version.
- Next: 6b: question editor, pre-test and post-test builder, submit and publish, student preview.
- Blocked: nothing.

### 2026-11-15: Umang (lane C, authoring studio 6b part 1)
- Done: question editor inside check, worksheet and exit activities: multiple choice (choices
  add, remove, reorder, pick the correct one), short answer (accepted answers one per line, case
  sensitive), fill in the blank (`___` markers, answers per blank kept in step with the text),
  ordering (items in the correct order; students see them shuffled) and reflection (not scored, no
  key). Every scored question has an explanation, up to 3 hints and its own concept; all of that
  goes in the key, never in content. Question ids are made once (`q-` plus 6 characters) and never
  changed. "Preview as student" on every activity, built from `splitQuestion` output so no key can
  show. To share the student view without features importing each other, `VideoEmbed`, `Reading`,
  `InlineCode` and `safeUrl` moved from the player to `src/components/learning/` (player imports
  updated, its tests unchanged and passing), plus a new presentational `QuestionPreview`.
- Next: 6b part 2: pre-test and post-test builder, submit for review, publish.
- Blocked: nothing.

### 2026-11-15: Umang (lane A, fix)
- Done: new migration `20261115090000_lane_a_fix_validate_module.sql`. `_validate_module` appended
  two plain string literals to a `text[]` with `||`, which Postgres reads as an array literal, so
  submitting or publishing a module with no pre or post test (or with no lessons) failed with
  "malformed array literal" instead of returning the warning or the error. Now `array_append`.
  New DB test covers both cases (it failed before the fix). Found while testing the studio end to end.
- Next: nothing for this; the studio's submit button relies on it.
- Blocked: nothing.

### 2026-11-15: Umang (lane D, admin console 7a)
- Done: `/admin` is now the CIC admin console, in tabs (`/admin/publish`, `/admin/staff`). Only CIC
  admins get in ("This page is for CIC admins."). Publish queue: submitted modules with author and
  date, Preview (read-only editor), Publish (with a confirm dialog; blocking problems from the
  database are listed) and Send back, plus the published list. Staff: invite form (role, "Can author"
  for instructors, explains the Google sign-in rule), invitations with Joined or waiting, and the
  staff list with a role select and author switch (your own row is locked). Removed the duplicate
  class creation form and module assignment from `/admin` (Jad's #16 and #17): the instructor feature
  has both, and admins see every class at `/instructor`. Nothing in them was unique (the admin form
  called `create_class`, which already lets an admin type a new school; a Schools tab comes in 7b).
  Moved the shared `QueryStatus` to `src/components/` and added a shared `Dialog`. Checked on a local
  Supabase as an admin: queue with author name, send back, publish, invite, staff list, role change,
  own-role refusal.
- Next: 7b: Classes, Schools, API keys, Mentors tabs.
- Blocked: nothing.

### 2026-11-15: Umang (lane E, docs 8b)
- Done: documentation pass. README rewritten (what it is, live URL placeholder, team table with
  handles we could confirm and a TODO for Koen's, "Try it" per role, built and not-yet features, the
  architecture diagram, run locally, cost, and every environment variable cross-checked against
  `.env.example` and `functions/_lib/env.ts`). New `SECURITY.md` (what we collect about minors, how
  access is enforced, secrets, known limits, a reporting placeholder). `docs/architecture.md` no longer
  says nothing is built, points to the v3 design, fixes the lanes table and matches the real tree. New
  `docs/adr/README.md`. API reference at `/api/docs` (Scalar pinned to 1.78.1 with an integrity hash;
  spec copy kept equal to `docs/openapi.yaml` by a test). A test now fails on any broken relative link in
  the markdown files (`docs/progress.md` is skipped: it is append-only) and on em dashes in the docs we wrote.
- Next: fill in the TODOs (live URL, Koen's handle, security contact, demo video link).
### 2026-11-15: Umang (lane E, reviewer view 8a)
- Done: `/review` is the read-only curriculum view for reviewers (and CIC admins; everyone else sees
  "This page is for curriculum reviewers."). Published modules with lesson and activity counts, the
  concepts they cover and a title search. `/review/:moduleId` walks one module in order with every
  activity rendered as a student sees it (the shared components in `src/components/learning/`),
  then the pre-test and post-test grouped by pair key so alignment can be judged. A banner on every page
  says "Read-only. Answer keys and student data are hidden by design." The page never calls
  `get_activity_keys`, `get_assessment_keys` or any write function, and content with a key field in it
  is refused rather than shown (tests check this on a mocked client). Checked on a local Supabase as a
  real reviewer: 1 module, 3 lessons, 7 activities, 5 pairs, no key field anywhere, a key request refused
  ("Not allowed to read these answer keys") and no progress rows visible.
- Next: 8b documentation.
- Blocked: nothing.

### 2026-11-15: Umang (all lanes, polish 9b)
- Done: the app is named "Coding in Color Learn" with a text logo and a title per route ("Activity | Coding
  in Color Learn"). Placeholder palette kept in `src/index.css` with a TODO naming what to change when CIC
  sends its colors (all pairs already meet WCAG AA). Nav links, sign out and the sign-in "Browse lessons" link
  are at least 44px tall; the skip link is more visible. Admin, author and reviewer demo-mode screens now have
  an h1 (they had none). Checked every route at 360px with a real browser: no sideways scroll, one h1 each, no
  axe problems (radio and checkbox rows are 44px tall). Lighthouse CI added (`lighthouse.yml`, action pinned
  by commit SHA, config in `lighthouserc.cjs`): accessibility is 100 on `/`, `/sign-in`, `/learn/explore` and
  `/review` when run locally (performance 63 to 95, best practices 100, SEO 82), and the job fails below 95.
  Playwright smoke test (`e2e/`, `npm run test:e2e`, `e2e.yml`) in demo mode: landing to sign-in, guest explore,
  opening a lesson, skip link and axe, and no sideways scroll on a phone. All data pages already had loading,
  empty and error states.
- Next: fill in CIC's colors; performance (the JavaScript bundle is large) if there is time.
### 2026-11-15: Umang (lane E, AI hints 9a)
- Done: `POST /api/hint` (Cloudflare Pages Function; logic in `shared/hint/` so it is tested without
  Cloudflare). It checks the body (zod, 4 KB), asks Supabase Auth who the student's token belongs to, and
  calls `get_activity` WITH THE STUDENT'S TOKEN (a locked or foreign activity is a 403). Only then it
  uses the service role, to read the answer key, count the student's hints (3 per activity, then 429),
  look in `hint_cache`, and write `hint_events`. With a `GEMINI_API_KEY` it asks `gemini-3.5-flash-lite`
  (stable, free tier; endpoint, `x-goog-api-key` header and request shape taken from the current Gemini
  docs on 2026-11-14) for one nudge with a 4 second timeout, sending only the question and the student's
  answer. It refuses output over 300 characters or that contains any correct answer (whole words, ignoring
  case and punctuation) and falls back to the next written ladder hint, or "Re-read the question and try
  one part at a time." An AI failure is never a 5xx. Nothing identifying goes to the model, and logs hold only
  the request id, status and source. New server variable `SUPABASE_ANON_KEY`. Deploy guide now sets
  `VITE_FEATURE_HINTS=true`. The instructor "Needs attention" list shows "Hints used".
  Checked end to end on a local Supabase through `wrangler pages dev`: a student got the written ladder,
  the 4th hint was 429, a locked activity was 403 and a bad token 401. The live Gemini call is NOT checked
  (no key); its shape is tested against a mocked fetch.
- Next: 9b polish; set `GEMINI_API_KEY` on Pages and try one real hint.

### 2026-11-14: Daxx (lane B + shared UI, design pass)
- Done: design system in `src/styles/tokens.css` matched to CIC's official logo (originals in
  `src/assets/brand/`): white, logo green chevrons, grey Courier wordmark. Every text pair >= 4.5:1,
  checked by script (the logo green is 4.03:1 with white, so buttons use #027a3d); fluid type
  scale; spacing, radius, shadow. Self-hosted Inter (body) + Courier Prime (headings, code)
  (`public/fonts/`, OFL licences beside them). SVG trace of the `< IN >` mark
  (`src/components/brand/CicLogo.tsx`), also the favicon. White header with the mark and
  Courier wordmark, 44 px nav targets (`src/app/Layout.tsx`, styling only),
  landing page hero + "How it works" (`src/app/Home.tsx`, same text and buttons), meta description,
  theme-color and font preload in `index.html`, `public/robots.txt`. Staff screens are now
  code-split with `src/lib/lazyPage.tsx` (one import line changed in each feature's `index.tsx`):
  main bundle 652 KB -> 433 KB (202 -> 132 KB gzip), so students no longer download the staff app.
- Lighthouse (mock build, `npm run build && npm run preview`): landing, sign-in, /learn and
  /learn/explore all 100 on Accessibility, Best Practices and SEO, mobile and desktop.
  Performance: desktop 100 everywhere; mobile 99 landing, 96 sign-in, 91 /learn, 92 explore.
- No horizontal scroll at 320, 375, 414, 768, 1024, 1280, 1440, 1920 px (DPR 2).
- Next: /learn mobile LCP (3.1 s simulated) waits on two data round-trips in a row (classes, then
  next activity + outline). One `get_student_home` RPC returning all three would remove one.
- Blocked: nothing.

### 2026-11-15: Umang (lane C, Parsons problems)
- Done: an ordering question can now be a Parsons problem (lines of code to put in order), which research
  finds gives similar learning to writing the code in less time (Ericson, Margulieux and Rick 2017; Ericson
  et al. 2022). In the studio, a checkbox on an ordering question ("These are lines of code") turns its items into
  monospace lines that keep their indentation. Students see the lines as code with "Your program so far" below,
  updated as they move lines (keyboard first, as before). The preview and the reviewer view show it as code too.
  Schema: `display: 'code'` on ordering content, and ordering items keep leading spaces (only trailing space is
  dropped). Grading is unchanged (the order is still only in the key). The demo seed's "Loops worksheet" ordering
  question is now a 4-line indented program.
- Next: live class view and catch-up plan.
### 2026-11-14: Krishna (lane E, per-student page in lane D's folder; Jad to review)
- Done: `/instructor/:classId/students/:studentId` (seat id or profile id), linked from a new Students
  roster on the class page and from the stuck and not-started lists. One page per student: status (not
  joined, not started, stuck, inactive, done, on track), completion against the class median, where they
  are now, every activity (tries, first try right or wrong, hints, minutes against the class median),
  learning gain with each pre/post question pair (learned, already knew, slipped, missing), concept mastery
  against the class average, the wrong choice they keep picking, active days and a 4-week calendar, hints,
  struggles, and suggested next steps. Actions: download CSV, print, reset login code (confirm first, the
  new code is shown once), allow a test retake (confirm first), and a drafted note the instructor copies
  and sends themselves. No migration: it reads the existing tables and views under row-level security.
  Analytics are pure functions (`student/report.ts`) with their own tests; demo mode shows a sample student.
  Checked against a local Supabase with a real instructor session: by seat id and by profile id, an
  unclaimed seat (no per-student reads), and a class the instructor does not teach (not found).
- Next: Find material for authors (YouTube and GitHub search, add to a lesson).
### 2026-11-14: Krishna (lane E, Find material; UI in lane C's folder, Umang to review)
- Done: "Find material" under each lesson in the authoring studio. An author types a topic, ticks
  sources (YouTube, freeCodeCamp, Harvard CS50, GitHub), picks the language of the material and the
  programming language, and adds a result to the lesson in one click: a video (embedded through
  youtube-nocookie, never copied) or a GitHub README as a reading (only under an open license, with
  images, badges and HTML removed, relative links made absolute, the source and license on the first
  line, cut to the 20,000 character limit with a link to the rest). Additions land in the unsaved
  draft like any other activity. `POST /api/sources/search` and `POST /api/sources/readme` (logic in
  `shared/sources/`): authors only (the caller's token, then `is_author()` with that token; no service
  role), zod-checked bodies, strict SafeSearch and embeddable-only videos, each source answers or says
  why not (not set up, out of quota, down) without failing the others, results cached by query for a
  day. GitHub uses best match plus "beginners" first, because sorting by stars returned famous but
  unrelated projects. New optional secrets `YOUTUBE_API_KEY` and `GITHUB_TOKEN`. The flaky studio test
  got a 20 second timeout. Checked through `wrangler pages dev` against local Supabase and the real
  GitHub API: 401 without a session, 403 for a non-author, YouTube "not set up" with GitHub results,
  422 for an unlicensed repository, 404 for a missing one, a repeat search from the cache. The live
  YouTube call is NOT checked (no key); its shape is tested against a mocked fetch and the current docs.
- Next: set `YOUTUBE_API_KEY` on Pages and try one real video search.

### 2026-11-15: Umang (lane C, funder impact report)
- Done: `/instructor/:classId/report`, a one-page learning-gain report a funder can read, linked as "Impact
  report for funders" from the class page. A headline sentence written from the numbers ("7 students in Demo
  Period 1 went from 46% on the pre-test to 80% on the post-test (+34 points). The biggest gain was in Loops:
  +38 points." on the seed data), pre and post averages, gain and normalized gain, per-concept bars with the
  same numbers in a table, students measured and missing a test, a note on method, Print or save as PDF, and a
  CSV per module. Class totals only: no student name or score appears, so it is safe to share. A student
  missing a test is counted as missing, never as zero (ADR 0020); groups under 5 are shown with a warning.
  Checked on a local Supabase as a real instructor; a class you do not teach says so plainly.
- Next: Parsons problems.
- Blocked: nothing.

### 2026-11-15: Umang (lanes A and B, catch-up plan)
- Done: a catch-up plan for students who miss class (chronic absence compounds, and attendance is uneven in
  CIC's programs). New migration `20261115110000_lane_a_catch_up.sql`: `get_catch_up` (student) and
  `get_class_catch_up` (class instructor or admin) return the steps still to do, in course order (pre-test,
  activities, post-test), with minutes estimated from the median time classmates actually spent (once 3 have
  finished; a default by kind before that), and how many steps behind the class median the student is. Only
  aggregates leave the functions. On Start here the student sees "You are 7 steps behind the class. That
  happens, and it is fixable: 8 steps left, about 19 minutes." (the seed's Cam R.) with the steps listed. DB tests
  per role; contract updated. The instructor "Catch-up" column on the live view follows once #41 merges.
- Next: Python in the browser (PRIMM).
- Blocked: nothing.

### 2026-11-14: Daxx (UI theme from the mockup)
- Done: every page now follows Daxx's mockup: mint backdrop with colour glows, frosted sticky header with
  a bold green Courier wordmark and right-aligned nav, gradient 3D `< IN >` mark on a frosted tile,
  glowing green primary buttons and gradient-edged outline buttons (shared `Button`), frosted cards with
  yellow/cyan/green tints. Lesson view: Courier titles on lesson and activity rows, Courier eyebrow
  labels, tinted status badges, yellow hint cards, gradient progress bars, activities on a frosted card.
  Contrast re-checked over the mint and each glow (lowest text pair 4.75:1).
- Lighthouse (mock build): Accessibility, Best Practices and SEO 100 on all four public pages, mobile
  and desktop; Performance desktop 100, mobile 100 / 97 / 90 / 92 (landing, sign-in, /learn, explore).
- Found: `/author` in demo mode shows only a sentence with no `<h1>` (lane C); one heading would fix it.
- Next: /learn mobile LCP (two data round-trips in a row), as above.
- Blocked: nothing.

### 2026-11-15: Daxx (late joiners: start at a module)
- Done: an instructor or CIC admin chooses the module a student starts at. Migration
  `20261115100000_lane_b_start_module.sql`: table `module_skips` (keyed on the roster seat, so it works
  before sign-in), `set_start_module(member_ids, module_id)`, and the unlock functions treat skipped
  modules as done (status `skipped`: open to review, never "Start here"). Progress and stuck views no
  longer count skipped work as missing; learning gain is unchanged. Player: "Skipped" badge, tallies
  ignore skipped work. Instructor: "Where do these students start?" on roster import and a "Starting
  point" section per class. Contract: `docs/contracts/database-api.md`.
- Tests: 3 new DB tests (placement before sign-in, reset to the beginning, who may place), 3 outline
  tests, 7 instructor UI tests.
- Open question for CIC: should "Not started" and learning gain treat placed students differently?

### 2026-11-15: Daxx (stale-code crash on /learn)
- Found: "Something broke on this page" on /learn/explore. Cause (reproduced): the page's code file
  could not be downloaded, `Failed to fetch dynamically imported module` (the dev server had been
  stopped with the tab open). The same happens in production to any tab left open across a deploy.
- Done: `src/lib/chunkReload.ts`. A failed code download reloads the page once (at most once per 30 s,
  so an outage cannot loop), used by the player and by `lazyPage` for every staff screen. If it still
  fails, the /learn crash screen says "This page needs a fresh copy" instead of "Something broke".
  Logs `app.chunk_reload` (warn) and `app.route_error` with `stale_code`. 12 tests.

### 2026-11-15: Daxx (open lessons for signed-in students)
- Found in browser tests against local Supabase: (1) /learn/explore told a signed-in student "You're
  browsing as a guest" and offered "Save my progress" (a second account); (2) a student whose class
  has the open module got "This activity is locked" from get_activity, which the client did not
  recognise (it only knew the bare code), so it retried and loaded for a long time; (3) a student
  whose class does NOT have it could not open it at all (can_read_module), though guests can.
- Done: explore and the open-activity page show a signed-in version ("Open lessons for practice",
  "Practice done", Go to Start here; no guest prompts or device-only badges). errors.ts maps "is locked"
  to `locked`, so the class activity page's "Not open yet" now works against the real database; the
  open-activity page says "This lesson is part of your class". Migration
  `20261115120000_lane_b_open_lessons_for_students.sql`: CIC Open modules readable by anyone (already
  public to guests; keys unaffected). Tests: 6 player tests, 1 DB test (failed before the fix).

### 2026-11-15: Daxx (end-to-end journey against local Supabase)
- Ran a 12-step browser journey on a phone-sized screen against the local database: join link, name
  pick, pre-test, video, reading, check (wrong then right), module map, progress, sign out. 12/12 pass,
  no console errors.
- Fixed: the module map said "Module 0" / "Lesson 0" (the database counts positions from 0, the mock
  from 1); it now numbers by list order (test added). The video embed set fullscreen twice
  (`allow` and `allowFullScreen`), which made browsers warn on every video page.

### 2026-11-15: Daxx (catch-up plan meets late-joiner placement)
- Found while merging main: the catch-up plan (lane A) and start-at-a-module (lane B) were built in
  parallel. The plan listed every untaken test and unfinished activity in opened modules, so a student
  started at module 3 was told to catch up on modules 1 and 2. Also both branches used migration number
  20261115110000; mine is now 20261115120000.
- Done: `20261115130000_lane_b_catch_up_skips.sql` leaves skipped modules out of `_catch_up_steps`
  (same signature and grants). DB test added (fails on the old function, passes now). Note: `behind_by`
  still compares completed counts with the class median, so a placed student can show as "behind";
  worth a decision with Umang.
### 2026-11-14: Krishna (lane E; "Submit for review" in lane C's folder, Umang to review)
- Done: authors could not send a draft to the publish queue (the database had `submit_module`; no
  screen called it), so a new version of a module could never be published. The editor now has
  **Submit for review** for a saved draft: it asks first, refuses while there are unsaved changes,
  lists the database's "Fix these first" reasons one per line, and on success reloads the module
  locked, with the database's warnings shown as notes for the reviewer and focus moved to them. The
  admin publish queue then shows it as before.
- Next: an instructor assigns the new version to a class (students on version 1 stay on it).

### 2026-11-15: Umang (lanes A and C, code activities 6a: data)
- Done: the data layer for Python-in-the-browser activities. New migration
  `20261115140000_lane_a_code_activities.sql`: a `code` activity kind with content `{prompt, starter, predict?,
  tests[]}` (up to 10 visible `assert` checks, starter up to 10 KB), and `submit_answer` accepts
  `{code, passed, total, prediction?}`, checks the counts match the activity, completes only when every check
  passes, and otherwise says "1 of 2 checks pass. Read the first failing check and run your code again."
  Shared schema, `toDraftPayload` and `fromDraftRows` support it (round-trip tested). Found and fixed on the way:
  the content-shape CHECK passed when a field was missing (a NULL result passes a CHECK), so a video with no
  embed URL was accepted; it is now wrapped in `coalesce(..., false)` for every kind, with a DB test. SECURITY.md
  and the contract say plainly that code is graded in the browser, so it is practice, not the measure of learning.
  The studio picker and the player pick up the new kind in the next two changes.
- Next: 6b, the Pyodide runner in the player.
- Blocked: nothing.

### 2026-11-15: Umang (lane B folder, code activities 6b: Python runner in the player)

- Done: students can write and run real Python on the activity page, with no install and no account. Python
  (Pyodide 314.0.8, pinned on jsDelivr) loads in a Web Worker only when a code activity opens. A run that takes
  over 5 seconds is stopped by ending the worker, so `while True:` never freezes a Chromebook; the next run
  starts a fresh one. The page follows PRIMM: predict first (Run stays off until there is a guess), run, then
  change the code until every visible check passes. Errors get a plain-language line next to Python's own
  message ("On line 2: Python doesn't know the name "totl" yet..."). The editor is a monospace textarea where Tab
  adds 4 spaces and Escape then Tab leaves it. Demo mode has a sample activity (`act-loops-code`, optional) and
  the mock grader uses the same count rules as `submit_answer`. Playwright runs real Python on desktop: output,
  an error, an endless loop, then a passing fix.
- Next: 6c, the code activity editor in the studio and read-only previews.
### 2026-11-15: Umang (lane D, live class view)
- Done: `/instructor/:classId/live`, linked as "Live class view" from the class page, for the projector or the
  teacher's laptop during class. A "Needs help now" panel (who is stuck, on which activity, and why in plain
  words), then a grid of every signed-in student against every required activity in order, each cell an icon and
  a word (Done, Working, Stuck, Not started) so color is never the only signal, with "N here, M done" per activity.
  Refreshes every 20 seconds, with Pause. Names show as initials by default so the screen can be projected
  without singling anyone out; "Show full names" switches them on. Reads `progress`, `v_class_progress` and
  `v_stuck` through row-level security. Checked on a local Supabase as a real instructor of Demo Period 1:
  10 students across 7 activities, the seeded stuck student flagged on step 6, nothing visible for a class
  you do not teach.
- Next: catch-up plan for students who missed class.
- Blocked: nothing.

### 2026-11-15: Umang (lanes A and B, My notebook)

- Done: under every activity a student can "Explain it in your own words" (the self-explanation effect, Chi et
  al. 1994). It saves on Save or when they leave the box, and `/learn/:classId/notebook` collects every note by
  module and lesson, with links back and a print button, so they can review in their own words before the
  post-test. Linked as "My notebook" on Start here. New migration `20261115150000_lane_a_student_notes.sql`:
  `student_notes` (RLS on, no client policy), `save_note` (trimmed, up to 2000 characters, empty deletes, only on
  activities the student can read) and `get_my_notes` (own notes only). Notes are private, even from instructors
  and admins, and kept in the database because classroom Chromebooks are shared. SECURITY.md and the contract
  say so. Demo mode has the same behavior. DB tests per role, mock API, component and page tests with axe.
- Next: 6c (studio code editor), misconception radar.
### 2026-11-15: Krishna (lane E, hints through the OHack AI gateway)
- Done: hints can use an OpenAI-compatible gateway (`AI_GATEWAY_URL`, `AI_GATEWAY_KEY`, optional
  `AI_MODEL`, default `gpt-oss-120b`) instead of Gemini, so the demo has live AI hints with the team's
  OHack key. gpt-oss rather than muse-spark because the gateway says muse-spark prompts may be used for
  training, and these prompts hold students' answers. Same rules as Gemini: only the question and the
  answer are sent, 300 characters at most, refused if it gives the answer away, 8 second limit, written
  ladder on any failure (including when the OHack key expires after the event). Tested with a mocked
  gateway; the live call is checked on the deployed site.
- Blocked: nothing.

### 2026-11-15: Umang (lane C, code activities 6c: studio and previews)

- Done: "Code (Python)" is now in the studio's activity picker. Authors write the task (markdown), an optional
  predict question, starter code and up to 10 visible checks (one `assert` per line). "Preview as student" and
  the reviewer view show it read-only through a shared `src/components/learning/CodePreview.tsx`. The seed has
  an optional code activity in the Loops lesson ("Try it: count with a loop"), so the signed-in demo shows it too.
- Next: misconception radar.

### 2026-11-15: Umang (lanes A and D, misconception radar)

- Done: "What to reteach" at `/instructor/:classId/reteach`, linked from the class page. For each question
  where 2 or more students were wrong on their FIRST try (what they thought before feedback; a check only
  completes when right, so the latest try would hide it), it shows how many and the most common wrong answers
  in words, for example "4 students chose "32"" on `x = x + 2`. New migration
  `20261115160000_lane_a_misconceptions.sql`: `get_class_misconceptions` (class instructor or admin; no answer
  keys returned). The seed gains first tries for Demo Period 1 so the demo shows real patterns. DB test, unit
  tests for the answer wording.
- Next: note home drafter, belonging wording, certificate.
- Blocked: nothing.

### 2026-11-15: Umang (lane D folder, note home)

- Done: "Note home" on the instructor's student page. "Draft a note home" writes a short, positive-first message
  for the family from the report (what they finished, a real gain, a strength, what is next and one way to help
  at home, a warm line if they have been away). The instructor edits it and copies it into their own school
  tool: nothing is sent from the app. Works in demo mode too. Research: personal messages home raised completion
  (Kraft and Rogers 2015).
- Next: belonging wording, completion certificate.
- Blocked: nothing.

### 2026-11-15: Umang (lane B folder, completion certificate)

- Done: when a student has taken a module's post-test, My progress shows "View my certificate for <module>",
  which opens a printable certificate at `/learn/:classId/certificate/:moduleIndex`: their display name, the
  module, the class, the date, and their pre-to-post growth when it is positive. Before the post-test the page
  says how to earn it. Built from data the student already sees; nothing new is stored. Page titles added for
  the certificate and the notebook.
- Next: the larger testing pass across all new features, then the demo.
- Blocked: nothing.
### 2026-11-15: Umang (lanes B and C, belonging moments)

- Done: a wrong answer now also shows a short "struggle is normal" line ("Every coder gets stuck. A wrong try
  shows you what to change next."), one of three, chosen from the feedback so it does not flicker. In the
  studio, "Add a Coder spotlight" adds an optional reading template for a coder students can see themselves in,
  with every detail in [brackets] and a placeholder note, because CIC must supply real stories with permission.
  Research: Walton and Cohen 2011 (belonging), Scott, Sheridan and Clark 2015 (culturally responsive computing).
- Next: completion certificate.
- Blocked: real Coder spotlight stories from CIC.

### 2026-11-15: Umang (lane B folder, notes side panel)

- Done: "Notes" in the student bar opens a notes panel next to the lesson (a docked column on wide screens, a
  bottom sheet on phones) that stays open while the student moves between activities and follows the activity
  they are on. Notes save by themselves a moment after typing stops, when the box loses focus, and when the
  student moves on. Recent notes and a link to the whole notebook sit below. Replaces the box under each
  activity (an activity page now has "Take notes on this", which opens the panel).
- Found: the hosted Supabase project does not have the migrations from 20261115110000 onward (get_my_notes,
  get_class_misconceptions and others return PGRST202), so the deployed notebook says "That service isn't
  available". Fix: `npx supabase db push` against the hosted project (docs/deploy.md).
- Blocked: the hosted migrations need someone with the database password.
### 2026-11-15: Daxx (real video transcripts)
- Done: "Read the transcript" now shows the video's real transcript (its YouTube captions) with
  timestamps, instead of only the author's short summary. `GET /api/transcript?videoId=` (Pages Function,
  logic in `shared/transcript/handler.ts`) asks Supadata (`mode=native`, captions only, no paid AI jobs)
  and caches every answer in `video_transcripts` (migration `20261115161700_lane_b_video_transcripts.sql`,
  service role only), so each video costs one of the free plan's 100 monthly requests, ever. Only videos
  in a published lesson are fetched, so the quota cannot be spent on random ids. The player loads it
  only when the student opens the section; if it is unavailable (no captions, no key, quota) the
  author's summary shows instead. Key: `SUPADATA_API_KEY` (README, deploy.md, SECURITY.md).
- Tests: 17 handler tests, 9 component tests (incl. axe). Real REST queries checked on local Supabase.
- Needs: a Supadata key in Cloudflare Pages, and the migration on the hosted project.
### 2026-11-15: Krishna (lane E; staff invites and removal, in lanes A and D, Koen and Jad to review)
- Done: invited staff became students on their first Google sign-in. Supabase creates a Google user
  first and confirms the email in a later update, so the insert trigger never saw a confirmed email;
  the invite only applied when an admin invited them a second time. `20261115170000` applies the
  invite when the email becomes confirmed (same rules, never overrides a role set by hand) and repairs
  accounts that already hit it. The old test inserted the user already confirmed, so it missed this.
- Done: `remove_staff` and `cancel_staff_invite` (`20261115171000`) and the buttons on the admin Staff
  tab. Remove takes access away but keeps the account: role back to a plain account, off the classes
  they teach, mentor assignments ended, invite removed; modules, API keys and history stay, and a new
  invite restores them. Never yourself (so an admin always remains), staff only, CIC admins only. The
  confirm step lists the classes that would be left with no instructor. Cancel invite deletes only an
  unused invite. Decisions from Krishna: remove access rather than delete the account; allow removing
  a class's only instructor, with a warning; add Cancel invite.
- Next: `npx supabase db push --remote` for both migrations, then redeploy.
- Blocked: nothing.

### 2026-11-15: Daxx (transcripts: English only)
- Found with a real Supadata key on a local Wrangler run: the seed lesson (an English CS Dojo video) came
  back in Arabic, 2 paragraphs, because without `lang` Supadata returns the first caption track it finds,
  here a partial translation.
- Done: `/api/transcript` asks for `lang=en`; any other language is treated as "no transcript" (author's
  summary shows, logged as `wrong_language`). A non-English transcript already in the cache is ignored and
  replaced, so the live site repairs itself with no manual clean-up. Same video now: English, 61 timed
  paragraphs over 24 minutes. 3 new tests (20 in the handler).

### 2026-11-15: Umang (lane E files, security headers S-50, S-51, S-59)

- Done: `public/_headers` sets a Content-Security-Policy (only the origins the app uses: Supabase, jsDelivr for
  Pyodide, the YouTube no-cookie player, YouTube thumbnails), nosniff, Referrer-Policy, Permissions-Policy,
  X-Frame-Options DENY with frame-ancestors 'none', and HSTS, and drops Cloudflare's default wildcard CORS on static
  files. The API docs page gets a separate policy for Scalar. `functions/api/_middleware.ts` adds nosniff, no-store,
  no-referrer and frame denial to every JSON API response, since `_headers` does not reach Functions. Tested by
  serving the exact policy in Playwright: video, Python and every main route ran with zero CSP violations.
- Next: re-run the header scan on the live URL after deploy.
- Blocked: nothing.
