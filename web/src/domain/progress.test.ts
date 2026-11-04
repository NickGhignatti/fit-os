import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { exportBackup, parseBackup, restoreBackup } from '../data/backup';
import { Tables } from '../data/schema';
import type { Store } from '../data/store';
import { copyLegacyData } from '../data/legacy';
import { testStore } from '../data/testStore';
import { progressCsv } from '../data/progressExport';
import { SqlProgress } from '../data/repositories';
import { formatDistance, formatDuration, parseDuration, describeEntry, impliedOneRepMax } from '../ui/format';
import {
  beatsBest, bestOf, exerciseKey, groupByExercise, isBetter, newestFirst, oneRepMax, type ProgressEntry,
} from './progress';
import { progressEntrySchema } from './schemas';

let counter = 0;
const rec = (over: Partial<ProgressEntry> = {}): ProgressEntry => ({
  id: `r${++counter}`, exerciseKey: 'name:squat', exerciseName: 'Squat', catalogId: null,
  metric: 'weight', value: 100, reps: 5, date: '2026-10-01', note: '', ...over,
});

describe('one-rep max', () => {
  it('is the weight itself for a single, and grows with reps (Epley)', () => {
    expect(oneRepMax(140, 1)).toBe(140);
    expect(oneRepMax(100, 5)).toBeCloseTo(116.67, 2);
    expect(oneRepMax(100, 10)).toBeCloseTo(133.33, 2);
  });
});

describe('what counts as better', () => {
  it('compares lifts by the one-rep max they imply, not by raw weight', () => {
    expect(isBetter(rec({ value: 100, reps: 5 }), rec({ value: 105, reps: 1 }))).toBe(true); // 116.7 > 105
    expect(isBetter(rec({ value: 105, reps: 1 }), rec({ value: 100, reps: 5 }))).toBe(false);
    expect(isBetter(rec({ value: 100, reps: 5 }), rec({ value: 100, reps: 5 }))).toBe(false); // equal is not better
  });

  it('treats a higher jump and a longer hold as better', () => {
    expect(isBetter(rec({ metric: 'length', value: 64, reps: null }), rec({ metric: 'length', value: 62, reps: null }))).toBe(true);
    expect(isBetter(rec({ metric: 'hold', value: 50, reps: null }), rec({ metric: 'hold', value: 45, reps: null }))).toBe(true);
    expect(isBetter(rec({ metric: 'hold', value: 40, reps: null }), rec({ metric: 'hold', value: 45, reps: null }))).toBe(false);
  });

  it('treats more reps and more distance as better, and a shorter time as better', () => {
    expect(isBetter(rec({ metric: 'reps', value: 30, reps: null }), rec({ metric: 'reps', value: 25, reps: null }))).toBe(true);
    expect(isBetter(rec({ metric: 'distance', value: 5200, reps: null }), rec({ metric: 'distance', value: 5000, reps: null }))).toBe(true);
    expect(isBetter(rec({ metric: 'time', value: 1300, reps: null }), rec({ metric: 'time', value: 1325, reps: null }))).toBe(true);
    expect(isBetter(rec({ metric: 'time', value: 1400, reps: null }), rec({ metric: 'time', value: 1325, reps: null }))).toBe(false);
  });

  it('finds the best per metric, and the earlier record wins a tie', () => {
    const early = rec({ id: 'a', date: '2026-01-01', value: 100, reps: 5 });
    const later = rec({ id: 'b', date: '2026-06-01', value: 100, reps: 5 });
    const heavier = rec({ id: 'c', date: '2026-03-01', value: 110, reps: 3 });
    expect(bestOf([later, early], 'weight')?.id).toBe('a');
    expect(bestOf([early, later, heavier], 'weight')?.id).toBe('c'); // 121 > 116.7
    expect(bestOf([early], 'time')).toBeUndefined();
    expect(bestOf([], 'weight')).toBeUndefined();
  });

  it('only calls it a new best when something existed to beat', () => {
    const existing = [rec({ value: 100, reps: 5 })];
    expect(beatsBest(rec({ value: 105, reps: 5 }), existing)).toBe(true);
    expect(beatsBest(rec({ value: 95, reps: 5 }), existing)).toBe(false);
    expect(beatsBest(rec({ value: 200, reps: 1 }), [])).toBe(false); // the very first record
    expect(beatsBest(rec({ metric: 'time', value: 100, reps: null }), existing)).toBe(false); // other metric: nothing to beat
  });
});

describe('exercises', () => {
  it('are the same exercise whether picked or typed, ignoring case, accents and punctuation', () => {
    expect(exerciseKey('Back Squat', null)).toBe(exerciseKey('  back-squat ', null));
    expect(exerciseKey('Stacco', null)).toBe(exerciseKey('stàcco', null));
    expect(exerciseKey('Anything', '3_4_Sit-Up')).toBe('3_4_Sit-Up'); // catalogue id wins
  });

  it('are grouped, most recently active first, each with its bests', () => {
    const groups = groupByExercise([
      rec({ exerciseKey: 'a', exerciseName: 'Squat', date: '2026-01-01', value: 100, reps: 5 }),
      rec({ exerciseKey: 'a', exerciseName: 'Squat', date: '2026-02-01', value: 110, reps: 5 }),
      rec({ exerciseKey: 'a', exerciseName: 'Squat', date: '2026-03-01', metric: 'reps', value: 12, reps: null }),
      rec({ exerciseKey: 'b', exerciseName: 'Run', date: '2026-05-01', metric: 'time', value: 1300, reps: null }),
    ]);
    expect(groups.map((g) => g.exerciseName)).toEqual(['Run', 'Squat']);
    const squat = groups[1]!;
    expect(squat.entries.map((e) => e.date)).toEqual(['2026-03-01', '2026-02-01', '2026-01-01']);
    expect(squat.bests.map((b) => [b.metric, b.value])).toEqual([['weight', 110], ['reps', 12]]);
  });

  it('sort newest first', () => {
    expect(newestFirst([rec({ id: 'a', date: '2026-01-01' }), rec({ id: 'b', date: '2026-02-01' })]).map((e) => e.id)).toEqual(['b', 'a']);
  });
});

describe('showing a measurement', () => {
  it('formats times, distances and lifts', () => {
    expect(formatDuration(1305)).toBe('21:45');
    expect(formatDuration(3725)).toBe('1:02:05');
    expect(formatDuration(59)).toBe('0:59');
    expect(formatDistance(800)).toBe('800 m');
    expect(formatDistance(5200)).toBe('5.2 km');
    expect(describeEntry(rec({ value: 100, reps: 5 }))).toBe('100 kg × 5');
    expect(describeEntry(rec({ value: 140, reps: 1 }))).toBe('140 kg');
    expect(describeEntry(rec({ metric: 'reps', value: 1, reps: null }))).toBe('1 rep');
    expect(impliedOneRepMax(rec({ value: 100, reps: 5 }))).toBe('≈ 116.67 kg 1RM');
    expect(impliedOneRepMax(rec({ value: 140, reps: 1 }))).toBeNull();
    expect(describeEntry(rec({ metric: 'length', value: 62.5, reps: null }))).toBe('62.5 cm');
    expect(describeEntry(rec({ metric: 'hold', value: 45, reps: null }))).toBe('45 s');
    expect(describeEntry(rec({ metric: 'hold', value: 90, reps: null }))).toBe('1m 30s');
  });

  it('reads times the way people type them', () => {
    expect(parseDuration('21:45')).toBe(1305);
    expect(parseDuration('1:02:05')).toBe(3725);
    expect(parseDuration('90')).toBe(90);
    for (const bad of ['', 'abc', '12:75', '1:2:3:4', '-5', '0']) expect(parseDuration(bad)).toBeNull();
  });
});

describe('validation', () => {
  const ok = { id: 'x', exerciseKey: 'k', exerciseName: 'Squat', catalogId: null, metric: 'weight', value: 100, reps: 5, date: '2026-10-01', note: '' };

  it('accepts well-formed entries and insists a lift has reps and the rest do not', () => {
    expect(progressEntrySchema.safeParse(ok).success).toBe(true);
    expect(progressEntrySchema.safeParse({ ...ok, reps: null }).success).toBe(false); // a lift without reps
    expect(progressEntrySchema.safeParse({ ...ok, metric: 'time' }).success).toBe(false); // time with reps
    expect(progressEntrySchema.safeParse({ ...ok, metric: 'time', reps: null }).success).toBe(true);
    expect(progressEntrySchema.safeParse({ ...ok, metric: 'length', value: 62, reps: null }).success).toBe(true);
    expect(progressEntrySchema.safeParse({ ...ok, metric: 'hold', value: 45, reps: null }).success).toBe(true);
  });

  it('rejects nonsense and hostile values', () => {
    for (const bad of [{ value: 0 }, { value: -5 }, { value: 1e12 }, { reps: 0 }, { reps: 2.5 }, { date: 'yesterday' }, { metric: 'speed' }, { note: 'x'.repeat(501) }, { exerciseName: '' }]) {
      expect(progressEntrySchema.safeParse({ ...ok, ...bad }).success, JSON.stringify(bad)).toBe(false);
    }
  });
});

describe('storage', () => {
  it('keeps entries per exercise, newest first, and observes changes', async () => {
    const db = testStore();
    const repo = new SqlProgress(db);
    await repo.save(rec({ id: 'a', exerciseKey: 'squat', date: '2026-01-01' }));
    await repo.save(rec({ id: 'b', exerciseKey: 'squat', date: '2026-03-01' }));
    await repo.save(rec({ id: 'c', exerciseKey: 'bench', date: '2026-02-01' }));

    expect((await repo.getFor('squat')).map((e) => e.id)).toEqual(['b', 'a']);
    const seen = new Promise<ProgressEntry[]>((resolve) => {
      const stop = repo.observeFor('bench').subscribe((v) => { if (v.length === 0) { stop(); resolve(v); } });
    });
    await repo.delete('c');
    expect(await seen).toEqual([]);
  });

  it('go through a backup under their old key, and a backup written before they existed still loads', async () => {
    const source = testStore();
    await new SqlProgress(source).save(rec({ id: 'keep', value: 120, reps: 3 }));
    const file = JSON.stringify(await exportBackup(source));
    const parsed = parseBackup(file);
    if (!parsed.ok) throw new Error(parsed.error);

    const target = testStore();
    await restoreBackup(target, parsed.backup);
    expect((await target.direct.list(Tables.progress)).map((r) => r.id)).toEqual(['keep']);

    const legacy = JSON.parse(file) as { data: Record<string, unknown> };
    delete legacy.data.records;
    const old = parseBackup(JSON.stringify(legacy));
    expect(old.ok && old.backup.data.records).toEqual([]);
  });

  it('move from the old IndexedDB of an existing device without losing what it holds', async () => {
    const name = 'records-upgrade';
    const v2 = new (await import('dexie')).default(name);
    v2.version(1).stores({ workouts: 'id, date', trainingPlans: 'id, name', dietPlans: 'id, name', foodLogDays: 'date', customFoods: 'id', favoriteFoods: 'id, addedAt', weightEntries: 'id, &date', profile: 'key' });
    v2.version(2).stores({ savedProducts: 'id' });
    await v2.table('weightEntries').put({ id: 'w1', date: '2026-10-01', kg: 80 });
    v2.close();

    const upgraded = testStore();
    await copyLegacyData(upgraded, name); // what the app does on its first start with SQLite
    expect(await upgraded.direct.count('weight_entries')).toBe(1);
    await upgraded.docs.put(Tables.progress, rec({ id: 'new' }));
    expect(await upgraded.direct.count('records')).toBe(1); // the table keeps its old name
  });
});

describe('exporting as CSV', () => {
  it('writes one row per entry, oldest first, with values in plain units', () => {
    const csv = progressCsv([
      rec({ id: 'b', date: '2026-02-01', exerciseName: 'Vertical jump', metric: 'length', value: 64, reps: null }),
      rec({ id: 'a', date: '2026-01-01', exerciseName: 'Squat', value: 100, reps: 5, note: 'easy' }),
      rec({ id: 'c', date: '2026-03-01', exerciseName: 'Plank', metric: 'hold', value: 90, reps: null }),
    ]);
    expect(csv.startsWith('﻿')).toBe(true); // so Excel reads accents as UTF-8
    expect(csv.slice(1).split('\r\n')).toEqual([
      'date,exercise,measurement,value,unit,reps,estimated_1rm_kg,note',
      '2026-01-01,Squat,weight,100,kg,5,116.67,easy',
      '2026-02-01,Vertical jump,length,64,cm,,,',
      '2026-03-01,Plank,hold,90,s,,,',
      '',
    ]);
  });

  it('quotes what needs quoting, and never lets a cell run as a formula', () => {
    const [, line] = progressCsv([rec({ exerciseName: 'Squat, "high bar"', note: '=HYPERLINK("x")' })]).slice(1).split('\r\n');
    expect(line).toBe(`2026-10-01,"Squat, ""high bar""",weight,100,kg,5,116.67,"'=HYPERLINK(""x"")"`);
  });

  it('is just the header when there is nothing to export', () => {
    expect(progressCsv([]).slice(1)).toBe('date,exercise,measurement,value,unit,reps,estimated_1rm_kg,note\r\n');
  });
});
