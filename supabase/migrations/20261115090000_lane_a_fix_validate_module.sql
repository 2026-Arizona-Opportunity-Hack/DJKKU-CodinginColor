-- Fix: _validate_module appended two plain string literals to a text[] with ||. Postgres reads an
-- untyped literal next to an array as an array literal, so a module with no lessons, or with no pre
-- or post test, made submit_module and publish_module fail with "malformed array literal" instead
-- of returning the error or warning. array_append takes the literal as one text element.
-- Same function otherwise; it stays internal (no client can execute it, as before).

create or replace function public._validate_module(p_module_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_errors text[] := '{}';
  v_warn text[] := '{}';
  r record;
  q jsonb;
  v_msg text;
  v_key jsonb;
begin
  if not exists (select 1 from public.lessons where module_id = p_module_id) then
    v_errors := array_append(v_errors, 'Add at least one lesson');
  end if;
  for r in select l.title as lt, l.id as lid from public.lessons l where l.module_id = p_module_id
           and not exists (select 1 from public.activities a where a.lesson_id = l.id) loop
    v_errors := v_errors || format('Lesson "%s" has no activities', r.lt);
  end loop;

  for r in select a.id, a.title, a.kind, a.content from public.activities a join public.lessons l on l.id = a.lesson_id
           where l.module_id = p_module_id and a.kind in ('check', 'worksheet', 'exit') loop
    for q in select value from jsonb_array_elements(r.content -> 'questions') loop
      select k.key into v_key from public.activity_keys k where k.activity_id = r.id and k.question_id = q ->> 'id';
      v_msg := public._check_question(q, v_key);
      if v_msg is not null then v_errors := v_errors || format('"%s", question "%s": %s', r.title, q ->> 'id', v_msg); end if;
    end loop;
    if exists (select 1 from public.activity_keys k where k.activity_id = r.id
               and not exists (select 1 from jsonb_array_elements(r.content -> 'questions') x where x ->> 'id' = k.question_id)) then
      v_errors := v_errors || format('"%s" has an answer key for a question that does not exist', r.title);
    end if;
  end loop;

  for r in select i.pair_key, i.content, a.kind, k.key from public.assessment_items i
           join public.assessments a on a.id = i.assessment_id left join public.assessment_keys k on k.assessment_item_id = i.id
           where a.module_id = p_module_id loop
    v_msg := public._check_question(r.content, r.key);
    if r.content ->> 'type' = 'reflection' then v_msg := 'a test cannot contain an unscored reflection'; end if;
    if v_msg is not null then v_errors := v_errors || format('%s-test item "%s": %s', r.kind, r.pair_key, v_msg); end if;
  end loop;

  -- Pairing is a warning, not a blocker: unpaired items just do not count toward gain (ADR 0020).
  for r in select i.pair_key, a.kind from public.assessment_items i join public.assessments a on a.id = i.assessment_id
           where a.module_id = p_module_id loop
    if not exists (select 1 from public.assessment_items i2 join public.assessments a2 on a2.id = i2.assessment_id
                   where a2.module_id = p_module_id and a2.kind <> r.kind and i2.pair_key = r.pair_key) then
      v_warn := v_warn || format('%s-test item "%s" has no matching item on the other test, so it will not count toward gain', r.kind, r.pair_key);
    end if;
  end loop;
  if not exists (select 1 from public.assessments where module_id = p_module_id) then
    v_warn := array_append(v_warn, 'This module has no pre or post test, so it will have no learning gain');
  end if;
  return jsonb_build_object('errors', to_jsonb(v_errors), 'warnings', to_jsonb(v_warn));
end;
$$;

revoke all on function public._validate_module(uuid) from public, anon, authenticated;
