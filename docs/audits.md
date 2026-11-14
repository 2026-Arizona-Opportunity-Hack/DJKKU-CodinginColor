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

*None yet.*
