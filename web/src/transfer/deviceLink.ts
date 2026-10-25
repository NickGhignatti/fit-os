import { parseBackup, type Backup } from '../data/backup';
import { formatCode, generateCode, normalizeCode } from './code';
import { deriveKeys, open, seal } from './crypto';

/**
 * "Add a device": everything on this device, encrypted with a one-time code and parked on the
 * server for the other device of the same account to take. See
 * supabase/migrations/20261025000000_device_links.sql for the server side.
 */
export interface DeviceLinkGateway {
  /** Stores one part; part 0 starts the link. Returns when the link expires. */
  put(id: string, part: number, parts: number, payload: string): Promise<Date>;
  /** One part of a live link of the signed-in account, or null (wrong code or account, expired, or finished). */
  take(id: string, part: number): Promise<{ parts: number; payload: string } | null>;
  /** Deletes the link once it has been taken. */
  finish(id: string): Promise<void>;
}

/** The most characters of ciphertext in one server row (the database allows 500 000). */
export const PART_SIZE = 400_000;
export const MAX_PARTS = 40;

export interface StartedLink {
  /** Display form, "XXXXX-XXXXX". */
  readonly code: string;
  /** What the QR holds: opening it on the other phone goes straight to "Add this device". */
  readonly url: string;
  readonly expiresAt: Date;
}

/** Where a code arrives in the app; the code travels after "#", so it never reaches any server. */
export const linkUrl = (origin: string, code: string): string => `${origin}/link#${formatCode(code)}`;

/** The code inside a scanned QR or a pasted link, or what was typed. */
export const codeFromText = (text: string): string | null => normalizeCode(text.includes('#') ? text.slice(text.lastIndexOf('#') + 1) : text);

export class LinkTooLargeError extends Error {}

/** Encrypts [backup] and uploads it; [onProgress] hears the parts sent so far. */
export const startLink = async (
  gateway: DeviceLinkGateway,
  backup: Backup,
  origin: string,
  { partSize = PART_SIZE, onProgress = () => {} }: { partSize?: number; onProgress?: (sent: number, parts: number) => void } = {},
): Promise<StartedLink> => {
  const code = generateCode();
  const { id, key } = await deriveKeys(code);
  const sealed = await seal(JSON.stringify(backup), key);
  const parts = Math.max(1, Math.ceil(sealed.length / partSize));
  if (parts > MAX_PARTS) throw new LinkTooLargeError(`${parts} parts`);
  let expiresAt = new Date();
  for (let part = 0; part < parts; part++) {
    expiresAt = await gateway.put(id, part, parts, sealed.slice(part * partSize, (part + 1) * partSize));
    onProgress(part + 1, parts);
  }
  return { code: formatCode(code), url: linkUrl(origin, code), expiresAt };
};

export type TakeResult =
  | { readonly status: 'ok'; readonly backup: Backup }
  | { readonly status: 'invalid_code' }
  /** Nothing for this account under this code: wrong code or account, expired, or already taken. */
  | { readonly status: 'not_found' }
  /** Found but not readable: damaged, or from an incompatible version of the app. */
  | { readonly status: 'unreadable' };

/** Downloads, decrypts and checks the data behind [input], then deletes it from the server. */
export const takeLink = async (gateway: DeviceLinkGateway, input: string): Promise<TakeResult> => {
  const code = codeFromText(input);
  if (code === null) return { status: 'invalid_code' };
  const { id, key } = await deriveKeys(code);
  const first = await gateway.take(id, 0);
  if (!first) return { status: 'not_found' };
  const chunks = [first.payload];
  for (let part = 1; part < first.parts; part++) {
    const next = await gateway.take(id, part);
    if (!next) return { status: 'not_found' };
    chunks.push(next.payload);
  }
  const text = await open(chunks.join(''), key);
  const parsed = text === null ? null : parseBackup(text);
  if (!parsed?.ok) return { status: 'unreadable' };
  await gateway.finish(id);
  return { status: 'ok', backup: parsed.backup };
};

export class DeviceLinkError extends Error {}

/** The signed-in user's token, or null. */
export type AccessToken = () => Promise<string | null>;

/** Talks to the device_links functions over PostgREST, as the signed-in user. Plain fetch: no SDK. */
export class SupabaseDeviceLinks implements DeviceLinkGateway {
  constructor(
    private readonly url: string,
    private readonly key: string,
    private readonly token: AccessToken,
    private readonly fetchImpl: typeof fetch = (...args) => fetch(...args),
  ) {}

  async put(id: string, part: number, parts: number, payload: string): Promise<Date> {
    return new Date(await this.rpc<string>('put_device_link', { p_id: id, p_part: part, p_parts: parts, p_payload: payload }));
  }

  async take(id: string, part: number): Promise<{ parts: number; payload: string } | null> {
    const rows = await this.rpc<{ parts: number; payload: string }[]>('take_device_link', { p_id: id, p_part: part });
    return rows[0] ?? null;
  }

  async finish(id: string): Promise<void> {
    await this.rpc<null>('finish_device_link', { p_id: id });
  }

  private async rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
    const token = await this.token();
    if (!token) throw new DeviceLinkError('not signed in');
    const response = await this.fetchImpl(`${this.url}/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', apikey: this.key, authorization: `Bearer ${token}` },
      body: JSON.stringify(args),
    });
    if (!response.ok) throw new DeviceLinkError(`${name} failed: ${response.status} ${await response.text()}`);
    const text = await response.text();
    return (text ? JSON.parse(text) : null) as T;
  }
}

/**
 * The server in memory, with its rules: rows belong to the account that wrote them, a new link
 * replaces the account's earlier one, and links expire after 30 minutes. For tests and development.
 */
export class InMemoryDeviceLinks implements DeviceLinkGateway {
  constructor(
    private readonly owner: () => string | null,
    private readonly now: () => number = Date.now,
    private readonly rows = new Map<string, { owner: string; parts: number; payload: string; expiresAt: number }>(),
  ) {}

  /** The same server, as seen by another device: [owner] tells who is signed in there. */
  forOwner(owner: () => string | null): InMemoryDeviceLinks {
    return new InMemoryDeviceLinks(owner, this.now, this.rows);
  }

  async put(id: string, part: number, parts: number, payload: string): Promise<Date> {
    const me = this.signedIn();
    this.purge();
    let expiresAt = this.now() + 30 * 60_000;
    if (part === 0) {
      for (const [k, row] of this.rows) if (row.owner === me) this.rows.delete(k);
    } else {
      const first = this.rows.get(`${id}/0`);
      if (!first || first.owner !== me || first.parts !== parts) throw new DeviceLinkError('link not started');
      expiresAt = first.expiresAt;
    }
    this.rows.set(`${id}/${part}`, { owner: me, parts, payload, expiresAt });
    return new Date(expiresAt);
  }

  async take(id: string, part: number): Promise<{ parts: number; payload: string } | null> {
    const me = this.signedIn();
    this.purge();
    const row = this.rows.get(`${id}/${part}`);
    return row && row.owner === me ? { parts: row.parts, payload: row.payload } : null;
  }

  async finish(id: string): Promise<void> {
    const me = this.signedIn();
    for (const [k, row] of this.rows) if (k.startsWith(`${id}/`) && row.owner === me) this.rows.delete(k);
  }

  get size(): number {
    this.purge();
    return this.rows.size;
  }

  private signedIn(): string {
    const me = this.owner();
    if (!me) throw new DeviceLinkError('not signed in');
    return me;
  }

  private purge(): void {
    for (const [k, row] of this.rows) if (row.expiresAt <= this.now()) this.rows.delete(k);
  }
}
