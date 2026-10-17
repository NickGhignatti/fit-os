import { describe, expect, it } from 'vitest';
import { RestCommunity, type SessionInfo } from './rest';

const ME: SessionInfo = { accessToken: 'jwt-token', userId: '11111111-1111-4111-8111-111111111111' };
const PLAN_ID = '22222222-2222-4222-8222-222222222222';

interface Call { url: URL; init: RequestInit; headers: Record<string, string>; body: unknown }

/** A repository wired to a fake server that answers with [respond] and records every request. */
const setup = (respond: (call: Call) => Response, session: SessionInfo | null = ME, key = 'sb_publishable_key') => {
  const calls: Call[] = [];
  const fetchImpl = (async (input: string, init: RequestInit) => {
    const call = { url: new URL(input), init, headers: init.headers as Record<string, string>, body: init.body ? JSON.parse(init.body as string) : undefined };
    calls.push(call);
    return respond(call);
  }) as unknown as typeof fetch;
  return { repo: new RestCommunity('https://x.supabase.co', key, async () => session, fetchImpl), calls };
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

const row = (over: Record<string, unknown> = {}) => ({
  id: PLAN_ID, owner_id: ME.userId, kind: 'training', title: 'Push day', description: 'Chest and triceps',
  hidden: false, created_at: '2026-10-18T10:00:00.123456+00:00', profiles: { handle: 'alice_fit', display_name: 'Alice' }, ...over,
});

describe('browsing', () => {
  it('lists visible plans of a kind, newest first, with the author as a handle only', async () => {
    const { repo, calls } = setup(() => json([row({ owner_id: 'someone-else' })]), null);
    const plans = await repo.list({ kind: 'training', search: '' });

    expect(plans).toEqual([{
      id: PLAN_ID, kind: 'training', title: 'Push day', description: 'Chest and triceps', authorHandle: 'alice_fit',
      authorName: 'Alice', createdAt: '2026-10-18T10:00:00.123456+00:00', hidden: false, mine: false,
    }]);
    const url = calls[0]!.url;
    expect(url.pathname).toBe('/rest/v1/public_plans');
    expect(url.searchParams.get('kind')).toBe('eq.training');
    expect(url.searchParams.get('hidden')).toBe('eq.false');
    expect(url.searchParams.get('order')).toBe('created_at.desc');
    expect(url.searchParams.get('limit')).toBe('20');
    expect(url.searchParams.get('select')).toContain('profiles(handle,display_name)');
    expect(url.searchParams.get('select')).not.toContain('payload'); // lists stay light
  });

  it('works without an account and never sends a publishable key as a bearer token', async () => {
    const { repo, calls } = setup(() => json([]), null, 'sb_publishable_key');
    await repo.list({ kind: 'diet', search: '' });
    expect(calls[0]!.headers).toEqual({ apikey: 'sb_publishable_key' });
  });

  it('sends the user token when signed in, and a legacy anon JWT as bearer when anonymous', async () => {
    const signedIn = setup(() => json([]));
    await signedIn.repo.list({ kind: 'diet', search: '' });
    expect(signedIn.calls[0]!.headers.authorization).toBe('Bearer jwt-token');

    const legacy = setup(() => json([]), null, 'eyJhbGciOi.payload.sig');
    await legacy.repo.list({ kind: 'diet', search: '' });
    expect(legacy.calls[0]!.headers.authorization).toBe('Bearer eyJhbGciOi.payload.sig');
  });

  it('searches titles and pages by the last date seen', async () => {
    const { repo, calls } = setup(() => json([]), null);
    await repo.list({ kind: 'training', search: 'push', before: '2026-10-18T10:00:00.123456+00:00' });
    expect(calls[0]!.url.searchParams.get('title')).toBe('ilike.*push*');
    expect(calls[0]!.url.searchParams.get('created_at')).toBe('lt.2026-10-18T10:00:00.123456+00:00');
  });

  it('neutralises characters that would change the meaning of a filter', async () => {
    const { repo, calls } = setup(() => json([]), null);
    await repo.list({ kind: 'training', search: 'a*,or=(b)"c\\d:e%' });
    expect(calls[0]!.url.searchParams.get('title')).toBe('ilike.*a or= b c d e*');
    await repo.list({ kind: 'training', search: '*,()' });
    expect(calls[1]!.url.searchParams.has('title')).toBe(false); // nothing left to search for
  });

  it('reads one plan with its content and knows which are mine', async () => {
    const { repo, calls } = setup(() => json([{ ...row(), payload: { name: 'Push' } }]));
    const plan = await repo.get(PLAN_ID);
    expect(plan).toMatchObject({ id: PLAN_ID, mine: true, payload: { name: 'Push' } });
    expect(calls[0]!.url.searchParams.get('id')).toBe(`eq.${PLAN_ID}`);
    expect(calls[0]!.url.searchParams.get('select')).toContain('payload');
  });

  it('returns null for a missing plan, and does not even ask for a malformed id', async () => {
    const { repo, calls } = setup(() => json([]));
    expect(await repo.get(PLAN_ID)).toBeNull();
    expect(await repo.get('not-a-uuid&select=*')).toBeNull();
    expect(calls).toHaveLength(1);
  });

  it('turns a server error into an exception the screen can show', async () => {
    const { repo } = setup(() => new Response('boom', { status: 500 }), null);
    await expect(repo.list({ kind: 'training', search: '' })).rejects.toThrow(/500/);
  });

  it('lists my own plans, hidden ones included, only when signed in', async () => {
    const mine = setup(() => json([row({ hidden: true })]));
    const plans = await mine.repo.mine();
    expect(plans[0]).toMatchObject({ hidden: true, mine: true });
    expect(mine.calls[0]!.url.searchParams.get('owner_id')).toBe(`eq.${ME.userId}`);
    expect(mine.calls[0]!.url.searchParams.has('hidden')).toBe(false);

    const anonymous = setup(() => json([]), null);
    expect(await anonymous.repo.mine()).toEqual([]);
    expect(anonymous.calls).toHaveLength(0);
  });
});

describe('publishing', () => {
  const plan = { kind: 'training' as const, title: 'Push day', description: '', payload: { name: 'Push' } };

  it('posts the plan as the signed-in user', async () => {
    const { repo, calls } = setup(() => json([{ id: PLAN_ID }], 201));
    expect(await repo.publish(plan)).toEqual({ status: 'ok', id: PLAN_ID });
    expect(calls[0]!.init.method).toBe('POST');
    expect(calls[0]!.body).toEqual({ owner_id: ME.userId, ...plan });
    expect(calls[0]!.headers.Prefer).toBe('return=representation');
  });

  it('refuses without an account, without calling the server', async () => {
    const { repo, calls } = setup(() => json([]), null);
    expect(await repo.publish(plan)).toEqual({ status: 'signedOut' });
    expect(calls).toHaveLength(0);
  });

  it('tells the limits apart', async () => {
    const limit = setup(() => json({ code: '23514', message: 'You can publish at most 30 plans. Remove one first.' }, 400));
    expect(await limit.repo.publish(plan)).toEqual({ status: 'limit' });
    const fast = setup(() => json({ code: '23514', message: 'You are publishing too fast. Try again in a while.' }, 400));
    expect(await fast.repo.publish(plan)).toEqual({ status: 'tooFast' });
    const expired = setup(() => json({ message: 'JWT expired' }, 401));
    expect(await expired.repo.publish(plan)).toEqual({ status: 'signedOut' });
    const other = setup(() => json({ message: 'nope' }, 500));
    expect(await other.repo.publish(plan)).toEqual({ status: 'failed' });
  });

  it('survives the network being down', async () => {
    const down = new RestCommunity('https://x', 'k', async () => ME, (async () => { throw new TypeError('offline'); }) as unknown as typeof fetch);
    expect(await down.publish(plan)).toEqual({ status: 'failed' });
    expect(await down.unpublish(PLAN_ID)).toBe(false);
    expect(await down.report(PLAN_ID, 'spam')).toBe('failed');
  });

  it('removes only my own plan', async () => {
    const { repo, calls } = setup(() => new Response(null, { status: 204 }));
    expect(await repo.unpublish(PLAN_ID)).toBe(true);
    expect(calls[0]!.init.method).toBe('DELETE');
    expect(calls[0]!.url.searchParams.get('id')).toBe(`eq.${PLAN_ID}`);
    expect(calls[0]!.url.searchParams.get('owner_id')).toBe(`eq.${ME.userId}`);
    expect(await repo.unpublish('x')).toBe(false);
  });
});

describe('reporting', () => {
  it('sends a report as the signed-in user', async () => {
    const { repo, calls } = setup(() => new Response(null, { status: 201 }));
    expect(await repo.report(PLAN_ID, 'spam')).toBe('ok');
    expect(calls[0]!.url.pathname).toBe('/rest/v1/plan_reports');
    expect(calls[0]!.body).toEqual({ plan_id: PLAN_ID, reporter_id: ME.userId, reason: 'spam' });
  });

  it('knows when the same person already reported it, and when they must sign in', async () => {
    expect(await setup(() => json({ code: '23505' }, 409)).repo.report(PLAN_ID, 'spam')).toBe('already');
    expect(await setup(() => json({}), null).repo.report(PLAN_ID, 'spam')).toBe('signedOut');
    expect(await setup(() => json({}, 401)).repo.report(PLAN_ID, 'spam')).toBe('signedOut');
    expect(await setup(() => json({}, 500)).repo.report(PLAN_ID, 'spam')).toBe('failed');
  });
});
