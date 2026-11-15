-- DEMO DATA ONLY. Every name, code and score below is fake. Do not run this against a
-- database that holds real students (the README says how to load it into a demo project).
--
-- What this creates:
--   * the CIC Open class (independent learners) and a published "Variables and Loops" module
--   * 2 concepts, 3 lessons, a video, readings, checks, a 4-question worksheet, an exit
--     ticket, and a paired pre-test and post-test
--   * two demo school classes with fake students, so the learning gain, stuck and
--     not-started screens have something to show
--   * ONE unclaimed demo seat with a known login code, and a known join code, so you can
--     walk the student sign-in flow:
--        login code  DEMO-0000-0000-0001      join code  DEMO-JOIN-1234  (class "Demo Period 1")
-- Safe to re-run after `supabase db reset` (the reset empties the tables first).

begin;

insert into public.classes (id, name, kind) values ('10000000-0000-4000-8000-000000000001', 'CIC Open', 'open');
insert into public.concepts (id, name, description) values
  ('variables', 'Variables', 'Store and update values in a program.'),
  ('loops', 'Loops', 'Repeat instructions with a loop.');

-- ---------- the module (inserted as a draft, published at the end) ----------

insert into public.modules (id, slug, version, title, summary)
values ('20000000-0000-4000-8000-000000000001', 'variables-and-loops', 1, 'Variables and Loops',
        'A short starter module about storing values and repeating code.');

insert into public.lessons (id, module_id, position, title) values
  ('40000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 0, 'Variables'),
  ('40000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', 1, 'Loops'),
  ('40000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000001', 2, 'Wrap up');

-- Activity content is the student-safe shape; answers go to activity_keys below.
insert into public.activities (id, lesson_id, position, kind, title, content, required, concept_id) values
  ('50000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', 0, 'video', 'Watch: what is a variable?',
   -- PLACEHOLDER VIDEO: replace with CIC's own unlisted video from the authoring studio.
   '{"embedUrl":"https://www.youtube-nocookie.com/embed/Z1Yd7upQsXY","transcript":"A variable is a name that points to a value. In Python you write the name, an equals sign, and the value: score = 3."}', true, 'variables'),
  ('50000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000001', 1, 'reading', 'Read: naming things',
   '{"body":"A **variable** gives a value a name.\n\n    score = 3\n    player_name = \"Maya\"\n\nUse lowercase words joined by `_`. A name cannot start with a number."}', true, 'variables'),
  ('50000000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-000000000001', 2, 'check', 'Variables check',
   '{"questions":[{"id":"q-vars-1","type":"mcq","prompt":"After `x = 3` and then `x = x + 2`, what is x?","conceptId":"variables","choices":[{"id":"a","text":"3"},{"id":"b","text":"5"},{"id":"c","text":"32"}]}]}', true, 'variables'),
  ('50000000-0000-4000-8000-000000000004', '40000000-0000-4000-8000-000000000002', 0, 'reading', 'Read: repeating with loops',
   '{"body":"A **loop** repeats a block of code.\n\n    for n in range(3):\n        print(n)\n\n`range(3)` gives 0, 1, 2, so the loop runs 3 times."}', true, 'loops'),
  ('50000000-0000-4000-8000-000000000005', '40000000-0000-4000-8000-000000000002', 1, 'worksheet', 'Loops worksheet',
   '{"questions":['
   '{"id":"q-loop-1","type":"short_answer","prompt":"Which built-in function gives a for-loop a sequence of numbers?","conceptId":"loops"},'
   '{"id":"q-loop-2","type":"fill_blank","prompt":"Complete the loop: ___ i in ___(5):","conceptId":"loops"},'
   -- items are listed in a scrambled order on purpose: the order shown is never the solved order
   '{"id":"q-loop-3","type":"ordering","display":"code","prompt":"Put these lines of code in order so the program prints 0, 1, 2.","conceptId":"loops","items":[{"id":"l3","text":"    print(i)"},{"id":"l1","text":"i = 0"},{"id":"l4","text":"    i = i + 1"},{"id":"l2","text":"while i < 3:"}]},'
   '{"id":"q-loop-4","type":"mcq","prompt":"How many times does `for i in range(4):` run its body?","conceptId":"loops","choices":[{"id":"a","text":"3"},{"id":"b","text":"4"},{"id":"c","text":"5"}]}'
   ']}', true, 'loops'),
  ('50000000-0000-4000-8000-000000000006', '40000000-0000-4000-8000-000000000002', 2, 'check', 'Loops check',
   '{"questions":[{"id":"q-loop-c1","type":"fill_blank","prompt":"A loop that runs while a condition is true starts with ___.","conceptId":"loops"}]}', true, 'loops'),
  -- Python in the browser (optional): predict, run, then change the loop until the visible check passes.
  ('50000000-0000-4000-8000-000000000008', '40000000-0000-4000-8000-000000000002', 3, 'code', 'Try it: count with a loop',
   '{"prompt":"This loop adds up the numbers 1, 2 and 3. Change it so `total` is the sum of 1 to **10**.","starter":"total = 0\nfor n in range(1, 4):\n    total = total + n\nprint(total)\n","predict":"What will this program print before you change it?","tests":["assert total == 55, \"total should be 55 (1 + 2 + ... + 10)\""]}', false, 'loops'),
  ('50000000-0000-4000-8000-000000000007', '40000000-0000-4000-8000-000000000003', 0, 'exit', 'Exit ticket',
   '{"questions":[{"id":"q-exit-1","type":"reflection","prompt":"What was the hardest part of loops today, and what helped?"}]}', true, null);

insert into public.activity_keys (activity_id, question_id, key) values
  ('50000000-0000-4000-8000-000000000003', 'q-vars-1', '{"type":"mcq","correctChoiceId":"b","explanation":"x + 2 uses the old value, 3, so x becomes 5.","hints":["Work out the right side first, using the value x has right now.","x is 3 before the second line runs."]}'),
  ('50000000-0000-4000-8000-000000000005', 'q-loop-1', '{"type":"short_answer","accepted":["range","range()"],"caseSensitive":false,"explanation":"range() makes the numbers a for-loop walks through.","hints":["It starts with the letter r."]}'),
  ('50000000-0000-4000-8000-000000000005', 'q-loop-2', '{"type":"fill_blank","blanks":[["for"],["range"]],"caseSensitive":false,"hints":["The first word starts every counting loop."]}'),
  ('50000000-0000-4000-8000-000000000005', 'q-loop-3', '{"type":"ordering","correctOrder":["l1","l2","l3","l4"],"hints":["Something has to be set before the loop starts.","The two indented lines belong inside the loop."]}'),
  ('50000000-0000-4000-8000-000000000005', 'q-loop-4', '{"type":"mcq","correctChoiceId":"b","hints":["range(4) is 0, 1, 2, 3."]}'),
  ('50000000-0000-4000-8000-000000000006', 'q-loop-c1', '{"type":"fill_blank","blanks":[["while"]],"caseSensitive":false,"explanation":"while keeps going until the condition is false.","hints":["Think of the word that means \"as long as\".","It has five letters and starts with w."]}');

-- ---------- paired pre and post tests (twin items share a pair_key) ----------

insert into public.assessments (id, module_id, kind, title) values
  ('60000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'pre', 'Variables and Loops: pre-test'),
  ('60000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', 'post', 'Variables and Loops: post-test');

insert into public.assessment_items (assessment_id, position, pair_key, concept_id, question_id, content) values
  ('60000000-0000-4000-8000-000000000001', 0, 'assign', 'variables', 'pre-assign', '{"id":"pre-assign","type":"mcq","prompt":"Which line stores the number 5 in a variable named count?","conceptId":"variables","choices":[{"id":"a","text":"count = 5"},{"id":"b","text":"5 = count"},{"id":"c","text":"count == 5"}]}'),
  ('60000000-0000-4000-8000-000000000001', 1, 'update', 'variables', 'pre-update', '{"id":"pre-update","type":"mcq","prompt":"After `n = 1` then `n = n + 1`, what is n?","conceptId":"variables","choices":[{"id":"a","text":"1"},{"id":"b","text":"2"},{"id":"c","text":"11"}]}'),
  ('60000000-0000-4000-8000-000000000001', 2, 'count', 'loops', 'pre-count', '{"id":"pre-count","type":"mcq","prompt":"How many times does `for i in range(3):` run its body?","conceptId":"loops","choices":[{"id":"a","text":"2"},{"id":"b","text":"3"},{"id":"c","text":"4"}]}'),
  ('60000000-0000-4000-8000-000000000001', 3, 'keyword', 'loops', 'pre-keyword', '{"id":"pre-keyword","type":"short_answer","prompt":"What keyword starts a loop that repeats while a condition is true?","conceptId":"loops"}'),
  ('60000000-0000-4000-8000-000000000001', 4, 'blanks', 'loops', 'pre-blanks', '{"id":"pre-blanks","type":"fill_blank","prompt":"Complete: ___ i in ___(3):","conceptId":"loops"}'),
  ('60000000-0000-4000-8000-000000000002', 0, 'assign', 'variables', 'post-assign', '{"id":"post-assign","type":"mcq","prompt":"Which line stores the number 9 in a variable named total?","conceptId":"variables","choices":[{"id":"a","text":"9 = total"},{"id":"b","text":"total = 9"},{"id":"c","text":"total == 9"}]}'),
  ('60000000-0000-4000-8000-000000000002', 1, 'update', 'variables', 'post-update', '{"id":"post-update","type":"mcq","prompt":"After `s = 4` then `s = s + 3`, what is s?","conceptId":"variables","choices":[{"id":"a","text":"7"},{"id":"b","text":"43"},{"id":"c","text":"4"}]}'),
  ('60000000-0000-4000-8000-000000000002', 2, 'count', 'loops', 'post-count', '{"id":"post-count","type":"mcq","prompt":"How many times does `for i in range(5):` run its body?","conceptId":"loops","choices":[{"id":"a","text":"4"},{"id":"b","text":"6"},{"id":"c","text":"5"}]}'),
  ('60000000-0000-4000-8000-000000000002', 3, 'keyword', 'loops', 'post-keyword', '{"id":"post-keyword","type":"short_answer","prompt":"Which keyword repeats code as long as a condition holds?","conceptId":"loops"}'),
  ('60000000-0000-4000-8000-000000000002', 4, 'blanks', 'loops', 'post-blanks', '{"id":"post-blanks","type":"fill_blank","prompt":"Complete: ___ n in ___(4):","conceptId":"loops"}');

insert into public.assessment_keys (assessment_item_id, key)
select i.id, k.key::jsonb from public.assessment_items i
join (values
  ('pre-assign', '{"type":"mcq","correctChoiceId":"a"}'),
  ('pre-update', '{"type":"mcq","correctChoiceId":"b"}'),
  ('pre-count', '{"type":"mcq","correctChoiceId":"b"}'),
  ('pre-keyword', '{"type":"short_answer","accepted":["while"],"caseSensitive":false}'),
  ('pre-blanks', '{"type":"fill_blank","blanks":[["for"],["range"]],"caseSensitive":false}'),
  ('post-assign', '{"type":"mcq","correctChoiceId":"b"}'),
  ('post-update', '{"type":"mcq","correctChoiceId":"a"}'),
  ('post-count', '{"type":"mcq","correctChoiceId":"c"}'),
  ('post-keyword', '{"type":"short_answer","accepted":["while"],"caseSensitive":false}'),
  ('post-blanks', '{"type":"fill_blank","blanks":[["for"],["range"]],"caseSensitive":false}')
) as k(question_id, key) on k.question_id = i.question_id;

-- Publish last: from here on the module and everything under it is frozen.
update public.modules set status = 'published', published_at = now() where id = '20000000-0000-4000-8000-000000000001';

-- ---------- classes ----------

insert into public.schools (id, name) values ('30000000-0000-4000-8000-000000000001', 'Demo High School');
insert into public.classes (id, school_id, name, term, kind) values
  ('11000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 'Demo Period 1', 'Fall 2026', 'school'),
  ('11000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000001', 'Demo Period 3', 'Fall 2026', 'school');
insert into public.class_join_codes (class_id, code_hash) values ('11000000-0000-4000-8000-000000000001', public._code_hash('DEMO-JOIN-1234'));

insert into public.class_modules (class_id, module_id, position) values
  ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 0),
  ('11000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 0),
  ('11000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', 0);

-- One unclaimed seat with a known login code, for walking the sign-in flow.
with seat as (
  insert into public.class_members (class_id, member_role, display_name)
  values ('11000000-0000-4000-8000-000000000001', 'student', 'Demo S.') returning id)
insert into public.member_login_codes (member_id, code_hash) select id, public._code_hash('DEMO-0000-0000-0001') from seat;

-- ---------- fake students with fake work ----------
-- 10 in Period 1 and 7 in Period 3, with a spread of results:
--   student 3  took the pre-test only (shows "incomplete")      student 6  has not started
--   student 4  is stuck on the loops check (3 wrong attempts)    everyone else finished the module

do $$
declare
  names text[] := array['Ava K.','Ben T.','Cam R.','Dee M.','Eli S.','Fay L.','Gus P.','Hana O.','Ivy N.','Jo W.',
                        'Kai D.','Lena B.','Max H.','Nia C.','Omar F.','Pia G.','Quinn V.'];
  v_uid uuid;
  v_class uuid;
  v_i int;
  v_kind text;
  v_a record;
  v_item record;
  v_p numeric;
  v_ok boolean;
  v_resp jsonb;
  v_total int;
  v_right int;
begin
  for v_i in 1..17 loop
    v_uid := ('b0000000-0000-4000-8000-' || lpad(v_i::text, 12, '0'))::uuid;
    v_class := case when v_i <= 10 then '11000000-0000-4000-8000-000000000001' else '11000000-0000-4000-8000-000000000002' end;
    insert into auth.users (id, aud, role, is_anonymous) values (v_uid, 'authenticated', 'authenticated', true);
    insert into public.class_members (class_id, profile_id, member_role, display_name, claimed_at)
    values (v_class, v_uid, 'student', names[v_i], now());
    update public.profiles set display_name = names[v_i] where id = v_uid;

    if v_i = 6 then continue; end if;      -- not started

    -- pre-test, then post-test (unless this student has not got that far)
    foreach v_kind in array array['pre', 'post'] loop
      if v_kind = 'post' and (v_i = 3 or v_i = 4) then continue; end if;
      -- chance of a right answer: modest before, clearly better after, varying by student
      v_p := case when v_kind = 'pre' then 0.25 + 0.04 * (v_i % 5) else 0.70 + 0.04 * (v_i % 5) end;
      v_total := 0; v_right := 0;
      for v_item in
        select i.id, i.content ->> 'type' as t, k.key, a.id as aid from public.assessment_items i
        join public.assessments a on a.id = i.assessment_id and a.kind = v_kind
        join public.assessment_keys k on k.assessment_item_id = i.id
      loop
        v_ok := (('x' || substr(md5(v_i::text || v_item.id::text), 1, 6))::bit(24)::int / 16777216.0) < v_p;
        v_resp := case v_item.t
          when 'mcq' then jsonb_build_object('choice_id', case when v_ok then v_item.key ->> 'correctChoiceId' else 'zz' end)
          when 'short_answer' then jsonb_build_object('text', case when v_ok then v_item.key -> 'accepted' ->> 0 else 'not sure' end)
          else jsonb_build_object('blanks', case when v_ok then (select jsonb_agg(b ->> 0) from jsonb_array_elements(v_item.key -> 'blanks') b) else '["x","y"]'::jsonb end)
        end;
        insert into public.assessment_responses (student_id, class_id, assessment_item_id, response, is_correct)
        values (v_uid, v_class, v_item.id, v_resp, v_ok);
        v_total := v_total + 1; v_right := v_right + case when v_ok then 1 else 0 end;
      end loop;
      insert into public.assessment_results (student_id, class_id, assessment_id, score_pct, per_concept)
      select v_uid, v_class, a.id, round(100.0 * v_right / v_total, 2),
        (select jsonb_object_agg(x.concept_id, x.pct) from (
           select i.concept_id, round(100.0 * count(*) filter (where r.is_correct) / count(*), 2) as pct
           from public.assessment_responses r join public.assessment_items i on i.id = r.assessment_item_id
           where i.assessment_id = a.id and r.student_id = v_uid group by i.concept_id) x)
      from public.assessments a where a.module_id = '20000000-0000-4000-8000-000000000001' and a.kind = v_kind;
    end loop;

    -- activity progress
    if v_i = 3 then continue; end if;      -- pre-test only: nothing else yet
    for v_a in select a.id, a.kind from public.activities a join public.lessons l on l.id = a.lesson_id
               where l.module_id = '20000000-0000-4000-8000-000000000001' order by l.position, a.position loop
      if v_i = 4 and v_a.id = '50000000-0000-4000-8000-000000000006' then
        -- stuck: three wrong tries and a long time on the loops check
        insert into public.progress (student_id, class_id, activity_id, status, best_score, time_spent_s)
        values (v_uid, v_class, v_a.id, 'in_progress', 0, 780);
        for v_item in select generate_series(1, 3) as n loop
          insert into public.submissions (student_id, class_id, activity_id, response, is_correct, score, results, attempt_no)
          values (v_uid, v_class, v_a.id, '{"answers":{"q-loop-c1":{"blanks":["for"]}}}', false, 0,
                  '{"q-loop-c1":{"correct":false,"concept":"loops"}}', v_item.n);
        end loop;
        exit;
      end if;
      insert into public.progress (student_id, class_id, activity_id, status, best_score, time_spent_s, completed_at)
      values (v_uid, v_class, v_a.id, 'completed', 100, 60 + (v_i * 17) % 120, now() - ((v_i % 4) || ' hours')::interval);
    end loop;
  end loop;
end $$;

commit;

-- First tries for the misconception radar: several Demo Period 1 students first answered the variables
-- check and the range question wrong, then fixed it. Made-up demo answers, no real student data.
do $$
declare
  r record;
  n int := 0;
begin
  for r in
    select m.profile_id from public.class_members m
    join public.progress p on p.student_id = m.profile_id and p.class_id = m.class_id
      and p.activity_id = '50000000-0000-4000-8000-000000000005' and p.status = 'completed'
    where m.class_id = '11000000-0000-4000-8000-000000000001' and m.member_role = 'student'
    order by m.display_name
  loop
    n := n + 1;
    if n % 4 = 0 then                     -- some got it right first time
      insert into public.submissions (student_id, class_id, activity_id, response, is_correct, score, results, attempt_no) values
        (r.profile_id, '11000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000003',
         '{"answers":{"q-vars-1":{"choice_id":"b"}}}', true, 100, '{"q-vars-1":{"correct":true,"concept":"variables"}}', 1);
      continue;
    end if;
    insert into public.submissions (student_id, class_id, activity_id, response, is_correct, score, results, attempt_no) values
      (r.profile_id, '11000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000003',
       jsonb_build_object('answers', jsonb_build_object('q-vars-1', jsonb_build_object('choice_id', case when n % 3 = 0 then 'a' else 'c' end))),
       false, 0, '{"q-vars-1":{"correct":false,"concept":"variables"}}', 1),
      (r.profile_id, '11000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000003',
       '{"answers":{"q-vars-1":{"choice_id":"b"}}}', true, 100, '{"q-vars-1":{"correct":true,"concept":"variables"}}', 2);
    if n % 2 = 1 then
      insert into public.submissions (student_id, class_id, activity_id, response, is_correct, score, results, attempt_no) values
        (r.profile_id, '11000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000005',
         '{"answers":{"q-loop-1":{"text":"range"},"q-loop-2":{"blanks":["for","range"]},"q-loop-3":{"order":["l1","l2","l3","l4"]},"q-loop-4":{"choice_id":"a"}}}',
         false, 75, '{"q-loop-1":{"correct":true,"concept":"loops"},"q-loop-2":{"correct":true,"concept":"loops"},"q-loop-3":{"correct":true,"concept":"loops"},"q-loop-4":{"correct":false,"concept":"loops"}}', 1);
    end if;
  end loop;
end $$;
