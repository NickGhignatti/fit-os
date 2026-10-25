import type { Stream } from '../domain/repositories';
import type { DeviceLinkGateway } from '../transfer/deviceLink';

/** The part of an account other people can see. The Google email and name are never part of it. */
export interface Account {
  readonly id: string;
  readonly handle: string;
  /** Optional name shown next to the handle; empty when not set. */
  readonly displayName: string;
}

export type AuthState =
  | { readonly status: 'loading' }
  | { readonly status: 'signedOut' }
  | { readonly status: 'signedIn'; readonly account: Account };

export type ProfileEdit =
  | { readonly status: 'ok' }
  /** Someone else already uses that handle. */
  | { readonly status: 'taken' }
  /** Not 3-24 lowercase letters, digits or underscores, or the name is too long. */
  | { readonly status: 'invalid' }
  | { readonly status: 'failed' };

export interface AuthGateway {
  /** Emits the current state, then every change (signing in, out, being deleted). */
  observe(): Stream<AuthState>;
  /** Sends the user to Google; the app is reloaded on [returnTo] (default /profile) when they come back signed in. */
  signInWithGoogle(returnTo?: string): Promise<void>;
  signOut(): Promise<void>;
  updateProfile(handle: string, displayName: string): Promise<ProfileEdit>;
  /** Erases the account, its published plans and its reports, then signs out. */
  deleteAccount(): Promise<'ok' | 'failed'>;
}

export type PlanKind = 'training' | 'diet';

export interface PublicPlanSummary {
  readonly id: string;
  readonly kind: PlanKind;
  readonly title: string;
  readonly description: string;
  readonly authorHandle: string;
  readonly authorName: string;
  /** ISO timestamp. */
  readonly createdAt: string;
  /** Hidden by moderation: only its owner still sees it. */
  readonly hidden: boolean;
  readonly mine: boolean;
}

/** A plan with its content. The content is untrusted: validate it before importing. */
export interface PublicPlan extends PublicPlanSummary {
  readonly payload: unknown;
}

export interface PlanQuery {
  readonly kind: PlanKind;
  readonly search: string;
  /** The `createdAt` of the last plan already shown, to get the page after it. */
  readonly before?: string;
}

export type PublishResult =
  | { readonly status: 'ok'; readonly id: string }
  /** 30 published plans already. */
  | { readonly status: 'limit' }
  /** Too many plans in the last hour. */
  | { readonly status: 'tooFast' }
  | { readonly status: 'signedOut' }
  | { readonly status: 'failed' };

export interface CommunityRepository {
  /** A page of plans, newest first. Works without an account. */
  list(query: PlanQuery): Promise<readonly PublicPlanSummary[]>;
  get(id: string): Promise<PublicPlan | null>;
  /** The signed-in user's own published plans, hidden ones included. */
  mine(): Promise<readonly PublicPlanSummary[]>;
  publish(plan: { kind: PlanKind; title: string; description: string; payload: unknown }): Promise<PublishResult>;
  unpublish(id: string): Promise<boolean>;
  report(id: string, reason: string): Promise<'ok' | 'already' | 'signedOut' | 'failed'>;
}

/** Everything that needs a Supabase project with accounts switched on. Null in builds without one. */
export interface Community {
  readonly auth: AuthGateway;
  readonly plans: CommunityRepository;
  /** "Add a device": moving everything to another device of the same account. */
  readonly devices: DeviceLinkGateway;
}

export const PAGE_SIZE = 20;
