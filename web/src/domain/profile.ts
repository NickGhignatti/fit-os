import type { LocalDate } from './plan';
import type { Nutrients } from './nutrition';

export type Sex = 'male' | 'female';

/** Multipliers of the resting burn for daily activity, training included (the usual Harris–Benedict factors). */
export const ACTIVITY_FACTOR = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
} as const;
export type ActivityLevel = keyof typeof ACTIVITY_FACTOR;

/** How fast to change weight, in kg per week; negative loses. */
export const PACE_KG_PER_WEEK = {
  lose_fast: -0.75,
  lose: -0.5,
  lose_slow: -0.25,
  maintain: 0,
  gain_slow: 0.25,
  gain: 0.5,
} as const;
export type GoalPace = keyof typeof PACE_KG_PER_WEEK;

/** What the app knows about the user, to work out a daily goal. Everything is optional until set. */
export interface Profile {
  readonly sex: Sex | null;
  readonly birthDate: LocalDate | null;
  readonly heightCm: number | null;
  readonly activity: ActivityLevel;
  readonly pace: GoalPace;
  /** A calorie target the user chose themselves; replaces the computed one when set. */
  readonly customKcal: number | null;
  /** Macro targets in grams the user chose themselves; each replaces its computed value when set. */
  readonly customProtein: number | null;
  readonly customCarbs: number | null;
  readonly customFat: number | null;
  /** The meals of a day, in order, when no diet plan sets them; null for the usual four. */
  readonly mealNames: readonly string[] | null;
}

/** How many meals a day the user may choose between. */
export const MAX_MEALS = 8;

export const defaultProfile: Profile = {
  sex: null,
  birthDate: null,
  heightCm: null,
  activity: 'moderate',
  pace: 'maintain',
  customKcal: null,
  customProtein: null,
  customCarbs: null,
  customFat: null,
  mealNames: null,
};

/** Whole years between [birthDate] and [date], like java.time.Period.between(..).years. */
export const ageOn = (profile: Profile, date: LocalDate): number | null => {
  if (!profile.birthDate) return null;
  const [by, bm, bd] = profile.birthDate.split('-').map(Number) as [number, number, number];
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return y - by - (m < bm || (m === bm && d < bd) ? 1 : 0);
};

/** One weigh-in; there is at most one per day. */
/** What a body-composition scale reports besides weight. */
export type BodyMeasure = 'fatPct' | 'leanKg' | 'muscleKg' | 'proteinPct' | 'waterPct' | 'boneKg' | 'visceralFat';

export interface BodyMeasureInfo {
  readonly key: BodyMeasure;
  readonly label: string;
  /** Shown beside the value; empty for a plain rating. */
  readonly unit: '%' | 'kg' | '';
  readonly min: number;
  readonly max: number;
}

/** Every measure that can go with a weigh-in, in the order a scale usually lists them. */
export const BODY_MEASURES: readonly BodyMeasureInfo[] = [
  { key: 'fatPct', label: 'Body fat', unit: '%', min: 1, max: 75 },
  { key: 'leanKg', label: 'Lean mass', unit: 'kg', min: 10, max: 300 },
  { key: 'muscleKg', label: 'Muscle mass', unit: 'kg', min: 5, max: 250 },
  { key: 'proteinPct', label: 'Protein', unit: '%', min: 1, max: 50 },
  { key: 'waterPct', label: 'Body water', unit: '%', min: 10, max: 90 },
  { key: 'boneKg', label: 'Bone mass', unit: 'kg', min: 0.5, max: 15 },
  { key: 'visceralFat', label: 'Visceral fat', unit: '', min: 1, max: 60 },
];

export type BodyComposition = { readonly [K in BodyMeasure]?: number };

export interface WeightEntry {
  readonly id: string;
  readonly date: LocalDate;
  readonly kg: number;
  /** The other numbers measured with it, if any. Weigh-ins from before these existed have none. */
  readonly body?: BodyComposition;
}

/** What to eat in a day. */
export interface DailyTargets {
  readonly nutrients: Nutrients;
  /** True when any of the numbers is the user's own rather than computed. */
  readonly isCustom: boolean;
}
