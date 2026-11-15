-- Invited staff became students on their first Google sign-in.
--
-- Supabase Auth creates a Google user first and marks the email confirmed in a later UPDATE.
-- handle_new_auth_user runs on INSERT and (rightly) only trusts a confirmed Google email, so at
-- that moment it skipped the invite. The invite only applied when an admin clicked "Invite staff"
-- again (invite_staff upgrades an existing confirmed account). Found on the hosted project on
-- 2026-11-15: a confirmed Google account with the invited email was still a student.
--
-- Fix: apply the pending invite when the email becomes confirmed, with the same rules as the
-- insert trigger (verified Google email, unused invite). It only upgrades a profile that is still a
-- plain student, so it never overwrites a role an admin set by hand.

create function public.apply_staff_invite_on_confirm() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_invite public.staff_invites%rowtype;
begin
  if new.email is null or new.email_confirmed_at is null
     or coalesce(new.raw_app_meta_data ->> 'provider', '') <> 'google' then
    return new;
  end if;
  select * into v_invite from public.staff_invites where email = lower(new.email) and accepted_at is null;
  if v_invite.email is null then
    return new;
  end if;
  update public.profiles set role = v_invite.role, can_author = coalesce(v_invite.can_author, false)
  where id = new.id and role = 'student';
  if found then
    update public.staff_invites set accepted_at = now() where email = v_invite.email;
  end if;
  return new;
end;
$$;

revoke execute on function public.apply_staff_invite_on_confirm() from public, anon, authenticated;

create trigger on_auth_user_confirmed after update of email_confirmed_at on auth.users
for each row when (old.email_confirmed_at is null and new.email_confirmed_at is not null)
execute function public.apply_staff_invite_on_confirm();

-- One-time repair for anyone who already hit this: a confirmed Google account that is still a
-- student while an unused invite for its email is waiting.
with stuck as (
  select u.id, i.email, i.role, i.can_author
  from auth.users u
  join public.staff_invites i on i.email = lower(u.email) and i.accepted_at is null
  join public.profiles p on p.id = u.id and p.role = 'student'
  where u.email_confirmed_at is not null and coalesce(u.raw_app_meta_data ->> 'provider', '') = 'google'
), upgraded as (
  update public.profiles p set role = s.role, can_author = coalesce(s.can_author, false)
  from stuck s where p.id = s.id
  returning s.email
)
update public.staff_invites set accepted_at = now() where email in (select email from upgraded);
