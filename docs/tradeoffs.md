# Tradeoffs

What our choices cost us, so CIC and future maintainers know the limits before
they hit them. Rows trace back to [decisions](decisions.md). Limits marked
*unverified* come from the team plan and must be re-checked on the vendor's
pricing page before the README quotes them.

## Accepted tradeoffs

| Area | We chose | We gave up | Mitigation |
|---|---|---|---|
| Cost | $0/month, no card anywhere | Supabase Pro features, e.g. no idle pause (Pro is $25/month, *unverified*) | Daily keepalive ping; README names Pro as the first paid step |
| Capacity | Supabase Free (500 MB database, 2 projects) | Headroom for a large rollout | Plan's own estimate: 1,000 students × 200 activities × ~300 bytes ≈ 60 MB; revisit if CIC grows |
| Backups | Nightly encrypted dump from GitHub Actions | Managed free backups (Supabase free has none, *unverified*) | Encryption key held only by CIC; restore steps in README |
| Hosting | Cloudflare Pages Free | 500 builds/month, 1 build at a time, 100,000 function requests/day (*unverified*) | Plenty for a class-sized pilot; cache AI hints |
| Frontend | Vite SPA | Server rendering and SEO | Logged-in app, so neither matters |
| Auth for minors | Login code + anonymous session | Email recovery of lost accounts | Mentor or CIC admin can reset a code |
| Grading | In Postgres functions | Easy unit testing with app tooling; logic is SQL | One test script per role; comment every function |
| Security model | RLS on every table | Simplicity; policy mistakes are easy to make | Policies commented; per-role test scripts; submissions, progress and keys tables first |
| AI hints | Free Gemini tier, cached per wrong answer | Reliability and privacy guarantees of a paid tier; limits may change; free tier may use requests to improve products | Send no names or school; instructor-written hints as fallback; feature flag with instructor off switch |
| Video | Unlisted YouTube | Control over availability; blocked on some school networks | Link + transcript fallback |
| Read API | Aggregates only, groups under 5 suppressed | Per-student export for CIC's dashboard | Meets the minors' privacy limit; revisit with CIC |
| Read API style | REST/JSON, optional CSV | MCP, which the brief also allows ("Read API (or MCP)") | A REST API works with more dashboard tools; MCP only as an optional extra |
| Reviewer login | Google sign-in only | Reviewers without Google accounts | Rare in districts; revisit if CIC objects |
| Independent students | Progress kept on-device until registering | Cross-device continuity for guests | Merged via `import_guest_progress` at sign-up. Camps' locked-down machines may clear browser storage between sessions (unconfirmed), which would lose guest progress; ask CIC |
| Repo shape | One npm package: frontend, `functions/` and `shared/` together; features as folders in one registry | Separate deploys, versioning and dependency sets per part | One install, one deploy, shared types. "Features never import each other" is a convention, not enforced by tooling |
| Scope | AI and concept mastery only after P0 works | Earlier AI demo | Hints must never block the core flow |
| Learning gain | Class numbers use only students with both pre and post | Showing every enrolled student in the class average | Screen shows "N of M students" so the gap is visible ([ADR 0020](adr/0020-learning-gain-definition.md)) |
| Lane C code layout | Pure logic in `shared/authoring/` (not `src/features/authoring/`) | Keeping all of lane C in one folder | `shared/` is the scaffold rule for code the browser and functions both use; gain math will be reused by the read API (ADR 0021) |
| Answer keys in authoring | Content and key are separate shapes the editor must handle | A simpler single question object | Strict schemas plus a payload leak test ([ADR 0022](adr/0022-keys-split-from-content.md)) |
| Module versions | Every version is its own row | Smallest database | Old versions stay for classes that use them ([ADR 0023](adr/0023-immutable-module-versions.md)) |
| Database writes | Every write is a function, not a table policy | Quick direct inserts from the UI | One audited path, one test per function ([ADR 0024](adr/0024-lane-a-database-design.md)) |
| Test takers | Pre and post tests are one shot | Letting a student retake | An instructor can reset a test; stops gaming the learning gain |
| Student sign-in | 64-bit random login code, no per-session lockout | A short code that is easy to type | Dashes and case are ignored; Supabase rate limits anonymous sign-ins per IP |
| Staff sign-in | Google only; email provider disabled | Staff without a Google account | Matches the plan (decision 17); avoids anyone claiming an invited address |

## Known risks

- A free Supabase project pauses after a week idle; a paused project at judging
  time is a failed demo. Warm it before judging.
- Spam self-registration; IP rate limit in the Pages Function.
- "Stuck" definition is our default, not CIC's.
- Chromebook access to YouTube and public CDNs (needed for Pyodide) is unconfirmed.

## Adding a row

Add it in the same PR as the decision it belongs to. State what we gave up, not
just what we gained.
