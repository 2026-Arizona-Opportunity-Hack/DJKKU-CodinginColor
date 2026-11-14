# Requirements

What the platform must do, for whom, and the limits it must stay inside. Source:
the CIC problem brief ([CIC Problem 1](https://www.ohack.dev/project/d09466fadf1b11f18e63deadc507a848))
and the team design plan (Nov 14, 2026 revision). If this file and the brief
disagree, the brief wins; open an issue and fix this file.

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
| R8 | Key-authenticated read API returning aggregated data only |

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
- Cost: $0 a month, no credit card on any account (stricter than the brief's $20/month).
- Out of scope: Problem 2 (donors), the parked alumni platform, the website revamp.

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
- Can we get the logo and palette files?
