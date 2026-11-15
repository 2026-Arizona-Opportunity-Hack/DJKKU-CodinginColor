-- The catch-up plan (20261115110000_lane_a_catch_up.sql) and late-joiner placement
-- (20261115100000_lane_b_start_module.sql) landed in parallel. The plan listed every untaken
-- pre-test, unfinished activity and untaken post-test in opened modules, so a student whom the
-- instructor started at module 3 was told to catch up on modules 1 and 2: work they were told
-- to skip. Skipped modules are now left out of the steps (and so out of the minutes estimate).
-- Body otherwise identical to 20261115110000 (marked "skip:"); signature and grants unchanged.

create or replace function public._catch_up_steps(p_student uuid, p_class uuid)
returns table (ord1 int, ord2 int, ord3 int, step_kind text, activity_id uuid, assessment_id uuid, title text, minutes int)
language sql stable security definer set search_path = '' as $$
  with f as (
    select * from public._module_flow(p_student, p_class)
    where opened and not public._is_skipped(p_student, p_class, module_id)            -- skip:
  ), mins as (
    select pr.activity_id, percentile_cont(0.5) within group (order by pr.time_spent_s) as med, count(*) as n
    from public.progress pr
    where pr.status = 'completed' and pr.time_spent_s > 0
    group by pr.activity_id
  )
  select f.mod_pos, -1, 0, 'pretest', null::uuid, f.pre_id, 'Pre-test: ' || f.title, 5
  from f where f.pre_id is not null and not f.pre_taken
  union all
  select a.mod_pos, a.les_pos, a.act_pos, a.kind, a.activity_id, null::uuid, a.title,
    greatest(1, ceil(coalesce(
      case when m.n >= 3 then m.med end,
      case a.kind when 'video' then 300 when 'reading' then 240 when 'worksheet' then 600 else 180 end
    ) / 60.0))::int
  from public._activity_flow(p_student, p_class) a
  join f on f.module_id = a.module_id
  left join mins m on m.activity_id = a.activity_id
  where a.required and not a.completed and a.status <> 'skipped'                      -- skip:
  union all
  select f.mod_pos, 1000000, 0, 'posttest', null::uuid, f.post_id, 'Post-test: ' || f.title, 5
  from f where f.post_id is not null and not f.post_taken;
$$;
