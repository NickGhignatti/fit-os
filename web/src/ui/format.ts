import type { Equipment, ExerciseCategory, ExerciseLevel, Muscle } from '../domain/catalog';
import type { Nutrients } from '../domain/nutrition';
import { addDays, weekdayOf, type LocalDate, type PlanDay } from '../domain/plan';
import type { ActivityLevel, GoalPace, Sex } from '../domain/profile';

/** Today in the device's timezone, "2026-10-17". */
export const today = (now: Date = new Date()): LocalDate => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

const trim = (n: number, digits = 1): string => String(Number(n.toFixed(digits)));

export const formatKcal = (n: number): string => `${Math.round(n)} kcal`;
export const formatGrams = (n: number): string => `${trim(n)} g`;
export const formatKg = (n: number): string => `${trim(n, 2)} kg`;
export const formatMacros = (n: Nutrients): string =>
  `P ${Math.round(n.protein)} g · C ${Math.round(n.carbs)} g · F ${Math.round(n.fat)} g`;

/** "3 × 10", "3 × 10 × 60 kg", or a list when the sets differ. */
export const setSummary = (sets: readonly { reps: number; weight: number | null }[]): string => {
  const [first] = sets;
  if (!first) return 'no sets';
  const same = sets.every((s) => s.reps === first.reps && s.weight === first.weight);
  const weight = (w: number | null) => (w === null ? '' : ` × ${trim(w, 2)} kg`);
  return same
    ? `${sets.length} × ${first.reps}${weight(first.weight)}`
    : sets.map((s) => `${s.reps}${weight(s.weight)}`).join(' · ');
};

export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;

export const dayName = (day: PlanDay): string => (day === 0 ? 'Every day' : WEEKDAYS[day - 1]!);
export const shortDayName = (day: PlanDay): string => (day === 0 ? 'Daily' : WEEKDAYS[day - 1]!.slice(0, 3));

/** "Saturday 17 October". */
export const dateTitle = (date: LocalDate): string => {
  const d = new Date(`${date}T12:00:00`);
  return `${WEEKDAYS[weekdayOf(date) - 1]} ${d.getDate()} ${d.toLocaleString('en', { month: 'long' })}`;
};

export const relativeDay = (date: LocalDate, now: LocalDate = today()): string =>
  date === now ? 'Today' : date === addDays(now, -1) ? 'Yesterday' : date === addDays(now, 1) ? 'Tomorrow' : dateTitle(date);

export const MUSCLE_LABEL: Record<Muscle, string> = {
  abdominals: 'Abs', abductors: 'Abductors', adductors: 'Adductors', biceps: 'Biceps', calves: 'Calves',
  chest: 'Chest', forearms: 'Forearms', glutes: 'Glutes', hamstrings: 'Hamstrings', lats: 'Lats',
  lower_back: 'Lower back', middle_back: 'Middle back', neck: 'Neck', quadriceps: 'Quads',
  shoulders: 'Shoulders', traps: 'Traps', triceps: 'Triceps',
};

export const EQUIPMENT_LABEL: Record<Equipment, string> = {
  body_only: 'Bodyweight', barbell: 'Barbell', dumbbell: 'Dumbbell', kettlebells: 'Kettlebell', cable: 'Cable',
  machine: 'Machine', bands: 'Bands', e_z_curl_bar: 'EZ bar', medicine_ball: 'Medicine ball',
  exercise_ball: 'Exercise ball', foam_roll: 'Foam roller', other: 'Other',
};

export const LEVEL_LABEL: Record<ExerciseLevel, string> = { beginner: 'Beginner', intermediate: 'Intermediate', expert: 'Expert' };

export const CATEGORY_LABEL: Record<ExerciseCategory, string> = {
  strength: 'Strength', stretching: 'Stretching', plyometrics: 'Plyometrics', powerlifting: 'Powerlifting',
  olympic_weightlifting: 'Olympic weightlifting', strongman: 'Strongman', cardio: 'Cardio',
};

export const SEX_LABEL: Record<Sex, string> = { male: 'Male', female: 'Female' };

export const ACTIVITY_LABEL: Record<ActivityLevel, { title: string; description: string }> = {
  sedentary: { title: 'Sedentary', description: 'Desk job, little or no exercise' },
  light: { title: 'Lightly active', description: 'Exercise 1–3 days a week' },
  moderate: { title: 'Moderately active', description: 'Exercise 3–5 days a week' },
  active: { title: 'Very active', description: 'Hard exercise 6–7 days a week' },
  very_active: { title: 'Extremely active', description: 'Physical job plus hard training' },
};

export const PACE_LABEL: Record<GoalPace, string> = {
  lose_fast: 'Lose 0.75 kg a week', lose: 'Lose 0.5 kg a week', lose_slow: 'Lose 0.25 kg a week',
  maintain: 'Keep my weight', gain_slow: 'Gain 0.25 kg a week', gain: 'Gain 0.5 kg a week',
};

/** The meals a day is split into when no diet plans it, as in the Android app. */
export const DEFAULT_MEALS = ['Breakfast', 'Lunch', 'Snack', 'Dinner'] as const;

/** Parses a decimal typed with a comma or a dot; null when it is not a number. */
export const parseNumber = (text: string): number | null => {
  const n = Number.parseFloat(text.trim().replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};
