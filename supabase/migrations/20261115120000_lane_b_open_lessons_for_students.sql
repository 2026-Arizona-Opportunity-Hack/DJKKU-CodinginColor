-- Open lessons for signed-in students.
--
-- Modules published into the CIC Open class are public: guests (no session) read them, and
-- list_open_modules shows them to everyone. But can_read_module only let a STUDENT read a
-- module assigned to their own class, so a signed-in student whose class does not have an open
-- module saw it on /learn/explore and then got "Activity not found" when opening it, while a
-- logged-out guest could open it. Found in a browser test on 2026-11-15.
--
-- Change: anyone may read a published module that is in an open class. Nothing new becomes
-- visible (it is already public to guests); answer keys live in separate tables with no client
-- policy and are not affected. Body otherwise identical to 20261114151000 (marked "open:").

create or replace function public.can_read_module(p_module_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.modules m
    where m.id = p_module_id and (
      (m.status = 'published' and (
        auth.uid() is null
        or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role <> 'student')
        or exists (
          select 1 from public.class_modules cm
          join public.class_members mem on mem.class_id = cm.class_id
          where cm.module_id = m.id and mem.profile_id = auth.uid() and mem.member_role = 'student'
        )
        or exists (                                                              -- open:
          select 1 from public.class_modules cm
          join public.classes c on c.id = cm.class_id and c.kind = 'open'
          where cm.module_id = m.id
        )
      ))
      or (m.status <> 'published' and (public.is_admin() or (public.is_author() and m.created_by = auth.uid())))
    )
  );
$$;
