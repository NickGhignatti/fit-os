import { Schema, Table, column } from '@powersync/common';
import type { CustomExercise } from '../domain/catalog';
import type { DietPlan } from '../domain/diet';
import type { FoodLogDay } from '../domain/foodLog';
import type { FoodItem } from '../domain/nutrition';
import type { Profile, WeightEntry } from '../domain/profile';
import type { PersonalRecord } from '../domain/records';
import type { TrainingPlan } from '../domain/trainingPlan';
import type { Workout } from '../domain/workout';

/**
 * The on-device SQLite database, through PowerSync. Every table holds whole aggregates as JSON in
 * `data`, next to the few columns that are searched or sorted on; `updated_at` (epoch ms) says
 * when a row last changed, ready for syncing.
 *
 * All tables are local-only for now: nothing is queued for upload, and the database works with no
 * server. To sync later, add synced twins of these tables and copy the rows across on sign-in, as
 * PowerSync's "local-only usage" guide describes.
 */
const table = (columns: Record<string, typeof column.text>, indexes: Record<string, string[]> = {}) =>
  new Table({ ...columns, data: column.text, updated_at: column.integer }, { localOnly: true, indexes });

export const AppSchema = new Schema({
  workouts: table({ date: column.text }, { by_date: ['date'] }),
  training_plans: table({ name: column.text, is_active: column.integer }),
  diet_plans: table({ name: column.text, is_active: column.integer }),
  food_log_days: table({ date: column.text }, { by_date: ['date'] }),
  custom_foods: table({ name: column.text }),
  favorite_foods: table({ added_at: column.integer }),
  weight_entries: table({ date: column.text }, { by_date: ['date'] }),
  profile: table({}),
  saved_products: table({}),
  records: table({ exercise_key: column.text, date: column.text }, { by_exercise: ['exercise_key'] }),
  custom_exercises: table({ name: column.text }),
  // Bookkeeping such as "the old IndexedDB data was copied": never exported, never synced.
  meta: table({}),
});

export type TableName = keyof (typeof AppSchema)['props'];

/** A table of aggregates: where a value goes, under which id, with which searchable columns. */
export interface DocTable<T> {
  readonly name: TableName;
  readonly id: (value: T) => string;
  readonly columns: (value: T) => Readonly<Record<string, string | number | null>>;
}

/** A food the user marked as favourite; [addedAt] orders the list, newest first. */
export interface FavoriteRow {
  readonly food: FoodItem;
  readonly addedAt: number;
}

const none = () => ({});

export const Tables = {
  workouts: { name: 'workouts', id: (w) => w.id, columns: (w) => ({ date: w.date }) } satisfies DocTable<Workout>,
  trainingPlans: {
    name: 'training_plans', id: (p) => p.id, columns: (p) => ({ name: p.name, is_active: p.isActive ? 1 : 0 }),
  } satisfies DocTable<TrainingPlan>,
  dietPlans: {
    name: 'diet_plans', id: (p) => p.id, columns: (p) => ({ name: p.name, is_active: p.isActive ? 1 : 0 }),
  } satisfies DocTable<DietPlan>,
  // One row per day, so the date is the id.
  foodLogDays: { name: 'food_log_days', id: (d) => d.date, columns: (d) => ({ date: d.date }) } satisfies DocTable<FoodLogDay>,
  customFoods: { name: 'custom_foods', id: (f) => f.id, columns: (f) => ({ name: f.name }) } satisfies DocTable<FoodItem>,
  favoriteFoods: { name: 'favorite_foods', id: (r) => r.food.id, columns: (r) => ({ added_at: r.addedAt }) } satisfies DocTable<FavoriteRow>,
  weightEntries: { name: 'weight_entries', id: (w) => w.id, columns: (w) => ({ date: w.date }) } satisfies DocTable<WeightEntry>,
  // A single row, "me".
  profile: { name: 'profile', id: (_profile: Profile) => 'me', columns: none } satisfies DocTable<Profile>,
  // Packaged products seen before, so they can be found offline. Local only, never exported.
  savedProducts: { name: 'saved_products', id: (f) => f.id, columns: none } satisfies DocTable<FoodItem>,
  records: {
    name: 'records', id: (r) => r.id, columns: (r) => ({ exercise_key: r.exerciseKey, date: r.date }),
  } satisfies DocTable<PersonalRecord>,
  customExercises: { name: 'custom_exercises', id: (e) => e.id, columns: (e) => ({ name: e.name }) } satisfies DocTable<CustomExercise>,
} as const;
