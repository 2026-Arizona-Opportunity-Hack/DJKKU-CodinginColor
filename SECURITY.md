# Security

This platform teaches high school students, so most of its security work is about what we do
**not** collect and who can see what. This file says what we do, where it is enforced, and what
we know is still weak. If this file and the SQL in `supabase/migrations/` disagree, the SQL is right.

## What we collect about students (minors)

| Collected | Why |
|---|---|
| Display name (for example "Maya R.") | So an instructor can recognize the student |
| The school and class they belong to | So the right instructor sees them |
| Their answers, scores, time on an activity and which activities they finished | To unlock the next step, show progress and measure learning gain |
| Notes they choose to write in "My notebook" | So they can review in their own words. Private: only the student can read them |

We do **not** collect an email address, a password, a phone number, a birth date, a photo or an
address for students. A student signs in with a code on an anonymous Supabase session, so there
is no student account to take over. The roster import accepts names only and refuses emails.

Staff, reviewers and mentors are adults and sign in with Google. Their email is used to match an
admin invitation and to sign them in.

**Retention (proposed, CIC to confirm):** delete student data 12 months after a class ends, or sooner on
request. Until the deletion job exists, an admin deletes on request (a student's rows cascade from their
profile). The plain-language notice for families is at `/privacy`.

## Services that see data

| Service | What it sees | Why |
|---|---|---|
| Supabase (database and auth) | All stored data, encrypted at rest | Stores everything; enforces row-level security |
| Cloudflare Pages | Requests to the site and the API | Hosts the site and the API functions |
| Google | Staff email and name at sign-in | Staff sign-in only; students never use Google |
| YouTube (youtube-nocookie.com) | That a video was played, from the student's browser | Lesson videos, privacy-enhanced embed |
| jsDelivr | That Python was downloaded | Pyodide for code activities |
| Gemini (only if AI hints are on) | The question text and the student's answer, under an opaque id. No name, class or school | AI hints. The free tier may use prompts to improve Google products, so the written hint ladder is the default |
| The configured AI provider (test drafting, authors only) | A module's own lesson material: titles, readings, video transcripts, code tasks, question prompts. Never student data or answer keys | "Draft both tests with AI" in the studio (`/api/draft-tests`). The provider and model are set in Cloudflare, not in code |
| The configured AI provider ("Explain it for my grade") | One reading or video's text and a grade number (1 to 12). No name, id, class or answers | Students and guests ask for a lesson rewritten for their grade (`/api/simplify`). The server loads the lesson itself with the caller's own token, so only material they may open is sent, and caches each rewrite per grade |

## Codes and keys

- **Personal login codes** and **class join codes** are random (64 bits and 48 bits). Only a
  SHA-256 hash is stored, in tables no client can read. The code is shown once to the instructor.
  A login code works once; a lost one is replaced with `reset_login_code`.
- **Read API keys** are random 256-bit values, stored as a SHA-256 hash and shown once when an admin
  creates them. A key has scopes and can be revoked. An unknown and a revoked key look the same.

## Who can see and change what

Access is decided in the database, not in the browser. The browser only holds the public anon key.
The menu hiding links for other roles is a courtesy; the rules below are the real gate.

- **Row-level security is on for every table, and the default is deny.** Clients read tables through
  policies keyed on who they are (`is_admin()`, `is_instructor_of()`, `is_member_of()`, `is_mentor_of()`).
  Table and function permissions are revoked from `public`, `anon` and `authenticated` first, then
  granted one by one. Every new migration must do the same.
- **Every write is a security-definer function** that checks `auth.uid()` and the role inside it.
  There are four small direct writes (your own display name, a class's name and term, schools by an
  admin, and appending a mentor note). The functions are listed in
  [docs/contracts/database-api.md](docs/contracts/database-api.md).
- **Answer keys are separate from content.** Keys live in `activity_keys` and `assessment_keys`, which
  have row-level security on and no client policy at all. A CHECK constraint refuses any content that
  contains a key field, and the zod schemas for content are strict. Grading happens in SQL
  (`grade_question`); the browser only learns right or wrong, plus the next hint.
- **Students** see only their own rows and their own class's published modules. They cannot read
  other students, keys, or draft curriculum, and they cannot write progress directly.
- **Instructors** see only the classes they teach. **Mentors** see only the students an admin assigned
  them. **Reviewers** can read published curriculum and nothing else: no keys, no student data and
  no write path (the reviewer screen makes no write call and never asks for keys).
- **Only a CIC admin** publishes a module, invites staff, changes a role, assigns a mentor or creates
  an API key. Published module versions are frozen by database triggers. Staff roles are granted only
  when a verified Google email matches an admin's invitation (email sign-in is turned off).
- **The read API for CIC** (`/api/v1/*`) returns class-level aggregates only. Groups under 5 students
  are left out by the database views and checked again in the API. It needs a key with the right scope.

The per-role proof is `supabase/tests/db.test.ts` (it runs against a real local Supabase in CI).

## Secrets

- The browser has only `VITE_SUPABASE_URL` and the anon key, both public by design. Nothing else
  starts with `VITE_`.
- The service-role key (which bypasses RLS) exists only as a Cloudflare Pages secret, used by the read
  API. Setup and the full variable list are in the README and [docs/deploy.md](docs/deploy.md).
- Video transcripts: `/api/transcript` sends Supadata only the public YouTube video id of a lesson video, never anything about a student, and only for videos in a published lesson. The `SUPADATA_API_KEY` is a Cloudflare Pages secret.
- `.env` and `.dev.vars` are gitignored, and `.env.example` holds placeholders only. CI runs gitleaks
  on every pull request.

## Known limits

We would rather list these than hide them.

- **A class join link lets anyone who has it claim an unclaimed seat.** There is no PIN. Share the link
  only in class and make a new one afterwards (making a new link stops the old one).
- **No lockout on login-code guessing.** The codes are 64-bit random, so guessing is not practical,
  but there is no per-session attempt counter.
- **Anonymous sign-up spam** is limited only by Supabase's per-address rate limit. We raise it to 500
  an hour so a whole classroom behind one school address can sign in, which also makes it easier to
  script many sign-ins. A captcha could be added.
- **Signing out an anonymous student loses their seat**, because a login code works once. The
  instructor can issue a new code.
- **Notebook notes are private to the student**, including from instructors and admins: the table has no
  client policy and the only read function returns the caller's own notes. They are kept in the database, not
  the browser, because classroom Chromebooks are shared. Someone with database access (the service-role key) can
  still read them, as with all data.
- **Code activities are graded in the browser.** Python runs on the student's device (Pyodide), so a student
  who edits the page could report passing checks they did not pass. Code activities are practice; learning
  gain comes only from the pre-test and post-test, which are graded in the database.
- **AI hints are off by default** (`VITE_FEATURE_HINTS`). When on, `/api/hint` checks the student's session
  and access to the activity, sends only the question text and the student's answer under an opaque id,
  caps each student at 3 hints per activity, refuses any model reply that contains the answer, and falls
  back to the author's written hints. A free-tier provider may use prompts to improve its models, so treat
  anything sent as non-private.
- **No rate limit on the read API (`/api/v1/*`)** beyond Cloudflare's defaults. Keys are scoped and revocable.
- **Login-code guessing is not counted per session** (see above); codes are 64-bit random.
- **The free Supabase plan pauses after 7 days without use**, and has no automated backups we control.
  The keepalive and backup jobs are not built yet.
- Stuck and learning-gain rules are defaults that CIC has not confirmed.

## If something leaks

| What leaked | Do this first | Then |
|---|---|---|
| A read API key | Admin console, API keys: revoke it (takes effect at once) | Make a new key for the consumer; check function logs for its use |
| The service-role key or the Gemini key | Rotate it in the Supabase or Google dashboard, then update the Cloudflare Pages secret and redeploy | Check the Supabase logs for use since the leak; tell CIC |
| A student or instructor saw a class they should not | Remove the wrong class membership; reset affected login codes | Add a DB test that reproduces it before fixing the rule; tell CIC and the school |

Deleting a message that contained a key does not count: rotate it.

## Reporting a vulnerability

Please do not open a public issue for a security problem. Email **TODO: CIC security contact (to be
added before launch)** with what you found and how to reproduce it. We will acknowledge it and tell
you when it is fixed. Never include real student data in a report.
