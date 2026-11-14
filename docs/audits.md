# Audit reports

Evidence that we checked our own work against the rubric: security,
accessibility, and the things CIC depends on. Judges score Security and Polish;
a dated report with real output is stronger than a claim in the README.

## Rules

- Add each audit run as a dated section under **Reports** below (or, if it gets
  long, as `docs/audits/YYYY-MM-DD-<area>.md` linked from the index).
- Record what was run, the actual result (real output or numbers), what failed,
  and the issue or PR that fixed it.
- Failures stay in the report. When something is fixed, add a new run; do not
  delete the failing one.
- Never paste secrets, real student data or API keys.

## Report template

```markdown
### YYYY-MM-DD <area>
Commit: <sha> · Run by: <name> · Command/tool: <how it was run>

| Check | Result | Notes |
|---|---|---|

Findings:
- [severity] what, where, fix (issue #/PR #)
```

## Planned audits

| Area | What to check | Rubric category | Status |
|---|---|---|---|
| Secrets | gitleaks in CI; `.env` never tracked; guard hook active | Security | Not run |
| RLS per role | One script per role (student, independent, mentor, instructor, admin, reviewer) proving each reads only what the permission table allows and the reviewer cannot write | Security | Not run |
| Answer-key isolation | No student or reviewer query can read `activity_keys` | Security | Not run |
| Read API | No key → 401; revoked key → 401; groups under 5 suppressed; no per-student rows | Security | Not run |
| Input validation | zod on every form and endpoint; malformed CSV rows rejected with row-level errors | Security | Not run |
| Accessibility | Lighthouse accessibility ≥ 95 on every page type; full keyboard walkthrough | Polish / Accessibility prize | Not run |
| Error and empty states | Loading, empty, error, slow network and invalid input on each screen | Polish | Not run |
| Mentor safeguards | Unapproved mentor sees no student; approved mentor sees only assigned mentees; mentor notes are logged and visible to CIC admin | Security | Not run |
| Self-registration | IP rate limit holds; CIC Open students cannot see anyone else; guest progress import validates its payload | Security | Not run |
| Code comments | Every RLS policy and grading function has an explanatory comment | Documentation | Not run |
| Docs run-through | A non-author follows the README from a clean clone | Documentation | Not run |
| Free-tier headroom | Re-check vendor limits quoted in [tradeoffs](tradeoffs.md) | Scope | Not run |

## Reports

### 2026-11-14 Lane C learning gain math and CSV export
Commit: see PR `lane-c/gain-math` · Run by: Umang (with Claude Code) · Command: `npm test` and `npx tsc --noEmit` in `lane-c-logic/`

| Check | Result | Notes |
|---|---|---|
| Unit tests (Vitest) | 20 passed, 0 failed | pre 100, negative gain, all-correct, missing scores, out-of-range, unpaired items, point weighting, group summary |
| Type check (tsc strict) | Pass | |
| CSV formula injection | Pass | cells starting with = + - @ are prefixed with a quote; real negative numbers untouched |

Findings:
- None open. Not yet covered: SQL views matching this logic (needs lane A schema).

### 2026-11-14 Lane C gain math after scaffold merge and review fix
Commit: see PR #3 · Run by: Umang (with Claude Code) · Command: root `npm run lint && npm run typecheck && npm test`

| Check | Result | Notes |
|---|---|---|
| Lint (oxlint) | Pass | |
| Type check (`tsc -b`, TS 7, strict, `erasableSyntaxOnly`) | Pass | |
| Tests (Vitest) | 34 passed across 3 files | 22 lane C gain/CSV, rest from lane D and the feature registry |
| Duplicate pair_key (Jad's review) | Fixed, 2 new tests | key excluded from both tests and reported |

Findings:
- [fixed, medium] Duplicate `pairKey` in one test counted twice on that side and once on the other, skewing gain. Fixed in PR #3.
