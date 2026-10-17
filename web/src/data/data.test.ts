import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { newDietPlan } from '../domain/edit';
import { newId } from '../domain/id';
import { portionOf, type FoodItem } from '../domain/nutrition';
import type { Stream } from '../domain/repositories';
import type { TrainingPlan } from '../domain/trainingPlan';
import type { Workout } from '../domain/workout';
import { receiveTransfer, sendTransfer } from '../transfer/transfer';
import { InMemoryTransferGateway } from '../transfer/gateway';
import { exportBackup, parseBackup, restoreBackup } from './backup';
import { TrackerDb } from './db';
import { importEnvelope } from './importItem';
import {
  DexieCustomFoodRepository,
  DexieFavoriteFoodRepository,
  DexieFoodLogRepository,
  DexieProfileRepository,
  DexieTransactionRunner,
  DexieWorkoutRepository,
  dexieDietPlans,
  dexieTrainingPlans,
} from './repositories';

let db: TrackerDb;
let counter = 0;

beforeEach(() => {
  db = new TrackerDb(`test-${counter++}`);
});

/** The next value a stream emits that satisfies [accept]. */
const nextWhere = <T>(stream: Stream<T>, accept: (value: T) => boolean): Promise<T> =>
  new Promise((resolve, reject) => {
    const stop = stream.subscribe((value) => {
      if (accept(value)) {
        queueMicrotask(() => stop());
        resolve(value);
      }
    }, reject);
  });

const plan = (over: Partial<TrainingPlan> = {}): TrainingPlan => ({
  id: newId(),
  name: 'Strength',
  recurrence: 'weekly',
  isActive: false,
  sessions: { 1: [{ id: newId(), name: 'Squat', notes: '', catalogId: null, sets: [{ id: newId(), reps: 5, weight: 100 }] }] },
  ...over,
});

const workout = (over: Partial<Workout> = {}): Workout => ({
  id: newId(),
  date: '2026-10-14',
  title: 'Push',
  planId: null,
  exercises: [
    {
      id: newId(),
      name: 'Bench',
      notes: '',
      catalogId: null,
      sets: [{ id: newId(), plannedReps: 8, plannedWeight: 60, actualReps: 8, actualWeight: 60, done: true }],
    },
  ],
  ...over,
});

const chicken: FoodItem = {
  id: 'crea:1',
  name: 'Pollo, petto',
  brand: null,
  per100g: { kcal: 110, protein: 23, carbs: 0, fat: 1.5 },
  servingGrams: null,
};

describe('ids', () => {
  it('are unique, valid UUIDs, and sort in creation order', () => {
    const ids = Array.from({ length: 2_000 }, () => newId());
    expect(new Set(ids).size).toBe(2_000);
    expect(ids.every((i) => /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(i))).toBe(true);
    expect([...ids].sort()).toEqual(ids);
  });
});

describe('workouts', () => {
  it('saves, reads back in creation order, and deletes', async () => {
    const repo = new DexieWorkoutRepository(db);
    const first = workout({ title: 'First' });
    const second = workout({ title: 'Second' });
    await repo.save(second);
    await repo.save(first); // saved later but created earlier
    await repo.save(workout({ date: '2026-10-15' }));

    expect((await repo.getWorkouts('2026-10-14')).map((w) => w.title)).toEqual(['First', 'Second']);
    expect(await repo.getWorkout(first.id)).toEqual(first);
    await repo.delete(first.id);
    expect(await repo.getWorkout(first.id)).toBeUndefined();
  });

  it('summarises completion per day and updates live', async () => {
    const repo = new DexieWorkoutRepository(db);
    await repo.save(workout());
    const summaries = await nextWhere(repo.observeDaySummaries('2026-10-12', '2026-10-18'), (s) => s.length === 1);
    expect(summaries).toEqual([{ date: '2026-10-14', totalSets: 1, doneSets: 1 }]);

    const update = nextWhere(repo.observeWorkouts('2026-10-16'), (w) => w.length === 1);
    await repo.save(workout({ date: '2026-10-16', title: 'Later' }));
    expect((await update)[0]?.title).toBe('Later');
  });
});

describe('plans', () => {
  it('lists by name ignoring case', async () => {
    const repo = dexieTrainingPlans(db);
    for (const name of ['beta', 'Alpha', 'charlie']) await repo.save(plan({ name }));
    expect((await nextWhere(repo.observePlans(), (p) => p.length === 3)).map((p) => p.name)).toEqual(['Alpha', 'beta', 'charlie']);
  });

  it('lets several workout plans be active at once', async () => {
    const repo = dexieTrainingPlans(db);
    const lifting = plan({ name: 'Lifting' });
    const volley = plan({ name: 'Volleyball' });
    const rest = plan({ name: 'Mobility' });
    for (const p of [lifting, volley, rest]) await repo.save(p);

    await repo.setPlanActive(lifting.id, true);
    await repo.setPlanActive(volley.id, true);
    expect((await repo.getActivePlans()).map((p) => p.name)).toEqual(['Lifting', 'Volleyball']); // by name, both on

    await repo.setPlanActive(lifting.id, false); // turning one off leaves the other alone
    expect((await repo.getActivePlans()).map((p) => p.name)).toEqual(['Volleyball']);

    await repo.save({ ...rest, isActive: true }); // saving an active plan does not switch the others off
    expect((await repo.getActivePlans()).map((p) => p.name)).toEqual(['Mobility', 'Volleyball']);

    const seen = new Promise<string[]>((resolve) => {
      const stop = repo.observeActivePlans().subscribe((plans) => { if (plans.length === 0) { stop(); resolve([]); } });
    });
    await repo.setPlanActive(volley.id, false);
    await repo.setPlanActive(rest.id, false);
    expect(await seen).toEqual([]);
  });

  it('keeps at most one diet active', async () => {
    const repo = dexieDietPlans(db);
    const a = newDietPlan('A', 'daily');
    const b = newDietPlan('B', 'daily');
    await repo.save(a);
    await repo.save(b);

    await repo.setActivePlan(a.id);
    expect((await repo.getActivePlan())?.id).toBe(a.id);
    await repo.setPlanActive(b.id, true); // activating one switches the other off
    expect((await repo.getActivePlan())?.id).toBe(b.id);
    expect((await repo.getPlan(a.id))?.isActive).toBe(false);

    await repo.save({ ...a, isActive: true }); // saving an active diet takes over
    expect((await repo.getActivePlan())?.id).toBe(a.id);
    expect((await repo.getPlan(b.id))?.isActive).toBe(false);

    await repo.setActivePlan(undefined);
    expect(await repo.getActivePlan()).toBeUndefined();
  });

  it('emits null for a deleted plan; diet and training plans are separate', async () => {
    const repo = dexieTrainingPlans(db);
    const p = plan();
    await repo.save(p);
    const gone = nextWhere(repo.observePlan(p.id), (v) => v === null);
    await repo.delete(p.id);
    expect(await gone).toBeNull();
    expect(await dexieDietPlans(db).getPlan(p.id)).toBeUndefined();
  });
});

describe('food log', () => {
  it('returns an empty day, stores entries in order, and drops an emptied day', async () => {
    const repo = new DexieFoodLogRepository(db);
    expect(await repo.getDay('2026-10-14')).toEqual({ date: '2026-10-14', entries: [] });

    const entry = (id: string, grams: number) => ({ id, meal: 'Lunch', portion: portionOf(chicken, grams) });
    await repo.saveDay({ date: '2026-10-14', entries: [entry('a', 100), entry('b', 200)] });
    expect((await repo.getDay('2026-10-14')).entries.map((e) => e.id)).toEqual(['a', 'b']);

    await repo.saveDay({ date: '2026-10-14', entries: [] });
    expect(await db.foodLogDays.count()).toBe(0);
  });

  it('lists recent foods, most recent first, without repeats', async () => {
    const repo = new DexieFoodLogRepository(db);
    const apple: FoodItem = { ...chicken, id: 'crea:2', name: 'Mela' };
    const log = (date: string, foods: FoodItem[]) =>
      repo.saveDay({ date, entries: foods.map((f) => ({ id: newId(), meal: 'Snack', portion: portionOf(f, 100) })) });
    await log('2026-10-12', [chicken]);
    await log('2026-10-13', [apple, chicken]);

    const recent = await nextWhere(repo.observeRecentFoods(10), (f) => f.length === 2);
    expect(recent.map((f) => f.id)).toEqual(['crea:1', 'crea:2']); // chicken was logged last
  });
});

describe('foods and profile', () => {
  it('creates custom foods and finds them with the Italian-aware search', async () => {
    const repo = new DexieCustomFoodRepository(db);
    const food = await repo.create('Torta della nonna', { kcal: 300, protein: 5, carbs: 40, fat: 12 }, null, 80);
    expect(food.id).toMatch(/^custom:/);
    expect((await repo.search('torta nonna')).map((f) => f.id)).toEqual([food.id]);
    expect(await repo.search('pizza')).toEqual([]);
  });

  it('toggles favourites, newest first', async () => {
    const repo = new DexieFavoriteFoodRepository(db);
    await repo.setFavorite(chicken, true);
    await new Promise((r) => setTimeout(r, 2));
    await repo.setFavorite({ ...chicken, id: 'crea:2', name: 'Mela' }, true);
    expect((await nextWhere(repo.observeFavorites(), (f) => f.length === 2)).map((f) => f.name)).toEqual(['Mela', 'Pollo, petto']);
    await repo.setFavorite(chicken, false);
    expect((await nextWhere(repo.observeFavorites(), (f) => f.length === 1))[0]?.name).toBe('Mela');
  });

  it('defaults the profile, and keeps one weigh-in per day', async () => {
    const repo = new DexieProfileRepository(db);
    expect((await nextWhere(repo.observeProfile(), () => true)).activity).toBe('moderate');
    await repo.saveProfile({ sex: 'male', birthDate: '1996-10-17', heightCm: 180, activity: 'active', pace: 'lose', customKcal: null, customProtein: null, customCarbs: null, customFat: null });
    expect((await nextWhere(repo.observeProfile(), (p) => p.sex === 'male')).heightCm).toBe(180);

    await repo.setWeight('2026-10-14', 80);
    await repo.setWeight('2026-10-14', 79.5);
    await repo.setWeight('2026-10-10', 81);
    const weights = await nextWhere(repo.observeWeights(), (w) => w.length === 2);
    expect(weights.map((w) => [w.date, w.kg])).toEqual([['2026-10-10', 81], ['2026-10-14', 79.5]]);
  });
});

describe('transactions', () => {
  it('roll everything back when the block fails', async () => {
    const runner = new DexieTransactionRunner(db);
    const workouts = new DexieWorkoutRepository(db);
    await expect(
      runner.run(async () => {
        await workouts.save(workout());
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(await db.workouts.count()).toBe(0);
  });
});

describe('importing a received item', () => {
  it('stores a training plan as an inactive copy with new ids', async () => {
    const original = plan({ isActive: true });
    const gateway = new InMemoryTransferGateway();
    const { code } = await sendTransfer(gateway, 'training_plan', original);
    const received = await receiveTransfer(gateway, code);
    if (received.status !== 'ok') throw new Error(received.status);

    expect(await importEnvelope(db, received.envelope)).toEqual({ status: 'imported', kind: 'training_plan', title: 'Strength' });
    const [copy] = await db.trainingPlans.toArray();
    expect(copy?.isActive).toBe(false);
    expect(copy?.id).not.toBe(original.id);
    expect(copy?.sessions[1]?.[0]?.id).not.toBe(original.sessions[1]?.[0]?.id);
    expect(copy?.sessions[1]?.[0]?.name).toBe('Squat');
  });

  it('keeps catalogue food ids but detaches a workout from its plan', async () => {
    const w = workout({ planId: newId() });
    await importEnvelope(db, { v: 1, kind: 'workout', data: w, sentAt: 'x' });
    expect((await db.workouts.toArray())[0]).toMatchObject({ planId: null, title: 'Push' });

    const dietData = {
      id: newId(), name: 'Cut', recurrence: 'daily', isActive: true,
      meals: { 0: [{ id: newId(), name: 'Lunch', time: '', foods: [{ id: newId(), name: 'Pollo', quantity: '', portion: portionOf(chicken, 150) }] }] },
    };
    await importEnvelope(db, { v: 1, kind: 'diet_plan', data: dietData, sentAt: 'x' });
    const [diet] = await db.dietPlans.toArray();
    expect(diet?.isActive).toBe(false);
    expect(diet?.meals[0]?.[0]?.foods[0]?.portion?.food.id).toBe('crea:1');
  });

  it('adds a received food-log day to the existing one', async () => {
    const repo = new DexieFoodLogRepository(db);
    const entry = (id: string) => ({ id, meal: 'Lunch', portion: portionOf(chicken, 100) });
    await repo.saveDay({ date: '2026-10-14', entries: [entry('mine')] });
    await importEnvelope(db, { v: 1, kind: 'food_log_day', data: { date: '2026-10-14', entries: [entry('theirs')] }, sentAt: 'x' });
    const day = await repo.getDay('2026-10-14');
    expect(day.entries).toHaveLength(2);
    expect(day.entries[0]?.id).toBe('mine');
    expect(day.entries[1]?.id).not.toBe('theirs');
  });

  it('rejects malformed or hostile items without storing anything', async () => {
    const bad = [
      { kind: 'workout', data: { id: 'x' } },
      { kind: 'training_plan', data: { ...plan(), name: 'x'.repeat(500) } },
      { kind: 'training_plan', data: { ...plan(), sessions: { 9: [] } } },
      { kind: 'diet_plan', data: 'nope' },
      { kind: 'food_log_day', data: { date: 'yesterday', entries: [] } },
    ] as const;
    for (const { kind, data } of bad) {
      expect(await importEnvelope(db, { v: 1, kind, data, sentAt: 'x' })).toEqual({ status: 'invalid' });
    }
    expect(await db.trainingPlans.count() + (await db.workouts.count()) + (await db.dietPlans.count())).toBe(0);
  });
});

describe('backup', () => {
  it('round-trips the whole device through a file', async () => {
    const source = new TrackerDb('source');
    await source.trainingPlans.put(plan({ isActive: true }));
    await source.workouts.put(workout());
    await source.customFoods.put({ ...chicken, id: 'custom:1' });
    await new DexieFavoriteFoodRepository(source).setFavorite(chicken, true);
    await new DexieProfileRepository(source).setWeight('2026-10-14', 80);
    await new DexieProfileRepository(source).saveProfile({ sex: 'female', birthDate: null, heightCm: 170, activity: 'light', pace: 'maintain', customKcal: 2000, customProtein: null, customCarbs: null, customFat: null });

    const text = JSON.stringify(await exportBackup(source, () => new Date('2026-10-17T10:00:00Z')));
    const parsed = parseBackup(text);
    if (!parsed.ok) throw new Error(parsed.error);

    await restoreBackup(db, parsed.backup);
    expect(await db.trainingPlans.toArray()).toEqual(await source.trainingPlans.toArray());
    expect(await db.workouts.toArray()).toEqual(await source.workouts.toArray());
    expect(await db.customFoods.count()).toBe(1);
    expect(await db.favoriteFoods.count()).toBe(1);
    expect(await db.weightEntries.toArray()).toEqual(await source.weightEntries.toArray());
    expect((await db.profile.get('me'))?.customKcal).toBe(2000);
  });

  it('restoring an active plan replaces the active one, and merges by id', async () => {
    const current = plan({ name: 'Current', isActive: true });
    await db.trainingPlans.put(current);
    const incoming = plan({ name: 'Incoming', isActive: true });
    const edited = { ...current, name: 'Current (edited)', isActive: false };
    const text = JSON.stringify({
      app: 'tracker', v: 1, exportedAt: 'x',
      data: { trainingPlans: [incoming, edited], dietPlans: [], workouts: [], foodLogDays: [], customFoods: [], favorites: [], weights: [], profile: null },
    });
    const parsed = parseBackup(text);
    if (!parsed.ok) throw new Error(parsed.error);
    await restoreBackup(db, parsed.backup);

    const plans = await db.trainingPlans.toArray();
    expect(plans).toHaveLength(2);
    expect(plans.filter((p) => p.isActive).map((p) => p.name)).toEqual(['Incoming']);
    expect(plans.find((p) => p.id === current.id)?.name).toBe('Current (edited)');
  });

  it('reports unusable files instead of throwing', () => {
    expect(parseBackup('{{{')).toEqual({ ok: false, error: 'not a JSON file' });
    expect(parseBackup('{"app":"other"}').ok).toBe(false);
    expect(parseBackup('{"app":"tracker","v":2,"exportedAt":"x","data":{}}').ok).toBe(false);
  });
});

describe('restoring workout plans from a backup', () => {
  it('keeps every plan that was active, next to the ones already on the device', async () => {
    const source = new TrackerDb('restore-multi-source');
    const a = { ...plan({ name: 'Lifting' }), isActive: true };
    const b = { ...plan({ name: 'Volleyball' }), isActive: true };
    await source.trainingPlans.bulkPut([a, b]);
    const parsed = parseBackup(JSON.stringify(await exportBackup(source)));
    if (!parsed.ok) throw new Error(parsed.error);

    const mine = { ...plan({ name: 'Already here' }), isActive: true };
    await db.trainingPlans.put(mine);
    await restoreBackup(db, parsed.backup);
    expect((await db.trainingPlans.toArray()).filter((p) => p.isActive).map((p) => p.name).sort()).toEqual(['Already here', 'Lifting', 'Volleyball']);
  });

  it('still keeps only one diet active', async () => {
    const source = new TrackerDb('restore-diet-source');
    await source.dietPlans.bulkPut([{ ...newDietPlan('One', 'daily'), isActive: true }, { ...newDietPlan('Two', 'daily'), isActive: true }]);
    const parsed = parseBackup(JSON.stringify(await exportBackup(source)));
    if (!parsed.ok) throw new Error(parsed.error);
    await db.dietPlans.put({ ...newDietPlan('Existing', 'daily'), isActive: true });
    await restoreBackup(db, parsed.backup);
    expect((await db.dietPlans.toArray()).filter((p) => p.isActive)).toHaveLength(1);
  });
});
