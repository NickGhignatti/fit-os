import type { LocalDate } from './plan';

/** One set: what was planned and, once done, what was actually performed. */
export interface ExerciseSet {
  readonly id: string;
  readonly plannedReps: number;
  /** Kilograms; null means bodyweight / not applicable. */
  readonly plannedWeight: number | null;
  readonly actualReps: number | null;
  readonly actualWeight: number | null;
  /**
   * For a timed set, how long each rep lasts, in seconds: a 45 s hold is 1 rep of 45 s, five 5 s
   * pushes are 5 reps of 5 s. Null for an ordinary set. Sets saved before timed sets existed have
   * none stored, hence optional: read them through [plannedSecondsOf] and [actualSecondsOf].
   */
  readonly plannedSeconds?: number | null;
  readonly actualSeconds?: number | null;
  readonly done: boolean;
  /** A word on how the set went; empty when there is none. */
  readonly note: string;
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
  /** Seconds to rest once the exercise is done, before the next; null the usual [DEFAULT_REST_AFTER]. */
  readonly restAfterSeconds: number | null;
}

/** The rest between sets when an exercise doesn't say: a minute and a half. */
export const DEFAULT_REST = 90;

/**
 * How long to rest after a set of [e]. Exercises saved before rest times existed have none
 * stored at all, so a missing value counts as unset too.
 */
export const restOf = (e: { readonly restSeconds?: number | null }): number => e.restSeconds ?? DEFAULT_REST;

/** The rest between two exercises when the first doesn't say: two minutes. */
export const DEFAULT_REST_AFTER = 120;

/** How long to rest after finishing [e], before the next exercise; missing counts as unset, as in [restOf]. */
export const restAfterOf = (e: { readonly restAfterSeconds?: number | null }): number => e.restAfterSeconds ?? DEFAULT_REST_AFTER;

/** True once every set of [e] is done; an exercise without sets is never done. */
export const isExerciseDone = (e: Exercise): boolean => e.sets.length > 0 && e.sets.every((s) => s.done);

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

/** Seconds each planned rep lasts; null for an untimed set, or one saved before timed sets existed. */
export const plannedSecondsOf = (s: { readonly plannedSeconds?: number | null }): number | null => s.plannedSeconds ?? null;

/** Seconds each rep actually lasted; null when not logged, or saved before timed sets existed. */
export const actualSecondsOf = (s: { readonly actualSeconds?: number | null }): number | null => s.actualSeconds ?? null;

/** True when the set was completed with different numbers than planned. */
export const deviatesFromPlan = (s: ExerciseSet): boolean =>
  s.done && (
    (s.actualReps ?? s.plannedReps) !== s.plannedReps
    || s.actualWeight !== s.plannedWeight
    || (actualSecondsOf(s) ?? plannedSecondsOf(s)) !== plannedSecondsOf(s)
  );

/**
 * A completed set always has actual values: any left blank default to the plan, so the common
 * case ("did exactly what was planned") needs no typing.
 */
export const markedDone = (s: ExerciseSet): ExerciseSet => ({
  ...s,
  done: true,
  actualReps: s.actualReps ?? s.plannedReps,
  actualWeight: s.actualWeight ?? s.plannedWeight,
  actualSeconds: actualSecondsOf(s) ?? plannedSecondsOf(s),
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
  /**
   * Seconds each rep lasts for a timed set (a hold, a timed push); null or absent for an ordinary
   * set. Optional because sets saved before timed sets existed have none: read it through [secondsOf].
   */
  readonly seconds?: number | null;
}

/** Seconds of a planned set; sets saved before timed sets existed have none stored. */
export const secondsOf = (s: { readonly seconds?: number | null }): number | null => s.seconds ?? null;

export interface ExercisePlan {
  readonly name: string;
  readonly notes: string;
  readonly sets: readonly SetPlan[];
  readonly catalogId: string | null;
  readonly restSeconds?: number | null;
  readonly restAfterSeconds?: number | null;
}

export const setPlan = (reps: number, weight: number | null, seconds: number | null = null): SetPlan => {
  if (!(reps > 0)) throw new Error(`reps must be positive, was ${reps}`);
  if (weight !== null && weight < 0) throw new Error(`weight must not be negative, was ${weight}`);
  if (seconds !== null && !(seconds > 0)) throw new Error(`seconds must be positive, was ${seconds}`);
  return { reps, weight, seconds };
};

const DEFAULT_REPS = 10;

/** The usual "one more set": a repeat of [last], or a default when there is none yet. */
export const setFollowing = (last: SetPlan | null): SetPlan => last ?? setPlan(DEFAULT_REPS, null);

export const exerciseToPlan = (e: Exercise): ExercisePlan => ({
  name: e.name,
  notes: e.notes,
  sets: e.sets.map((s) => ({ reps: s.plannedReps, weight: s.plannedWeight, seconds: plannedSecondsOf(s) })),
  catalogId: e.catalogId,
  restSeconds: e.restSeconds ?? null,
  restAfterSeconds: e.restAfterSeconds ?? null,
});

/** What a workout asks for, without any logged results. */
export const workoutToPlan = (w: Workout): ExercisePlan[] => w.exercises.map(exerciseToPlan);
