-- lane_c_proposal.sql
-- PROPOSAL from lane C (authoring and assessments). NOT final and NOT tested
-- against a running database yet. Lane A (Koen) owns the real schema: rename,
-- merge or drop anything here. Keep the ideas, not necessarily the SQL.
--
-- Assumes lane A provides these helpers (names from the design plan):
--   is_admin()      true for a CIC admin
--   is_staff()      true for instructor or CIC admin (people allowed to author)
-- and these tables: classes, class_members, assessment_results
--   (student_id, class_id, assessment_id, score_pct).
--
-- Mirrors shared/authoring/schemas.ts (shapes) and gain.ts (math, ADR 0020).

create table if not exists concepts (
  id   text primary key check (id ~ '^[A-Za-z0-9_-]{1,64}$'),
  name text not null check (char_length(name) between 1 and 80)
);

-- One row per module VERSION. Publishing creates/locks a version; a class stays
-- on the version it started with (class_modules.module_id points at a row).
create table if not exists modules (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null check (slug ~ '^[a-z0-9-]{1,64}$'),
  version      int  not null default 1,
  title        text not null check (char_length(title) between 1 and 120),
  summary      text not null default '' check (char_length(summary) <= 500),
  status       text not null default 'draft' check (status in ('draft','submitted','published')),
  created_by   uuid not null default auth.uid(),
  published_at timestamptz,
  unique (slug, version)
);

create table if not exists lessons (
  id        uuid primary key default gen_random_uuid(),
  module_id uuid not null references modules(id) on delete cascade,
  position  int  not null check (position >= 0),
  title     text not null check (char_length(title) between 1 and 120),
  unique (module_id, position)
);

-- content holds prompts and choices, NEVER answers (see activity_keys).
create table if not exists activities (
  id         uuid primary key default gen_random_uuid(),
  lesson_id  uuid not null references lessons(id) on delete cascade,
  position   int  not null check (position >= 0),
  kind       text not null check (kind in ('video','reading','check','worksheet','exit')),
  title      text not null check (char_length(title) between 1 and 120),
  required   boolean not null default true,
  content    jsonb not null,
  unique (lesson_id, position)
);

-- Answer keys. RLS is on and ONLY author policies exist: no student, mentor or
-- reviewer policy, so those roles read zero rows. The grader (submit_answer,
-- security definer) reads it directly.
create table if not exists activity_keys (
  activity_id uuid not null references activities(id) on delete cascade,
  question_id text not null,
  key         jsonb not null,
  primary key (activity_id, question_id)
);

create table if not exists assessments (
  id        uuid primary key default gen_random_uuid(),
  module_id uuid not null references modules(id) on delete cascade,
  kind      text not null check (kind in ('pre','post')),
  unique (module_id, kind)
);

-- pair_key links a pre item to its post twin; gain is computed on matched pairs.
create table if not exists assessment_items (
  id            uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references assessments(id) on delete cascade,
  pair_key      text not null check (pair_key ~ '^[A-Za-z0-9_-]{1,64}$'),
  concept_id    text not null references concepts(id),
  question_id   text not null,
  content       jsonb not null,   -- student-safe content only
  key           jsonb not null,   -- TODO lane A: move to a keys table with no student policy
  unique (assessment_id, pair_key)
);

alter table concepts         enable row level security;
alter table modules          enable row level security;
alter table lessons          enable row level security;
alter table activities       enable row level security;
alter table activity_keys    enable row level security;
alter table assessments      enable row level security;
alter table assessment_items enable row level security;

-- Anyone signed in (or a guest) can read PUBLISHED curriculum content.
create policy concepts_read on concepts for select using (true);
create policy modules_read_published on modules for select using (status = 'published' or is_staff());
create policy lessons_read on lessons for select
  using (exists (select 1 from modules m where m.id = module_id and (m.status = 'published' or is_staff())));
create policy activities_read on activities for select
  using (exists (select 1 from lessons l join modules m on m.id = l.module_id
                 where l.id = lesson_id and (m.status = 'published' or is_staff())));
create policy assessments_read on assessments for select
  using (exists (select 1 from modules m where m.id = module_id and (m.status = 'published' or is_staff())));

-- Authors (instructors and admins) may write only while the module is NOT published.
-- Published versions are immutable; to change one, create version + 1.
create policy modules_author_insert on modules for insert with check (is_staff() and status = 'draft');
create policy modules_author_update on modules for update
  using (is_staff() and status in ('draft','submitted'))
  -- authors may draft or submit; only an admin may set published
  with check (status in ('draft','submitted') or is_admin());
create policy lessons_author_write on lessons for all
  using (is_staff() and exists (select 1 from modules m where m.id = module_id and m.status <> 'published'))
  with check (is_staff() and exists (select 1 from modules m where m.id = module_id and m.status <> 'published'));
create policy activities_author_write on activities for all
  using (is_staff() and exists (select 1 from lessons l join modules m on m.id = l.module_id where l.id = lesson_id and m.status <> 'published'))
  with check (is_staff() and exists (select 1 from lessons l join modules m on m.id = l.module_id where l.id = lesson_id and m.status <> 'published'));
create policy assessments_author_write on assessments for all
  using (is_staff() and exists (select 1 from modules m where m.id = module_id and m.status <> 'published'))
  with check (is_staff() and exists (select 1 from modules m where m.id = module_id and m.status <> 'published'));

-- Keys: authors only. Instructors may read keys (plan: "See answer keys: Yes").
create policy activity_keys_staff on activity_keys for all using (is_staff()) with check (is_staff());

-- assessment_items holds content AND key in this proposal, so it must not be
-- readable by students. Lane A should split it like activities/activity_keys,
-- then open the content half to students. Staff-only until then (safe default).
create policy assessment_items_staff on assessment_items for all using (is_staff()) with check (is_staff());

-- Learning gain per student per module. Matches gain.ts / ADR 0020:
-- missing pre or post gives NULL gain columns, never 0.
-- ASSUMES assessment_results.score_pct is already computed on paired items.
create or replace view v_learning_gain as
select
  pre.student_id,
  pre.class_id,
  a_pre.module_id,
  pre.score_pct  as pre_pct,
  post.score_pct as post_pct,
  post.score_pct - pre.score_pct as gain_points,
  case when pre.score_pct >= 100 then null
       else (post.score_pct - pre.score_pct) / (100 - pre.score_pct) end as normalized_gain,
  case when post.score_pct is null then 'incomplete' else 'complete' end as status
from assessment_results pre
join assessments a_pre on a_pre.id = pre.assessment_id and a_pre.kind = 'pre'
left join assessments a_post on a_post.module_id = a_pre.module_id and a_post.kind = 'post'
left join assessment_results post
  on post.student_id = pre.student_id and post.class_id = pre.class_id and post.assessment_id = a_post.id;
-- Students who took a post but no pre are not listed. TODO lane A: full outer join
-- so they show as incomplete too, and add the class and concept rollups per ADR 0020.
-- security_invoker so the view obeys the caller's RLS instead of bypassing it.
alter view v_learning_gain set (security_invoker = true);
