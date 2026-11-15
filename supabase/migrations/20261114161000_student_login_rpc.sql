begin;

create function public.student_login_context()
returns table (
  profile_id uuid,
  role text,
  display_name text,
  class_id uuid,
  class_name text,
  is_guest boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles%rowtype;
begin
  if auth.uid() is null then
    raise exception 'A signed-in student is required';
  end if;

  select p.* into v_profile
  from public.profiles p
  where p.id = auth.uid();

  if not found or v_profile.role not in ('student', 'independent_student') then
    raise exception 'Only students can read student login context';
  end if;

  return query
  select
    v_profile.id,
    v_profile.role,
    v_profile.display_name,
    cm.class_id,
    c.name,
    coalesce(auth.jwt() ->> 'is_anonymous' = 'true', false)
  from (select 1) as singleton
  left join public.class_members cm
    on cm.profile_id = v_profile.id and cm.member_role = 'student'
  left join public.classes c on c.id = cm.class_id;
end;
$$;

create function public.guest_sign_in(p_display_name text default 'Guest')
returns table (class_id uuid, display_name text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid := auth.uid();
  v_role text;
  v_class_id uuid;
  v_display_name text;
  v_existing_display_name text;
begin
  if v_profile_id is null or auth.jwt() ->> 'is_anonymous' is distinct from 'true' then
    raise exception 'Sign in anonymously through Supabase Auth before starting a guest session';
  end if;

  if p_display_name is not null and length(btrim(p_display_name)) > 80 then
    raise exception 'Guest display name must be 80 characters or fewer';
  end if;
  v_display_name := coalesce(nullif(btrim(p_display_name), ''), 'Guest');

  select p.role into v_role
  from public.profiles p
  where p.id = v_profile_id
  for update;

  if not found or v_role not in ('student', 'independent_student') then
    raise exception 'This account cannot start a guest session';
  end if;

  select cm.class_id, cm.display_name
  into v_class_id, v_existing_display_name
  from public.class_members cm
  join public.classes c on c.id = cm.class_id
  where cm.profile_id = v_profile_id
    and cm.member_role = 'student'
    and c.kind = 'open';

  if found then
    update public.profiles p
    set role = 'independent_student',
        display_name = v_existing_display_name
    where p.id = v_profile_id;

    return query select v_class_id, v_existing_display_name;
    return;
  end if;

  if exists (
    select 1 from public.class_members cm where cm.profile_id = v_profile_id
  ) then
    raise exception 'This account already belongs to a class';
  end if;

  select c.id into v_class_id
  from public.classes c
  where c.kind = 'open';

  if v_class_id is null then
    raise exception 'The CIC Open class has not been configured';
  end if;

  insert into public.class_members (
    class_id, profile_id, member_role, display_name, claimed_at
  )
  values (
    v_class_id, v_profile_id, 'student', v_display_name, now()
  );

  update public.profiles p
  set role = 'independent_student',
      display_name = v_display_name
  where p.id = v_profile_id;

  return query select v_class_id, v_display_name;
end;
$$;

comment on function public.student_login_context() is
  'Returns the signed-in student profile and class memberships after anonymous student sign-in.';
comment on function public.guest_sign_in(text) is
  'Finalizes an anonymous Supabase Auth session by enrolling the guest in CIC Open.';

grant execute on function public.student_login_context() to authenticated;
grant execute on function public.guest_sign_in(text) to authenticated;
revoke all on function public.student_login_context() from public, anon;
revoke all on function public.guest_sign_in(text) from public, anon;

commit;
