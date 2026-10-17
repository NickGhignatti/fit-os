import { formatCode, generateCode, normalizeCode } from './code';
import { deriveKeys, open, seal } from './crypto';
import type { TransferGateway } from './gateway';

/** What can be sent to another device. */
export type TransferKind = 'training_plan' | 'diet_plan' | 'workout' | 'food_log_day';

const KINDS: readonly TransferKind[] = ['training_plan', 'diet_plan', 'workout', 'food_log_day'];
const VERSION = 1;
const DEFAULT_TTL_MINUTES = 60;

/** What travels inside the encrypted payload. [data] is the item's JSON; the importer validates it. */
export interface Envelope {
  readonly v: typeof VERSION;
  readonly kind: TransferKind;
  readonly data: unknown;
  readonly sentAt: string;
}

export interface SentTransfer {
  /** Display form, "XXXXX-XXXXX". */
  readonly code: string;
  readonly expiresAt: Date;
}

export interface SendOptions {
  /** How long the code stays valid, 5 minutes to 24 hours. */
  readonly ttlMinutes?: number;
  readonly now?: () => Date;
}

/** Encrypts [data] with a fresh code and parks it in [gateway]. Show the returned code to the user. */
export const sendTransfer = async (
  gateway: TransferGateway,
  kind: TransferKind,
  data: unknown,
  { ttlMinutes = DEFAULT_TTL_MINUTES, now = () => new Date() }: SendOptions = {},
): Promise<SentTransfer> => {
  const code = generateCode();
  const { id, key } = await deriveKeys(code);
  const envelope: Envelope = { v: VERSION, kind, data, sentAt: now().toISOString() };
  const expiresAt = await gateway.put(id, await seal(JSON.stringify(envelope), key), ttlMinutes);
  return { code: formatCode(code), expiresAt };
};

export type ReceiveResult =
  | { readonly status: 'ok'; readonly envelope: Envelope }
  /** What was typed cannot be a code. */
  | { readonly status: 'invalid_code' }
  /** No such transfer: wrong code, expired, or already taken. The server cannot tell which. */
  | { readonly status: 'not_found' }
  /** Found but unreadable: damaged, or from an incompatible app version. */
  | { readonly status: 'unreadable' };

const parseEnvelope = (text: string): Envelope | null => {
  try {
    const value = JSON.parse(text) as Partial<Envelope>;
    return value.v === VERSION && KINDS.includes(value.kind as TransferKind) && typeof value.sentAt === 'string'
      ? (value as Envelope)
      : null;
  } catch {
    return null;
  }
};

/** Fetches, deletes from the server, and decrypts the item behind [input] (a code as typed). */
export const receiveTransfer = async (gateway: TransferGateway, input: string): Promise<ReceiveResult> => {
  const code = normalizeCode(input);
  if (code === null) return { status: 'invalid_code' };
  const { id, key } = await deriveKeys(code);
  const payload = await gateway.take(id, true);
  if (payload === null) return { status: 'not_found' };
  const text = await open(payload, key);
  const envelope = text === null ? null : parseEnvelope(text);
  return envelope ? { status: 'ok', envelope } : { status: 'unreadable' };
};
