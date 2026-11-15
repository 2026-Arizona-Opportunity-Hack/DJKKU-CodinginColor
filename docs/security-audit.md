# Security audit (SECURITY_QA_CHECKLIST, gates G-01 and G-03)

Run on Sun Nov 15 2026, 9:50 to 10:40 AM MST, against `main` at `7d5c061` (local Supabase with every migration,
and the live site <https://cic-demo-6br.pages.dev> with the hosted project). Fix PRs opened during the audit:
#59 (security headers), #60 (privacy page, SECURITY.md), #61 (login code in URL, hint body cap).

How to reproduce: `REQUIRE_DB=1 npm test` (per-role DB tests), `node scripts/security-probe.mjs` (see its header),
and the commands in the table. Results: **PASS**, **FAIL** (with the fix or the owner), **FIXED** (fixed by a PR
above, re-check after deploy), **ACCEPTED** (known limit written in SECURITY.md), **OWNER** (a dashboard or account
setting only its owner can check).

## P0 gate summary

| Status | IDs |
|---|---|
| PASS | S-01, S-02, S-03, S-05, S-10, S-11, S-12, S-13, S-14, S-15, S-16, S-17, S-18, S-19, S-31, S-40, S-41, S-42, S-52, S-53, S-60 |
| FIXED (PR open) | S-50, S-51, S-61, S-62 |
| FAIL, blocks the live demo | **S-92**: the hosted database is missing every migration from `20261115110000` on (see below) |
| OWNER to confirm | S-04, S-30, S-32 (rate limit value), S-33, S-90 (re-run after the last deploy), S-91 |
| Partial | S-80, S-81 (SECURITY.md has no role-by-route matrix; README links SECURITY.md but not the probe) |

**S-92, do this before recording:** `get_my_notes`, `get_class_misconceptions` and the other new functions answer
`PGRST202 function not found` on the hosted project, so the live notebook says "That service isn't available".
Someone with the database password runs `npx supabase link --project-ref <ref>` then `npx supabase db push`
(docs/deploy.md). It only adds tables and functions.

## Security

| ID | Result | Evidence |
|---|---|---|
| S-01 | PASS | `gitleaks detect --log-opts="--all"` (v8.21.2, Docker): 93 commits scanned, **no leaks found**. CI also runs gitleaks 8.28.0 on every PR. |
| S-02 | PASS | Clean build (`npm run build`, no `.env`): `grep -rIE 'service_role\|sb_secret\|GEMINI\|AIza' dist/` finds nothing and there is no JWT in the bundle. The live bundle carries only the anon key (role `anon`). |
| S-03 | PASS | Only `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_DATA_SOURCE`, `VITE_FEATURE_HINTS`, `VITE_API_BASE` start with `VITE_`. `.env*` and `.dev.vars` are gitignored; `.env.example` has placeholders. Cloudflare secrets: OWNER. |
| S-04 | OWNER | Ask the team whether any key was pasted in Slack or a screenshot; rotate if so. |
| S-05 | PASS | Probe as `DEMO-0000-0000-0001` (local): only the demo class, own seat and own rows; seed names are made up. |
| S-06 | OWNER | Repo settings (secret scanning, push protection, Dependabot, branch protection). |
| S-07 | PASS with note | Every workflow sets `permissions: contents: read` (pr-lint: `pull-requests: write`, comment only). No `pull_request_target`. Third-party Lighthouse action pinned to a SHA; GitHub's own actions pinned to major tags. |
| S-08 | ACCEPTED | `npm audit --omit=dev`: 1 high, zod 3.25 (GHSA-mrhx-c7xc-m3w5, memory on oversized collections). Only fix is zod 4 (major). Mitigation: the only server endpoint that parses user JSON (`/api/hint`) now refuses bodies over 16 KB before parsing (#61). Lockfile committed, CI uses `npm ci`. |
| S-10 | PASS | Tables in `public` without RLS: **0 rows**. |
| S-11 | PASS | Only `concepts_read` uses `true`, for anon and authenticated: concept names (for example "Loops") are public curriculum, by design. No policy reads `user_metadata`. |
| S-12 | PASS | `v_class_progress`, `v_concept_mastery`, `v_not_started`, `v_reteach`, `v_stuck` are `security_invoker`. `v_learning_gain` is `security_barrier` and filters every row by `is_admin()`, `is_instructor_of()`, own `student_id` or `is_mentor_of()`. `_gain_core`, `api_*`, `v_class_progress_all` are not granted to anon or authenticated. |
| S-13 | PASS | Every `security definer` function has `search_path=""`. The 11 non-definer functions are pure helpers and triggers (also `search_path=""`). anon may execute only `can_read_module`, `get_activity`, `list_join_roster`, `list_open_modules` (guest lessons and the join page). |
| S-14 | PASS | Probe as a stranger, local and live: no key, roster, progress, notes, invite or code table is readable; published content has no key fields. Output below. |
| S-15 | PASS | Probe as a claimed student (local): own seat, own class, own rows only; key, invite and code tables refused. DB tests: "a student sees only their own progress and roster row". |
| S-16 | PASS | Student PATCH of own `role`/`can_author`: HTTP 403, role unchanged. Insert of a profile with a chosen role: 403. DB test: "a student cannot change their own role". |
| S-17 | PASS | DB test "invited staff get their role from a verified Google sign-in, and nobody else does". Live Google check: OWNER. |
| S-18 | PASS | DB tests "an instructor sees only the classes they teach", "a reviewer reads published curriculum but no keys". |
| S-19 | PASS | Probe and DB test "student-visible content carries no key fields anywhere"; answer keys are in tables with no client policy. |
| S-20 | ACCEPTED | No per-session attempt counter (SECURITY.md, Known limits). Codes are 64-bit random. |
| S-21 | PASS | Roster: 1 to 300 names, 1 to 80 characters, no emails. CHECK limits on names, titles, bodies; `submit_answer` caps 32 KB; notes 2000 characters. |
| S-22 | PASS | `supabase db lint --level warning`: 0 errors; warnings only (empty array initializers, one IMMUTABLE that should be STABLE). Security Advisor: OWNER. |
| S-23 | PASS | `pg_publication_tables` for `supabase_realtime`: 0 rows. |
| S-24 | PASS | `storage.buckets`: 0 rows. |
| S-25 | PASS | Only `staff_invites.email` (adult staff). No student contact columns. |
| S-26 | FAIL (P1) | No `docs/ops.md` runbook yet. Deleting a profile cascades; needs written SQL for a student, a class and a class export. Lane A. |
| S-27 | PASS with note | `created_by` on modules, classes and api_keys; `last_used_at` on api_keys. Staff invites have no `created_by`. |
| S-30 | OWNER | Supabase Auth URL configuration (dashboard). |
| S-31 | PASS | `POST /auth/v1/signup` with email and password: HTTP 400, local and live. |
| S-32 | PASS / OWNER | An unclaimed anonymous session reads nothing but its own profile row (probe). Rate limit value on the hosted project: OWNER. |
| S-33 | OWNER | Google Cloud console. |
| S-34 | PASS | DB test "an admin cannot change their own role (no lockout)". |
| S-35 | Not run | Manual, two browsers. |
| S-36 | FIXED | `/sign-in?code=` left the code in the address bar; #61 removes it after load. Codes are not stored in localStorage. |
| S-37 | OWNER | MFA on GitHub, Supabase, Cloudflare, Google. |
| S-40 | PASS | Live: no key 401, wrong key 401 (same message), POST 405. Revoked (401) and wrong scope (403): unit tests in `shared/api/handler.test.ts`. |
| S-41 | PASS | SHA-256 hash only, shown once, scoped; "an unknown and a revoked key look the same" (tests). |
| S-42 | PASS | `shared/api/aggregate.test.ts`: classes under 5 are left out, also from cohort totals. |
| S-43 | PASS | GET only (405 live). Tests: the key is checked before parameters; unknown `group_by`, unknown parameter and bad format answer 400. |
| S-44 | FAIL (P1) | `/api/hint` caps 3 hints per student per activity (429). No rate limit on `/api/v1/*`; add a Cloudflare rate-limiting rule (dashboard, Krishna). |
| S-45 | PASS | GET `/api/v1/*` has no `Access-Control-Allow-Origin`. HEAD fell through to static files with `*`; #59 removes it. |
| S-46 | PASS | Errors are `{error:{code,message}}` or `{error:"invalid_request"}`; no stack or SQL text (bad JSON tested live). |
| S-47 | PASS | `shared/hint/handler.test.ts`: 401 without a session, 403 when locked, student token used (not service role), answer-revealing replies refused, ladder fallback without a Gemini key. |
| S-50 | FIXED | Live site had no CSP, Permissions-Policy or frame protection. #59 adds `public/_headers` and an API middleware. |
| S-51 | FIXED | #59's CSP was served in Playwright over a video lesson, Python, and 7 main routes: **0 violations**. Re-scan the live URL after deploy. |
| S-52 | PASS | No `dangerouslySetInnerHTML`, `innerHTML` or `eval` in `src`/`shared`. Markdown uses `skipHtml` and a URL allow-list; player test renders an `<img onerror>` payload as text. |
| S-53 | PASS | Videos take a parsed YouTube id and embed `youtube-nocookie.com`; external links use `rel="noopener noreferrer"`. |
| S-54 | PASS | No `next`/`redirect` parameters exist. |
| S-55 | PASS | Logs never include tokens or answers (hint handler logs id, status, source only). |
| S-56 | PASS | No `/dev`, `/mock` or debug routes; demo mode is labelled on screen. |
| S-57 | PASS | Layout denies wrong roles with a friendly page (tests); RLS enforces it on the server. |
| S-58 | PASS | `shared/authoring/csv.ts` prefixes cells starting with `= + - @`, tab or CR. |
| S-59 | FIXED | `frame-ancestors 'none'` and `X-Frame-Options: DENY` in #59. |
| S-60 | PASS | SECURITY.md "What we collect about students (minors)". |
| S-61 | FIXED | #60 adds `/privacy`, linked from a new footer. |
| S-62 | FIXED | #60 adds "Services that see data" to SECURITY.md. Gemini terms: hints stay off by default. |
| S-63 | FIXED | #60 states a proposed rule (12 months after class end, or on request); CIC to confirm. |
| S-64 | PASS | Join page lists unclaimed seats only (DB test on `list_join_roster`). |
| S-65 | PASS | No analytics or trackers in the code or the route sweep. |
| S-70 | PASS | Every data screen has loading, empty and error states (route sweep, QueryView/QueryStatus); errors show a reference, not raw text. |
| S-71 | FIXED | #60 adds "If something leaks" to SECURITY.md. |
| S-72 | FAIL (P1) | No keepalive workflow. Lane E. |
| S-80 | Partial | SECURITY.md covers data, access, secrets, limits, leaks, reporting; a role-by-route matrix would complete it. |
| S-81 | Partial | README links SECURITY.md; add how to run the DB tests and `scripts/security-probe.mjs`. |
| S-83 | PASS | `scripts/security-probe.mjs` (this PR). |
| S-84 | PASS with note | CI runs lint, typecheck, tests, build, gitleaks, DB tests, e2e, Lighthouse; `npm audit` is not in CI. |
| S-90, S-91 | OWNER | After the last deploy, run the probe against production and attach it. |
| S-92 | **FAIL (P0)** | Hosted project is missing migrations from `20261115110000` on (`PGRST202` for `get_my_notes`, `get_class_misconceptions`). Run `npx supabase db push`. |

## Probe output: local (all roles)

```text
54 passed, 0 failed (anon 17, unclaimed anonymous session 19, claimed student 18)
anon: only curriculum tables and 4 guest functions exposed; key, invite, code, roster, progress, notes tables refused
unclaimed: reads nothing except its own profile row; get_me shows no class
student: own seat, own class, own rows only; PATCH role -> 403; insert profile with role -> 403
```

## Probe output: production (stranger only, so no test user is created)

```text
17 passed, 0 failed
Every key, invite, code, roster, progress, submission and notes table: refused
Published content: no answer-key fields (14 activities)
Email and password sign-up: HTTP 400
```
