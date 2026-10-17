/**
 * The one-time code that moves an item between two devices. 10 symbols of Crockford base32
 * (no I, L, O, U, so it survives being read aloud or typed from a screen) = 50 bits, shown as
 * "XXXXX-XXXXX". 256 is a multiple of 32, so a random byte maps to a symbol without bias.
 */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export const CODE_LENGTH = 10;
const GROUP = 5;

export const generateCode = (): string => {
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH));
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
};

export const formatCode = (code: string): string => `${code.slice(0, GROUP)}-${code.slice(GROUP)}`;

/**
 * What the user typed, as the canonical code, or null if it cannot be one. Case, spaces and
 * dashes are ignored, and the look-alikes are folded the Crockford way (O→0, I/L→1).
 */
export const normalizeCode = (input: string): string | null => {
  const code = input
    .toUpperCase()
    .replace(/[\s-]+/g, '')
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1');
  return code.length === CODE_LENGTH && [...code].every((c) => ALPHABET.includes(c)) ? code : null;
};
