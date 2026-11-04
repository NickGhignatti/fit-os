import { describe, expect, it } from 'vitest';
import { formatSeconds, setSummary, setWork } from './format';

describe('the work of a set', () => {
  it('is a rep count for ordinary sets, a time for holds, and both for timed reps', () => {
    expect(setWork({ reps: 10 })).toBe('10'); // as saved before timed sets existed
    expect(setWork({ reps: 10, seconds: null })).toBe('10');
    expect(setWork({ reps: 1, seconds: 45 })).toBe('45 s');
    expect(setWork({ reps: 5, seconds: 5 })).toBe('5 × 5 s');
    expect(formatSeconds(90)).toBe('1m 30s');
  });

  it('sums sets up, bracketing timed reps so the counts do not run together', () => {
    const sets = (n: number, s: { reps: number; weight: number | null; seconds?: number | null }) => Array.from({ length: n }, () => s);
    expect(setSummary(sets(3, { reps: 10, weight: 60 }))).toBe('3 × 10 × 60 kg');
    expect(setSummary(sets(3, { reps: 1, weight: null, seconds: 45 }))).toBe('3 × 45 s');
    expect(setSummary(sets(4, { reps: 5, weight: null, seconds: 5 }))).toBe('4 × (5 × 5 s)');
    expect(setSummary([{ reps: 1, weight: null, seconds: 30 }, { reps: 1, weight: null, seconds: 40 }])).toBe('30 s · 40 s');
  });
});
