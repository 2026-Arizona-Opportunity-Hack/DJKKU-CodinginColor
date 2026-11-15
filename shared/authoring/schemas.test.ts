import { describe, expect, it } from 'vitest';
import {
  authoredActivity,
  authoredAssessment,
  authoredModule,
  authoredQuestion,
  mcqContent,
  fromDraftRows,
  pairWarnings,
  parseYouTubeId,
  slugify,
  toDraftPayload,
  type DraftRows,
  splitModule,
  splitQuestion,
  youtubeEmbedUrl,
  type AuthoredAssessment,
  type AuthoredModule,
  type AuthoredQuestion,
} from './schemas';

const mcq = (over: Partial<AuthoredQuestion> = {}): AuthoredQuestion => ({
  content: {
    type: 'mcq', id: 'q1', prompt: 'What does a loop do?', conceptId: 'loops',
    choices: [{ id: 'a', text: 'Repeats code' }, { id: 'b', text: 'Deletes code' }],
  },
  key: { type: 'mcq', correctChoiceId: 'a', explanation: 'Loops repeat', hints: [] },
  ...over,
});

describe('parseYouTubeId', () => {
  it.each([
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://youtu.be/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://www.youtube.com/embed/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
  ])('accepts %s', (url, expected) => expect(parseYouTubeId(url)).toBe(expected));

  it.each([
    'http://www.youtube.com/watch?v=dQw4w9WgXcQ', // not https
    'https://evil.com/watch?v=dQw4w9WgXcQ',
    'https://youtube.com.evil.com/watch?v=dQw4w9WgXcQ',
    'javascript:alert(1)',
    'https://www.youtube.com/watch?v=short',
    'not a url',
    '',
  ])('rejects %s', (url) => expect(parseYouTubeId(url)).toBeNull());

  it('builds a privacy-enhanced embed url', () => {
    expect(youtubeEmbedUrl('dQw4w9WgXcQ')).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
  });
});

describe('question content is strict', () => {
  it('rejects an answer field smuggled into student content', () => {
    const r = mcqContent.safeParse({ ...mcq().content, correctChoiceId: 'a' });
    expect(r.success).toBe(false);
  });
  it('needs at least two choices and unique ids', () => {
    expect(mcqContent.safeParse({ ...mcq().content, choices: [{ id: 'a', text: 'x' }] }).success).toBe(false);
    expect(mcqContent.safeParse({ ...mcq().content, choices: [{ id: 'a', text: 'x' }, { id: 'a', text: 'y' }] }).success).toBe(false);
  });
});

describe('authoredQuestion cross checks', () => {
  it('accepts a valid mcq', () => expect(authoredQuestion.safeParse(mcq()).success).toBe(true));

  it('rejects a correct choice that is not in the choices', () => {
    const q = mcq({ key: { type: 'mcq', correctChoiceId: 'zzz', hints: [] } });
    expect(authoredQuestion.safeParse(q).success).toBe(false);
  });

  it('rejects a key whose type does not match', () => {
    const q = mcq({ key: { type: 'short_answer', accepted: ['x'], caseSensitive: false, hints: [] } });
    expect(authoredQuestion.safeParse(q).success).toBe(false);
  });

  it('rejects a scored question with no key', () => {
    expect(authoredQuestion.safeParse(mcq({ key: null })).success).toBe(false);
  });

  it('reflection needs no concept and no key, and cannot have one', () => {
    const content = { type: 'reflection' as const, id: 'r1', prompt: 'What was hard?' };
    expect(authoredQuestion.safeParse({ content, key: null }).success).toBe(true);
    const withKey = { content, key: { type: 'short_answer', accepted: ['x'], caseSensitive: false, hints: [] } };
    expect(authoredQuestion.safeParse(withKey).success).toBe(false);
  });

  it('a scored question must have a concept tag', () => {
    const { conceptId: _drop, ...noConcept } = mcq().content as Record<string, unknown>;
    expect(authoredQuestion.safeParse({ content: noConcept, key: mcq().key }).success).toBe(false);
  });

  it('fill in the blank: answer sets must match the blank count', () => {
    const content = { type: 'fill_blank' as const, id: 'f1', prompt: 'for i in ___(3): print(___)', conceptId: 'loops' };
    const ok = { content, key: { type: 'fill_blank', blanks: [['range'], ['i']], caseSensitive: false, hints: [] } };
    const bad = { content, key: { type: 'fill_blank', blanks: [['range']], caseSensitive: false, hints: [] } };
    expect(authoredQuestion.safeParse(ok).success).toBe(true);
    expect(authoredQuestion.safeParse(bad).success).toBe(false);
    expect(authoredQuestion.safeParse({ content: { ...content, prompt: 'no blanks here' }, key: ok.key }).success).toBe(false);
  });

  it('ordering: correct order must be a permutation of the items', () => {
    const content = {
      type: 'ordering' as const, id: 'o1', prompt: 'Order the steps', conceptId: 'vars',
      items: [{ id: 'a', text: 'one' }, { id: 'b', text: 'two' }, { id: 'c', text: 'three' }],
    };
    const key = (correctOrder: string[]) => ({ type: 'ordering' as const, correctOrder, hints: [] });
    expect(authoredQuestion.safeParse({ content, key: key(['a', 'b', 'c']) }).success).toBe(true);
    expect(authoredQuestion.safeParse({ content, key: key(['a', 'b']) }).success).toBe(false);
    expect(authoredQuestion.safeParse({ content, key: key(['a', 'a', 'b']) }).success).toBe(false);
    expect(authoredQuestion.safeParse({ content, key: key(['a', 'b', 'x']) }).success).toBe(false);
  });

  it('caps the hint ladder at 3', () => {
    const q = mcq({ key: { type: 'mcq', correctChoiceId: 'a', hints: ['1', '2', '3', '4'] } });
    expect(authoredQuestion.safeParse(q).success).toBe(false);
  });
});

describe('splitQuestion', () => {
  it('never ships the solved order for ordering questions', () => {
    for (const order of [['a', 'b', 'c'], ['c', 'b', 'a'], ['b', 'a', 'c']]) {
      const q: AuthoredQuestion = {
        content: {
          type: 'ordering', id: 'o1', prompt: 'Order', conceptId: 'vars',
          items: order.map((i) => ({ id: i, text: `step ${i}` })),
        },
        key: { type: 'ordering', correctOrder: order, hints: [] },
      };
      const { content } = splitQuestion(q);
      expect(content.type).toBe('ordering');
      if (content.type === 'ordering') {
        expect(content.items.map((i) => i.id)).not.toEqual(order);
        expect([...content.items.map((i) => i.id)].sort()).toEqual([...order].sort());
      }
    }
  });
});

// A module with one of each kind of secret, so the payload test can search for them.
const SECRETS = ['SECRET-ANSWER-SHORT', 'SECRET-ANSWER-BLANK', 'SECRET-EXPLANATION', 'SECRET-HINT'];
const sampleModule = (): AuthoredModule => ({
  title: 'Variables and loops',
  summary: 'Intro',
  status: 'draft',
  lessons: [
    {
      title: 'Lesson 1',
      activities: [
        { kind: 'video', title: 'Watch', required: true, youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ' },
        {
          kind: 'worksheet', title: 'Practice', required: true,
          questions: [
            { ...mcq(), key: { type: 'mcq', correctChoiceId: 'a', explanation: SECRETS[2], hints: [SECRETS[3]!] } },
            {
              content: { type: 'short_answer', id: 'q2', prompt: 'Name the keyword', conceptId: 'loops' },
              key: { type: 'short_answer', accepted: [SECRETS[0]!], caseSensitive: false, hints: [] },
            },
            {
              content: { type: 'fill_blank', id: 'q3', prompt: 'x = ___', conceptId: 'vars' },
              key: { type: 'fill_blank', blanks: [[SECRETS[1]!]], caseSensitive: false, hints: [] },
            },
          ],
        },
      ],
    },
  ],
});

describe('splitModule: no answer keys in the student payload', () => {
  it('student JSON contains none of the secrets and no key fields', () => {
    const { student, keys } = splitModule(sampleModule());
    const json = JSON.stringify(student);
    for (const s of SECRETS) expect(json).not.toContain(s);
    for (const field of ['correctChoiceId', 'accepted', 'blanks', 'correctOrder', 'explanation', 'hints']) {
      expect(json).not.toContain(`"${field}"`);
    }
    // ...while the keys are all kept for activity_keys.
    expect(keys).toHaveLength(3);
    expect(JSON.stringify(keys)).toContain(SECRETS[0]);
  });

  it('turns the video link into a privacy-enhanced embed', () => {
    const { student } = splitModule(sampleModule());
    expect(JSON.stringify(student)).toContain('youtube-nocookie.com/embed/dQw4w9WgXcQ');
    expect(JSON.stringify(student)).not.toContain('youtu.be');
  });
});

describe('authoredModule validation', () => {
  it('rejects a bad video link and empty lessons', () => {
    const m = sampleModule();
    (m.lessons[0]!.activities[0] as { youtubeUrl: string }).youtubeUrl = 'https://evil.com/x';
    expect(authoredModule.safeParse(m).success).toBe(false);
    expect(authoredModule.safeParse({ ...sampleModule(), lessons: [] }).success).toBe(false);
  });
  it('rejects unknown fields instead of passing them along', () => {
    expect(authoredModule.safeParse({ ...sampleModule(), isAdmin: true }).success).toBe(false);
  });
  it('rejects an empty title', () => {
    expect(authoredModule.safeParse({ ...sampleModule(), title: '   ' }).success).toBe(false);
  });
});

describe('assessments', () => {
  const item = (pairKey: string) => ({ pairKey, question: mcq() });
  const test = (kind: 'pre' | 'post', keys: string[]) => authoredAssessment.parse({ kind, items: keys.map(item) });

  it('rejects duplicate pair keys and reflection items', () => {
    expect(authoredAssessment.safeParse({ kind: 'pre', items: [item('a'), item('a')] }).success).toBe(false);
    const reflection = { pairKey: 'r', question: { content: { type: 'reflection', id: 'r', prompt: 'Why?' }, key: null } };
    expect(authoredAssessment.safeParse({ kind: 'pre', items: [reflection] }).success).toBe(false);
  });

  it('warns about items with no twin on the other test', () => {
    const w = pairWarnings(test('pre', ['a', 'b']), test('post', ['a', 'c']));
    expect(w).toHaveLength(2);
    expect(w.join(' ')).toContain('"b"');
    expect(w.join(' ')).toContain('"c"');
  });

  it('no warnings when every item is paired', () => {
    expect(pairWarnings(test('pre', ['a']), test('post', ['a']))).toEqual([]);
  });
});


// ---------- concept ids, slugify, and the save_module_draft payload ----------

const KEY_FIELDS = ['correctChoiceId', 'accepted', 'blanks', 'correctOrder', 'hints', 'explanation', 'caseSensitive'];
/** Every object key anywhere inside `value`. */
function allKeys(value: unknown, out: string[] = []): string[] {
  if (Array.isArray(value)) value.forEach((v) => allKeys(v, out));
  else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      out.push(k);
      allKeys(v, out);
    }
  }
  return out;
}

const q = (type: string, id: string, extra: object, key: object, conceptId = 'loops'): AuthoredQuestion =>
  ({ content: { type, id, prompt: `Prompt ${id}`, conceptId, ...extra }, key }) as AuthoredQuestion;
const ordering = q('ordering', 'q-ord', { items: [{ id: 'i1', text: 'First' }, { id: 'i2', text: 'Second' }, { id: 'i3', text: 'Third' }] },
  { type: 'ordering', correctOrder: ['i1', 'i2', 'i3'], explanation: 'In order', hints: ['Think about time'] });
const fill = q('fill_blank', 'q-fill', { prompt: 'A ___ repeats and a ___ decides' }, { type: 'fill_blank', blanks: [['loop', 'for'], ['if']], caseSensitive: false, hints: [] });
const short = q('short_answer', 'q-short', {}, { type: 'short_answer', accepted: ['while', 'While'], caseSensitive: true, hints: ['A keyword'] });
const reflection: AuthoredQuestion = { content: { type: 'reflection', id: 'q-ref', prompt: 'What was hard?' }, key: null };

const fullModule: AuthoredModule = {
  title: 'Variables and Loops',
  summary: 'A starter module.',
  status: 'draft',
  lessons: [
    {
      title: 'Lesson 1',
      activities: [
        { kind: 'video', title: 'Watch', required: true, conceptId: 'variables', youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', transcript: 'Words' },
        { kind: 'reading', title: 'Read', required: false, body: 'Some **markdown**' },
        { kind: 'check', title: 'Check', required: true, conceptId: 'loops', questions: [mcq(), short, ordering] },
        { kind: 'worksheet', title: 'Sheet', required: true, questions: [fill, reflection] },
        { kind: 'exit', title: 'Exit', required: true, questions: [reflection] },
      ],
    },
    { title: 'Lesson 2', activities: [{ kind: 'reading', title: 'More', required: true, body: 'Text' }] },
  ],
};
const test = (kind: 'pre' | 'post', suffix: string): AuthoredAssessment => ({
  kind,
  items: [
    { pairKey: 'p1', question: mcq({ content: { ...mcq().content, id: `m-${suffix}` } as AuthoredQuestion['content'] }) },
    { pairKey: 'p2', conceptId: 'variables', question: { ...short, content: { ...short.content, id: `s-${suffix}` } as AuthoredQuestion['content'] } },
    { pairKey: 'p3', question: { ...ordering, content: { ...ordering.content, id: `o-${suffix}` } as AuthoredQuestion['content'] } },
    { pairKey: 'p4', question: { ...fill, content: { ...fill.content, id: `f-${suffix}` } as AuthoredQuestion['content'] } },
  ],
});
const PRE = test('pre', 'pre');
const POST = test('post', 'post');

describe('conceptId on activities and test items', () => {
  it('is optional, can be null, and must be a valid id', () => {
    const base = { kind: 'reading', title: 'Read', required: true, body: 'x' };
    expect(authoredActivity.safeParse(base).success).toBe(true);
    expect(authoredActivity.safeParse({ ...base, conceptId: null }).success).toBe(true);
    expect(authoredActivity.safeParse({ ...base, conceptId: 'loops' }).success).toBe(true);
    expect(authoredActivity.safeParse({ ...base, conceptId: 'not valid!' }).success).toBe(false);
    expect(authoredActivity.safeParse({ ...base, concept: 'loops' }).success).toBe(false); // still strict
  });

  it('is accepted on a test item', () => {
    expect(authoredAssessment.safeParse(PRE).success).toBe(true);
    expect(authoredAssessment.safeParse({ kind: 'pre', items: [{ pairKey: 'p1', conceptId: 'x y', question: mcq() }] }).success).toBe(false);
  });
});

describe('slugify', () => {
  it.each([
    ['Variables and Loops', 'variables-and-loops'],
    ['  Café: Intro to Python!  ', 'cafe-intro-to-python'],
    ['---a---b---', 'a-b'],
    ['!!!', ''],
  ])('%s -> %s', (input, expected) => expect(slugify(input)).toBe(expected));

  it('is at most 60 characters, never ends in a dash, and matches the database rule', () => {
    const s = slugify('word '.repeat(40));
    expect(s.length).toBeLessThanOrEqual(60);
    expect(s).toMatch(/^[a-z0-9-]{1,64}$/);
    expect(s.endsWith('-')).toBe(false);
  });
});

describe('toDraftPayload', () => {
  const payload = toDraftPayload({ moduleId: null, module: fullModule, pre: PRE, post: POST });

  it('has the save_module_draft shape', () => {
    expect(payload).toMatchObject({ module_id: null, slug: 'variables-and-loops', title: 'Variables and Loops', summary: 'A starter module.' });
    expect(payload.lessons).toHaveLength(2);
    expect(payload.lessons[0]!.activities.map((a) => a.kind)).toEqual(['video', 'reading', 'check', 'worksheet', 'exit']);
    expect(payload.assessments.map((a) => a.kind)).toEqual(['pre', 'post']);
    expect(payload.assessments[0]!.title).toBe('Variables and Loops pre-test');
  });

  it('never puts a key field anywhere inside any content', () => {
    const contents = [
      ...payload.lessons.flatMap((l) => l.activities.map((a) => a.content)),
      ...payload.assessments.flatMap((t) => t.items.map((i) => i.content)),
    ];
    expect(contents.length).toBeGreaterThan(10);
    for (const c of contents) for (const k of allKeys(c)) expect(KEY_FIELDS).not.toContain(k);
  });

  it('attaches each key to the right question id, and none to a reflection', () => {
    const [, , check, sheet, exit] = payload.lessons[0]!.activities;
    expect(check!.keys.map((k) => k.question_id)).toEqual(['q1', 'q-short', 'q-ord']);
    expect(check!.keys[0]!.key).toMatchObject({ type: 'mcq', correctChoiceId: 'a' });
    expect(check!.keys[1]!.key).toMatchObject({ type: 'short_answer', accepted: ['while', 'While'], caseSensitive: true });
    expect(sheet!.keys.map((k) => k.question_id)).toEqual(['q-fill']);
    expect(exit!.keys).toEqual([]);
    expect(payload.lessons[0]!.activities[0]!.keys).toEqual([]);
  });

  it('turns a video link into a privacy-enhanced embed and drops an empty transcript', () => {
    const video = payload.lessons[0]!.activities[0]!;
    expect(video.content).toEqual({ embedUrl: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ', transcript: 'Words' });
    const bare = toDraftPayload({
      moduleId: 'm1',
      slug: 'keep-me',
      module: { ...fullModule, lessons: [{ title: 'L', activities: [{ kind: 'video', title: 'V', required: true, youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ', transcript: '' }] }] },
      pre: null,
      post: null,
    });
    expect(bare.lessons[0]!.activities[0]!.content).toEqual({ embedUrl: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ' });
    expect(bare).toMatchObject({ module_id: 'm1', slug: 'keep-me', assessments: [] });
  });

  it('tags activities and test items with their concept', () => {
    expect(payload.lessons[0]!.activities.map((a) => a.concept_id)).toEqual(['variables', null, 'loops', null, null]);
    expect(payload.assessments[0]!.items.map((i) => i.concept_id)).toEqual(['loops', 'variables', 'loops', 'loops']);
    expect(payload.assessments[0]!.items[0]).toMatchObject({ pair_key: 'p1', question_id: 'm-pre' });
    expect(payload.assessments[1]!.items[1]!.key).toMatchObject({ type: 'short_answer' });
  });

  it('never ships ordering items in the solved order', () => {
    const items = payload.lessons[0]!.activities[2]!.content.questions as { id: string; items?: { id: string }[] }[];
    const shown = items.find((x) => x.id === 'q-ord')!.items!.map((i) => i.id);
    expect(shown).not.toEqual(['i1', 'i2', 'i3']);
  });

  it('refuses an invalid module instead of sending it', () => {
    expect(() => toDraftPayload({ moduleId: null, module: { ...fullModule, title: '' }, pre: null, post: null })).toThrow();
    expect(() => toDraftPayload({ moduleId: null, module: fullModule, pre: { kind: 'pre', items: [{ pairKey: 'p', question: { content: reflection.content, key: null } }] }, post: null })).toThrow();
  });
});

describe('fromDraftRows', () => {
  /** What the database would hand back for a saved payload: rows plus the key lists. */
  function rowsFor(p: ReturnType<typeof toDraftPayload>): DraftRows {
    const rows: DraftRows = { module: { title: p.title, summary: p.summary, status: 'draft' }, lessons: [], activities: [], assessments: [], assessmentItems: [], activityKeys: {}, assessmentKeys: {} };
    p.lessons.forEach((l, li) => {
      rows.lessons.push({ id: `l${li}`, position: li, title: l.title });
      l.activities.forEach((a, ai) => {
        const id = `a${li}-${ai}`;
        rows.activities.push({ id, lesson_id: `l${li}`, position: ai, kind: a.kind, title: a.title, content: a.content, required: a.required, concept_id: a.concept_id });
        rows.activityKeys[id] = [...a.keys].reverse(); // the database orders keys by question id, not position
      });
    });
    p.assessments.forEach((t, ti) => {
      rows.assessments.push({ id: `t${ti}`, kind: t.kind });
      rows.assessmentKeys[`t${ti}`] = t.items.map((i) => ({ question_id: i.question_id, key: i.key }));
      t.items.forEach((i, ii) => rows.assessmentItems.push({ assessment_id: `t${ti}`, position: ii, pair_key: i.pair_key, concept_id: i.concept_id!, question_id: i.question_id, content: i.content }));
    });
    return rows;
  }

  it('round-trips a whole module with every question type, in the same order', () => {
    const back = fromDraftRows(rowsFor(toDraftPayload({ moduleId: null, module: fullModule, pre: PRE, post: POST })));
    expect(back.module).toEqual(fullModule);
    expect(back.pre).toEqual(PRE);
    expect(back.post).toEqual(POST);
  });

  it('restores the author\'s ordering even though students see it shuffled', () => {
    const back = fromDraftRows(rowsFor(toDraftPayload({ moduleId: null, module: fullModule, pre: null, post: null })));
    const check = back.module.lessons[0]!.activities[2]!;
    const items = (check as { questions: AuthoredQuestion[] }).questions[2]!.content;
    expect(items.type === 'ordering' && items.items.map((i) => i.id)).toEqual(['i1', 'i2', 'i3']);
  });

  it('returns no tests when there are none, and opens a half-finished draft without throwing', () => {
    const rows = rowsFor(toDraftPayload({ moduleId: null, module: fullModule, pre: null, post: null }));
    expect(fromDraftRows(rows)).toMatchObject({ pre: null, post: null });
    const broken = { ...rows, activityKeys: {}, activities: rows.activities.map((a) => (a.kind === 'video' ? { ...a, content: {} } : a)) };
    const loaded = fromDraftRows(broken);
    expect(loaded.module.lessons[0]!.activities[0]).toMatchObject({ kind: 'video', youtubeUrl: '' });
    const check = loaded.module.lessons[0]!.activities[2] as { questions: AuthoredQuestion[] };
    expect(check.questions[0]!.key).toBeNull(); // keys we could not read stay empty, never invented
  });

  it('keeps the module status', () => {
    const rows = rowsFor(toDraftPayload({ moduleId: null, module: fullModule, pre: null, post: null }));
    expect(fromDraftRows({ ...rows, module: { ...rows.module, status: 'published' } }).module.status).toBe('published');
  });
});
