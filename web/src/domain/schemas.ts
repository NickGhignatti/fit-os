import { z } from 'zod';
import { EQUIPMENT, MUSCLES, type CustomExercise } from './catalog';
import type { DietPlan } from './diet';
import type { FoodLogDay } from './foodLog';
import type { FoodItem } from './nutrition';
import { BODY_MEASURES, MAX_MEALS, type BodyMeasure, type Profile, type WeightEntry } from './profile';
import { METRICS, type ProgressEntry } from './progress';
import type { TrainingPlan } from './trainingPlan';
import type { Workout } from './workout';

/**
 * Validation for everything that comes from outside the app: a received transfer, a backup file.
 * Each schema is checked against its domain type, so the two cannot drift apart. Strings and
 * lists are bounded so a hostile file cannot fill the device.
 */
type Schema<T> = z.ZodType<T, z.ZodTypeDef, unknown>;

const text = (max: number) => z.string().max(max);
const id = z.string().min(1).max(64);
const count = (n: number) => z.number().finite().nonnegative().max(n);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const weight = count(1000).nullable();

const nutrients = z.object({ kcal: count(10_000), protein: count(1_000), carbs: count(1_000), fat: count(1_000) });

export const foodItemSchema: Schema<FoodItem> = z.object({
  id: z.string().regex(/^(crea|off|custom):.{1,64}$/) as unknown as z.ZodType<FoodItem['id']>,
  name: text(200),
  brand: text(200).nullable(),
  per100g: nutrients,
  servingGrams: count(5_000).nullable(),
});

const portion = z.object({ food: foodItemSchema, grams: z.number().finite().positive().max(100_000) });

const recurrence = z.enum(['daily', 'weekly']);
const planDayKey = z.enum(['0', '1', '2', '3', '4', '5', '6', '7']);

/** Plan days arrive as JSON object keys, so they are strings "0".."7". */
const byDay = <T extends z.ZodTypeAny>(item: T) =>
  z.record(planDayKey, z.array(item).max(100)).transform((r) => r as Record<number, z.infer<T>[]>);

/** Seconds of rest after a set; files from before rest times existed have none. */
const rest = z.number().int().nonnegative().max(3_600).nullable().default(null);
/** Seconds each rep of a timed set lasts; files from before timed sets existed have none. */
const seconds = z.number().int().positive().max(86_400).nullable().default(null);

/**
 * The fields of a planned set and exercise, shared by the stored and the authored plan below so
 * that both check every value the same way. The descriptions travel into the published JSON
 * Schema and the AI prompt (see data/planSpec.ts): what a field means is written once, here.
 */
const setFields = {
  reps: z.number().int().positive().max(10_000)
    .describe('Repetitions in the set. For a timed hold use 1 and put the hold time in seconds.'),
  weight: weight.describe('Extra load in kg (a barbell, dumbbells, a weighted vest). null for bodyweight.'),
  seconds: seconds.describe(
    'Seconds each rep lasts, for timed sets only: a 45 s plank is reps 1, seconds 45; five 5 s isometric pushes are reps 5, seconds 5. null for ordinary sets.',
  ),
};
const exerciseFields = {
  name: text(120).min(1).describe('The exercise name. A name that matches an exercise of the app catalogue exactly links its photos and instructions.'),
  notes: text(2_000).describe('Coaching cues, tempo, progression: anything the athlete should read while training.'),
  catalogId: text(120).nullable().describe('Id of the exercise in the app catalogue, or null. Leave null when unsure: the app links exact catalogue names itself.'),
  restSeconds: rest.describe('Seconds of rest after each set. null for the app default (90 s).'),
  restAfterSeconds: rest.describe('Seconds of rest after the exercise, before the next one. null for the app default (120 s).'),
};

const plannedSet = z.object({ id, ...setFields });
const plannedExercise = z.object({ id, ...exerciseFields, name: text(120), sets: z.array(plannedSet).max(100) });

export const trainingPlanSchema: Schema<TrainingPlan> = z.object({
  id,
  name: text(80).min(1),
  recurrence,
  isActive: z.boolean(),
  sessions: byDay(plannedExercise),
});

/**
 * A training plan as a person or an AI writes it, for importing. Same values, same limits as the
 * stored plan, but the bookkeeping may be left out: ids (an import gives everything fresh ones
 * anyway), notes, the catalogue link, the load, the rests, the active flag and the recurrence,
 * which is read from the days used. A plan the app wrote itself always passes, even an empty one
 * or one with an exercise left without sets: only days that contradict the recurrence are refused.
 */
const authoredId = z.string().max(64).optional().default('').describe('Optional: the app assigns its own ids on import.');

const authoredSet = z.object({ id: authoredId, ...setFields, weight: setFields.weight.default(null) });

const authoredExercise = z.object({
  id: authoredId,
  ...exerciseFields,
  notes: exerciseFields.notes.default(''),
  catalogId: exerciseFields.catalogId.default(null),
  sets: z.array(authoredSet).max(100).describe('The sets, in order. Each one can differ (a pyramid, a back-off set).'),
});

const DAYS_DESCRIPTION =
  'Exercises per day. Weekly plans use "1" (Monday) to "7" (Sunday) and leave rest days out; a daily plan (the same session every day) uses only "0".';

export const authoredTrainingPlanSchema: Schema<TrainingPlan> = z
  .object({
    id: authoredId,
    name: text(80).min(1).describe('The plan name, as the athlete will see it.'),
    recurrence: recurrence.optional().describe('"weekly" (a session per weekday) or "daily". Optional: read from the days used.'),
    isActive: z.boolean().default(false).describe('Optional and ignored: imported plans start inactive, the athlete turns them on.'),
    sessions: byDay(authoredExercise).describe(DAYS_DESCRIPTION),
  })
  .transform((plan) => ({ ...plan, recurrence: plan.recurrence ?? (0 in plan.sessions ? 'daily' as const : 'weekly' as const) }))
  .superRefine((plan, ctx) => {
    const days = Object.keys(plan.sessions).map(Number);
    if (plan.recurrence === 'daily' ? days.some((d) => d !== 0) : days.includes(0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['sessions'],
        message: plan.recurrence === 'daily'
          ? 'a daily plan has only day "0"; use "weekly" with days "1"-"7" for a session per weekday'
          : 'a weekly plan uses days "1" (Monday) to "7" (Sunday); "0" is only for daily plans',
      });
    }
  });

const plannedFood = z.object({ id, name: text(200), quantity: text(200), portion: portion.nullable() });
const meal = z.object({ id, name: text(80), time: text(20), foods: z.array(plannedFood).max(200) });

export const dietPlanSchema: Schema<DietPlan> = z.object({
  id,
  name: text(80).min(1),
  recurrence,
  isActive: z.boolean(),
  meals: byDay(meal),
});

const exerciseSet = z.object({
  id,
  plannedReps: z.number().int().positive().max(10_000),
  plannedWeight: weight,
  actualReps: z.number().int().nonnegative().max(10_000).nullable(),
  actualWeight: weight,
  plannedSeconds: seconds,
  actualSeconds: seconds,
  done: z.boolean(),
  note: text(500).default(''),
});

export const workoutSchema: Schema<Workout> = z.object({
  id,
  date,
  title: text(80),
  planId: id.nullable(),
  elapsedMs: z.number().int().nonnegative().default(0),
  runningSince: z.number().int().nonnegative().nullable().default(null),
  exercises: z
    .array(z.object({ id, name: text(120), notes: text(2_000), sets: z.array(exerciseSet).max(100), catalogId: text(120).nullable(), restSeconds: rest, restAfterSeconds: rest }))
    .max(100),
});

export const foodLogDaySchema: Schema<FoodLogDay> = z.object({
  date,
  entries: z.array(z.object({ id, meal: text(80), portion })).max(500),
});

const widgetSlots = z.array(z.object({ id: text(40), size: z.enum(['half', 'full']) })).max(40);

export const profileSchema: Schema<Profile> = z.object({
  sex: z.enum(['male', 'female']).nullable(),
  birthDate: date.nullable(),
  heightCm: count(300).nullable(),
  activity: z.enum(['sedentary', 'light', 'moderate', 'active', 'very_active']),
  pace: z.enum(['lose_fast', 'lose', 'lose_slow', 'maintain', 'gain_slow', 'gain']),
  customKcal: count(20_000).nullable(),
  // Added later: files written before have no such keys.
  customProtein: count(2_000).nullable().default(null),
  customCarbs: count(2_000).nullable().default(null),
  customFat: count(2_000).nullable().default(null),
  mealNames: z.array(z.string().trim().min(1).max(40)).min(1).max(MAX_MEALS).nullable().default(null),
  layout: z.object({ today: widgetSlots.optional(), body: widgetSlots.optional() }).optional(),
});

const bodyComposition = z.object(Object.fromEntries(
  BODY_MEASURES.map((m) => [m.key, z.number().finite().min(m.min).max(m.max).optional()]),
) as Record<BodyMeasure, z.ZodOptional<z.ZodNumber>>);

export const weightEntrySchema: Schema<WeightEntry> = z.object({
  id, date, kg: z.number().finite().positive().max(1000), body: bodyComposition.optional(),
});

export const progressEntrySchema: Schema<ProgressEntry> = z
  .object({
    id,
    exerciseKey: text(200).min(1),
    exerciseName: text(120).min(1),
    catalogId: text(120).nullable(),
    metric: z.enum(METRICS),
    value: z.number().finite().positive().max(10_000_000),
    reps: z.number().int().min(1).max(1_000).nullable(),
    date,
    note: text(500),
  })
  // A lift needs the reps it was done for; the other measurements have none.
  .refine((r) => (r.metric === 'weight' ? r.reps !== null : r.reps === null));

export const customExerciseSchema: Schema<CustomExercise> = z.object({
  id: z.string().regex(/^custom:.{1,64}$/),
  name: text(120).min(1),
  muscle: z.enum(MUSCLES).nullable(),
  equipment: z.enum(EQUIPMENT).nullable(),
  notes: text(2_000),
});
