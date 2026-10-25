import { ExerciseLibrary, SqlSavedProducts, OpenFoodFactsRepository, StaticBasicFoods, StaticExerciseCatalog } from '../data/catalog';
import {
  SqlCustomExercises,
  SqlCustomFoodRepository,
  SqlFavoriteFoodRepository,
  SqlFoodLogRepository,
  SqlPersonalRecords,
  SqlProfileRepository,
  SqlTransactionRunner,
  SqlWorkoutRepository,
  sqlDietPlans,
  sqlTrainingPlans,
} from '../data/repositories';
import { OnnxFoodRecognizer, type FoodRecognizer } from '../data/foodRecognizer';
import { CacheSharedFileInbox, type SharedFileInbox } from '../data/importFile';
import type { Store } from '../data/store';
import type { Community } from '../community/ports';
import { createCommunity } from '../community/supabase';
import { SupabaseTransferGateway, type TransferGateway } from '../transfer/gateway';
import type { AppConfig } from './config';

/** Everything the screens depend on, built once at start-up. Screens get it through context. */
export interface Container {
  readonly store: Store;
  readonly repos: {
    readonly workouts: SqlWorkoutRepository;
    readonly trainingPlans: ReturnType<typeof sqlTrainingPlans>;
    readonly dietPlans: ReturnType<typeof sqlDietPlans>;
    readonly foodLog: SqlFoodLogRepository;
    readonly customFoods: SqlCustomFoodRepository;
    readonly favorites: SqlFavoriteFoodRepository;
    readonly profile: SqlProfileRepository;
    readonly records: SqlPersonalRecords;
    readonly transaction: SqlTransactionRunner;
    readonly exercises: ExerciseLibrary;
    readonly customExercises: SqlCustomExercises;
    readonly basicFoods: StaticBasicFoods;
    readonly products: OpenFoodFactsRepository;
    readonly savedProducts: SqlSavedProducts;
  };
  /** Null when no Supabase is configured: sending and receiving are then unavailable. */
  readonly transfer: TransferGateway | null;
  /** Accounts, the public plan library and "Add a device". Null when no Supabase is configured. */
  readonly community: Community | null;
  readonly foodRecognizer: FoodRecognizer;
  /** Files shared to the installed app from another app. */
  readonly sharedFiles: SharedFileInbox;
}

export const createContainer = (config: AppConfig, store: Store): Container => {
  const customExercises = new SqlCustomExercises(store);
  return {
  store,
  repos: {
    workouts: new SqlWorkoutRepository(store),
    trainingPlans: sqlTrainingPlans(store),
    dietPlans: sqlDietPlans(store),
    foodLog: new SqlFoodLogRepository(store),
    customFoods: new SqlCustomFoodRepository(store),
    favorites: new SqlFavoriteFoodRepository(store),
    profile: new SqlProfileRepository(store),
    records: new SqlPersonalRecords(store),
    transaction: new SqlTransactionRunner(store),
    exercises: new ExerciseLibrary(new StaticExerciseCatalog(), customExercises),
    customExercises,
    basicFoods: new StaticBasicFoods(),
    products: new OpenFoodFactsRepository(),
    savedProducts: new SqlSavedProducts(store),
  },
  transfer: config.transferEnabled ? new SupabaseTransferGateway(config.supabaseUrl, config.supabaseKey) : null,
  community: config.transferEnabled ? createCommunity(config.supabaseUrl, config.supabaseKey) : null,
  foodRecognizer: new OnnxFoodRecognizer(),
  sharedFiles: new CacheSharedFileInbox(),
};
};
