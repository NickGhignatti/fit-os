import { describe, expect, it } from 'vitest';
import { CODE_LENGTH, formatCode, generateCode, normalizeCode } from './code';
import { deriveKeys, open, seal } from './crypto';
import { InMemoryTransferGateway, SupabaseTransferGateway, TransferError } from './gateway';
import { receiveTransfer, sendTransfer } from './transfer';

const plan = { name: 'Strength', sessions: { 1: [{ name: 'Squat', sets: [{ reps: 5, weight: 100 }] }] } };

describe('codes', () => {
  it('generates canonical codes that survive formatting and normalising', () => {
    const code = generateCode();
    expect(code).toHaveLength(CODE_LENGTH);
    expect(normalizeCode(formatCode(code))).toBe(code);
    expect(new Set(Array.from({ length: 50 }, generateCode)).size).toBe(50);
  });

  it('forgives case, spaces, dashes and look-alikes', () => {
    expect(normalizeCode(' k7qm2-x9rta ')).toBe('K7QM2X9RTA');
    expect(normalizeCode('OIL00-OIL00')).toBe('0110001100');
  });

  it('rejects anything that cannot be a code', () => {
    expect(normalizeCode('')).toBeNull();
    expect(normalizeCode('K7QM2')).toBeNull();
    expect(normalizeCode('K7QM2-X9RTAA')).toBeNull();
    expect(normalizeCode('K7QM2-X9RT!')).toBeNull();
    expect(normalizeCode('UUUUU-UUUUU')).toBeNull(); // U is not in the alphabet
  });
});

describe('crypto', () => {
  it('derives a stable 64-hex id per code, different for different codes', async () => {
    const a = await deriveKeys('K7QM2X9RTA');
    expect(a.id).toMatch(/^[0-9a-f]{64}$/);
    expect((await deriveKeys('K7QM2X9RTA')).id).toBe(a.id);
    expect((await deriveKeys('K7QM2X9RTB')).id).not.toBe(a.id);
  });

  it('round-trips text, and the id does not reveal the key', async () => {
    const { key } = await deriveKeys('K7QM2X9RTA');
    const sealed = await seal('héllo wörld '.repeat(50), key);
    expect(sealed).not.toContain('llo');
    expect(await open(sealed, key)).toBe('héllo wörld '.repeat(50));
  });

  it('refuses a wrong key and tampered data', async () => {
    const { key } = await deriveKeys('K7QM2X9RTA');
    const other = await deriveKeys('K7QM2X9RTB');
    const sealed = await seal('secret', key);
    expect(await open(sealed, other.key)).toBeNull();
    const flipped = sealed.slice(0, -4) + (sealed.endsWith('AAAA') ? 'BBBB' : 'AAAA');
    expect(await open(flipped, key)).toBeNull();
    expect(await open('not base64 !!', key)).toBeNull();
  });
});

describe('send and receive', () => {
  it('moves an item to another device and then deletes it from the server', async () => {
    const server = new InMemoryTransferGateway();
    const sent = await sendTransfer(server, 'training_plan', plan);
    expect(sent.code).toMatch(/^[0-9A-Z]{5}-[0-9A-Z]{5}$/);
    expect(server.size).toBe(1);

    const received = await receiveTransfer(server, sent.code.toLowerCase());
    expect(received).toMatchObject({ status: 'ok', envelope: { v: 1, kind: 'training_plan', data: plan } });
    expect(server.size).toBe(0);
  });

  it('is single use', async () => {
    const server = new InMemoryTransferGateway();
    const { code } = await sendTransfer(server, 'workout', { title: 'Push' });
    expect((await receiveTransfer(server, code)).status).toBe('ok');
    expect((await receiveTransfer(server, code)).status).toBe('not_found');
  });

  it('expires', async () => {
    let now = 0;
    const server = new InMemoryTransferGateway(() => now);
    const { code, expiresAt } = await sendTransfer(server, 'diet_plan', {}, { ttlMinutes: 10 });
    expect(expiresAt.getTime()).toBe(10 * 60_000);
    now = 10 * 60_000;
    expect((await receiveTransfer(server, code)).status).toBe('not_found');
    expect(server.size).toBe(0);
  });

  it('clamps the lifetime to 5 minutes..24 hours', async () => {
    const server = new InMemoryTransferGateway(() => 0);
    expect((await sendTransfer(server, 'workout', {}, { ttlMinutes: 1 })).expiresAt.getTime()).toBe(5 * 60_000);
    expect((await sendTransfer(server, 'workout', {}, { ttlMinutes: 99_999 })).expiresAt.getTime()).toBe(1440 * 60_000);
  });

  it('reports bad and unknown codes without touching the server', async () => {
    const server = new InMemoryTransferGateway();
    expect((await receiveTransfer(server, 'nope')).status).toBe('invalid_code');
    expect((await receiveTransfer(server, 'K7QM2-X9RTA')).status).toBe('not_found');
  });

  it('never stores anything readable on the server', async () => {
    const stored: string[] = [];
    const spy = new InMemoryTransferGateway();
    const original = spy.put.bind(spy);
    spy.put = async (id, payload, ttl) => {
      stored.push(id, payload);
      return original(id, payload, ttl);
    };
    const { code } = await sendTransfer(spy, 'training_plan', plan);
    const joined = stored.join(' ');
    expect(joined).not.toContain('Strength');
    expect(joined).not.toContain(code.replace('-', ''));
  });

  it('flags a payload it cannot understand as unreadable', async () => {
    const server = new InMemoryTransferGateway();
    const { id, key } = await deriveKeys('K7QM2X9RTA');
    await server.put(id, await seal('{"v":99,"kind":"workout","sentAt":"x"}', key), 60);
    expect((await receiveTransfer(server, 'K7QM2-X9RTA')).status).toBe('unreadable');
  });
});

describe('SupabaseTransferGateway', () => {
  const respond = (status: number, body: unknown) => async () => new Response(JSON.stringify(body), { status });

  it('calls the RPCs with the anon key', async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fake = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(JSON.stringify('2026-10-17T12:00:00+00:00'), { status: 200 });
    }) as unknown as typeof fetch;
    const gateway = new SupabaseTransferGateway('https://x.supabase.co', 'anon-key', fake);

    const expiresAt = await gateway.put('a'.repeat(64), 'cipher', 60);
    expect(expiresAt.toISOString()).toBe('2026-10-17T12:00:00.000Z');
    expect(calls[0]?.url).toBe('https://x.supabase.co/rest/v1/rpc/put_transfer');
    expect(calls[0]?.init.headers).toMatchObject({ apikey: 'anon-key' });
    expect(JSON.parse(calls[0]?.init.body as string)).toEqual({ p_id: 'a'.repeat(64), p_payload: 'cipher', p_ttl_minutes: 60 });
  });

  it('sends a publishable key as apikey only, and a legacy JWT key also as bearer', async () => {
    const seen: Record<string, string>[] = [];
    const fake = (async (_url: string, init: RequestInit) => {
      seen.push(init.headers as Record<string, string>);
      return new Response('null', { status: 200 });
    }) as unknown as typeof fetch;

    await new SupabaseTransferGateway('https://x', 'sb_publishable_abc', fake).take('a'.repeat(64), true);
    await new SupabaseTransferGateway('https://x', 'eyJhbGciOi.payload.sig', fake).take('a'.repeat(64), true);

    expect(seen[0]).toEqual({ 'content-type': 'application/json', apikey: 'sb_publishable_abc' });
    expect(seen[1]).toMatchObject({ apikey: 'eyJhbGciOi.payload.sig', authorization: 'Bearer eyJhbGciOi.payload.sig' });
  });

  it('returns null for a missing transfer and throws on server errors', async () => {
    const missing = new SupabaseTransferGateway('https://x', 'k', respond(200, null) as unknown as typeof fetch);
    expect(await missing.take('a'.repeat(64), true)).toBeNull();
    const failing = new SupabaseTransferGateway('https://x', 'k', respond(400, { message: 'full' }) as unknown as typeof fetch);
    await expect(failing.put('a'.repeat(64), 'c', 60)).rejects.toBeInstanceOf(TransferError);
  });
});
