-- Misconception radar: for each question in a class, the wrong answers students actually gave and
-- how many students gave each one, so an instructor knows what to reteach tomorrow.
--
-- Formative assessment (teachers adjusting teaching from evidence of what students think) is one of
-- the strongest classroom practices (Black and Wiliam 1998). Uses each student's FIRST attempt on an
-- activity: that is what they thought before any feedback. (A check only completes when it is right,
-- so the latest attempt would hide exactly the misconceptions worth reteaching.)
-- Instructors already see their own students' answers; this only groups them. Answers are returned
-- as the student sent them (a choice id, text, blanks or an order) plus the student-safe question
-- content, so the screen can show choice text. No answer key leaves the database.

create function public.get_class_misconceptions(p_class_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Sign in first'; end if;
  if not (public.is_instructor_of(p_class_id) or public.is_admin()) then
    raise exception 'Not allowed: you do not teach this class';
  end if;

  return coalesce((
    with first_try as (
      select distinct on (s.student_id, s.activity_id) s.student_id, s.activity_id, s.response, s.results
      from public.submissions s
      join public.class_members m on m.class_id = s.class_id and m.profile_id = s.student_id and m.member_role = 'student'
      where s.class_id = p_class_id
      order by s.student_id, s.activity_id, s.attempt_no asc
    ),
    answered as (
      select l.activity_id, r.key as question_id, l.student_id, (r.value ->> 'correct') = 'true' as correct,
        -- normalize so "For " and "for" count as the same wrong answer
        case
          when jsonb_typeof(l.response -> 'answers' -> r.key -> 'text') = 'string'
            then jsonb_build_object('text', lower(btrim(l.response -> 'answers' -> r.key ->> 'text')))
          when jsonb_typeof(l.response -> 'answers' -> r.key -> 'blanks') = 'array'
            then jsonb_build_object('blanks', (select jsonb_agg(lower(btrim(b))) from jsonb_array_elements_text(l.response -> 'answers' -> r.key -> 'blanks') b))
          else l.response -> 'answers' -> r.key
        end as answer
      from first_try l, jsonb_each(l.results) r
      where jsonb_typeof(r.value) = 'object' and r.value ? 'correct' and jsonb_typeof(r.value -> 'correct') = 'boolean'
    ),
    per_answer as (
      select activity_id, question_id, answer, count(*)::int as students
      from answered where not correct and answer is not null
      group by activity_id, question_id, answer
    ),
    per_question as (
      select activity_id, question_id, count(*)::int as answered, count(*) filter (where not correct)::int as wrong
      from answered group by activity_id, question_id
    )
    select jsonb_agg(row order by (row ->> 'wrong')::int desc, row ->> 'activity_title')
    from (
      select jsonb_build_object(
        'activity_id', a.id, 'activity_title', a.title, 'lesson_title', le.title,
        'question', (select q from jsonb_array_elements(a.content -> 'questions') q where q ->> 'id' = pq.question_id limit 1),
        'answered', pq.answered, 'wrong', pq.wrong,
        'answers', (select jsonb_agg(jsonb_build_object('answer', pa.answer, 'students', pa.students) order by pa.students desc)
                    from (select * from per_answer pa where pa.activity_id = pq.activity_id and pa.question_id = pq.question_id
                          order by pa.students desc limit 3) pa)
      ) as row
      from per_question pq
      join public.activities a on a.id = pq.activity_id
      join public.lessons le on le.id = a.lesson_id
      where pq.wrong >= 2
      order by pq.wrong desc
      limit 12
    ) t
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.get_class_misconceptions(uuid) from public, anon, authenticated;
grant execute on function public.get_class_misconceptions(uuid) to authenticated;
