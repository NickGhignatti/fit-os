/**
 * End-to-end encryption for transfers. One slow derivation from the code yields 64 bytes:
 * the first 32 become the server-side id, the last 32 the AES-GCM key. The server therefore
 * only ever holds an id that cannot be turned back into the code (50 bits x 200k PBKDF2
 * rounds is out of reach) and ciphertext it cannot read.
 */
const SALT = new TextEncoder().encode('tracker-transfer/v1');
const ITERATIONS = 200_000;
const ID_BYTES = 32;
const IV_BYTES = 12;

export interface TransferKeys {
  /** 64 hex characters; what the server stores and looks up. */
  readonly id: string;
  readonly key: CryptoKey;
}

const toHex = (bytes: Uint8Array): string => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

const toBase64 = (bytes: Uint8Array): string => {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
};

const fromBase64 = (text: string): Uint8Array => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));

export const deriveKeys = async (code: string): Promise<TransferKeys> => {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(code), 'PBKDF2', false, ['deriveBits']);
  const bits = new Uint8Array(
    await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: SALT, iterations: ITERATIONS }, material, 512),
  );
  const key = await crypto.subtle.importKey('raw', bits.slice(ID_BYTES), 'AES-GCM', false, ['encrypt', 'decrypt']);
  return { id: toHex(bits.slice(0, ID_BYTES)), key };
};

const pipe = async (data: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> =>
  new Uint8Array(await new Response(new Blob([data]).stream().pipeThrough(stream)).arrayBuffer());

/** Compresses, then encrypts; the result is base64 of IV followed by the ciphertext. */
export const seal = async (plaintext: string, key: CryptoKey): Promise<string> => {
  const packed = await pipe(new TextEncoder().encode(plaintext), new CompressionStream('gzip'));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, packed));
  const out = new Uint8Array(IV_BYTES + encrypted.length);
  out.set(iv);
  out.set(encrypted, IV_BYTES);
  return toBase64(out);
};

/** The plaintext, or null if the payload was not sealed with this key or has been altered. */
export const open = async (payload: string, key: CryptoKey): Promise<string | null> => {
  try {
    const bytes = fromBase64(payload);
    const iv = bytes.slice(0, IV_BYTES);
    const packed = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, bytes.slice(IV_BYTES)));
    return new TextDecoder().decode(await pipe(packed, new DecompressionStream('gzip')));
  } catch {
    return null;
  }
};
