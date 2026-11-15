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

We do **not** collect an email address, a password, a phone number, a birth date, a photo or an
address for students. A student signs in with a code on an anonymous Supabase session, so there
is no student account to take over. The roster import accepts names only and refuses emails.

Staff, reviewers and mentors are adults and sign in with Google. Their email is used to match an
admin invitation and to sign them in.

What we have not decided yet: a data retention period, and how a student's data is deleted on request.
Until CIC says, nothing is deleted automatically.

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
- **AI hints are planned, not built.** When they are, only the question text and the student's answer
  go to the provider under an opaque id, never a name or school. A free-tier provider may use prompts
  to improve its models, so treat anything sent as non-private.
- **The free Supabase plan pauses after 7 days without use**, and has no automated backups we control.
  The keepalive and backup jobs are not built yet.
- Stuck and learning-gain rules are defaults that CIC has not confirmed.

## Reporting a vulnerability

Please do not open a public issue for a security problem. Email **TODO: CIC security contact (to be
added before launch)** with what you found and how to reproduce it. We will acknowledge it and tell
you when it is fixed. Never include real student data in a report.
