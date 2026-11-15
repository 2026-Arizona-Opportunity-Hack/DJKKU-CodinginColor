-- Code activities (Python in the browser, PRIMM style: predict, run, then modify until the checks pass).
--   content: { prompt (markdown), starter (code), predict? (a question to answer before running),
--              tests: ["assert ...", ...] }   The checks are visible on purpose: they are the goal.
--   response to submit_answer: { code, passed, total, prediction? }
-- The code runs in the student's browser, so a code activity is formative practice; scored evidence of
-- learning stays the pre-test and post-test. This is stated in SECURITY.md and the contract.

alter table public.activities drop constraint activities_kind_check;
alter table public.activities add constraint activities_kind_check
  check (kind in ('video', 'reading', 'check', 'worksheet', 'exit', 'code'));

alter table public.activities drop constraint activities_content_shape;
-- Wrapped in coalesce: a missing field makes a test NULL, and a CHECK treats NULL as passing. The original
-- version had that hole too (a video with no embedUrl was accepted); this closes it for every kind.
alter table public.activities add constraint activities_content_shape check (
  coalesce(
    case kind
      when 'video' then (content ->> 'embedUrl') like 'https://www.youtube-nocookie.com/embed/%'
      when 'reading' then jsonb_typeof(content -> 'body') = 'string'
      when 'code' then jsonb_typeof(content -> 'prompt') = 'string' and jsonb_typeof(content -> 'starter') = 'string'
                       and jsonb_typeof(content -> 'tests') = 'array' and jsonb_array_length(content -> 'tests') <= 10
                       and char_length(content ->> 'starter') <= 10000
      else jsonb_typeof(content -> 'questions') = 'array'
    end,
    false
  )
);

-- submit_answer, unchanged except for the code branch and completing a code activity only when every check passes.
create or replace function public.submit_answer(p_activity_id uuid, p_response jsonb, p_class_id uuid default null)
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
  v_passed int;
  v_total int;
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
  elsif v_act.kind = 'code' then
    -- The code runs in the student's browser (Pyodide), so this records practice, not proof: the
    -- pre-test and post-test stay the measure of learning. The counts must match this activity's tests.
    if jsonb_typeof(p_response -> 'code') is distinct from 'string' or char_length(p_response ->> 'code') > 10000
       or jsonb_typeof(p_response -> 'passed') is distinct from 'number' or jsonb_typeof(p_response -> 'total') is distinct from 'number' then
      raise exception 'Send your code and how many of the checks passed';
    end if;
    v_total := (p_response ->> 'total')::int;
    v_passed := (p_response ->> 'passed')::int;
    if v_total <> jsonb_array_length(coalesce(v_act.content -> 'tests', '[]'::jsonb)) or v_passed < 0 or v_passed > v_total then
      raise exception 'Those results do not match the checks in this activity';
    end if;
    v_scored := 1;
    v_all_correct := v_passed = v_total;
    v_correct := case when v_all_correct then 1 else 0 end;
    v_score := case when v_total = 0 then 100 else round(100.0 * v_passed / v_total, 2) end;
    v_hint := case when not v_all_correct then format('%s of %s checks pass. Read the first failing check and run your code again.', v_passed, v_total) end;
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

  v_completed := case when v_act.kind in ('check', 'code') then v_all_correct else true end;

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
