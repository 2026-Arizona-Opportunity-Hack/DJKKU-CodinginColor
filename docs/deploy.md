# Deploy guide: Supabase and Cloudflare Pages (free, no card)

For someone who has never seen this repo. Allow about 30 minutes. Do the parts in order:
Part 1 (Supabase), Part 2 (Cloudflare Pages), Part 3 (connect them), Part 4 (check it works).

This sets up a **demo** site with fake students. Never load `supabase/seed.sql` into a project
that holds real students.

## What you need

- A GitHub account with access to this repo, a Supabase account and a Cloudflare account.
  The free plans of all three are enough. None asks for a card.
- A Google account for the sign-in setup (Part 1, step 4).
- Node 22.12 or newer on your computer (`node -v`), and this repo cloned and installed
  (`npm install`). Part 1 uses the Supabase CLI through `npx`, so there is nothing else to install.

Write each value down as you get it. This table is the list of everything you will collect:

| Name | Where it comes from | Used for |
|---|---|---|
| `PROJECT_REF` | Supabase project URL, the part before `.supabase.co` | CLI link, Google redirect |
| `SUPABASE_URL` | Supabase Project Settings > API > Project URL | Browser and Functions |
| `ANON_KEY` | Supabase Project Settings > API > `anon` key (or the "publishable" key) | Browser (public) |
| `SERVICE_ROLE_KEY` | Supabase Project Settings > API > `service_role` key (or the "secret" key) | Functions only (secret) |
| `DB_PASSWORD` | The password you choose in step 1 | CLI link |
| `PAGES_URL` | Cloudflare, after the first deploy, like `https://cic-demo.pages.dev` | Auth redirects |

`SERVICE_ROLE_KEY` bypasses all row-level security. Never put it in the browser, in git, in chat
or in a screenshot.

---

## Part 1: Supabase

### 1. Create the project

1. Go to <https://supabase.com/dashboard> and sign in. Click **New project**.
2. Name: `cic-demo`. Database password: click **Generate a password** and save it as
   `DB_PASSWORD`. Region: the one closest to Arizona (`West US`). Plan: **Free**.
3. Click **Create new project** and wait about two minutes.
4. Open **Project Settings** (gear icon) > **API** (it may be called **API Keys**). Copy the
   **Project URL** (`SUPABASE_URL`), the **anon** key (`ANON_KEY`) and the **service_role** key
   (`SERVICE_ROLE_KEY`). The project ref is the part of the URL before `.supabase.co`
   (`PROJECT_REF`). If the page only shows new-style keys, use the **publishable** key as the
   anon key and the **secret** key as the service role key. The app accepts either kind.

### 2. Push the database

In a terminal, inside the repo:

```bash
npx supabase login                     # opens a browser, click Authorize
npx supabase link --project-ref PROJECT_REF     # asks for DB_PASSWORD
npx supabase db push                   # answer Y; applies every file in supabase/migrations/
```

`db push` should list six migrations (`..._lane_a_schema.sql` through
`..._lane_a_session_and_staffing.sql`) and finish without an error.

Now load the fake demo data, **once**:

1. In the Supabase dashboard open **SQL Editor** > **New query**.
2. Open `supabase/seed.sql` from the repo, copy all of it, paste it into the editor, click **Run**.
3. It should say Success. It is not safe to run twice (it inserts fixed ids). To start over,
   create a new project.

The seed creates the "CIC Open" class, the "Variables and Loops" module, two demo classes with 17
fake students, a student login code `DEMO-0000-0000-0001` and a class link code
`DEMO-JOIN-1234`.

### 3. Turn on anonymous sign-in, turn off email

Open **Authentication** in the left menu, then **Sign In / Providers** (older dashboards:
**Providers**):

- **Anonymous Sign-Ins**: switch **ON** (it may be under "User Signups" as "Allow anonymous
  sign-ins"). Students sign in this way before they enter their code.
- **Email**: switch **OFF**. Staff sign in with Google only, and this stops anyone from
  registering with an email address that was invited to be staff.

### 4. Turn on Google sign-in

Staff, mentors and reviewers sign in with Google.

1. Go to <https://console.cloud.google.com/>, sign in, and pick or create a project.
2. **APIs & Services** > **OAuth consent screen**. User type **External**. App name `CIC demo`,
   your email as support email and developer contact. Save through the steps without adding
   scopes (the defaults `email`, `profile` and `openid` are enough).
   - While the app says **Testing**, only Google accounts listed under **Test users** can sign
     in. Either add every teammate and reviewer there, or click **Publish app** so any invited
     Google account can sign in (no review is needed for these default scopes).
3. **APIs & Services** > **Credentials** > **Create credentials** > **OAuth client ID**.
   Application type **Web application**. Name `cic-demo`.
   Under **Authorized redirect URIs** click **Add URI** and enter
   `https://PROJECT_REF.supabase.co/auth/v1/callback` (with your real ref). Click **Create**.
4. Copy the **Client ID** and **Client secret**.
5. Back in Supabase: **Authentication** > **Sign In / Providers** > **Google**. Switch it **ON**,
   paste the Client ID and the Client secret, click **Save**.

### 5. Raise the anonymous sign-in limit

A whole classroom signs in from one school network address, and Supabase limits anonymous
sign-ins per address. The default is 30 an hour, so the 31st student would be locked out.

**Authentication** > **Rate Limits** (older dashboards: **Auth** > **Rate Limits**). Set
**Anonymous users** (sign-ins per hour per IP) from `30` to `500`. Click **Save**.
If your plan will not accept 500, use the highest value it allows and tell the team.

The local setup already uses 500 (`supabase/config.toml`), so local and hosted match.

### 6. Authentication URLs (do this after Part 2 gives you `PAGES_URL`)

Come back here once Cloudflare has given you the site address. **Authentication** >
**URL Configuration**:

- **Site URL**: `PAGES_URL` (for example `https://cic-demo.pages.dev`).
- **Redirect URLs**, add all three:
  - `PAGES_URL`
  - `https://*.cic-demo.pages.dev` (preview deploys; replace `cic-demo` with your Pages project name)
  - `http://localhost:5173`

Click **Save**. Without this, Google sign-in bounces back to the wrong address.

---

## Part 2: Cloudflare Pages

### 1. Create the Pages project

1. Go to <https://dash.cloudflare.com/> and sign in. In the left menu choose **Workers & Pages**
   > **Create application** > **Pages** > **Connect to Git**.
2. Authorize GitHub, pick the repo `2026-Arizona-Opportunity-Hack/DJKKU-CodinginColor`
   (you may need to grant Cloudflare access to that organization) and click **Begin setup**.
3. Project name: `cic-demo` (this becomes `https://cic-demo.pages.dev`). Production branch: `main`.
4. Build settings:
   - Framework preset: **Vite**
   - Build command: `npm run build`
   - Build output directory: `dist`
   - Root directory: leave empty
5. Open **Environment variables (advanced)** and add these, as plain **Text**. They are built into
   the site, so they must be set before the first build:

   | Variable | Value |
   |---|---|
   | `NODE_VERSION` | `22.12.0` |
   | `VITE_SUPABASE_URL` | `SUPABASE_URL` |
   | `VITE_SUPABASE_ANON_KEY` | `ANON_KEY` |
   | `VITE_DATA_SOURCE` | `supabase` |
   | `VITE_FEATURE_HINTS` | `true` (shows "Get a hint" after a wrong answer; written hints work without a Gemini key) |

6. Click **Save and Deploy**. The first build takes a couple of minutes. The repo's `.nvmrc`
   only says `22`, which can resolve to a version older than 22.12, so `NODE_VERSION` is what
   guarantees a new enough Node.

### 2. Add the secrets for the API and hints (Functions only)

Open the project > **Settings** > **Variables and Secrets** > **Add**. For each, set the type to
**Secret** (encrypted, never shown again), and add it for **Production** and for **Preview**:

| Name | Value |
|---|---|
| `SUPABASE_URL` | `SUPABASE_URL` |
| `SUPABASE_ANON_KEY` | `ANON_KEY` (the hint function uses it to ask Supabase who a student's token belongs to; it is the same public key as in step 1) |
| `SUPABASE_SERVICE_ROLE_KEY` | `SERVICE_ROLE_KEY` |
| `GEMINI_API_KEY` | Optional. A free key from Google AI Studio (no billing). Without it every hint comes from the instructor's written ladder. |

Also add the five build variables from step 1 to the **Preview** environment if the dashboard
shows Production and Preview separately, so preview deploys work too.

Secrets are read by Functions at request time, so a **redeploy** is needed after you add them:
**Deployments** > the latest one > **...** > **Retry deployment** (or push any commit).

### 3. Write down the address

When the build is green, open the **Deployments** tab. The site address (like
`https://cic-demo.pages.dev`) is `PAGES_URL`. Now go back to Part 1, step 6.

### Deep links and the `/api` routes (nothing to configure)

Links like `/learn/...`, `/join/DEMO-JOIN-1234` and `/sign-in` work when someone opens them
directly. Cloudflare Pages serves `index.html` for any address that is not a real file, as long as
the project has no `404.html`. The repo has none, so **do not add `public/_redirects`**: the usual
rule `/* /index.html 200` is rejected by Pages as an "infinite loop" and ignored.
Requests to `/api/health` and `/api/v1/...` go to the Functions in `functions/api/`, not to
`index.html`. (An unknown `/api/...` address returns the app page, which is expected.)
This was checked locally with `npx wrangler pages dev dist`.

---

## Part 3: First admin and teammates

The SQL editor runs as the database owner, not as a signed-in person. Admin functions such as
`invite_staff` check *who is signed in*, so they refuse to run from the editor unless you first
say who you are. That is what the `set_config` line below does. Run the lines **together in one
editor tab** (select all, then Run).

### Make yourself the first admin

1. Open the deployed site, go to **Staff sign in** and sign in with Google once.
2. In the Supabase **SQL Editor** run, with your own email:

   ```sql
   select id, email from auth.users where email = 'you@example.org';
   ```

   Copy the `id`. This is your profile id (`ADMIN_ID`).
3. Run, with your id:

   ```sql
   update public.profiles set role = 'cic_admin', can_author = true where id = 'ADMIN_ID';
   ```
4. Reload the site. You are sent to `/admin`.

### Add teammates, reviewers and instructors

For each person (replace the values; role is `instructor`, `mentor`, `reviewer` or `cic_admin`):

```sql
select set_config('request.jwt.claims', json_build_object('sub', 'ADMIN_ID', 'role', 'authenticated')::text, false);
select public.invite_staff('teammate@example.org', 'instructor', true);
```

1. The person signs in once with Google, using **that** email address. They get the invited role
   automatically.
2. To let an instructor see the demo class, find their profile id and add them to it:

   ```sql
   select id, email from auth.users where email = 'teammate@example.org';

   select set_config('request.jwt.claims', json_build_object('sub', 'ADMIN_ID', 'role', 'authenticated')::text, false);
   select public.add_class_instructor('11000000-0000-4000-8000-000000000001', 'THEIR_PROFILE_ID');
   ```

   The second demo class is `11000000-0000-4000-8000-000000000002`.

---

## Part 4: Check that it works

### The API

Replace `PAGES_URL` with your address.

```bash
curl -i PAGES_URL/api/health
# expect: HTTP 200 and {"ok":true,"service":"djkku-coding-in-color"}

curl -i PAGES_URL/api/v1/completion
# expect: HTTP 401 (no key). A 503 means the two secrets in Part 2 step 2 are missing:
# add them and redeploy.
```

Make a read API key for the nonprofit's dashboard. Run in the SQL editor, with your `ADMIN_ID`:

```sql
select set_config('request.jwt.claims', json_build_object('sub', 'ADMIN_ID', 'role', 'authenticated')::text, false);
select public.create_api_key('CIC dashboard demo', array['progress','assessments']);
```

Copy `raw_key` (it starts with `oh_`) from the result **now**. It is shown once and only a hash is
stored. Then:

```bash
curl -i -H "Authorization: Bearer RAW_KEY" PAGES_URL/api/v1/completion
# expect: HTTP 200 with two classes (Demo Period 1: 10 students, Demo Period 3: 7 students)
```

### The student path

1. Open `PAGES_URL/sign-in` on a phone or a private window. Type `DEMO-0000-0000-0001`, click
   **Sign in**. You land on `/learn`, and **Start here** says
   **Start: Variables and Loops pre-test**. Take the test and the first video opens.
2. Open `PAGES_URL/join/DEMO-JOIN-1234` directly. You see the demo class's unclaimed names.
3. Both codes work once as a seat claim. To try them again, ask an instructor for a
   fresh code (instructor page, reset login code) or use the class link for a different name.

### The staff path

Sign in with Google as an admin: `/admin` opens. Sign in as an invited instructor: `/instructor`
opens with the classes they were added to.

---

## If something goes wrong

| What you see | Likely cause and fix |
|---|---|
| Build fails with "Cannot find native binding" | Node is older than 22.12. Set `NODE_VERSION` to `22.12.0` in Pages variables and retry. |
| Site loads but the app shows demo data or "Demo mode" | `VITE_SUPABASE_URL` is missing from the build variables. Add it and **retry the deployment** (they are baked in at build time). |
| Google sign-in comes back to `localhost` or an error page | Part 1 step 6: Site URL and redirect URLs. |
| Google says "access blocked" | The consent screen is in **Testing** and your account is not a test user. Add it or publish the app. |
| "Student sign-in isn't turned on yet" | Anonymous sign-ins are off (Part 1 step 3). |
| "Too many sign-ins from this network" | The rate limit is still 30 an hour (Part 1 step 5). |
| `/api/v1/completion` returns 503 | `SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY` secret missing, or no redeploy after adding. |
| An invited instructor sees no classes | They need `add_class_instructor` (Part 3). |
| `Only a CIC admin can ...` in the SQL editor | Run the `set_config` line first, in the same run, with an `ADMIN_ID` that has role `cic_admin`. |

## Keeping it running

A free Supabase project pauses after a week without use. Open the site before the demo. Keep the
repo public and never commit `.env`; the keys live only in the Supabase and Cloudflare dashboards.
