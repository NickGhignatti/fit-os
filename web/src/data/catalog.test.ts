import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { lookUpBarcode, noFilter, searchFoods } from '../domain/catalog';
import { Tables } from './schema';
import type { Store } from './store';
import { testStore } from './testStore';
import {
  SqlSavedProducts,
  OpenFoodFactsRepository,
  ProductSources,
  UsdaBrandedRepository,
  gtinForms,
  StaticBasicFoods,
  StaticExerciseCatalog,
  parseCreaCsv,
  parseCsvLine,
} from './catalog';
import { SqlCustomFoodRepository } from './repositories';

const read = (name: string) => readFileSync(new URL(`../../public/catalog/${name}`, import.meta.url), 'utf8');

describe('exercise catalogue (real file)', () => {
  const catalog = new StaticExerciseCatalog(async () => read('exercises.json'));

  it('loads hundreds of exercises with muscles, equipment and photos', async () => {
    const all = await catalog.search('', noFilter);
    expect(all.length).toBeGreaterThan(500);
    const sitUp = await catalog.get('3_4_Sit-Up');
    expect(sitUp).toMatchObject({ name: '3/4 Sit-Up', category: 'strength', equipment: 'body_only', primaryMuscles: ['abdominals'] });
    expect(sitUp?.imageUrls[0]).toMatch(/^https:\/\/cdn\.jsdelivr\.net\/gh\/yuhonas\/free-exercise-db@[0-9a-f]+\/exercises\/3_4_Sit-Up\/0\.jpg$/);
    expect(all.map((e) => e.name.toLowerCase())).toEqual([...all.map((e) => e.name.toLowerCase())].sort((a, b) => a.localeCompare(b)));
  });

  it('maps multi-word names like "lower back" and "e-z curl bar"', async () => {
    const all = await catalog.search('', noFilter);
    expect(all.some((e) => e.primaryMuscles.includes('lower_back'))).toBe(true);
    expect(all.some((e) => e.equipment === 'e_z_curl_bar')).toBe(true);
  });

  it('filters by muscle and equipment, and searches by name', async () => {
    const chestBarbell = await catalog.search('', { muscle: 'chest', equipment: 'barbell' });
    expect(chestBarbell.length).toBeGreaterThan(3);
    expect(chestBarbell.every((e) => e.primaryMuscles.includes('chest') && e.equipment === 'barbell')).toBe(true);
    const found = await catalog.search('bench press', noFilter);
    expect(found[0]?.name.toLowerCase()).toContain('bench');
    expect(await catalog.search('zzzzqqq', noFilter)).toEqual([]);
  });
});

describe('Italian foods (real file)', () => {
  const foods = new StaticBasicFoods(async () => read('crea_foods.csv'));

  it('parses hundreds of foods and finds them the Italian way', async () => {
    expect((await foods.search('acciuga'))[0]).toMatchObject({ id: 'crea:120010', name: 'Acciuga o alice', servingGrams: 150 });
    expect((await foods.search('acciuga'))[0]?.per100g.kcal).toBe(96);
    expect((await foods.search('caramelle mou'))[0]?.name).toBe('Caramelle tipo "mou"');
    expect((await foods.search('pollo')).length).toBeGreaterThan(3);
    expect(await foods.search('')).toEqual([]);
  });
});

describe('csv', () => {
  it('handles quotes, commas and escaped quotes', () => {
    expect(parseCsvLine('1,"a, b","say ""hi""",')).toEqual(['1', 'a, b', 'say "hi"', '']);
  });

  it('skips rows without energy and tolerates Windows line endings', () => {
    const csv = 'code,name,kcal,protein_g,fat_g,carbs_g,portion_g\r\n1,Ok,100,1,2,3,0\r\n2,NoEnergy,,1,2,3,10\r\n';
    expect(parseCreaCsv(csv)).toEqual([
      { id: 'crea:1', name: 'Ok', brand: null, per100g: { kcal: 100, protein: 1, carbs: 3, fat: 2 }, servingGrams: null },
    ]);
  });
});

const json = (status: number, body: unknown) => async () => new Response(JSON.stringify(body), { status });
const off = (fetchImpl: typeof fetch) => new OpenFoodFactsRepository({ products: 'https://p', search: 'https://s' }, fetchImpl);

describe('Open Food Facts', () => {
  const product = {
    code: '8076800195057',
    product_name: 'Spaghetti',
    product_name_it: 'Spaghetti n.5',
    brands: 'Barilla,Other',
    serving_quantity: '80',
    nutriments: { 'energy-kcal_100g': 359, proteins_100g: 13, carbohydrates_100g: 71.2, fat_100g: 2 },
  };

  it('finds a product by barcode, preferring the Italian name', async () => {
    const result = await off(json(200, { status: 1, product }) as unknown as typeof fetch).findByBarcode('8076800195057');
    expect(result).toEqual({
      status: 'found',
      product: {
        id: 'off:8076800195057', name: 'Spaghetti n.5', brand: 'Barilla',
        per100g: { kcal: 359, protein: 13, carbs: 71.2, fat: 2 }, servingGrams: 80,
      },
    });
  });

  it('converts kJ when kcal is missing, and rejects products without energy', async () => {
    const kj = { ...product, nutriments: { energy_100g: 418.4 } };
    const found = await off(json(200, { status: 1, product: kj }) as unknown as typeof fetch).findByBarcode('1');
    expect(found.status === 'found' && found.product.per100g.kcal).toBeCloseTo(100);
    const none = await off(json(200, { status: 1, product: { ...product, nutriments: {} } }) as unknown as typeof fetch).findByBarcode('1');
    expect(none.status).toBe('not_found');
  });

  it('asks the search index when the product record has no usable values', async () => {
    const urls: string[] = [];
    const fake = (async (url: string) => {
      urls.push(url);
      return new Response(JSON.stringify(url.includes('/api/v2/') ? { status: 1, product: { ...product, nutriments: { 'energy-kcal_prepared_100g': 567 } } } : { hits: [product] }));
    }) as unknown as typeof fetch;
    const result = await off(fake).findByBarcode('8076800195057');
    expect(result.status === 'found' && result.product.per100g.kcal).toBe(359);
    expect(decodeURIComponent(urls[1]!)).toContain('code:8076800195057');
  });

  it('distinguishes unknown, malformed and unreachable', async () => {
    expect((await off(json(404, { status: 0 }) as unknown as typeof fetch).findByBarcode('1')).status).toBe('not_found');
    expect((await off(json(200, {}) as unknown as typeof fetch).findByBarcode('abc')).status).toBe('not_found');
    expect((await off(json(500, {}) as unknown as typeof fetch).findByBarcode('1')).status).toBe('unavailable');
    const offline = (async () => { throw new TypeError('network'); }) as unknown as typeof fetch;
    expect((await off(offline).findByBarcode('1')).status).toBe('unavailable');
    expect((await off(offline).search('pasta')).status).toBe('unavailable');
  });

  it('searches restricted to Italy and drops unusable hits', async () => {
    let requested = '';
    const fake = (async (url: string) => {
      requested = url;
      return new Response(JSON.stringify({ hits: [{ ...product, brands: ['Barilla'] }, { code: '2' }] }));
    }) as unknown as typeof fetch;
    const result = await off(fake).search('spaghetti');
    expect(decodeURIComponent(requested)).toContain('countries_tags:"en:italy"');
    expect(result.status === 'results' && result.products.map((p) => [p.name, p.brand])).toEqual([['Spaghetti n.5', 'Barilla']]);
  });
});

describe('searching and scanning', () => {
  it('ranks the user\'s foods, saved products and basic foods together, brand included', async () => {
    const db = testStore();
    const custom = new SqlCustomFoodRepository(db);
    const saved = new SqlSavedProducts(db);
    await custom.create('Yogurt della nonna', { kcal: 60, protein: 3, carbs: 8, fat: 2 }, null, null);
    await saved.save({ id: 'off:1', name: 'Yogurt bianco', brand: 'Conad', per100g: { kcal: 55, protein: 4, carbs: 5, fat: 2 }, servingGrams: 125 });
    const basicFoods = new StaticBasicFoods(async () => read('crea_foods.csv'));

    const all = await searchFoods({ basicFoods, customFoods: custom, savedProducts: saved }, 'yogurt');
    expect(all.map((f) => f.id.split(':')[0])).toEqual(expect.arrayContaining(['custom', 'off']));
    const withBrand = await searchFoods({ basicFoods, customFoods: custom, savedProducts: saved }, 'yogurt conad');
    expect(withBrand.map((f) => f.id)).toEqual(['off:1']);
  });

  it('saves what it finds, and falls back to the saved copy when offline', async () => {
    const db = testStore();
    const saved = new SqlSavedProducts(db);
    const item = { id: 'off:99', name: 'Biscotti', brand: null, per100g: { kcal: 450, protein: 6, carbs: 70, fat: 15 }, servingGrams: null } as const;
    const online = { findByBarcode: async () => ({ status: 'found', product: item }) as const, search: async () => ({ status: 'unavailable' }) as const };
    const offline = { ...online, findByBarcode: async () => ({ status: 'unavailable' }) as const };
    const missing = { ...online, findByBarcode: async () => ({ status: 'not_found' }) as const };

    expect((await lookUpBarcode({ products: offline, savedProducts: saved }, '99')).status).toBe('unavailable'); // never seen
    expect((await lookUpBarcode({ products: missing, savedProducts: saved }, '99')).status).toBe('not_found');
    expect((await lookUpBarcode({ products: online, savedProducts: saved }, '99')).status).toBe('found');
    expect(await lookUpBarcode({ products: offline, savedProducts: saved }, '99')).toEqual({ status: 'found', product: item });
  });
});

describe('barcode sources', () => {
  const usda = (foods: unknown[]) => new UsdaBrandedRepository('k', (async () => new Response(JSON.stringify({ foods }))) as unknown as typeof fetch);
  const bar = {
    gtinUpc: '891128090406', description: 'KINDER BUENO RIEGEL BAR', brandName: 'FERRERO', servingSize: 21.5, servingSizeUnit: 'g',
    foodNutrients: [{ nutrientNumber: '208', value: 567 }, { nutrientNumber: '203', value: 9.3 }, { nutrientNumber: '205', value: 51.2 }, { nutrientNumber: '204', value: 37.2 }],
  };

  it('writes one barcode every way it turns up', () => {
    expect(gtinForms('0891128090406')).toEqual(['0891128090406', '891128090406']);
    expect(gtinForms('8000500037560')).toEqual(['8000500037560']);
  });

  it('reads a USDA branded product, matching the code however it is written', async () => {
    const result = await usda([bar]).findByBarcode('0891128090406');
    expect(result).toEqual({
      status: 'found',
      product: { id: 'usda:891128090406', name: 'Kinder Bueno Riegel Bar', brand: 'Ferrero', per100g: { kcal: 567, protein: 9.3, carbs: 51.2, fat: 37.2 }, servingGrams: 21.5 },
    });
    expect((await usda([{ ...bar, gtinUpc: '1' }]).findByBarcode('891128090406')).status).toBe('not_found');
  });

  it('asks the next source when the first does not know the code, and reports an unreachable one', async () => {
    const know = (status: 'not_found' | 'unavailable') => ({ findByBarcode: async () => ({ status }) as const, search: async () => ({ status: 'results', products: [] }) as const });
    const second = usda([bar]);
    expect((await new ProductSources([know('not_found'), second]).findByBarcode('891128090406')).status).toBe('found');
    expect((await new ProductSources([know('unavailable'), know('not_found')]).findByBarcode('891128090406')).status).toBe('unavailable');
    expect((await new ProductSources([know('not_found'), know('not_found')]).findByBarcode('891128090406')).status).toBe('not_found');
  });
});
