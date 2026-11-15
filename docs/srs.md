# Software requirements: Curriculum & Student Progress Platform

The organizers' problem brief for Coding in Color (CIC), Fall 2026 hackathon, trimmed to
**our project: Problem 1, the Curriculum & Student Progress Platform.**

- **Original:** [Coding in Color: Fall 2026 problem briefs](https://docs.google.com/document/d/1sdlQDji23jA0LFoYbzNVHCkeG0ICE9XRQSr3xh3ntMU/edit),
  an open document where questions can be left as comments. If this copy and the original
  disagree, the original wins.
- **Removed from this copy:** Problem 2 (the donor and funder platform, handled by another
  team), the donor wording elsewhere in the brief, and the Opportunity Hack background text.
  Everything else is kept as written. Our own reading of it is in
  [requirements.md](requirements.md).
- **Contact:** [#npo-coding-in-color](https://opportunity-hack.slack.com/archives/C0CFBR5PUSK)
  on Slack, Diana Lee Guzman (Founder & CEO), [codingincolor.net](http://codingincolor.net).
- **Logos and colour palette:** <https://photos.app.goo.gl/qsn1pLAmB2BGQkHGA>

## 1. Why this matters for Coding in Color

Coding in Color (CIC) is a Phoenix 501(c)(3) that brings computer science and AI education to
Arizona high schoolers whose schools do not offer it: year-long K12 programs (some for high
school credit, some after school), AI Academy cohorts at Desert Edge, Maryvale and Salt River
schools, summer camps, and Day of Compute (140+ Phoenix Union students). Instructors are mostly
ASU students and rotate every semester.

Classes run on CIC slide decks and printed worksheets, which means a partner-school teacher
needs real training to deliver them, nobody knows which module a student is on, and a student
who misses a week falls behind with no way to catch up.

## 2. What success looks like

Judges score Sunday on what runs. CIC judges on what it can use Monday.

| Outcome | Sunday demo (judges) | Monday CIC has |
|---|---|---|
| Curriculum: the platform teaches | A student with no instructor help works through a module (video, check, worksheet, exit question) and the next one unlocks | A partner-school teacher runs CIC's curriculum from a link, no training on the decks |
| Curriculum: nobody falls behind | A student who joins late is dropped at the right module and catches up | Attendance gaps stop costing a student the semester |
| Curriculum: learning is measurable | Pretest and post-test for one module; learning gain per student and per class | Grant reports cite learning gain, not hours taught |
| CIC's dashboard sees it | Authenticated Read API (or MCP) returns cohort stats, already aggregated, with a key | CIC's org dashboard shows program health without extra logins |

## 3. Beyond the normal scope

The P0s are table stakes. These are the ideas that would make a judge say "I have not seen that
before" and make CIC's week easier. Each team should pick one.

| Idea | Why it matters for CIC |
|---|---|
| Worksheet-to-module converter: upload a printed worksheet or slide deck, AI drafts the module (video stub, check question, activity, exit question), instructor edits and publishes | Most of CIC's curriculum is slides, docs, and paper. This is how it gets onto the platform in weeks, not a semester |
| Learning gain as the headline metric: pre/post gain per concept, per class, per cohort, exportable | Turns "we taught 140 students" into "students gained 32 points on loops", which is what funders fund. This is also much more hyper-specific testing outcomes than overall testing scores you might see a high school publish |
| Socratic AI hints that log what students struggled with | Helps the student in the moment and tells the instructor which concept to reteach tomorrow |
| No-login coding tool with AI help: in-browser Python, share without sign-in, teacher-reviewable hints | Every free editor today is either a runtime with no teaching or puts AI behind a paid login. CIC's camps run on locked-down lab machines with no student accounts, so there is nothing to hand a student today |

## 4. Problem 1: Curriculum & Student Progress Platform

### Problem

CIC's curriculum lives in slide decks, docs, and printed worksheets. A partner-school teacher
needs a lot of training to deliver a CIC deck; what teachers are used to is handing students a
code.org link and letting the platform teach.

Instructors track progress by hand, pretest and post-test results sit outside any system,
attendance is uneven, and CIC cannot answer "how far did the Maryvale cohort get?" or "how much
did they learn?" without asking every instructor. There is also no free code tool that fits. CIC
used CodeHS at summer camp specifically to avoid student accounts; Trinket needs a Google login
and had bugs in testing; Replit, Colab and GitHub all need accounts. The no-login editors that
exist (online-python.com, pythoncompiler.io, Programiz) are runtimes only: no progress, no
teacher view, and AI help only behind a paid login.

### Success criteria

- The platform teaches; the instructor manages. A teacher with no CS background runs a CIC
  module by sharing a link, with no training on the content.
- A student works through a module self-paced (short video or slides, a check for
  understanding, a worksheet or exercise, an exit question) and the next module unlocks. A
  student who joins a week late catches up without the instructor re-teaching.
- An instructor sets up a new class, imports a roster CSV and assigns a module in under 10
  minutes.
- Learning gain (post-test minus pretest) is computed per student and per class without a
  spreadsheet.
- A K12 teacher or district administrator outside CIC can log in and review the curriculum.
- CIC's org dashboard pulls cohort completion and learning gain through a read API.

### Users

- **CIC admin** (Founder & CEO, Program Manager): sees every class; per-cohort completion and
  learning gain for grant reports; onboards a new partner school without engineering help.
- **Instructor** (CIC's ASU-student instructors, or a partner-school teacher): manages the class
  on the platform; does not learn on it. Creates a class, assigns modules, sees who is stuck.
- **Student** (14-18, Chromebook in class, phone everywhere else): follows the module like a
  code.org lesson; submits work; sees own progress.
- **External K12 teacher or district administrator** (new in v3): reviews CIC material; later,
  runs it with their own class without CIC involved.
- **Curriculum author:** publishes and edits modules without a code deploy.

### P0: must demo Sunday

- Easy way to create and edit curriculum for instructors and CIC staff. Curriculum authoring UI
  so CIC staff publish modules without engineering.
- Four roles with role-based access: student, instructor, CIC admin, external reviewer
  (read-only access to the curriculum).
- Content model: module → lesson → activity. A module template of video or slides,
  check-for-understanding question, worksheet or exercise, exit question. Modules unlock in
  sequence.
- Digital worksheets: each printed worksheet becomes an on-platform activity the student
  completes and submits.
- Pretest and post-test pairs per module; learning gain per student and per class.
- Progress tracking: per-activity completion, scores, time on task; a late-joining student sees
  exactly where to start.
- Instructor dashboard: roster, per-student progress, stuck and not-started lists.
- Roster CSV import.
- Read API, key-authenticated, for progress and assessment data.

### P1: pick at least one

- External teacher self-serve: a district teacher creates a class on CIC's curriculum with their
  own roster; CIC sees usage.
- Code runner with auto-grading and instant feedback.
- AI tutor hints: Socratic hint, never the answer. A generic chatbot on a lesson page does not
  count.
- Concept-level mastery view per class ("80% stuck on loops").
- In-browser Python runner embedded in the activity (Pyodide), so a student runs and submits code
  inside the module with no second account; submissions land in the progress record.

### P2: moonshots

- Low-bandwidth and mobile-first mode for schools with poor connectivity.
- Gradebook export for classes taken for high school credit.
- Consent-gated parent or guardian progress view.
- Roster sync with Google Classroom or a school SIS.
- A free, no-login coding tool for CIC: in-browser Python, a share link that needs no sign-in,
  and AI hints the teacher can review. The CodeHS Smart Hints idea without the Pro tier, the
  credits, or district approval.

### Build on, do not rebuild

Not a generic LMS. The mental model teachers already have is code.org: a link the student
follows. Match that experience instead of adding teacher training. CodeHS is the closest analog
but it is CodeHS's curriculum, pricing and data; Canvas is open source but too heavy for a 2-10
person org; Google Classroom distributes assignments but has no custom authoring or CS
auto-grading. Build the thin CIC-specific layer on Postgres/Supabase and borrow auth and video
hosting. Prior art: OHack's NMTSA LMS (lms.ohack.dev) has the same role and progress shape for
adult training. For code, Pyodide runs CPython in the browser with no server and no login; that
is the base for a runner inside an activity.

### Judging note

No separate AI score. Auto-grading, hints and analytics count under Scope (complexity versus
what exists) and Polish (usable Monday). If an instructor cannot set up a class in 10 minutes,
or a student cannot follow a module without the instructor, it fails on UX regardless of
features.

## 5. Shared requirements

These applied to both problems in the original; the ones that apply to Problem 1 are kept.

- Role-based auth; no shared passwords; least privilege per role.
- Read API with key authentication; documented so CIC's dashboard owner can wire it up without
  the team.
- Hosting within OHack's envelope: $20/month plus $250 one-time setup.
- Data minimization: collect only what the use case needs. Problem 1 handles minors; no PII
  beyond name, school and class.
- Every outbound message or reminder is drafted by the system and sent by a human.
- Accessibility: Lighthouse accessibility 95 or better; keyboard-navigable.
- Deployed and demoable by Sunday 2:00 PM with a README that lets CIC run it.

## 6. Parked

We spoke about this, but we don't need to work on this for the hackathon.

- Alumni Outcomes platform: real need, no urgency from CIC, and two prizes for two problems.
  Full write-up stays in the Nonprofit tab for Spring 2027.
- Website revamp: already underway on Squarespace. Only residue is adding Plausible or Umami
  analytics to the new site.
