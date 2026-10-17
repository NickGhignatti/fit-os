import { z } from 'zod';
import type { DietPlan } from '../domain/diet';
import type { TrainingPlan } from '../domain/trainingPlan';
import {
  dietPlanSchema,
  foodItemSchema,
  foodLogDaySchema,
  profileSchema,
  trainingPlanSchema,
  weightEntrySchema,
  workoutSchema,
} from '../domain/schemas';
import { defaultProfile } from '../domain/profile';
import type { TrackerDb } from './db';

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
  }),
});

export type Backup = z.infer<typeof backupSchema>;

export const exportBackup = (db: TrackerDb, now: () => Date = () => new Date()): Promise<Backup> =>
  db.transaction('r', db.tables, async () => ({
    app: FORMAT,
    v: VERSION,
    exportedAt: now().toISOString(),
    data: {
      trainingPlans: await db.trainingPlans.toArray(),
      dietPlans: await db.dietPlans.toArray(),
      workouts: await db.workouts.toArray(),
      foodLogDays: await db.foodLogDays.toArray(),
      customFoods: await db.customFoods.toArray(),
      favorites: (await db.favoriteFoods.toArray()).map(({ food, addedAt }) => ({ food, addedAt })),
      weights: await db.weightEntries.toArray(),
      profile: await readProfile(db),
    },
  }));

const readProfile = async (db: TrackerDb) => {
  const row = await db.profile.get('me');
  if (!row) return null;
  const { key: _key, ...profile } = row;
  return { ...defaultProfile, ...profile };
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
 * If the backup has an active plan it becomes the active one, replacing the current choice.
 */
export const restoreBackup = (db: TrackerDb, { data }: Backup): Promise<void> =>
  db.transaction('rw', db.tables, async () => {
    await restorePlans(db, 'trainingPlans', data.trainingPlans);
    await restorePlans(db, 'dietPlans', data.dietPlans);
    await db.workouts.bulkPut(data.workouts);
    await db.foodLogDays.bulkPut(data.foodLogDays);
    await db.customFoods.bulkPut(data.customFoods);
    await db.favoriteFoods.bulkPut(data.favorites.map(({ food, addedAt }) => ({ id: food.id, food, addedAt })));
    await restoreWeights(db, data.weights);
    if (data.profile) await db.profile.put({ key: 'me', ...data.profile });
  });

const restorePlans = async (db: TrackerDb, table: 'trainingPlans' | 'dietPlans', plans: (TrainingPlan | DietPlan)[]) => {
  const incoming = keepOneActive(plans);
  const active = incoming.find((p) => p.isActive);
  const store = db.table<TrainingPlan | DietPlan, string>(table);
  if (active) await store.filter((p) => p.isActive).modify((p) => void ((p as { isActive: boolean }).isActive = false));
  await store.bulkPut(incoming);
};

/** One weigh-in per day: a restored weight replaces the one already on that date. */
const restoreWeights = async (db: TrackerDb, weights: Backup['data']['weights']) => {
  for (const w of weights) {
    const sameDay = await db.weightEntries.where('date').equals(w.date).first();
    if (sameDay && sameDay.id !== w.id) await db.weightEntries.delete(sameDay.id);
    await db.weightEntries.put(w);
  }
};
