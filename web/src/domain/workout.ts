import type { LocalDate } from './plan';

/** One set: what was planned and, once done, what was actually performed. */
export interface ExerciseSet {
  readonly id: string;
  readonly plannedReps: number;
  /** Kilograms; null means bodyweight / not applicable. */
  readonly plannedWeight: number | null;
  readonly actualReps: number | null;
  readonly actualWeight: number | null;
  readonly done: boolean;
}

export interface Exercise {
  readonly id: string;
  readonly name: string;
  readonly notes: string;
  readonly sets: readonly ExerciseSet[];
  /** The catalogue exercise this one is, if picked from it. */
  readonly catalogId: string | null;
  /** Seconds to rest after each set; 0 means no timer, null the usual [DEFAULT_REST]. */
  readonly restSeconds: number | null;
}

/** The rest between sets when an exercise doesn't say: a minute and a half. */
export const DEFAULT_REST = 90;

/**
 * How long to rest after a set of [e]. Exercises saved before rest times existed have none
 * stored at all, so a missing value counts as unset too.
 */
export const restOf = (e: { readonly restSeconds?: number | null }): number => e.restSeconds ?? DEFAULT_REST;

/** A training session planned (and possibly logged) on a given day. */
export interface Workout {
  readonly id: string;
  readonly date: LocalDate;
  readonly title: string;
  readonly exercises: readonly Exercise[];
  /** The training plan this workout was started from, if any. */
  readonly planId: string | null;
  /** When the session began (epoch ms): Start was pressed, or the first set was ticked. */
  readonly startedAt: number | null;
  /** When its last set was ticked; null while any set is still to do. */
  readonly finishedAt: number | null;
}

/** True when the set was completed with different numbers than planned. */
export const deviatesFromPlan = (s: ExerciseSet): boolean =>
  s.done && ((s.actualReps ?? s.plannedReps) !== s.plannedReps || s.actualWeight !== s.plannedWeight);

/**
 * A completed set always has actual values: any left blank default to the plan, so the common
 * case ("did exactly what was planned") needs no typing.
 */
export const markedDone = (s: ExerciseSet): ExerciseSet => ({
  ...s,
  done: true,
  actualReps: s.actualReps ?? s.plannedReps,
  actualWeight: s.actualWeight ?? s.plannedWeight,
});

/** Un-marking keeps any logged values, so re-marking restores them. */
export const toggledDone = (s: ExerciseSet): ExerciseSet => (s.done ? { ...s, done: false } : markedDone(s));

/**
 * Keeps the session clock in step with the sets: the first ticked set starts it (unless Start
 * already did), ticking the last one stops it, and un-ticking one sets it running again.
 * Workouts saved before the clock existed have neither time stored.
 */
export const withClock = (w: Workout, now: number): Workout => {
  const done = doneSetsOf(w);
  const total = totalSetsOf(w);
  return {
    ...w,
    startedAt: w.startedAt ?? (done > 0 ? now : null),
    finishedAt: total > 0 && done === total ? (w.finishedAt ?? now) : null,
  };
};

export const doneSets = (e: Exercise): number => e.sets.filter((s) => s.done).length;
export const totalSetsOf = (w: Workout): number => w.exercises.reduce((n, e) => n + e.sets.length, 0);
export const doneSetsOf = (w: Workout): number => w.exercises.reduce((n, e) => n + doneSets(e), 0);

/** Completion totals for one calendar day. */
export interface DaySummary {
  readonly date: LocalDate;
  readonly totalSets: number;
  readonly doneSets: number;
}

export const isCompleted = (d: DaySummary): boolean => d.totalSets > 0 && d.doneSets === d.totalSets;

export const summarize = (date: LocalDate, workouts: readonly Workout[]): DaySummary => ({
  date,
  totalSets: workouts.reduce((n, w) => n + totalSetsOf(w), 0),
  doneSets: workouts.reduce((n, w) => n + doneSetsOf(w), 0),
});

/** A storage-independent description of an exercise to perform, without logged results. */
export interface SetPlan {
  readonly reps: number;
  readonly weight: number | null;
}

export interface ExercisePlan {
  readonly name: string;
  readonly notes: string;
  readonly sets: readonly SetPlan[];
  readonly catalogId: string | null;
  readonly restSeconds?: number | null;
}

export const setPlan = (reps: number, weight: number | null): SetPlan => {
  if (!(reps > 0)) throw new Error(`reps must be positive, was ${reps}`);
  if (weight !== null && weight < 0) throw new Error(`weight must not be negative, was ${weight}`);
  return { reps, weight };
};

const DEFAULT_REPS = 10;

/** The usual "one more set": a repeat of [last], or a default when there is none yet. */
export const setFollowing = (last: SetPlan | null): SetPlan => last ?? setPlan(DEFAULT_REPS, null);

export const exerciseToPlan = (e: Exercise): ExercisePlan => ({
  name: e.name,
  notes: e.notes,
  sets: e.sets.map((s) => ({ reps: s.plannedReps, weight: s.plannedWeight })),
  catalogId: e.catalogId,
  restSeconds: e.restSeconds ?? null,
});

/** What a workout asks for, without any logged results. */
export const workoutToPlan = (w: Workout): ExercisePlan[] => w.exercises.map(exerciseToPlan);
