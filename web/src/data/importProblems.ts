import type { ZodIssue } from 'zod';
import { WEEKDAYS } from '../domain/plan';

/**
 * Turns what the validator says about an imported item into lines a person, or the AI that wrote
 * the file, can act on: where in the plan, then what is wrong.
 *   "Monday › Plank › set 2 › seconds: Number must be greater than 0"
 * The same labels name the fields an import ignored, so both read alike.
 */

type Path = readonly (string | number)[];

const MAX_LINES = 20;

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

const child = (node: unknown, key: string | number): unknown =>
  Array.isArray(node) ? node[Number(key)] : isObject(node) ? node[String(key)] : undefined;

/** "0" is the session of a daily plan, "1".."7" the weekdays; anything else is shown as typed. */
const dayLabel = (key: string | number): string => {
  const n = Number(key);
  return String(key) === '0' ? 'Every day' : Number.isInteger(n) && n >= 1 && n <= 7 ? WEEKDAYS[n - 1]! : `day "${key}"`;
};

/** Where [path] points inside [root], in the plan's own words: days by name, exercises by name, sets by number. */
export const labelOf = (path: Path, root: unknown): string => {
  const parts: string[] = [];
  let node = root;
  path.forEach((key, i) => {
    const previous = path[i - 1];
    node = child(node, key);
    const last = i === path.length - 1;
    if (previous === 'sessions') parts.push(dayLabel(key));
    else if (previous === 'sets' && typeof key === 'number') parts.push(`set ${key + 1}`);
    else if ((key === 'sessions' || key === 'sets') && !last) return; // the next part names it better
    else if (typeof key === 'number') {
      const name = isObject(node) && typeof node.name === 'string' && node.name.trim() ? node.name.trim() : null;
      parts.push(name ?? `item ${key + 1}`);
    } else parts.push(key === 'sessions' ? 'days' : key);
  });
  return parts.join(' › ');
};

/** One line per problem, at most [MAX_LINES], the last one saying how many were left out. */
const capped = (lines: readonly string[]): string[] =>
  lines.length <= MAX_LINES ? [...lines] : [...lines.slice(0, MAX_LINES - 1), `…and ${lines.length - MAX_LINES + 1} more`];

export const describeIssues = (issues: readonly ZodIssue[], root: unknown): string[] =>
  capped(issues.map((issue) => {
    const where = labelOf(issue.path, root);
    return where ? `${where}: ${issue.message}` : issue.message;
  }));

/**
 * The fields of [input] that are not in [output]: what validation dropped because it does not
 * know them, such as "duration" written for "seconds". Unknown fields are ignored rather than
 * refused, so a file from a newer version of the app still imports; naming them lets the person
 * (or the AI) see that something they meant was not understood.
 */
export const ignoredFields = (input: unknown, output: unknown, root: unknown = input, path: Path = []): string[] => {
  if (Array.isArray(input) && Array.isArray(output)) {
    return capped(input.flatMap((item, i) => ignoredFields(item, output[i], root, [...path, i])));
  }
  if (!isObject(input) || !isObject(output)) return [];
  return capped(Object.keys(input).flatMap((key) => (key in output
    ? ignoredFields(input[key], output[key], root, [...path, key])
    : [labelOf([...path, key], root)])));
};

/** What to send back to the AI that wrote a plan the app refused: what is wrong, and to answer with the whole file again. */
export const fixPrompt = (problems: readonly string[]): string => [
  'fit-os could not import the plan you wrote:',
  problems.map((p) => `- ${p}`).join('\n'),
  'Fix these problems and reply with the whole corrected JSON in one ```json code block, nothing else.',
].join('\n');

/** What to send back when the plan imported but some of its fields were not understood. */
export const ignoredPrompt = (ignored: readonly string[]): string => [
  'fit-os imported the plan but ignored fields it does not know:',
  ignored.map((p) => `- ${p}`).join('\n'),
  'Rewrite the plan using only the fields of the format (for example "seconds" for timed sets) and reply with the whole JSON in one ```json code block.',
].join('\n');
