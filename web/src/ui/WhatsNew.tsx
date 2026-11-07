import { useState } from 'react';
import { CHANGELOG } from '../app/changelog';
import { hasUnseen, type ChangelogEntry } from '../domain/changelog';
import { Icons, Modal } from './kit';

const SEEN_KEY = 'fit-os.changelog-seen';

// Browser storage can be missing or refuse (private windows): then everything simply counts as unseen.
const readSeen = (): string | null => {
  try {
    return localStorage.getItem(SEEN_KEY);
  } catch {
    return null;
  }
};
const writeSeen = (id: string) => {
  try {
    localStorage.setItem(SEEN_KEY, id);
  } catch {
    // not remembered, so the dot shows again next time
  }
};

const dateText = (iso: string): string =>
  new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });

/**
 * A megaphone for the header: it lists what changed in each version, in the words of the commit
 * descriptions, and wears a dot while the newest has not been read. Nothing shows when there is
 * nothing to announce.
 */
export const WhatsNew = ({ entries = CHANGELOG }: { entries?: readonly ChangelogEntry[] }) => {
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(readSeen);
  const [newest] = entries;
  if (!newest) return null;
  const unseen = hasUnseen(entries, seen);
  const show = () => {
    setOpen(true);
    setSeen(newest.id);
    writeSeen(newest.id);
  };
  return (
    <>
      <button className="icon-btn whats-new" aria-label={unseen ? "What's new, unread" : "What's new"} onClick={show}>
        {Icons.megaphone}
        {unseen && <span className="whats-new-dot" aria-hidden="true" />}
      </button>
      {open && (
        <Modal title="What's new" onClose={() => setOpen(false)}>
          <div className="stack">
            {entries.map((entry) => (
              <article key={entry.id} className="release" aria-label={dateText(entry.date)}>
                <div className="eyebrow">{dateText(entry.date)}</div>
                <p className="release-body">{entry.body}</p>
              </article>
            ))}
          </div>
        </Modal>
      )}
    </>
  );
};
