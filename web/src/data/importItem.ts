import type { ExerciseLinker } from '../domain/catalog';
import { copyDietPlan, copyTrainingPlan, copyWorkout, mergeFoodLogDay } from '../domain/copy';
import { emptyDay } from '../domain/foodLog';
import { authoredTrainingPlanSchema, dietPlanSchema, foodLogDaySchema, workoutSchema } from '../domain/schemas';
import type { TrainingPlan } from '../domain/trainingPlan';
import type { Workout } from '../domain/workout';
import type { Envelope, TransferKind } from '../transfer/transfer';
import { describeIssues, ignoredFields } from './importProblems';
import { Tables } from './schema';
import type { Store } from './store';

export type ImportResult =
  | {
    readonly status: 'imported';
    readonly kind: TransferKind;
    readonly title: string;
    /** Where the item now lives: its new id, or the date of a food-log day. */
    readonly id: string;
    /** Fields the item had that the app does not know, and so left out; see [ignoredFields]. */
    readonly ignored: readonly string[];
  }
  /** The item does not have the shape its kind promises; nothing was stored. [problems] says why. */
  | { readonly status: 'invalid'; readonly problems: readonly string[] };

export interface ImportOptions {
  /** Links exercises without a catalogue id to the catalogue exercise of the same name. */
  readonly linkExercise?: ExerciseLinker;
}

/** Gives exercises that have no catalogue link the one their name matches, if any. */
const linked = async <E extends { readonly name: string; readonly catalogId: string | null }>(
  exercises: readonly E[], link: ExerciseLinker | undefined,
): Promise<E[]> =>
  Promise.all(exercises.map(async (e) => (e.catalogId !== null || !link ? e : { ...e, catalogId: await link(e.name) })));

const linkPlan = async (plan: TrainingPlan, link?: ExerciseLinker): Promise<TrainingPlan> => ({
  ...plan,
  sessions: Object.fromEntries(await Promise.all(Object.entries(plan.sessions).map(async ([day, list]) => [day, await linked(list, link)]))),
});

const linkWorkout = async (workout: Workout, link?: ExerciseLinker): Promise<Workout> => ({
  ...workout, exercises: await linked(workout.exercises, link),
});

/**
 * Stores a received item as a copy: validated, with fresh ids, and never active, so it cannot
 * overwrite or replace anything the user already has. A food-log day is added to that day.
 * Training plans are read as authored (see [authoredTrainingPlanSchema]), so a plan written by
 * hand or by an AI imports without ids and other bookkeeping.
 */
export const importEnvelope = async (store: Store, envelope: Envelope, { linkExercise }: ImportOptions = {}): Promise<ImportResult> => {
  const { data } = envelope;
  switch (envelope.kind) {
    case 'training_plan': {
      const parsed = authoredTrainingPlanSchema.safeParse(data);
      if (!parsed.success) return { status: 'invalid', problems: describeIssues(parsed.error.issues, data) };
      const plan = await linkPlan(copyTrainingPlan(parsed.data), linkExercise);
      await store.docs.put(Tables.trainingPlans, plan);
      return { status: 'imported', kind: envelope.kind, title: plan.name, id: plan.id, ignored: ignoredFields(data, parsed.data) };
    }
    case 'diet_plan': {
      const parsed = dietPlanSchema.safeParse(data);
      if (!parsed.success) return { status: 'invalid', problems: describeIssues(parsed.error.issues, data) };
      const plan = copyDietPlan(parsed.data);
      await store.docs.put(Tables.dietPlans, plan);
      return { status: 'imported', kind: envelope.kind, title: plan.name, id: plan.id, ignored: ignoredFields(data, parsed.data) };
    }
    case 'workout': {
      const parsed = workoutSchema.safeParse(data);
      if (!parsed.success) return { status: 'invalid', problems: describeIssues(parsed.error.issues, data) };
      const workout = await linkWorkout(copyWorkout(parsed.data), linkExercise);
      await store.docs.put(Tables.workouts, workout);
      return { status: 'imported', kind: envelope.kind, title: workout.title, id: workout.id, ignored: ignoredFields(data, parsed.data) };
    }
    case 'food_log_day': {
      const parsed = foodLogDaySchema.safeParse(data);
      if (!parsed.success) return { status: 'invalid', problems: describeIssues(parsed.error.issues, data) };
      const incoming = parsed.data;
      await store.transaction(async () => {
        const existing = (await store.docs.get(Tables.foodLogDays, incoming.date)) ?? emptyDay(incoming.date);
        await store.docs.put(Tables.foodLogDays, mergeFoodLogDay(existing, incoming));
      });
      return { status: 'imported', kind: envelope.kind, title: incoming.date, id: incoming.date, ignored: ignoredFields(data, parsed.data) };
    }
  }
};
