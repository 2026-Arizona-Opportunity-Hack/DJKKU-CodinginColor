# Lane C handoffs

Running list of what lane C needs from other lanes and what it gives them.
Newest entries at the bottom. Do not delete old entries; add a correction.

## To lane A (Koen): views must match `lane-c-logic/src/gain.ts`

Source of truth for the math is [ADR 0019](../adr/0019-learning-gain-definition.md)
and the tested code. Summary for `v_learning_gain` and `v_concept_mastery`:

- Scores are percentages (0 to 100), computed as earned points / possible points.
- Join pre and post items on `pair_key`; drop items with no twin.
- Per student: `gain = post - pre`; `normalized = (post - pre) / (100 - pre)`,
  null when `pre = 100`.
- Missing pre or post: return NULL gain columns and `status = 'incomplete'`.
  Never coalesce to 0.
- Per class and per concept: average pre and post over students who have both;
  `normalized = (mean_post - mean_pre) / (100 - mean_pre)`, null when mean_pre = 100.
  Also return `complete_count` and `incomplete_count`.
- The read API (lane E) must suppress groups under 5 students.

## To lane E (Krishna): CSV helper

`lane-c-logic/src/csv.ts` exports `toCsv` with spreadsheet formula protection.
Reuse it for any export that includes student names.

## From other lanes (what lane C needs)

- App scaffold (Vite, Tailwind, shadcn, router) on `main`. Not there yet.
- Lane A schema: `modules`, `lessons`, `activities`, `activity_keys`,
  `assessments`, `assessment_items`, `concepts`. Until it lands, lane C will
  ship `supabase/migrations/lane_c_proposal.sql` as a proposal.
- Staff login and role plumbing so the studio can gate on instructor or admin.
