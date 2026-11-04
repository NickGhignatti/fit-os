import { TRANSFER_KINDS, parseEnvelope, type Envelope, type TransferKind } from '../transfer/transfer';
import { parseBackup, type Backup } from './backup';

/** What a file given to the app holds, told from its content and not its name. */
export type FileContents =
  /** One plan, diet, workout or day of food log, as shared from its screen, or a plan written elsewhere. */
  | { readonly kind: 'item'; readonly envelope: Envelope }
  /** Everything from a device, as exported from Profile. */
  | { readonly kind: 'backup'; readonly backup: Backup }
  | { readonly kind: 'unknown' };

/** A fenced code block, as chat assistants wrap JSON: ```json … ``` */
const FENCED = /```[a-zA-Z]*\s*\n([\s\S]*?)```/;

/**
 * The JSON in [text], however it arrived. Files the app writes are bare JSON; text pasted from an
 * AI chat often comes in a code block, or with a sentence before and after. Returns the text of
 * the first fenced block, else the span from the first "{" to the last "}", else the text as is.
 */
export const extractJson = (text: string): string => {
  const plain = text.replace(/^\uFEFF/, '').trim();
  const fenced = FENCED.exec(plain)?.[1];
  if (fenced !== undefined) return fenced.trim();
  const [start, end] = [plain.indexOf('{'), plain.lastIndexOf('}')];
  return start === -1 || end < start ? plain : plain.slice(start, end + 1);
};

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * An item written elsewhere. The envelope the app writes is { v, kind, data, sentAt }; written by
 * hand or by an AI, "v" and "sentAt" may be missing, and a training plan may come bare, without
 * any envelope. A version other than this app's is refused rather than guessed at.
 */
const authoredEnvelope = (json: unknown): Envelope | null => {
  if (!isObject(json)) return null;
  if (TRANSFER_KINDS.includes(json.kind as TransferKind) && 'data' in json && (json.v === undefined || json.v === 1)) {
    return { v: 1, kind: json.kind as TransferKind, data: json.data, sentAt: typeof json.sentAt === 'string' ? json.sentAt : '' };
  }
  if (json.kind === undefined && 'sessions' in json && 'name' in json) return { v: 1, kind: 'training_plan', data: json, sentAt: '' };
  return null;
};

export const readFileContents = (text: string): FileContents => {
  const exact = parseEnvelope(text);
  if (exact) return { kind: 'item', envelope: exact };
  const source = extractJson(text);
  const backup = parseBackup(source);
  if (backup.ok) return { kind: 'backup', backup: backup.backup };
  try {
    const envelope = authoredEnvelope(JSON.parse(source));
    return envelope ? { kind: 'item', envelope } : { kind: 'unknown' };
  } catch {
    return { kind: 'unknown' };
  }
};

/**
 * Files shared to the installed app from another app's share sheet (Android's "Share → Tracker").
 * The service worker (public/share-target.js) receives each one and leaves it here for the app.
 */
export interface SharedFileInbox {
  /** The file waiting to be imported, removed from the inbox; null when there is none. */
  take(): Promise<{ readonly name: string; readonly text: string } | null>;
}

/** Must match public/share-target.js. */
const CACHE = 'shared-files';
const ENTRY = '/shared-file';

export class CacheSharedFileInbox implements SharedFileInbox {
  async take() {
    if (typeof caches === 'undefined') return null;
    const cache = await caches.open(CACHE);
    const response = await cache.match(ENTRY);
    if (!response) return null;
    await cache.delete(ENTRY);
    return { name: decodeURIComponent(response.headers.get('x-file-name') ?? ''), text: await response.text() };
  }
}
