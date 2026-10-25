import { describe, expect, it } from 'vitest';
import type { FoodItem } from './nutrition';
import {
  findFoods, itemGrams, partsOf, plateNutrients, roundGrams, withPartGrams, withTotalGrams,
  type PlateItem, type Recognition, type RecogniserModel,
} from './photoFoods';

const model: RecogniserModel = {
  size: 224,
  grid: 2, // four patches keep the numbers easy
  threshold: 0.3,
  classes: [
    { id: 'pasta', name: 'Pasta', foods: [{ code: 'P', grams: 200 }], share: 0.25 },
    { id: 'sauce', name: 'Tomato sauce', foods: [{ code: 'S', grams: 80 }, { code: 'O', grams: 5 }], share: null },
    { id: 'water', name: 'Water', foods: [], share: null },
    { id: 'rice', name: 'Rice', foods: [{ code: 'R', grams: 180 }], share: 0.5 },
  ],
};

/** Likelihoods per class, and for each of the four patches the class it shows (4 = no food). */
const recognition = (likelihoods: number[], patches: number[]): Recognition => {
  const width = model.classes.length + 1;
  const cells = new Float32Array(patches.length * width);
  patches.forEach((c, cell) => { cells[cell * width + c] = 1; });
  return { likelihoods: Float32Array.from(likelihoods), patches: cells };
};

const food = (id: string, kcal: number): FoodItem => ({ id: `crea:${id}`, name: id, brand: null, per100g: { kcal, protein: 10, carbs: 50, fat: 1 }, servingGrams: null });

describe('the foods found in a photo', () => {
  it('lists every food from the threshold up, most likely first, leaving out things with nothing to log', () => {
    const found = findFoods(model, recognition([0.9, 0.4, 0.8, 0.1], [0, 0, 1, 4]));
    expect(found.map((f) => f.classIndex)).toEqual([0, 1]); // water (0.8) is seen but not listed
    expect(found[0]!.alternatives).toEqual([3]); // rice, the next loggable food not already listed
  });

  it('lists the single most likely food when none reaches the threshold', () => {
    expect(findFoods(model, recognition([0.1, 0.2, 0.05, 0.15], [4, 4, 4, 4])).map((f) => f.classIndex)).toEqual([1]);
  });

  it('scales a portion by the square root of how much of the photo it covers against usual, within limits', () => {
    // Pasta covers 2 of 4 patches (50%) where it usually covers 25%: √2 ≈ 1.41 times its usual portion.
    expect(findFoods(model, recognition([0.9, 0, 0, 0], [0, 0, 4, 4]))[0]).toMatchObject({ coverage: 0.5, scale: Math.SQRT2 });
    // All four patches: √4 = 2, held to 1.6.
    expect(findFoods(model, recognition([0.9, 0, 0, 0], [0, 0, 0, 0]))[0]!.scale).toBe(1.6);
    // A food with no usual share keeps its usual portion.
    expect(findFoods(model, recognition([0, 0.9, 0, 0], [1, 1, 1, 1]))[0]!.scale).toBe(1);
  });
});

describe('the list being checked', () => {
  const foods = new Map([['P', food('P', 175)], ['S', food('S', 21)], ['O', food('O', 899)]]);
  const sauce: PlateItem = { key: 'k', name: 'Tomato sauce', classIndex: 1, alternatives: [], parts: partsOf(model.classes[1]!, 1, (c) => foods.get(c))! };

  it('turns a dish into its foods with their usual grams, rounded as people weigh', () => {
    expect(sauce.parts.map((p) => [p.food.id, p.grams])).toEqual([['crea:S', 80], ['crea:O', 5]]);
    expect(partsOf(model.classes[0]!, Math.SQRT2, (c) => foods.get(c))!.map((p) => p.grams)).toEqual([285]); // 282.8 g
    expect(partsOf(model.classes[3]!, 1, (c) => foods.get(c))).toBeNull(); // rice is not in the tables here
    expect([roundGrams(4.4), roundGrams(12), roundGrams(283)]).toEqual([4, 10, 285]);
  });

  it('resizes all of a dish’s foods together, or one on its own, and the totals follow', () => {
    const half = withTotalGrams(sauce, 42.5);
    expect(half.parts.map((p) => p.grams)).toEqual([40, 2.5]);
    expect(itemGrams(half)).toBe(42.5);
    // 40 g of sauce at 21 kcal and 2.5 g of oil at 899 kcal per 100 g: 8.4 + 22.475 kcal.
    expect(plateNutrients([half]).kcal).toBeCloseTo(30.875);
    expect(withPartGrams(sauce, 1, 10).parts.map((p) => p.grams)).toEqual([80, 10]);
  });
});
