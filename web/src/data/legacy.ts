import Dexie from 'dexie';
import { Tables, type DocTable } from './schema';
import type { Store } from './store';
import { TrackerDb } from './db';

const COPIED = 'legacy-copied';

/**
 * Copies what the app stored in IndexedDB (through Dexie) before it moved to SQLite, once. The old
 * database is left as it was, so nothing is lost if the copy fails half-way: it runs again on the
 * next start, and rows already copied are simply written again.
 */
export const copyLegacyData = async (store: Store, name = 'tracker'): Promise<void> => {
  const done = await store.direct.all('SELECT id FROM meta WHERE id = ?', [COPIED]);
  if (done.length > 0) return;
  if (await Dexie.exists(name)) {
    const old = new TrackerDb(name);
    try {
      await store.transaction(async () => {
        const docs = store.docs;
        const copy = async <T>(table: DocTable<T>, values: readonly T[]) => { for (const v of values) await docs.put(table, v); };
        await copy(Tables.workouts, await old.workouts.toArray());
        await copy(Tables.trainingPlans, await old.trainingPlans.toArray());
        await copy(Tables.dietPlans, await old.dietPlans.toArray());
        await copy(Tables.foodLogDays, await old.foodLogDays.toArray());
        await copy(Tables.customFoods, await old.customFoods.toArray());
        await copy(Tables.favoriteFoods, (await old.favoriteFoods.toArray()).map(({ food, addedAt }) => ({ food, addedAt })));
        await copy(Tables.weightEntries, await old.weightEntries.toArray());
        const profile = await old.profile.get('me');
        if (profile) {
          const { key: _key, ...rest } = profile;
          await docs.put(Tables.profile, rest);
        }
        await copy(Tables.savedProducts, await old.savedProducts.toArray());
        await copy(Tables.progress, await old.records.toArray());
        await copy(Tables.customExercises, await old.customExercises.toArray());
      });
    } finally {
      old.close();
    }
  }
  await store.direct.run('INSERT OR REPLACE INTO meta (id, data, updated_at) VALUES (?, ?, ?)', [COPIED, '{}', Date.now()]);
};
