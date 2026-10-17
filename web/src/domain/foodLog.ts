import { portionNutrients, sum, type Nutrients, type Portion } from './nutrition';
import type { LocalDate } from './plan';

/** Something eaten: a portion of food, logged under a meal of a day. */
export interface FoodLogEntry {
  readonly id: string;
  readonly meal: string;
  readonly portion: Portion;
}

/** Everything eaten on one day, in the order it was logged. A day is stored as one document. */
export interface FoodLogDay {
  readonly date: LocalDate;
  readonly entries: readonly FoodLogEntry[];
}

export const emptyDay = (date: LocalDate): FoodLogDay => ({ date, entries: [] });

export const eaten = (entries: readonly FoodLogEntry[]): Nutrients => sum(entries.map((e) => portionNutrients(e.portion)));

/** The entries logged under [meal], in order. */
export const entriesOfMeal = (day: FoodLogDay, meal: string): FoodLogEntry[] => day.entries.filter((e) => e.meal === meal);

export const withEntry = (day: FoodLogDay, entry: FoodLogEntry): FoodLogDay => ({ ...day, entries: [...day.entries, entry] });

export const withoutEntry = (day: FoodLogDay, id: string): FoodLogDay => ({
  ...day,
  entries: day.entries.filter((e) => e.id !== id),
});

export const withGrams = (day: FoodLogDay, id: string, grams: number): FoodLogDay => {
  if (!(grams > 0)) throw new Error(`grams must be positive, was ${grams}`);
  return {
    ...day,
    entries: day.entries.map((e) => (e.id === id ? { ...e, portion: { ...e.portion, grams } } : e)),
  };
};
