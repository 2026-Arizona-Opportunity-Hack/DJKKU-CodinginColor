# supabase/

The database layer (lane A): schema, row-level security, the functions every other lane
calls, demo data, and the tests that prove who can see what. Design reasons:
[ADR 0024](../docs/adr/0024-lane-a-database-design.md). Everything callable from the app is
listed in [docs/contracts/database-api.md](../docs/contracts/database-api.md).

```
supabase/
  config.toml     local stack settings (anonymous sign-in on, email sign-in off)
  migrations/     applied in order: schema, core functions, student RPCs, staff RPCs, policies + views
  seed.sql        DEMO data only: a real-looking module and two fake classes
  tests/db.test.ts  per-role tests against a real local Supabase (35 tests)
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
   Console), turn **Anonymous sign-ins** on, turn **Email** off. Under Rate Limits keep the
   anonymous sign-in limit low (30 per hour per IP is the default).
3. Create the first admin by hand: sign in once with Google, then in the SQL editor run
   `update public.profiles set role = 'cic_admin' where id = '<your user id>';`.
   After that the admin console invites everyone else with `invite_staff`.
4. Create the "CIC Open" class once: `insert into public.classes (name, kind) values ('CIC Open', 'open');`
   then assign modules to it with `assign_module`.
5. Keep the project awake and backed up (lane E's GitHub Actions: daily keepalive, nightly
   encrypted dump). A free project pauses after a week idle.

## Demo staff setup (hosted demo project only)

The seeded demo classes have no instructor, and a class made by an admin has the admin as its
only instructor, so a real instructor sees nothing until an admin adds them:

1. The admin invites teammates: `select public.invite_staff('<email>', 'instructor', true);`
2. They sign in once with Google.
3. The admin adds them to a class (profile id: `select id, role from public.profiles where role <> 'student';`):
   `select public.add_class_instructor('11000000-0000-4000-8000-000000000001', '<their profile id>');`

`remove_class_instructor` undoes it. A school class always keeps at least one instructor.

## Rules for changing this folder

- A new table gets RLS in the same migration, plus a comment on each policy.
- A new write is a function that checks `auth.uid()` and role, plus a test in `db.test.ts`.
- Never add a column that holds a secret to a table clients can read; use a side table like
  `member_login_codes`.
- Never edit a migration that has been applied to a shared project; add a new one.
- Seed data is fake. Never put real student data or real keys here.
- Every new migration revokes its new functions from `public, anon, authenticated` and then grants
  execute explicitly (Supabase gives new objects to anon by default).
