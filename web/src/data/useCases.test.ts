import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { addMeal, addFood, addPlannedExercise, addSet, deleteSet, newDietPlan, newTrainingPlan, newWorkout, replaceMeals } from '../domain/edit';
import { portionOf, type FoodItem } from '../domain/nutrition';
import type { Stream } from '../domain/repositories';
import {
  addPlannedSetLikeLast,
  addSetLikeLast,
  copyDietDay,
  copyWorkoutTo,
  logPlannedMeal,
  logSet,
  observeCalorieDay,
  observeDailyTargets,
  observeDayAgenda,
  observeTrainingWeek,
  saveWorkoutAsPlan,
  startPlannedSession,
  toggleSetDone,
} from '../domain/useCases';
import { TrackerDb } from './db';
import {
  DexieFoodLogRepository,
  DexieProfileRepository,
  DexieTransactionRunner,
  DexieWorkoutRepository,
  dexieDietPlans,
  dexieTrainingPlans,
} from './repositories';

let db: TrackerDb;
let n = 0;
const repos = () => ({
  workouts: new DexieWorkoutRepository(db),
  trainingPlans: dexieTrainingPlans(db),
  dietPlans: dexieDietPlans(db),
  foodLog: new DexieFoodLogRepository(db),
  profile: new DexieProfileRepository(db),
  transaction: new DexieTransactionRunner(db),
});

beforeEach(() => {
  db = new TrackerDb(`uc-${n++}`);
});

const nextWhere = <T>(stream: Stream<T>, accept: (value: T) => boolean): Promise<T> =>
  new Promise((resolve, reject) => {
    const stop = stream.subscribe((value) => {
      if (accept(value)) {
        queueMicrotask(() => stop());
        resolve(value);
      }
    }, reject);
  });

const squat = { name: 'Squat', notes: '', catalogId: null, sets: [{ reps: 5, weight: 100 }] };
const chicken: FoodItem = { id: 'crea:1', name: 'Pollo', brand: null, per100g: { kcal: 110, protein: 23, carbs: 0, fat: 1.5 }, servingGrams: null };

// 2026-10-12 is a Monday.
const MONDAY = '2026-10-12';

describe('editing a workout', () => {
  it('adds and removes sets without touching the original', () => {
    const w = newWorkout(MONDAY, 'Legs', [squat]);
    const exerciseId = w.exercises[0]!.id;
    const more = addSet(w, exerciseId, { reps: 5, weight: 105 });
    expect(w.exercises[0]!.sets).toHaveLength(1);
    expect(more.exercises[0]!.sets.map((s) => s.plannedWeight)).toEqual([100, 105]);
    expect(deleteSet(more, more.exercises[0]!.sets[0]!.id).exercises[0]!.sets).toHaveLength(1);
  });
});

describe('starting a planned session', () => {
  it('creates the workout once, even on a double tap', async () => {
    const r = repos();
    const plan = addPlannedExercise(newTrainingPlan('Strength', 'weekly'), 1, squat);
    await r.trainingPlans.save({ ...plan, isActive: true });

    const [a, b] = await Promise.all([startPlannedSession(r, MONDAY), startPlannedSession(r, MONDAY)]);
    expect(a).not.toBeNull();
    expect(b).toBe(a);
    const workouts = await r.workouts.getWorkouts(MONDAY);
    expect(workouts).toHaveLength(1);
    expect(workouts[0]).toMatchObject({ title: 'Strength', planId: plan.id });
  });

  it('does nothing on a rest day or without an active plan', async () => {
    const r = repos();
    expect(await startPlannedSession(r, MONDAY)).toBeNull();
    const plan = addPlannedExercise(newTrainingPlan('Strength', 'weekly'), 1, squat);
    await r.trainingPlans.save({ ...plan, isActive: true });
    expect(await startPlannedSession(r, '2026-10-13')).toBeNull(); // Tuesday
  });
});

describe('logging sets', () => {
  it('toggles done, filling actuals from the plan, and restores them', async () => {
    const r = repos();
    const w = newWorkout(MONDAY, 'Legs', [squat]);
    await r.workouts.save(w);
    const set = w.exercises[0]!.sets[0]!;

    await toggleSetDone(r, w.id, set);
    const done = (await r.workouts.getWorkout(w.id))!.exercises[0]!.sets[0]!;
    expect(done).toMatchObject({ done: true, actualReps: 5, actualWeight: 100 });

    await toggleSetDone(r, w.id, done);
    expect((await r.workouts.getWorkout(w.id))!.exercises[0]!.sets[0]).toMatchObject({ done: false, actualReps: 5 });
  });

  it('logs edited values, and reports a workout that is gone', async () => {
    const r = repos();
    const w = newWorkout(MONDAY, 'Legs', [squat]);
    await r.workouts.save(w);
    const set = w.exercises[0]!.sets[0]!;
    expect(await logSet(r, w.id, { ...set, done: true, actualReps: 4 })).toBe(true);
    expect((await r.workouts.getWorkout(w.id))!.exercises[0]!.sets[0]).toMatchObject({ actualReps: 4, actualWeight: 100 });
    expect(await logSet(r, 'missing', set)).toBe(false);
  });

  it('adds a set that repeats the last one', async () => {
    const r = repos();
    const w = newWorkout(MONDAY, 'Legs', [{ ...squat, sets: [{ reps: 8, weight: 60 }] }]);
    await r.workouts.save(w);
    await addSetLikeLast(r, w.id, w.exercises[0]!.id);
    expect((await r.workouts.getWorkout(w.id))!.exercises[0]!.sets.map((s) => [s.plannedReps, s.plannedWeight])).toEqual([[8, 60], [8, 60]]);
  });

  it('adds a planned set that repeats the last one, and defaults to 10 reps on an empty exercise', async () => {
    const r = repos();
    const plan = addPlannedExercise(newTrainingPlan('P', 'daily'), 0, { ...squat, sets: [] });
    await r.trainingPlans.save(plan);
    const exerciseId = plan.sessions[0]![0]!.id;
    await addPlannedSetLikeLast(r, plan.id, exerciseId);
    await addPlannedSetLikeLast(r, plan.id, exerciseId);
    expect((await r.trainingPlans.getPlan(plan.id))!.sessions[0]![0]!.sets.map((s) => [s.reps, s.weight])).toEqual([[10, null], [10, null]]);
  });
});

describe('copying', () => {
  it('copies a workout to another day without its results', async () => {
    const r = repos();
    const w = newWorkout(MONDAY, 'Legs', [squat]);
    await r.workouts.save(w);
    await toggleSetDone(r, w.id, w.exercises[0]!.sets[0]!);

    const copyId = await copyWorkoutTo(r, w.id, '2026-10-14');
    const copy = (await r.workouts.getWorkout(copyId!))!;
    expect(copy).toMatchObject({ date: '2026-10-14', title: 'Legs', planId: null });
    expect(copy.exercises[0]!.sets[0]).toMatchObject({ done: false, actualReps: null });
    expect(await copyWorkoutTo(r, 'missing', MONDAY)).toBeNull();
  });

  it('saves a workout as a new inactive daily plan', async () => {
    const r = repos();
    const w = newWorkout(MONDAY, 'Legs', [squat]);
    await r.workouts.save(w);
    const planId = await saveWorkoutAsPlan(r, w.id, 'My legs');
    expect(await r.trainingPlans.getPlan(planId!)).toMatchObject({ name: 'My legs', recurrence: 'daily', isActive: false });
  });

  it('copies a diet day onto other days, replacing them', async () => {
    const r = repos();
    let plan = newDietPlan('Cut', 'weekly');
    const { plan: withMeal, meal } = addMeal(plan, 1, 'Lunch', '13:00');
    plan = addFood(withMeal, meal.id, 'Pollo', '', portionOf(chicken, 150));
    plan = replaceMeals(plan, 2, [{ id: 'x', name: 'Old', time: '', foods: [] }]);
    await r.dietPlans.save(plan);

    await copyDietDay(r, plan.id, 1, new Set([1, 2, 3]));
    const saved = (await r.dietPlans.getPlan(plan.id))!;
    expect(saved.meals[2]!.map((m) => m.name)).toEqual(['Lunch']);
    expect(saved.meals[3]![0]!.foods[0]!.portion!.grams).toBe(150);
    expect(saved.meals[2]![0]!.id).not.toBe(saved.meals[1]![0]!.id);
  });
});

describe('observing', () => {
  it('shows the pending session until it is started, then the workout', async () => {
    const r = repos();
    await r.trainingPlans.save({ ...addPlannedExercise(newTrainingPlan('Strength', 'weekly'), 1, squat), isActive: true });

    const before = await nextWhere(observeDayAgenda(r, MONDAY), (a) => a.hasTrainingPlan);
    expect(before.pendingSession?.title).toBe('Strength');
    expect(before.workouts).toHaveLength(0);

    const after = nextWhere(observeDayAgenda(r, MONDAY), (a) => a.workouts.length === 1 && a.pendingSession === null);
    await startPlannedSession(r, MONDAY);
    expect((await after).workouts[0]!.title).toBe('Strength');
  });

  it('tracks the training week', async () => {
    const r = repos();
    const plan = addPlannedExercise(addPlannedExercise(newTrainingPlan('Strength', 'weekly'), 1, squat), 3, squat);
    await r.trainingPlans.save({ ...plan, isActive: true });
    const id = (await startPlannedSession(r, MONDAY))!;
    const w = (await r.workouts.getWorkout(id))!;
    await toggleSetDone(r, id, w.exercises[0]!.sets[0]!);

    const week = (await nextWhere(observeTrainingWeek(r, '2026-10-14'), (x) => x?.completedCount === 1))!;
    expect(week.days.map((d) => [d.date, d.isCompleted, d.isToday])).toEqual([[MONDAY, true, false], ['2026-10-14', false, true]]);
    expect(week.hasPendingSessionToday).toBe(true);
  });

  it('builds the calorie day from the diet plan, extras, and what was eaten', async () => {
    const r = repos();
    const { plan: p1, meal } = addMeal(newDietPlan('Cut', 'daily'), 0, 'Lunch', '');
    await r.dietPlans.save({ ...addFood(p1, meal.id, 'Pollo', '', portionOf(chicken, 200)), isActive: true });

    const planned = await nextWhere(observeCalorieDay(r, MONDAY, ['Breakfast']), (d) => d.hasDietPlan);
    expect(planned.meals.map((m) => [m.name, m.canLogAsPlanned])).toEqual([['Lunch', true]]);
    expect(planned.planned?.kcal).toBe(220);

    expect(await logPlannedMeal(r, MONDAY, planned.meals[0]!.planned!)).toBe(1);
    await r.foodLog.saveDay({
      date: MONDAY,
      entries: [...(await r.foodLog.getDay(MONDAY)).entries, { id: 'z', meal: 'Snack', portion: portionOf(chicken, 100) }],
    });
    const day = await nextWhere(observeCalorieDay(r, MONDAY, []), (d) => d.meals.length === 2);
    expect(day.meals.map((m) => [m.name, m.canLogAsPlanned])).toEqual([['Lunch', false], ['Snack', false]]);
    expect(day.eaten.kcal).toBe(330);
  });

  it('falls back to default meals without a diet', async () => {
    const r = repos();
    const day = await nextWhere(observeCalorieDay(r, MONDAY, ['Breakfast', 'Lunch']), () => true);
    expect(day.meals.map((m) => m.name)).toEqual(['Breakfast', 'Lunch']);
    expect(day.hasDietPlan).toBe(false);
    expect(await logPlannedMeal(r, MONDAY, { id: 'm', name: 'Lunch', time: '', foods: [] })).toBe(0);
  });

  it('computes daily targets from the profile and the latest weigh-in', async () => {
    const r = repos();
    expect(await nextWhere(observeDailyTargets(r.profile, MONDAY), () => true)).toBeNull();
    await r.profile.saveProfile({ sex: 'male', birthDate: '1996-10-12', heightCm: 180, activity: 'moderate', pace: 'maintain', customKcal: null, customProtein: null, customCarbs: null, customFat: null });
    await r.profile.setWeight('2026-10-01', 82);
    await r.profile.setWeight('2026-10-10', 80);
    const targets = await nextWhere(observeDailyTargets(r.profile, MONDAY), (t) => t !== null);
    expect(targets!.nutrients.kcal).toBeCloseTo((10 * 80 + 6.25 * 180 - 5 * 30 + 5) * 1.55);
    expect(targets!.isCustom).toBe(false);
  });
});
