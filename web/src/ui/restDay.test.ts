import { describe, expect, it } from 'vitest';
import { addDays } from '../domain/plan';
import { REST_QUOTES, restQuoteFor } from './restDay';

describe('the rest-day quote', () => {
  it('stays the same all day and changes the next', () => {
    expect(restQuoteFor('2026-10-25')).toBe(restQuoteFor('2026-10-25'));
    expect(restQuoteFor('2026-10-26')).not.toBe(restQuoteFor('2026-10-25'));
  });

  it('shows every quote once before any repeats', () => {
    const days = REST_QUOTES.map((_, i) => restQuoteFor(addDays('2026-01-01', i)));
    expect(new Set(days).size).toBe(REST_QUOTES.length);
  });
});
