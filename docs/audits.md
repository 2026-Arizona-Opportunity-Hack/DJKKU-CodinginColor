# Audit reports

Evidence that we checked our own work against the rubric: security,
accessibility, and the things CIC depends on. Judges score Security and Polish;
a dated report with real output is stronger than a claim in the README.

## Rules

- Add each audit run as a dated section under **Reports** below (or, if it gets
  long, as `docs/audits/YYYY-MM-DD-<area>.md` linked from the index).
- Record what was run, the actual result (real output or numbers), what failed,
  and the issue or PR that fixed it.
- Failures stay in the report. When something is fixed, add a new run; do not
  delete the failing one.
- Never paste secrets, real student data or API keys.

## Report template

```markdown
### YYYY-MM-DD <area>
Commit: <sha> · Run by: <name> · Command/tool: <how it was run>

| Check | Result | Notes |
|---|---|---|

Findings:
- [severity] what, where, fix (issue #/PR #)
```

## Planned audits

| Area | What to check | Rubric category | Status |
|---|---|---|---|
| Secrets | gitleaks in CI; `.env` never tracked; guard hook active | Security | Not run |
| RLS per role | One script per role (student, independent, mentor, instructor, admin, reviewer) proving each reads only what the permission table allows and the reviewer cannot write | Security | Not run |
| Answer-key isolation | No student or reviewer query can read `activity_keys` | Security | Not run |
| Read API | No key → 401; revoked key → 401; groups under 5 suppressed; no per-student rows | Security | Not run |
| Input validation | zod on every form and endpoint; malformed CSV rows rejected with row-level errors | Security | Not run |
| Accessibility | Lighthouse accessibility ≥ 95 on every page type; full keyboard walkthrough | Polish / Accessibility prize | Not run |
| Error and empty states | Loading, empty, error, slow network and invalid input on each screen | Polish | Not run |
| Mentor safeguards | Unapproved mentor sees no student; approved mentor sees only assigned mentees; mentor notes are logged and visible to CIC admin | Security | Not run |
| Self-registration | IP rate limit holds; CIC Open students cannot see anyone else; guest progress import validates its payload | Security | Not run |
| Code comments | Every RLS policy and grading function has an explanatory comment | Documentation | Not run |
| Docs run-through | A non-author follows the README from a clean clone | Documentation | Not run |
| Free-tier headroom | Re-check vendor limits quoted in [tradeoffs](tradeoffs.md) | Scope | Not run |

## Reports

### 2026-11-14 Lane C learning gain math and CSV export
Commit: see PR `lane-c/gain-math` · Run by: Umang (with Claude Code) · Command: `npm test` and `npx tsc --noEmit` in `lane-c-logic/`

| Check | Result | Notes |
|---|---|---|
| Unit tests (Vitest) | 20 passed, 0 failed | pre 100, negative gain, all-correct, missing scores, out-of-range, unpaired items, point weighting, group summary |
| Type check (tsc strict) | Pass | |
| CSV formula injection | Pass | cells starting with = + - @ are prefixed with a quote; real negative numbers untouched |

Findings:
- None open. Not yet covered: SQL views matching this logic (needs lane A schema).

### 2026-11-14 Lane C authoring schemas and key isolation (app side)
Commit: see PR `lane-c/authoring-schemas` · Run by: Umang (with Claude Code) · Command: `npm test` and `npx tsc --noEmit` in `lane-c-logic/`

| Check | Result | Notes |
|---|---|---|
| Unit tests (Vitest) | 52 passed, 0 failed (20 gain, 32 schemas) | |
| Type check (tsc strict) | Pass | |
| No answer keys in student payload | Pass | planted secret strings and key field names are absent from `splitModule(...).student` JSON |
| Smuggled answer field in content | Rejected | content schemas are strict |
| Input validation | Pass | bad YouTube hosts, http links, javascript: URLs, unknown fields, empty titles, duplicate ids, bad fill-blank counts, non-permutation ordering all rejected |
| Ordering never ships solved order | Pass | |
| SQL RLS (`lane_c_proposal.sql`) | NOT RUN | never executed against Postgres. Needs lane A helpers (`is_staff`, `is_admin`) and a local Supabase. Treat as unverified |

Findings:
- [open, medium] RLS policies in `lane_c_proposal.sql` are untested. Needs per-role SQL tests: student cannot select `activity_keys`, reviewer cannot write, draft invisible to students. Tracked in the next slice.
- [open, low] `assessment_items` stores key and content together, so it is staff-only for now. Lane A should split it (see handoff).


### 2026-11-14 Lane C gain math after scaffold merge and review fix
Commit: see PR #3 · Run by: Umang (with Claude Code) · Command: root `npm run lint && npm run typecheck && npm test`

| Check | Result | Notes |
|---|---|---|
| Lint (oxlint) | Pass | |
| Type check (`tsc -b`, TS 7, strict, `erasableSyntaxOnly`) | Pass | |
| Tests (Vitest) | 34 passed across 3 files | 22 lane C gain/CSV, rest from lane D and the feature registry |
| Duplicate pair_key (Jad's review) | Fixed, 2 new tests | key excluded from both tests and reported |

Findings:
- [fixed, medium] Duplicate `pairKey` in one test counted twice on that side and once on the other, skewing gain. Fixed in PR #3.

### 2026-11-14 Lane C schemas after scaffold merge
Commit: see PR #4 · Run by: Umang (with Claude Code) · Command: root `npm run lint && npm run typecheck && npm test && npm run build`

| Check | Result | Notes |
|---|---|---|
| Lint, type check (TS 7 strict), build | Pass | |
| Tests | 66 passed across 4 files | 54 lane C (gain, CSV, schemas), rest from other lanes |
| Key leak test, input validation | Still pass after the move to `shared/authoring/` | |

Findings:
- [open] SQL proposal still unverified against Postgres (see earlier entry).

### 2026-11-14 Lane C RLS per-role tests (review of PR #4)
Commit: see PR #4 · Run by: Umang (with Claude Code) · Command: `npm test` (file `supabase/tests/lane_c_rls.test.ts`, PGlite = real Postgres in WASM)

| Check | Result | Notes |
|---|---|---|
| Student cannot read `activity_keys` or `assessment_items` | Pass | |
| Reviewer cannot read keys; cannot insert; update/delete change nothing | Pass | |
| Students see published content only (modules, lessons, activities, assessments) | Pass | |
| Author sees own draft; other instructor does not; admin sees all | Pass | review fix: first draft let any staff read every draft |
| Student cannot create modules; instructor can only insert own drafts, never `published` | Pass | review fix: `created_by = auth.uid()` now required on insert |
| Instructor can submit but not publish; admin can | Pass | |
| Published module frozen: no lesson edits even by admin | Pass | |
| `v_learning_gain`: complete, pre 100 (normalized null), missing post (incomplete, null gain) | Pass | matches ADR 0020 |
| Mutation check: removed RLS on `activity_keys` and opened module reads | 5 tests failed as expected | tests do catch regressions; SQL restored after |

Findings:
- [fixed, medium] Draft modules were readable by every instructor. Now own drafts and admin only.
- [fixed, low] Insert policy did not force `created_by = auth.uid()`.
- [open, medium] `is_admin()`, `is_staff()` and `auth.uid()` are stubs in the test. Re-run against lane A's real helpers on Supabase before relying on this.
- [open, low] `concepts` has read policy only, so nobody can write concepts until lane A seeds them.
- [open, low] `assessment_items` stores key beside content, so it is staff-only until lane A splits it.

### 2026-11-14 Lane A database review and per-role tests (against real Supabase)
Commit: see PR `lane-a/schema-review` · Run by: Umang (with Claude Code) · Command: `npx supabase db reset` then `npx vitest run supabase` (Postgres 17, local Supabase in Docker)

| Check | Result | Notes |
|---|---|---|
| All 5 migrations + seed apply from scratch | Pass | |
| Per-role tests (`supabase/tests/db.test.ts`) | 35 passed, 0 failed | student, guest, reviewer, mentor, instructor, author, admin, service_role |
| Keys, login codes, join codes, API key hashes unreadable by any client role | Pass | RLS on, no policy, no grant |
| Student content carries no key fields (all seeded activities and test items) | Pass | plus a CHECK constraint refuses them on write |
| Unlock engine: pre-test first, strict order, post-test last, module chaining | Pass | enforced in `submit_answer`, `get_activity`, `heartbeat`, `submit_assessment` |
| Learning gain: complete, incomplete, pre 100, class mean | Pass | matches ADR 0020; student path gives 40 -> 100 = 60, normalized 1.0 |
| Published modules frozen (modules, lessons, activities, keys, tests) | Pass | |
| Staff-invite role grant needs verified Google email | Pass | unverified and non-Google sign-ups stay students |
| Mutation check: exposed key tables to clients | 2 tests failed as expected | restored afterward |

Findings from reviewing the first lane A drafts (all fixed in this PR):
- [high] The two migrations created the same tables with different shapes; `db reset` would fail on the second. The seed matched neither.
- [high] An author could publish by updating `status`: the update policy's WITH CHECK only required `is_author()`.
- [high] Any author could read and edit any other author's drafts (`can_read_module` allowed every author to see every draft).
- [high] No answer-key shape matched lane C (one key per activity, but worksheets have many questions); the player's response shapes could not be graded.
- [medium] Pre and post tests could be retaken (upsert), letting a student game learning gain. Now one shot, instructor can reset.
- [medium] The pre-test did not gate the module, and `next_activity` used an O(n^2) "no earlier incomplete activity" check that is redundant for ordered work.
- [medium] Class gain rows were hidden when a class had under 5 students, which hides small CIC classes from their own instructor. Suppression now applies only to the read API views.
- [medium] `v_stuck` and `v_learning_gain` used security-barrier views over RLS tables that needed role helpers; learning gain did not follow ADR 0020 (no incomplete state, no pair_key matching).
- [medium] Hash columns on `classes`, `class_members`, `api_keys` behind column grants made `select *` fail for staff.
- [medium] `get_activity_key` let every author read every key. Now owner, admin, instructor of a class using the module, or mentor of a student in it.
- [low] `archived` status could never be reached (the published trigger blocked it).
- [low] `self_register` was callable directly, so the Pages Function rate limit could be bypassed. Mitigated by Supabase's anonymous sign-in rate limit; documented.

Bugs the new tests caught during this work (fixed before merge):
- `grade_question` returned NULL for a malformed ordering or mcq response, which would have crashed the insert.
- The "solved order" safety check read items in sorted order, so it would have blocked publishing any module with an ordering question.
- `v_stuck` was not callable by instructors because a helper had no grant.

Open:
- [open, medium] No per-session lockout on `claim_login_code` guesses. Codes are 64-bit random, so guessing is not practical, and anonymous sign-ins are rate limited per IP, but a lockout would be stronger.
- [open, low] Unlock overrides ("instructor can unlock one student") are not built (plan decision 7, stretch).
- [open, low] Guests cannot submit answers; only view credit for videos and readings is imported at registration.

