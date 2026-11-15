# Decisions

The log of technical decisions: what we chose, why, and what we rejected. The
team plan asks for `docs/adr/` with **one short file per row of the Final stack
table** (context, decision, alternatives). This file is the index and the
template; each decision's full record lives in `docs/adr/NNNN-short-title.md`.
What each choice costs is in [tradeoffs](tradeoffs.md).

## How to add one

1. Copy the template below to `docs/adr/NNNN-short-title.md` (next free number).
2. Keep it to about 15 lines: context, decision, alternatives, consequences.
3. Fill in the `File` column of the index in the same PR.
4. **Never rewrite an accepted decision.** If it changes, add a new ADR and mark
   the old one `Superseded by NNNN`. Only change the old file's status line.

## Template

```markdown
# NNNN. Short title

Status: Proposed | Accepted | Superseded by NNNN
Date: YYYY-MM-DD

## Context
What problem or constraint forced a choice?

## Decision
What we chose, in one or two sentences.

## Alternatives considered
- Option: why not.

## Consequences
What gets easier or harder; limits we now live with.
```

## Index

Source: team design plan, Nov 14 2026 revision. Rows 1–14 are the 14 rows of the
plan's "Final stack" table, in order. Rows 15–18 are open-question answers that
also change how the system works. A dash means the ADR file is not written yet.

| # | Decision | Status | File |
|---|---|---|---|
| 1 | Database: Supabase Postgres | Accepted | – |
| 2 | Auth: Supabase Auth, anonymous session + login-code claim for students, Google sign-in for staff, reviewers, mentors | Accepted | – |
| 3 | Core logic (grading, unlock, code claim, next activity) in Postgres functions, not a server | Accepted | – |
| 4 | HTTP endpoints: Cloudflare Pages Functions for the read API and AI hint proxy (Supabase Edge Functions kept as fallback) | Accepted | – |
| 5 | Frontend: React + TypeScript + Vite SPA with React Router (not Next.js) | Accepted | – |
| 6 | UI kit: Tailwind + shadcn/ui (Radix) | Accepted | – |
| 7 | Data and forms: TanStack Query, react-hook-form, zod, Recharts, Papa Parse | Accepted | – |
| 8 | Hosting: Cloudflare Pages (not Vercel Hobby) | Accepted | – |
| 9 | Video: unlisted YouTube, privacy-enhanced embeds | Accepted | – |
| 10 | Python runner (P1): Pyodide in the browser | Accepted (P1) | – |
| 11 | AI hints: instructor-written ladder first, Gemini Flash-Lite free tier second, cached | Accepted | – |
| 12 | CI and ops: GitHub Actions (lint, types, tests, Lighthouse CI, gitleaks, keepalive, encrypted nightly backup) | Accepted | – |
| 13 | API docs: OpenAPI file + static Scalar page at /api/docs | Accepted | – |
| 14 | Domain: free pages.dev address | Accepted | – |
| 15 | Student login for minors: personal login code, no email, no shared passwords (open question 1) | Accepted | – |
| 16 | Answer keys in a separate table no student or reviewer policy can read (open question 2) | Accepted | – |
| 17 | Reviewer login: Google sign-in limited to invited emails, replacing magic links (open question 9) | Accepted | – |
| 18 | Free-only: $0 a month, no credit card on any account (open question 11) | Accepted | – |
| 19 | Repo structure: one folder per feature in `src/features/`, registered in one list (`src/app/features.ts`); one npm package with `functions/` and `shared/` beside `src/` (lane E) | Accepted | – |
| 20 | Learning gain: post minus pre, normalized gain, incomplete never zero, matched by pair_key (lane C) | Accepted | [0020](adr/0020-learning-gain-definition.md) |
| 21 | Lane C pure logic in `lane-c-logic/` until the app scaffold lands (lane C) | Accepted | [0021](adr/0021-lane-c-logic-folder.md) |
| 22 | Authored questions split into student content and answer key; keys never in student payloads (lane C) | Accepted | [0022](adr/0022-keys-split-from-content.md) |
| 23 | Module versions are rows; published versions immutable (lane C proposal, built by lane A) | Accepted | [0023](adr/0023-immutable-module-versions.md) |
| 24 | Lane A database: clients read through RLS and write only through checked functions; secrets in side tables (lane A, reviewed by lane C) | Accepted | [0024](adr/0024-lane-a-database-design.md) |
| 25 | AI provider: an OpenAI-compatible gateway when set (the OHack gateway with `gpt-oss-120b` for the event), else Gemini, else no AI; `muse-spark` rejected because its prompts may be used for training and ours contain students' answers (extends 11) | Accepted | – |
| 26 | Student login codes are reusable until an instructor resets them; one device holds the seat and moving devices moves the student's data. Trade-off: the code acts as the student's password (refines 15) | Accepted | – |
| 27 | Removing staff takes access away and keeps the account (no account deletion); a class may be left without an instructor, with a warning | Accepted | – |
| 28 | Find material: videos are only embedded; text is copied only from GitHub repositories under an open license, re-checked on import, with source and license on the first line | Accepted | – |
| 29 | Deploy by `wrangler pages deploy` (direct upload) until an org owner approves the Cloudflare GitHub app; then connect Git (amends 8 for the event only) | Accepted (temporary) | – |

Changed in the Nov 14 revision: reviewer magic links → Google sign-in (17); the
read API and hint proxy moved from Supabase Edge Functions to Cloudflare Pages
Functions (4).
