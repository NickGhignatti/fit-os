/** One released change, as the app shows it in "What's new". */
export interface ChangelogEntry {
  /** The commit's hash: tells entries apart, and which the person has already seen. */
  readonly id: string;
  /** When it was committed, ISO 8601. */
  readonly date: string;
  /** The commit's first line. Written for developers; the app shows the body instead. */
  readonly title: string;
  /** The commit's description, written for the people who use the app (see CLAUDE.md). */
  readonly body: string;
}

/** Whether there is something the person has not read: the newest entry (the first) is not the one last seen. */
export const hasUnseen = (entries: readonly ChangelogEntry[], seenId: string | null): boolean => {
  const [newest] = entries;
  return newest !== undefined && newest.id !== seenId;
};
