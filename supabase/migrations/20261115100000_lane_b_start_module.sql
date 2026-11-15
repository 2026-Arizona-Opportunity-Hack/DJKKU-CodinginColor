-- Late joiners: an instructor (or CIC admin) chooses which module a student starts at.
--
-- Before this, every student started at module 1's pre-test, wherever the class was, because
-- unlocking depends only on the student's own work. The plan (docs/design/system-design.md,
-- "Late joiner") and the mentors' answer both asked for an explicit "start at module X".
--
-- How it works: choosing module N records the modules before N as SKIPPED for that roster
-- seat. A skipped module counts as done for unlocking, its activities and tests show the
-- status 'skipped' (still open to review, never picked as "Start here"), and progress views
-- stop counting it as missing work. Learning gain is unaffected: a skipped module has no
-- pre/post results, and gain only pairs results that exist.
--
-- Keyed on the roster seat (class_members.id), not the student's account, so placement can be
-- set right after a roster import, before the student has ever signed in.
-- Function signatures are unchanged; bodies are copies of 20261114151000 / 20261114152000 /
-- 20261114154000 with the skip rule added (marked "skip:").

-- ---------- table ----------

create table public.module_skips (
  member_id uuid not null references public.class_members (id) on delete cascade,
  class_id uuid not null references public.classes (id) on delete cascade,
  module_id uuid not null references public.modules (id) on delete cascade,
  skipped_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (member_id, module_id)
);
create index module_skips_class_idx on public.module_skips (class_id);

alter table public.module_skips enable row level security;

-- Read: the student's own seat, the class's instructors, admins. Writes only via set_start_module.
create policy module_skips_read on public.module_skips for select to authenticated
using (
  public.can_edit_class(class_id)
  or exists (select 1 from public.class_members m where m.id = member_id and m.profile_id = auth.uid())
);

revoke all on public.module_skips from public, anon, authenticated;
grant select on public.module_skips to authenticated;

-- ---------- helper ----------

-- Is this module skipped for this student in this class? Internal (security definer helpers below call it).
create function public._is_skipped(p_student uuid, p_class uuid, p_module uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.module_skips s
    join public.class_members m on m.id = s.member_id
    where m.class_id = p_class and m.profile_id = p_student and s.module_id = p_module
  );
$$;
revoke all on function public._is_skipped(uuid, uuid, uuid) from public, anon, authenticated;

-- ---------- the instructor's action ----------

-- Start these roster seats at p_module_id (every earlier module in the class is skipped).
-- p_module_id null = start from the beginning (clears any skips). All seats must be students
-- of one class the caller can manage. Replaces any earlier choice for those seats.
create function public.set_start_module(p_member_ids uuid[], p_module_id uuid default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_ids uuid[];
  v_class uuid;
  v_classes int;
  v_found int;
  v_pos int;
  v_skipped int := 0;
begin
  select array_agg(distinct x) into v_ids from unnest(p_member_ids) x where x is not null;
  if v_ids is null or cardinality(v_ids) > 300 then
    raise exception 'Choose between 1 and 300 students';
  end if;

  select min(m.class_id::text)::uuid, count(distinct m.class_id), count(*)
  into v_class, v_classes, v_found
  from public.class_members m where m.id = any (v_ids) and m.member_role = 'student';
  if v_found <> cardinality(v_ids) or v_classes <> 1 then
    raise exception 'Students not found in one class';
  end if;
  if not public.can_edit_class(v_class) then raise exception 'Not allowed to manage this class'; end if;

  if p_module_id is not null then
    select cm.position into v_pos from public.class_modules cm
    where cm.class_id = v_class and cm.module_id = p_module_id;
    if v_pos is null then raise exception 'That module is not assigned to this class'; end if;
  end if;

  delete from public.module_skips s where s.member_id = any (v_ids);

  if v_pos is not null then
    insert into public.module_skips (member_id, class_id, module_id, skipped_by)
    select m, v_class, cm.module_id, auth.uid()
    from unnest(v_ids) m cross join public.class_modules cm
    where cm.class_id = v_class and cm.position < v_pos;
    select count(*)::int into v_skipped from public.class_modules cm where cm.class_id = v_class and cm.position < v_pos;
  end if;

  return jsonb_build_object('students', cardinality(v_ids), 'start_module_id', p_module_id, 'skipped_modules', v_skipped);
end;
$$;
revoke all on function public.set_start_module(uuid[], uuid) from public, anon, authenticated;
grant execute on function public.set_start_module(uuid[], uuid) to authenticated;

-- ---------- unlock rules, with the skip rule ----------

create or replace function public._module_flow(p_student uuid, p_class uuid)
returns table (
  module_id uuid, mod_pos int, title text,
  pre_id uuid, pre_taken boolean, post_id uuid, post_taken boolean,
  req_total int, req_done int, opened boolean, unlocked boolean, done boolean
)
language sql stable security definer set search_path = '' as $$
  with base as (
    select cm.module_id, cm.position as mod_pos, m.title, (cm.opens_at <= now()) as opened,
      pre.id as pre_id, post.id as post_id,
      exists (select 1 from public.assessment_results r
              where r.assessment_id = pre.id and r.student_id = p_student and r.class_id = p_class) as pre_taken,
      exists (select 1 from public.assessment_results r
              where r.assessment_id = post.id and r.student_id = p_student and r.class_id = p_class) as post_taken,
      (select count(*)::int from public.lessons l join public.activities a on a.lesson_id = l.id
        where l.module_id = cm.module_id and a.required) as req_total,
      (select count(*)::int from public.lessons l join public.activities a on a.lesson_id = l.id
         join public.progress pr on pr.activity_id = a.id and pr.student_id = p_student
                                and pr.class_id = p_class and pr.status = 'completed'
        where l.module_id = cm.module_id and a.required) as req_done,
      public._is_skipped(p_student, p_class, cm.module_id) as skipped            -- skip:
    from public.class_modules cm
    join public.modules m on m.id = cm.module_id
    left join public.assessments pre on pre.module_id = cm.module_id and pre.kind = 'pre'
    left join public.assessments post on post.module_id = cm.module_id and post.kind = 'post'
    where cm.class_id = p_class
  ), flagged as (
    -- skip: a skipped module counts as done, so the next one unlocks.
    select b.*, (b.skipped or (b.req_done >= b.req_total and (b.post_id is null or b.post_taken))) as done from base b
  )
  select f.module_id, f.mod_pos, f.title, f.pre_id, f.pre_taken, f.post_id, f.post_taken,
    f.req_total, f.req_done, f.opened,
    -- In the CIC Open class (independent learners) modules are not chained: they pick the order.
    f.opened and (
      exists (select 1 from public.classes c where c.id = p_class and c.kind = 'open')
      or coalesce(bool_and(f.done) over (order by f.mod_pos rows between unbounded preceding and 1 preceding), true)
    ),
    f.done
  from flagged f;
$$;

create or replace function public._activity_flow(p_student uuid, p_class uuid)
returns table (
  activity_id uuid, lesson_id uuid, module_id uuid, mod_pos int, les_pos int, act_pos int,
  kind text, title text, required boolean, completed boolean, status text, locked_reason text
)
language sql stable security definer set search_path = '' as $$
  with acts as (
    select f.module_id, f.mod_pos, f.unlocked, f.pre_id, f.pre_taken,
      public._is_skipped(p_student, p_class, f.module_id) as skipped,            -- skip:
      l.id as lesson_id, l.position as les_pos, a.id as activity_id, a.position as act_pos,
      a.kind, a.title, a.required,
      coalesce(pr.status = 'completed', false) as completed
    from public._module_flow(p_student, p_class) f
    join public.lessons l on l.module_id = f.module_id
    join public.activities a on a.lesson_id = l.id
    left join public.progress pr on pr.student_id = p_student and pr.class_id = p_class and pr.activity_id = a.id
  ), ordered as (
    select a.*,
      -- skip: skipped work never blocks what comes after it.
      coalesce(bool_and(a.completed or not a.required or a.skipped) over (
        order by a.mod_pos, a.les_pos, a.act_pos rows between unbounded preceding and 1 preceding), true) as prior_ok
    from acts a
  )
  select o.activity_id, o.lesson_id, o.module_id, o.mod_pos, o.les_pos, o.act_pos, o.kind, o.title, o.required, o.completed,
    case when o.completed then 'done'
         when o.skipped then 'skipped'                                           -- skip:
         when o.unlocked and (o.pre_id is null or o.pre_taken) and o.prior_ok then 'available'
         else 'locked' end,
    case when o.completed or o.skipped then null
         when not o.unlocked then 'Finish the earlier module first'
         when o.pre_id is not null and not o.pre_taken then 'Take the pre-test first'
         when not o.prior_ok then 'Finish the earlier activities first'
         else null end
  from ordered o;
$$;

create or replace function public.get_class_outline(p_class_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_result jsonb;
begin
  if v_uid is null or not public.is_member_of(p_class_id) then
    raise exception 'You are not in this class';
  end if;
  with mf as materialized (
         select f.*, public._is_skipped(v_uid, p_class_id, f.module_id) as skipped   -- skip:
         from public._module_flow(v_uid, p_class_id) f),
       af as materialized (select * from public._activity_flow(v_uid, p_class_id))
  select jsonb_build_object('modules', coalesce(jsonb_agg(jsonb_build_object(
    'module_id', f.module_id, 'title', f.title, 'position', f.mod_pos,
    'pretest', case when f.pre_id is null then null else jsonb_build_object('assessment_id', f.pre_id,
        'status', case when f.pre_taken then 'done' when f.skipped then 'skipped'
                       when f.unlocked then 'available' else 'locked' end) end,
    'posttest', case when f.post_id is null then null else jsonb_build_object('assessment_id', f.post_id,
        'status', case when f.post_taken then 'done' when f.skipped then 'skipped'
                       when f.unlocked and f.req_done >= f.req_total then 'available' else 'locked' end) end,
    'lessons', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'lesson_id', l.id, 'title', l.title, 'position', l.position,
        'activities', (
          select coalesce(jsonb_agg(jsonb_build_object(
            'activity_id', a.activity_id, 'title', a.title, 'kind', a.kind, 'position', a.act_pos,
            'required', a.required, 'status', a.status, 'locked_reason', a.locked_reason
          ) order by a.act_pos), '[]'::jsonb)
          from af a where a.lesson_id = l.id)
      ) order by l.position), '[]'::jsonb)
      from public.lessons l where l.module_id = f.module_id)
  ) order by f.mod_pos), '[]'::jsonb))
  into v_result
  from mf f;
  return v_result;
end;
$$;

-- ---------- views: skipped work is not "missing" work ----------

create or replace view public.v_class_progress with (security_invoker = true) as
select cm.class_id, cm.profile_id as student_id, cm.display_name,
  req.required_activities,
  coalesce(done.completed_activities, 0) as completed_activities,
  case when req.required_activities = 0 then 0
       else round(100.0 * coalesce(done.completed_activities, 0) / req.required_activities, 2) end as completion_pct,
  done.last_active_at,
  cm.profile_id is not null as joined
from public.class_members cm
cross join lateral (
  select count(*)::int as required_activities
  from public.class_modules m join public.lessons l on l.module_id = m.module_id join public.activities a on a.lesson_id = l.id
  where m.class_id = cm.class_id and m.opens_at <= now() and a.required
    and not exists (select 1 from public.module_skips s where s.member_id = cm.id and s.module_id = m.module_id)) req  -- skip:
left join lateral (
  select count(*) filter (where pr.status = 'completed' and a.required
                          and not exists (select 1 from public.lessons l2 join public.module_skips s
                                            on s.module_id = l2.module_id and s.member_id = cm.id
                                          where l2.id = a.lesson_id))::int as completed_activities,  -- skip:
         max(pr.updated_at) as last_active_at
  from public.progress pr join public.activities a on a.id = pr.activity_id
  where pr.student_id = cm.profile_id and pr.class_id = cm.class_id) done on true
where cm.member_role = 'student';

create or replace view public.v_class_progress_all as
select cm.class_id, cm.profile_id as student_id,
  case when req.n = 0 then 0 else round(100.0 * coalesce(done.n, 0) / req.n, 2) end as completion_pct
from public.class_members cm
cross join lateral (
  select count(*)::int as n from public.class_modules m join public.lessons l on l.module_id = m.module_id
  join public.activities a on a.lesson_id = l.id where m.class_id = cm.class_id and m.opens_at <= now() and a.required
    and not exists (select 1 from public.module_skips s where s.member_id = cm.id and s.module_id = m.module_id)) req  -- skip:
left join lateral (
  select count(*)::int as n from public.progress pr join public.activities a on a.id = pr.activity_id
  where pr.student_id = cm.profile_id and pr.class_id = cm.class_id and pr.status = 'completed' and a.required
    and not exists (select 1 from public.lessons l2 join public.module_skips s
                      on s.module_id = l2.module_id and s.member_id = cm.id where l2.id = a.lesson_id)) done on true  -- skip:
where cm.member_role = 'student' and cm.profile_id is not null;

create or replace view public.v_stuck with (security_invoker = true) as
with active as (
  select pr.class_id, pr.student_id, pr.activity_id, pr.time_spent_s / 60.0 as minutes,
    (select count(*) from public.submissions s where s.student_id = pr.student_id and s.class_id = pr.class_id
       and s.activity_id = pr.activity_id and s.is_correct = false)::int as wrong,
    (select count(*) from public.hint_events h where h.student_id = pr.student_id and h.class_id = pr.class_id
       and h.activity_id = pr.activity_id)::int as hints
  from public.progress pr where pr.status = 'in_progress'
), flagged as (
  select a.*, array_remove(array[case when a.wrong >= 3 then 'wrong_attempts' end,
                                  case when a.minutes > 10 then 'long_time' end], null) as reasons
  from active a
)
select f.class_id, f.student_id, f.activity_id, f.wrong as wrong_attempts, round(f.minutes, 1) as minutes_on_activity,
  f.hints as hints_used, 0 as days_inactive, f.reasons
from flagged f where cardinality(f.reasons) > 0
union all
select cm.class_id, cm.profile_id, null::uuid, 0, 0::numeric, 0,
  public.school_days_between(last.at, now()), array['inactive']
from public.class_members cm
cross join lateral (select max(pr.updated_at) as at from public.progress pr where pr.student_id = cm.profile_id and pr.class_id = cm.class_id) last
where cm.member_role = 'student' and cm.profile_id is not null and last.at is not null
  and public.school_days_between(last.at, now()) >= 3
  and exists (
    select 1 from public.class_modules m join public.lessons l on l.module_id = m.module_id join public.activities a on a.lesson_id = l.id
    where m.class_id = cm.class_id and a.required
      and not exists (select 1 from public.module_skips s where s.member_id = cm.id and s.module_id = m.module_id)  -- skip:
      and not exists (select 1 from public.progress p2 where p2.student_id = cm.profile_id and p2.class_id = cm.class_id
                      and p2.activity_id = a.id and p2.status = 'completed'));
