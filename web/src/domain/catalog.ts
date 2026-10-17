import type { FoodItem } from './nutrition';
import { rank } from './textSearch';

// ---- Exercises --------------------------------------------------------------

export type ExerciseCategory =
  | 'strength' | 'stretching' | 'plyometrics' | 'powerlifting' | 'olympic_weightlifting' | 'strongman' | 'cardio';

export type ExerciseLevel = 'beginner' | 'intermediate' | 'expert';

export const EQUIPMENT = [
  'body_only', 'barbell', 'dumbbell', 'kettlebells', 'cable', 'machine', 'bands',
  'e_z_curl_bar', 'medicine_ball', 'exercise_ball', 'foam_roll', 'other',
] as const;
export type Equipment = (typeof EQUIPMENT)[number];

export const MUSCLES = [
  'abdominals', 'abductors', 'adductors', 'biceps', 'calves', 'chest', 'forearms', 'glutes', 'hamstrings',
  'lats', 'lower_back', 'middle_back', 'neck', 'quadriceps', 'shoulders', 'traps', 'triceps',
] as const;
export type Muscle = (typeof MUSCLES)[number];

/** An exercise from the bundled catalogue (free-exercise-db), with how to perform it. */
export interface ExerciseInfo {
  readonly id: string;
  readonly name: string;
  readonly category: ExerciseCategory;
  readonly level: ExerciseLevel;
  /** Null when the catalogue does not say. */
  readonly equipment: Equipment | null;
  readonly primaryMuscles: readonly Muscle[];
  readonly secondaryMuscles: readonly Muscle[];
  readonly instructions: readonly string[];
  /** Photos of the movement, usually its start and end position. */
  readonly imageUrls: readonly string[];
}

/** Filters for browsing the catalogue; null means any. */
export interface ExerciseFilter {
  readonly muscle: Muscle | null;
  readonly equipment: Equipment | null;
}

export const noFilter: ExerciseFilter = { muscle: null, equipment: null };

export const matches = (filter: ExerciseFilter, e: ExerciseInfo): boolean =>
  (filter.muscle === null || e.primaryMuscles.includes(filter.muscle)) &&
  (filter.equipment === null || filter.equipment === e.equipment);

export interface ExerciseCatalogRepository {
  /** Exercises passing [filter] and matching [query] (all of them for a blank query), best first. */
  search(query: string, filter: ExerciseFilter): Promise<ExerciseInfo[]>;
  get(id: string): Promise<ExerciseInfo | undefined>;
}

// ---- Foods ------------------------------------------------------------------

/** Basic foods (CREA tables), available offline. */
export interface BasicFoodRepository {
  /** Foods matching [query], best first; empty for a blank query. */
  search(query: string): Promise<FoodItem[]>;
}

export type ProductLookup =
  | { readonly status: 'found'; readonly product: FoodItem }
  /** Unknown barcode, or a product without nutrition data. */
  | { readonly status: 'not_found' }
  /** No network, or the service did not answer. */
  | { readonly status: 'unavailable' };

export type ProductSearch =
  | { readonly status: 'results'; readonly products: readonly FoodItem[] }
  | { readonly status: 'unavailable' };

/** Packaged products from Open Food Facts; needs a network connection. */
export interface ProductRepository {
  findByBarcode(barcode: string): Promise<ProductLookup>;
  search(query: string): Promise<ProductSearch>;
}

/** Packaged products the user scanned or ate, kept so they can be found again offline. */
export interface SavedProductRepository {
  /** Saves the product, or refreshes the saved copy with newer data. */
  save(product: FoodItem): Promise<void>;
  find(barcode: string): Promise<FoodItem | undefined>;
  search(query: string): Promise<FoodItem[]>;
}

/** A food's name with its brand, as matched by searches ("yogurt conad" works). */
export const searchableName = (food: FoodItem): string => [food.name, food.brand].filter(Boolean).join(' ');

/** Searches the foods available offline: the user's own, products seen before, and the basic ones. */
export const searchFoods = async (
  repos: {
    basicFoods: BasicFoodRepository;
    customFoods: { search(query: string): Promise<FoodItem[]> };
    savedProducts: SavedProductRepository;
  },
  query: string,
): Promise<FoodItem[]> => {
  const [custom, saved, basic] = await Promise.all([
    repos.customFoods.search(query),
    repos.savedProducts.search(query),
    repos.basicFoods.search(query),
  ]);
  return rank(query, [...custom, ...saved, ...basic], searchableName);
};

/**
 * Looks a barcode up online and saves what it finds. Offline, a product scanned or eaten before
 * is still found from the saved copy.
 */
export const lookUpBarcode = async (
  repos: { products: ProductRepository; savedProducts: SavedProductRepository },
  barcode: string,
): Promise<ProductLookup> => {
  const lookup = await repos.products.findByBarcode(barcode);
  if (lookup.status === 'found') {
    await repos.savedProducts.save(lookup.product);
    return lookup;
  }
  if (lookup.status === 'unavailable') {
    const saved = await repos.savedProducts.find(barcode);
    if (saved) return { status: 'found', product: saved };
  }
  return lookup;
};
