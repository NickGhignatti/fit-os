import { DexieSavedProducts, ExerciseLibrary, OpenFoodFactsRepository, StaticBasicFoods, StaticExerciseCatalog } from '../data/catalog';
import { TrackerDb } from '../data/db';
import {
  DexieCustomExercises,
  DexieCustomFoodRepository,
  DexieFavoriteFoodRepository,
  DexieFoodLogRepository,
  DexiePersonalRecords,
  DexieProfileRepository,
  DexieTransactionRunner,
  DexieWorkoutRepository,
  dexieDietPlans,
  dexieTrainingPlans,
} from '../data/repositories';
import { createCommunity } from '../community/supabase';
import type { Community } from '../community/ports';
import { SupabaseTransferGateway, type TransferGateway } from '../transfer/gateway';
import type { AppConfig } from './config';

/** Everything the screens depend on, built once at start-up. Screens get it through context. */
export interface Container {
  readonly db: TrackerDb;
  readonly repos: {
    readonly workouts: DexieWorkoutRepository;
    readonly trainingPlans: ReturnType<typeof dexieTrainingPlans>;
    readonly dietPlans: ReturnType<typeof dexieDietPlans>;
    readonly foodLog: DexieFoodLogRepository;
    readonly customFoods: DexieCustomFoodRepository;
    readonly favorites: DexieFavoriteFoodRepository;
    readonly profile: DexieProfileRepository;
    readonly records: DexiePersonalRecords;
    readonly transaction: DexieTransactionRunner;
    readonly exercises: ExerciseLibrary;
    readonly customExercises: DexieCustomExercises;
    readonly basicFoods: StaticBasicFoods;
    readonly products: OpenFoodFactsRepository;
    readonly savedProducts: DexieSavedProducts;
  };
  /** Null when no Supabase is configured: sending and receiving are then unavailable. */
  readonly transfer: TransferGateway | null;
  /** Accounts and the public plan library. Null when no Supabase is configured. */
  readonly community: Community | null;
}

export const createContainer = (config: AppConfig, db: TrackerDb = new TrackerDb()): Container => {
  const customExercises = new DexieCustomExercises(db);
  return {
  db,
  repos: {
    workouts: new DexieWorkoutRepository(db),
    trainingPlans: dexieTrainingPlans(db),
    dietPlans: dexieDietPlans(db),
    foodLog: new DexieFoodLogRepository(db),
    customFoods: new DexieCustomFoodRepository(db),
    favorites: new DexieFavoriteFoodRepository(db),
    profile: new DexieProfileRepository(db),
    records: new DexiePersonalRecords(db),
    transaction: new DexieTransactionRunner(db),
    exercises: new ExerciseLibrary(new StaticExerciseCatalog(), customExercises),
    customExercises,
    basicFoods: new StaticBasicFoods(),
    products: new OpenFoodFactsRepository(),
    savedProducts: new DexieSavedProducts(db),
  },
  transfer: config.transferEnabled ? new SupabaseTransferGateway(config.supabaseUrl, config.supabaseKey) : null,
  community: config.transferEnabled ? createCommunity(config.supabaseUrl, config.supabaseKey) : null,
};
};
