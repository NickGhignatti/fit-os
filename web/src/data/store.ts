import type { CommonPowerSyncDatabase, LockContext, Transaction } from '@powersync/common';
import type { Stream } from '../domain/repositories';
import type { DocTable, TableName } from './schema';

/** Something SQL runs on: the database itself, or a transaction open on it. */
type Executor = Pick<LockContext, 'getAll' | 'getOptional' | 'execute'>;

/**
 * Whole aggregates in and out of the tables of [AppSchema]: each row keeps its value as JSON,
 * with the table's searchable columns beside it.
 */
export class Docs {
  constructor(private readonly q: Executor) {}

  all<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    return this.q.getAll<T>(sql, params);
  }

  async run(sql: string, params: unknown[] = []): Promise<void> {
    await this.q.execute(sql, params);
  }

  /** The values of [table], in the order given (by default the id, which is creation order). */
  async list<T>(table: DocTable<T>, where = '', params: unknown[] = [], orderBy = 'id'): Promise<T[]> {
    const rows = await this.q.getAll<{ data: string }>(
      `SELECT data FROM ${table.name}${where ? ` WHERE ${where}` : ''} ORDER BY ${orderBy}`, params);
    return rows.map((r) => JSON.parse(r.data) as T);
  }

  async first<T>(table: DocTable<T>, where: string, params: unknown[] = []): Promise<T | undefined> {
    const row = await this.q.getOptional<{ data: string }>(`SELECT data FROM ${table.name} WHERE ${where} LIMIT 1`, params);
    return row ? (JSON.parse(row.data) as T) : undefined;
  }

  get<T>(table: DocTable<T>, id: string): Promise<T | undefined> {
    return this.first(table, 'id = ?', [id]);
  }

  /** Stores [value], replacing the row with the same id. */
  async put<T>(table: DocTable<T>, value: T, now = Date.now()): Promise<void> {
    const columns = { ...table.columns(value), data: JSON.stringify(value), updated_at: now };
    const names = Object.keys(columns);
    await this.q.execute(
      `INSERT OR REPLACE INTO ${table.name} (id, ${names.join(', ')}) VALUES (?${', ?'.repeat(names.length)})`,
      [table.id(value), ...Object.values(columns)],
    );
  }

  async delete<T>(table: DocTable<T>, id: string): Promise<void> {
    await this.q.execute(`DELETE FROM ${table.name} WHERE id = ?`, [id]);
  }

  async count(table: TableName): Promise<number> {
    return (await this.q.getAll<{ n: number }>(`SELECT count(*) AS n FROM ${table}`))[0]!.n;
  }
}

/**
 * The app's database. Repositories reach it through [docs], which joins the transaction open at
 * the time, if any, so a use case can run several repository calls atomically with [transaction].
 * Watched queries use [direct] instead: they run on their own, never inside someone's transaction.
 */
export class Store {
  private tx: Transaction | null = null;
  readonly direct: Docs;

  constructor(readonly db: CommonPowerSyncDatabase) {
    this.direct = new Docs(db);
  }

  get docs(): Docs {
    return this.tx ? new Docs(this.tx) : this.direct;
  }

  /** Runs [block] atomically: it all happens, or none of it does. Nested calls join the outer one. */
  transaction<R>(block: () => Promise<R>): Promise<R> {
    if (this.tx) return block();
    return this.db.writeTransaction(async (tx) => {
      this.tx = tx;
      try {
        return await block();
      } finally {
        this.tx = null;
      }
    });
  }

  /** A Stream that runs [query] now, and again whenever one of [tables] changes. */
  live<T>(tables: readonly TableName[], query: (docs: Docs) => Promise<T>): Stream<T> {
    return {
      subscribe: (next, error) => {
        let stopped = false;
        let latest = 0;
        const run = () => {
          const call = ++latest;
          query(this.direct).then(
            (value) => { if (!stopped && call === latest) next(value); },
            (cause: unknown) => { if (!stopped) error?.(cause); },
          );
        };
        run();
        const stop = this.db.onChange({ onChange: run }, { tables: [...tables], throttleMs: 0 });
        return () => {
          stopped = true;
          stop();
        };
      },
    };
  }

  close(): Promise<void> {
    return this.db.close();
  }
}
