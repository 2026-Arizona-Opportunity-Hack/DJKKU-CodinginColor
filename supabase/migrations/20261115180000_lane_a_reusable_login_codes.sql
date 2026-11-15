-- A student's login code is reusable: the same code signs them in on another device.
--
-- Before, _claim_member deleted the code on first use ("a code works once"), so a student who switched
-- from the lab Chromebook to a phone at home needed the instructor to reset their code every time.
-- Now the code stays valid until an instructor resets it (reset_login_code replaces it, so the old one
-- stops working). Nothing else changes:
--   * One device holds the seat at a time. Signing in on a new device moves the seat and all the
--     student's progress, answers, tests and hints there (the move already existed for resets); the
--     previous device simply has no class until the code is used on it again.
--   * A device that already holds a seat in another class still cannot claim a second one.
-- Trade-off (decided 2026-11-15): the code is now effectively the student's password. Someone who sees
-- a printed slip can take the seat; the student notices at once and the instructor resets the code.

create or replace function public._claim_member(p_member_id uuid, p_profile uuid) returns jsonb
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
    -- Added with reusable codes, so moving devices also keeps: the student's own notes (added
    -- 2026-11-15), their mentor, and the mentor's notes about them. A note or assignment the new
    -- device already has is kept rather than overwritten.
    update public.student_notes n set profile_id = p_profile
    where n.profile_id = v_m.profile_id
      and not exists (select 1 from public.student_notes x where x.profile_id = p_profile and x.activity_id = n.activity_id);
    update public.mentor_assignments a set student_id = p_profile
    where a.student_id = v_m.profile_id
      and not exists (select 1 from public.mentor_assignments x where x.student_id = p_profile and x.mentor_id = a.mentor_id);
    update public.mentor_notes set student_id = p_profile where student_id = v_m.profile_id;
  end if;
  update public.class_members set profile_id = p_profile, claimed_at = now() where id = v_m.id;
  -- The login code is kept (it used to be deleted here), so the student can use it on another device.
  update public.profiles set display_name = v_m.display_name where id = p_profile;
  select name into v_class_name from public.classes where id = v_m.class_id;
  return jsonb_build_object('class_id', v_m.class_id, 'class_name', v_class_name, 'display_name', v_m.display_name);
end;
$$;
