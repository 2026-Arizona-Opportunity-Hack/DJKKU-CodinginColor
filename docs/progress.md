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

