import type { ChangelogEntry } from '../domain/changelog';

/** What changed in each release since announcements began, newest first; written into the build by vite.config.ts. */
export const CHANGELOG: readonly ChangelogEntry[] = __CHANGELOG__;
