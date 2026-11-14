-- Lane A policies, views and grants.
-- Principle: clients READ through RLS policies and WRITE only through the RPC functions.
-- Tables with RLS on and no policy (activity_keys, assessment_keys, api_keys hashes,
-- hint_cache, staff_invites for non-admins) cannot be read by any client at all.
-- Every policy has a comment saying who it lets in and why.

-- ---------- read policies ----------

-- You see yourself; admins see everyone; an instructor sees the people in their classes;
-- a mentor sees their active mentees.
create policy profiles_read on public.profiles for select to authenticated
using (
  id = auth.uid() or public.is_admin() or public.is_mentor_of(id)
  or exists (
    select 1 from public.class_members target join public.class_members viewer on viewer.class_id = target.class_id
    where target.profile_id = profiles.id and viewer.profile_id = auth.uid() and viewer.member_role = 'instructor'
  )
);

-- A user may rename themselves. Role and can_author are NOT updatable (column grant below).
create policy profiles_update_self on public.profiles for update to authenticated
using (id = auth.uid()) with check (id = auth.uid());

-- Pending and accepted invites: CIC admin only.
create policy staff_invites_admin_read on public.staff_invites for select to authenticated
using (public.is_admin());

-- Schools: admins see all; an instructor sees the school of a class they teach.
create policy schools_read on public.schools for select to authenticated
using (public.is_admin() or exists (select 1 from public.classes c where c.school_id = schools.id and public.is_instructor_of(c.id)));
create policy schools_admin_insert on public.schools for insert to authenticated with check (public.is_admin());
create policy schools_admin_update on public.schools for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- Classes: members, their instructors, admins, and mentors of a member.
create policy classes_read on public.classes for select to authenticated
using (
  public.is_admin() or public.is_member_of(id) or public.is_instructor_of(id)
  or exists (select 1 from public.class_members cm where cm.class_id = classes.id and public.is_mentor_of(cm.profile_id))
);
-- Instructors rename their own classes; admins any. (New classes come from create_class.)
create policy classes_update on public.classes for update to authenticated
using (public.can_edit_class(id)) with check (public.can_edit_class(id));

-- Roster rows: your own, your class's if you teach it, an admin's, or a mentee's for a mentor.
-- A student never sees classmates. (Login codes are in member_login_codes, which has no policy.)
create policy class_members_read on public.class_members for select to authenticated
using (
  profile_id = auth.uid() or public.is_admin() or public.is_instructor_of(class_id)
  or (profile_id is not null and public.is_mentor_of(profile_id))
);

-- Concepts are public curriculum labels.
create policy concepts_read on public.concepts for select to anon, authenticated using (true);

-- Curriculum content follows can_read_module(): published for guests and non-students,
-- assigned modules for students, drafts only for their owner or an admin. Keys are never in these tables.
create policy modules_read on public.modules for select to anon, authenticated using (public.can_read_module(id));
create policy lessons_read on public.lessons for select to anon, authenticated using (public.can_read_module(module_id));
create policy activities_read on public.activities for select to anon, authenticated
using (exists (select 1 from public.lessons l where l.id = lesson_id and public.can_read_module(l.module_id)));
create policy assessments_read on public.assessments for select to anon, authenticated using (public.can_read_module(module_id));
create policy assessment_items_read on public.assessment_items for select to anon, authenticated
using (exists (select 1 from public.assessments a where a.id = assessment_id and public.can_read_module(a.module_id)));
-- activity_keys / assessment_keys: intentionally NO policy. Only security-definer functions read them.

-- Which modules a class has: members, instructors, admins.
create policy class_modules_read on public.class_modules for select to authenticated
using (public.is_admin() or public.is_member_of(class_id) or public.is_instructor_of(class_id));

-- Student work: the student, their class's instructor, an admin, or the student's mentor.
create policy submissions_read on public.submissions for select to authenticated
using (student_id = auth.uid() or public.is_admin() or public.is_instructor_of(class_id) or public.is_mentor_of(student_id));
create policy progress_read on public.progress for select to authenticated
using (student_id = auth.uid() or public.is_admin() or public.is_instructor_of(class_id) or public.is_mentor_of(student_id));
create policy assessment_results_read on public.assessment_results for select to authenticated
using (student_id = auth.uid() or public.is_admin() or public.is_instructor_of(class_id) or public.is_mentor_of(student_id));
create policy assessment_responses_read on public.assessment_responses for select to authenticated
using (student_id = auth.uid() or public.is_admin() or public.is_instructor_of(class_id) or public.is_mentor_of(student_id));
create policy hint_events_read on public.hint_events for select to authenticated
using (student_id = auth.uid() or public.is_admin() or public.is_instructor_of(class_id) or public.is_mentor_of(student_id));

-- Mentoring: a mentor sees their own assignments; admins see all. Writes go through assign_mentor.
create policy mentor_assignments_read on public.mentor_assignments for select to authenticated
using (mentor_id = auth.uid() or public.is_admin());

-- Safeguarding log: mentors read and append their own notes about students they are assigned to;
-- admins can read everything. Nobody can edit or delete a note (no policy, no grant).
create policy mentor_notes_read on public.mentor_notes for select to authenticated
using (mentor_id = auth.uid() or public.is_admin());
create policy mentor_notes_insert on public.mentor_notes for insert to authenticated
with check (mentor_id = auth.uid() and public.is_mentor_of(student_id));

-- API key list for the admin console. The hashes are in api_key_secrets, which has no policy.
create policy api_keys_admin_read on public.api_keys for select to authenticated using (public.is_admin());

-- ---------- views ----------

-- Completion per student (and per unclaimed roster seat) across the class's open modules.
create view public.v_class_progress with (security_invoker = true) as
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
  where m.class_id = cm.class_id and m.opens_at <= now() and a.required) req
left join lateral (
  select count(*) filter (where pr.status = 'completed' and a.required)::int as completed_activities, max(pr.updated_at) as last_active_at
  from public.progress pr join public.activities a on a.id = pr.activity_id
  where pr.student_id = cm.profile_id and pr.class_id = cm.class_id) done on true
where cm.member_role = 'student';

-- Students who have joined but never opened anything (and seats nobody has claimed yet).
create view public.v_not_started with (security_invoker = true) as
select cm.class_id, cm.profile_id as student_id, cm.display_name, cm.profile_id is not null as joined
from public.class_members cm
where cm.member_role = 'student'
  and not exists (select 1 from public.progress pr where pr.student_id = cm.profile_id and pr.class_id = cm.class_id);

-- Plan defaults: stuck = 3 wrong attempts on one activity, OR more than 10 minutes on an
-- unfinished activity, OR no activity for 3 school days while work remains. Same signals
-- feed lane D's stuck.ts. Unconfirmed with CIC.
create view public.v_stuck with (security_invoker = true) as
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
      and not exists (select 1 from public.progress p2 where p2.student_id = cm.profile_id and p2.class_id = cm.class_id
                      and p2.activity_id = a.id and p2.status = 'completed'));

-- Concept mastery per student, from the per-question results saved with each submission.
create view public.v_concept_mastery with (security_invoker = true) as
select s.class_id, s.student_id, e.value ->> 'concept' as concept_id,
  count(*)::int as attempts,
  count(*) filter (where (e.value ->> 'correct')::boolean)::int as correct_attempts,
  round(100.0 * count(*) filter (where (e.value ->> 'correct')::boolean) / count(*), 2) as mastery_pct,
  max(s.submitted_at) as last_attempt_at
from public.submissions s cross join lateral jsonb_each(s.results) e
where (e.value ->> 'concept') is not null
group by s.class_id, s.student_id, e.value ->> 'concept';

-- "Reteach tomorrow": per class and concept, ranked by how often students get it wrong.
create view public.v_reteach with (security_invoker = true) as
select m.class_id, m.concept_id,
  count(distinct m.student_id)::int as students,
  sum(m.attempts)::int as attempts,
  round(100.0 * (sum(m.attempts) - sum(m.correct_attempts)) / nullif(sum(m.attempts), 0), 2) as wrong_rate_pct,
  coalesce((select count(*) from public.hint_events h where h.class_id = m.class_id and h.concept_id = m.concept_id), 0)::int as hints_used
from public.v_concept_mastery m
where public.is_admin() or public.is_instructor_of(m.class_id)
group by m.class_id, m.concept_id;

-- Learning gain, the exact rules of ADR 0020 (and shared/authoring/gain.ts):
--  gain = post - pre (points); normalized = (post - pre) / (100 - pre), null if pre = 100.
--  Items match on pair_key; unpaired items are ignored. Missing pre or post = 'incomplete'
--  with NULL gain, never zero. Class and concept rows use only students with both scores and
--  use the class MEAN pre and post (Hake), not the mean of per-student ratios.
-- _gain_core has no filtering: nobody but service_role may select from it (see grants).
create view public._gain_core as
with res as (
  select ar.student_id, ar.class_id, a.module_id, a.kind, ar.score_pct
  from public.assessment_results ar join public.assessments a on a.id = ar.assessment_id
), sm as (
  select student_id, class_id, module_id,
    max(score_pct) filter (where kind = 'pre') as pre_full,
    max(score_pct) filter (where kind = 'post') as post_full
  from res group by student_id, class_id, module_id
), paired as (
  select r1.student_id, r1.class_id, ap.module_id, ip.concept_id, r1.is_correct as pre_ok, r2.is_correct as post_ok
  from public.assessment_responses r1
  join public.assessment_items ip on ip.id = r1.assessment_item_id
  join public.assessments ap on ap.id = ip.assessment_id and ap.kind = 'pre'
  join public.assessments aq on aq.module_id = ap.module_id and aq.kind = 'post'
  join public.assessment_items iq on iq.assessment_id = aq.id and iq.pair_key = ip.pair_key
  join public.assessment_responses r2 on r2.assessment_item_id = iq.id and r2.student_id = r1.student_id and r2.class_id = r1.class_id
), concept_pairs as (
  select student_id, class_id, module_id, concept_id,
    100.0 * avg(pre_ok::int) as pre_pct, 100.0 * avg(post_ok::int) as post_pct
  from paired group by student_id, class_id, module_id, concept_id
), overall_pairs as (
  select student_id, class_id, module_id, 100.0 * avg(pre_ok::int) as pre_pct, 100.0 * avg(post_ok::int) as post_pct
  from paired group by student_id, class_id, module_id
), student_overall as (
  select sm.student_id, sm.class_id, sm.module_id,
    coalesce(o.pre_pct, sm.pre_full) as pre_pct, coalesce(o.post_pct, sm.post_full) as post_pct,
    (o.student_id is not null and sm.pre_full is not null and sm.post_full is not null) as complete
  from sm left join overall_pairs o using (student_id, class_id, module_id)
), student_rows as (
  select 'student'::text as scope, s.class_id, s.student_id, s.module_id, null::text as concept_id,
    s.pre_pct, s.post_pct,
    case when s.complete then s.post_pct - s.pre_pct end as gain_points,
    case when s.complete and s.pre_pct < 100 then (s.post_pct - s.pre_pct) / (100 - s.pre_pct) end as normalized_gain,
    case when s.complete then 'complete' else 'incomplete' end as status,
    case when s.complete then 1 else 0 end as complete_count, case when s.complete then 0 else 1 end as incomplete_count
  from student_overall s
  union all
  select 'student', c.class_id, c.student_id, c.module_id, c.concept_id, c.pre_pct, c.post_pct,
    c.post_pct - c.pre_pct,
    case when c.pre_pct < 100 then (c.post_pct - c.pre_pct) / (100 - c.pre_pct) end,
    'complete', 1, 0
  from concept_pairs c join student_overall s using (student_id, class_id, module_id) where s.complete
), class_overall as (
  select 'class'::text as scope, s.class_id, null::uuid as student_id, s.module_id, null::text as concept_id,
    avg(s.pre_pct) filter (where s.complete) as pre_pct, avg(s.post_pct) filter (where s.complete) as post_pct,
    count(*) filter (where s.complete)::int as complete_count, count(*) filter (where not s.complete)::int as incomplete_count
  from student_overall s group by s.class_id, s.module_id
), class_concept as (
  select 'class'::text as scope, c.class_id, null::uuid as student_id, c.module_id, c.concept_id,
    avg(c.pre_pct) as pre_pct, avg(c.post_pct) as post_pct,
    count(distinct c.student_id)::int as complete_count,
    (select o.incomplete_count from class_overall o where o.class_id = c.class_id and o.module_id = c.module_id) as incomplete_count
  from concept_pairs c join student_overall s using (student_id, class_id, module_id) where s.complete
  group by c.class_id, c.module_id, c.concept_id
), class_rows as (
  select x.scope, x.class_id, x.student_id, x.module_id, x.concept_id, x.pre_pct, x.post_pct,
    x.post_pct - x.pre_pct as gain_points,
    case when x.pre_pct < 100 then (x.post_pct - x.pre_pct) / (100 - x.pre_pct) end as normalized_gain,
    case when x.complete_count > 0 then 'complete' else 'incomplete' end as status,
    x.complete_count, x.incomplete_count
  from (select * from class_overall union all select * from class_concept) x
)
select * from student_rows union all select * from class_rows;

-- What the dashboards and the player read. Students see only their own rows, mentors their
-- mentees', instructors their classes' rows (student and class), admins everything.
create view public.v_learning_gain with (security_barrier = true) as
select g.* from public._gain_core g
where public.is_admin()
   or (g.scope = 'class' and public.is_instructor_of(g.class_id))
   or (g.scope = 'student' and (g.student_id = auth.uid() or public.is_instructor_of(g.class_id) or public.is_mentor_of(g.student_id)));

-- ---------- read API views (lane E, service_role only) ----------
-- Aggregates only, and groups with fewer than 5 students are left out entirely (plan decision 10).

create view public.api_class_gain as
select g.class_id, g.module_id, g.concept_id, g.pre_pct, g.post_pct, g.gain_points, g.normalized_gain,
  g.complete_count, g.incomplete_count
from public._gain_core g
where g.scope = 'class' and g.complete_count >= 5;

-- Same as v_class_progress but not RLS-filtered, for service_role only.
create view public.v_class_progress_all as
select cm.class_id, cm.profile_id as student_id,
  case when req.n = 0 then 0 else round(100.0 * coalesce(done.n, 0) / req.n, 2) end as completion_pct
from public.class_members cm
cross join lateral (
  select count(*)::int as n from public.class_modules m join public.lessons l on l.module_id = m.module_id
  join public.activities a on a.lesson_id = l.id where m.class_id = cm.class_id and m.opens_at <= now() and a.required) req
left join lateral (
  select count(*)::int as n from public.progress pr join public.activities a on a.id = pr.activity_id
  where pr.student_id = cm.profile_id and pr.class_id = cm.class_id and pr.status = 'completed' and a.required) done on true
where cm.member_role = 'student' and cm.profile_id is not null;

create view public.api_class_progress as
select p.class_id, count(*)::int as students, round(avg(p.completion_pct), 2) as avg_completion_pct
from public.v_class_progress_all p group by p.class_id having count(*) >= 5;


-- ---------- grants ----------
-- Supabase grants new objects to anon/authenticated by default. Start from nothing and give
-- back only what clients need; RLS then narrows rows.

revoke all on all tables in schema public from public, anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;
grant usage on schema public to anon, authenticated;

-- Reads
grant select on public.concepts, public.modules, public.lessons, public.activities,
  public.assessments, public.assessment_items to anon, authenticated;
grant select on public.profiles, public.schools, public.class_modules, public.submissions, public.progress,
  public.assessment_results, public.assessment_responses, public.mentor_assignments, public.mentor_notes,
  public.hint_events, public.staff_invites to authenticated;
grant select on public.classes, public.class_members, public.api_keys to authenticated;
grant select on public.v_class_progress, public.v_not_started, public.v_stuck, public.v_concept_mastery,
  public.v_reteach, public.v_learning_gain to authenticated;
-- The few direct writes: rename yourself, rename a class, add schools, append a mentor note.
grant update (display_name) on public.profiles to authenticated;
grant update (name, term) on public.classes to authenticated;
grant insert, update on public.schools to authenticated;
grant insert on public.mentor_notes to authenticated;

-- Functions clients may call. Everything else (helpers, grading, flows) stays private.
grant execute on function public.is_admin(), public.is_author(), public.is_member_of(uuid),
  public.is_instructor_of(uuid), public.is_mentor_of(uuid), public.can_edit_class(uuid) to authenticated;
grant execute on function public.can_read_module(uuid) to anon, authenticated;
-- v_stuck is a security_invoker view, so the caller needs this plain date helper.
grant execute on function public.school_days_between(timestamptz, timestamptz) to authenticated;
grant execute on function public.list_join_roster(text), public.list_open_modules(), public.get_activity(uuid) to anon, authenticated;
grant execute on function
  public.claim_login_code(text), public.claim_roster_seat(text, uuid), public.self_register(text),
  public.get_my_classes(), public.get_class_outline(uuid), public.next_activity(uuid),
  public.submit_answer(uuid, jsonb, uuid), public.heartbeat(uuid, int), public.get_assessment(uuid),
  public.submit_assessment(uuid, jsonb, uuid), public.get_my_progress(uuid), public.import_guest_progress(jsonb),
  public.create_class(text, text, text), public.create_join_code(uuid), public.import_roster(uuid, jsonb),
  public.reset_login_code(uuid), public.reset_assessment_result(uuid, uuid, uuid), public.assign_module(uuid, uuid, timestamptz),
  public.upsert_concept(text, text, text), public.save_module_draft(jsonb), public.submit_module(uuid),
  public.publish_module(uuid), public.return_module_to_draft(uuid), public.new_module_version(uuid),
  public.get_activity_keys(uuid), public.get_assessment_keys(uuid),
  public.invite_staff(text, text, boolean), public.set_profile_role(uuid, text, boolean),
  public.assign_mentor(uuid, uuid, boolean), public.create_api_key(text, text[]), public.revoke_api_key(uuid)
  to authenticated;

-- service_role (lane E functions) already has table access by default. Keep these two off clients:
revoke all on public._gain_core, public.api_class_gain, public.api_class_progress, public.v_class_progress_all
  from public, anon, authenticated;
grant select on public._gain_core, public.api_class_gain, public.api_class_progress, public.v_class_progress_all to service_role;
grant execute on function public.validate_api_key(text) to service_role;
