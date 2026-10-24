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
  /** The session stopwatch: time counted in earlier runs, in ms. */
  readonly elapsedMs: number;
  /** When the stopwatch's current run began (epoch ms); null while it is stopped. */
  readonly runningSince: number | null;
}

/** A stopwatch that can stop and go on: what it counted so far, and when its current run began. */
export interface Stopwatch {
  readonly elapsedMs: number;
  readonly runningSince: number | null;
}

/** A workout's stopwatch. Workouts saved before it existed have none stored: they read as zero. */
export const stopwatchOf = (w: { readonly elapsedMs?: number; readonly runningSince?: number | null }): Stopwatch => ({
  elapsedMs: w.elapsedMs ?? 0,
  runningSince: w.runningSince ?? null,
});

export const elapsedOn = (s: Stopwatch, now: number): number =>
  s.elapsedMs + (s.runningSince === null ? 0 : Math.max(0, now - s.runningSince));

export const started = (s: Stopwatch, now: number): Stopwatch => (s.runningSince === null ? { ...s, runningSince: now } : s);
export const stopped = (s: Stopwatch, now: number): Stopwatch =>
  s.runningSince === null ? s : { elapsedMs: elapsedOn(s, now), runningSince: null };
export const ZERO: Stopwatch = { elapsedMs: 0, runningSince: null };

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
 * Keeps the stopwatch in step with the sets: ticking the first set starts it if nobody did, and
 * ticking the last one stops it. Anything else is left to the person holding it.
 */
export const withClock = (w: Workout, now: number): Workout => {
  const done = doneSetsOf(w);
  const total = totalSetsOf(w);
  const clock = stopwatchOf(w);
  const next = total > 0 && done === total ? stopped(clock, now)
    : done > 0 && clock.elapsedMs === 0 && clock.runningSince === null ? started(clock, now)
    : clock;
  return { ...w, ...next };
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
