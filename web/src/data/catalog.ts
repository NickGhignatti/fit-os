import {
  EQUIPMENT,
  MUSCLES,
  matches,
  searchableName,
  type BasicFoodRepository,
  type CustomExerciseRepository,
  customToInfo,
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
import { Tables } from './schema';
import type { Store } from './store';

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

/**
 * The bundled catalogue and the user's own exercises as one library: both are searched together,
 * and an id finds either. Custom ones are read fresh each time, so a new one shows up at once.
 */
export class ExerciseLibrary implements ExerciseCatalogRepository {
  constructor(
    private readonly bundled: ExerciseCatalogRepository,
    private readonly custom: CustomExerciseRepository,
  ) {}

  /**
   * With a search, the best matches whether yours or bundled. Without one, your own exercises come first
   * (they would otherwise be lost somewhere in an alphabetical list of nearly nine hundred), then the rest.
   */
  async search(query: string, filter: ExerciseFilter): Promise<ExerciseInfo[]> {
    const [bundled, custom] = await Promise.all([this.bundled.search('', filter), this.custom.getAll()]);
    const own = custom.map(customToInfo).filter((e) => matches(filter, e));
    return query.trim() === '' ? [...own, ...bundled] : rank(query, [...own, ...bundled], (e) => e.name);
  }

  async get(id: string): Promise<ExerciseInfo | undefined> {
    const own = (await this.custom.getAll()).find((e) => e.id === id);
    return own ? customToInfo(own) : this.bundled.get(id);
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

  async byCode(code: string): Promise<FoodItem | undefined> {
    return (await this.foods()).find((f) => f.id === `crea:${code}`);
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
    const product = (response.status === 1 && response.product ? toFoodItem(response.product) : null) ?? (await this.searchByCode(barcode));
    return product ? { status: 'found', product } : { status: 'not_found' };
  }

  /**
   * The product record keeps what people typed in, and some have their values under the wrong tab
   * (Kinder Bueno has them as "prepared"); the search index has them sorted out. Asked when the record is unusable.
   */
  private async searchByCode(barcode: string): Promise<FoodItem | null> {
    const q = encodeURIComponent(`code:${barcode}`);
    const response = await this.get<{ hits?: ProductDto[] }>(
      `${this.endpoints.search}/search?q=${q}&page_size=1&fields=${FIELDS}`,
    );
    const hit = response?.hits?.find((h) => h.code === barcode);
    return hit ? toFoodItem(hit) : null;
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

/** Where saved products come from: the prefix of their ids. */
const PRODUCT_SOURCES = ['off', 'usda'] as const;

/**
 * The ways one product's barcode is written: the same number turns up as EAN-13 with a leading zero
 * in one database and as UPC-A (12 digits) or without the zeros in another. The code as given comes first.
 */
export const gtinForms = (barcode: string): string[] => {
  const bare = barcode.replace(/^0+/, '');
  const padded = [8, 12, 13].filter((n) => n >= bare.length).map((n) => bare.padStart(n, '0'));
  return [...new Set([barcode, ...padded, bare])].filter((code) => code !== '');
};

// ---- Packaged products: USDA FoodData Central, Branded Foods (public domain) ----

const USDA_URL = 'https://api.nal.usda.gov/fdc/v1/foods/search';
/** A shared key with a small hourly allowance, enough to try; set VITE_USDA_API_KEY for your own (free at fdc.nal.usda.gov). */
const USDA_DEMO_KEY = 'DEMO_KEY';

interface UsdaFoodDto {
  gtinUpc?: string;
  description?: string;
  brandName?: string;
  brandOwner?: string;
  servingSize?: number;
  servingSizeUnit?: string;
  foodNutrients?: { nutrientNumber?: string; value?: number }[];
}

const titleCase = (text: string): string => text.toLowerCase().replace(/(^|[\s(\-/])(\p{L})/gu, (_, before: string, letter: string) => before + letter.toUpperCase());

/** Null for products without a name or an energy value. USDA writes values per 100 g, names in capitals. */
const usdaToFoodItem = (dto: UsdaFoodDto): FoodItem | null => {
  const code = dto.gtinUpc?.trim();
  const name = dto.description?.trim();
  if (!code || !name) return null;
  const value = (number: string) => dto.foodNutrients?.find((n) => n.nutrientNumber === number)?.value;
  const kcal = value('208') ?? (value('268') !== undefined ? value('268')! / KJ_PER_KCAL : undefined);
  if (kcal === undefined) return null;
  const brand = (dto.brandName ?? dto.brandOwner)?.trim();
  const grams = dto.servingSizeUnit?.toLowerCase() === 'g' ? dto.servingSize : undefined;
  return {
    id: `usda:${code}`,
    name: titleCase(name),
    brand: brand ? titleCase(brand) : null,
    per100g: { kcal, protein: value('203') ?? 0, carbs: value('205') ?? 0, fat: value('204') ?? 0 },
    servingGrams: grams !== undefined && grams > 0 ? grams : null,
  };
};

/** Barcodes only: USDA's names are English and American, so it does not take part in searching by name. */
export class UsdaBrandedRepository implements ProductRepository {
  constructor(
    private readonly apiKey: string = USDA_DEMO_KEY,
    private readonly fetchImpl: typeof fetch = (...args) => fetch(...args),
  ) {}

  async findByBarcode(barcode: string): Promise<ProductLookup> {
    if (!/^\d+$/.test(barcode)) return { status: 'not_found' };
    const forms = new Set(gtinForms(barcode));
    try {
      const response = await this.fetchImpl(`${USDA_URL}?query=${barcode}&dataType=Branded&pageSize=5&api_key=${this.apiKey}`);
      if (!response.ok) return { status: response.status === 429 ? 'not_found' : 'unavailable' }; // over the hourly allowance
      const { foods } = (await response.json()) as { foods?: UsdaFoodDto[] };
      const product = (foods ?? []).filter((f) => f.gtinUpc && forms.has(f.gtinUpc)).flatMap((f) => usdaToFoodItem(f) ?? [])[0];
      return product ? { status: 'found', product } : { status: 'not_found' };
    } catch {
      return { status: 'unavailable' };
    }
  }

  async search(): Promise<ProductSearch> {
    return { status: 'results', products: [] };
  }
}

/**
 * Several sources behind one: a barcode is asked of each in turn, in each way it can be written, until
 * one knows it. Searching by name goes to the first source only. If nothing knows the code but some
 * source could not be reached, the answer is "unavailable" so the saved copy gets a chance.
 */
export class ProductSources implements ProductRepository {
  constructor(private readonly sources: readonly [ProductRepository, ...ProductRepository[]]) {}

  async findByBarcode(barcode: string): Promise<ProductLookup> {
    let unreachable = false;
    for (const source of this.sources) {
      for (const form of gtinForms(barcode)) {
        const lookup = await source.findByBarcode(form);
        if (lookup.status === 'found') return lookup;
        unreachable ||= lookup.status === 'unavailable';
        if (lookup.status === 'unavailable') break; // the same source will not answer for another form
      }
    }
    return { status: unreachable ? 'unavailable' : 'not_found' };
  }

  search(query: string): Promise<ProductSearch> {
    return this.sources[0].search(query);
  }
}

export class SqlSavedProducts implements SavedProductRepository {
  constructor(private readonly store: Store) {}

  save(product: FoodItem): Promise<void> {
    return this.store.docs.put(Tables.savedProducts, product);
  }

  async find(barcode: string): Promise<FoodItem | undefined> {
    for (const form of gtinForms(barcode)) {
      for (const source of PRODUCT_SOURCES) {
        const saved = await this.store.docs.get(Tables.savedProducts, `${source}:${form}`);
        if (saved) return saved;
      }
    }
    return undefined;
  }

  async search(query: string): Promise<FoodItem[]> {
    return rank(query, await this.store.docs.list(Tables.savedProducts), searchableName);
  }
}
