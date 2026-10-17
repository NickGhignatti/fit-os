import type { DietPlan } from './diet';
import type { FoodLogDay } from './foodLog';
import type { FoodItem, Nutrients } from './nutrition';
import type { LocalDate } from './plan';
import type { Profile, WeightEntry } from './profile';
import type { TrainingPlan } from './trainingPlan';
import type { DaySummary, Workout } from './workout';

/** A value that is re-emitted whenever the stored data behind it changes. Call the result to stop listening. */
export interface Stream<T> {
  subscribe(next: (value: T) => void, error?: (cause: unknown) => void): () => void;
}

/**
 * Storage holds whole aggregates (a workout with its exercises and sets, a plan with its days),
 * so repositories load and save those; edits are pure functions on the aggregate.
 * Lists come back in the order they were created, unless said otherwise.
 */
export interface WorkoutRepository {
  observeWorkouts(date: LocalDate): Stream<Workout[]>;
  observeDaySummaries(from: LocalDate, to: LocalDate): Stream<DaySummary[]>;
  getWorkouts(date: LocalDate): Promise<Workout[]>;
  getWorkout(id: string): Promise<Workout | undefined>;
  /** Creates the workout, or replaces the stored one with the same id. */
  save(workout: Workout): Promise<void>;
  delete(id: string): Promise<void>;
}

/** Operations every kind of plan supports. */
export interface PlanRepository<P> {
  /** Plans sorted by name. */
  observePlans(): Stream<P[]>;
  /** Emits undefined once the plan is deleted. */
  observePlan(id: string): Stream<P | undefined>;
  observeActivePlan(): Stream<P | undefined>;
  getPlan(id: string): Promise<P | undefined>;
  getActivePlan(): Promise<P | undefined>;
  /** Creates the plan, or replaces the stored one with the same id. */
  save(plan: P): Promise<void>;
  delete(id: string): Promise<void>;
  /** Makes [id] the only active plan, or deactivates every plan when undefined. */
  setActivePlan(id: string | undefined): Promise<void>;
}

export type TrainingPlanRepository = PlanRepository<TrainingPlan>;
export type DietPlanRepository = PlanRepository<DietPlan>;

/** What was eaten, one document per day. */
export interface FoodLogRepository {
  /** An empty day when nothing was logged. */
  observeDay(date: LocalDate): Stream<FoodLogDay>;
  getDay(date: LocalDate): Promise<FoodLogDay>;
  /** Stores the day; a day without entries is removed. */
  saveDay(day: FoodLogDay): Promise<void>;
  /** Distinct foods, most recently logged first. */
  observeRecentFoods(limit: number): Stream<FoodItem[]>;
}

/** Foods the user created. */
export interface CustomFoodRepository {
  search(query: string): Promise<FoodItem[]>;
  /** Saves a new food and returns it with its id. */
  create(name: string, per100g: Nutrients, brand: string | null, servingGrams: number | null): Promise<FoodItem>;
}

/** Foods marked as favourite, newest first. */
export interface FavoriteFoodRepository {
  observeFavorites(): Stream<FoodItem[]>;
  setFavorite(food: FoodItem, favorite: boolean): Promise<void>;
}

export interface ProfileRepository {
  observeProfile(): Stream<Profile>;
  saveProfile(profile: Profile): Promise<void>;
  /** Weigh-ins, oldest first. */
  observeWeights(): Stream<WeightEntry[]>;
  /** Records the weight of [date], replacing any earlier weigh-in of that day. */
  setWeight(date: LocalDate, kg: number): Promise<void>;
  deleteWeight(id: string): Promise<void>;
}

/** Runs a block atomically across repositories: it either fully succeeds or leaves no trace. */
export interface TransactionRunner {
  run<R>(block: () => Promise<R>): Promise<R>;
}
