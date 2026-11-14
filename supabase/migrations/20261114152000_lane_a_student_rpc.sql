-- Lane A student-facing RPCs. These are the ONLY way a student writes anything.
-- Names, arguments and return shapes follow lane B's adapter
-- (src/features/player/api.supabase.ts + types.ts): every function returns jsonb so
-- supabase-js hands the player one object or array, never a row set.
-- All are SECURITY DEFINER with an empty search_path, and check auth.uid() themselves.

-- ---------- joining a class ----------

-- Login and join codes are random, shown once, and stored only as a sha256 hash.
-- Dashes and case are ignored so a teacher can print "AB12-CD34-..." and a student
-- can type it any way.
create function public._code_hash(p_code text) returns text
language sql immutable set search_path = '' as $$
  select encode(extensions.digest(lower(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g')), 'sha256'), 'hex');
$$;

create function public._new_code(p_bytes int) returns text
language sql volatile set search_path = '' as $$
  select regexp_replace(upper(encode(extensions.gen_random_bytes(p_bytes), 'hex')), '(.{4})(?=.)', '\1-', 'g');
$$;

-- Bind a roster seat to a profile. If the seat was already bound to a different profile
-- (a lost-code reset on a new device), the student's data moves with them.
create function public._claim_member(p_member_id uuid, p_profile uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_m public.class_members%rowtype;
  v_class_name text;
begin
  select * into v_m from public.class_members where id = p_member_id for update;
  if v_m.profile_id is not null and v_m.profile_id <> p_profile then
    update public.progress set student_id = p_profile where student_id = v_m.profile_id and class_id = v_m.class_id;
    update public.submissions set student_id = p_profile where student_id = v_m.profile_id and class_id = v_m.class_id;
    update public.assessment_results set student_id = p_profile where student_id = v_m.profile_id and class_id = v_m.class_id;
    update public.assessment_responses set student_id = p_profile where student_id = v_m.profile_id and class_id = v_m.class_id;
    update public.hint_events set student_id = p_profile where student_id = v_m.profile_id and class_id = v_m.class_id;
  end if;
  update public.class_members set profile_id = p_profile, claimed_at = now() where id = v_m.id;
  delete from public.member_login_codes where member_id = v_m.id;   -- a code works once
  update public.profiles set display_name = v_m.display_name where id = p_profile;
  select name into v_class_name from public.classes where id = v_m.class_id;
  return jsonb_build_object('class_id', v_m.class_id, 'class_name', v_class_name, 'display_name', v_m.display_name);
end;
$$;

-- Student types the personal code from their printed card.
create function public.claim_login_code(p_code text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_member_id uuid;
begin
  if v_uid is null or length(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g')) < 12 then
    raise exception 'Enter the full login code from your card';
  end if;
  if not exists (select 1 from public.profiles p where p.id = v_uid and p.role = 'student') then
    raise exception 'This account cannot claim a roster code';
  end if;

  select cm.id into v_member_id from public.member_login_codes lc join public.class_members cm on cm.id = lc.member_id
  where cm.member_role = 'student' and lc.code_hash = public._code_hash(p_code);
  if v_member_id is null then
    raise exception 'That login code is not valid. Ask your instructor for a new one.';
  end if;

  -- One seat per device: a session that already sits in some other class cannot claim a second seat.
  if exists (select 1 from public.class_members cm
             where cm.profile_id = v_uid and cm.member_role = 'student' and cm.id <> v_member_id) then
    raise exception 'This device already belongs to a class';
  end if;
  return public._claim_member(v_member_id, v_uid);
end;
$$;

-- Late joiner: anyone with the class join code can see the unclaimed names and pick theirs.
-- The join code is the secret here (random, 48 bits); labels should be "First L." (roster rule).
create function public.list_join_roster(p_join_code text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_class uuid;
begin
  select jc.class_id into v_class from public.class_join_codes jc where jc.code_hash = public._code_hash(p_join_code);
  if v_class is null then raise exception 'That class code was not found'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('member_id', cm.id, 'label', cm.display_name) order by cm.display_name)
    from public.class_members cm
    where cm.class_id = v_class and cm.member_role = 'student' and cm.profile_id is null
  ), '[]'::jsonb);
end;
$$;

create function public.claim_roster_seat(p_join_code text, p_member_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_class uuid;
begin
  if v_uid is null then raise exception 'Sign in first'; end if;
  if not exists (select 1 from public.profiles p where p.id = v_uid and p.role = 'student') then
    raise exception 'This account cannot claim a roster seat';
  end if;
  select jc.class_id into v_class from public.class_join_codes jc where jc.code_hash = public._code_hash(p_join_code);
  if v_class is null then raise exception 'That class code was not found'; end if;
  if exists (select 1 from public.class_members cm where cm.profile_id = v_uid and cm.member_role = 'student') then
    raise exception 'This device already belongs to a class';
  end if;
  -- Only an UNCLAIMED seat of this class can be taken this way (a claimed seat needs a reset code).
  perform 1 from public.class_members cm
  where cm.id = p_member_id and cm.class_id = v_class and cm.member_role = 'student' and cm.profile_id is null
  for update;
  if not found then raise exception 'That name was already taken. Ask your instructor.'; end if;
  return public._claim_member(p_member_id, v_uid);
end;
$$;

-- Homeschool / independent learner: display name only, no email. They land in CIC Open
-- and get a personal code so they can come back. The Pages Function in front of this
-- (lane E) rate-limits by IP; Supabase also limits anonymous sign-ins per IP (config.toml).
create function public.self_register(p_display_name text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_class uuid;
  v_member uuid;
  v_code text := public._new_code(8);
  v_name text := btrim(coalesce(p_display_name, ''));
begin
  if v_uid is null or char_length(v_name) not between 1 and 80 or v_name like '%@%' then
    raise exception 'Enter a display name (no email) up to 80 characters';
  end if;
  if not exists (select 1 from public.profiles p where p.id = v_uid and p.role = 'student') then
    raise exception 'This account cannot self-register';
  end if;
  if exists (select 1 from public.class_members cm where cm.profile_id = v_uid) then
    raise exception 'This device already belongs to a class';
  end if;
  select c.id into v_class from public.classes c where c.kind = 'open';
  if v_class is null then raise exception 'CIC Open has not been set up yet'; end if;

  insert into public.class_members (class_id, profile_id, member_role, display_name, claimed_at)
  values (v_class, v_uid, 'student', v_name, now())
  returning id into v_member;
  insert into public.member_login_codes (member_id, code_hash) values (v_member, public._code_hash(v_code));
  update public.profiles set role = 'independent_student', display_name = v_name where id = v_uid;
  return jsonb_build_object('class_id', v_class, 'login_code', v_code);
end;
$$;

-- ---------- reading the curriculum as a student ----------

create function public.get_my_classes() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('class_id', c.id, 'class_name', c.name, 'kind', c.kind) order by c.name), '[]'::jsonb)
  from public.class_members cm join public.classes c on c.id = cm.class_id
  where cm.profile_id = auth.uid() and cm.member_role = 'student';
$$;

-- Everything the class path screen needs, with locked / available / done computed by the unlock engine.
create function public.get_class_outline(p_class_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_result jsonb;
begin
  if v_uid is null or not public.is_member_of(p_class_id) then
    raise exception 'You are not in this class';
  end if;
  with mf as materialized (select * from public._module_flow(v_uid, p_class_id)),
       af as materialized (select * from public._activity_flow(v_uid, p_class_id))
  select jsonb_build_object('modules', coalesce(jsonb_agg(jsonb_build_object(
    'module_id', f.module_id, 'title', f.title, 'position', f.mod_pos,
    'pretest', case when f.pre_id is null then null else jsonb_build_object('assessment_id', f.pre_id,
        'status', case when f.pre_taken then 'done' when f.unlocked then 'available' else 'locked' end) end,
    'posttest', case when f.post_id is null then null else jsonb_build_object('assessment_id', f.post_id,
        'status', case when f.post_taken then 'done'
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

-- First required activity that is available. NULL when the student is finished, or when the
-- next thing is a pre-test or post-test (the outline shows those as available assessments).
create function public.next_activity(p_class_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_result jsonb;
begin
  if v_uid is null or not public.is_member_of(p_class_id) then
    raise exception 'You are not in this class';
  end if;
  select jsonb_build_object('module_id', a.module_id, 'lesson_id', a.lesson_id, 'activity_id', a.activity_id)
  into v_result
  from public._activity_flow(v_uid, p_class_id) a
  where a.status = 'available' and a.required and not a.completed
  order by a.mod_pos, a.les_pos, a.act_pos
  limit 1;
  return v_result;
end;
$$;

-- One activity with student-safe content (never keys). Students get the real unlock check;
-- guests see only modules in CIC Open; instructors, mentors, reviewers and authors preview
-- whatever can_read_module allows.
create function public.get_activity(p_activity_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_act record;
  v_class uuid;
  v_flow record;
  v_status text := 'available';
  v_prev uuid;
  v_next uuid;
begin
  select a.id, a.title, a.kind, a.content, l.module_id into v_act
  from public.activities a join public.lessons l on l.id = a.lesson_id
  where a.id = p_activity_id;
  if not found then raise exception 'Activity not found'; end if;

  if v_uid is not null then
    select cm.class_id into v_class
    from public.class_modules cm join public.class_members mem on mem.class_id = cm.class_id
    where cm.module_id = v_act.module_id and cm.opens_at <= now()
      and mem.profile_id = v_uid and mem.member_role = 'student'
    order by cm.created_at limit 1;
  end if;

  if v_class is not null then
    select * into v_flow from public._activity_flow(v_uid, v_class) f where f.activity_id = p_activity_id;
    if v_flow.status = 'locked' then
      raise exception 'This activity is locked: %', coalesce(v_flow.locked_reason, 'finish the earlier work first');
    end if;
    v_status := v_flow.status;
    select x.p, x.n into v_prev, v_next from (
      select f.activity_id, lag(f.activity_id) over w as p, lead(f.activity_id) over w as n
      from public._activity_flow(v_uid, v_class) f
      window w as (order by f.mod_pos, f.les_pos, f.act_pos)
    ) x where x.activity_id = p_activity_id;
  else
    if v_uid is null then
      -- Guest: only modules published into the CIC Open class.
      if not exists (select 1 from public.class_modules cm join public.classes c on c.id = cm.class_id
                     where cm.module_id = v_act.module_id and c.kind = 'open') then
        raise exception 'Activity not found';
      end if;
    elsif not public.can_read_module(v_act.module_id) then
      raise exception 'Activity not found';
    end if;
    select x.p, x.n into v_prev, v_next from (
      select a.id, lag(a.id) over w as p, lead(a.id) over w as n
      from public.activities a join public.lessons l on l.id = a.lesson_id
      where l.module_id = v_act.module_id
      window w as (order by l.position, a.position)
    ) x where x.id = p_activity_id;
  end if;

  return jsonb_build_object('activity_id', v_act.id, 'title', v_act.title, 'kind', v_act.kind,
    'status', v_status, 'prev_id', v_prev, 'next_id', v_next, 'content', v_act.content);
end;
$$;

create function public.list_open_modules() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'module_id', m.id, 'title', m.title, 'summary', m.summary,
    'lessons', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'lesson_id', l.id, 'title', l.title,
        'activities', (select coalesce(jsonb_agg(jsonb_build_object('activity_id', a.id, 'title', a.title, 'kind', a.kind)
                                                 order by a.position), '[]'::jsonb)
                       from public.activities a where a.lesson_id = l.id)
      ) order by l.position), '[]'::jsonb)
      from public.lessons l where l.module_id = m.id)
  ) order by cm.position), '[]'::jsonb)
  from public.class_modules cm
  join public.classes c on c.id = cm.class_id and c.kind = 'open'
  join public.modules m on m.id = cm.module_id and m.status = 'published'
  where cm.opens_at <= now();
$$;

-- ---------- doing the work ----------

-- Response shapes (lane B): video/reading {viewed:true}; check/worksheet/exit
-- {answers: {question_id: {choice_id} | {text} | {blanks:[]} | {order:[]}}}.
-- Grading, locking, attempts and progress all happen here. The client only ever gets
-- correct/incorrect, a hint from the key's ladder, and (once finished) the explanation.
-- A check completes only when every scored question is right; a worksheet or exit
-- ticket completes on any full submission and records the score.
create function public.submit_answer(p_activity_id uuid, p_response jsonb, p_class_id uuid default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_act record;
  v_class uuid;
  v_flow record;
  v_answers jsonb;
  v_q jsonb;
  v_key jsonb;
  v_resp jsonb;
  v_qid text;
  v_type text;
  v_ok boolean;
  v_scored int := 0;
  v_correct int := 0;
  v_results jsonb := '{}'::jsonb;
  v_hint text;
  v_explanations text[] := '{}';
  v_attempt int;
  v_all_correct boolean;
  v_score numeric;
  v_completed boolean;
  v_before uuid[];
  v_module_done boolean;
  v_unlocked_title text;
  v_next uuid;
begin
  if v_uid is null then raise exception 'Sign in first'; end if;
  if not exists (select 1 from public.profiles p where p.id = v_uid and p.role in ('student', 'independent_student')) then
    raise exception 'Only students can submit answers';
  end if;
  if jsonb_typeof(p_response) is distinct from 'object' or pg_column_size(p_response) > 32768 then
    raise exception 'That answer is not valid';
  end if;

  select a.id, a.kind, a.content, l.module_id into v_act
  from public.activities a join public.lessons l on l.id = a.lesson_id where a.id = p_activity_id;
  if not found then raise exception 'Activity not found'; end if;

  v_class := public._resolve_class(v_uid, v_act.module_id, p_class_id);
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text || ':' || p_activity_id::text, 0));

  -- Enforced here, not only hidden in the UI.
  select * into v_flow from public._activity_flow(v_uid, v_class) f where f.activity_id = p_activity_id;
  if v_flow.status = 'locked' then
    raise exception 'This activity is locked: %', coalesce(v_flow.locked_reason, 'finish the earlier work first');
  end if;

  select coalesce(array_agg(f.module_id) filter (where f.unlocked), '{}') into v_before
  from public._module_flow(v_uid, v_class) f;

  select coalesce(max(s.attempt_no), 0) + 1 into v_attempt from public.submissions s
  where s.student_id = v_uid and s.class_id = v_class and s.activity_id = p_activity_id;

  if v_act.kind in ('video', 'reading') then
    if (p_response ->> 'viewed') is distinct from 'true' then
      raise exception 'Send {"viewed": true} for a video or reading';
    end if;
    v_all_correct := true;
    v_score := 100;
  else
    v_answers := p_response -> 'answers';
    if jsonb_typeof(v_answers) is distinct from 'object' then
      raise exception 'Send your answers keyed by question id';
    end if;
    for v_q in select value from jsonb_array_elements(v_act.content -> 'questions') loop
      v_qid := v_q ->> 'id';
      v_type := v_q ->> 'type';
      v_resp := v_answers -> v_qid;
      if v_resp is null then raise exception 'Answer every question (missing %)', v_qid; end if;

      if v_type = 'reflection' then
        if jsonb_typeof(v_resp -> 'text') is distinct from 'string'
           or char_length(btrim(v_resp ->> 'text')) not between 1 and 2000 then
          raise exception 'Write between 1 and 2000 characters for the reflection';
        end if;
        continue;
      end if;

      select k.key into v_key from public.activity_keys k where k.activity_id = p_activity_id and k.question_id = v_qid;
      if v_key is null then raise exception 'This activity is missing its answer key (question %)', v_qid; end if;

      v_scored := v_scored + 1;
      v_ok := public.grade_question(v_type, v_key, v_resp);
      if v_ok then
        v_correct := v_correct + 1;
      elsif v_hint is null then
        v_hint := v_key -> 'hints' ->> (v_attempt - 1);   -- next rung of the ladder; null once it runs out
      end if;
      if (v_key ->> 'explanation') is not null then v_explanations := v_explanations || (v_key ->> 'explanation'); end if;
      v_results := v_results || jsonb_build_object(v_qid, jsonb_build_object('correct', v_ok, 'concept', v_q ->> 'conceptId'));
    end loop;
    v_all_correct := v_correct = v_scored;
    v_score := case when v_scored = 0 then 100 else round(100.0 * v_correct / v_scored, 2) end;
  end if;

  v_completed := case when v_act.kind = 'check' then v_all_correct else true end;

  insert into public.submissions (student_id, class_id, activity_id, response, is_correct, score, results, attempt_no)
  values (v_uid, v_class, p_activity_id, p_response, case when v_scored = 0 then null else v_all_correct end,
          v_score, v_results, v_attempt);

  insert into public.progress (student_id, class_id, activity_id, status, best_score, completed_at)
  values (v_uid, v_class, p_activity_id, case when v_completed then 'completed' else 'in_progress' end,
          v_score, case when v_completed then now() end)
  on conflict (student_id, class_id, activity_id) do update
  set status = case when public.progress.status = 'completed' or excluded.status = 'completed' then 'completed' else 'in_progress' end,
      best_score = greatest(public.progress.best_score, excluded.best_score),
      completed_at = coalesce(public.progress.completed_at, excluded.completed_at);

  select f.req_done >= f.req_total into v_module_done
  from public._module_flow(v_uid, v_class) f where f.module_id = v_act.module_id;
  select f.title into v_unlocked_title from public._module_flow(v_uid, v_class) f
  where f.unlocked and f.module_id <> all (v_before) order by f.mod_pos limit 1;
  select a.activity_id into v_next from public._activity_flow(v_uid, v_class) a
  where a.status = 'available' and a.required and not a.completed
  order by a.mod_pos, a.les_pos, a.act_pos limit 1;

  return jsonb_build_object(
    'is_correct', case when v_scored = 0 then null else v_all_correct end,
    'score', v_score,
    'feedback', case when v_all_correct then null else v_hint end,
    'explanation', case when v_completed then nullif(array_to_string(v_explanations, ' '), '') end,
    'completed', v_completed or v_flow.completed,
    'next_activity_id', v_next,
    'module_completed', coalesce(v_module_done, false),
    'unlocked_module_title', v_unlocked_title
  );
end;
$$;

-- Time on task, sent every few seconds by the player. Capped so it cannot be inflated forever.
create function public.heartbeat(p_activity_id uuid, p_seconds int) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_module uuid;
  v_class uuid;
  v_status text;
begin
  if v_uid is null or not exists (select 1 from public.profiles p where p.id = v_uid and p.role in ('student', 'independent_student')) then
    raise exception 'Only students can record time';
  end if;
  if p_seconds is null or p_seconds < 0 or p_seconds > 60 then
    raise exception 'Heartbeat must be between 0 and 60 seconds';
  end if;
  select l.module_id into v_module from public.activities a join public.lessons l on l.id = a.lesson_id where a.id = p_activity_id;
  if v_module is null then raise exception 'Activity not found'; end if;
  v_class := public._resolve_class(v_uid, v_module, null);
  select f.status into v_status from public._activity_flow(v_uid, v_class) f where f.activity_id = p_activity_id;
  if v_status = 'locked' then raise exception 'This activity is locked'; end if;

  insert into public.progress (student_id, class_id, activity_id, time_spent_s)
  values (v_uid, v_class, p_activity_id, p_seconds)
  on conflict (student_id, class_id, activity_id) do update
  set time_spent_s = least(public.progress.time_spent_s + excluded.time_spent_s, 14400);
  return jsonb_build_object('ok', true);
end;
$$;

-- ---------- tests ----------

-- Student-safe view of a test: question content only, plus whether it was already taken.
create function public.get_assessment(p_assessment_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_a record;
  v_class uuid;
  v_m record;
  v_taken boolean := false;
begin
  select a.id, a.kind, a.module_id into v_a from public.assessments a where a.id = p_assessment_id;
  if not found then raise exception 'Test not found'; end if;

  if v_uid is not null then
    select cm.class_id into v_class
    from public.class_modules cm join public.class_members mem on mem.class_id = cm.class_id
    where cm.module_id = v_a.module_id and cm.opens_at <= now() and mem.profile_id = v_uid and mem.member_role = 'student'
    order by cm.created_at limit 1;
  end if;

  if v_class is not null then
    select * into v_m from public._module_flow(v_uid, v_class) f where f.module_id = v_a.module_id;
    if not v_m.unlocked or (v_a.kind = 'post' and v_m.req_done < v_m.req_total) then
      raise exception 'This test is locked';
    end if;
    v_taken := case v_a.kind when 'pre' then v_m.pre_taken else v_m.post_taken end;
  elsif v_uid is null or not public.can_read_module(v_a.module_id) then
    raise exception 'Test not found';
  end if;

  return jsonb_build_object(
    'assessment_id', v_a.id, 'kind', v_a.kind, 'taken', v_taken,
    'items', (select coalesce(jsonb_agg(i.content order by i.position), '[]'::jsonb)
              from public.assessment_items i where i.assessment_id = v_a.id));
end;
$$;

-- One shot per test (so nobody can retake the pre-test after seeing the post). Responses are
-- keyed by question id. Every item must be answered. Returns the score and per-concept percents.
create function public.submit_assessment(p_assessment_id uuid, p_responses jsonb, p_class_id uuid default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_a record;
  v_class uuid;
  v_m record;
  v_item record;
  v_resp jsonb;
  v_ok boolean;
  v_total int;
  v_correct int := 0;
  v_score numeric;
  v_per jsonb;
begin
  if v_uid is null or not exists (select 1 from public.profiles p where p.id = v_uid and p.role in ('student', 'independent_student')) then
    raise exception 'Only students can take a test';
  end if;
  if jsonb_typeof(p_responses) is distinct from 'object' or pg_column_size(p_responses) > 65536 then
    raise exception 'Those answers are not valid';
  end if;
  select a.id, a.kind, a.module_id into v_a from public.assessments a where a.id = p_assessment_id;
  if not found then raise exception 'Test not found'; end if;

  v_class := public._resolve_class(v_uid, v_a.module_id, p_class_id);
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text || ':' || p_assessment_id::text, 0));
  if exists (select 1 from public.assessment_results r
             where r.student_id = v_uid and r.class_id = v_class and r.assessment_id = p_assessment_id) then
    raise exception 'You already took this test. Ask your instructor if it needs a reset.';
  end if;

  select * into v_m from public._module_flow(v_uid, v_class) f where f.module_id = v_a.module_id;
  if not v_m.unlocked or (v_a.kind = 'post' and v_m.req_done < v_m.req_total) then
    raise exception 'This test is locked';
  end if;

  select count(*) into v_total from public.assessment_items i where i.assessment_id = p_assessment_id;
  if v_total = 0 or v_total <> (select count(*) from jsonb_object_keys(p_responses)) then
    raise exception 'Answer every question on the test';
  end if;

  for v_item in
    select i.id, i.question_id, i.content ->> 'type' as qtype, k.key
    from public.assessment_items i left join public.assessment_keys k on k.assessment_item_id = i.id
    where i.assessment_id = p_assessment_id order by i.position
  loop
    if v_item.key is null then raise exception 'This test is missing an answer key'; end if;
    v_resp := p_responses -> v_item.question_id;
    if v_resp is null then raise exception 'Answer every question on the test'; end if;
    v_ok := public.grade_question(v_item.qtype, v_item.key, v_resp);
    if v_ok then v_correct := v_correct + 1; end if;
    insert into public.assessment_responses (student_id, class_id, assessment_item_id, response, is_correct)
    values (v_uid, v_class, v_item.id, v_resp, v_ok);
  end loop;

  v_score := round(100.0 * v_correct / v_total, 2);
  select coalesce(jsonb_object_agg(x.concept_id, x.pct), '{}'::jsonb) into v_per from (
    select i.concept_id, round(100.0 * count(*) filter (where r.is_correct) / count(*), 2) as pct
    from public.assessment_responses r join public.assessment_items i on i.id = r.assessment_item_id
    where i.assessment_id = p_assessment_id and r.student_id = v_uid and r.class_id = v_class
    group by i.concept_id) x;

  insert into public.assessment_results (student_id, class_id, assessment_id, score_pct, per_concept)
  values (v_uid, v_class, p_assessment_id, v_score, v_per);

  return jsonb_build_object('score_pct', v_score, 'per_concept', (
    select coalesce(jsonb_agg(jsonb_build_object('concept', c.name, 'pct', (e.value #>> '{}')::numeric) order by c.name), '[]'::jsonb)
    from jsonb_each(v_per) e join public.concepts c on c.id = e.key));
end;
$$;

-- ---------- "how am I doing" and guest merge ----------

create function public.get_my_progress(p_class_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or not public.is_member_of(p_class_id) then raise exception 'You are not in this class'; end if;
  return (
    select jsonb_build_object(
      'completed', coalesce(sum(f.req_done), 0),
      'total', coalesce(sum(f.req_total), 0),
      'modules', coalesce(jsonb_agg(jsonb_build_object(
        'title', f.title,
        'pct', case when f.req_total = 0 then 0 else round(100.0 * f.req_done / f.req_total) end,
        'pre_pct', g.pre_pct, 'post_pct', g.post_pct, 'gain', g.gain_points
      ) order by f.mod_pos), '[]'::jsonb))
    from public._module_flow(v_uid, p_class_id) f
    left join lateral (
      select * from public.v_learning_gain g
      where g.scope = 'student' and g.student_id = v_uid and g.class_id = p_class_id
        and g.module_id = f.module_id and g.concept_id is null
    ) g on true
  );
end;
$$;

-- A guest's on-device progress is merged when they register. Only "viewed" credit for
-- videos and readings in CIC Open modules is accepted: graded work cannot be trusted from
-- the device, so those activities stay to be done again after signing up.
create function public.import_guest_progress(p_payload jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_class uuid;
  v_count int := 0;
  v_id text;
  v_when text;
  v_ts timestamptz;
  v_n int;
begin
  if v_uid is null or not exists (select 1 from public.profiles p where p.id = v_uid and p.role = 'independent_student') then
    raise exception 'Register first, then import your progress';
  end if;
  if jsonb_typeof(p_payload) is distinct from 'object' or p_payload ->> 'version' is distinct from '1'
     or jsonb_typeof(p_payload -> 'completed') is distinct from 'object' or pg_column_size(p_payload) > 65536 then
    raise exception 'That progress file is not valid';
  end if;
  select c.id into v_class from public.classes c where c.kind = 'open';

  for v_id, v_when in select key, value ->> 'completed_at' from jsonb_each(p_payload -> 'completed') limit 500 loop
    continue when v_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
    begin
      v_ts := least(v_when::timestamptz, now());
    exception when others then
      v_ts := now();
    end;
    insert into public.progress (student_id, class_id, activity_id, status, best_score, completed_at)
    select v_uid, v_class, a.id, 'completed', 100, v_ts
    from public.activities a
    join public.lessons l on l.id = a.lesson_id
    join public.class_modules cm on cm.module_id = l.module_id and cm.class_id = v_class
    join public.modules m on m.id = l.module_id and m.status = 'published'
    where a.id = v_id::uuid and a.kind in ('video', 'reading')
    on conflict (student_id, class_id, activity_id) do nothing;
    get diagnostics v_n = row_count;
    v_count := v_count + v_n;
  end loop;
  return jsonb_build_object('imported', v_count);
end;
$$;
