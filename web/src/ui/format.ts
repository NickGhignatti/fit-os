import type { Equipment, ExerciseCategory, ExerciseLevel, Muscle } from '../domain/catalog';
import type { Nutrients } from '../domain/nutrition';
import { addDays, weekdayOf, type LocalDate, type PlanDay } from '../domain/plan';
import type { ActivityLevel, GoalPace, Sex } from '../domain/profile';
import { oneRepMax, type PersonalRecord, type PrMetric } from '../domain/records';

/** Today in the device's timezone, "2026-10-17". */
export const today = (now: Date = new Date()): LocalDate => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

const trim = (n: number, digits = 1): string => String(Number(n.toFixed(digits)));

export const formatKcal = (n: number): string => `${Math.round(n)} kcal`;
export const formatGrams = (n: number): string => `${trim(n)} g`;
export const formatKg = (n: number): string => `${trim(n, 2)} kg`;
/** A weight without its unit, for when "kg" sits beside it: "62.5". */
export const formatWeight = (n: number): string => trim(n, 2);
export const formatMacros = (n: Nutrients): string =>
  `P ${Math.round(n.protein)} g · C ${Math.round(n.carbs)} g · F ${Math.round(n.fat)} g`;

/** A length of time held: "45 s", or "1m 30s" from a minute up. */
export const formatSeconds = (seconds: number): string => (seconds < 60 ? `${seconds} s` : formatRest(seconds));

/**
 * The work of one set, without its load: "10" reps, "45 s" for a hold (1 rep of 45 s),
 * "5 × 5 s" for timed reps. Sets saved before timed sets existed read as untimed.
 */
export const setWork = (s: { readonly reps: number; readonly seconds?: number | null }): string => {
  const seconds = s.seconds ?? null;
  if (seconds === null) return String(s.reps);
  return s.reps === 1 ? formatSeconds(seconds) : `${s.reps} × ${formatSeconds(seconds)}`;
};

/** "3 × 10", "3 × 10 × 60 kg", "3 × 45 s", "4 × (5 × 5 s)", or a list when the sets differ. */
export const setSummary = (sets: readonly { reps: number; weight: number | null; seconds?: number | null }[]): string => {
  const [first] = sets;
  if (!first) return 'no sets';
  const same = sets.every((s) => s.reps === first.reps && s.weight === first.weight && (s.seconds ?? null) === (first.seconds ?? null));
  const weight = (w: number | null) => (w === null ? '' : ` × ${trim(w, 2)} kg`);
  // Timed reps already hold a "×", so a count of them is bracketed to read unambiguously.
  const counted = (s: typeof first) => ((s.seconds ?? null) !== null && s.reps > 1 ? `(${setWork(s)})` : setWork(s));
  return same
    ? `${sets.length} × ${counted(first)}${weight(first.weight)}`
    : sets.map((s) => `${setWork(s)}${weight(s.weight)}`).join(' · ');
};

/** A rest time: "Off", "45s", "2m", "1m 30s". */
export const formatRest = (seconds: number): string => {
  if (seconds <= 0) return 'Off';
  const m = Math.floor(seconds / 60), s = seconds % 60;
  return m === 0 ? `${s}s` : s === 0 ? `${m}m` : `${m}m ${s}s`;
};

/** A countdown on a clock face: "1:05". */
export const clockTime = (ms: number): string => {
  const total = Math.ceil(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

/** Time gone by on a stopwatch: "4:07", or "1:02:09" past the hour. */
export const elapsedTime = (ms: number): string => {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60), s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
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

/** The meals a day is split into when no diet plans it. */
export const DEFAULT_MEALS = ['Breakfast', 'Lunch', 'Snack', 'Dinner'] as const;

/** Parses a decimal typed with a comma or a dot; null when it is not a number. */
export const parseNumber = (text: string): number | null => {
  const n = Number.parseFloat(text.trim().replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

/** 1325 seconds -> "22:05"; 3725 -> "1:02:05". */
export const formatDuration = (seconds: number): string => {
  const total = Math.round(seconds);
  const [h, m, sec] = [Math.floor(total / 3600), Math.floor((total % 3600) / 60), total % 60];
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
};

/** "22:05", "1:02:05" or plain seconds ("90") -> seconds; null when it is not a time. */
export const parseDuration = (text: string): number | null => {
  const parts = text.trim().split(':');
  if (parts.length > 3 || parts.some((p) => !/^\d+(\.\d+)?$/.test(p))) return null;
  const numbers = parts.map(Number);
  if (numbers.slice(1).some((n) => n >= 60)) return null;
  const seconds = numbers.reduce((total, n) => total * 60 + n, 0);
  return seconds > 0 ? seconds : null;
};

/** Metres -> "800 m" or "5.2 km". */
export const formatDistance = (metres: number): string =>
  metres >= 1000 ? `${trim(metres / 1000, 2)} km` : `${trim(metres, 0)} m`;

export const METRIC_LABEL: Record<PrMetric, string> = { weight: 'Weight', reps: 'Reps', time: 'Time', distance: 'Distance' };

/** "100 kg × 5", "25 reps", "21:45", "5.2 km". */
export const describeRecord = (r: PersonalRecord): string => {
  switch (r.metric) {
    case 'weight': return r.reps && r.reps > 1 ? `${formatKg(r.value)} × ${r.reps}` : formatKg(r.value);
    case 'reps': return `${r.value} ${r.value === 1 ? 'rep' : 'reps'}`;
    case 'time': return formatDuration(r.value);
    case 'distance': return formatDistance(r.value);
  }
};

/** For lifts of several reps, the one-rep max they imply; otherwise null. */
export const impliedOneRepMax = (r: PersonalRecord): string | null =>
  r.metric === 'weight' && r.reps && r.reps > 1 ? `≈ ${formatKg(oneRepMax(r.value, r.reps))} 1RM` : null;
