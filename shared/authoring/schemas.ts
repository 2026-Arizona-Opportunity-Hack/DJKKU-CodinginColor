// schemas.ts: zod schemas for the authoring studio (lane C).
//
// THE KEY RULE: what a student or reviewer can receive ("content") and what
// only authors and the grader can receive ("key") are separate shapes. Content
// schemas are .strict(), so a stray answer field is rejected instead of being
// passed along. splitQuestion() is the only place an authored question is
// turned into the two halves; the studio saves content to `activities` and the
// key to `activity_keys`.
//
// The same schemas validate the browser form AND the data again where it
// reaches the server, so input is checked twice.

import { z } from 'zod';
import { findUnpairedItems } from './gain';

// ---------- small building blocks ----------

const id = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/, 'Use letters, numbers, dash or underscore');
const text = (max: number) => z.string().trim().min(1, 'Required').max(max);
export const BLANK = '___'; // marks a blank in fill-in-the-blank text

// ---------- YouTube ----------

const YT_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com']);
const YT_ID = /^[A-Za-z0-9_-]{11}$/;

/** Returns the 11-char video id for a YouTube link, or null. Only https and known hosts pass. */
export function parseYouTubeId(raw: string): string | null {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  if (u.protocol !== 'https:') return null;
  let candidate: string | null = null;
  if (u.hostname === 'youtu.be') candidate = u.pathname.slice(1);
  else if (YT_HOSTS.has(u.hostname)) {
    if (u.pathname === '/watch') candidate = u.searchParams.get('v');
    else {
      const m = u.pathname.match(/^\/(?:embed|shorts|live)\/([^/]+)$/);
      candidate = m?.[1] ?? null;
    }
  }
  return candidate && YT_ID.test(candidate) ? candidate : null;
}

/** Privacy-enhanced embed URL (no cookies until play), per the plan. */
export function youtubeEmbedUrl(videoId: string): string {
  return `https://www.youtube-nocookie.com/embed/${videoId}`;
}

export const youtubeUrlSchema = z
  .string()
  .refine((v) => parseYouTubeId(v) !== null, 'Enter a valid https YouTube link');

// ---------- question content (safe to send to students) ----------

const choice = z.object({ id, text: text(300) }).strict();
const idsUnique = (items: { id: string }[]) => new Set(items.map((i) => i.id)).size === items.length;

const scoredBase = { id, prompt: text(2000), conceptId: id };

export const mcqContent = z
  .object({ ...scoredBase, type: z.literal('mcq'), choices: z.array(choice).min(2).max(8) })
  .strict()
  .refine((q) => idsUnique(q.choices), { message: 'Choice ids must be unique', path: ['choices'] });

export const shortAnswerContent = z
  .object({ ...scoredBase, type: z.literal('short_answer') })
  .strict();

export const fillBlankContent = z
  .object({ ...scoredBase, type: z.literal('fill_blank') })
  .strict()
  .refine((q) => q.prompt.split(BLANK).length - 1 >= 1, {
    message: `Add at least one blank, written as ${BLANK}`,
    path: ['prompt'],
  });

export const orderingContent = z
  .object({ ...scoredBase, type: z.literal('ordering'), items: z.array(choice).min(2).max(10) })
  .strict()
  .refine((q) => idsUnique(q.items), { message: 'Item ids must be unique', path: ['items'] });

/** Reflection is never scored, so it has no concept and no key. */
export const reflectionContent = z
  .object({ id, prompt: text(2000), type: z.literal('reflection') })
  .strict();

export const questionContent = z.union([
  mcqContent,
  shortAnswerContent,
  fillBlankContent,
  orderingContent,
  reflectionContent,
]);
export type QuestionContent = z.infer<typeof questionContent>;

// ---------- answer keys (author, grader and admin only) ----------

const explanation = z.string().trim().max(1000).optional();
const hints = z.array(text(500)).max(3).default([]); // hint ladder, max 3 like the AI cap

export const questionKey = z.discriminatedUnion('type', [
  z.object({ type: z.literal('mcq'), correctChoiceId: id, explanation, hints }).strict(),
  z
    .object({
      type: z.literal('short_answer'),
      accepted: z.array(text(200)).min(1).max(10),
      caseSensitive: z.boolean().default(false),
      explanation,
      hints,
    })
    .strict(),
  z
    .object({
      type: z.literal('fill_blank'),
      // blanks[i] = accepted answers for blank i
      blanks: z.array(z.array(text(100)).min(1).max(10)).min(1).max(10),
      caseSensitive: z.boolean().default(false),
      explanation,
      hints,
    })
    .strict(),
  z.object({ type: z.literal('ordering'), correctOrder: z.array(id).min(2).max(10), explanation, hints }).strict(),
]);
export type QuestionKey = z.infer<typeof questionKey>;

// ---------- an authored question = content + key, checked together ----------

export const authoredQuestion = z
  .object({ content: questionContent, key: questionKey.nullable() })
  .strict()
  .superRefine(({ content, key }, ctx) => {
    const bad = (message: string, path: (string | number)[] = ['key']) =>
      ctx.addIssue({ code: z.ZodIssueCode.custom, message, path });

    if (content.type === 'reflection') {
      if (key !== null) bad('Reflection questions are not scored and cannot have a key');
      return;
    }
    if (key === null) return bad('Add the correct answer');
    if (key.type !== content.type) return bad('Answer key does not match the question type');

    if (content.type === 'mcq' && key.type === 'mcq') {
      if (!content.choices.some((c) => c.id === key.correctChoiceId))
        bad('Correct answer must be one of the choices', ['key', 'correctChoiceId']);
    }
    if (content.type === 'fill_blank' && key.type === 'fill_blank') {
      const n = content.prompt.split(BLANK).length - 1;
      if (key.blanks.length !== n) bad(`The text has ${n} blank(s) but ${key.blanks.length} answer set(s)`, ['key', 'blanks']);
    }
    if (content.type === 'ordering' && key.type === 'ordering') {
      const ids = new Set(content.items.map((i) => i.id));
      const ok = key.correctOrder.length === ids.size && key.correctOrder.every((x) => ids.has(x)) && new Set(key.correctOrder).size === ids.size;
      if (!ok) bad('Correct order must list every item exactly once', ['key', 'correctOrder']);
    }
  });
export type AuthoredQuestion = z.infer<typeof authoredQuestion>;

// Deterministic hash so the display order of ordering items is stable but
// does not reveal the author's correct order.
function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0;
  return h;
}

/**
 * Split an authored question into the half students may see and the half they
 * may not. Ordering items are re-sorted so the content never shows the answer.
 * Throws a ZodError if the question is invalid.
 */
export function splitQuestion(input: AuthoredQuestion): { content: QuestionContent; key: QuestionKey | null } {
  const { content, key } = authoredQuestion.parse(input);
  if (content.type !== 'ordering' || key?.type !== 'ordering') return { content, key };
  let items = [...content.items].sort((a, b) => fnv1a(a.id + a.text) - fnv1a(b.id + b.text));
  if (items.every((it, i) => it.id === key.correctOrder[i])) items = [...items.slice(1), items[0]!]; // never ship the solved order
  return { content: { ...content, items }, key };
}

// ---------- activities, lessons, modules ----------

export const activityKind = z.enum(['video', 'reading', 'check', 'worksheet', 'exit']);
export type ActivityKind = z.infer<typeof activityKind>;

const activityBase = { title: text(120), required: z.boolean().default(true) };

export const authoredActivity = z.discriminatedUnion('kind', [
  z
    .object({
      ...activityBase,
      kind: z.literal('video'),
      youtubeUrl: youtubeUrlSchema,
      // Fallback for schools that block YouTube (plan, decision 9).
      transcript: z.string().trim().max(20000).optional(),
    })
    .strict(),
  // Markdown. The student app must render it WITHOUT raw HTML.
  z.object({ ...activityBase, kind: z.literal('reading'), body: text(20000) }).strict(),
  z.object({ ...activityBase, kind: z.literal('check'), questions: z.array(authoredQuestion).min(1).max(3) }).strict(),
  z.object({ ...activityBase, kind: z.literal('worksheet'), questions: z.array(authoredQuestion).min(1).max(30) }).strict(),
  z.object({ ...activityBase, kind: z.literal('exit'), questions: z.array(authoredQuestion).min(1).max(3) }).strict(),
]);
export type AuthoredActivity = z.infer<typeof authoredActivity>;

export const authoredLesson = z
  .object({ title: text(120), activities: z.array(authoredActivity).min(1).max(30) })
  .strict();

export const moduleStatus = z.enum(['draft', 'submitted', 'published']);

export const authoredModule = z
  .object({
    title: text(120),
    summary: z.string().trim().max(500).default(''),
    status: moduleStatus.default('draft'),
    lessons: z.array(authoredLesson).min(1).max(20),
  })
  .strict();
export type AuthoredModule = z.infer<typeof authoredModule>;

/**
 * Build the student-safe view of a module plus the separate key list.
 * Positions come from array order, so "reorder" in the studio is just moving
 * an item in its array. Only the returned `student` part may leave the server
 * for students and reviewers.
 */
export function splitModule(input: AuthoredModule) {
  const m = authoredModule.parse(input);
  const keys: { lesson: number; activity: number; question: number; key: QuestionKey }[] = [];
  const student = {
    title: m.title,
    summary: m.summary,
    lessons: m.lessons.map((l, li) => ({
      title: l.title,
      activities: l.activities.map((a, ai) => {
        if (a.kind === 'video') return { kind: a.kind, title: a.title, required: a.required, embedUrl: youtubeEmbedUrl(parseYouTubeId(a.youtubeUrl)!), transcript: a.transcript };
        if (a.kind === 'reading') return { kind: a.kind, title: a.title, required: a.required, body: a.body };
        return {
          kind: a.kind,
          title: a.title,
          required: a.required,
          questions: a.questions.map((q, qi) => {
            const s = splitQuestion(q);
            if (s.key) keys.push({ lesson: li, activity: ai, question: qi, key: s.key });
            return s.content;
          }),
        };
      }),
    })),
  };
  return { student, keys };
}

// ---------- assessments (pre and post tests) ----------

export const assessmentItem = z
  .object({ pairKey: id, question: authoredQuestion })
  .strict()
  .refine((i) => i.question.content.type !== 'reflection', { message: 'Tests cannot contain unscored reflection questions', path: ['question'] });

export const authoredAssessment = z
  .object({ kind: z.enum(['pre', 'post']), items: z.array(assessmentItem).min(1).max(50) })
  .strict()
  .refine((a) => new Set(a.items.map((i) => i.pairKey)).size === a.items.length, {
    message: 'Each pair key can only be used once per test',
    path: ['items'],
  });
export type AuthoredAssessment = z.infer<typeof authoredAssessment>;

/** Warnings (not errors) for the builder: items whose twin is missing on the other test. */
export function pairWarnings(pre: AuthoredAssessment, post: AuthoredAssessment): string[] {
  const { missingPost, missingPre } = findUnpairedItems(
    pre.items.map((i) => i.pairKey),
    post.items.map((i) => i.pairKey),
  );
  return [
    ...missingPost.map((k) => `Pre item "${k}" has no matching post item, so it will not count toward gain`),
    ...missingPre.map((k) => `Post item "${k}" has no matching pre item, so it will not count toward gain`),
  ];
}
