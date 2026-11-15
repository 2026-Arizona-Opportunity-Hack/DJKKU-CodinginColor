# supabase/

The database layer (lane A): schema, row-level security, the functions every other lane
calls, demo data, and the tests that prove who can see what. Design reasons:
[ADR 0024](../docs/adr/0024-lane-a-database-design.md). Everything callable from the app is
listed in [docs/contracts/database-api.md](../docs/contracts/database-api.md).

```
supabase/
  config.toml     local stack settings (anonymous sign-in on, email sign-in off)
  migrations/     applied in order: schema, core functions, student/staff RPCs, policies + views, student login context
  seed.sql        DEMO data only: a real-looking module and two fake classes
  tests/db.test.ts  per-role tests against a real local Supabase
```

## Run it locally (needs Docker; everything is free)

```bash
npx supabase start -x studio,imgproxy,edge-runtime,logflare,vector,mailpit,realtime,storage-api,supavisor,postgres-meta
npx supabase db reset          # applies every migration, then seed.sql, from scratch
npm test                       # runs db.test.ts too when the database is up
npx supabase stop              # when you are done
```
`supabase start` prints the local URL and the demo `anon` and `service_role` keys; put them in
`.env` as `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` (see `.env.example`). Those local keys
are public demo keys, not secrets. After a change to any migration, run `db reset` again.
Set `VITE_DATA_SOURCE=supabase` in `.env` to have the player and student sign-in use this
database; `.env.example` defaults the player to mock data.

Students sign in without email or passwords. A student enters a personal login code to
claim a roster seat; creating an account asks only for a display name and can optionally
claim that code, or joins CIC Open and shows a new personal code once. Guests use Supabase
anonymous sign-in and are added to CIC Open. Lost codes must be reset by an instructor,
admin, or assigned mentor; there is no student password-reset flow.

## Demo data (fake, safe to show)

- Student login code **`DEMO-0000-0000-0001`** (one unclaimed seat in "Demo Period 1").
- Class join code **`DEMO-JOIN-1234`** (Demo Period 1): lets a late joiner pick a name.
- 17 fake students in two classes with pre/post results, one stuck student, one not started.
- A published module "Variables and Loops" in CIC Open and both classes. Its video is a
  placeholder; swap in CIC's own from the studio.

## Who can do what (short version)

Students read their own rows and call functions; they cannot write tables, see classmates or
read answer keys. Instructors see only classes they teach. Mentors see only assigned mentees.
Reviewers read published curriculum, never keys or student data. Only a CIC admin publishes,
invites staff, assigns mentors and makes API keys. The per-role proof is in `tests/db.test.ts`.

## First-time setup of a hosted project

1. Create a free Supabase project. Run the migrations in order (`supabase link` then
   `supabase db push`, or paste each file into the SQL editor). Do **not** run `seed.sql` on a
   project that holds real students; load it only into a separate demo project.
2. Authentication > Providers: turn **Google** on (client id and secret from Google Cloud
   Console), turn **Anonymous sign-ins** on, and leave **Email** off to keep student accounts
   email-free. Add Supabase's Google callback URL (shown in the provider settings, usually
   `https://<project-ref>.supabase.co/auth/v1/callback`) to the Google OAuth client's
   authorized redirect URIs. In Authentication > URL Configuration, allow the app callback
   URLs `http://localhost:5173/sign-in` and `https://<your-app-domain>/sign-in`. Under Rate
   Limits keep the anonymous sign-in limit low (30 per hour per IP is the default).
3. Create the first admin by hand: sign in once with Google, then in the SQL editor run
   `update public.profiles set role = 'cic_admin' where id = '<your user id>';`.
   After that the admin console invites everyone else with `invite_staff`.
4. Create the "CIC Open" class once: `insert into public.classes (name, kind) values ('CIC Open', 'open');`
   then assign modules to it with `assign_module`.
5. Keep the project awake and backed up (lane E's GitHub Actions: daily keepalive, nightly
   encrypted dump). A free project pauses after a week idle.

## Rules for changing this folder

- A new table gets RLS in the same migration, plus a comment on each policy.
- A new write is a function that checks `auth.uid()` and role, plus a test in `db.test.ts`.
- Never add a column that holds a secret to a table clients can read; use a side table like
  `member_login_codes`.
- Never edit a migration that has been applied to a shared project; add a new one.
- Seed data is fake. Never put real student data or real keys here.
