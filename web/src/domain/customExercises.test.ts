import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { exportBackup, parseBackup, restoreBackup } from '../data/backup';
import { ExerciseLibrary, StaticExerciseCatalog } from '../data/catalog';
import { Tables } from '../data/schema';
import type { Store } from '../data/store';
import { copyLegacyData } from '../data/legacy';
import { testStore } from '../data/testStore';
import { importEnvelope } from '../data/importItem';
import { SqlCustomExercises } from '../data/repositories';
import { customExerciseId, customToInfo, isCustomId, noFilter, type CustomExercise } from './catalog';
import { copyTrainingPlan, copyWorkout } from './copy';
import { newTrainingPlan, newWorkout } from './edit';
import { customExerciseSchema } from './schemas';

const catalogText = () => readFileSync(join(process.cwd(), 'public', 'catalog', 'exercises.json'), 'utf8');

let counter = 0;
const mine = (over: Partial<CustomExercise> = {}): CustomExercise => ({
  id: customExerciseId(`ex-${++counter}`), name: 'Sandbag carry', muscle: 'forearms', equipment: 'other', notes: 'Hug it, walk 20 m', ...over,
});

const library = (_name: string) => {
  const db = testStore();
  const custom = new SqlCustomExercises(db);
  return { db, custom, library: new ExerciseLibrary(new StaticExerciseCatalog(async () => catalogText()), custom) };
};

describe('custom exercises in the library', () => {
  it('are told apart from the catalogue by their id', () => {
    expect(isCustomId(mine().id)).toBe(true);
    expect(isCustomId('3_4_Sit-Up')).toBe(false);
    expect(isCustomId(null)).toBe(false);
  });

  it('look like any other exercise to the rest of the app, marked as custom', () => {
    const info = customToInfo(mine({ name: 'Sandbag carry', muscle: 'forearms', equipment: 'other', notes: ' Hug it ' }));
    expect(info).toMatchObject({ name: 'Sandbag carry', primaryMuscles: ['forearms'], equipment: 'other', instructions: ['Hug it'], imageUrls: [], custom: true });
    expect(customToInfo(mine({ muscle: null, equipment: null, notes: '  ' }))).toMatchObject({ primaryMuscles: [], equipment: null, instructions: [] });
  });

  it('are found by name next to the bundled exercises, and by id', async () => {
    const { library: lib, custom } = library('lib-find');
    const sandbag = mine({ name: 'Sandbag carry' });
    await custom.save(sandbag);

    expect((await lib.search('sandbag', noFilter)).map((e) => e.id)).toContain(sandbag.id); // alongside the catalogue's own "Sandbag Load"
    expect((await lib.get(sandbag.id))?.name).toBe('Sandbag carry');
    expect((await lib.get('3_4_Sit-Up'))?.name).toBe('3/4 Sit-Up'); // the catalogue still works
    expect(await lib.get('custom:missing')).toBeUndefined();
    const bundled = await lib.search('bench press', noFilter);
    expect(bundled.length).toBeGreaterThan(0);
    expect(bundled.every((e) => !e.custom)).toBe(true);
  });

  it('come first in the full list, so they are never lost among the bundled ones, and honour the filters', async () => {
    const { library: lib, custom } = library('lib-list');
    await custom.save(mine({ name: 'Zercher hold', muscle: 'forearms', equipment: 'barbell' }));
    await custom.save(mine({ name: 'Aardvark crawl', muscle: 'chest', equipment: 'body_only' }));

    const all = await lib.search('', noFilter);
    expect(all.slice(0, 2).map((e) => e.name)).toEqual(['Aardvark crawl', 'Zercher hold']); // yours, in order, on top
    expect(all.slice(2).every((e) => !e.custom)).toBe(true);
    const bundled = all.slice(2).map((e) => e.name.toLowerCase());
    expect(bundled).toEqual([...bundled].sort((a, b) => a.localeCompare(b))); // then the catalogue, alphabetical

    const chest = await lib.search('', { muscle: 'chest', equipment: null });
    expect(chest[0]!.name).toBe('Aardvark crawl');
    expect(chest.some((e) => e.name === 'Zercher hold')).toBe(false);
    const barbell = await lib.search('', { muscle: null, equipment: 'barbell' });
    expect(barbell[0]!.name).toBe('Zercher hold');
  });

  it('can be edited and deleted, and are still there in a new session on the same device', async () => {
    const { db, custom } = library('lib-edit');
    const e = mine({ name: 'Old name' });
    await custom.save(e);
    await custom.save({ ...e, name: 'New name' });
    expect((await custom.getAll()).map((x) => x.name)).toEqual(['New name']);

    await db.close();
    const again = testStore(db.dir); // a new session on the same device
    const reopened = new SqlCustomExercises(again);
    expect((await reopened.getAll()).map((x) => x.name)).toEqual(['New name']);
    await reopened.delete(e.id);
    expect(await again.direct.count('custom_exercises')).toBe(0);
  });
});

describe('plans leaving the device', () => {
  const exercises = (id: string | null) => ({ name: 'Sandbag carry', notes: '', catalogId: id, sets: [{ reps: 5, weight: 40 }] });

  it('lose links to exercises that exist only here, and keep links to the catalogue', () => {
    const custom = mine();
    const plan = newTrainingPlan('Strongman', 'daily', { 0: [exercises(custom.id), { ...exercises('3_4_Sit-Up'), name: 'Sit-up' }] });
    const copy = copyTrainingPlan(plan);
    expect(copy.sessions[0]!.map((e) => [e.name, e.catalogId])).toEqual([['Sandbag carry', null], ['Sit-up', '3_4_Sit-Up']]);
    expect(plan.sessions[0]![0]!.catalogId).toBe(custom.id); // the original is untouched

    const workout = copyWorkout(newWorkout('2026-10-14', 'Carry', [exercises(custom.id)]));
    expect(workout.exercises[0]!.catalogId).toBeNull();
  });

  it('arrive on another device as plain exercises, still named', async () => {
    const other = testStore();
    const plan = newTrainingPlan('Strongman', 'daily', { 0: [exercises(mine().id)] });
    expect(await importEnvelope(other, { v: 1, kind: 'training_plan', data: plan, sentAt: 'x' })).toMatchObject({ status: 'imported' });
    const [stored] = await other.direct.list(Tables.trainingPlans);
    expect(stored!.sessions[0]![0]).toMatchObject({ name: 'Sandbag carry', catalogId: null });
  });
});

describe('backups', () => {
  it('carry the exercises, and a backup from before they existed still loads', async () => {
    const source = testStore();
    const e = mine({ name: 'Backed up' });
    await new SqlCustomExercises(source).save(e);
    const file = JSON.stringify(await exportBackup(source));
    const parsed = parseBackup(file);
    if (!parsed.ok) throw new Error(parsed.error);

    const target = testStore();
    await restoreBackup(target, parsed.backup);
    expect(await target.direct.list(Tables.customExercises)).toEqual([e]);

    const legacy = JSON.parse(file) as { data: Record<string, unknown> };
    delete legacy.data.customExercises;
    const old = parseBackup(JSON.stringify(legacy));
    expect(old.ok && old.backup.data.customExercises).toEqual([]);
  });

  it('refuse a custom exercise that is not shaped like one', () => {
    const ok = mine();
    expect(customExerciseSchema.safeParse(ok).success).toBe(true);
    for (const bad of [{ id: '3_4_Sit-Up' }, { name: '' }, { muscle: 'wings' }, { equipment: 'jetpack' }, { notes: 'x'.repeat(2001) }]) {
      expect(customExerciseSchema.safeParse({ ...ok, ...bad }).success, JSON.stringify(bad)).toBe(false);
    }
  });
});

describe('upgrading a device', () => {
  it('keeps what the old IndexedDB held when it moves to SQLite, and adds the new table', async () => {
    const name = 'exercises-upgrade';
    const old = new (await import('dexie')).default(name);
    old.version(1).stores({ workouts: 'id, date', trainingPlans: 'id, name', dietPlans: 'id, name', foodLogDays: 'date', customFoods: 'id', favoriteFoods: 'id, addedAt', weightEntries: 'id, &date', profile: 'key' });
    old.version(2).stores({ savedProducts: 'id' });
    old.version(3).stores({ records: 'id, exerciseKey, date' });
    await old.table('records').put({ id: 'r1', exerciseKey: 'k', exerciseName: 'Squat', catalogId: null, metric: 'weight', value: 100, reps: 5, date: '2026-10-01', note: '' });
    old.close();

    const upgraded = testStore();
    await copyLegacyData(upgraded, name); // what the app does on its first start with SQLite
    expect(await upgraded.direct.count('records')).toBe(1);
    await copyLegacyData(upgraded, name); // only ever once
    expect(await upgraded.direct.count('records')).toBe(1);
    await upgraded.docs.put(Tables.customExercises, mine());
    expect(await upgraded.direct.count('custom_exercises')).toBe(1);
  });
});
