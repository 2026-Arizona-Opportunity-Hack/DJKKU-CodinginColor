-- My notebook: a student's own words about an activity.
--
-- Explaining something in your own words helps you learn it (the self-explanation effect,
-- Chi et al. 1994), so every activity gets a short "Explain it in your own words" box, and the
-- notebook page collects them for review before the post-test.
--
-- Notes are private to the student. There is no client policy on the table and no read path for
-- instructors, mentors or admins: students write more honestly when nobody grades it, and no new
-- student data becomes visible to staff. Stored in the database, not the browser, because
-- classroom Chromebooks are shared and a note left in local storage would show to the next student.

create table public.student_notes (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  activity_id uuid not null references public.activities (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  updated_at timestamptz not null default now(),
  primary key (profile_id, activity_id)
);

alter table public.student_notes enable row level security;
revoke all on table public.student_notes from public, anon, authenticated;

-- Saves (or, with an empty body, deletes) the caller's note on an activity they can read.
create function public.save_note(p_activity_id uuid, p_body text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_module uuid;
  v_body text := btrim(coalesce(p_body, ''));
begin
  if v_uid is null then raise exception 'Sign in first'; end if;
  if not exists (select 1 from public.profiles p where p.id = v_uid and p.role in ('student', 'independent_student')) then
    raise exception 'Only students keep a notebook';
  end if;
  if char_length(v_body) > 2000 then raise exception 'Keep a note under 2000 characters'; end if;

  select l.module_id into v_module
  from public.activities a join public.lessons l on l.id = a.lesson_id where a.id = p_activity_id;
  if not found or not public.can_read_module(v_module) then raise exception 'Activity not found'; end if;

  if v_body = '' then
    delete from public.student_notes where profile_id = v_uid and activity_id = p_activity_id;
    return jsonb_build_object('activity_id', p_activity_id, 'body', '', 'updated_at', null);
  end if;

  insert into public.student_notes (profile_id, activity_id, body, updated_at)
  values (v_uid, p_activity_id, v_body, now())
  on conflict (profile_id, activity_id) do update set body = excluded.body, updated_at = excluded.updated_at;
  return jsonb_build_object('activity_id', p_activity_id, 'body', v_body, 'updated_at', now());
end;
$$;

-- The caller's notes, in course order, with the titles the notebook page shows.
create function public.get_my_notes() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Sign in first'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'activity_id', a.id, 'activity_title', a.title, 'kind', a.kind,
      'lesson_title', l.title, 'module_id', m.id, 'module_title', m.title,
      'body', n.body, 'updated_at', n.updated_at
    ) order by m.title, l.position, a.position)
    from public.student_notes n
    join public.activities a on a.id = n.activity_id
    join public.lessons l on l.id = a.lesson_id
    join public.modules m on m.id = l.module_id
    where n.profile_id = v_uid
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.save_note(uuid, text) from public, anon, authenticated;
revoke all on function public.get_my_notes() from public, anon, authenticated;
grant execute on function public.save_note(uuid, text) to authenticated;
grant execute on function public.get_my_notes() to authenticated;
