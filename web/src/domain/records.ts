import type { LocalDate } from './plan';

/** What a record measures. Weight: kg lifted for some reps. Reps: most in one go. Time: seconds. Distance: metres. */
export type PrMetric = 'weight' | 'reps' | 'time' | 'distance';

export const METRICS: readonly PrMetric[] = ['weight', 'reps', 'time', 'distance'];

/** A personal record: one measurement of an exercise, on a day. The best of them is "the PR". */
export interface PersonalRecord {
  readonly id: string;
  /** Groups records of the same exercise: the catalogue id, else the normalised name. */
  readonly exerciseKey: string;
  readonly exerciseName: string;
  readonly catalogId: string | null;
  readonly metric: PrMetric;
  /** kg for weight, a count for reps, seconds for time, metres for distance. */
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
const strength = (r: PersonalRecord): number => oneRepMax(r.value, r.reps ?? 1);

/** Whether [a] beats [other]; both must measure the same thing. */
export const isBetter = (a: PersonalRecord, other: PersonalRecord): boolean => {
  switch (a.metric) {
    case 'weight': return strength(a) > strength(other);
    case 'time': return a.value < other.value; // faster is better
    default: return a.value > other.value;
  }
};

/** The best record of one metric; the earlier one wins a tie, so a PR is when it was first set. */
export const bestOf = (records: readonly PersonalRecord[], metric: PrMetric): PersonalRecord | undefined =>
  records
    .filter((r) => r.metric === metric)
    .reduce<PersonalRecord | undefined>(
      (best, r) => (best === undefined || isBetter(r, best) || (!isBetter(best, r) && r.date < best.date) ? r : best),
      undefined,
    );

/** Newest first. */
export const newestFirst = (records: readonly PersonalRecord[]): PersonalRecord[] =>
  [...records].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));

/** Oldest first, for charts. */
export const oldestFirst = (records: readonly PersonalRecord[]): PersonalRecord[] => newestFirst(records).reverse();

/** True when [candidate] beats a record that already exists: a first-ever record is not "beating" anything. */
export const beatsBest = (candidate: PersonalRecord, existing: readonly PersonalRecord[]): boolean => {
  const best = bestOf(existing, candidate.metric);
  return best !== undefined && isBetter(candidate, best);
};

/** One exercise's records, grouped for the list screen. */
export interface ExerciseRecords {
  readonly exerciseKey: string;
  readonly exerciseName: string;
  readonly catalogId: string | null;
  readonly records: readonly PersonalRecord[];
  /** The best of each metric that has any record. */
  readonly bests: readonly PersonalRecord[];
  readonly lastDate: LocalDate;
}

/** Groups records by exercise, most recently active exercise first. */
export const groupByExercise = (records: readonly PersonalRecord[]): ExerciseRecords[] => {
  const groups = new Map<string, PersonalRecord[]>();
  for (const r of records) groups.set(r.exerciseKey, [...(groups.get(r.exerciseKey) ?? []), r]);
  return [...groups.values()]
    .map((list) => {
      const latest = newestFirst(list)[0]!;
      return {
        exerciseKey: latest.exerciseKey,
        exerciseName: latest.exerciseName,
        catalogId: latest.catalogId,
        records: newestFirst(list),
        bests: METRICS.flatMap((m) => bestOf(list, m) ?? []),
        lastDate: latest.date,
      };
    })
    .sort((a, b) => b.lastDate.localeCompare(a.lastDate) || a.exerciseName.localeCompare(b.exerciseName));
};
