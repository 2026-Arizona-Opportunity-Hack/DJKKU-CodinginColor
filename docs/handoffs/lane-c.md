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

## 2026-11-14 update: lane A is now built (supersedes the asks above)

The old proposal file and PGlite test are gone; lane A's schema is in `supabase/migrations/`
and `supabase/tests/db.test.ts` runs against a real local Supabase. Everything asked of Koen
above (helpers, key split, publish and version functions, full learning gain view) is done.

- **Studio (lane C) calls** `save_module_draft`, `submit_module`, `get_activity_keys`,
  `get_assessment_keys`, `upsert_concept`. Payload in `docs/contracts/database-api.md`.
  Admin console calls `publish_module`, `return_module_to_draft`.
- **Lane B (player):** every RPC name in `api.supabase.ts` exists with the shape in
  `types.ts`, except these differences to adapt: `claim_login_code` and `list_join_roster`
  work as proposed; `complete_activity` is gone (videos and readings send `{viewed: true}` to
  `submit_answer`); `submit_answer` and `submit_assessment` take an optional `p_class_id`;
  `next_activity` returns null while a pre-test or post-test is the next step (check the
  outline's `pretest` and `posttest` status); guests can only view, they cannot submit.
- **Lane D:** `import_roster` replaces one-by-one code creation; `create_class`,
  `create_join_code`, `reset_login_code`, `assign_module` and the views `v_class_progress`,
  `v_not_started`, `v_stuck`, `v_concept_mastery`, `v_reteach`, `v_learning_gain` are ready.
- **Lane E:** `validate_api_key` (service_role), `api_class_gain`, `api_class_progress`,
  and write access to `hint_events` and `hint_cache` as service_role.

