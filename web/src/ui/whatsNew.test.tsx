// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { WhatsNew } from './WhatsNew';

const entries = [
  { id: 'new', date: '2026-11-09T10:00:00+01:00', title: 'Second', body: 'Plans can be reviewed before importing.' },
  { id: 'old', date: '2026-11-08T10:00:00+01:00', title: 'First', body: 'Sets no longer slide away.' },
];

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe('what is new', () => {
  it('shows nothing when there is nothing to announce', () => {
    render(<WhatsNew entries={[]} />);
    expect(screen.queryByRole('button', { name: /What's new/ })).not.toBeInTheDocument();
  });

  it('lists the descriptions, newest first, and stops flagging them once read', async () => {
    const user = userEvent.setup();
    render(<WhatsNew entries={entries} />);
    await user.click(screen.getByRole('button', { name: "What's new, unread" }));

    const list = screen.getByRole('dialog', { name: "What's new" });
    expect(within(list).getAllByText(/\.$/).map((p) => p.textContent)).toEqual([
      'Plans can be reviewed before importing.', 'Sets no longer slide away.',
    ]);
    expect(within(list).queryByText('Second')).not.toBeInTheDocument(); // the first line is for developers

    await user.keyboard('{Escape}');
    expect(screen.getByRole('button', { name: "What's new" })).toBeInTheDocument();
    cleanup();
    render(<WhatsNew entries={entries} />); // remembered across visits
    expect(screen.getByRole('button', { name: "What's new" })).toBeInTheDocument();
  });

  it('flags a newer release again after an older one was read', () => {
    localStorage.setItem('fit-os.changelog-seen', 'old');
    render(<WhatsNew entries={entries} />);
    expect(screen.getByRole('button', { name: "What's new, unread" })).toBeInTheDocument();
  });
});
