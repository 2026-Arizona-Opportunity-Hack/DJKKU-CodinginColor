-- Lane A core functions: role helpers, triggers, grading, and the unlock engine.
-- Everything here is internal. Clients never call these directly (the grants
-- migration revokes execute on all of them); the RPC migrations wrap them.

-- ---------- triggers ----------

create function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at before update on public.profiles
for each row execute function public.touch_updated_at();
create trigger progress_touch_updated_at before update on public.progress
for each row execute function public.touch_updated_at();

-- New auth user -> profile. A verified Google email that matches an unused staff
-- invite gets the invited role; everyone else (including anonymous students) is a
-- plain student. Email sign-up must stay disabled in Supabase so nobody can create
-- an unverified account with an invited address (see config.toml and the README).
create function public.handle_new_auth_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_invite public.staff_invites%rowtype;
begin
  if new.email is not null and new.email_confirmed_at is not null
     and coalesce(new.raw_app_meta_data ->> 'provider', '') = 'google' then
    select * into v_invite from public.staff_invites
    where email = lower(new.email) and accepted_at is null;
  end if;

  insert into public.profiles (id, role, display_name, can_author)
  values (
    new.id,
    coalesce(v_invite.role, 'student'),
    left(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'display_name', ''), 80),
    coalesce(v_invite.can_author, false)
  )
  on conflict (id) do nothing;

  if v_invite.email is not null then
    update public.staff_invites set accepted_at = now() where email = v_invite.email;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_auth_user();

-- ---------- role helpers (security definer so they can read profiles without recursion) ----------

create function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'cic_admin');
$$;

-- Authors: CIC admins, and instructors an admin switched can_author on for.
create function public.is_author() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and (p.role = 'cic_admin' or (p.role = 'instructor' and p.can_author))
  );
$$;

create function public.is_member_of(p_class_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.class_members cm
    where cm.class_id = p_class_id and cm.profile_id = auth.uid() and cm.member_role = 'student'
  );
$$;

create function public.is_instructor_of(p_class_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.class_members cm join public.profiles p on p.id = cm.profile_id
    where cm.class_id = p_class_id and cm.profile_id = auth.uid()
      and cm.member_role = 'instructor' and p.role in ('instructor', 'cic_admin')
  );
$$;

create function public.is_mentor_of(p_student_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.mentor_assignments ma join public.profiles p on p.id = ma.mentor_id
    where ma.mentor_id = auth.uid() and ma.student_id = p_student_id and ma.active and p.role = 'mentor'
  );
$$;

create function public.can_edit_class(p_class_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_admin() or public.is_instructor_of(p_class_id);
$$;

-- Drafts are editable by their owner or an admin. Submitted and published are not:
-- an author must be sent back to draft by an admin, and published is frozen forever.
create function public.can_edit_module(p_module_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.modules m
    where m.id = p_module_id and m.status = 'draft' and public.is_author()
      and (m.created_by = auth.uid() or public.is_admin())
  );
$$;

-- Who may see a module's curriculum content (never keys; keys have no policy).
--  published: guests and signed-in non-students always; a student only if a class of theirs has it
--  unpublished: the author who owns it, or an admin
create function public.can_read_module(p_module_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.modules m
    where m.id = p_module_id and (
      (m.status = 'published' and (
        auth.uid() is null
        or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role <> 'student')
        or exists (
          select 1 from public.class_modules cm
          join public.class_members mem on mem.class_id = cm.class_id
          where cm.module_id = m.id and mem.profile_id = auth.uid() and mem.member_role = 'student'
        )
      ))
      or (m.status <> 'published' and (public.is_admin() or (public.is_author() and m.created_by = auth.uid())))
    )
  );
$$;

-- Answer keys may be read by: admin, the module's owner, an instructor of a class that uses
-- the module, and a mentor of a student in such a class. Never students or reviewers.
create function public.can_read_keys(p_module_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_admin()
    or exists (select 1 from public.modules m where m.id = p_module_id and m.created_by = auth.uid() and public.is_author())
    or exists (
      select 1 from public.class_modules cm
      where cm.module_id = p_module_id
        and (public.is_instructor_of(cm.class_id)
             or exists (select 1 from public.class_members s
                        where s.class_id = cm.class_id and s.member_role = 'student'
                          and s.profile_id is not null and public.is_mentor_of(s.profile_id)))
    );
$$;

-- ---------- published versions are frozen ----------
-- One generic trigger. A published module, and everything under it, can no longer be
-- changed or deleted. To change content, make version + 1 (new_module_version).

create function public.guard_published() returns trigger
language plpgsql set search_path = '' as $$
declare
  v_module_id uuid;
  v_row jsonb := to_jsonb(case when tg_op = 'DELETE' then old else new end);
begin
  v_module_id := case tg_table_name
    when 'modules' then (v_row ->> 'id')::uuid
    when 'lessons' then (v_row ->> 'module_id')::uuid
    when 'assessments' then (v_row ->> 'module_id')::uuid
    when 'activities' then (select l.module_id from public.lessons l where l.id = (v_row ->> 'lesson_id')::uuid)
    when 'activity_keys' then (select l.module_id from public.activities a join public.lessons l on l.id = a.lesson_id
                               where a.id = (v_row ->> 'activity_id')::uuid)
    when 'assessment_items' then (select a.module_id from public.assessments a where a.id = (v_row ->> 'assessment_id')::uuid)
    when 'assessment_keys' then (select a.module_id from public.assessment_items i join public.assessments a on a.id = i.assessment_id
                                 where i.id = (v_row ->> 'assessment_item_id')::uuid)
  end;

  -- For the modules table itself, look at the OLD status: draft -> published is allowed once.
  if tg_table_name = 'modules' then
    if tg_op in ('UPDATE', 'DELETE') and old.status = 'published' then
      raise exception 'Published module versions are immutable; create a new version instead';
    end if;
  elsif exists (select 1 from public.modules m where m.id = v_module_id and m.status = 'published') then
    raise exception 'Content of a published module version is immutable; create a new version instead';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger modules_frozen before update or delete on public.modules
for each row execute function public.guard_published();
create trigger lessons_frozen before insert or update or delete on public.lessons
for each row execute function public.guard_published();
create trigger activities_frozen before insert or update or delete on public.activities
for each row execute function public.guard_published();
create trigger activity_keys_frozen before insert or update or delete on public.activity_keys
for each row execute function public.guard_published();
create trigger assessments_frozen before insert or update or delete on public.assessments
for each row execute function public.guard_published();
create trigger assessment_items_frozen before insert or update or delete on public.assessment_items
for each row execute function public.guard_published();
create trigger assessment_keys_frozen before insert or update or delete on public.assessment_keys
for each row execute function public.guard_published();

-- Only published module versions can be given to a class.
create function public.guard_class_module() returns trigger
language plpgsql set search_path = '' as $$
begin
  if not exists (select 1 from public.modules m where m.id = new.module_id and m.status = 'published') then
    raise exception 'Only published module versions can be assigned to a class';
  end if;
  return new;
end;
$$;
create trigger class_modules_published_only before insert or update on public.class_modules
for each row execute function public.guard_class_module();

-- ---------- grading ----------
-- Same rules as shared/authoring (and ADR 0022): short answers and blanks are compared
-- after trimming and collapsing spaces, and lowercased unless the key says caseSensitive.

create function public.norm_text(p_text text, p_case_sensitive boolean) returns text
language sql immutable set search_path = '' as $$
  select case when p_case_sensitive then regexp_replace(btrim(coalesce(p_text, '')), '\s+', ' ', 'g')
              else lower(regexp_replace(btrim(coalesce(p_text, '')), '\s+', ' ', 'g')) end;
$$;

-- Response shapes (from the player): mcq {choice_id}, short_answer {text},
-- fill_blank {blanks:[..]}, ordering {order:[ids]}. Anything malformed is just wrong.
create function public.grade_question(p_type text, p_key jsonb, p_response jsonb) returns boolean
language plpgsql immutable set search_path = '' as $$
declare
  v_cs boolean := coalesce((p_key ->> 'caseSensitive')::boolean, false);
begin
  if jsonb_typeof(p_response) is distinct from 'object' then return false; end if;
  case p_type
    when 'mcq' then
      return coalesce(jsonb_typeof(p_response -> 'choice_id') = 'string'
         and (p_response ->> 'choice_id') = (p_key ->> 'correctChoiceId'), false);
    when 'short_answer' then
      if jsonb_typeof(p_response -> 'text') is distinct from 'string' then return false; end if;
      return exists (
        select 1 from jsonb_array_elements_text(p_key -> 'accepted') a(v)
        where public.norm_text(a.v, v_cs) = public.norm_text(p_response ->> 'text', v_cs)
      );
    when 'fill_blank' then
      if jsonb_typeof(p_response -> 'blanks') is distinct from 'array'
         or jsonb_array_length(p_response -> 'blanks') <> jsonb_array_length(p_key -> 'blanks') then
        return false;
      end if;
      return not exists (
        select 1 from jsonb_array_elements(p_key -> 'blanks') with ordinality k(accepted, idx)
        where jsonb_typeof(k.accepted) is distinct from 'array'
           or not exists (
             select 1 from jsonb_array_elements_text(k.accepted) a(v)
             where public.norm_text(a.v, v_cs) = public.norm_text(p_response -> 'blanks' ->> (k.idx::int - 1), v_cs)
           )
      );
    when 'ordering' then
      return coalesce(jsonb_typeof(p_response -> 'order') = 'array' and (p_response -> 'order') = (p_key -> 'correctOrder'), false);
    else
      return false;
  end case;
end;
$$;

-- ---------- the unlock engine ----------
-- Rules (plan open question 7):
--  * Modules open in class order. Module N+1 opens when module N is DONE: every required
--    activity completed AND its post-test taken (if it has one).
--  * A module's activities open after its pre-test is TAKEN (not passed).
--  * Inside a module, a required activity opens when every required activity before it is done.
--  * The post-test opens when all required activities are done.
-- Enforcement happens in submit_answer / get_activity / heartbeat / submit_assessment,
-- never only in the UI.

create function public._module_flow(p_student uuid, p_class uuid)
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
        where l.module_id = cm.module_id and a.required) as req_done
    from public.class_modules cm
    join public.modules m on m.id = cm.module_id
    left join public.assessments pre on pre.module_id = cm.module_id and pre.kind = 'pre'
    left join public.assessments post on post.module_id = cm.module_id and post.kind = 'post'
    where cm.class_id = p_class
  ), flagged as (
    select b.*, (b.req_done >= b.req_total and (b.post_id is null or b.post_taken)) as done from base b
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

create function public._activity_flow(p_student uuid, p_class uuid)
returns table (
  activity_id uuid, lesson_id uuid, module_id uuid, mod_pos int, les_pos int, act_pos int,
  kind text, title text, required boolean, completed boolean, status text, locked_reason text
)
language sql stable security definer set search_path = '' as $$
  with acts as (
    select f.module_id, f.mod_pos, f.unlocked, f.pre_id, f.pre_taken,
      l.id as lesson_id, l.position as les_pos, a.id as activity_id, a.position as act_pos,
      a.kind, a.title, a.required,
      coalesce(pr.status = 'completed', false) as completed
    from public._module_flow(p_student, p_class) f
    join public.lessons l on l.module_id = f.module_id
    join public.activities a on a.lesson_id = l.id
    left join public.progress pr on pr.student_id = p_student and pr.class_id = p_class and pr.activity_id = a.id
  ), ordered as (
    select a.*,
      coalesce(bool_and(a.completed or not a.required) over (
        order by a.mod_pos, a.les_pos, a.act_pos rows between unbounded preceding and 1 preceding), true) as prior_ok
    from acts a
  )
  select o.activity_id, o.lesson_id, o.module_id, o.mod_pos, o.les_pos, o.act_pos, o.kind, o.title, o.required, o.completed,
    case when o.completed then 'done'
         when o.unlocked and (o.pre_id is null or o.pre_taken) and o.prior_ok then 'available'
         else 'locked' end,
    case when o.completed then null
         when not o.unlocked then 'Finish the earlier module first'
         when o.pre_id is not null and not o.pre_taken then 'Take the pre-test first'
         when not o.prior_ok then 'Finish the earlier activities first'
         else null end
  from ordered o;
$$;

-- Which of the caller's classes contains this module? Errors if none, or if several and no hint.
create function public._resolve_class(p_student uuid, p_module_id uuid, p_class_id uuid) returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare
  v_ids uuid[];
begin
  select array_agg(distinct cm.class_id) into v_ids
  from public.class_modules cm
  join public.class_members mem on mem.class_id = cm.class_id
  where cm.module_id = p_module_id and cm.opens_at <= now()
    and mem.profile_id = p_student and mem.member_role = 'student'
    and (p_class_id is null or cm.class_id = p_class_id);
  if v_ids is null then raise exception 'This is not assigned to you'; end if;
  if array_length(v_ids, 1) > 1 then raise exception 'Class is required: this is assigned in more than one of your classes'; end if;
  return v_ids[1];
end;
$$;

-- Business days between two timestamps, used by the "stuck" rules (3 school days idle).
create function public.school_days_between(p_from timestamptz, p_to timestamptz) returns integer
language sql stable set search_path = '' as $$
  select count(*)::int from generate_series(p_from::date + 1, p_to::date, interval '1 day') d
  where extract(isodow from d) < 6;
$$;
