/** Minutes after midnight. */
export type ClockMinutes = number;

/** The usual clock time of common meal names, in English and Italian. */
const USUAL: Readonly<Record<string, ClockMinutes>> = {
  breakfast: 8 * 60, colazione: 8 * 60,
  'morning snack': 10 * 60 + 30, spuntino: 10 * 60 + 30,
  lunch: 13 * 60, pranzo: 13 * 60,
  snack: 16 * 60 + 30, 'afternoon snack': 16 * 60 + 30, merenda: 16 * 60 + 30,
  dinner: 20 * 60, cena: 20 * 60,
  'evening snack': 22 * 60,
};

/** "08:00" or "8.30" as minutes after midnight; null for anything else. */
export const parseClock = (time: string): ClockMinutes | null => {
  const m = /^(\d{1,2})[:.](\d{2})$/.exec(time.trim());
  if (!m) return null;
  const [h, min] = [Number(m[1]), Number(m[2])];
  return h < 24 && min < 60 ? h * 60 + min : null;
};

/**
 * A clock time for each meal: the time its plan gives, else the usual time for its name, else
 * one spread evenly from 08:00 to 20:00 by its position in the day.
 */
export const mealTimes = (meals: readonly { name: string; time?: string | null }[]): ClockMinutes[] =>
  meals.map((meal, i) =>
    (meal.time ? parseClock(meal.time) : null)
      ?? USUAL[meal.name.trim().toLowerCase()]
      ?? (meals.length === 1 ? 13 * 60 : 8 * 60 + Math.round((12 * 60 * i) / (meals.length - 1))));

/** The position of the meal closest in time to [now]; the earlier one on a tie. 0 when there are none. */
export const mealAt = (meals: readonly { name: string; time?: string | null }[], now: ClockMinutes): number => {
  const times = mealTimes(meals);
  return times.reduce((best, t, i) => (Math.abs(t - now) < Math.abs(times[best]! - now) ? i : best), 0);
};

/** The current local time as minutes after midnight. */
export const clockNow = (date: Date = new Date()): ClockMinutes => date.getHours() * 60 + date.getMinutes();
