import { execFileSync } from 'node:child_process';
import type { ChangelogEntry } from './src/domain/changelog';

/**
 * Commits before this moment are not announced: their descriptions were written for developers.
 * From here on, every commit description is meant to be read by the app's users.
 */
export const CHANGELOG_SINCE = '2026-11-07T12:05:58+01:00';

const FIELD = '\x1f';
const RECORD = '\x1e';
/** A line that ends a commit message without being part of what it says, such as "Co-Authored-By: …". */
const TRAILER = /^[A-Za-z][A-Za-z-]*:\s/;

/** The description without trailing trailers and blank lines. */
const cleanBody = (body: string): string => {
  const lines = body.trim().split('\n');
  while (lines.length > 0 && (lines.at(-1)!.trim() === '' || TRAILER.test(lines.at(-1)!))) lines.pop();
  return lines.join('\n').trim();
};

/**
 * The entries in `git log --format=%H␟%aI␟%s␟%b␞`, newest first. A commit without a description
 * has nothing to tell people, so it is left out.
 */
export const parseChangelog = (raw: string): ChangelogEntry[] =>
  raw.split(RECORD)
    .map((record) => record.replace(/^\n+/, ''))
    .filter((record) => record.trim() !== '')
    .map((record) => {
      const [id = '', date = '', title = '', ...body] = record.split(FIELD);
      return { id, date, title, body: cleanBody(body.join(FIELD)) };
    })
    .filter((entry) => entry.id !== '' && entry.body !== '');

/**
 * The changes since [CHANGELOG_SINCE], read from the repository at build time. Without git, or in a
 * checkout too shallow to hold them, there is simply nothing to announce: a build never fails for it.
 */
export const readChangelog = (cwd: string): ChangelogEntry[] => {
  try {
    const raw = execFileSync('git', ['log', '--no-merges', `--since=${CHANGELOG_SINCE}`, `--format=%H${FIELD}%aI${FIELD}%s${FIELD}%b${RECORD}`], {
      cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
    });
    return parseChangelog(raw);
  } catch {
    return [];
  }
};
