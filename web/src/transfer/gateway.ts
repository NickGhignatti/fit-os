/** Where encrypted transfers are parked between two devices. It only ever sees opaque text. */
export interface TransferGateway {
  /** Stores [payload] under [id]; returns when it expires. */
  put(id: string, payload: string, ttlMinutes: number): Promise<Date>;

  /** The payload under [id], or null if there is none (never stored, expired, or already taken). */
  take(id: string, consume: boolean): Promise<string | null>;
}

export class TransferError extends Error {}

/** Talks to the put_transfer / take_transfer functions of supabase/migrations. Plain fetch: no SDK. */
export class SupabaseTransferGateway implements TransferGateway {
  constructor(
    private readonly url: string,
    private readonly anonKey: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async put(id: string, payload: string, ttlMinutes: number): Promise<Date> {
    const expiresAt = await this.rpc<string>('put_transfer', { p_id: id, p_payload: payload, p_ttl_minutes: ttlMinutes });
    return new Date(expiresAt);
  }

  async take(id: string, consume: boolean): Promise<string | null> {
    return this.rpc<string | null>('take_transfer', { p_id: id, p_consume: consume });
  }

  /**
   * Publishable keys ("sb_publishable_…") go in `apikey` alone; the older anon key is a JWT and
   * is also sent as the bearer token. Sending a non-JWT bearer would be rejected.
   */
  private headers(): Record<string, string> {
    const headers: Record<string, string> = { 'content-type': 'application/json', apikey: this.anonKey };
    if (this.anonKey.startsWith('eyJ')) headers.authorization = `Bearer ${this.anonKey}`;
    return headers;
  }

  private async rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
    const response = await this.fetchImpl(`${this.url}/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(args),
    });
    if (!response.ok) throw new TransferError(`${name} failed: ${response.status} ${await response.text()}`);
    return (await response.json()) as T;
  }
}

/** A gateway that keeps everything in memory, with the server's semantics; for tests and offline development. */
export class InMemoryTransferGateway implements TransferGateway {
  private readonly rows = new Map<string, { payload: string; expiresAt: number }>();

  constructor(private readonly now: () => number = Date.now) {}

  async put(id: string, payload: string, ttlMinutes: number): Promise<Date> {
    this.purge();
    if (this.rows.has(id)) throw new TransferError('duplicate id');
    const clamped = Math.max(5, Math.min(ttlMinutes, 1440));
    const expiresAt = this.now() + clamped * 60_000;
    this.rows.set(id, { payload, expiresAt });
    return new Date(expiresAt);
  }

  async take(id: string, consume: boolean): Promise<string | null> {
    this.purge();
    const row = this.rows.get(id);
    if (!row) return null;
    if (consume) this.rows.delete(id);
    return row.payload;
  }

  get size(): number {
    this.purge();
    return this.rows.size;
  }

  private purge(): void {
    for (const [id, row] of this.rows) if (row.expiresAt <= this.now()) this.rows.delete(id);
  }
}
