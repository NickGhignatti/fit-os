import type { Stream } from '../domain/repositories';
import type {
  Account,
  AuthGateway,
  AuthState,
  Community,
  CommunityRepository,
  PlanQuery,
  ProfileEdit,
  PublicPlan,
  PublicPlanSummary,
  PublishResult,
} from './ports';
import { PAGE_SIZE } from './ports';
import { InMemoryDeviceLinks } from '../transfer/deviceLink';

interface Stored extends PublicPlan {
  readonly ownerId: string;
  readonly reporters: Set<string>;
}

/**
 * The community in memory, behaving like the database rules in supabase/migrations: random handles,
 * 30 plans per person, a plan hidden after three different reports. For tests and local development.
 */
export class FakeCommunity implements Community, AuthGateway, CommunityRepository {
  readonly auth: AuthGateway = this;
  readonly plans: CommunityRepository = this;
  /** Device links as the account signed in here sees them. Pass one server to two fakes to play two devices. */
  readonly devices: InMemoryDeviceLinks;

  constructor(links: InMemoryDeviceLinks = new InMemoryDeviceLinks(() => null)) {
    this.devices = links.forOwner(() => this.me()?.id ?? null);
  }

  private state: AuthState = { status: 'signedOut' };
  private readonly listeners = new Set<(s: AuthState) => void>();
  private readonly stored: Stored[] = [];
  private readonly accounts = new Map<string, Account>();
  private counter = 0;
  /** What the next sign-in will produce, so tests can pick who signs in. */
  nextUser = 'user_aaaa1111';
  signInRequests = 0;

  // ---- AuthGateway ----------------------------------------------------------

  observe(): Stream<AuthState> {
    return {
      subscribe: (next) => {
        this.listeners.add(next);
        next(this.state);
        return () => void this.listeners.delete(next);
      },
    };
  }

  /** Where the last sign-in asked to come back to. */
  returnTo: string | undefined;

  async signInWithGoogle(returnTo?: string): Promise<void> {
    this.signInRequests++;
    this.returnTo = returnTo;
    let account = this.accounts.get(this.nextUser);
    if (!account) {
      account = { id: `id-${this.nextUser}`, handle: this.nextUser, displayName: '' };
      this.accounts.set(this.nextUser, account);
    }
    this.emit({ status: 'signedIn', account });
  }

  async signOut(): Promise<void> {
    this.emit({ status: 'signedOut' });
  }

  async updateProfile(handle: string, displayName: string): Promise<ProfileEdit> {
    const me = this.me();
    if (!me) return { status: 'failed' };
    if (!/^[a-z0-9_]{3,24}$/.test(handle) || displayName.trim().length > 40) return { status: 'invalid' };
    if ([...this.accounts.values()].some((a) => a.handle === handle && a.id !== me.id)) return { status: 'taken' };
    const updated = { ...me, handle, displayName: displayName.trim() };
    this.accounts.set(this.nextUser, updated);
    for (const plan of this.stored.filter((p) => p.ownerId === me.id)) {
      this.stored[this.stored.indexOf(plan)] = { ...plan, authorHandle: handle, authorName: updated.displayName };
    }
    this.emit({ status: 'signedIn', account: updated });
    return { status: 'ok' };
  }

  async deleteAccount(): Promise<'ok' | 'failed'> {
    const me = this.me();
    if (!me) return 'failed';
    for (let i = this.stored.length - 1; i >= 0; i--) if (this.stored[i]!.ownerId === me.id) this.stored.splice(i, 1);
    this.accounts.delete(this.nextUser);
    this.emit({ status: 'signedOut' });
    return 'ok';
  }

  // ---- CommunityRepository --------------------------------------------------

  async list({ kind, search, before }: PlanQuery): Promise<readonly PublicPlanSummary[]> {
    const term = search.trim().toLowerCase();
    return this.stored
      .filter((p) => p.kind === kind && !p.hidden && p.title.toLowerCase().includes(term) && (!before || p.createdAt < before))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, PAGE_SIZE)
      .map((p) => this.summary(p));
  }

  async get(id: string): Promise<PublicPlan | null> {
    const plan = this.stored.find((p) => p.id === id);
    return plan && (!plan.hidden || plan.ownerId === this.me()?.id) ? { ...this.summary(plan), payload: plan.payload } : null;
  }

  async mine(): Promise<readonly PublicPlanSummary[]> {
    const me = this.me();
    return me ? this.stored.filter((p) => p.ownerId === me.id).map((p) => this.summary(p)) : [];
  }

  async publish(plan: { kind: 'training' | 'diet'; title: string; description: string; payload: unknown }): Promise<PublishResult> {
    const me = this.me();
    if (!me) return { status: 'signedOut' };
    if (this.stored.filter((p) => p.ownerId === me.id).length >= 30) return { status: 'limit' };
    const id = `plan-${++this.counter}`;
    this.stored.push({
      id, kind: plan.kind, title: plan.title, description: plan.description, payload: plan.payload,
      authorHandle: me.handle, authorName: me.displayName, createdAt: new Date(Date.UTC(2026, 9, 18, 12, 0, this.counter)).toISOString(),
      hidden: false, mine: false, ownerId: me.id, reporters: new Set(),
    });
    return { status: 'ok', id };
  }

  async unpublish(id: string): Promise<boolean> {
    const me = this.me();
    const index = this.stored.findIndex((p) => p.id === id && p.ownerId === me?.id);
    if (index < 0) return false;
    this.stored.splice(index, 1);
    return true;
  }

  async report(id: string, _reason: string): Promise<'ok' | 'already' | 'signedOut' | 'failed'> {
    const me = this.me();
    if (!me) return 'signedOut';
    const index = this.stored.findIndex((p) => p.id === id);
    const plan = this.stored[index];
    if (!plan) return 'failed';
    if (plan.reporters.has(me.id)) return 'already';
    plan.reporters.add(me.id);
    if (plan.reporters.size >= 3) this.stored[index] = { ...plan, hidden: true };
    return 'ok';
  }

  /** Test helper: other people report a plan. */
  reportAsOthers(id: string, count: number): void {
    const index = this.stored.findIndex((p) => p.id === id);
    const plan = this.stored[index];
    if (!plan) return;
    for (let i = 0; i < count; i++) plan.reporters.add(`stranger-${i}`);
    if (plan.reporters.size >= 3) this.stored[index] = { ...plan, hidden: true };
  }

  private me(): Account | null {
    return this.state.status === 'signedIn' ? this.state.account : null;
  }

  private summary(plan: Stored): PublicPlanSummary {
    const { payload: _payload, ownerId, reporters: _reporters, ...summary } = plan;
    return { ...summary, mine: ownerId === this.me()?.id };
  }

  private emit(state: AuthState): void {
    this.state = state;
    for (const listener of this.listeners) listener(state);
  }
}
