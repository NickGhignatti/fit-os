// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { SPLASH_MS, hideSplash } from './splash';

/** A page with the splash, and a clock that runs the timers it is asked to. */
const page = () => {
  document.body.innerHTML = '<div id="splash"></div><div id="root"></div>';
  const timers: { run: () => void; ms: number }[] = [];
  return { timers, later: (run: () => void, ms: number) => void timers.push({ run, ms }) };
};

describe('the start-up animation', () => {
  it('plays through once, then fades into the app and goes away', () => {
    const { timers, later } = page();
    hideSplash(document, () => 300, later); // the app was ready 300 ms after the page started
    expect(timers.map((t) => t.ms)).toEqual([SPLASH_MS - 300]);
    timers.shift()!.run();
    expect(document.getElementById('splash')!.classList.contains('done')).toBe(true);
    timers.shift()!.run();
    expect(document.getElementById('splash')).toBeNull();
    expect(document.getElementById('root')).not.toBeNull();
  });

  it('does not keep a slow start waiting any longer', () => {
    const { timers, later } = page();
    hideSplash(document, () => 4000, later);
    expect(timers[0]!.ms).toBe(0);
  });

  it('does nothing on a page without it', () => {
    document.body.innerHTML = '<div id="root"></div>';
    expect(() => hideSplash(document, () => 0, () => { throw new Error('no timer expected'); })).not.toThrow();
  });
});
