import { describe, expect, it } from 'vitest';
import { parseChangelog, readChangelog } from '../../changelog';
import { hasUnseen } from '../domain/changelog';

const FIELD = '\x1f';
const RECORD = '\x1e';
const record = (id: string, title: string, body: string) => `${id}${FIELD}2026-11-08T10:00:00+01:00${FIELD}${title}${FIELD}${body}${RECORD}\n`;

describe('release notes from commit descriptions', () => {
  it('keeps the description, not the first line, and drops commits that have none', () => {
    const raw = record('a1', 'Add the thing', 'You can now do the thing.\n\nFind it under Workouts.\n')
      + record('b2', 'Refactor internals', '');
    expect(parseChangelog(raw)).toEqual([
      { id: 'a1', date: '2026-11-08T10:00:00+01:00', title: 'Add the thing', body: 'You can now do the thing.\n\nFind it under Workouts.' },
    ]);
  });

  it('leaves out the trailers that end a commit message', () => {
    const raw = record('c3', 'Fix it', 'Sets no longer slide away.\n\nCo-Authored-By: Someone <a@b.c>\n');
    expect(parseChangelog(raw)[0]!.body).toBe('Sets no longer slide away.');
    expect(parseChangelog(record('d4', 'Only a trailer', 'Co-Authored-By: Someone <a@b.c>\n'))).toEqual([]);
  });

  it('keeps a line that looks like a trailer when prose follows it', () => {
    const raw = record('e5', 'Note', 'Heads up: rests can now be Off.\nTry it.\n');
    expect(parseChangelog(raw)[0]!.body).toBe('Heads up: rests can now be Off.\nTry it.');
  });

  it('reads this repository without failing, and never announces the commits before the cutoff', () => {
    const entries = readChangelog(process.cwd());
    expect(Array.isArray(entries)).toBe(true);
    expect(entries.every((e) => e.body !== '' && Date.parse(e.date) >= Date.parse('2026-11-07T12:05:58+01:00'))).toBe(true);
  });

  it('says something is unseen until the newest entry has been opened', () => {
    const entries = [{ id: 'n2', date: '', title: '', body: 'x' }, { id: 'n1', date: '', title: '', body: 'y' }];
    expect(hasUnseen(entries, null)).toBe(true);
    expect(hasUnseen(entries, 'n1')).toBe(true);
    expect(hasUnseen(entries, 'n2')).toBe(false);
    expect(hasUnseen([], null)).toBe(false);
  });
});
