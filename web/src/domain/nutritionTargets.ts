import type { Nutrients } from './nutrition';
import { ACTIVITY_FACTOR, PACE_KG_PER_WEEK, type DailyTargets, type Profile, type Sex } from './profile';

/**
 * Daily calorie and macro targets from a profile and a body weight.
 *
 * Calories: resting burn by Mifflin–St Jeor, times the activity factor, plus the energy of the
 * chosen pace (about 7,700 kcal per kg), never below MIN_KCAL. Macros: protein by body weight,
 * fat as a share of calories, carbs for the rest.
 */
export const MIN_KCAL = 1_200;
const KCAL_PER_KG = 7_700;
const DAYS_PER_WEEK = 7;
const PROTEIN_G_PER_KG = 1.8;
const FAT_SHARE = 0.25;
const PROTEIN_SHARE_WITHOUT_WEIGHT = 0.25;
const KCAL_PER_G_PROTEIN = 4;
const KCAL_PER_G_CARBS = 4;
const KCAL_PER_G_FAT = 9;

/** Mifflin–St Jeor resting energy expenditure, in kcal per day. */
export const restingKcal = (sex: Sex, weightKg: number, heightCm: number, age: number): number =>
  10 * weightKg + 6.25 * heightCm - 5 * age + (sex === 'male' ? 5 : -161);

const computedKcal = (profile: Profile, weightKg: number | null, age: number | null): number | null => {
  if (profile.sex === null || profile.heightCm === null || weightKg === null || age === null) return null;
  const maintenance = restingKcal(profile.sex, weightKg, profile.heightCm, age) * ACTIVITY_FACTOR[profile.activity];
  return Math.max(MIN_KCAL, maintenance + (PACE_KG_PER_WEEK[profile.pace] * KCAL_PER_KG) / DAYS_PER_WEEK);
};

const split = (kcal: number, weightKg: number | null): Nutrients => {
  const proteinKcal = weightKg !== null ? weightKg * PROTEIN_G_PER_KG * KCAL_PER_G_PROTEIN : kcal * PROTEIN_SHARE_WITHOUT_WEIGHT;
  const fatKcal = kcal * FAT_SHARE;
  const carbsKcal = Math.max(0, kcal - proteinKcal - fatKcal);
  return {
    kcal,
    protein: proteinKcal / KCAL_PER_G_PROTEIN,
    carbs: carbsKcal / KCAL_PER_G_CARBS,
    fat: fatKcal / KCAL_PER_G_FAT,
  };
};

/** Energy of the macros the user set, when they set all three. */
const kcalOfMacros = (protein: number, carbs: number, fat: number): number =>
  protein * KCAL_PER_G_PROTEIN + carbs * KCAL_PER_G_CARBS + fat * KCAL_PER_G_FAT;

/**
 * The day's targets. Every custom number wins over its computed one:
 *  - calories: the custom value, else the one the three custom macros add up to, else computed;
 *  - protein and fat: the custom value, else computed;
 *  - carbs: the custom value, else whatever calories are left after protein and fat.
 * Null when nothing is custom and the data to compute calories is missing.
 */
export const targetsForProfile = (
  profile: Profile,
  weightKg: number | null,
  age: number | null,
): DailyTargets | null => {
  const { customKcal, customProtein, customCarbs, customFat } = profile;
  const allMacros = customProtein !== null && customCarbs !== null && customFat !== null;
  const kcal =
    customKcal ?? (allMacros ? kcalOfMacros(customProtein, customCarbs, customFat) : computedKcal(profile, weightKg, age));
  if (kcal === null) return null;

  const base = split(kcal, weightKg);
  const protein = customProtein ?? base.protein;
  const fat = customFat ?? base.fat;
  const carbs = customCarbs ?? Math.max(0, (kcal - protein * KCAL_PER_G_PROTEIN - fat * KCAL_PER_G_FAT) / KCAL_PER_G_CARBS);
  const isCustom = [customKcal, customProtein, customCarbs, customFat].some((v) => v !== null);
  return { nutrients: { kcal, protein, carbs, fat }, isCustom };
};
