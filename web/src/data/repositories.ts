import type { DietPlan } from '../domain/diet';
import type { CustomExercise, CustomExerciseRepository } from '../domain/catalog';
import { emptyDay, type FoodLogDay } from '../domain/foodLog';
import { newId } from '../domain/id';
import type { FoodItem, Nutrients } from '../domain/nutrition';
import type { LocalDate } from '../domain/plan';
import { defaultProfile, type BodyComposition, type Profile, type WeightEntry } from '../domain/profile';
import type {
  CustomFoodRepository,
  DietPlanRepository,
  FavoriteFoodRepository,
  FoodLogRepository,
  PersonalRecordRepository,
  PlanRepository,
  ProfileRepository,
  Stream,
  TrainingPlanRepository,
  TransactionRunner,
  WorkoutRepository,
} from '../domain/repositories';
import { newestFirst, type PersonalRecord } from '../domain/records';
import { rank } from '../domain/textSearch';
import type { TrainingPlan } from '../domain/trainingPlan';
import type { DaySummary, Workout } from '../domain/workout';
import { Tables, type DocTable } from './schema';
import type { Docs, Store } from './store';

export class SqlTransactionRunner implements TransactionRunner {
  constructor(private readonly store: Store) {}

  run<R>(block: () => Promise<R>): Promise<R> {
    return this.store.transaction(block);
  }
}

export class SqlWorkoutRepository implements WorkoutRepository {
  constructor(private readonly store: Store) {}

  private onDate = (docs: Docs, date: LocalDate) => docs.list(Tables.workouts, 'date = ?', [date]);
  private between = (docs: Docs, from: LocalDate, to: LocalDate) => docs.list(Tables.workouts, 'date BETWEEN ? AND ?', [from, to]);

  observeWorkouts(date: LocalDate): Stream<Workout[]> {
    return this.store.live(['workouts'], (docs) => this.onDate(docs, date));
  }

  observeDaySummaries(from: LocalDate, to: LocalDate): Stream<DaySummary[]> {
    return this.store.live(['workouts'], async (docs) => {
      const byDate = new Map<LocalDate, DaySummary>();
      for (const w of await this.between(docs, from, to)) {
        const previous = byDate.get(w.date) ?? { date: w.date, totalSets: 0, doneSets: 0 };
        byDate.set(w.date, {
          date: w.date,
          totalSets: previous.totalSets + w.exercises.reduce((n, e) => n + e.sets.length, 0),
          doneSets: previous.doneSets + w.exercises.reduce((n, e) => n + e.sets.filter((s) => s.done).length, 0),
        });
      }
      return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
    });
  }

  observeWorkoutsBetween(from: LocalDate, to: LocalDate): Stream<Workout[]> {
    return this.store.live(['workouts'], (docs) => this.between(docs, from, to));
  }

  getWorkouts(date: LocalDate): Promise<Workout[]> {
    return this.onDate(this.store.docs, date);
  }

  getWorkout(id: string): Promise<Workout | undefined> {
    return this.store.docs.get(Tables.workouts, id);
  }

  save(workout: Workout): Promise<void> {
    return this.store.docs.put(Tables.workouts, workout);
  }

  delete(id: string): Promise<void> {
    return this.store.docs.delete(Tables.workouts, id);
  }
}

interface PlanLike {
  readonly id: string;
  readonly name: string;
  readonly isActive: boolean;
}

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });

/**
 * Shared by training and diet plans: they differ only in what a plan contains, and in whether
 * several may be active at once ([exclusive] false) or just one ([exclusive] true).
 */
class SqlPlanRepository<P extends PlanLike> implements PlanRepository<P> {
  constructor(
    protected readonly store: Store,
    protected readonly table: DocTable<P>,
    private readonly exclusive: boolean,
  ) {}

  observePlans(): Stream<P[]> {
    return this.store.live([this.table.name], async (docs) => (await docs.list(this.table)).sort(byName));
  }

  observePlan(id: string): Stream<P | null> {
    return this.store.live([this.table.name], async (docs) => (await docs.get(this.table, id)) ?? null);
  }

  getPlan(id: string): Promise<P | undefined> {
    return this.store.docs.get(this.table, id);
  }

  save(plan: P): Promise<void> {
    return this.store.transaction(async () => {
      if (this.exclusive && plan.isActive) await this.deactivateAllExcept(plan.id);
      await this.store.docs.put(this.table, plan);
    });
  }

  delete(id: string): Promise<void> {
    return this.store.docs.delete(this.table, id);
  }

  setPlanActive(id: string, active: boolean): Promise<void> {
    return this.store.transaction(async () => {
      if (this.exclusive && active) await this.deactivateAllExcept(id);
      await this.markActive(id, active);
    });
  }

  protected async markActive(id: string, active: boolean): Promise<void> {
    const plan = await this.store.docs.get(this.table, id);
    if (plan) await this.store.docs.put(this.table, { ...plan, isActive: active });
  }

  protected activePlans(docs: Docs): Promise<P[]> {
    return docs.list(this.table, 'is_active = 1').then((plans) => plans.sort(byName));
  }

  protected async deactivateAllExcept(id: string | undefined): Promise<void> {
    for (const plan of await this.activePlans(this.store.docs)) {
      if (plan.id !== id) await this.store.docs.put(this.table, { ...plan, isActive: false });
    }
  }
}

class SqlTrainingPlans extends SqlPlanRepository<TrainingPlan> implements TrainingPlanRepository {
  constructor(store: Store) {
    super(store, Tables.trainingPlans, false);
  }

  observeActivePlans(): Stream<TrainingPlan[]> {
    return this.store.live([this.table.name], (docs) => this.activePlans(docs));
  }

  getActivePlans(): Promise<TrainingPlan[]> {
    return this.activePlans(this.store.docs);
  }
}

class SqlDietPlans extends SqlPlanRepository<DietPlan> implements DietPlanRepository {
  constructor(store: Store) {
    super(store, Tables.dietPlans, true);
  }

  observeActivePlan(): Stream<DietPlan | undefined> {
    return this.store.live([this.table.name], async (docs) => (await this.activePlans(docs))[0]);
  }

  async getActivePlan(): Promise<DietPlan | undefined> {
    return (await this.activePlans(this.store.docs))[0];
  }

  setActivePlan(id: string | undefined): Promise<void> {
    return this.store.transaction(async () => {
      await this.deactivateAllExcept(id);
      if (id !== undefined) await this.markActive(id, true);
    });
  }
}

export const sqlTrainingPlans = (store: Store): TrainingPlanRepository => new SqlTrainingPlans(store);

export const sqlDietPlans = (store: Store): DietPlanRepository => new SqlDietPlans(store);

/** The days of food log scanned for "recent foods"; older meals are not recent. */
const RECENT_DAYS = 60;

export class SqlFoodLogRepository implements FoodLogRepository {
  constructor(private readonly store: Store) {}

  private day = async (docs: Docs, date: LocalDate) => (await docs.get(Tables.foodLogDays, date)) ?? emptyDay(date);

  observeDay(date: LocalDate): Stream<FoodLogDay> {
    return this.store.live(['food_log_days'], (docs) => this.day(docs, date));
  }

  getDay(date: LocalDate): Promise<FoodLogDay> {
    return this.day(this.store.docs, date);
  }

  async saveDay(day: FoodLogDay): Promise<void> {
    if (day.entries.length === 0) await this.store.docs.delete(Tables.foodLogDays, day.date);
    else await this.store.docs.put(Tables.foodLogDays, day);
  }

  observeRecentFoods(limit: number): Stream<FoodItem[]> {
    return this.store.live(['food_log_days'], async (docs) => {
      const days = await docs.list(Tables.foodLogDays, '', [], `date DESC LIMIT ${RECENT_DAYS}`);
      const seen = new Map<string, FoodItem>();
      for (const day of days) {
        for (const entry of [...day.entries].reverse()) {
          if (!seen.has(entry.portion.food.id)) seen.set(entry.portion.food.id, entry.portion.food);
        }
        if (seen.size >= limit) break;
      }
      return [...seen.values()].slice(0, limit);
    });
  }
}

export class SqlCustomFoodRepository implements CustomFoodRepository {
  constructor(private readonly store: Store) {}

  async search(query: string): Promise<FoodItem[]> {
    return rank(query, await this.store.docs.list(Tables.customFoods), (f) => f.name);
  }

  async create(name: string, per100g: Nutrients, brand: string | null, servingGrams: number | null): Promise<FoodItem> {
    const food: FoodItem = { id: `custom:${newId()}`, name, brand, per100g, servingGrams };
    await this.store.docs.put(Tables.customFoods, food);
    return food;
  }
}

export class SqlFavoriteFoodRepository implements FavoriteFoodRepository {
  constructor(private readonly store: Store) {}

  observeFavorites(): Stream<FoodItem[]> {
    return this.store.live(['favorite_foods'], async (docs) =>
      (await docs.list(Tables.favoriteFoods, '', [], 'added_at DESC')).map((r) => r.food));
  }

  async setFavorite(food: FoodItem, favorite: boolean): Promise<void> {
    if (favorite) await this.store.docs.put(Tables.favoriteFoods, { food, addedAt: Date.now() });
    else await this.store.docs.delete(Tables.favoriteFoods, food.id);
  }
}

/** The stored profile over the defaults, so fields added since it was saved get their usual value. */
export const readProfile = async (docs: Docs): Promise<Profile | undefined> => {
  const stored = await docs.get(Tables.profile, 'me');
  return stored && { ...defaultProfile, ...stored };
};

export class SqlProfileRepository implements ProfileRepository {
  constructor(private readonly store: Store) {}

  observeProfile(): Stream<Profile> {
    return this.store.live(['profile'], async (docs) => (await readProfile(docs)) ?? defaultProfile);
  }

  saveProfile(profile: Profile): Promise<void> {
    return this.store.docs.put(Tables.profile, profile);
  }

  observeWeights(): Stream<WeightEntry[]> {
    return this.store.live(['weight_entries'], (docs) => docs.list(Tables.weightEntries, '', [], 'date'));
  }

  setWeight(date: LocalDate, kg: number, body: BodyComposition = {}): Promise<void> {
    return this.store.transaction(async () => {
      const existing = await this.store.docs.first(Tables.weightEntries, 'date = ?', [date]);
      const merged = { ...existing?.body, ...body };
      await this.store.docs.put(Tables.weightEntries, {
        id: existing?.id ?? newId(), date, kg, ...(Object.keys(merged).length > 0 ? { body: merged } : {}),
      });
    });
  }

  deleteWeight(id: string): Promise<void> {
    return this.store.docs.delete(Tables.weightEntries, id);
  }
}

export class SqlPersonalRecords implements PersonalRecordRepository {
  constructor(private readonly store: Store) {}

  private of = async (docs: Docs, exerciseKey: string) =>
    newestFirst(await docs.list(Tables.records, 'exercise_key = ?', [exerciseKey]));

  observeAll(): Stream<PersonalRecord[]> {
    return this.store.live(['records'], async (docs) => newestFirst(await docs.list(Tables.records)));
  }

  observeFor(exerciseKey: string): Stream<PersonalRecord[]> {
    return this.store.live(['records'], (docs) => this.of(docs, exerciseKey));
  }

  getFor(exerciseKey: string): Promise<PersonalRecord[]> {
    return this.of(this.store.docs, exerciseKey);
  }

  save(record: PersonalRecord): Promise<void> {
    return this.store.docs.put(Tables.records, record);
  }

  delete(id: string): Promise<void> {
    return this.store.docs.delete(Tables.records, id);
  }
}

export class SqlCustomExercises implements CustomExerciseRepository {
  constructor(private readonly store: Store) {}

  private all = async (docs: Docs) => (await docs.list(Tables.customExercises)).sort(byName);

  observeAll(): Stream<CustomExercise[]> {
    return this.store.live(['custom_exercises'], this.all);
  }

  getAll(): Promise<CustomExercise[]> {
    return this.all(this.store.docs);
  }

  save(exercise: CustomExercise): Promise<void> {
    return this.store.docs.put(Tables.customExercises, exercise);
  }

  delete(id: string): Promise<void> {
    return this.store.docs.delete(Tables.customExercises, id);
  }
}
