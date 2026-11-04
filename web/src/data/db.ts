import Dexie, { type EntityTable } from 'dexie';
import type { CustomExercise } from '../domain/catalog';
import type { DietPlan } from '../domain/diet';
import type { FoodLogDay } from '../domain/foodLog';
import type { FoodItem } from '../domain/nutrition';
import type { Profile, WeightEntry } from '../domain/profile';
import type { ProgressEntry } from '../domain/progress';
import type { TrainingPlan } from '../domain/trainingPlan';
import type { Workout } from '../domain/workout';

/** A food the user marked as favourite; [addedAt] orders the list, newest first. */
export interface FavoriteRow {
  readonly id: FoodItem['id'];
  readonly food: FoodItem;
  readonly addedAt: number;
}

/** The profile is a single row. */
export interface ProfileRow extends Profile {
  readonly key: 'me';
}

/**
 * The IndexedDB database the app used before SQLite. It is only read now, once, to copy what it
 * holds into SQLite (see [copyLegacyData]); nothing writes to it any more.
 */
export class TrackerDb extends Dexie {
  workouts!: EntityTable<Workout, 'id'>;
  trainingPlans!: EntityTable<TrainingPlan, 'id'>;
  dietPlans!: EntityTable<DietPlan, 'id'>;
  foodLogDays!: EntityTable<FoodLogDay, 'date'>;
  customFoods!: EntityTable<FoodItem, 'id'>;
  favoriteFoods!: EntityTable<FavoriteRow, 'id'>;
  weightEntries!: EntityTable<WeightEntry, 'id'>;
  profile!: EntityTable<ProfileRow, 'key'>;
  savedProducts!: EntityTable<FoodItem, 'id'>;
  records!: EntityTable<ProgressEntry, 'id'>;
  customExercises!: EntityTable<CustomExercise, 'id'>;

  constructor(name = 'tracker') {
    super(name);
    this.version(1).stores({
      workouts: 'id, date',
      trainingPlans: 'id, name',
      dietPlans: 'id, name',
      foodLogDays: 'date',
      customFoods: 'id',
      favoriteFoods: 'id, addedAt',
      weightEntries: 'id, &date',
      profile: 'key',
    });
    // Packaged products seen before, so they can be found offline. Local only, never exported.
    this.version(2).stores({ savedProducts: 'id' });
    // Personal records: measurements of an exercise on a day.
    this.version(3).stores({ records: 'id, exerciseKey, date' });
    // Exercises the user made up, next to the bundled catalogue.
    this.version(4).stores({ customExercises: 'id, name' });
  }
}
