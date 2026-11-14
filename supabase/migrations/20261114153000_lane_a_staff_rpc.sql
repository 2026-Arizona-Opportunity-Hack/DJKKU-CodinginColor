-- Lane A staff and admin RPCs: classes, rosters, authoring, publishing, keys, admin.
-- Clients have no INSERT/UPDATE/DELETE on any of these tables, so these functions are the
-- audited write path. Each checks auth.uid() against the role helpers before doing anything.

-- ---------- classes and rosters (lane D) ----------

-- Instructors and admins create classes. Only an admin can add a new school; an instructor
-- picks one that already exists (admins "onboard schools" per the plan).
create function public.create_class(p_school_name text, p_name text, p_term text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_school uuid;
  v_class uuid;
  v_name text;
begin
  if not exists (select 1 from public.profiles p where p.id = v_uid and p.role in ('instructor', 'cic_admin')) then
    raise exception 'Only instructors and CIC admins can create classes';
  end if;
  select s.id into v_school from public.schools s where lower(s.name) = lower(btrim(coalesce(p_school_name, '')));
  if v_school is null then
    if not public.is_admin() then raise exception 'That school is not set up yet. Ask a CIC admin to add it.'; end if;
    insert into public.schools (name) values (btrim(p_school_name)) returning id into v_school;
  end if;
  insert into public.classes (school_id, name, term, kind, created_by)
  values (v_school, btrim(p_name), nullif(btrim(coalesce(p_term, '')), ''), 'school', v_uid)
  returning id into v_class;
  select coalesce(nullif(p.display_name, ''), 'Instructor') into v_name from public.profiles p where p.id = v_uid;
  insert into public.class_members (class_id, profile_id, member_role, display_name, claimed_at)
  values (v_class, v_uid, 'instructor', v_name, now());
  return jsonb_build_object('class_id', v_class);
end;
$$;

-- Returns the join code ONCE; only its hash is stored. Calling again replaces the old code.
create function public.create_join_code(p_class_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_code text := public._new_code(6);
begin
  if not public.can_edit_class(p_class_id) then raise exception 'Not allowed to manage this class'; end if;
  if not exists (select 1 from public.classes where id = p_class_id and kind = 'school') then raise exception 'Class not found'; end if;
  insert into public.class_join_codes (class_id, code_hash) values (p_class_id, public._code_hash(v_code))
  on conflict (class_id) do update set code_hash = excluded.code_hash, created_at = now();
  return jsonb_build_object('join_code', v_code);
end;
$$;

-- Bulk roster import (names only: minors). All or nothing, so one bad row imports nothing.
-- Returns each student's one-time login code, to print on cards. Codes are never stored in clear.
create function public.import_roster(p_class_id uuid, p_names jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_name text;
  v_code text;
  v_member uuid;
  v_out jsonb := '[]'::jsonb;
  v_seen text[] := '{}';
begin
  if not public.can_edit_class(p_class_id) then raise exception 'Not allowed to manage this class'; end if;
  if not exists (select 1 from public.classes c where c.id = p_class_id and c.kind = 'school') then
    raise exception 'Rosters can only be imported into a school class';
  end if;
  if jsonb_typeof(p_names) is distinct from 'array' or jsonb_array_length(p_names) not between 1 and 300 then
    raise exception 'Send between 1 and 300 names';
  end if;

  for v_name in select jsonb_array_elements_text(p_names) loop
    v_name := regexp_replace(btrim(v_name), '\s+', ' ', 'g');
    if char_length(v_name) not between 1 and 80 then raise exception 'Name "%" must be 1 to 80 characters', left(v_name, 20); end if;
    if v_name like '%@%' then raise exception 'Names only, no emails (row "%")', left(v_name, 20); end if;
    if lower(v_name) = any (v_seen) or exists (
      select 1 from public.class_members cm
      where cm.class_id = p_class_id and cm.member_role = 'student' and lower(cm.display_name) = lower(v_name)
    ) then
      raise exception 'Duplicate name: %', v_name;
    end if;
    v_seen := v_seen || lower(v_name);
    v_code := public._new_code(8);
    insert into public.class_members (class_id, member_role, display_name)
    values (p_class_id, 'student', v_name)
    returning id into v_member;
    insert into public.member_login_codes (member_id, code_hash) values (v_member, public._code_hash(v_code));
    v_out := v_out || jsonb_build_object('member_id', v_member, 'display_name', v_name, 'login_code', v_code);
  end loop;
  return v_out;
end;
$$;

-- Lost code: the class instructor, a CIC admin, or the student's mentor issues a new one.
-- The old device keeps working until the new code is claimed, then the data moves over.
create function public.reset_login_code(p_member_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_m public.class_members%rowtype;
  v_code text := public._new_code(8);
begin
  select * into v_m from public.class_members where id = p_member_id and member_role = 'student';
  if not found then raise exception 'Student not found'; end if;
  if not (public.can_edit_class(v_m.class_id) or (v_m.profile_id is not null and public.is_mentor_of(v_m.profile_id))) then
    raise exception 'Not allowed to reset this code';
  end if;
  insert into public.member_login_codes (member_id, code_hash) values (v_m.id, public._code_hash(v_code))
  on conflict (member_id) do update set code_hash = excluded.code_hash, created_at = now();
  return jsonb_build_object('login_code', v_code);
end;
$$;

-- Let a student retake a test (instructor or admin). Deletes the result and the item answers.
create function public.reset_assessment_result(p_student_id uuid, p_class_id uuid, p_assessment_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.can_edit_class(p_class_id) then raise exception 'Not allowed to manage this class'; end if;
  delete from public.assessment_responses r using public.assessment_items i
  where r.assessment_item_id = i.id and i.assessment_id = p_assessment_id
    and r.student_id = p_student_id and r.class_id = p_class_id;
  delete from public.assessment_results
  where student_id = p_student_id and class_id = p_class_id and assessment_id = p_assessment_id;
end;
$$;

create function public.assign_module(p_class_id uuid, p_module_id uuid, p_opens_at timestamptz default now()) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
begin
  if not public.can_edit_class(p_class_id) then raise exception 'Not allowed to manage this class'; end if;
  insert into public.class_modules (class_id, module_id, position, opens_at)
  values (p_class_id, p_module_id,
          coalesce((select max(cm.position) + 1 from public.class_modules cm where cm.class_id = p_class_id), 0),
          coalesce(p_opens_at, now()))
  returning id into v_id;       -- the trigger rejects anything that is not published
  return jsonb_build_object('class_module_id', v_id);
end;
$$;

-- ---------- authoring (lane C studio) ----------

create function public.upsert_concept(p_id text, p_name text, p_description text default null) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_author() then raise exception 'Only authors can manage concepts'; end if;
  insert into public.concepts (id, name, description) values (p_id, btrim(p_name), p_description)
  on conflict (id) do update set name = excluded.name, description = excluded.description;
end;
$$;

-- One message per problem; null when the question and its key agree.
create function public._check_question(p_content jsonb, p_key jsonb) returns text
language plpgsql immutable set search_path = '' as $$
declare
  v_type text := p_content ->> 'type';
  v_n int;
  v_shown text[];
  v_sorted text[];
  v_correct text[];
begin
  if v_type = 'reflection' then
    return case when p_key is null then null else 'a reflection is unscored and cannot have a key' end;
  end if;
  if (p_content ->> 'conceptId') is null then return 'is missing a concept tag'; end if;
  if p_key is null then return 'has no answer key'; end if;
  if p_key ->> 'type' is distinct from v_type then return 'answer key does not match the question type'; end if;

  if v_type = 'mcq' then
    if not exists (select 1 from jsonb_array_elements(p_content -> 'choices') c where c ->> 'id' = p_key ->> 'correctChoiceId') then
      return 'correct answer is not one of the choices';
    end if;
  elsif v_type = 'fill_blank' then
    v_n := (char_length(p_content ->> 'prompt') - char_length(replace(p_content ->> 'prompt', '___', ''))) / 3;
    if v_n < 1 or v_n <> jsonb_array_length(p_key -> 'blanks') then
      return format('has %s blank(s) but %s answer set(s)', v_n, jsonb_array_length(p_key -> 'blanks'));
    end if;
  elsif v_type = 'ordering' then
    select array_agg(x.id order by x.ord), array_agg(x.id order by x.id) into v_shown, v_sorted
    from (select i ->> 'id' as id, ord from jsonb_array_elements(p_content -> 'items') with ordinality t(i, ord)) x;
    select array_agg(v) into v_correct from jsonb_array_elements_text(p_key -> 'correctOrder') v;
    if v_sorted is distinct from (select array_agg(x order by x) from unnest(v_correct) x) then
      return 'correct order must list every item exactly once';
    end if;
    if v_shown = v_correct then return 'items are displayed in the solved order'; end if;
  end if;
  return null;
end;
$$;

-- Everything wrong with a module, as {errors:[], warnings:[]}. Errors block submit and publish.
create function public._validate_module(p_module_id uuid) returns jsonb
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
    v_errors := v_errors || 'Add at least one lesson';
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
    v_warn := v_warn || 'This module has no pre or post test, so it will have no learning gain';
  end if;
  return jsonb_build_object('errors', to_jsonb(v_errors), 'warnings', to_jsonb(v_warn));
end;
$$;

-- Save a whole module draft in one transaction. The payload is exactly what the studio builds:
--   { module_id?, slug, title, summary,
--     lessons: [ { title, activities: [ { kind, title, required, concept_id?,
--                  content: <student-safe, from splitModule>,
--                  keys: [ { question_id, key } ] } ] } ],
--     assessments: [ { kind: 'pre'|'post', title,
--                  items: [ { pair_key, concept_id, question_id, content, key } ] } ] }
-- Positions come from array order. Existing children are replaced. Only the owner (or an
-- admin) of a DRAFT can save; the database refuses anything else.
create function public.save_module_draft(p_module jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid := nullif(p_module ->> 'module_id', '')::uuid;
  v_lesson jsonb;
  v_act jsonb;
  v_key jsonb;
  v_test jsonb;
  v_item jsonb;
  v_lid uuid;
  v_aid uuid;
  v_tid uuid;
  v_iid uuid;
  v_li int;
  v_ai int;
  v_ii int;
begin
  if not public.is_author() then raise exception 'You are not allowed to author modules'; end if;
  if jsonb_typeof(p_module) is distinct from 'object' or pg_column_size(p_module) > 2000000 then
    raise exception 'That module is not valid or is too large';
  end if;
  if jsonb_typeof(p_module -> 'lessons') is distinct from 'array' or jsonb_array_length(p_module -> 'lessons') > 20 then
    raise exception 'A module needs a lessons array with at most 20 lessons';
  end if;

  if v_id is null then
    insert into public.modules (slug, title, summary, created_by)
    values (p_module ->> 'slug', btrim(p_module ->> 'title'), coalesce(btrim(p_module ->> 'summary'), ''), v_uid)
    returning id into v_id;
  else
    perform 1 from public.modules where id = v_id for update;
    if not public.can_edit_module(v_id) then
      raise exception 'Only the owner can edit a draft module (published and submitted modules are locked)';
    end if;
    update public.modules set title = btrim(p_module ->> 'title'), summary = coalesce(btrim(p_module ->> 'summary'), '')
    where id = v_id;
    delete from public.lessons where module_id = v_id;
    delete from public.assessments where module_id = v_id;
  end if;

  for v_lesson, v_li in select value, ordinality - 1 from jsonb_array_elements(p_module -> 'lessons') with ordinality loop
    insert into public.lessons (module_id, position, title) values (v_id, v_li, btrim(v_lesson ->> 'title')) returning id into v_lid;
    if jsonb_array_length(coalesce(v_lesson -> 'activities', '[]'::jsonb)) > 30 then raise exception 'At most 30 activities per lesson'; end if;
    for v_act, v_ai in select value, ordinality - 1 from jsonb_array_elements(coalesce(v_lesson -> 'activities', '[]'::jsonb)) with ordinality loop
      insert into public.activities (lesson_id, position, kind, title, content, required, concept_id)
      values (v_lid, v_ai, v_act ->> 'kind', btrim(v_act ->> 'title'), v_act -> 'content',
              coalesce((v_act ->> 'required')::boolean, true), nullif(v_act ->> 'concept_id', ''))
      returning id into v_aid;
      for v_key in select value from jsonb_array_elements(coalesce(v_act -> 'keys', '[]'::jsonb)) loop
        insert into public.activity_keys (activity_id, question_id, key) values (v_aid, v_key ->> 'question_id', v_key -> 'key');
      end loop;
    end loop;
  end loop;

  for v_test in select value from jsonb_array_elements(coalesce(p_module -> 'assessments', '[]'::jsonb)) loop
    insert into public.assessments (module_id, kind, title) values (v_id, v_test ->> 'kind', btrim(v_test ->> 'title')) returning id into v_tid;
    if jsonb_array_length(coalesce(v_test -> 'items', '[]'::jsonb)) > 50 then raise exception 'At most 50 items per test'; end if;
    for v_item, v_ii in select value, ordinality - 1 from jsonb_array_elements(coalesce(v_test -> 'items', '[]'::jsonb)) with ordinality loop
      insert into public.assessment_items (assessment_id, position, pair_key, concept_id, question_id, content)
      values (v_tid, v_ii, v_item ->> 'pair_key', v_item ->> 'concept_id', v_item ->> 'question_id', v_item -> 'content')
      returning id into v_iid;
      insert into public.assessment_keys (assessment_item_id, key) values (v_iid, v_item -> 'key');
    end loop;
  end loop;
  return v_id;
end;
$$;

-- Owner sends a finished draft for review. Locks it against further edits.
create function public.submit_module(p_module_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_check jsonb;
begin
  if not public.can_edit_module(p_module_id) then raise exception 'Only the owner of a draft can submit it'; end if;
  v_check := public._validate_module(p_module_id);
  if jsonb_array_length(v_check -> 'errors') > 0 then
    raise exception 'Fix these first: %', (select string_agg(e, '; ') from jsonb_array_elements_text(v_check -> 'errors') e);
  end if;
  update public.modules set status = 'submitted' where id = p_module_id;
  return v_check;
end;
$$;

-- Only a CIC admin publishes. Creates the immutable version and (via the trigger) freezes it.
create function public.publish_module(p_module_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_check jsonb;
begin
  if not public.is_admin() then raise exception 'Only a CIC admin can publish'; end if;
  perform 1 from public.modules where id = p_module_id and status in ('draft', 'submitted') for update;
  if not found then raise exception 'Only a draft or submitted module can be published'; end if;
  v_check := public._validate_module(p_module_id);
  if jsonb_array_length(v_check -> 'errors') > 0 then
    raise exception 'Fix these first: %', (select string_agg(e, '; ') from jsonb_array_elements_text(v_check -> 'errors') e);
  end if;
  update public.modules set status = 'published', published_at = now() where id = p_module_id;
  return v_check;
end;
$$;

create function public.return_module_to_draft(p_module_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Only a CIC admin can send a module back'; end if;
  update public.modules set status = 'draft' where id = p_module_id and status = 'submitted';
  if not found then raise exception 'Only a submitted module can be sent back'; end if;
end;
$$;

-- Published versions never change. To edit one, copy it to version + 1 as a new draft.
create function public.new_module_version(p_module_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_src public.modules%rowtype;
  v_new uuid;
  v_l record;
  v_a record;
  v_t record;
  v_i record;
  v_lid uuid;
  v_aid uuid;
  v_tid uuid;
  v_iid uuid;
begin
  if not public.is_author() then raise exception 'You are not allowed to author modules'; end if;
  select * into v_src from public.modules where id = p_module_id and status = 'published';
  if not found then raise exception 'Only a published module can be copied to a new version'; end if;
  if exists (select 1 from public.modules m where m.slug = v_src.slug and m.status <> 'published') then
    raise exception 'There is already a draft of the next version of this module';
  end if;
  insert into public.modules (slug, version, title, summary, created_by)
  values (v_src.slug, (select max(version) + 1 from public.modules where slug = v_src.slug), v_src.title, v_src.summary, auth.uid())
  returning id into v_new;

  for v_l in select * from public.lessons where module_id = p_module_id loop
    insert into public.lessons (module_id, position, title) values (v_new, v_l.position, v_l.title) returning id into v_lid;
    for v_a in select * from public.activities where lesson_id = v_l.id loop
      insert into public.activities (lesson_id, position, kind, title, content, required, concept_id)
      values (v_lid, v_a.position, v_a.kind, v_a.title, v_a.content, v_a.required, v_a.concept_id) returning id into v_aid;
      insert into public.activity_keys (activity_id, question_id, key)
      select v_aid, k.question_id, k.key from public.activity_keys k where k.activity_id = v_a.id;
    end loop;
  end loop;
  for v_t in select * from public.assessments where module_id = p_module_id loop
    insert into public.assessments (module_id, kind, title) values (v_new, v_t.kind, v_t.title) returning id into v_tid;
    for v_i in select * from public.assessment_items where assessment_id = v_t.id loop
      insert into public.assessment_items (assessment_id, position, pair_key, concept_id, question_id, content)
      values (v_tid, v_i.position, v_i.pair_key, v_i.concept_id, v_i.question_id, v_i.content) returning id into v_iid;
      insert into public.assessment_keys (assessment_item_id, key)
      select v_iid, k.key from public.assessment_keys k where k.assessment_item_id = v_i.id;
    end loop;
  end loop;
  return v_new;
end;
$$;

-- Keys for the editor, the instructor's answer view and mentors. See can_read_keys().
create function public.get_activity_keys(p_activity_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_module uuid;
begin
  select l.module_id into v_module from public.activities a join public.lessons l on l.id = a.lesson_id where a.id = p_activity_id;
  if v_module is null or not public.can_read_keys(v_module) then raise exception 'Not allowed to read these answer keys'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('question_id', k.question_id, 'key', k.key) order by k.question_id)
                   from public.activity_keys k where k.activity_id = p_activity_id), '[]'::jsonb);
end;
$$;

create function public.get_assessment_keys(p_assessment_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_module uuid;
begin
  select a.module_id into v_module from public.assessments a where a.id = p_assessment_id;
  if v_module is null or not public.can_read_keys(v_module) then raise exception 'Not allowed to read these answer keys'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('question_id', i.question_id, 'pair_key', i.pair_key,
                      'concept_id', i.concept_id, 'key', k.key) order by i.position)
                   from public.assessment_items i join public.assessment_keys k on k.assessment_item_id = i.id
                   where i.assessment_id = p_assessment_id), '[]'::jsonb);
end;
$$;

-- ---------- admin console (lane D) ----------

-- Invite staff by email. When they sign in with a verified Google account that matches, they
-- get this role. If they already have an account it applies right away. Bootstrap: the very
-- first admin is set by hand in the Supabase SQL editor (see supabase/README.md).
create function public.invite_staff(p_email text, p_role text, p_can_author boolean default false) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_user uuid;
begin
  if not public.is_admin() then raise exception 'Only a CIC admin can invite staff'; end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(v_email) > 254 then raise exception 'Enter a valid email address'; end if;
  if p_role not in ('mentor', 'instructor', 'cic_admin', 'reviewer') then raise exception 'Invalid role'; end if;
  insert into public.staff_invites (email, role, can_author, invited_by) values (v_email, p_role, coalesce(p_can_author, false), auth.uid())
  on conflict (email) do update set role = excluded.role, can_author = excluded.can_author, invited_by = excluded.invited_by, accepted_at = null;

  select u.id into v_user from auth.users u
  where lower(u.email) = v_email and u.email_confirmed_at is not null and u.raw_app_meta_data ->> 'provider' = 'google';
  if v_user is not null then
    update public.profiles set role = p_role, can_author = coalesce(p_can_author, false) where id = v_user;
    update public.staff_invites set accepted_at = now() where email = v_email;
  end if;
end;
$$;

create function public.set_profile_role(p_profile_id uuid, p_role text, p_can_author boolean default false) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Only a CIC admin can change roles'; end if;
  if p_profile_id = auth.uid() then raise exception 'You cannot change your own role'; end if;
  if p_role not in ('student', 'independent_student', 'mentor', 'instructor', 'cic_admin', 'reviewer') then raise exception 'Invalid role'; end if;
  update public.profiles set role = p_role, can_author = coalesce(p_can_author, false) where id = p_profile_id;
  if not found then raise exception 'Profile not found'; end if;
end;
$$;

-- Mentors see only the students an admin assigns them. Set p_active false to end it.
create function public.assign_mentor(p_mentor_id uuid, p_student_id uuid, p_active boolean default true) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Only a CIC admin can assign mentors'; end if;
  if not exists (select 1 from public.profiles where id = p_mentor_id and role = 'mentor') then raise exception 'That person is not an approved mentor'; end if;
  if not exists (select 1 from public.profiles where id = p_student_id and role in ('student', 'independent_student')) then raise exception 'That person is not a student'; end if;
  insert into public.mentor_assignments (mentor_id, student_id, assigned_by, active) values (p_mentor_id, p_student_id, auth.uid(), p_active)
  on conflict (mentor_id, student_id) do update set active = excluded.active, assigned_by = excluded.assigned_by;
end;
$$;

-- API keys: shown once, stored as a hash, scoped, revocable (plan decision 10).
create function public.create_api_key(p_name text, p_scope text[] default '{}') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_key text := 'oh_' || encode(extensions.gen_random_bytes(32), 'hex');
  v_id uuid;
begin
  if not public.is_admin() then raise exception 'Only a CIC admin can create API keys'; end if;
  insert into public.api_keys (name, scope, created_by) values (btrim(p_name), coalesce(p_scope, '{}'), auth.uid())
  returning id into v_id;
  insert into public.api_key_secrets (api_key_id, key_hash) values (v_id, encode(extensions.digest(v_key, 'sha256'), 'hex'));
  return jsonb_build_object('api_key_id', v_id, 'raw_key', v_key);
end;
$$;

create function public.revoke_api_key(p_api_key_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Only a CIC admin can revoke API keys'; end if;
  update public.api_keys set revoked_at = coalesce(revoked_at, now()) where id = p_api_key_id;
  if not found then raise exception 'API key not found'; end if;
end;
$$;

-- For the read API (lane E) only: service_role. Returns the key's scope, or NULL if unknown or revoked.
create function public.validate_api_key(p_raw_key text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_row public.api_keys%rowtype;
begin
  if p_raw_key is null or length(p_raw_key) < 20 then return null; end if;
  update public.api_keys k set last_used_at = now()
  from public.api_key_secrets sec
  where sec.api_key_id = k.id and sec.key_hash = encode(extensions.digest(p_raw_key, 'sha256'), 'hex') and k.revoked_at is null
  returning k.* into v_row;
  if not found then return null; end if;
  return jsonb_build_object('api_key_id', v_row.id, 'scope', to_jsonb(v_row.scope));
end;
$$;
