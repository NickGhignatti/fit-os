import { PowerSyncDatabase } from '@powersync/node';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach } from 'vitest';
import { AppSchema } from './schema';
import { Store } from './store';

const open: { store: Store; dir: string }[] = [];

/**
 * A real SQLite database for a test, in a folder of its own: the same engine the app runs in the
 * browser, through PowerSync's Node SDK. Pass the [dir] of an earlier one to open that device
 * again, as a new session would. Every store is closed after the test.
 */
export const testStore = (dir = mkdtempSync(join(tmpdir(), 'fit-os-'))): Store & { readonly dir: string } => {
  const store = new Store(new PowerSyncDatabase({ schema: AppSchema, database: { dbFilename: 'test.sqlite', dbLocation: dir } }));
  open.push({ store, dir });
  return Object.assign(store, { dir });
};

afterEach(async () => {
  const closing = open.splice(0);
  await Promise.all(closing.map(({ store }) => store.close()));
  for (const dir of new Set(closing.map((c) => c.dir))) rmSync(dir, { recursive: true, force: true });
});
