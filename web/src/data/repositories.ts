import type { Table } from 'dexie';
import type { DietPlan } from '../domain/diet';
import { emptyDay, type FoodLogDay } from '../domain/foodLog';
import { newId } from '../domain/id';
import type { FoodItem, Nutrients } from '../domain/nutrition';
import type { LocalDate } from '../domain/plan';
import { defaultProfile, type Profile, type WeightEntry } from '../domain/profile';
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
import { live, type TrackerDb } from './db';

export class DexieTransactionRunner implements TransactionRunner {
  constructor(private readonly db: TrackerDb) {}

  run<R>(block: () => Promise<R>): Promise<R> {
    return this.db.transaction('rw', this.db.tables, block);
  }
}

export class DexieWorkoutRepository implements WorkoutRepository {
  constructor(private readonly db: TrackerDb) {}

  private onDate(date: LocalDate): Promise<Workout[]> {
    return this.db.workouts.where('date').equals(date).sortBy('id');
  }

  observeWorkouts(date: LocalDate): Stream<Workout[]> {
    return live(() => this.onDate(date));
  }

  observeDaySummaries(from: LocalDate, to: LocalDate): Stream<DaySummary[]> {
    return live(async () => {
      const workouts = await this.db.workouts.where('date').between(from, to, true, true).toArray();
      const byDate = new Map<LocalDate, DaySummary>();
      for (const w of workouts) {
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
    return live(() => this.db.workouts.where('date').between(from, to, true, true).sortBy('id'));
  }

  getWorkouts(date: LocalDate): Promise<Workout[]> {
    return this.onDate(date);
  }

  getWorkout(id: string): Promise<Workout | undefined> {
    return this.db.workouts.get(id);
  }

  async save(workout: Workout): Promise<void> {
    await this.db.workouts.put(workout);
  }

  delete(id: string): Promise<void> {
    return this.db.workouts.delete(id);
  }
}

interface PlanLike {
  readonly id: string;
  readonly name: string;
  readonly isActive: boolean;
}

const byName = (a: PlanLike, b: PlanLike) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });

const setActive = (value: boolean) => (plan: PlanLike) => {
  (plan as { isActive: boolean }).isActive = value;
};

/**
 * Shared by training and diet plans: they differ only in what a plan contains, and in whether
 * several may be active at once ([exclusive] false) or just one ([exclusive] true).
 */
class DexiePlanRepository<P extends PlanLike> implements PlanRepository<P> {
  constructor(
    protected readonly db: TrackerDb,
    protected readonly table: Table<P, string>,
    private readonly exclusive: boolean,
  ) {}

  observePlans(): Stream<P[]> {
    return live(async () => (await this.table.toArray()).sort(byName));
  }

  observePlan(id: string): Stream<P | null> {
    return live(async () => (await this.table.get(id)) ?? null);
  }

  getPlan(id: string): Promise<P | undefined> {
    return this.table.get(id);
  }

  save(plan: P): Promise<void> {
    return this.db.transaction('rw', this.table, async () => {
      if (this.exclusive && plan.isActive) await this.deactivateAllExcept(plan.id);
      await this.table.put(plan);
    });
  }

  delete(id: string): Promise<void> {
    return this.table.delete(id);
  }

  setPlanActive(id: string, active: boolean): Promise<void> {
    return this.db.transaction('rw', this.table, async () => {
      if (this.exclusive && active) await this.deactivateAllExcept(id);
      await this.table.where('id').equals(id).modify(setActive(active));
    });
  }

  protected activePlans(): Promise<P[]> {
    return this.table.filter((p) => p.isActive).toArray().then((plans) => plans.sort(byName));
  }

  protected async deactivateAllExcept(id: string | undefined): Promise<void> {
    await this.table.filter((p) => p.isActive && p.id !== id).modify(setActive(false));
  }
}

class DexieTrainingPlans extends DexiePlanRepository<TrainingPlan> implements TrainingPlanRepository {
  constructor(db: TrackerDb) {
    super(db, db.table<TrainingPlan, string>('trainingPlans'), false);
  }

  observeActivePlans(): Stream<TrainingPlan[]> {
    return live(() => this.activePlans());
  }

  getActivePlans(): Promise<TrainingPlan[]> {
    return this.activePlans();
  }
}

class DexieDietPlans extends DexiePlanRepository<DietPlan> implements DietPlanRepository {
  constructor(db: TrackerDb) {
    super(db, db.table<DietPlan, string>('dietPlans'), true);
  }

  observeActivePlan(): Stream<DietPlan | undefined> {
    return live(async () => (await this.activePlans())[0]);
  }

  async getActivePlan(): Promise<DietPlan | undefined> {
    return (await this.activePlans())[0];
  }

  setActivePlan(id: string | undefined): Promise<void> {
    return this.db.transaction('rw', this.table, async () => {
      await this.deactivateAllExcept(id);
      if (id !== undefined) await this.table.where('id').equals(id).modify(setActive(true));
    });
  }
}

export const dexieTrainingPlans = (db: TrackerDb): TrainingPlanRepository => new DexieTrainingPlans(db);

export const dexieDietPlans = (db: TrackerDb): DietPlanRepository => new DexieDietPlans(db);

/** The days of food log scanned for "recent foods"; older meals are not recent. */
const RECENT_DAYS = 60;

export class DexieFoodLogRepository implements FoodLogRepository {
  constructor(private readonly db: TrackerDb) {}

  observeDay(date: LocalDate): Stream<FoodLogDay> {
    return live(() => this.getDay(date));
  }

  async getDay(date: LocalDate): Promise<FoodLogDay> {
    return (await this.db.foodLogDays.get(date)) ?? emptyDay(date);
  }

  async saveDay(day: FoodLogDay): Promise<void> {
    if (day.entries.length === 0) await this.db.foodLogDays.delete(day.date);
    else await this.db.foodLogDays.put(day);
  }

  observeRecentFoods(limit: number): Stream<FoodItem[]> {
    return live(async () => {
      const days = await this.db.foodLogDays.orderBy('date').reverse().limit(RECENT_DAYS).toArray();
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

export class DexieCustomFoodRepository implements CustomFoodRepository {
  constructor(private readonly db: TrackerDb) {}

  async search(query: string): Promise<FoodItem[]> {
    return rank(query, await this.db.customFoods.toArray(), (f) => f.name);
  }

  async create(name: string, per100g: Nutrients, brand: string | null, servingGrams: number | null): Promise<FoodItem> {
    const food: FoodItem = { id: `custom:${newId()}`, name, brand, per100g, servingGrams };
    await this.db.customFoods.put(food);
    return food;
  }
}

export class DexieFavoriteFoodRepository implements FavoriteFoodRepository {
  constructor(private readonly db: TrackerDb) {}

  observeFavorites(): Stream<FoodItem[]> {
    return live(async () => (await this.db.favoriteFoods.orderBy('addedAt').reverse().toArray()).map((r) => r.food));
  }

  async setFavorite(food: FoodItem, favorite: boolean): Promise<void> {
    if (favorite) await this.db.favoriteFoods.put({ id: food.id, food, addedAt: Date.now() });
    else await this.db.favoriteFoods.delete(food.id);
  }
}

export class DexieProfileRepository implements ProfileRepository {
  constructor(private readonly db: TrackerDb) {}

  observeProfile(): Stream<Profile> {
    return live(async () => {
      const row = await this.db.profile.get('me');
      if (!row) return defaultProfile;
      const { key: _key, ...profile } = row;
      return { ...defaultProfile, ...profile };
    });
  }

  async saveProfile(profile: Profile): Promise<void> {
    await this.db.profile.put({ key: 'me', ...profile });
  }

  observeWeights(): Stream<WeightEntry[]> {
    return live(() => this.db.weightEntries.orderBy('date').toArray());
  }

  setWeight(date: LocalDate, kg: number): Promise<void> {
    return this.db.transaction('rw', this.db.weightEntries, async () => {
      const existing = await this.db.weightEntries.where('date').equals(date).first();
      await this.db.weightEntries.put({ id: existing?.id ?? newId(), date, kg });
    });
  }

  deleteWeight(id: string): Promise<void> {
    return this.db.weightEntries.delete(id);
  }
}

export class DexiePersonalRecords implements PersonalRecordRepository {
  constructor(private readonly db: TrackerDb) {}

  observeAll(): Stream<PersonalRecord[]> {
    return live(async () => newestFirst(await this.db.records.toArray()));
  }

  observeFor(exerciseKey: string): Stream<PersonalRecord[]> {
    return live(() => this.getFor(exerciseKey));
  }

  async getFor(exerciseKey: string): Promise<PersonalRecord[]> {
    return newestFirst(await this.db.records.where('exerciseKey').equals(exerciseKey).toArray());
  }

  async save(record: PersonalRecord): Promise<void> {
    await this.db.records.put(record);
  }

  delete(id: string): Promise<void> {
    return this.db.records.delete(id);
  }
}
