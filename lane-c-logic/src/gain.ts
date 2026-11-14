// gain.ts: learning gain math for Lane C.
//
// This file is the SPEC for Lane A's SQL views (v_learning_gain and
// v_concept_mastery). If the SQL and this file disagree, fix the SQL and add a
// test here first. All scores are percentages from 0 to 100.
//
// Rules, in plain words:
//  - gain (points) = post - pre. This is the headline number in CIC's brief.
//  - normalized gain = (post - pre) / (100 - pre). A student who started at 100
//    has no room to grow, so it is null (never divide by zero, never fake it).
//  - A student missing a pre or a post is "incomplete". We never turn a missing
//    score into 0, because that would invent a huge fake gain or loss.
//  - Class numbers only use students who have BOTH scores. We also report how
//    many were left out, so the screen can say "6 of 9 students".
//  - Class normalized gain uses the class average pre and post (Hake's method),
//    not the average of each student's ratio, so one student near 100 cannot
//    blow up the number.
//  - Items are matched by pair_key. A pre item with no post twin is ignored for
//    gain, so a lopsided test cannot distort the result.

export type Score = number | null | undefined;

export interface GainResult {
  status: 'complete' | 'incomplete';
  pre: number | null;
  post: number | null;
  /** post - pre, in points. Null when incomplete. */
  gain: number | null;
  /** (post - pre) / (100 - pre). Null when incomplete or pre is 100. */
  normalizedGain: number | null;
}

function isValidScore(s: Score): s is number {
  return typeof s === 'number' && Number.isFinite(s) && s >= 0 && s <= 100;
}

/** Gain for one pre/post pair. Out-of-range or missing scores make it incomplete. */
export function computeGain(pre: Score, post: Score): GainResult {
  if (!isValidScore(pre) || !isValidScore(post)) {
    return {
      status: 'incomplete',
      pre: isValidScore(pre) ? pre : null,
      post: isValidScore(post) ? post : null,
      gain: null,
      normalizedGain: null,
    };
  }
  return {
    status: 'complete',
    pre,
    post,
    gain: post - pre,
    normalizedGain: pre >= 100 ? null : (post - pre) / (100 - pre),
  };
}

/** One answered test item. earned/possible are points, not percents. */
export interface ScoredItem {
  pairKey: string;
  conceptId: string;
  earned: number;
  possible: number;
}

export interface PairedScores {
  /** Per concept, using only items that exist on both tests. */
  perConcept: Record<string, GainResult>;
  overall: GainResult;
  /** pair_keys present on one test but not the other. The builder warns on these. */
  unpairedPre: string[];
  unpairedPost: string[];
}

function pct(items: ScoredItem[]): number | null {
  const possible = items.reduce((n, i) => n + i.possible, 0);
  if (possible <= 0) return null;
  const earned = items.reduce((n, i) => n + i.earned, 0);
  return (earned / possible) * 100;
}

/**
 * Match pre and post items by pair_key, then score overall and per concept.
 * Pass an empty array for a test the student has not taken yet: every result
 * will be "incomplete".
 */
export function computePairedScores(pre: ScoredItem[], post: ScoredItem[]): PairedScores {
  const postKeys = new Set(post.map((i) => i.pairKey));
  const preKeys = new Set(pre.map((i) => i.pairKey));
  const pairedPre = pre.filter((i) => postKeys.has(i.pairKey));
  const pairedPost = post.filter((i) => preKeys.has(i.pairKey));

  const concepts = new Set([...pairedPre, ...pairedPost].map((i) => i.conceptId));
  const perConcept: Record<string, GainResult> = {};
  for (const c of concepts) {
    perConcept[c] = computeGain(
      pct(pairedPre.filter((i) => i.conceptId === c)),
      pct(pairedPost.filter((i) => i.conceptId === c)),
    );
  }
  return {
    perConcept,
    overall: computeGain(pct(pairedPre), pct(pairedPost)),
    unpairedPre: [...preKeys].filter((k) => !postKeys.has(k)),
    unpairedPost: [...postKeys].filter((k) => !preKeys.has(k)),
  };
}

/** Authoring check: which pair_keys are missing a twin on the other test? */
export function findUnpairedItems(
  preKeys: string[],
  postKeys: string[],
): { missingPost: string[]; missingPre: string[] } {
  const post = new Set(postKeys);
  const pre = new Set(preKeys);
  return {
    missingPost: [...new Set(preKeys)].filter((k) => !post.has(k)),
    missingPre: [...new Set(postKeys)].filter((k) => !pre.has(k)),
  };
}

export interface StudentScores {
  studentId: string;
  pre: Score;
  post: Score;
}

export interface GroupGain {
  /** Students with both scores. Only these feed the numbers below. */
  completeCount: number;
  /** Students missing a pre or a post. Shown as "incomplete", never as zero. */
  incompleteCount: number;
  meanPre: number | null;
  meanPost: number | null;
  /** meanPost - meanPre over complete students. */
  meanGain: number | null;
  /** (meanPost - meanPre) / (100 - meanPre). Null when meanPre is 100. */
  normalizedGain: number | null;
}

/** Class (or cohort, or one concept) summary. Used for per-class and per-concept bars. */
export function summarizeGroup(students: StudentScores[]): GroupGain {
  const complete = students
    .map((s) => computeGain(s.pre, s.post))
    .filter((g) => g.status === 'complete');
  const n = complete.length;
  const incompleteCount = students.length - n;
  if (n === 0) {
    return {
      completeCount: 0,
      incompleteCount,
      meanPre: null,
      meanPost: null,
      meanGain: null,
      normalizedGain: null,
    };
  }
  const meanPre = complete.reduce((a, g) => a + (g.pre as number), 0) / n;
  const meanPost = complete.reduce((a, g) => a + (g.post as number), 0) / n;
  return {
    completeCount: n,
    incompleteCount,
    meanPre,
    meanPost,
    meanGain: meanPost - meanPre,
    normalizedGain: meanPre >= 100 ? null : (meanPost - meanPre) / (100 - meanPre),
  };
}

/** Round for display only. Never round before doing more math. */
export function round1(n: number | null): number | null {
  return n === null ? null : Math.round(n * 10) / 10;
}
