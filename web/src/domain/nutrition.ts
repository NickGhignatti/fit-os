/** Energy in kcal and macronutrients in grams, for some amount of food. */
export interface Nutrients {
  readonly kcal: number;
  readonly protein: number;
  readonly carbs: number;
  readonly fat: number;
}

export const ZERO: Nutrients = { kcal: 0, protein: 0, carbs: 0, fat: 0 };

export const plus = (a: Nutrients, b: Nutrients): Nutrients => ({
  kcal: a.kcal + b.kcal,
  protein: a.protein + b.protein,
  carbs: a.carbs + b.carbs,
  fat: a.fat + b.fat,
});

export const times = (n: Nutrients, factor: number): Nutrients => ({
  kcal: n.kcal * factor,
  protein: n.protein * factor,
  carbs: n.carbs * factor,
  fat: n.fat * factor,
});

export const sum = (items: readonly Nutrients[]): Nutrients => items.reduce(plus, ZERO);

/** Where a food's nutrition data comes from. */
export type FoodSource = 'crea' | 'off' | 'custom';

const SOURCES: readonly FoodSource[] = ['crea', 'off', 'custom'];

/** A stable reference to a food in its source, written as e.g. "crea:005000" or "off:8076800195057". */
export type FoodId = `${FoodSource}:${string}`;

export const parseFoodId = (value: string): { source: FoodSource; key: string } => {
  const source = SOURCES.find((s) => value.startsWith(`${s}:`));
  if (!source) throw new Error(`unknown food source in ${value}`);
  return { source, key: value.slice(source.length + 1) };
};

/**
 * A food with known nutrition per 100 g. This is also the snapshot stored in plans and the food log,
 * so reading them never needs a lookup.
 */
export interface FoodItem {
  readonly id: FoodId;
  readonly name: string;
  readonly brand: string | null;
  readonly per100g: Nutrients;
  /** A typical serving in grams, when the source gives one. */
  readonly servingGrams: number | null;
}

/** An amount of a food. */
export interface Portion {
  readonly food: FoodItem;
  readonly grams: number;
}

export const portionOf = (food: FoodItem, grams: number): Portion => {
  if (!(grams > 0)) throw new Error(`grams must be positive, was ${grams}`);
  return { food, grams };
};

export const portionNutrients = (p: Portion): Nutrients => times(p.food.per100g, p.grams / 100);
