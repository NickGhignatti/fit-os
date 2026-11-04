import { oldestFirst, oneRepMax, type Metric, type ProgressEntry } from '../domain/progress';

/**
 * Progress as a CSV file, for a spreadsheet or another app: one row per entry, oldest first, with
 * every value in its metric's plain unit so columns can be charted and summed as they are.
 * (The backup file keeps everything for this app; this one is for reading anywhere else.)
 */

/** The unit a metric's value is stored, and exported, in. */
export const METRIC_UNIT: Record<Metric, string> = {
  weight: 'kg', reps: 'reps', length: 'cm', hold: 's', time: 's', distance: 'm',
};

const HEADER = ['date', 'exercise', 'measurement', 'value', 'unit', 'reps', 'estimated_1rm_kg', 'note'] as const;

type Cell = string | number | null;

/**
 * One field, as RFC 4180 wants it: quoted when it holds a comma, quote or line break. Text that a
 * spreadsheet would run as a formula (=, +, -, @ first) gets a leading apostrophe, so a name or
 * a note can never execute anything when the file is opened (CSV injection).
 */
const field = (value: Cell): string => {
  if (value === null) return '';
  if (typeof value === 'number') return String(Number(value.toFixed(2)));
  const inert = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(inert) ? `"${inert.replace(/"/g, '""')}"` : inert;
};

const row = (e: ProgressEntry): Cell[] => [
  e.date,
  e.exerciseName,
  e.metric,
  e.value,
  METRIC_UNIT[e.metric],
  e.reps,
  e.metric === 'weight' && e.reps !== null && e.reps > 1 ? oneRepMax(e.value, e.reps) : null,
  e.note,
];

/**
 * The CSV text of [entries]. It starts with a byte-order mark so Excel reads accented names as
 * UTF-8, and ends lines with CRLF, as the format asks.
 */
export const progressCsv = (entries: readonly ProgressEntry[]): string =>
  `\uFEFF${[[...HEADER], ...oldestFirst(entries).map(row)].map((cells) => cells.map(field).join(',')).join('\r\n')}\r\n`;
