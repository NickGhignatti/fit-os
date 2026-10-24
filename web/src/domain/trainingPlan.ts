import { addDays, daysOf, planDayOn, type LocalDate, type PlanDay, type Recurrence } from './plan';
import type { ExercisePlan, SetPlan, Workout } from './workout';

/** An exercise stored in a plan; unlike [ExercisePlan] it has ids, so it can be edited in place. */
export interface PlannedSet {
  readonly id: string;
  readonly reps: number;
  /** Kilograms; null means bodyweight / not applicable. */
  readonly weight: number | null;
}

export interface PlannedExercise {
  readonly id: string;
  readonly name: string;
  readonly notes: string;
  readonly sets: readonly PlannedSet[];
  /** The catalogue exercise this one is, if picked from it. */
  readonly catalogId: string | null;
  /** Seconds to rest after each set; see [Exercise.restSeconds]. */
  readonly restSeconds: number | null;
}

/** A workout routine: one session repeated every day, or a session per weekday. */
export interface TrainingPlan {
  readonly id: string;
  readonly name: string;
  readonly recurrence: Recurrence;
  readonly isActive: boolean;
  /** Exercises per plan day; a day without any is a rest day. Keys are PlanDay values. */
  readonly sessions: Readonly<Record<number, readonly PlannedExercise[]>>;
}

const DAYS_AHEAD = 6;

export const sessionOnDay = (plan: TrainingPlan, day: PlanDay): readonly PlannedExercise[] =>
  plan.sessions[day] ?? [];

export const sessionOn = (plan: TrainingPlan, date: LocalDate): readonly PlannedExercise[] =>
  sessionOnDay(plan, planDayOn(plan.recurrence, date));

/** The first session from [date] on, [date] included, looking a week ahead; empty if the plan has none. */
export const nextSessionFrom = (plan: TrainingPlan, date: LocalDate): readonly PlannedExercise[] => {
  for (let i = 0; i <= DAYS_AHEAD; i++) {
    const session = sessionOn(plan, addDays(date, i));
    if (session.length > 0) return session;
  }
  return [];
};

/** The days with something to do, in week order. */
export const trainingDays = (plan: TrainingPlan): PlanDay[] =>
  daysOf(plan.recurrence).filter((d) => sessionOnDay(plan, d).length > 0);

const setToPlan = (s: PlannedSet): SetPlan => ({ reps: s.reps, weight: s.weight });

export const plannedToPlan = (e: PlannedExercise): ExercisePlan => ({
  name: e.name,
  notes: e.notes,
  sets: e.sets.map(setToPlan),
  catalogId: e.catalogId,
  restSeconds: e.restSeconds ?? null,
});

/** A session the active plan asks for, not yet turned into a workout that can be logged. */
export interface PendingSession {
  readonly planId: string;
  readonly title: string;
  readonly exercises: readonly ExercisePlan[];
}

/** The plan's session for [date], unless it is a rest day or a workout was already started from it. */
export const pendingSessionOn = (
  plan: TrainingPlan,
  date: LocalDate,
  dayWorkouts: readonly Workout[],
): PendingSession | null => {
  const session = sessionOn(plan, date);
  if (session.length === 0 || dayWorkouts.some((w) => w.planId === plan.id)) return null;
  return { planId: plan.id, title: plan.name, exercises: session.map(plannedToPlan) };
};
