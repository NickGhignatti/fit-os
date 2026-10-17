import type { GoTrueClient, Session } from '@supabase/auth-js';
import type { Stream } from '../domain/repositories';
import type { Account, AuthGateway, AuthState, Community, ProfileEdit } from './ports';
import { RestCommunity, type SessionInfo } from './rest';

const HANDLE = /^[a-z0-9_]{3,24}$/;
const MAX_NAME = 40;

/**
 * Google sign-in through Supabase Auth (PKCE). The auth library is loaded on first use, so
 * visitors who never sign in never download it. Tokens live in the browser's local storage.
 */
export class SupabaseAuth implements AuthGateway {
  private readonly listeners = new Set<(state: AuthState) => void>();
  private state: AuthState = { status: 'loading' };
  private starting: Promise<GoTrueClient> | undefined;

  constructor(
    private readonly url: string,
    private readonly key: string,
    private readonly fetchImpl: typeof fetch = (...args) => fetch(...args),
    private readonly redirectTo: () => string = () => `${window.location.origin}/profile`,
  ) {}

  observe(): Stream<AuthState> {
    return {
      subscribe: (next, error) => {
        this.listeners.add(next);
        next(this.state);
        this.client().catch((cause: unknown) => {
          this.emit({ status: 'signedOut' });
          error?.(cause);
        });
        return () => void this.listeners.delete(next);
      },
    };
  }

  async session(): Promise<SessionInfo | null> {
    const { data } = await (await this.client()).getSession();
    return data.session ? { accessToken: data.session.access_token, userId: data.session.user.id } : null;
  }

  async signInWithGoogle(): Promise<void> {
    const client = await this.client();
    await client.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: this.redirectTo(), queryParams: { prompt: 'select_account' } },
    });
  }

  async signOut(): Promise<void> {
    const client = await this.client();
    await client.signOut({ scope: 'local' });
    this.emit({ status: 'signedOut' });
  }

  async updateProfile(handle: string, displayName: string): Promise<ProfileEdit> {
    const name = displayName.trim();
    if (!HANDLE.test(handle) || name.length > MAX_NAME) return { status: 'invalid' };
    const me = await this.session();
    if (!me) return { status: 'failed' };
    try {
      const response = await this.fetchImpl(`${this.url}/rest/v1/profiles?id=eq.${me.userId}`, {
        method: 'PATCH',
        headers: this.headers(me),
        body: JSON.stringify({ handle, display_name: name }),
      });
      if (response.status === 409) return { status: 'taken' };
      if (response.status === 400) return { status: 'invalid' };
      if (!response.ok) return { status: 'failed' };
      this.emit({ status: 'signedIn', account: { id: me.userId, handle, displayName: name } });
      return { status: 'ok' };
    } catch {
      return { status: 'failed' };
    }
  }

  async deleteAccount(): Promise<'ok' | 'failed'> {
    const me = await this.session();
    if (!me) return 'failed';
    try {
      const response = await this.fetchImpl(`${this.url}/rest/v1/rpc/delete_my_account`, {
        method: 'POST',
        headers: this.headers(me),
        body: '{}',
      });
      if (!response.ok) return 'failed';
    } catch {
      return 'failed';
    }
    // The user no longer exists server-side; clear the local session without needing the server.
    await (await this.client()).signOut({ scope: 'local' }).catch(() => undefined);
    this.emit({ status: 'signedOut' });
    return 'ok';
  }

  private headers(me: SessionInfo): Record<string, string> {
    return { apikey: this.key, authorization: `Bearer ${me.accessToken}`, 'content-type': 'application/json', Prefer: 'return=minimal' };
  }

  private client(): Promise<GoTrueClient> {
    return (this.starting ??= this.start().catch((cause: unknown) => {
      this.starting = undefined; // allow a retry after a failed load
      throw cause;
    }));
  }

  private async start(): Promise<GoTrueClient> {
    const { GoTrueClient: Client } = await import('@supabase/auth-js');
    const client = new Client({
      url: `${this.url}/auth/v1`,
      headers: { apikey: this.key },
      storageKey: 'tracker-auth',
      flowType: 'pkce',
      detectSessionInUrl: true,
      autoRefreshToken: true,
      persistSession: true,
      fetch: this.fetchImpl,
    });
    // Do not call back into the auth client from inside this listener: it would deadlock.
    client.onAuthStateChange((_event, session) => void setTimeout(() => void this.settle(session), 0));
    const { data } = await client.getSession();
    await this.settle(data.session);
    return client;
  }

  private async settle(session: Session | null): Promise<void> {
    if (!session) return this.emit({ status: 'signedOut' });
    const previous = this.state.status === 'signedIn' && this.state.account.id === session.user.id ? this.state.account : null;
    this.emit({ status: 'signedIn', account: (await this.loadAccount(session)) ?? previous ?? { id: session.user.id, handle: '…', displayName: '' } });
  }

  private async loadAccount(session: Session): Promise<Account | null> {
    try {
      const response = await this.fetchImpl(`${this.url}/rest/v1/profiles?id=eq.${session.user.id}&select=handle,display_name`, {
        headers: { apikey: this.key, authorization: `Bearer ${session.access_token}` },
      });
      if (!response.ok) return null;
      const [row] = (await response.json()) as { handle: string; display_name: string }[];
      return row ? { id: session.user.id, handle: row.handle, displayName: row.display_name } : null;
    } catch {
      return null;
    }
  }

  private emit(state: AuthState): void {
    this.state = state;
    for (const listener of this.listeners) listener(state);
  }
}

export const createCommunity = (url: string, key: string, fetchImpl?: typeof fetch): Community => {
  const auth = new SupabaseAuth(url, key, fetchImpl);
  return { auth, plans: new RestCommunity(url, key, () => auth.session(), fetchImpl) };
};
