import {
  PAGE_SIZE,
  type CommunityRepository,
  type PlanKind,
  type PlanQuery,
  type PublicPlan,
  type PublicPlanSummary,
  type PublishResult,
} from './ports';

export interface SessionInfo {
  readonly accessToken: string;
  readonly userId: string;
}

/** The signed-in user, or null. Supplied by the auth side so this file never touches tokens' storage. */
export type SessionProvider = () => Promise<SessionInfo | null>;

interface Row {
  id: string;
  owner_id: string;
  kind: PlanKind;
  title: string;
  description: string;
  hidden: boolean;
  created_at: string;
  payload?: unknown;
  profiles: { handle: string; display_name: string } | null;
}

const SUMMARY_COLUMNS = 'id,owner_id,kind,title,description,hidden,created_at,profiles(handle,display_name)';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Characters that mean something inside a PostgREST filter value. */
const sanitizeSearch = (text: string): string => text.replace(/[*%,()"\\:]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);

/** Talks to the community tables of supabase/migrations over PostgREST. Plain fetch: no SDK. */
export class RestCommunity implements CommunityRepository {
  constructor(
    private readonly url: string,
    private readonly key: string,
    private readonly session: SessionProvider,
    private readonly fetchImpl: typeof fetch = (...args) => fetch(...args),
  ) {}

  async list({ kind, search, before }: PlanQuery): Promise<readonly PublicPlanSummary[]> {
    const params = new URLSearchParams({
      select: SUMMARY_COLUMNS, kind: `eq.${kind}`, hidden: 'eq.false', order: 'created_at.desc', limit: String(PAGE_SIZE),
    });
    const term = sanitizeSearch(search);
    if (term) params.set('title', `ilike.*${term}*`);
    if (before) params.set('created_at', `lt.${before}`);
    const rows = await this.rows('public_plans', params);
    return rows.map((r) => this.summary(r, null));
  }

  async get(id: string): Promise<PublicPlan | null> {
    if (!UUID.test(id)) return null;
    const me = await this.session();
    const rows = await this.rows('public_plans', new URLSearchParams({ select: `${SUMMARY_COLUMNS},payload`, id: `eq.${id}`, limit: '1' }));
    const row = rows[0];
    return row ? { ...this.summary(row, me?.userId ?? null), payload: row.payload } : null;
  }

  async mine(): Promise<readonly PublicPlanSummary[]> {
    const me = await this.session();
    if (!me) return [];
    const rows = await this.rows('public_plans', new URLSearchParams({ select: SUMMARY_COLUMNS, owner_id: `eq.${me.userId}`, order: 'created_at.desc' }));
    return rows.map((r) => this.summary(r, me.userId));
  }

  async publish(plan: { kind: PlanKind; title: string; description: string; payload: unknown }): Promise<PublishResult> {
    const me = await this.session();
    if (!me) return { status: 'signedOut' };
    try {
      const response = await this.send('POST', 'public_plans', undefined, { owner_id: me.userId, ...plan }, me, { Prefer: 'return=representation' });
      if (response.ok) return { status: 'ok', id: ((await response.json()) as Row[])[0]!.id };
      const text = await response.text();
      if (response.status === 401 || response.status === 403) return { status: 'signedOut' };
      if (/at most 30/.test(text)) return { status: 'limit' };
      if (/too fast/.test(text)) return { status: 'tooFast' };
      return { status: 'failed' };
    } catch {
      return { status: 'failed' };
    }
  }

  async unpublish(id: string): Promise<boolean> {
    const me = await this.session();
    if (!me || !UUID.test(id)) return false;
    try {
      const response = await this.send('DELETE', 'public_plans', new URLSearchParams({ id: `eq.${id}`, owner_id: `eq.${me.userId}` }), undefined, me);
      return response.ok;
    } catch {
      return false;
    }
  }

  async report(id: string, reason: string): Promise<'ok' | 'already' | 'signedOut' | 'failed'> {
    const me = await this.session();
    if (!me) return 'signedOut';
    if (!UUID.test(id)) return 'failed';
    try {
      const response = await this.send('POST', 'plan_reports', undefined, { plan_id: id, reporter_id: me.userId, reason }, me);
      if (response.ok) return 'ok';
      if (response.status === 409) return 'already';
      return response.status === 401 || response.status === 403 ? 'signedOut' : 'failed';
    } catch {
      return 'failed';
    }
  }

  private summary(row: Row, userId: string | null): PublicPlanSummary {
    return {
      id: row.id,
      kind: row.kind,
      title: row.title,
      description: row.description,
      authorHandle: row.profiles?.handle ?? 'unknown',
      authorName: row.profiles?.display_name ?? '',
      createdAt: row.created_at,
      hidden: row.hidden,
      mine: userId !== null && row.owner_id === userId,
    };
  }

  private async rows(table: string, params: URLSearchParams): Promise<Row[]> {
    const response = await this.send('GET', table, params, undefined, await this.session());
    if (!response.ok) throw new Error(`${table}: ${response.status}`);
    return (await response.json()) as Row[];
  }

  private send(
    method: string,
    table: string,
    params: URLSearchParams | undefined,
    body: unknown,
    me: SessionInfo | null,
    extra: Record<string, string> = {},
  ): Promise<Response> {
    const headers: Record<string, string> = { apikey: this.key, ...extra };
    // A publishable key ("sb_publishable_…") is not a JWT and must not be sent as a bearer token.
    if (me) headers.authorization = `Bearer ${me.accessToken}`;
    else if (this.key.startsWith('eyJ')) headers.authorization = `Bearer ${this.key}`;
    if (body !== undefined) headers['content-type'] = 'application/json';
    const query = params ? `?${params.toString()}` : '';
    return this.fetchImpl(`${this.url}/rest/v1/${table}${query}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  }
}
