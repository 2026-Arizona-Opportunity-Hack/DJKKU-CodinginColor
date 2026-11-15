-- Removing a staff member, and cancelling an invite nobody used.
--
-- "Remove" takes away access; it does not delete the account. The person becomes a plain account
-- with no staff rights (role student, no class seat, so the sign-in page tells them they are not
-- invited and signs them out), is taken off the classes they teach, and their mentor assignments
-- end. Everything they made stays: modules (published ones keep running), API keys (they belong to
-- the consumer), notes and history. Inviting the same email again restores them.
--
-- Rules: CIC admins only; never yourself (so at least one admin always remains); only staff can be
-- removed. A class can be left without an instructor; the dry run lists those classes so the admin
-- is warned first, and an admin adds a new instructor under Class staffing.

create function public.remove_staff(p_profile_id uuid, p_dry_run boolean default false) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_role text;
  v_email text;
  v_orphaned jsonb;
begin
  if not public.is_admin() then raise exception 'Only a CIC admin can remove staff'; end if;
  if p_profile_id = auth.uid() then raise exception 'You cannot remove yourself'; end if;
  select role into v_role from public.profiles where id = p_profile_id;
  if v_role is null then raise exception 'Profile not found'; end if;
  if v_role not in ('mentor', 'instructor', 'cic_admin', 'reviewer') then raise exception 'That person is not staff'; end if;

  -- Classes this person teaches alone: they will have no instructor afterwards.
  select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name) order by c.name), '[]'::jsonb) into v_orphaned
  from public.class_members m join public.classes c on c.id = m.class_id
  where m.profile_id = p_profile_id and m.member_role = 'instructor'
    and not exists (
      select 1 from public.class_members o
      where o.class_id = m.class_id and o.member_role = 'instructor' and o.profile_id <> p_profile_id
    );
  if p_dry_run then
    return jsonb_build_object('classes_left_without_instructor', v_orphaned);
  end if;

  delete from public.class_members where profile_id = p_profile_id and member_role = 'instructor';
  update public.mentor_assignments set active = false where mentor_id = p_profile_id and active;
  select lower(email) into v_email from auth.users where id = p_profile_id;
  if v_email is not null then delete from public.staff_invites where email = v_email; end if;
  update public.profiles set role = 'student', can_author = false where id = p_profile_id;

  return jsonb_build_object('classes_left_without_instructor', v_orphaned);
end;
$$;

-- An invite that was never used (wrong email, or the person did not join). A used one is history;
-- to take access away from someone who joined, remove them instead.
create function public.cancel_staff_invite(p_email text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Only a CIC admin can cancel invites'; end if;
  delete from public.staff_invites where email = lower(btrim(coalesce(p_email, ''))) and accepted_at is null;
  if not found then raise exception 'There is no unused invite for that email'; end if;
end;
$$;

revoke all on function public.remove_staff(uuid, boolean), public.cancel_staff_invite(text) from public, anon;
grant execute on function public.remove_staff(uuid, boolean), public.cancel_staff_invite(text) to authenticated;
