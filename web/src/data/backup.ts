import { z } from 'zod';
import type { DietPlan } from '../domain/diet';
import {
  customExerciseSchema,
  dietPlanSchema,
  foodItemSchema,
  foodLogDaySchema,
  personalRecordSchema,
  profileSchema,
  trainingPlanSchema,
  weightEntrySchema,
  workoutSchema,
} from '../domain/schemas';
import { readProfile } from './repositories';
import { Tables, type DocTable } from './schema';
import type { Store } from './store';

/**
 * The whole device as one file: the backup for a browser that clears its storage, and the way
 * to move everything at once. Nothing is uploaded; the user saves and opens the file.
 */
const FORMAT = 'tracker';
const VERSION = 1;

const backupSchema = z.object({
  app: z.literal(FORMAT),
  v: z.literal(VERSION),
  exportedAt: z.string(),
  data: z.object({
    trainingPlans: z.array(trainingPlanSchema).max(1_000),
    dietPlans: z.array(dietPlanSchema).max(1_000),
    workouts: z.array(workoutSchema).max(50_000),
    foodLogDays: z.array(foodLogDaySchema).max(20_000),
    customFoods: z.array(foodItemSchema).max(10_000),
    favorites: z.array(z.object({ food: foodItemSchema, addedAt: z.number().finite() })).max(10_000),
    weights: z.array(weightEntrySchema).max(20_000),
    profile: profileSchema.nullable(),
    // Added later: backups written before have no records.
    records: z.array(personalRecordSchema).max(50_000).default([]),
    customExercises: z.array(customExerciseSchema).max(5_000).default([]),
  }),
});

export type Backup = z.infer<typeof backupSchema>;

export const exportBackup = async (store: Store, now: () => Date = () => new Date()): Promise<Backup> => {
  const docs = store.direct;
  return {
    app: FORMAT,
    v: VERSION,
    exportedAt: now().toISOString(),
    data: {
      trainingPlans: await docs.list(Tables.trainingPlans),
      dietPlans: await docs.list(Tables.dietPlans),
      workouts: await docs.list(Tables.workouts),
      foodLogDays: await docs.list(Tables.foodLogDays),
      customFoods: await docs.list(Tables.customFoods),
      favorites: await docs.list(Tables.favoriteFoods),
      weights: await docs.list(Tables.weightEntries),
      profile: (await readProfile(docs)) ?? null,
      records: await docs.list(Tables.records),
      customExercises: await docs.list(Tables.customExercises),
    },
  };
};

export type ParsedBackup = { readonly ok: true; readonly backup: Backup } | { readonly ok: false; readonly error: string };

/** Reads the text of a backup file; never throws. */
export const parseBackup = (text: string): ParsedBackup => {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, error: 'not a JSON file' };
  }
  const parsed = backupSchema.safeParse(json);
  if (parsed.success) return { ok: true, backup: parsed.data };
  const issue = parsed.error.issues[0];
  return { ok: false, error: issue ? `${issue.path.join('.') || 'file'}: ${issue.message}` : 'invalid backup' };
};

/** Where more than one plan claims to be active, the last one wins. */
const keepOneActive = <P extends { id: string; isActive: boolean }>(plans: P[]): P[] => {
  const lastActive = plans.findLast((p) => p.isActive)?.id;
  return plans.map((p) => (p.isActive && p.id !== lastActive ? { ...p, isActive: false } : p));
};

/**
 * Merges a backup into the device: items with the same id are replaced, everything else is kept.
 * If the backup has an active diet it becomes the active one, replacing the current choice; restored
 * workout plans keep whatever active state they had, alongside those already on the device.
 */
export const restoreBackup = (store: Store, { data }: Backup): Promise<void> =>
  store.transaction(async () => {
    const docs = store.docs;
    const putAll = async <T>(table: DocTable<T>, values: readonly T[]) => { for (const v of values) await docs.put(table, v); };
    await putAll(Tables.trainingPlans, data.trainingPlans); // any number can be active
    await restoreDiets(store, data.dietPlans); // only one diet can be
    await putAll(Tables.workouts, data.workouts);
    await putAll(Tables.foodLogDays, data.foodLogDays);
    await putAll(Tables.customFoods, data.customFoods);
    await putAll(Tables.favoriteFoods, data.favorites);
    await restoreWeights(store, data.weights);
    if (data.profile) await docs.put(Tables.profile, data.profile);
    await putAll(Tables.records, data.records);
    await putAll(Tables.customExercises, data.customExercises);
  });

const restoreDiets = async (store: Store, plans: DietPlan[]) => {
  const incoming = keepOneActive(plans);
  if (incoming.some((p) => p.isActive)) {
    for (const p of await store.docs.list(Tables.dietPlans, 'is_active = 1')) await store.docs.put(Tables.dietPlans, { ...p, isActive: false });
  }
  for (const p of incoming) await store.docs.put(Tables.dietPlans, p);
};

/** One weigh-in per day: a restored weight replaces the one already on that date. */
const restoreWeights = async (store: Store, weights: Backup['data']['weights']) => {
  for (const w of weights) {
    const sameDay = await store.docs.first(Tables.weightEntries, 'date = ?', [w.date]);
    if (sameDay && sameDay.id !== w.id) await store.docs.delete(Tables.weightEntries, sameDay.id);
    await store.docs.put(Tables.weightEntries, w);
  }
};
