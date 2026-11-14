# 0020. Learning gain definition

Status: Accepted
Date: 2026-11-14

## Context
CIC's brief defines learning gain as post minus pre. Funders and teachers also
want a fairer number for students who started high, and the screens must never
show a fake zero when a test is missing. Lane A needs an exact spec for
`v_learning_gain` and `v_concept_mastery`.

## Decision
- Headline gain = post minus pre, in points.
- Second column: normalized gain = (post - pre) / (100 - pre). Null when pre is 100.
- A student missing either score is "incomplete" and left out of class numbers;
  the screen shows how many were left out.
- Class and concept normalized gain uses the class mean pre and post (Hake's
  method), not the mean of per-student ratios.
- Pre and post items match by `pair_key`; items with no twin are ignored for
  gain and flagged in the test builder.
- A pair_key must be unique per test. A duplicate makes the match ambiguous, so
  it is excluded from all scores and reported (raised in review by Jad, PR #3).
- The reference implementation is `shared/authoring/gain.ts` with tests. The SQL
  views must match it.

## Alternatives considered
- Treat a missing score as 0: invents big fake gains or losses. Rejected.
- Average of per-student normalized gains: one student near 100 can swing the
  class number wildly. Rejected.
- Score by item count instead of points: lets a 1-point item weigh the same as
  a 3-point item. Rejected.

## Consequences
Numbers are honest but the class view can show fewer students than enrolled.
The SQL views must reproduce this logic; a mismatch is a bug in the SQL.
