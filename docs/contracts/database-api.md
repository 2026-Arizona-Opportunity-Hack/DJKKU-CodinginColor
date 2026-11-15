# Database API (lane A)

Everything the browser and the Pages Functions can do with the database. **Clients read
tables through row-level security and write only by calling these functions.** Each function
checks `auth.uid()` and the caller's role itself. Source of truth: `supabase/migrations/`
(if this file and the SQL disagree, the SQL is right). Tested by `supabase/tests/db.test.ts`.

Call from supabase-js with `supabase.rpc('name', { p_arg: value })`. Every function returns
jsonb (one object or array), `uuid` or `void`. Errors come back as a Postgres error whose
`message` is written for people ("This activity is locked: Take the pre-test first").

Roles: **guest** (not signed in), **student** (incl. a signed-in anonymous session),
**independent** (self-registered), **instructor**, **author** (instructor with `can_author`),
**admin** (`cic_admin`), **mentor**, **reviewer**.

## Student (lane B)

| Function | Who | Returns |
|---|---|---|
| `get_me()` | any signed-in user (anonymous student sessions too) | `{profile_id, role, can_author, display_name, class_id, class_name}`, or `null` when there is no user. `display_name` is the roster name when the student holds a seat. `class_id` and `class_name` are the most recently claimed student seat, and `null` for staff and for a student who has not claimed a seat yet (role is `student`). |
| `claim_login_code(p_code)` | student | `{class_id, class_name, display_name}`. Binds this device to the roster seat. A code works once. |
| `list_join_roster(p_join_code)` | guest, student | `[{member_id, label}]` of UNCLAIMED seats |
| `claim_roster_seat(p_join_code, p_member_id)` | student | `{class_id, class_name, display_name}` |
| `self_register(p_display_name)` | student | `{class_id, login_code}`. Name only, no email. Joins CIC Open. |
| `get_my_classes()` | student | `[{class_id, class_name, kind}]` |
| `get_class_outline(p_class_id)` | student | `{modules:[{module_id,title,position,pretest,posttest,lessons:[{lesson_id,title,position,activities:[{activity_id,title,kind,position,required,status,locked_reason}]}]}]}`; `status` is `locked`, `available` or `done` |
| `next_activity(p_class_id)` | student | `{module_id, lesson_id, activity_id}` or `null` (finished, or the next step is a pre or post test). `null` means finished OR the next step is the module's pre-test or post-test; the client must check `get_class_outline` for a `pretest`/`posttest` with status `available`. |
| `get_activity(p_activity_id)` | guest (CIC Open modules), student, staff preview | `{activity_id,title,kind,status,prev_id,next_id,content}`. Errors if locked. Content never has keys. |
| `submit_answer(p_activity_id, p_response, p_class_id?)` | student | `{is_correct, score, feedback, explanation, completed, next_activity_id, module_completed, unlocked_module_title}` |
| `heartbeat(p_activity_id, p_seconds)` | student | `{ok:true}` (0 to 60 seconds per call) |
| `get_assessment(p_assessment_id)` | student, staff preview | `{assessment_id, kind, taken, items:[questionContent]}` |
| `submit_assessment(p_assessment_id, p_responses, p_class_id?)` | student | `{score_pct, per_concept:[{concept, pct}]}`. **One shot.** |
| `get_my_progress(p_class_id)` | student | `{completed, total, modules:[{title,pct,pre_pct,post_pct,gain}]}` |
| `list_open_modules()` | guest, student | `[{module_id,title,summary,lessons:[{lesson_id,title,activities:[{activity_id,title,kind}]}]}]` |
| `import_guest_progress(p_payload)` | independent | `{imported}`. Only video/reading "viewed" credit is accepted. |

**Response shapes** for `submit_answer`: video and reading send `{"viewed": true}`. A code activity sends `{"code": "...", "passed": n, "total": n, "prediction"?: "..."}` (code up to 10 KB; `total` must equal the number of checks) and completes when every check passes. The code runs in the student's browser, so code activities are practice; learning is measured by the pre-test and post-test. Check,
worksheet and exit send `{"answers": {"<question_id>": R}}` with every question present, where
R is `{choice_id}` (mcq), `{text}` (short answer, reflection), `{blanks:[...]}` or `{order:[ids]}`.
`submit_assessment` sends `{"<question_id>": R}` for every item.

**Rules the server enforces** (not just the UI): activities unlock in order inside a module; a
module's activities open after its **pre-test is taken** (not passed); the post-test opens when
all required activities are done; the next module opens when the previous one is done
(required activities complete and post-test taken). In CIC Open modules are not chained. A
**check** completes only when every scored answer is right (the next hint on the ladder comes
back in `feedback`); a **worksheet** or **exit** completes on a full submission and records the
score. `explanation` comes back only once the activity is complete.

## Staff (lanes C and D)

| Function | Who | Does |
|---|---|---|
| `create_class(p_school_name, p_name, p_term?)` | instructor, admin | New class, caller becomes its instructor. Only admins can add a new school. |
| `create_join_code(p_class_id)` | class instructor, admin | `{join_code}` shown once; replaces any old code |
| `import_roster(p_class_id, p_names)` | class instructor, admin | `[{member_id, display_name, login_code}]`. Names only; all or nothing; duplicates and emails rejected. Codes shown once. |
| `reset_login_code(p_member_id)` | class instructor, admin, the student's mentor | `{login_code}`. Claiming it on a new device moves the student's data. |
| `reset_assessment_result(p_student_id, p_class_id, p_assessment_id)` | class instructor, admin | Lets a student retake a test |
| `assign_module(p_class_id, p_module_id, p_opens_at?)` | class instructor, admin | Published modules only; appended to the class order |
| `upsert_concept(p_id, p_name, p_description?)` | author | Concept tag |
| `save_module_draft(p_module)` | author (owner), admin | Saves a whole draft in one transaction (payload below). Returns the module id. |
| `submit_module(p_module_id)` | owner | Validates, locks the draft, returns `{errors, warnings}` (errors block) |
| `publish_module(p_module_id)` | admin | Validates, then freezes this version forever |
| `return_module_to_draft(p_module_id)` | admin | Sends a submitted module back |
| `new_module_version(p_module_id)` | author | Deep copy of a published module as version + 1 (one open draft per module) |
| `get_activity_keys(p_activity_id)`, `get_assessment_keys(p_assessment_id)` | admin, owner, instructor of a class using it, mentor of a student in it | Answer keys. Never students or reviewers. |

**`save_module_draft` payload** (built by `toDraftPayload` in `shared/authoring/schemas.ts`; `fromDraftRows` turns saved rows back into the editor's form):

```json
{ "module_id": null, "slug": "variables-and-loops", "title": "...", "summary": "...",
  "lessons": [ { "title": "...", "activities": [
     { "kind": "check", "title": "...", "required": true, "concept_id": "loops",
       "content": { "questions": [ /* student-safe questionContent */ ] },
       "keys": [ { "question_id": "q1", "key": { "type": "mcq", "correctChoiceId": "b", "hints": [] } } ] } ] } ],
  "assessments": [ { "kind": "pre", "title": "...", "items": [
     { "pair_key": "p1", "concept_id": "loops", "question_id": "pre1", "content": { "id": "pre1", "...": "..." }, "key": { } } ] } ] }
```
Positions come from array order. Video content is `{embedUrl, transcript?}` (a
`https://www.youtube-nocookie.com/embed/...` URL), reading is `{body}`. The database rejects
content that contains an answer-key field, and any key that does not match its question.

## Admin (lane D) and API (lane E)

| Function | Who | Does |
|---|---|---|
| `invite_staff(p_email, p_role, p_can_author?)` | admin | Invite an instructor, mentor, reviewer or admin. They get the role when they sign in with a verified Google account on that email. |
| `set_profile_role(p_profile_id, p_role, p_can_author?)` | admin | Change a role. You cannot change your own. |
| `assign_mentor(p_mentor_id, p_student_id, p_active?)` | admin | Mentors see only assigned students |
| `create_api_key(p_name, p_scope)` / `revoke_api_key(p_id)` | admin | `{api_key_id, raw_key}` shown once; stored as a sha256 hash |
| `add_class_instructor(p_class_id, p_profile_id)` | admin | Returns nothing (`void`). Puts an existing instructor or admin on a class so they can see it. Errors: `Only a CIC admin can add instructors`, `Class not found`, `That person is not an instructor yet. Invite them as an instructor first`, `That person is a student in this class`. Adding someone twice does nothing. |
| `remove_class_instructor(p_class_id, p_profile_id)` | admin | Returns nothing (`void`). Removes that instructor from the class. Errors: `Only a CIC admin can remove instructors`, `Class not found`, `A class needs at least one instructor` (a school class never ends up with none). Removing someone who is not an instructor of the class does nothing. |
| `validate_api_key(p_raw_key)` | **service_role only** | `{api_key_id, scope}` or `null` |

## Views

| View | Who | Contents |
|---|---|---|
| `v_class_progress` | instructor, admin (students see themselves) | per student and unclaimed seat: required, completed, `completion_pct`, `last_active_at`, `joined` |
| `v_not_started` | same | seats and students with no progress at all |
| `v_stuck` | same | `student_id, activity_id, wrong_attempts, minutes_on_activity, hints_used, days_inactive, reasons[]`. Rules: 3 wrong attempts, or over 10 minutes unfinished, or 3 school days idle. Defaults, unconfirmed with CIC. |
| `v_concept_mastery` | same | per student and concept: attempts, correct, `mastery_pct` |
| `v_reteach` | instructor, admin | per class and concept: `wrong_rate_pct`, `hints_used` ("reteach tomorrow") |
| `v_learning_gain` | student (own), mentor (mentees), instructor (class), admin | ADR 0020 exactly. `scope` is `student` or `class`; `concept_id` null means overall; `status` is `complete` or `incomplete` (gain columns null, never 0); class rows carry `complete_count` and `incomplete_count`. |
| `api_class_gain`, `api_class_progress` | **service_role only** | Class-level aggregates for the read API. Groups with fewer than 5 students are omitted. |

Tables you can `select` directly (RLS decides rows): `profiles`, `schools`, `classes`,
`class_members`, `concepts`, `modules`, `lessons`, `activities`, `assessments`,
`assessment_items`, `class_modules`, `submissions`, `progress`, `assessment_results`,
`assessment_responses`, `mentor_assignments`, `mentor_notes`, `hint_events`, `api_keys`,
`staff_invites`. Direct writes exist only for: your own `profiles.display_name`, a class's
`name` and `term`, `schools` (admin), and appending a `mentor_notes` row. Nothing else can be
written except through the functions above.

**For lane E (service_role):** you can write `hint_events` and `hint_cache`, and read
`activity_keys` for the hint ladder (`key->'hints'`). Use `validate_api_key` for the read API and
read only the `api_*` views; they never return per-student rows.
