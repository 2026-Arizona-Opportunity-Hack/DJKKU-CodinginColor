# Lane C handoffs

Running list of what lane C needs from other lanes and what it gives them.
Newest entries at the bottom. Do not delete old entries; add a correction.

## To lane A (Koen): views must match `shared/authoring/gain.ts`

Source of truth for the math is [ADR 0020](../adr/0020-learning-gain-definition.md)
and the tested code. Summary for `v_learning_gain` and `v_concept_mastery`:

- Scores are percentages (0 to 100), computed as earned points / possible points.
- Join pre and post items on `pair_key`; drop items with no twin. Enforce
  `unique (assessment_id, pair_key)`; if a duplicate ever exists, exclude that key
  from both sides.
- Per student: `gain = post - pre`; `normalized = (post - pre) / (100 - pre)`,
  null when `pre = 100`.
- Missing pre or post: return NULL gain columns and `status = 'incomplete'`.
  Never coalesce to 0.
- Per class and per concept: average pre and post over students who have both;
  `normalized = (mean_post - mean_pre) / (100 - mean_pre)`, null when mean_pre = 100.
  Also return `complete_count` and `incomplete_count`.
- The read API (lane E) must suppress groups under 5 students.

## To lane E (Krishna): CSV helper

`shared/authoring/csv.ts` exports `toCsv` with spreadsheet formula protection.
Reuse it for any export that includes student names.

## From other lanes (what lane C needs)

- App scaffold (Vite, Tailwind, shadcn, router) on `main`. Not there yet.
- Lane A schema: `modules`, `lessons`, `activities`, `activity_keys`,
  `assessments`, `assessment_items`, `concepts`. Until it lands, lane C will
  ship `supabase/migrations/lane_c_proposal.sql` as a proposal.
- Staff login and role plumbing so the studio can gate on instructor or admin.

## To lane A (Koen): please review `supabase/migrations/lane_c_proposal.sql`

Added 2026-11-14. Untested proposal, free to rewrite. Things I need from you:

- `is_staff()` (instructor or admin) and `is_admin()`; my policies assume them.
- Split `assessment_items` into content and key tables like `activities` and
  `activity_keys`. I left it staff-only so nothing leaks meanwhile.
- A `publish_module(id)` function (admin only) that flips submitted to published,
  and a `new_module_version(id)` that copies a published module into a draft
  version + 1. I have not written either.
- Make `v_learning_gain` a full outer join and add class and concept rollups
  per ADR 0020. Mine is per student only.
- Grading (`submit_answer`) should read `activity_keys.key`. Key shapes are in
  `shared/authoring/schemas.ts` (`questionKey`): mcq `correctChoiceId`,
  short answer `accepted[]`, fill blank `blanks[][]`, ordering `correctOrder[]`;
  `caseSensitive` flags on text types.

## To lane A (Koen): RLS tests you can reuse

`supabase/tests/lane_c_rls.test.ts` runs per-role tests on PGlite (no Docker).
It stubs `is_admin()`, `is_staff()` and `auth.uid()` from two session settings.
When your migrations land, load them instead of the stubs and keep the tests as
the regression suite; add your own roles (mentor, student claim) the same way.

