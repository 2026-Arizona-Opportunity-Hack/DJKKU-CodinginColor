-- Catch-up plan: for a student who missed class, the steps they still have to do, in order, with an
-- estimate of the minutes each takes, and how far behind the class they are. Research on chronic absence
-- shows missed instruction compounds; the plan turns "I'm lost" into "about 25 minutes to catch up".
--
-- Minutes per activity are the median time students actually spent on it (progress.time_spent_s, from the
-- heartbeat), once at least 3 students have finished it; until then a default by kind. Only aggregates
-- leave these functions: no other student's data is ever returned to a student.

-- Internal: the steps left for one student in one class, in course order. Pre-test, activities, post-test.
create function public._catch_up_steps(p_student uuid, p_class uuid)
returns table (ord1 int, ord2 int, ord3 int, step_kind text, activity_id uuid, assessment_id uuid, title text, minutes int)
language sql stable security definer set search_path = '' as $$
  with f as (
    select * from public._module_flow(p_student, p_class) where opened
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
  where a.required and not a.completed
  union all
  select f.mod_pos, 1000000, 0, 'posttest', null::uuid, f.post_id, 'Post-test: ' || f.title, 5
  from f where f.post_id is not null and not f.post_taken;
$$;

-- Internal: how many required activities the middle student of the class has finished.
create function public._class_median_done(p_class uuid) returns numeric
language sql stable security definer set search_path = '' as $$
  select coalesce(percentile_cont(0.5) within group (order by p.completed_activities), 0)::numeric
  from public.v_class_progress p
  where p.class_id = p_class and p.joined;
$$;

-- Students: your own plan. Only for a class you are in.
create function public.get_catch_up(p_class_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_done int;
begin
  if v_uid is null or not public.is_member_of(p_class_id) then raise exception 'You are not in this class'; end if;
  select coalesce(max(p.completed_activities), 0) into v_done
  from public.v_class_progress p where p.class_id = p_class_id and p.student_id = v_uid;
  return (
    select jsonb_build_object(
      'steps_left', count(*),
      'minutes_left', coalesce(sum(s.minutes), 0),
      'behind_by', greatest(0, round(public._class_median_done(p_class_id)) - v_done)::int,
      'steps', coalesce((
        select jsonb_agg(jsonb_build_object('kind', x.step_kind, 'activity_id', x.activity_id, 'assessment_id', x.assessment_id,
                                            'title', x.title, 'minutes', x.minutes) order by x.ord1, x.ord2, x.ord3)
        from (select * from public._catch_up_steps(v_uid, p_class_id) order by ord1, ord2, ord3 limit 8) x
      ), '[]'::jsonb)
    )
    from public._catch_up_steps(v_uid, p_class_id) s
  );
end;
$$;

-- Instructors and admins: one row per signed-in student, for the live view and the dashboard.
create function public.get_class_catch_up(p_class_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_median numeric;
begin
  if not public.can_edit_class(p_class_id) then raise exception 'Not allowed to see this class'; end if;
  v_median := public._class_median_done(p_class_id);
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'student_id', cm.profile_id, 'display_name', cm.display_name,
      'steps_left', s.steps_left, 'minutes_left', s.minutes_left,
      'behind_by', greatest(0, round(v_median) - coalesce(p.completed_activities, 0))::int
    ) order by cm.display_name)
    from public.class_members cm
    left join public.v_class_progress p on p.class_id = cm.class_id and p.student_id = cm.profile_id
    cross join lateral (
      select count(*)::int as steps_left, coalesce(sum(x.minutes), 0)::int as minutes_left
      from public._catch_up_steps(cm.profile_id, cm.class_id) x
    ) s
    where cm.class_id = p_class_id and cm.member_role = 'student' and cm.profile_id is not null
  ), '[]'::jsonb);
end;
$$;

revoke all on function public._catch_up_steps(uuid, uuid), public._class_median_done(uuid),
  public.get_catch_up(uuid), public.get_class_catch_up(uuid) from public, anon, authenticated;
grant execute on function public.get_catch_up(uuid), public.get_class_catch_up(uuid) to authenticated;
