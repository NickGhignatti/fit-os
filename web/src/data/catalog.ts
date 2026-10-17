import {
  EQUIPMENT,
  MUSCLES,
  matches,
  searchableName,
  type BasicFoodRepository,
  type Equipment,
  type ExerciseCatalogRepository,
  type ExerciseCategory,
  type ExerciseFilter,
  type ExerciseInfo,
  type ExerciseLevel,
  type Muscle,
  type ProductLookup,
  type ProductRepository,
  type ProductSearch,
  type SavedProductRepository,
} from '../domain/catalog';
import type { FoodItem } from '../domain/nutrition';
import { rank } from '../domain/textSearch';
import type { TrackerDb } from './db';

// ---- Exercises: free-exercise-db (public domain) ----------------------------

/** Must match the commit in tools/exercises/fetch_exercises.py. */
const IMAGE_BASE_URL =
  'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5/exercises/';

const CATEGORIES: readonly ExerciseCategory[] = [
  'strength', 'stretching', 'plyometrics', 'powerlifting', 'olympic_weightlifting', 'strongman', 'cardio',
];
const LEVELS: readonly ExerciseLevel[] = ['beginner', 'intermediate', 'expert'];

/** The catalogue writes "lower back", "e-z curl bar", "olympic weightlifting": map them to our names. */
const slug = (value: string | null | undefined): string | null =>
  value ? value.toLowerCase().replace(/[^a-z]+/g, '_') : null;

const oneOf = <T extends string>(options: readonly T[], value: string | null | undefined): T | null => {
  const key = slug(value);
  return options.find((o) => o === key) ?? null;
};

interface ExerciseDto {
  id: string;
  name: string;
  category?: string;
  level?: string;
  equipment?: string | null;
  primaryMuscles?: string[];
  secondaryMuscles?: string[];
  instructions?: string[];
  images?: string[];
}

const muscles = (names: readonly string[] | undefined): Muscle[] =>
  (names ?? []).flatMap((n) => {
    const m = oneOf(MUSCLES, n);
    return m ? [m] : [];
  });

/** Sorted by name; entries the app does not understand are dropped rather than failing the whole list. */
export const parseExerciseCatalog = (text: string): ExerciseInfo[] =>
  (JSON.parse(text) as ExerciseDto[])
    .flatMap((dto): ExerciseInfo[] => {
      const category = oneOf(CATEGORIES, dto.category);
      if (!category) return [];
      return [
        {
          id: dto.id,
          name: dto.name.trim(),
          category,
          level: oneOf(LEVELS, dto.level) ?? 'beginner',
          equipment: oneOf<Equipment>(EQUIPMENT, dto.equipment),
          primaryMuscles: muscles(dto.primaryMuscles),
          secondaryMuscles: muscles(dto.secondaryMuscles),
          instructions: (dto.instructions ?? []).map((i) => i.trim()).filter(Boolean),
          imageUrls: (dto.images ?? []).map((i) => IMAGE_BASE_URL + i),
        },
      ];
    })
    .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));

/** Loads the file once, on first use, and keeps the parsed list. */
const lazy = <T>(load: () => Promise<T>): (() => Promise<T>) => {
  let pending: Promise<T> | undefined;
  return () => (pending ??= load().catch((error) => {
    pending = undefined; // allow a retry after a network failure
    throw error;
  }));
};

const fetchText = async (url: string, fetchImpl: typeof fetch): Promise<string> => {
  const response = await fetchImpl(url);
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  return response.text();
};

export class StaticExerciseCatalog implements ExerciseCatalogRepository {
  private readonly exercises: () => Promise<ExerciseInfo[]>;

  constructor(loadText: () => Promise<string> = () => fetchText('/catalog/exercises.json', fetch)) {
    this.exercises = lazy(async () => parseExerciseCatalog(await loadText()));
  }

  async search(query: string, filter: ExerciseFilter): Promise<ExerciseInfo[]> {
    const matching = (await this.exercises()).filter((e) => matches(filter, e));
    return query.trim() === '' ? matching : rank(query, matching, (e) => e.name);
  }

  async get(id: string): Promise<ExerciseInfo | undefined> {
    return (await this.exercises()).find((e) => e.id === id);
  }
}

// ---- Foods: CREA tables (Italian), bundled ----------------------------------

/** One RFC 4180 line: commas separate cells, quotes wrap cells containing commas, "" is a quote. */
export const parseCsvLine = (line: string): string[] => {
  const cells: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (quoted && char === '"' && line[i + 1] === '"') {
      cell += '"';
      i++;
    } else if (char === '"') quoted = !quoted;
    else if (char === ',' && !quoted) {
      cells.push(cell);
      cell = '';
    } else cell += char;
  }
  cells.push(cell);
  return cells;
};

/** Reads the CSV written by tools/crea/extract_crea.py; rows without energy are skipped. */
export const parseCreaCsv = (text: string): FoodItem[] => {
  const [headerLine, ...lines] = text.split(/\r?\n/);
  if (!headerLine) return [];
  const column = new Map(parseCsvLine(headerLine).map((name, index) => [name, index]));
  return lines
    .filter((l) => l.trim() !== '')
    .flatMap((line): FoodItem[] => {
      const cells = parseCsvLine(line);
      const text = (name: string) => cells[column.get(name) ?? -1] ?? '';
      const number = (name: string): number | null => {
        const n = Number.parseFloat(text(name));
        return Number.isFinite(n) ? n : null;
      };
      const kcal = number('kcal');
      if (kcal === null) return [];
      const serving = number('portion_g');
      return [
        {
          id: `crea:${text('code')}`,
          name: text('name'),
          brand: null,
          per100g: { kcal, protein: number('protein_g') ?? 0, carbs: number('carbs_g') ?? 0, fat: number('fat_g') ?? 0 },
          servingGrams: serving !== null && serving > 0 ? serving : null,
        },
      ];
    });
};

export class StaticBasicFoods implements BasicFoodRepository {
  private readonly foods: () => Promise<FoodItem[]>;

  constructor(loadText: () => Promise<string> = () => fetchText('/catalog/crea_foods.csv', fetch)) {
    this.foods = lazy(async () => parseCreaCsv(await loadText()));
  }

  async search(query: string): Promise<FoodItem[]> {
    return rank(query, await this.foods(), (f) => f.name);
  }
}

// ---- Packaged products: Open Food Facts (ODbL) ------------------------------

const FIELDS = 'code,product_name,product_name_it,brands,nutriments,serving_quantity';
const PAGE_SIZE = 20;
const KJ_PER_KCAL = 4.184;

interface ProductDto {
  code?: string;
  product_name?: string;
  product_name_it?: string;
  /** A comma-separated string from the product API, a list from the search API. */
  brands?: string | string[];
  nutriments?: Record<string, number | undefined>;
  serving_quantity?: string | number;
}

const firstBrand = (brands: ProductDto['brands']): string | null => {
  const first = Array.isArray(brands) ? brands[0] : brands?.split(',')[0];
  return first?.trim() || null;
};

/** Null for products without a name or an energy value: they cannot be logged. */
const toFoodItem = (dto: ProductDto): FoodItem | null => {
  const code = dto.code?.trim();
  const name = (dto.product_name_it?.trim() || dto.product_name?.trim()) ?? '';
  const n = dto.nutriments;
  if (!code || !name || !n) return null;
  const kcal = n['energy-kcal_100g'] ?? (n['energy_100g'] !== undefined ? n['energy_100g'] / KJ_PER_KCAL : undefined);
  if (kcal === undefined) return null;
  const serving = Number(dto.serving_quantity);
  return {
    id: `off:${code}`,
    name,
    brand: firstBrand(dto.brands),
    per100g: { kcal, protein: n['proteins_100g'] ?? 0, carbs: n['carbohydrates_100g'] ?? 0, fat: n['fat_100g'] ?? 0 },
    servingGrams: Number.isFinite(serving) && serving > 0 ? serving : null,
  };
};

export interface OpenFoodFactsEndpoints {
  readonly products: string;
  readonly search: string;
}

export const OFF_ENDPOINTS: OpenFoodFactsEndpoints = {
  products: 'https://world.openfoodfacts.org',
  search: 'https://search.openfoodfacts.org',
};

export class OpenFoodFactsRepository implements ProductRepository {
  constructor(
    private readonly endpoints: OpenFoodFactsEndpoints = OFF_ENDPOINTS,
    private readonly fetchImpl: typeof fetch = (...args) => fetch(...args),
  ) {}

  async findByBarcode(barcode: string): Promise<ProductLookup> {
    if (!/^\d+$/.test(barcode)) return { status: 'not_found' };
    const response = await this.get<{ status?: number; product?: ProductDto }>(
      `${this.endpoints.products}/api/v2/product/${barcode}?fields=${FIELDS}`,
      true,
    );
    if (response === undefined) return { status: 'unavailable' };
    const product = response.status === 1 && response.product ? toFoodItem(response.product) : null;
    return product ? { status: 'found', product } : { status: 'not_found' };
  }

  async search(query: string): Promise<ProductSearch> {
    const q = encodeURIComponent(`${query} countries_tags:"en:italy"`);
    const response = await this.get<{ hits?: ProductDto[] }>(
      `${this.endpoints.search}/search?q=${q}&langs=it&page_size=${PAGE_SIZE}&fields=${FIELDS}`,
    );
    if (response === undefined) return { status: 'unavailable' };
    return { status: 'results', products: (response.hits ?? []).flatMap((h) => toFoodItem(h) ?? []) };
  }

  /** Undefined when the service cannot be reached or answers with an error. */
  private async get<T>(url: string, acceptNotFound = false): Promise<T | undefined> {
    try {
      const response = await this.fetchImpl(url);
      if (!response.ok && !(acceptNotFound && response.status === 404)) return undefined;
      return (await response.json()) as T;
    } catch {
      return undefined;
    }
  }
}

export class DexieSavedProducts implements SavedProductRepository {
  constructor(private readonly db: TrackerDb) {}

  async save(product: FoodItem): Promise<void> {
    await this.db.savedProducts.put(product);
  }

  find(barcode: string): Promise<FoodItem | undefined> {
    return this.db.savedProducts.get(`off:${barcode}`);
  }

  async search(query: string): Promise<FoodItem[]> {
    return rank(query, await this.db.savedProducts.toArray(), searchableName);
  }
}
