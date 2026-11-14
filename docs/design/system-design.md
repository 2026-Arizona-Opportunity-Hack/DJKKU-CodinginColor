[\[Public\] ASU OHack November 14th and 15th 2026](https://docs.google.com/document/d/1sdlQDji23jA0LFoYbzNVHCkeG0ICE9XRQSr3xh3ntMU/edit?tab=t.x1fokc5s4f3p)

**What we’re building:** a self-paced learning platform for CIC’s high school coding classes, replacing slide decks and printed worksheets. A teacher shares a link and the platform teaches; the instructor manages. Students work through modules (video, check question, digital worksheet, exit question), and the next module unlocks as they finish.  
Idea

**Demo requirements by Sunday 2:00 PM (all P0):**

* Curriculum authoring UI (CIC staff publish modules without engineering)  
* 4 roles: student, instructor, CIC admin, external reviewer (read-only)  
* Module → lesson → activity content model with sequential unlock  
* Digital worksheets, plus pre/post tests with learning gain per student and per class  
* Progress tracking, with late joiners shown where to start  
* Instructor dashboard: roster, per-student progress, stuck and not-started lists  
* Roster CSV import  
* Key-authenticated read API (aggregated data only)

**Team:** Jad, Daxx, Koen, Umang, Krishna

**Open decisions:** student login method, where the answer key lives, frontend framework

Ideas: AI for CIC and Student analytics dashboard accessed by Instructor as well to aid if the student is stuck at a problem instructor can aid.

**Claim a lane in the team chat. The plan has five:**

* **A: Data and security (schema, RLS, `submit_answer`, seed data) \- Koen**  
* **B: Student experience (the player, unlock flow, mobile) \- Daxx C**  
* **C \- Umang: Authoring and assessments (module editor, tests, learning gain screens) Umang**  
* **D: Instructor and admin (roster import, dashboard, stuck lists) \- Jad A**  
* **E: API, AI, glue (read API, hints function, reviewer view, deploy, README) Krishna**

**System Design:**

# **CIC Problem 1: Design Plan (Curriculum & Student Progress Platform)**

**What changed in this revision (Nov 14, 2026).** Changed table cells are shaded yellow; changed text starts with **Updated**.

* Scoring lens rewritten against the [OHack judging criteria](https://www.ohack.dev/hackathon-judging-criteria): four categories, 10 points each.  
* New Final stack section: every layer decided, \$0 a month, with trade-offs and rejected options.  
* Open questions 1, 3, 9 and 11 answered.  
* Roles: added Mentor (volunteer) and Independent student (homeschool), from the comment on question 1\.  
* Schema: added tables for independent learners, mentors and hint caching.  
* AI hints moved to a free provider, with instructor-written hints as the fallback.  
* Build plan: added what judges read first (pitch video, README, decision records, SECURITY.md).

## **Scoring lens**

**Updated:** Judges score four equally weighted categories, Scope, Documentation, Polish and Security, at 10 points each for 40 total. Visual design is only a tiebreaker, so every hour goes to those four.

Judges watch our pitch video first, then read the code and README. Only finalists get 5 to 10 minutes of live demo Q\&A, so the video and the repo are the real demo.

| Category (10 pts) | What judges check | What we ship to score 4 or 5 |
| ----- | ----- | ----- |
| Scope: impact and complexity | Real problem, complexity versus existing tools, would CIC actually use it. Needing to hire a developer or learn a new tool counts against us | A teacher runs a module from a link. Learning gain per concept. AI stuck-assist. Homeschool and mentor path. \$0 running cost, so CIC never needs a developer or a bill |
| Documentation: the sustainability test | README covering setup, deploy and env vars. Comments where logic isn't obvious. Intuitive UX. Recorded architecture decisions. Could a non-author run it in six months? | README with copy-paste setup, `.env.example`, `docs/adr/` with one short file per stack decision below, API docs page, an admin how-to, comments on every RLS policy and grading function |
| Polish: work left before CIC can use it | Public deployment, graceful errors, empty states, slow network, invalid input, little work left to MVP | Live on Cloudflare Pages from hour 2\. Every screen has loading, empty and error states. CSV import shows row-level errors. AI failure falls back to written hints |
| Security: data protection and role-based access | Auth gates sensitive data, role-based access, no committed secrets, validated input, injection closed. Credit for engaging even if not fully hardened | RLS on every table, answer keys server-side only, hashed API keys, secret scanning in CI, zod validation on every form and endpoint, SECURITY.md with our threat model for minors' data |

In a close call, Scope and Polish beat Documentation, and the head judge has final say. Scores of 5 are reserved for work a judge would recommend to their own employer.

Hard constraints:

* **Updated:** Completely free. \$0 a month with no credit card on any account, so nothing can ever bill CIC. This is stricter than the brief's \$20 a month envelope.  
* Role-based auth, no shared passwords, least privilege per role.  
* Key-authenticated read API, documented well enough that CIC's dashboard owner can wire it up alone.  
* Minors: collect only name, school and class.  
* Anything outbound is drafted by the system and sent by a human.  
* Lighthouse accessibility 95 or better, fully keyboard-navigable.

Out of scope: Problem 2 (donors), the parked alumni platform, the website revamp.

Sources: [OHack judging criteria](https://www.ohack.dev/hackathon-judging-criteria), CIC problem brief (project doc).

[https\://www\.ohack.dev/hackathon-judging-criteria](https://www.ohack.dev/hackathon-judging-criteria) : This is the judging criteria. Go through it and update it. Highlight the parts u change in t

## **Open questions**

Eleven decisions to settle in the next hour. Each has a default, so we can start building before anyone answers.

| \# | Question | Recommended default |  |
| ----- | ----- | ----- | ----- |
| 1 | Student login (minors, no email, Chromebooks) | Roster import generates a personal login code per student (short code plus QR). Enter it once and the device stays signed in. A class join link lets a late joiner pick their name from the roster. Built on Supabase anonymous auth plus a server-side claim function. No shared passwords. Updated: anyone can open lessons with no account (progress stays on the device). A homeschooled or independent student self-registers with a display name only and gets the same personal code, which saves progress and unlocks their own dashboard. They join the CIC Open class, and a volunteer mentor or CIC admin can see them and reset a lost code. No email is collected from minors, which keeps us inside the brief's name, school and class rule. |  |
| 2 | Where the answer key lives | A separate keys table that no student or reviewer policy can select. Grading runs in a Postgres function; the client only gets correct or incorrect plus feedback. |  |
| 3 | Frontend framework | Decided: React and TypeScript single-page app built with Vite, styled with Tailwind and shadcn/ui, hosted on Cloudflare Pages. Reasons and rejected options are in Final stack. |  |
| 4 | Video hosting | Unlisted YouTube embeds in privacy-enhanced mode. Completion is the check question, not a play-through. Fallback if a school blocks YouTube: link plus transcript. |  |
| 5 | Worksheet question types for P0 | Multiple choice, short answer, fill in the blank, ordering, reflection (unscored). Code cells (Pyodide) are P1. |  |
| 6 | Learning gain formula | Headline is post minus pretest in points, as the brief defines it. Add normalized gain, (post minus pre) divided by (100 minus pre), as a second column. Per student, per class, per concept. |  |
| 7 | Unlock rules | Strict order: activities in a lesson, lessons in a module, modules in a class. A module opens after its pretest is taken (not passed) and finishes with its post-test. Instructor can override for one student. |  |
| 8 | Who can author | Instructors and CIC staff draft, CIC admin publishes. Publishing creates a version; a class stays on the version it started with. |  |
| 9 | External reviewer access | Updated: Google sign-in (free in Supabase Auth, and most districts run Google), limited to emails the CIC admin has invited. Read-only, sees published curriculum with answer keys hidden. Magic links dropped because they need an email sender and Google sign-in doesn't. |  |
| 10 | Read API shape | One key per consumer, stored hashed, aggregated rows only (cohort, class, concept), groups under 5 students suppressed. |  |
| 11 | Hosting cost | Decided: \$0 a month. Supabase Free plus Cloudflare Pages Free, no card on file anywhere. Supabase pauses free projects after a week of low activity, so a daily GitHub Actions job pings it and a nightly job exports a backup. |  |

Questions for CIC (Slack \#npo-coding-in-color):

* Can we get one real module (slides, worksheet, pre and post questions) to seed the demo? Without it we demo placeholder content.  
* Do partner-school Chromebooks reach YouTube and public CDNs, which Pyodide needs?  
* What counts as "stuck"? Our default is in the Modules section.  
* Do students have school emails? It decides whether we ever need email login.  
* Which concepts should gain be reported by (variables, loops, conditionals)?  
* Can we get the logo and palette files from their shared album?

## **Final stack (Updated, new section)**

The stack is Supabase for data and auth, a React single-page app, and Cloudflare Pages for hosting and small server functions. It costs \$0 a month and needs no credit card anywhere. Each pick was judged on four things: free forever, scores on the rubric, easy for the next rotating ASU instructor to pick up, and fast for five people to ship by Sunday.

| Layer | Choice | Why | Rejected and why | Free limit |
| ----- | ----- | ----- | ----- | ----- |
| Database | Supabase Postgres | Relational data fits module, lesson, activity. Learning gain and stuck lists are plain SQL views. RLS puts role security inside the database, which scores Security. Open source, so CIC can leave later | Firebase: NoSQL makes per-class and per-concept rollups painful. Neon: Postgres but no auth, so we'd build login. PocketBase: needs a server someone has to run | 500 MB database, 50,000 monthly users, 1 GB files, 2 projects. Pauses after a week idle |
| Auth | Supabase Auth: anonymous session plus login-code claim for students, Google sign-in for staff, reviewers and mentors | No email or password for minors. Staff already have Google accounts. One user table for RLS | Clerk or Auth0: a second vendor with its own caps. Email and password: students lack email and passwords get shared | Included in the 50,000 monthly users |
| Core logic | Postgres functions: grading, unlock, code claim, next activity | Runs next to the data, can't be skipped by the browser, nothing to host | Express or FastAPI server: needs hosting, free hosts sleep, one more thing to secure | Free |
| HTTP endpoints | Cloudflare Pages Functions: read API and AI hint proxy | Same repo and deploy as the frontend. Secrets live in Cloudflare env vars, never in the browser | Supabase Edge Functions: works, but a second deploy pipeline (kept as fallback). Vercel functions: see Hosting | 100,000 requests a day |
| Frontend | React, TypeScript, Vite single-page app, React Router | Biggest pool of students and volunteers who can maintain it. A logged-in app needs no server rendering or SEO. Builds to static files that host free anywhere | Next.js: server rendering we don't need, and it is happiest on Vercel. SvelteKit: fewer maintainers. Plain HTML: too slow to build dashboards | Free |
| UI kit | Tailwind and shadcn/ui (Radix) | Radix handles keyboard and ARIA, which gets us to Lighthouse 95\. Components are copied into our repo, so no runtime dependency to break | MUI: heavier and harder to theme to CIC's palette. Bootstrap: dated, weaker accessibility | Free (MIT) |
| Data and forms | TanStack Query, react-hook-form, zod, Recharts, Papa Parse | zod schemas are shared by forms and server functions, so input is validated twice. Papa Parse handles messy roster CSVs | Redux: boilerplate we don't need. Chart.js: fine, Recharts fits React better | Free (MIT) |
| Hosting | Cloudflare Pages | Unlimited bandwidth and static requests. Commercial and nonprofit use allowed on the free plan. Preview link per pull request | Vercel Hobby: limited to non-commercial personal use, so a nonprofit org is a gray area. Netlify: bandwidth cap. GitHub Pages: no server functions | 500 builds a month, 1 build at a time |
| Video | Unlisted YouTube, privacy-enhanced embeds | Free, reliable, CIC can upload without us | Supabase Storage: 1 GB fills after a few videos | Free |
| Python runner (P1) | Pyodide in the browser | Runs real Python with no server and no student account, the gap CIC named | Judge0 or Piston: needs a server and a sandbox to secure | Free |
| AI hints | Instructor-written hint ladder first, Gemini Flash-Lite free tier second, called through the Pages Function and cached per activity and wrong answer | Works with AI off. Caching keeps us far under free limits. No billing account attached, so the worst case is a rate-limit error, never a bill | OpenAI and Anthropic APIs: paid only. Self-hosted model: needs a GPU | Low and changing rate limits, so the feature must fall back gracefully |
| CI and ops | GitHub Actions: lint, type check, tests, Lighthouse CI, gitleaks secret scan, daily keepalive ping, nightly encrypted backup | Proves Polish and Security on every push. Backup is encrypted with a key only CIC holds, because Actions artifacts are not private enough for minors' data | Manual checks: get skipped at 3 AM | Free on public repos |
| API docs | OpenAPI file plus a static Scalar page at /api/docs | CIC's dashboard owner wires it up alone, which scores Documentation | Postman collection: needs an account | Free |
| Domain | Free pages.dev address | CIC can point a codingincolor.net subdomain at it later at no cost | Buying a domain: costs money | Free |

Cost guardrails:

* No card on Supabase, Cloudflare or Google AI Studio. Every limit fails closed instead of billing.  
* Rough headroom check (our estimate): 1,000 students × 200 activities × about 300 bytes per progress row is about 60 MB, well under 500 MB.  
* Google's free AI tier may use requests to improve its products, so the hint call sends only the question text and the student's answer, never a name or school.  
* If CIC ever outgrows this, the first paid step is Supabase Pro at \$25 a month, which removes the idle pause. The README will say so.

Sources: [Supabase pricing](https://supabase.com/pricing), [Supabase project pausing](https://supabase.com/docs/guides/platform/free-project-pausing), [Cloudflare Pages](https://pages.cloudflare.com/), [Cloudflare Pages limits](https://developers.cloudflare.com/pages/platform/limits), [Vercel fair use guidelines](https://vercel.com/docs/limits/fair-use-guidelines), [Gemini API pricing](https://ai.google.dev/pricing).

## **Roles and permissions**

Updated: six roles (the brief's four plus Mentor and Independent student), one `role` column on the profile, and every policy keyed on class membership. Default deny.

| Capability | Student | Independent student (new) | Mentor (new) | Instructor | CIC admin | Reviewer |
| ----- | ----- | ----- | ----- | ----- | ----- | ----- |
| Read curriculum | Assigned modules | All published; browsing needs no login | All published | All published | All, including drafts | All published, no answer keys |
| Complete activities and tests | Yes | Yes | Preview only | Preview only | Preview only | No |
| See own progress dashboard | Own | Own | n/a | n/a | n/a | n/a |
| Per-student progress and stuck list | No | No | Assigned mentees only | Own classes | All classes | No |
| Create class, import roster, assign modules | No | Picks modules inside CIC Open | No | Own classes | All, plus onboard schools | No |
| Draft and edit modules | No | No | No | Yes | Yes | No |
| Publish modules | No | No | No | No | Yes | No |
| See answer keys | No | No | Yes | Yes | Yes | No |
| Send a nudge or note to a student | No | No | Mentees; drafted, human sends | Own classes | All | No |
| Cohort completion and learning gain | No | No | No | Own classes | All | No |
| Manage API keys, invite reviewers, approve mentors | No | No | No | No | Yes | No |

Rules that keep it safe and simple:

* A student can never read another student's rows, and an instructor can never read a class they don't instruct.  
* Three helper functions carry most of the policies: `is_admin()`, `is_instructor_of(class_id)`, `is_member_of(class_id)`.  
* The reviewer role gets no write policy anywhere, which makes "read-only" provable in the demo.

**Updated:** mentor safeguards, because mentors are volunteers working with minors:

* A mentor signs in with Google, and the CIC admin approves them before they can see any student.  
* A mentor sees only students assigned to them, through a fourth helper, `is_mentor_of(student_id)`.  
* All contact stays on the platform. Mentor notes are logged and visible to CIC admin, and there is no private messaging or contact info exchange.  
* An independent student is matched to a mentor by the CIC admin, or picks one from a list when CIC enables that.

## **Content model and schema sketch**

The hierarchy is module, then lesson, then activity, and every student action becomes a row we can aggregate. This is a proposal: the schema section of the team doc is still empty, so reconcile it with whatever Supabase already has.

| Table | Key columns | Notes |
| ----- | ----- | ----- |
| profiles | id (auth user), role, display\_name, can\_author | One row per login |
| schools, classes | class: school\_id, name, term, join\_code, created\_by | A class belongs to one school |
| class\_members | class\_id, profile\_id, member\_role, login\_code\_hash, claimed\_at | Roster import writes here; unclaimed rows are students who haven't logged in yet |
| concepts | id, name | Tags for per-concept gain and the mastery view |
| modules | slug, title, summary, status, version, published\_at | Each published version is immutable |
| lessons | module\_id, position, title |  |
| activities | lesson\_id, position, kind, content (jsonb), required, concept\_id | Kinds: video, reading, check, worksheet, exit. Content holds prompts and choices, never answers |
| activity\_keys | activity\_id, answer, explanation, hint\_ladder | No student or reviewer policy. Read only by security-definer functions |
| assessments, assessment\_items | module\_id, kind (pre or post), pair\_key, concept\_id | Pre and post items share a pair\_key so gain is matched per item and per concept. Keys live in a matching keys table |
| class\_modules | class\_id, module\_id, module\_version, position, opens\_at | What a class has been assigned |
| submissions | student\_id, class\_id, activity\_id, response, is\_correct, score, attempt\_no | Append-only |
| progress | student\_id, class\_id, activity\_id, status, best\_score, time\_spent\_s, completed\_at | One row per student per activity. Drives unlock, "start here" and the dashboard |
| assessment\_results | student\_id, class\_id, assessment\_id, score\_pct, per\_concept (jsonb) | Feeds learning gain |
| api\_keys | name, key\_hash, scope, last\_used\_at, revoked\_at | Show the raw key once at creation |
| hint\_events (P1) | student\_id, activity\_id, attempt, hint, concept\_id | Powers the AI stuck-assist |

Server-side pieces:

* `submit_answer(activity_id, response)` grades against the key, writes the submission and progress, and **rejects locked activities**. Unlock is enforced here, not only hidden in the UI.  
* `claim_login_code(code)` turns a roster row into a signed-in student.  
* `next_activity(class_id)` returns the first incomplete activity in order. It powers both the unlock and the late-joiner "start here" card.  
* Views: `v_class_progress`, `v_stuck`, `v_learning_gain` (per student and per class), `v_concept_mastery`. The dashboard and the read API both read these, so the numbers always agree.

**Updated:** additions for independent learners, mentors and free AI.

| Table or function | Key columns | Notes |
| ----- | ----- | ----- |
| classes (changed) | add kind: school or open | One "CIC Open" class holds every independent student |
| mentors | profile\_id, approved\_by, approved\_at | No access to any student until a CIC admin approves |
| mentor\_assignments | mentor\_id, student\_id, assigned\_by, active | Drives `is_mentor_of()` |
| mentor\_notes | mentor\_id, student\_id, body, created\_at | Safeguarding log, readable by CIC admin |
| hint\_cache | activity\_id, wrong\_answer\_hash, hint, created\_at | One AI call per distinct wrong answer, reused for every student |
| `self_register(display_name)` |  | Creates an anonymous user and login code in CIC Open. The Pages Function in front of it rate-limits by IP to block spam sign-ups |
| `import_guest_progress(payload)` |  | A guest's on-device progress is validated and merged when they register, so nothing is lost |

## **System modules**

Twelve modules, each with a clear edge so five people can build in parallel. P0 means it must work in the Sunday demo.

| Module | What it does | Depends on | Priority |
| ----- | ----- | ----- | ----- |
| M1 Auth and roles | Login codes, magic links for staff and reviewers, role policies, RLS helpers | Schema | P0 |
| M2 Class and roster | Create class, CSV import with validation and a preview, login codes (printable sheet), assign modules, join link | M1 | P0 |
| M3 Authoring studio | Form-based editor: module, lessons, activities, question types, concept tags, draft and publish, live preview | M1 | P0 |
| M4 Student player | Link to "start here", video, check, worksheet, exit question, locked and unlocked states, progress bar, works on a phone | M1, M5 | P0 |
| M5 Assessment engine | Pre and post tests, server-side grading, answer-key isolation, learning gain math | Schema | P0 |
| M6 Progress and events | Per-activity status, scores, time on task via a light heartbeat, "next activity" function | M5 | P0 |
| M7 Instructor dashboard | Roster, per-student progress, stuck list, not-started list, class learning gain, per-concept view | M6 | P0 |
| M8 Admin console | All classes and cohorts, completion and gain for grant reports, API keys, reviewer invites, onboard a school | M7 | P0 |
| M9 Reviewer view | Read-only curriculum browser, no keys, no student data | M3 | P0 |
| M10 Read API | Key auth, aggregated endpoints for progress and assessments, OpenAPI page for CIC's dashboard owner | M6 | P0 |
| M11 Shell, design and accessibility | CIC branding, layout, keyboard flow, contrast, Lighthouse checks in CI | All | P0 |
| M12 Seed, docs and deploy | One real module and two classes of fake students, README that lets CIC run it, one-command deploy | All | P0 |

Defaults to confirm:

* **Stuck** means either three wrong attempts on one activity, or an activity open for more than 10 minutes without completion, or no activity at all for 3 school days on an assigned module.  
* **Not started** means an enrolled student with zero progress rows on the currently assigned module.  
* **Late joiner** lands on the first incomplete activity of the earliest open module. The instructor can mark earlier modules as skipped for that student.  
* **Learning gain** is shown per student, per class and per concept, and exportable as CSV.

## **Beyond scope: AI hints and instructor stuck-assist**

The brief asks every team to pick one idea past the P0s, and at least one P1. Your idea fits the Socratic hints P1 and the "which concept to reteach tomorrow" angle in the brief, so the recommendation is to build it, on top of a working P0, behind a feature flag.

**How it works**

1. A student stuck on a check or worksheet item taps **Hint**. A Cloudflare Pages Function sends the item prompt, the student's attempt and the instructor-approved hint ladder to Gemini Flash-Lite on its free tier, after checking hint\_cache first (Updated).  
2. The model returns one Socratic nudge, never the answer. The key stays server-side, hints are capped at 3 per activity, and the output is checked so it can't contain the key.  
3. Every hint is logged to `hint_events` with the concept tag.  
4. The instructor dashboard gets a **Stuck now** card per student: activity, wrong attempts, hints used, minutes stuck, and a one-line AI summary of where they are lost with a suggested nudge.  
5. The instructor sends the nudge or a note back. The AI drafts and a human sends, which is the brief's own rule for outbound messages.  
6. A class-level **Reteach tomorrow** list ranks concepts by wrong-answer rate and hint volume, which is also the concept mastery P1.

**Guardrails for minors:** send no names or school to the model, only the item text and the student's answer under an opaque id. Give instructors an off switch. Updated: no billing account is ever attached to the AI key, so spend is always \$0. If we hit the free rate limit, the button serves the next instructor-written hint instead of an error.

| Option | Value for CIC | Build cost | Call |
| ----- | ----- | ----- | ----- |
| Socratic hints plus stuck-assist (your idea) | Helps the student now, tells the instructor what to reteach | Medium | Build after P0 slice works |
| Concept mastery view | "80% stuck on loops" for free once items are tagged | Low | Build, it falls out of the schema |
| Learning gain as the headline metric | What funders fund; the brief calls it out | Low | Build, it is already P0 |
| Worksheet-to-module converter | Gets their slides and paper onto the platform in weeks | Medium | Stretch, reuses the authoring studio |
| Pyodide in-browser Python runner | No-login code practice, a gap CIC named | Medium to high | Stretch only if hints land early |

## **Build order, team lanes and demo**

Build one thin vertical slice first, then widen it. A student completing one module end to end by midnight tonight is the gate for everything else.

1. **Foundations (first 1 to 2 hours):** settle the open questions, freeze the schema, scaffold the repo, wire Supabase, deploy an empty app so deploys are never a Sunday surprise.  
2. **Vertical slice:** login code, student player with one hard-coded module, `submit_answer`, progress row, "next unlocks." Authoring and dashboard are mocked.  
3. **P0 breadth:** authoring studio, roster CSV, pre and post with learning gain, instructor dashboard, admin console, reviewer view, read API.  
4. **P1 and polish:** hints and stuck-assist, concept mastery, accessibility pass, mobile pass, empty and error states.  
5. **Freeze (last 3 hours before 2:00 PM):** no new features. Seed data, README, demo video, rehearsal, a warm database.

**Updated:** what judges read first. Lane E owns these, everyone contributes, and they start Saturday, not Sunday:

* Pitch video, 3 to 4 minutes, recorded from the demo script below. Every judge watches it before anything else.  
* README: what it is, live link, a demo login per role, copy-paste setup, every env var explained, deploy steps, how the keepalive works, and the first paid step if CIC outgrows free.  
* `docs/adr/`: one short file per row of Final stack (context, decision, alternatives).  
* SECURITY.md: what we collect about minors and why, the RLS approach, key handling, how to report an issue.  
* Admin how-to with screenshots: create a class and import a roster in under 10 minutes.  
* API docs at /api/docs with a working curl example.

Suggested lanes for five people. Claim yours in the team chat.

| Lane | Owns | Hands off to |
| ----- | ----- | ----- |
| A Data and security | Schema, RLS, `submit_answer`, key isolation, views, seed | Everyone |
| B Student experience | M4 player, unlock UX, late-joiner "start here", mobile | A for functions |
| C Authoring and assessments | M3 studio, M5 test builder, learning gain screens | A for tables |
| D Instructor and admin | M2 roster import, M7 dashboard, M8 console, stuck lists | A for views |
| E API, AI, glue | M10 read API and docs, M9 reviewer, hints Pages Function, docs and video, deploy, README | D for dashboard data |

Demo script (about 5 minutes, one story):

1. CIC admin creates a class and imports a roster CSV, with a visible timer showing under 10 minutes.  
2. Admin assigns a module authored in the studio a minute earlier.  
3. A student signs in with a code, takes the pretest, and works video, check, worksheet and exit question. The next module unlocks.  
4. A second student joins late and lands exactly on the right activity.  
5. Post-test results appear. Learning gain shows per student and per class, and per concept.  
6. Instructor dashboard shows the stuck list. A hint log and the AI nudge are visible there.  
7. A reviewer logs in and can read but not change anything.  
8. A `curl` with an API key returns aggregated cohort data, and the same call without a key is refused.

**Updated:** after step 4, an independent student opens a lesson with no account, then self-registers and keeps their progress. A mentor signs in and sees only that student's stuck card.

Risks and fallbacks:

* **Login friction with minors:** if claim codes slip, fall back to class join link plus roster name pick with a PIN.  
* **RLS eats the schedule:** write policies for three tables first (submissions, progress, keys), and test with one script per role.  
* **No real CIC content:** build a tiny "variables and loops" module ourselves from the CIC style and label it a seed.  
* **AI scope creep:** hints ship only after the vertical slice and P0 breadth are green.  
* **Supabase pauses or a deploy breaks late:** deploy now, redeploy hourly, warm the database before judging.  
* **Accessibility found late:** run Lighthouse on every page type from the first deploy, not on Sunday.

**Updated:** new risks from the free-only rule and the rubric:

* **Supabase pauses after a week idle:** daily GitHub Actions ping, and the README tells CIC how to unpause in one click.  
* **No free backups on Supabase:** nightly encrypted dump from GitHub Actions, restore steps in the README.  
* **Gemini free limits drop or change:** hint\_cache plus written hints mean AI going down never breaks a lesson.  
* **Spam self-registrations:** IP rate limit in the Pages Function, and CIC Open students can't see anyone else.  
* **Mentor misuse:** admin approval, assigned-only access and a logged note trail.  
* **Judges only see the video:** record it Sunday morning from the frozen build, not at 1:45 PM.

