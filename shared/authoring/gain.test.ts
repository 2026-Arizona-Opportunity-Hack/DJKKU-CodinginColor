import { describe, expect, it } from 'vitest';
import {
  computeGain,
  computePairedScores,
  findUnpairedItems,
  round1,
  summarizeGroup,
  type ScoredItem,
} from './gain';
import { gainRowsToCsv, toCsv } from './csv';

describe('computeGain', () => {
  it('gives post minus pre and normalized gain', () => {
    const g = computeGain(40, 70);
    expect(g.status).toBe('complete');
    expect(g.gain).toBe(30);
    expect(g.normalizedGain).toBeCloseTo(0.5); // 30 / 60
  });

  it('pre of 100 has no normalized gain (no divide by zero)', () => {
    const g = computeGain(100, 100);
    expect(g.gain).toBe(0);
    expect(g.normalizedGain).toBeNull();
  });

  it('keeps a negative gain negative', () => {
    const g = computeGain(80, 60);
    expect(g.gain).toBe(-20);
    expect(g.normalizedGain).toBeCloseTo(-1); // -20 / 20
  });

  it('all-correct post from a zero pre is full gain', () => {
    const g = computeGain(0, 100);
    expect(g.gain).toBe(100);
    expect(g.normalizedGain).toBe(1);
  });

  it('missing pre or post is incomplete, never a fake zero', () => {
    for (const [pre, post] of [[null, 80], [50, null], [undefined, undefined]] as const) {
      const g = computeGain(pre, post);
      expect(g.status).toBe('incomplete');
      expect(g.gain).toBeNull();
      expect(g.normalizedGain).toBeNull();
    }
    expect(computeGain(null, 80).post).toBe(80);
  });

  it('rejects out-of-range and non-finite scores as incomplete', () => {
    expect(computeGain(-5, 50).status).toBe('incomplete');
    expect(computeGain(50, 101).status).toBe('incomplete');
    expect(computeGain(NaN, 50).status).toBe('incomplete');
    expect(computeGain(50, Infinity).status).toBe('incomplete');
  });
});

const item = (pairKey: string, conceptId: string, earned: number, possible = 1): ScoredItem => ({
  pairKey, conceptId, earned, possible,
});

describe('computePairedScores', () => {
  it('scores per concept and overall using matched pairs only', () => {
    const pre = [item('q1', 'vars', 0), item('q2', 'vars', 1), item('q3', 'loops', 0)];
    const post = [item('q1', 'vars', 1), item('q2', 'vars', 1), item('q3', 'loops', 1)];
    const r = computePairedScores(pre, post);
    expect(r.perConcept.vars?.pre).toBe(50);
    expect(r.perConcept.vars?.post).toBe(100);
    expect(r.perConcept.loops?.gain).toBe(100);
    expect(r.overall.pre).toBeCloseTo(33.333, 2);
    expect(r.overall.post).toBe(100);
  });

  it('ignores items with no twin and reports them', () => {
    const pre = [item('q1', 'vars', 1), item('only-pre', 'vars', 0)];
    const post = [item('q1', 'vars', 1), item('only-post', 'loops', 1)];
    const r = computePairedScores(pre, post);
    expect(r.unpairedPre).toEqual(['only-pre']);
    expect(r.unpairedPost).toEqual(['only-post']);
    expect(r.overall.pre).toBe(100);
    expect(r.perConcept.loops).toBeUndefined();
  });

  it('weights by points, not by item count', () => {
    const pre = [item('a', 'c', 0, 3), item('b', 'c', 1, 1)];
    const post = [item('a', 'c', 3, 3), item('b', 'c', 1, 1)];
    expect(computePairedScores(pre, post).overall.pre).toBe(25);
  });

  it('a duplicate pair_key is excluded from the math and reported (Jad review on PR #3)', () => {
    // Two pre items share q1, one post item has q1. Old code counted both pre items.
    const pre = [item('q1', 'vars', 0), item('q1', 'vars', 0), item('q2', 'vars', 1)];
    const post = [item('q1', 'vars', 1), item('q2', 'vars', 1)];
    const r = computePairedScores(pre, post);
    expect(r.duplicatePre).toEqual(['q1']);
    expect(r.duplicatePost).toEqual([]);
    // Only q2 is scored, on both tests.
    expect(r.overall.pre).toBe(100);
    expect(r.overall.post).toBe(100);
    expect(r.unpairedPost).toEqual([]);
  });

  it('a duplicate on the post test is also excluded from the pre side', () => {
    const pre = [item('q1', 'vars', 0), item('q2', 'vars', 1)];
    const post = [item('q1', 'vars', 1), item('q1', 'vars', 1), item('q2', 'vars', 1)];
    const r = computePairedScores(pre, post);
    expect(r.duplicatePost).toEqual(['q1']);
    expect(r.overall.pre).toBe(100);
  });

  it('an untaken post test is incomplete', () => {
    const r = computePairedScores([item('q1', 'vars', 1)], []);
    expect(r.overall.status).toBe('incomplete');
  });
});

describe('findUnpairedItems', () => {
  it('lists pair keys missing a twin, ignoring duplicates', () => {
    expect(findUnpairedItems(['a', 'b', 'b'], ['a', 'c'])).toEqual({
      missingPost: ['b'],
      missingPre: ['c'],
    });
  });
});

describe('summarizeGroup', () => {
  it('only counts complete students and reports the rest', () => {
    const g = summarizeGroup([
      { studentId: '1', pre: 40, post: 80 },
      { studentId: '2', pre: 60, post: 100 },
      { studentId: '3', pre: 50, post: null },
      { studentId: '4', pre: null, post: null },
    ]);
    expect(g.completeCount).toBe(2);
    expect(g.incompleteCount).toBe(2);
    expect(g.meanPre).toBe(50);
    expect(g.meanPost).toBe(90);
    expect(g.meanGain).toBe(40);
    expect(g.normalizedGain).toBeCloseTo(0.8); // 40 / 50
  });

  it('class normalized gain is not distorted by one student at pre 100', () => {
    const g = summarizeGroup([
      { studentId: '1', pre: 100, post: 100 },
      { studentId: '2', pre: 0, post: 50 },
    ]);
    expect(g.normalizedGain).toBeCloseTo(0.5); // meanPre 50, meanPost 75
  });

  it('empty or all-incomplete group has null numbers, not zero', () => {
    for (const students of [[], [{ studentId: '1', pre: null, post: 70 }]]) {
      const g = summarizeGroup(students);
      expect(g.completeCount).toBe(0);
      expect(g.meanGain).toBeNull();
      expect(g.normalizedGain).toBeNull();
    }
  });

  it('whole class at pre 100 has null normalized gain', () => {
    expect(summarizeGroup([{ studentId: '1', pre: 100, post: 100 }]).normalizedGain).toBeNull();
  });
});

describe('round1', () => {
  it('rounds for display and passes null through', () => {
    expect(round1(33.349)).toBe(33.3);
    expect(round1(null)).toBeNull();
  });
});

describe('csv', () => {
  it('quotes commas, quotes and newlines', () => {
    expect(toCsv(['a'], [['x,y'], ['he said "hi"'], ['l1\nl2']])).toBe(
      'a\r\n"x,y"\r\n"he said ""hi"""\r\n"l1\nl2"\r\n',
    );
  });

  it('neutralizes spreadsheet formulas in untrusted text', () => {
    const out = toCsv(['name'], [['=HYPERLINK("http://evil")'], ['+1'], ['-1'], ['@SUM(A1)']]);
    const lines = out.trim().split('\r\n').slice(1);
    for (const l of lines) expect(l.replace(/^"/, '')).toMatch(/^'/);
  });

  it('does not touch real negative numbers', () => {
    expect(toCsv(['n'], [[-20]])).toBe('n\r\n-20\r\n');
  });

  it('exports gain rows with blanks and an incomplete status', () => {
    const csv = gainRowsToCsv([
      { name: 'Ana', className: 'P1', concept: 'loops', pre: 40, post: 70, gain: 30, normalizedGain: 0.5 },
      { name: 'Ben', className: 'P1', concept: 'loops', pre: 40, post: null, gain: null, normalizedGain: null },
    ]);
    expect(csv.trim().split('\r\n')).toEqual([
      'student,class,concept,pre_pct,post_pct,gain_points,normalized_gain,status',
      'Ana,P1,loops,40,70,30,0.5,complete',
      'Ben,P1,loops,40,,,,incomplete',
    ]);
  });
});
