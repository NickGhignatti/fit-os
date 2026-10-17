import { TrackerDb } from '../data/db';
import {
  DexieCustomFoodRepository,
  DexieFavoriteFoodRepository,
  DexieFoodLogRepository,
  DexieProfileRepository,
  DexieTransactionRunner,
  DexieWorkoutRepository,
  dexieDietPlans,
  dexieTrainingPlans,
} from '../data/repositories';
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
    readonly transaction: DexieTransactionRunner;
  };
  /** Null when no Supabase is configured: sending and receiving are then unavailable. */
  readonly transfer: TransferGateway | null;
}

export const createContainer = (config: AppConfig, db: TrackerDb = new TrackerDb()): Container => ({
  db,
  repos: {
    workouts: new DexieWorkoutRepository(db),
    trainingPlans: dexieTrainingPlans(db),
    dietPlans: dexieDietPlans(db),
    foodLog: new DexieFoodLogRepository(db),
    customFoods: new DexieCustomFoodRepository(db),
    favorites: new DexieFavoriteFoodRepository(db),
    profile: new DexieProfileRepository(db),
    transaction: new DexieTransactionRunner(db),
  },
  transfer: config.transferEnabled ? new SupabaseTransferGateway(config.supabaseUrl, config.supabaseKey) : null,
});
