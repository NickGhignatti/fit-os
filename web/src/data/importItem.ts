import { copyDietPlan, copyTrainingPlan, copyWorkout, mergeFoodLogDay } from '../domain/copy';
import { emptyDay } from '../domain/foodLog';
import { dietPlanSchema, foodLogDaySchema, trainingPlanSchema, workoutSchema } from '../domain/schemas';
import type { Envelope, TransferKind } from '../transfer/transfer';
import { Tables } from './schema';
import type { Store } from './store';

export type ImportResult =
  | { readonly status: 'imported'; readonly kind: TransferKind; readonly title: string }
  /** The item does not have the shape its kind promises; nothing was stored. */
  | { readonly status: 'invalid' };

/**
 * Stores a received item as a copy: validated, with fresh ids, and never active, so it cannot
 * overwrite or replace anything the user already has. A food-log day is added to that day.
 */
export const importEnvelope = async (store: Store, envelope: Envelope): Promise<ImportResult> => {
  switch (envelope.kind) {
    case 'training_plan': {
      const parsed = trainingPlanSchema.safeParse(envelope.data);
      if (!parsed.success) return { status: 'invalid' };
      const plan = copyTrainingPlan(parsed.data);
      await store.docs.put(Tables.trainingPlans, plan);
      return { status: 'imported', kind: envelope.kind, title: plan.name };
    }
    case 'diet_plan': {
      const parsed = dietPlanSchema.safeParse(envelope.data);
      if (!parsed.success) return { status: 'invalid' };
      const plan = copyDietPlan(parsed.data);
      await store.docs.put(Tables.dietPlans, plan);
      return { status: 'imported', kind: envelope.kind, title: plan.name };
    }
    case 'workout': {
      const parsed = workoutSchema.safeParse(envelope.data);
      if (!parsed.success) return { status: 'invalid' };
      const workout = copyWorkout(parsed.data);
      await store.docs.put(Tables.workouts, workout);
      return { status: 'imported', kind: envelope.kind, title: workout.title };
    }
    case 'food_log_day': {
      const parsed = foodLogDaySchema.safeParse(envelope.data);
      if (!parsed.success) return { status: 'invalid' };
      const incoming = parsed.data;
      await store.transaction(async () => {
        const existing = (await store.docs.get(Tables.foodLogDays, incoming.date)) ?? emptyDay(incoming.date);
        await store.docs.put(Tables.foodLogDays, mergeFoodLogDay(existing, incoming));
      });
      return { status: 'imported', kind: envelope.kind, title: incoming.date };
    }
  }
};
