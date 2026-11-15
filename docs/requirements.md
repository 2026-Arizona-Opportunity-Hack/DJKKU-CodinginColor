# Requirements

What the platform must do, for whom, and the limits it must stay inside. Source:
the CIC problem brief ([CIC Problem 1](https://www.ohack.dev/project/d09466fadf1b11f18e63deadc507a848),
and the organizers' [full brief](https://docs.google.com/document/d/1sdlQDji23jA0LFoYbzNVHCkeG0ICE9XRQSr3xh3ntMU/edit),
an open document where questions can be left as comments; our trimmed copy for this
project, without the donor problem, is [srs.md](srs.md))
and the team design plan (Nov 14, 2026 revision). If this file and the brief
disagree, the brief wins; open an issue and fix this file.
CIC's logo and colour palette: <https://photos.app.goo.gl/qsn1pLAmB2BGQkHGA>.

**Priority:** P0 = must work in the Sunday 2:00 PM MST demo. P1 = built only
after the P0 slice works, behind a feature flag.

## Product goal

A self-paced learning platform for CIC's high school coding classes that replaces
slide decks and printed worksheets. A teacher shares a link and the platform
teaches; the instructor manages. Students work through modules (video, check
question, digital worksheet, exit question) and the next module unlocks as they
finish.

## Functional requirements (P0)

| ID | Requirement |
|---|---|
| R1 | Curriculum authoring UI so CIC staff can publish modules without engineering |
| R2 | Four roles: student, instructor, CIC admin, external reviewer (read-only) |
| R3 | Module → lesson → activity content model with sequential unlock, enforced server-side |
| R4 | Digital worksheets; pre/post tests with learning gain per student, per class and per concept |
| R5 | Progress tracking; late joiners are shown where to start |
| R6 | Instructor dashboard: roster, per-student progress, stuck and not-started lists |
| R7 | Roster CSV import with row-level validation errors |
| R8 | Key-authenticated read API returning aggregated data only. We build and host it; CIC's existing org dashboard pulls cohort completion and learning gain from it. There is no external API to consume (see "Read API" below) |

## Additions in the Nov 14 plan revision

| ID | Requirement | Priority |
|---|---|---|
| R9 | Independent (homeschool) students: open lessons with no account, self-register with a display name only | P0 for the demo script |
| R10 | Mentor role (approved volunteer, sees assigned mentees only) | P0 for the demo script |
| R11 | AI Socratic hints and instructor stuck-assist; AI must never break the core flow | P1 |
| R12 | Concept mastery view ("reteach tomorrow") | P1 |
| R13 | Pyodide in-browser Python runner | Stretch |

## Usability and content requirements (from the plan)

- A teacher or admin can create a class and import a roster in under 10 minutes
  (shown with a visible timer in the demo).
- A student can follow a module alone, on a phone or a school Chromebook.
- P0 worksheet question types: multiple choice, short answer, fill in the blank,
  ordering, reflection (unscored). Code cells are P1.
- Video is an unlisted YouTube embed in privacy-enhanced mode. Completion is the
  check question, not a play-through. Fallback if YouTube is blocked: link plus transcript.
- Learning gain is also exportable as CSV.

## Hard constraints (from the brief)

- Role-based auth, no shared passwords, least privilege per role.
- Minors: collect only name, school and class.
- Anything outbound is drafted by the system and sent by a human.
- Lighthouse accessibility 95 or better; fully keyboard-navigable.
- Read API documented well enough that CIC's dashboard owner can wire it up alone.
- Cost: $0 a month, no credit card on any account (stricter than the brief's
  $20/month plus $250 one-time setup).
- Out of scope: Problem 2 (donors), the parked alumni platform, the website revamp.

## Context from the brief

- Students are 14 to 18, on Chromebooks in class and phones elsewhere. Instructors
  are mostly ASU students and rotate every semester, so the platform must work
  without training. A partner-school teacher with no CS background runs a module by
  sharing a link. The mental model is code.org (a link the student follows), not a
  generic LMS.
- CIC's curriculum today is slides, docs and printed worksheets. A module can be
  built from video **or slides**, plus a check, a worksheet or exercise, and an exit question.
- CIC's summer camps use locked-down lab machines with **no student accounts**.
  They chose CodeHS to avoid accounts; Trinket, Replit, Colab and GitHub all need
  one. So a no-login path is a real requirement, not a nicety.
- A K12 teacher or district administrator outside CIC can log in and review the
  curriculum (the reviewer role).
- Prior art named in the brief: OHack's NMTSA LMS (lms.ohack.dev) has the same
  role and progress shape for adult training; worth reading for schema and roles.
- The brief suggests Postgres/Supabase and borrowing auth and video hosting, and
  rejects Canvas (too heavy) and Google Classroom (no custom authoring or CS auto-grading).

## Read API: what the brief says, and what we propose

From the brief:
- The consumer is **CIC's existing org dashboard**, which should show program
  health "without extra logins". It pulls cohort completion and learning gain (the
  brief also says "progress and assessment data"), already aggregated, with a key.
- The brief allows "Authenticated Read API (or MCP)", so a REST API is acceptable.
- It must be documented so CIC's dashboard owner can wire it up without the team.
- Not specified: what the dashboard is built with, who owns it, how keys are issued
  or rotated, the endpoints, the response format.
- The brief's Problem 2 imagines a "funder packet that pulls outcomes from Problem 1
  through its API", so a second consumer is possible.

Our proposals (confirm with CIC and with Koen, lane A):
- Flat, table-like JSON rows with consistent columns, numbers as numbers and ISO
  dates; an optional CSV form of the same endpoints for tools that import CSV.
- A `/api/v1/` prefix and an "as of" timestamp in every response.
- Breakdowns by cohort, class and concept, plus `from`/`to` date filters (the brief's
  Problem 2 API is aggregated by period).
- The key goes in a header by default. Allow it in the URL only if CIC's tool
  requires it, and document the risk (URLs get logged).
- Keys issued by CIC admin in the console, shown once, revocable. Rate limiting;
  CORS only if the dashboard calls from a browser.
- MCP only as an optional extra.

## What the brief allows beyond P0

The brief asks each team to pick at least one P1 and one "beyond the normal scope" idea.
- **Our picks:** AI Socratic hints with logging (R11), concept mastery (R12),
  learning gain as the headline metric (already P0), and a Pyodide runner as a stretch (R13).
- The brief says a generic chatbot on a lesson page does not count: hints must be
  Socratic and never give the answer.
- **Not planned:** external teacher self-serve and an auto-graded code runner (P1);
  all P2 ideas (low-bandwidth mode, gradebook export, parent view, roster sync, a free
  no-login coding tool).
- The brief's judging note: there is no separate AI score; features count under
  Scope and Polish, and the project fails on UX if class setup takes over 10 minutes
  or a student cannot follow a module without the instructor.

## Judging requirements

Four equally weighted categories, 10 points each: **Scope, Documentation,
Polish, Security**, plus a separate Accessibility prize. Judges watch the pitch
video first, then read the repo and README.
Rubric: <https://www.ohack.dev/hackathon-judging-criteria>

## Deliverables lane E owns

Read API and API docs page, reviewer view, hints function, deploy, README, ADRs,
`SECURITY.md`, admin how-to with screenshots, pitch video (3 to 4 minutes,
recorded from the demo script; the submission limit is 4 minutes).

## Open questions for CIC (Slack #npo-coding-in-color)

- Can we get one real module (slides, worksheet, pre/post questions) to seed the demo?
- Do partner-school Chromebooks reach YouTube and public CDNs?
- What counts as "stuck"? Default is in [Architecture](architecture.md).
- Do students have school emails?
- Which concepts should learning gain be reported by?
- ~~Can we get the logo and palette files?~~ Answered: the link is in the brief
  (top of this file).

Not asked yet, from the brief review (what the dashboard is built with was asked in
Slack on Nov 14 and is still unanswered):
- Can the dashboard send an API key in a header (`Authorization: Bearer ...`) or only
  in a URL?
- JSON or CSV? Which totals and breakdowns (cohort, class, concept, period), and how
  often will it pull?
- Do the camps' locked-down machines keep browser storage between sessions? It decides
  whether guest progress survives.
- Where do the existing slides and worksheets live (Google Slides or Docs, PDF), so the
  player can embed them?

## Mentor guidance (Slack, Nov 14)

The team asked seven questions in #npo-coding-in-color and mentors answered. This is
**guidance, not CIC's decision**. The sample module, pre/post questions, late joiners,
sequencing and the dashboard tool were passed on to CIC; there is no CIC answer yet.

| Topic | Guidance | Where we stand |
|---|---|---|
| Student login | A class code plus name, with no email or password, is reasonable if students can securely resume progress and duplicate names are handled; confirm with CIC | The plan is stronger: a personal login code per student from the roster, and a join link where a late joiner picks their name. **Gap:** the roster check (`src/features/instructor/lib/roster.ts`) rejects duplicate names, but two real students can share one. The roster needs a way to tell them apart, such as a last initial |
| Sample module | CIC or the organizers should provide it | Still waiting |
| Pre and post questions | Written by instructors or curriculum owners; both should test the same learning objectives but need not be identical; make it configurable | Fits: items are paired by `pair_key` and concept, so identical or equivalent questions both work. Authoring should allow either |
| Late joiners | Instructor-chosen placement is enough for the MVP; an optional diagnostic quiz; the instructor has the final say | Plan: lands on the first incomplete activity, and the instructor can mark earlier modules skipped. Add an explicit "start at module X" control. A diagnostic quiz is not planned |
| Sequencing | Sequential by default; an instructor can unlock a later module for one student | Already the plan |
| AI hints | Wanted if Socratic; instructors should see which topics drew hints; share no unnecessary student information with the AI | Already the plan (concept-tagged `hint_events`, reteach list, no names sent) |
| Dashboard | A well-documented JSON REST API is a sensible default; CIC must confirm the tool | Our default; still unconfirmed |
| Analytics | Keep one consistent structure for interactions, attempts, completion and hint usage; rule-based "stuck" indicators, no ML for the MVP | Matches (`submissions`, `progress`, `assessment_results`, `hint_events`; rule-based stuck). A mentor offered a Slack huddle on the data model |
