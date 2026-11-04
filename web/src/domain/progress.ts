import type { LocalDate } from './plan';

/**
 * What a progress entry measures (in the order screens list them), and in which unit its value is:
 * - weight: kg lifted for some reps;
 * - reps: most in one go;
 * - time: seconds to cover something, where faster is better (a run);
 * - distance: metres;
 * - length: centimetres, for jumps (reach, vertical, broad jump);
 * - hold: seconds held, where longer is better (a plank, an isometric).
 */
export const METRICS = ['weight', 'reps', 'length', 'hold', 'time', 'distance'] as const;
export type Metric = (typeof METRICS)[number];

/** One measurement of an exercise, on a day. The best of an exercise's entries is its best. */
export interface ProgressEntry {
  readonly id: string;
  /** Groups entries of the same exercise: the catalogue id, else the normalised name. */
  readonly exerciseKey: string;
  readonly exerciseName: string;
  readonly catalogId: string | null;
  readonly metric: Metric;
  /** In the metric's unit: kg, a count, seconds, metres or centimetres. */
  readonly value: number;
  /** For weight: the reps done at that load (1 = a one-rep max). Null for the other metrics. */
  readonly reps: number | null;
  readonly date: LocalDate;
  readonly note: string;
}

const normalize = (name: string): string =>
  name.normalize('NFD').replace(/\p{Mn}+/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

/** The same exercise gets the same key whether it was picked from the catalogue or typed. */
export const exerciseKey = (name: string, catalogId: string | null): string =>
  catalogId ?? `name:${normalize(name)}`;

/** Epley estimate of the heaviest single rep for [kg] done [reps] times. */
export const oneRepMax = (kg: number, reps: number): number => (reps <= 1 ? kg : kg * (1 + reps / 30));

/** What decides "better" for lifts: the estimated one-rep max. */
const strength = (e: ProgressEntry): number => oneRepMax(e.value, e.reps ?? 1);

/** Whether [a] beats [other]; both must measure the same thing. */
export const isBetter = (a: ProgressEntry, other: ProgressEntry): boolean => {
  switch (a.metric) {
    case 'weight': return strength(a) > strength(other);
    case 'time': return a.value < other.value; // faster is better
    default: return a.value > other.value; // more reps, metres, centimetres or seconds held
  }
};

/** The best entry of one metric; the earlier one wins a tie, so a best dates from when it was first reached. */
export const bestOf = (entries: readonly ProgressEntry[], metric: Metric): ProgressEntry | undefined =>
  entries
    .filter((e) => e.metric === metric)
    .reduce<ProgressEntry | undefined>(
      (best, e) => (best === undefined || isBetter(e, best) || (!isBetter(best, e) && e.date < best.date) ? e : best),
      undefined,
    );

/** Newest first. */
export const newestFirst = (entries: readonly ProgressEntry[]): ProgressEntry[] =>
  [...entries].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));

/** Oldest first, for charts. */
export const oldestFirst = (entries: readonly ProgressEntry[]): ProgressEntry[] => newestFirst(entries).reverse();

/** True when [candidate] beats a best that already exists: a first-ever entry is not "beating" anything. */
export const beatsBest = (candidate: ProgressEntry, existing: readonly ProgressEntry[]): boolean => {
  const best = bestOf(existing, candidate.metric);
  return best !== undefined && isBetter(candidate, best);
};

/** One exercise's entries, grouped for the list screen. */
export interface ExerciseProgress {
  readonly exerciseKey: string;
  readonly exerciseName: string;
  readonly catalogId: string | null;
  readonly entries: readonly ProgressEntry[];
  /** The best of each metric that has any entry. */
  readonly bests: readonly ProgressEntry[];
  readonly lastDate: LocalDate;
}

/** Groups entries by exercise, most recently active exercise first. */
export const groupByExercise = (entries: readonly ProgressEntry[]): ExerciseProgress[] => {
  const groups = new Map<string, ProgressEntry[]>();
  for (const e of entries) groups.set(e.exerciseKey, [...(groups.get(e.exerciseKey) ?? []), e]);
  return [...groups.values()]
    .map((list) => {
      const latest = newestFirst(list)[0]!;
      return {
        exerciseKey: latest.exerciseKey,
        exerciseName: latest.exerciseName,
        catalogId: latest.catalogId,
        entries: newestFirst(list),
        bests: METRICS.flatMap((m) => bestOf(list, m) ?? []),
        lastDate: latest.date,
      };
    })
    .sort((a, b) => b.lastDate.localeCompare(a.lastDate) || a.exerciseName.localeCompare(b.exerciseName));
};
