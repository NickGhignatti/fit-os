import { portionNutrients, sum, type FoodItem, type Nutrients } from './nutrition';

/**
 * A food the photo recogniser knows, as listed in /models/food-classes.json (written by
 * tools/food-model/train.py). A dish is made of CREA foods with their usual grams.
 */
export interface FoodClass {
  readonly id: string;
  readonly name: string;
  /** Empty for things with nothing to log, such as water or herbs. */
  readonly foods: readonly { readonly code: string; readonly grams: number }[];
  /** The usual part of a photo this food covers when it is alone in it, or null when unknown. */
  readonly share: number | null;
}

export interface RecogniserModel {
  /** The photo's side in pixels, and the side of the grid of patches it is cut into. */
  readonly size: number;
  readonly grid: number;
  /** A food is listed from this likelihood up. */
  readonly threshold: number;
  readonly classes: readonly FoodClass[];
}

/** What the recogniser says about one photo. */
export interface Recognition {
  /** For each class, how likely the photo shows it, 0 to 1. */
  readonly likelihoods: Float32Array;
  /** For each patch, row by row, the likelihood of each class and lastly of "no food". */
  readonly patches: Float32Array;
}

/** A food found in the photo. */
export interface FoundFood {
  readonly classIndex: number;
  readonly likelihood: number;
  /** Part of the photo it covers, 0 to 1. */
  readonly coverage: number;
  /** How much bigger or smaller than usual its portion looks; 1 when there is nothing to go by. */
  readonly scale: number;
  /** Other foods it might be, most likely first. */
  readonly alternatives: readonly number[];
}

/** A portion looks at most this much bigger or smaller than usual from the photo alone. */
const SCALE_LIMITS = [0.6, 1.6] as const;
const ALTERNATIVES = 3;

const clamp = (n: number, [low, high]: readonly [number, number]) => Math.min(high, Math.max(low, n));

/** The class each patch most likely shows; `classes.length` means no food. */
export const patchClasses = (model: RecogniserModel, recognition: Recognition): number[] => {
  const width = model.classes.length + 1;
  const cells = model.grid * model.grid;
  return Array.from({ length: cells }, (_, cell) => {
    let best = 0;
    for (let c = 1; c < width; c++) if (recognition.patches[cell * width + c]! > recognition.patches[cell * width + best]!) best = c;
    return best;
  });
};

/**
 * The foods in the photo, most likely first: every food from the model's threshold up, or else the
 * single most likely one. Things with nothing to log (water, herbs) are left out. A food's portion
 * is scaled by how much of the photo it covers compared with usual, within limits, and by the square
 * root, since a plate twice as wide in the photo is also seen from closer.
 */
export const findFoods = (model: RecogniserModel, recognition: Recognition): FoundFood[] => {
  const { classes } = model;
  const order = classes.map((_, i) => i).sort((a, b) => recognition.likelihoods[b]! - recognition.likelihoods[a]!);
  const loggable = order.filter((i) => classes[i]!.foods.length > 0);
  const above = order.filter((i) => recognition.likelihoods[i]! >= model.threshold);
  const picked = (above.length > 0 ? above : order.slice(0, 1)).filter((i) => classes[i]!.foods.length > 0);
  const cells = patchClasses(model, recognition);
  return picked.map((classIndex) => {
    const coverage = cells.filter((c) => c === classIndex).length / cells.length;
    const share = classes[classIndex]!.share;
    return {
      classIndex,
      likelihood: recognition.likelihoods[classIndex]!,
      coverage,
      scale: share && coverage > 0 ? clamp(Math.sqrt(coverage / share), SCALE_LIMITS) : 1,
      alternatives: loggable.filter((i) => !picked.includes(i)).slice(0, ALTERNATIVES),
    };
  });
};

/** Grams as people weigh food: whole grams up to 10, then steps of 5. */
export const roundGrams = (grams: number): number => (grams < 10 ? Math.max(1, Math.round(grams)) : Math.round(grams / 5) * 5);

/** A food on the list being checked before it is logged. */
export interface PlateItem {
  readonly key: string;
  readonly name: string;
  /** The recogniser's class, or null for a food the user added. */
  readonly classIndex: number | null;
  readonly alternatives: readonly number[];
  readonly parts: readonly { readonly food: FoodItem; readonly grams: number }[];
}

export const itemGrams = (item: PlateItem): number => item.parts.reduce((total, p) => total + p.grams, 0);

export const itemNutrients = (item: PlateItem): Nutrients => sum(item.parts.map((p) => portionNutrients(p)));

export const plateNutrients = (items: readonly PlateItem[]): Nutrients => sum(items.map(itemNutrients));

/** The item with every part resized so they add up to [grams], keeping their proportions. */
export const withTotalGrams = (item: PlateItem, grams: number): PlateItem => {
  if (!(grams > 0)) throw new Error(`grams must be positive, was ${grams}`);
  const factor = grams / itemGrams(item);
  return { ...item, parts: item.parts.map((p) => ({ ...p, grams: p.grams * factor })) };
};

export const withPartGrams = (item: PlateItem, index: number, grams: number): PlateItem => {
  if (!(grams > 0)) throw new Error(`grams must be positive, was ${grams}`);
  return { ...item, parts: item.parts.map((p, i) => (i === index ? { ...p, grams } : p)) };
};

/** The parts of a recognised class, its usual grams times [scale]; null when a food is missing from the tables. */
export const partsOf = (
  foodClass: FoodClass,
  scale: number,
  foodOf: (code: string) => FoodItem | undefined,
): PlateItem['parts'] | null => {
  const parts = foodClass.foods.map((f) => ({ food: foodOf(f.code), grams: roundGrams(f.grams * scale) }));
  return parts.every((p) => p.food) ? parts.map((p) => ({ food: p.food!, grams: p.grams })) : null;
};
