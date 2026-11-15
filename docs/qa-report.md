# QA report (SECURITY_QA_CHECKLIST user journeys, gate G-02)

Run on Sun Nov 15 2026, 9:50 to 10:40 AM MST, against `main` at `7d5c061`.

## Automated suite

| Check | Result |
|---|---|
| `npm run lint` | Pass |
| `npm run typecheck` (app and functions) | Pass |
| `REQUIRE_DB=1 npm test` (clean checkout, local Supabase) | **699 passed** in 70 files, including the per-role DB tests |
| `npm run build` | Pass |
| `npx playwright test` | 6 passed, 2 skipped by design (real Python runs on desktop only) |
| Route sweep (Playwright, demo mode): 16 routes | Every route has a title; no console errors or warnings; no placeholder text |
| CSP check (Playwright with #59's policy) | 0 violations over video, Python and 7 main routes |

Note for teammates: a local `.env` with `VITE_DATA_SOURCE` set makes 7 app tests fail locally (they expect the
clean CI environment). CI and a clean checkout pass.

## P0 journeys

PASS = checked, with how. Not run = needs a person, real Google accounts or the hosted project.

| ID | Result | How |
|---|---|---|
| J-01 | PASS | Home has one h1 and the three paths; smoke test, no console errors. |
| J-02 | PASS | Smoke test clicks the main paths; every route has a title; docs link test checks markdown links. |
| J-04 | Not run | Deep link while signed out. |
| J-10 | PASS | Smoke test opens a guest lesson; Python e2e runs a guest code activity. |
| J-11 | PASS | Guest import notice; DB and player tests for `import_guest_progress`. |
| J-12, J-13 | Partial | Student bar shows the name; class name on Start here. Instructor name is not shown (decision D11 open). |
| J-20 | PASS | Code normalization unit tests (`shared/loginCode.test.ts`). |
| J-21 | PASS / ACCEPTED | Generic error for a wrong code (sign-in test). No lockout (S-20). |
| J-22, J-23, J-24 | PASS | DB test "a late joiner picks their name with the class join code, and only unclaimed names show"; join page test lists unclaimed names, confirms, then claims. |
| J-25 | Not run | Fake or archived class code message: not covered by a test. |
| J-26 | PASS | Sign-in page says to ask the teacher and offers free lessons. |
| J-28 | PASS | DB test "a lost code is reset and the student keeps their progress on a new device". |
| J-29 | Not run | Two students on one computer: manual. |
| J-31 | OWNER | Anonymous sign-in rate limit on the hosted project. |
| J-40 | PASS | DB test "follows the unlock rules: pre-test first, strict order, post-test last". |
| J-41 | PASS | `submit_answer` takes an advisory lock per student and activity; attempts are numbered. Manual double-click: not run. |
| J-42 | PASS | Question form and grading tests for every type; keyboard ordering tests. |
| J-44 | PASS | Module completion and unlock tests; certificate after the post-test. |
| J-45 | PASS | DB test "refuses to count locked work"; locked activity page says why. |
| J-48 | PASS | Phone project in e2e; "no page scrolls sideways on a phone". Notes panel checked at phone width. |
| J-49 | PASS | axe in unit tests and e2e (0 serious); Lighthouse CI on every PR. One h1 missing on the empty certificate page, fixed in #61. |
| J-60 | Not run | Needs Google accounts on the hosted project. |
| J-61 | Not run | Timed setup by a new instructor. |
| J-62 | Partial | DB test "roster import is all or nothing and names only" (duplicates, emails, 1 to 80 characters, 300 rows). Formula cells, BOM and semicolons in the CSV parser: not tested. |
| J-65, J-66, J-67, J-68 | PASS | Instructor setup, dashboard, reset code and other-class denial tests. |
| J-80 | PASS | Admin staff tests; own-role change refused. |
| J-81 | PASS | Studio round-trip tests for every type, code activities and Parsons; publish tests. |
| J-83 | PASS | Reviewer tests: no keys, no student data, no write calls. |
| J-84 | PASS | API key create, revoke, scope tests. |
| J-90 | Partial | Role guard tests per feature; a full role-by-route table is not written yet. |
| J-91 | Not run | Every button for every role: manual. |
| J-92 | PASS | Route sweep: zero console errors and warnings. |
| J-93 | Not run | README "Try it" on the public URL: blocked by S-92 until migrations are pushed. |
| J-94 | PASS | Loading, empty and error states on every data screen (QueryView/QueryStatus, tests). |
| J-98 | PASS | No placeholder text on any swept route. The Coder spotlight template is placeholder by design and only appears if an author adds it. |
| J-99 | Not run | Demo script twice on production, after S-92. |

## Found and fixed during this pass

| Finding | Fix |
|---|---|
| Hosted database missing new migrations (live notebook error) | Owner runs `npx supabase db push` (S-92) |
| No CSP, frame protection or Permissions-Policy on the live site | #59 |
| No privacy page; SECURITY.md missing third parties, leak steps; stale AI hints entry | #60 |
| Login code stayed in the address bar after a QR link | #61 |
| `/api/hint` parsed any size of body (zod advisory) | #61 |
| Certificate page had no h1 before a certificate was earned | #61 |
