import Dexie, { liveQuery, type EntityTable } from 'dexie';
import type { DietPlan } from '../domain/diet';
import type { FoodLogDay } from '../domain/foodLog';
import type { FoodItem } from '../domain/nutrition';
import type { Profile, WeightEntry } from '../domain/profile';
import type { Stream } from '../domain/repositories';
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
 * The on-device database. Everything the user owns lives here and nothing leaves it unless they
 * send an item or export a backup. Aggregates are stored whole; ids are time-ordered, so
 * primary-key order is creation order. Booleans cannot be indexed, so the active plan is found
 * by filtering (a user has a handful of plans).
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
  }
}

/** A Stream that re-runs [query] whenever the tables it reads change. */
export const live = <T>(query: () => Promise<T> | T): Stream<T> => ({
  subscribe(next, error) {
    const subscription = liveQuery(query).subscribe({ next, error });
    return () => subscription.unsubscribe();
  },
});
