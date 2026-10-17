import { copyDietPlan, copyTrainingPlan, copyWorkout, mergeFoodLogDay } from '../domain/copy';
import { emptyDay } from '../domain/foodLog';
import { dietPlanSchema, foodLogDaySchema, trainingPlanSchema, workoutSchema } from '../domain/schemas';
import type { Envelope, TransferKind } from '../transfer/transfer';
import type { TrackerDb } from './db';

export type ImportResult =
  | { readonly status: 'imported'; readonly kind: TransferKind; readonly title: string }
  /** The item does not have the shape its kind promises; nothing was stored. */
  | { readonly status: 'invalid' };

/**
 * Stores a received item as a copy: validated, with fresh ids, and never active, so it cannot
 * overwrite or replace anything the user already has. A food-log day is added to that day.
 */
export const importEnvelope = async (db: TrackerDb, envelope: Envelope): Promise<ImportResult> => {
  switch (envelope.kind) {
    case 'training_plan': {
      const parsed = trainingPlanSchema.safeParse(envelope.data);
      if (!parsed.success) return { status: 'invalid' };
      const plan = copyTrainingPlan(parsed.data);
      await db.trainingPlans.put(plan);
      return { status: 'imported', kind: envelope.kind, title: plan.name };
    }
    case 'diet_plan': {
      const parsed = dietPlanSchema.safeParse(envelope.data);
      if (!parsed.success) return { status: 'invalid' };
      const plan = copyDietPlan(parsed.data);
      await db.dietPlans.put(plan);
      return { status: 'imported', kind: envelope.kind, title: plan.name };
    }
    case 'workout': {
      const parsed = workoutSchema.safeParse(envelope.data);
      if (!parsed.success) return { status: 'invalid' };
      const workout = copyWorkout(parsed.data);
      await db.workouts.put(workout);
      return { status: 'imported', kind: envelope.kind, title: workout.title };
    }
    case 'food_log_day': {
      const parsed = foodLogDaySchema.safeParse(envelope.data);
      if (!parsed.success) return { status: 'invalid' };
      const incoming = parsed.data;
      await db.transaction('rw', db.foodLogDays, async () => {
        const existing = (await db.foodLogDays.get(incoming.date)) ?? emptyDay(incoming.date);
        await db.foodLogDays.put(mergeFoodLogDay(existing, incoming));
      });
      return { status: 'imported', kind: envelope.kind, title: incoming.date };
    }
  }
};
