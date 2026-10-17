import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { TrackerDb } from '../data/db';
import { parseBackup } from '../data/backup';
import { DexieProfileRepository } from '../data/repositories';
import { targetsForProfile } from './nutritionTargets';
import { defaultProfile, type Profile } from './profile';
import { profileSchema } from './schemas';

/** A man who can be computed for: maintenance is (10·80 + 6.25·180 − 5·30 + 5) × 1.55 = 2,759 kcal. */
const known: Profile = { ...defaultProfile, sex: 'male', heightCm: 180, birthDate: '1996-01-01' };
const compute = (profile: Profile) => targetsForProfile(profile, 80, 30);

describe('custom targets', () => {
  it('leaves everything automatic when nothing is set', () => {
    const t = compute(known)!;
    expect(t.isCustom).toBe(false);
    expect(t.nutrients.kcal).toBeCloseTo(2759);
    expect(t.nutrients.protein).toBeCloseTo(144); // 1.8 g per kg
    expect(t.nutrients.fat).toBeCloseTo(76.64, 1); // 25% of calories
  });

  it('uses a custom calorie target and splits the rest from it', () => {
    const t = compute({ ...known, customKcal: 2000 })!;
    expect(t.isCustom).toBe(true);
    expect(t.nutrients.kcal).toBe(2000);
    expect(t.nutrients.protein).toBeCloseTo(144);
    expect(t.nutrients.fat).toBeCloseTo(55.56, 1);
    // calories add up: carbs are what protein and fat leave
    const { protein, carbs, fat } = t.nutrients;
    expect(protein * 4 + carbs * 4 + fat * 9).toBeCloseTo(2000);
  });

  it('takes custom protein as given and re-derives carbs from what is left', () => {
    const auto = compute(known)!.nutrients;
    const t = compute({ ...known, customProtein: 200 })!.nutrients;
    expect(t.protein).toBe(200);
    expect(t.kcal).toBeCloseTo(auto.kcal); // calories unchanged
    expect(t.fat).toBeCloseTo(auto.fat);
    expect(t.carbs).toBeCloseTo((auto.kcal - 200 * 4 - auto.fat * 9) / 4);
    expect(t.carbs).toBeLessThan(auto.carbs);
  });

  it('never lets carbs go negative', () => {
    const t = compute({ ...known, customKcal: 1200, customProtein: 250, customFat: 100 })!.nutrients;
    expect(t.carbs).toBe(0);
  });

  it('derives calories from three custom macros when no calorie target is given', () => {
    const t = compute({ ...known, customProtein: 150, customCarbs: 250, customFat: 70 })!;
    expect(t.nutrients).toEqual({ kcal: 150 * 4 + 250 * 4 + 70 * 9, protein: 150, carbs: 250, fat: 70 });
    expect(t.isCustom).toBe(true);
  });

  it('prefers an explicit calorie target over the macros it would have been derived from', () => {
    const t = compute({ ...known, customKcal: 2500, customProtein: 150, customCarbs: 250, customFat: 70 })!;
    expect(t.nutrients.kcal).toBe(2500);
  });

  it('needs no profile at all when the user sets the calories themselves', () => {
    expect(targetsForProfile(defaultProfile, null, null)).toBeNull();
    const t = targetsForProfile({ ...defaultProfile, customKcal: 2200 }, null, null)!;
    expect(t.nutrients.kcal).toBe(2200);
    expect(t.nutrients.protein).toBeCloseTo(137.5); // 25% of calories without a weight
    const macros = targetsForProfile({ ...defaultProfile, customProtein: 100, customCarbs: 200, customFat: 50 }, null, null)!;
    expect(macros.nutrients.kcal).toBe(100 * 4 + 200 * 4 + 50 * 9);
  });

  it('accepts a zero target, e.g. a no-fat plan', () => {
    expect(compute({ ...known, customFat: 0 })!.nutrients.fat).toBe(0);
  });
});

describe('profiles written before custom macros existed', () => {
  const legacy = { sex: 'male', birthDate: null, heightCm: 180, activity: 'moderate', pace: 'maintain', customKcal: 2100 };

  it('validate, with the new targets empty', () => {
    expect(profileSchema.parse(legacy)).toEqual({ ...legacy, customProtein: null, customCarbs: null, customFat: null });
  });

  it('are accepted inside an old backup file', () => {
    const file = JSON.stringify({
      app: 'tracker', v: 1, exportedAt: 'x',
      data: { trainingPlans: [], dietPlans: [], workouts: [], foodLogDays: [], customFoods: [], favorites: [], weights: [], profile: legacy },
    });
    const parsed = parseBackup(file);
    expect(parsed.ok && parsed.backup.data.profile?.customProtein).toBeNull();
  });

  it('read back from the device with the new targets empty', async () => {
    const db = new TrackerDb('legacy-profile');
    await db.profile.put({ key: 'me', ...legacy } as never); // the row exactly as an older version stored it
    const profile = await new Promise<Profile>((resolve) => {
      new DexieProfileRepository(db).observeProfile().subscribe(resolve);
    });
    expect(profile.customKcal).toBe(2100);
    expect(profile.customProtein).toBeNull();
    expect(profile.customFat).toBeNull();
  });

  it('reject absurd targets from a file', () => {
    expect(() => profileSchema.parse({ ...legacy, customProtein: 99_999 })).toThrow();
    expect(() => profileSchema.parse({ ...legacy, customCarbs: -5 })).toThrow();
  });
});
