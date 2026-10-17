/**
 * A new unique id, time-ordered like a UUIDv7: ids sort in the order they were made, which is
 * how the user's lists keep their order now that there is no autoincrement column. Within one
 * millisecond a counter keeps that order, and the rest is random so devices never collide.
 */
let lastMs = 0;
let counter = 0;

const hex = (n: number, width: number): string => n.toString(16).padStart(width, '0');

export const newId = (now: number = Date.now()): string => {
  const ms = Math.max(now, lastMs);
  counter = ms === lastMs ? counter + 1 : 0;
  lastMs = ms;

  const random = crypto.getRandomValues(new Uint8Array(8));
  const randHex = Array.from(random, (b) => hex(b, 2)).join('');
  const msHex = hex(ms, 12);
  // 8-4-4-4-12: time(48) | version 7 + counter(12) | variant + random(62)
  const variant = hex(0x8 | (random[0]! & 0x3), 1);
  return `${msHex.slice(0, 8)}-${msHex.slice(8)}-7${hex(counter & 0xfff, 3)}-${variant}${randHex.slice(1, 4)}-${randHex.slice(4, 16)}`;
};
