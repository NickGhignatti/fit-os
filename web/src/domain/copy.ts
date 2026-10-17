import type { DietPlan } from './diet';
import type { FoodLogDay } from './foodLog';
import { newId } from './id';
import type { TrainingPlan } from './trainingPlan';
import type { Workout } from './workout';

/**
 * Copies of items with fresh ids. A received or duplicated item must never share ids with what
 * is already stored. Food ids inside portions ("crea:…") point into the catalogue, not at a row
 * of ours, so they stay.
 */
type MakeId = () => string;

const mapValues = <T, U>(record: Readonly<Record<number, T>>, f: (value: T) => U): Record<number, U> =>
  Object.fromEntries(Object.entries(record).map(([day, value]) => [day, f(value)]));

/** An inactive copy: receiving a plan must not silently replace the one in use. */
export const copyTrainingPlan = (plan: TrainingPlan, makeId: MakeId = newId): TrainingPlan => ({
  ...plan,
  id: makeId(),
  isActive: false,
  sessions: mapValues(plan.sessions, (exercises) =>
    exercises.map((e) => ({ ...e, id: makeId(), sets: e.sets.map((s) => ({ ...s, id: makeId() })) })),
  ),
});

export const copyDietPlan = (plan: DietPlan, makeId: MakeId = newId): DietPlan => ({
  ...plan,
  id: makeId(),
  isActive: false,
  meals: mapValues(plan.meals, (meals) =>
    meals.map((m) => ({ ...m, id: makeId(), foods: m.foods.map((f) => ({ ...f, id: makeId() })) })),
  ),
});

/** The plan it came from is not on this device, so the copy has no plan. */
export const copyWorkout = (workout: Workout, makeId: MakeId = newId): Workout => ({
  ...workout,
  id: makeId(),
  planId: null,
  exercises: workout.exercises.map((e) => ({ ...e, id: makeId(), sets: e.sets.map((s) => ({ ...s, id: makeId() })) })),
});

/** [incoming] appended to [existing] (same date), as new entries. */
export const mergeFoodLogDay = (existing: FoodLogDay, incoming: FoodLogDay, makeId: MakeId = newId): FoodLogDay => ({
  date: existing.date,
  entries: [...existing.entries, ...incoming.entries.map((e) => ({ ...e, id: makeId() }))],
});
