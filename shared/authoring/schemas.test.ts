import { describe, expect, it } from 'vitest';
import {
  authoredAssessment,
  authoredModule,
  authoredQuestion,
  mcqContent,
  pairWarnings,
  parseYouTubeId,
  splitModule,
  splitQuestion,
  youtubeEmbedUrl,
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
