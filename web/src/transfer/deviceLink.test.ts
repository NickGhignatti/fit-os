import { describe, expect, it } from 'vitest';
import { parseBackup, type Backup } from '../data/backup';
import { InMemoryDeviceLinks, LinkTooLargeError, MAX_PARTS, SupabaseDeviceLinks, codeFromText, startLink, takeLink } from './deviceLink';

const backupOf = (weights: number): Backup => {
  const parsed = parseBackup(JSON.stringify({
    app: 'tracker', v: 1, exportedAt: '2026-10-25T10:00:00.000Z',
    data: {
      trainingPlans: [], dietPlans: [], workouts: [], foodLogDays: [], customFoods: [], favorites: [], profile: null,
      weights: Array.from({ length: weights }, (_, i) => ({ id: `w${i}`, date: `2026-${String(1 + (i % 12)).padStart(2, '0')}-${String(1 + (i % 28)).padStart(2, '0')}`, kg: 70 + (i % 30) / 10 })),
    },
  }));
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed.backup;
};

/** One server, and two devices signed in as [first] and [second]. */
const twoDevices = (first: string | null, second: string | null, now = () => Date.now()) => {
  const server = new InMemoryDeviceLinks(() => null, now);
  return { server, a: server.forOwner(() => first), b: server.forOwner(() => second) };
};

describe('adding a device', () => {
  it('moves everything, in parts, to another device of the same account, then deletes it from the server', async () => {
    const { server, a, b } = twoDevices('nick', 'nick');
    const progress: string[] = [];
    const link = await startLink(a, backupOf(3), 'https://tracker.example', { partSize: 50, onProgress: (s, p) => progress.push(`${s}/${p}`) });

    expect(link.code).toMatch(/^[0-9A-Z]{5}-[0-9A-Z]{5}$/);
    expect(link.url).toBe(`https://tracker.example/link#${link.code}`);
    const parts = server.size;
    expect(parts).toBeGreaterThan(2);
    expect(progress.at(-1)).toBe(`${parts}/${parts}`);

    const taken = await takeLink(b, link.url); // the scanned QR, as is
    expect(taken).toEqual({ status: 'ok', backup: backupOf(3) });
    expect(server.size).toBe(0);
    expect(await takeLink(b, link.code)).toEqual({ status: 'not_found' }); // once only
  });

  it('gives nothing to another account, even with the right code', async () => {
    const { server, a, b } = twoDevices('nick', 'someone_else');
    const link = await startLink(a, backupOf(1), 'https://tracker.example');
    expect(await takeLink(b, link.code)).toEqual({ status: 'not_found' });
    expect(server.size).toBe(1); // still there for the right account
  });

  it('needs the code: the right account with a wrong code finds nothing', async () => {
    const { a, b } = twoDevices('nick', 'nick');
    await startLink(a, backupOf(1), 'https://tracker.example');
    expect(await takeLink(b, 'AAAAA-AAAAA')).toEqual({ status: 'not_found' });
    expect(await takeLink(b, 'not a code')).toEqual({ status: 'invalid_code' });
  });

  it('expires after 30 minutes', async () => {
    let now = Date.UTC(2026, 9, 25, 10);
    const { a, b } = twoDevices('nick', 'nick', () => now);
    const link = await startLink(a, backupOf(1), 'https://tracker.example');
    expect(link.expiresAt.toISOString()).toBe('2026-10-25T10:30:00.000Z');
    now += 30 * 60_000;
    expect(await takeLink(b, link.code)).toEqual({ status: 'not_found' });
  });

  it('keeps only the newest link of an account', async () => {
    const { a, b } = twoDevices('nick', 'nick');
    const old = await startLink(a, backupOf(1), 'https://tracker.example');
    const fresh = await startLink(a, backupOf(2), 'https://tracker.example');
    expect(await takeLink(b, old.code)).toEqual({ status: 'not_found' });
    expect(await takeLink(b, fresh.code)).toMatchObject({ status: 'ok' });
  });

  it('refuses when signed out, and when there is too much to send', async () => {
    const { a } = twoDevices(null, null);
    await expect(startLink(a, backupOf(1), 'https://tracker.example')).rejects.toThrow('not signed in');
    const { a: signedIn } = twoDevices('nick', 'nick');
    await expect(startLink(signedIn, backupOf(400), 'https://tracker.example', { partSize: 10 })).rejects.toBeInstanceOf(LinkTooLargeError);
    expect(MAX_PARTS).toBe(40); // the database allows 40 parts
  });

  it('reads the code from a typed code or from a link', () => {
    expect(codeFromText('k7qm2-x9rta')).toBe('K7QM2X9RTA');
    expect(codeFromText('https://tracker.example/link#K7QM2-X9RTA')).toBe('K7QM2X9RTA');
    expect(codeFromText('https://tracker.example/link#')).toBeNull();
  });
});

describe('the Supabase gateway', () => {
  const setup = (token: string | null, respond: (body: Record<string, unknown>) => Response) => {
    const calls: { url: string; headers: Record<string, string>; body: Record<string, unknown> }[] = [];
    const fetchImpl = (async (url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string) as Record<string, unknown>;
      calls.push({ url, headers: init.headers as Record<string, string>, body });
      return respond(body);
    }) as unknown as typeof fetch;
    return { gateway: new SupabaseDeviceLinks('https://x.supabase.co', 'sb_publishable_key', async () => token, fetchImpl), calls };
  };

  it('calls the database functions as the signed-in user', async () => {
    const { gateway, calls } = setup('user-jwt', () => new Response(JSON.stringify('2026-10-25T10:30:00+00:00')));
    expect((await gateway.put('a'.repeat(64), 0, 2, 'cipher')).toISOString()).toBe('2026-10-25T10:30:00.000Z');
    expect(calls[0]).toEqual({
      url: 'https://x.supabase.co/rest/v1/rpc/put_device_link',
      headers: { 'content-type': 'application/json', apikey: 'sb_publishable_key', authorization: 'Bearer user-jwt' },
      body: { p_id: 'a'.repeat(64), p_part: 0, p_parts: 2, p_payload: 'cipher' },
    });
  });

  it('reads a part, or nothing, and finishes with an empty answer', async () => {
    const rows = setup('user-jwt', (body) => new Response(JSON.stringify(body.p_part === 0 ? [{ parts: 2, payload: 'abc' }] : [])));
    expect(await rows.gateway.take('a'.repeat(64), 0)).toEqual({ parts: 2, payload: 'abc' });
    expect(await rows.gateway.take('a'.repeat(64), 1)).toBeNull();
    const done = setup('user-jwt', () => new Response(null, { status: 204 }));
    await expect(done.gateway.finish('a'.repeat(64))).resolves.toBeUndefined();
    expect(done.calls[0]!.url).toBe('https://x.supabase.co/rest/v1/rpc/finish_device_link');
  });

  it('does not call the server when signed out, and reports server errors', async () => {
    const signedOut = setup(null, () => new Response('[]'));
    await expect(signedOut.gateway.take('a'.repeat(64), 0)).rejects.toThrow('not signed in');
    expect(signedOut.calls).toHaveLength(0);
    const full = setup('user-jwt', () => new Response('{"message":"device link storage is full"}', { status: 400 }));
    await expect(full.gateway.put('a'.repeat(64), 0, 1, 'x')).rejects.toThrow(/storage is full/);
  });
});
