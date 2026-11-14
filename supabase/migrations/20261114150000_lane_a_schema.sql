-- Lane A schema: tables, constraints, indexes. Policies, functions and views are in
-- the later migrations. Shapes follow the lane C authoring schemas
-- (shared/authoring/schemas.ts) so what the studio saves is what the player reads.
--
-- Design rules (see docs/adr/0024-lane-a-database-design.md):
--  * RLS is on for every table. Clients can only READ (plus two tiny exceptions).
--    Every write goes through a security-definer function that checks the caller.
--  * Answer keys live in activity_keys / assessment_keys. No client policy exists
--    on them, so only security-definer functions can read them.
--  * One modules row = one immutable-after-publish VERSION.

create extension if not exists pgcrypto with schema extensions;

-- ---------- validation helpers used by CHECK constraints ----------

-- Shape check for one answer key. Mirrors `questionKey` in schemas.ts. The deep
-- check (blank counts, choice ids) is done by zod in the studio and again by
-- save_module_draft; this stops obviously broken keys from ever being stored.
create function public.valid_question_key(k jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce(case when jsonb_typeof(k) <> 'object' then false else
    case k ->> 'type'
      when 'mcq' then jsonb_typeof(k -> 'correctChoiceId') = 'string'
      when 'short_answer' then case when jsonb_typeof(k -> 'accepted') = 'array'
        then jsonb_array_length(k -> 'accepted') between 1 and 10 else false end
      when 'fill_blank' then case when jsonb_typeof(k -> 'blanks') = 'array'
        then jsonb_array_length(k -> 'blanks') between 1 and 10 else false end
      when 'ordering' then case when jsonb_typeof(k -> 'correctOrder') = 'array'
        then jsonb_array_length(k -> 'correctOrder') between 2 and 10 else false end
      else false
    end
  end, false);
$$;

-- Safety net: student-visible content must never carry answer-key fields. The
-- studio already splits keys from content (ADR 0022); this makes the database
-- refuse a leak even if a client or a future bug sends one.
create function public.content_has_no_key_fields(c jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select c::text !~ '"(correctChoiceId|correctOrder|accepted|caseSensitive|hints|explanation)"\s*:';
$$;

-- ---------- people ----------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'student'
    check (role in ('student', 'independent_student', 'mentor', 'instructor', 'cic_admin', 'reviewer')),
  display_name text not null default '' check (char_length(display_name) <= 80),
  can_author boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Staff are invited by email; a Google sign-in with a matching verified email gets
-- the invited role automatically (see handle_new_auth_user). No invite = student.
create table public.staff_invites (
  email text primary key check (email = lower(email) and char_length(email) <= 254),
  role text not null check (role in ('mentor', 'instructor', 'cic_admin', 'reviewer')),
  can_author boolean not null default false,
  invited_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);

create table public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(btrim(name)) between 1 and 120),
  created_at timestamptz not null default now()
);

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools (id) on delete restrict,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  term text check (char_length(term) <= 40),
  kind text not null default 'school' check (kind in ('school', 'open')),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint classes_kind_school_check
    check ((kind = 'school' and school_id is not null) or (kind = 'open' and school_id is null))
);
create unique index classes_one_open_class_idx on public.classes (kind) where kind = 'open';

-- Minors: only a display name is stored (plus class and school through the class).
create table public.class_members (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  profile_id uuid references public.profiles (id) on delete cascade,
  member_role text not null default 'student' check (member_role in ('student', 'instructor')),
  display_name text not null check (char_length(btrim(display_name)) between 1 and 80),
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint class_members_instructor_check check (member_role <> 'instructor' or profile_id is not null)
);
create unique index class_members_profile_class_idx
  on public.class_members (class_id, profile_id) where profile_id is not null;
create index class_members_profile_idx on public.class_members (profile_id);
create index class_members_class_idx on public.class_members (class_id);

-- Secrets live in their own tables, with RLS on and no policy, so class_members and classes can
-- be selected with `select *` by the staff who are allowed to read them. Only hashes are stored.
create table public.member_login_codes (
  member_id uuid primary key references public.class_members (id) on delete cascade,
  code_hash text not null unique,
  created_at timestamptz not null default now()
);
create table public.class_join_codes (
  class_id uuid primary key references public.classes (id) on delete cascade,
  code_hash text not null unique,
  created_at timestamptz not null default now()
);

-- ---------- curriculum ----------

create table public.concepts (
  id text primary key check (id ~ '^[A-Za-z0-9_-]{1,64}$'),
  name text not null check (char_length(name) between 1 and 80),
  description text,
  created_at timestamptz not null default now()
);

-- One row per module VERSION. Published rows are frozen by triggers (migration 2).
create table public.modules (
  id uuid primary key default gen_random_uuid(),
  slug text not null check (slug ~ '^[a-z0-9-]{1,64}$'),
  version integer not null default 1 check (version > 0),
  title text not null check (char_length(title) between 1 and 120),
  summary text not null default '' check (char_length(summary) <= 500),
  status text not null default 'draft' check (status in ('draft', 'submitted', 'published')),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  constraint modules_slug_version_unique unique (slug, version),
  constraint modules_published_at_check check (
    (status = 'published' and published_at is not null)
    or (status <> 'published' and published_at is null)
  )
);

create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.modules (id) on delete cascade,
  position integer not null check (position >= 0),
  title text not null check (char_length(title) between 1 and 120),
  created_at timestamptz not null default now(),
  unique (module_id, position)
);

-- content is the STUDENT-SAFE shape (what splitModule produces):
--   video   {embedUrl, transcript?}   reading {body}   check/worksheet/exit {questions:[...]}
create table public.activities (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  position integer not null check (position >= 0),
  kind text not null check (kind in ('video', 'reading', 'check', 'worksheet', 'exit')),
  title text not null check (char_length(title) between 1 and 120),
  content jsonb not null check (jsonb_typeof(content) = 'object'),
  required boolean not null default true,
  concept_id text references public.concepts (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (lesson_id, position),
  constraint activities_content_shape check (
    case kind
      when 'video' then (content ->> 'embedUrl') like 'https://www.youtube-nocookie.com/embed/%'
      when 'reading' then jsonb_typeof(content -> 'body') = 'string'
      else jsonb_typeof(content -> 'questions') = 'array'
    end
  ),
  constraint activities_content_no_keys check (public.content_has_no_key_fields(content))
);
create index activities_lesson_idx on public.activities (lesson_id);
create index lessons_module_idx on public.lessons (module_id);

-- One key per question (a worksheet has many). No client policy: definer functions only.
create table public.activity_keys (
  activity_id uuid not null references public.activities (id) on delete cascade,
  question_id text not null check (question_id ~ '^[A-Za-z0-9_-]{1,64}$'),
  key jsonb not null check (public.valid_question_key(key)),
  created_at timestamptz not null default now(),
  primary key (activity_id, question_id)
);

create table public.assessments (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.modules (id) on delete cascade,
  kind text not null check (kind in ('pre', 'post')),
  title text not null check (char_length(title) between 1 and 120),
  created_at timestamptz not null default now(),
  unique (module_id, kind)
);

-- pair_key links a pre item to its post twin; unique per test (ADR 0020).
-- content is a lane C questionContent object whose id equals question_id.
create table public.assessment_items (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments (id) on delete cascade,
  position integer not null check (position >= 0),
  pair_key text not null check (pair_key ~ '^[A-Za-z0-9_-]{1,64}$'),
  concept_id text not null references public.concepts (id) on delete restrict,
  question_id text not null check (question_id ~ '^[A-Za-z0-9_-]{1,64}$'),
  content jsonb not null check (jsonb_typeof(content) = 'object' and content ->> 'id' = question_id),
  created_at timestamptz not null default now(),
  unique (assessment_id, position),
  unique (assessment_id, pair_key),
  unique (assessment_id, question_id),
  constraint assessment_items_no_keys check (public.content_has_no_key_fields(content))
);
create index assessment_items_assessment_idx on public.assessment_items (assessment_id);

create table public.assessment_keys (
  assessment_item_id uuid primary key references public.assessment_items (id) on delete cascade,
  key jsonb not null check (public.valid_question_key(key)),
  created_at timestamptz not null default now()
);

-- ---------- classes get modules ----------

-- module_id already identifies a version, so a class stays on the version it started with.
create table public.class_modules (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  module_id uuid not null references public.modules (id) on delete restrict,
  position integer not null check (position >= 0),
  opens_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (class_id, module_id),
  unique (class_id, position)
);
create index class_modules_module_idx on public.class_modules (module_id);

-- ---------- student activity ----------

create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete cascade,
  class_id uuid not null references public.classes (id) on delete cascade,
  activity_id uuid not null references public.activities (id) on delete cascade,
  response jsonb not null,
  is_correct boolean,                       -- null when nothing in the activity is scored
  score numeric(5, 2) not null check (score between 0 and 100),
  results jsonb not null default '{}'::jsonb check (jsonb_typeof(results) = 'object'), -- {question_id: {correct, concept}}
  attempt_no integer not null check (attempt_no > 0),
  submitted_at timestamptz not null default now(),
  unique (student_id, class_id, activity_id, attempt_no)
);
create index submissions_class_idx on public.submissions (class_id, student_id);

create table public.progress (
  student_id uuid not null references public.profiles (id) on delete cascade,
  class_id uuid not null references public.classes (id) on delete cascade,
  activity_id uuid not null references public.activities (id) on delete cascade,
  status text not null default 'in_progress' check (status in ('in_progress', 'completed')),
  best_score numeric(5, 2) not null default 0 check (best_score between 0 and 100),
  time_spent_s integer not null default 0 check (time_spent_s >= 0),
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  primary key (student_id, class_id, activity_id),
  constraint progress_completion_check check (
    (status = 'completed' and completed_at is not null)
    or (status = 'in_progress' and completed_at is null)
  )
);
create index progress_class_idx on public.progress (class_id, student_id);

create table public.assessment_results (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete cascade,
  class_id uuid not null references public.classes (id) on delete cascade,
  assessment_id uuid not null references public.assessments (id) on delete cascade,
  score_pct numeric(5, 2) not null check (score_pct between 0 and 100),
  per_concept jsonb not null default '{}'::jsonb check (jsonb_typeof(per_concept) = 'object'),
  submitted_at timestamptz not null default now(),
  unique (student_id, class_id, assessment_id)   -- one shot: no retaking a pre-test after seeing the post
);

-- Per-item answers. v_learning_gain joins pre and post rows on pair_key.
create table public.assessment_responses (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete cascade,
  class_id uuid not null references public.classes (id) on delete cascade,
  assessment_item_id uuid not null references public.assessment_items (id) on delete cascade,
  response jsonb not null,
  is_correct boolean not null,
  submitted_at timestamptz not null default now(),
  unique (student_id, class_id, assessment_item_id)
);

-- ---------- admin, mentors, hints ----------

create table public.api_keys (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 100),
  scope text[] not null default '{}' check (scope <@ array['progress', 'assessments']::text[]),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

create table public.api_key_secrets (
  api_key_id uuid primary key references public.api_keys (id) on delete cascade,
  key_hash text not null unique
);

create table public.mentor_assignments (
  mentor_id uuid not null references public.profiles (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  assigned_by uuid not null references public.profiles (id) on delete restrict,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (mentor_id, student_id),
  check (mentor_id <> student_id)
);

-- Safeguarding log. Append-only: no update or delete policy exists for anyone.
create table public.mentor_notes (
  id uuid primary key default gen_random_uuid(),
  mentor_id uuid not null references public.profiles (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

create table public.hint_events (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete cascade,
  class_id uuid not null references public.classes (id) on delete cascade,
  activity_id uuid not null references public.activities (id) on delete cascade,
  attempt integer not null check (attempt > 0),
  hint text not null,
  concept_id text references public.concepts (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.hint_cache (
  activity_id uuid not null references public.activities (id) on delete cascade,
  wrong_answer_hash text not null,
  hint text not null,
  created_at timestamptz not null default now(),
  primary key (activity_id, wrong_answer_hash)
);

-- RLS on everything. Policies come in the policies migration; a table with RLS on and no
-- policy is unreadable by clients, which is what we want for keys, hashes and the cache.
alter table public.profiles enable row level security;
alter table public.staff_invites enable row level security;
alter table public.schools enable row level security;
alter table public.classes enable row level security;
alter table public.class_members enable row level security;
alter table public.concepts enable row level security;
alter table public.modules enable row level security;
alter table public.lessons enable row level security;
alter table public.activities enable row level security;
alter table public.activity_keys enable row level security;
alter table public.assessments enable row level security;
alter table public.assessment_items enable row level security;
alter table public.assessment_keys enable row level security;
alter table public.class_modules enable row level security;
alter table public.submissions enable row level security;
alter table public.progress enable row level security;
alter table public.assessment_results enable row level security;
alter table public.assessment_responses enable row level security;
alter table public.api_keys enable row level security;
alter table public.api_key_secrets enable row level security;
alter table public.member_login_codes enable row level security;
alter table public.class_join_codes enable row level security;
alter table public.mentor_assignments enable row level security;
alter table public.mentor_notes enable row level security;
alter table public.hint_events enable row level security;
alter table public.hint_cache enable row level security;
