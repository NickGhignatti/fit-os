// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { CONTACT_EMAIL } from './Legal';
import { makeDevice, renderApp } from './testing';

afterEach(cleanup);

describe('the order of the profile page', () => {
  const sections = () => screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);

  it('puts you on top, then the calendar, and your data at the bottom with the legal links', async () => {
    renderApp('/profile', makeDevice());
    await screen.findByRole('button', { name: 'Set up profile' });
    expect(sections()).toEqual(['Calendar', 'Your data']);
    expect(screen.queryByRole('region', { name: 'Daily goal' })).not.toBeInTheDocument(); // the goal lives on the Tracker, the weight on Diet
    expect(screen.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute('href', '/privacy');
    expect(screen.getByRole('link', { name: 'Terms of Service' })).toHaveAttribute('href', '/terms');
  });
});

describe('legal pages', () => {
  it('publish a Privacy Policy that matches what the app does, with the contact address', async () => {
    renderApp('/privacy', makeDevice());
    expect(await screen.findByRole('heading', { name: 'Privacy Policy' })).toBeInTheDocument();
    const page = document.querySelector('.legal')!;
    for (const topic of ['Who is responsible', 'stay on your device', 'Open Food Facts', 'Cloudflare', 'Supabase', 'jsDelivr', 'Your rights', 'Children', 'Cookies']) {
      expect(page.textContent).toContain(topic);
    }
    expect(page.textContent).not.toMatch(/Sign in with Google|publish/i);
    expect(within(page as HTMLElement).getAllByRole('link', { name: CONTACT_EMAIL })[0]).toHaveAttribute('href', `mailto:${CONTACT_EMAIL}`);
    expect(screen.queryByRole('navigation', { name: 'Main' })).not.toBeInTheDocument();
  });

  it('publish Terms that include the not-medical-advice notice', async () => {
    renderApp('/terms', makeDevice());
    expect(await screen.findByRole('heading', { name: 'Terms of Service' })).toBeInTheDocument();
    const text = document.querySelector('.legal')!.textContent!;
    expect(text).toContain('not medical, dietetic or fitness-professional advice');
    expect(text).toContain('eating disorder');
    expect(text).toContain('at least 16');
  });
});
