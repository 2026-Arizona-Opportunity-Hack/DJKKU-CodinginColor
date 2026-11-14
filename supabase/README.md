# supabase/

Database layer, owned by lane A. Nothing is created here yet; this file fixes the
layout so lane A and the other lanes agree where things go.

```
supabase/
  migrations/   numbered SQL files: tables, RLS policies, functions, views
  seed.sql      demo data: one real or "variables and loops" module, two fake classes
  tests/        one SQL test script per role (student, independent, mentor,
                instructor, admin, reviewer) proving what each can and cannot read
```

Rules from the design plan:
- RLS on every table, default deny, with a comment on every policy.
- Answer keys live in `activity_keys`, readable only by security-definer functions.
- Views (`v_class_progress`, `v_stuck`, `v_learning_gain`, `v_concept_mastery`) are
  what both the dashboard and the read API read, so the numbers agree.
- Never commit real data or keys here. Seed data is fake.
