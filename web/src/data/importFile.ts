import { parseEnvelope, type Envelope } from '../transfer/transfer';
import { parseBackup, type Backup } from './backup';

/** What a file given to the app holds, told from its content and not its name. */
export type FileContents =
  /** One plan, diet, workout or day of food log, as shared from its screen. */
  | { readonly kind: 'item'; readonly envelope: Envelope }
  /** Everything from a device, as exported from Profile. */
  | { readonly kind: 'backup'; readonly backup: Backup }
  | { readonly kind: 'unknown' };

export const readFileContents = (text: string): FileContents => {
  const envelope = parseEnvelope(text);
  if (envelope) return { kind: 'item', envelope };
  const backup = parseBackup(text);
  return backup.ok ? { kind: 'backup', backup: backup.backup } : { kind: 'unknown' };
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
