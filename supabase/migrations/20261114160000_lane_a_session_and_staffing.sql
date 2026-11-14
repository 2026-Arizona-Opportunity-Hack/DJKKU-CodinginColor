-- Lane A: who am I (session) and who teaches which class (staffing).
--   get_me                  the signed-in user's role and class, for the player and the sign-in redirect
--   add_class_instructor    admin puts an existing instructor on an existing class
--   remove_class_instructor admin takes one off again
-- Added as a new migration; the earlier ones are not edited. Every function here is security
-- definer with an empty search_path, checks auth.uid() inside, and is granted explicitly
-- (Supabase hands new objects to anon by default, so each one is revoked first).

-- Anyone signed in (including an anonymous student session) may call this; it only ever reads the
-- caller's own rows. Returns NULL when there is no signed-in user. A student who has not claimed a
-- seat yet is role 'student' with no class. Staff never get a class here (they pick from their classes).
create function public.get_me() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_p public.profiles%rowtype;
  v_seat_name text;
  v_class_id uuid;
  v_class_name text;
begin
  if v_uid is null then return null; end if;
  select * into v_p from public.profiles p where p.id = v_uid;
  if not found then return null; end if;

  if v_p.role in ('student', 'independent_student') then
    select cm.display_name, c.id, c.name into v_seat_name, v_class_id, v_class_name
    from public.class_members cm join public.classes c on c.id = cm.class_id
    where cm.profile_id = v_uid and cm.member_role = 'student'
    order by cm.claimed_at desc nulls last, cm.created_at desc
    limit 1;
  end if;

  return jsonb_build_object(
    'profile_id', v_p.id,
    'role', v_p.role,
    'can_author', v_p.can_author,
    'display_name', coalesce(v_seat_name, v_p.display_name),
    'class_id', v_class_id,
    'class_name', v_class_name
  );
end;
$$;

-- CIC admins only. Classes are created with the creator as instructor, so when an admin sets one
-- up (or for the seeded demo classes) no teacher can see it until an admin adds them here.
-- Idempotent: adding someone who is already an instructor of the class does nothing.
create function public.add_class_instructor(p_class_id uuid, p_profile_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_role text;
  v_name text;
begin
  if not public.is_admin() then raise exception 'Only a CIC admin can add instructors'; end if;
  if not exists (select 1 from public.classes c where c.id = p_class_id) then raise exception 'Class not found'; end if;
  select p.role, coalesce(nullif(btrim(p.display_name), ''), 'Instructor') into v_role, v_name
  from public.profiles p where p.id = p_profile_id;
  if v_role is null or v_role not in ('instructor', 'cic_admin') then
    raise exception 'That person is not an instructor yet. Invite them as an instructor first';
  end if;
  if exists (select 1 from public.class_members cm
             where cm.class_id = p_class_id and cm.profile_id = p_profile_id and cm.member_role = 'student') then
    raise exception 'That person is a student in this class';
  end if;
  insert into public.class_members (class_id, profile_id, member_role, display_name, claimed_at)
  values (p_class_id, p_profile_id, 'instructor', v_name, now())
  on conflict (class_id, profile_id) where profile_id is not null do nothing;
end;
$$;

-- CIC admins only. Takes an instructor off a class. A school class always keeps at least one
-- instructor, so it can never end up with nobody able to see it. Removing someone who is not an
-- instructor of the class does nothing.
create function public.remove_class_instructor(p_class_id uuid, p_profile_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_kind text;
begin
  if not public.is_admin() then raise exception 'Only a CIC admin can remove instructors'; end if;
  select c.kind into v_kind from public.classes c where c.id = p_class_id for update;   -- lock: two removals cannot both pass the check
  if v_kind is null then raise exception 'Class not found'; end if;
  if not exists (select 1 from public.class_members cm
                 where cm.class_id = p_class_id and cm.profile_id = p_profile_id and cm.member_role = 'instructor') then
    return;
  end if;
  if v_kind = 'school' and not exists (select 1 from public.class_members cm
                                       where cm.class_id = p_class_id and cm.member_role = 'instructor' and cm.profile_id <> p_profile_id) then
    raise exception 'A class needs at least one instructor';
  end if;
  delete from public.class_members where class_id = p_class_id and profile_id = p_profile_id and member_role = 'instructor';
end;
$$;

revoke all on function public.get_me(), public.add_class_instructor(uuid, uuid), public.remove_class_instructor(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.get_me(), public.add_class_instructor(uuid, uuid), public.remove_class_instructor(uuid, uuid)
  to authenticated;
