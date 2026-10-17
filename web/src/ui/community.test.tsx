// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { FakeCommunity } from '../community/fake';
import { newDietPlan, newTrainingPlan, addMeal } from '../domain/edit';
import { CONTACT_EMAIL } from './Legal';
import { makeDevice, renderApp } from './testing';

afterEach(cleanup);

const dialog = (name: string | RegExp) => screen.findByRole('dialog', { name });
const squat = { name: 'Squat', notes: '', catalogId: null, sets: [{ reps: 5, weight: 100 }] };

/** Someone else has published a plan; the visitor is signed out afterwards. */
const withPublishedBy = async (handle: string, kind: 'training' | 'diet', title: string, payload: unknown) => {
  const fake = new FakeCommunity();
  fake.nextUser = handle;
  await fake.signInWithGoogle();
  const published = await fake.publish({ kind, title, description: 'Good for beginners', payload });
  await fake.signOut();
  fake.nextUser = 'user_visitor1';
  return { fake, id: published.status === 'ok' ? published.id : '' };
};

const signIn = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(await screen.findByRole('button', { name: /Sign in with Google/ }));
  const prompt = await dialog('Sign in');
  await user.click(within(prompt).getByLabelText(/I am at least 16/));
  await user.click(within(prompt).getByRole('button', { name: /Sign in with Google/ }));
};

describe('builds without accounts', () => {
  it('show no account section and explain the community is unavailable', async () => {
    renderApp('/profile', makeDevice());
    expect(await screen.findByRole('heading', { name: 'Profile' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Account' })).not.toBeInTheDocument();
    cleanup();
    renderApp('/community', makeDevice());
    expect(await screen.findByText(/isn't available in this build/)).toBeInTheDocument();
  });
});

describe('signing in with Google', () => {
  it('needs explicit agreement first, then shows only the chosen handle', async () => {
    const user = userEvent.setup();
    const fake = new FakeCommunity();
    renderApp('/profile', makeDevice(null, fake));

    const account = await screen.findByRole('region', { name: 'Account' });
    expect(account).toHaveTextContent('Not needed to use the app');
    await user.click(within(account).getByRole('button', { name: /Sign in with Google/ }));

    const prompt = await dialog('Sign in');
    expect(prompt).toHaveTextContent(/never show your Google name, email or photo/);
    expect(within(prompt).getByRole('link', { name: 'Terms of Service' })).toHaveAttribute('href', '/terms');
    expect(within(prompt).getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute('href', '/privacy');
    const go = within(prompt).getByRole('button', { name: /Sign in with Google/ });
    expect(go).toBeDisabled(); // not before agreeing
    expect(fake.signInRequests).toBe(0);

    await user.click(within(prompt).getByLabelText(/I am at least 16/));
    await user.click(go);

    expect(await screen.findByText('@user_aaaa1111')).toBeInTheDocument();
    expect(fake.signInRequests).toBe(1);
    expect(screen.queryByText(/gmail/i)).not.toBeInTheDocument();
  });

  it('lets a signed-in user sign out again', async () => {
    const user = userEvent.setup();
    renderApp('/profile', makeDevice(null, new FakeCommunity()));
    await signIn(user);
    await user.click(await screen.findByRole('button', { name: 'Sign out' }));
    expect(await screen.findByRole('button', { name: /Sign in with Google/ })).toBeInTheDocument();
  });

  it('edits the public profile, refusing taken and invalid handles', async () => {
    const user = userEvent.setup();
    const fake = new FakeCommunity();
    fake.nextUser = 'taken_handle';
    await fake.signInWithGoogle();
    await fake.signOut();
    fake.nextUser = 'user_aaaa1111';
    renderApp('/profile', makeDevice(null, fake));
    await signIn(user);

    await user.click(await screen.findByRole('button', { name: 'Edit public profile' }));
    const form = await dialog('Public profile');
    const handle = within(form).getByLabelText('Handle');

    await user.clear(handle);
    await user.type(handle, 'taken_handle');
    await user.click(within(form).getByRole('button', { name: 'Save' }));
    expect(await within(form).findByRole('alert')).toHaveTextContent('already taken');

    await user.clear(handle);
    await user.type(handle, 'Bad Handle!');
    await user.click(within(form).getByRole('button', { name: 'Save' }));
    expect(await within(form).findByRole('alert')).toHaveTextContent(/3 to 24 lowercase/);

    await user.clear(handle);
    await user.type(handle, 'Alice_Fit'); // typed capitals are lowered
    await user.type(within(form).getByLabelText('Display name (optional)'), 'Alice');
    await user.click(within(form).getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('@alice_fit')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
  });
});

describe('publishing', () => {
  it('asks a signed-out user to sign in, then publishes with consent and lists it', async () => {
    const user = userEvent.setup();
    const fake = new FakeCommunity();
    const device = makeDevice(null, fake);
    const plan = newTrainingPlan('Strength', 'daily', { 0: [squat] });
    await device.repos.trainingPlans.save(plan);
    renderApp(`/workouts/plan/${plan.id}`, device);

    await user.click(await screen.findByRole('button', { name: 'Publish to community' }));
    const prompt = await dialog('Sign in');
    await user.click(within(prompt).getByLabelText(/I am at least 16/));
    await user.click(within(prompt).getByRole('button', { name: /Sign in with Google/ }));

    await user.click(await screen.findByRole('button', { name: 'Publish to community' }));
    const publish = await dialog('Publish to community');
    expect(publish).toHaveTextContent(/Anyone can read and copy this workout/);
    const submit = within(publish).getByRole('button', { name: 'Publish' });
    expect(submit).toBeDisabled(); // consent first
    await user.type(within(publish).getByLabelText('Description (optional)'), 'Simple and heavy');
    await user.click(within(publish).getByLabelText(/I have the right to share this/));
    await user.click(submit);
    expect(await screen.findByText('Published to the community')).toBeInTheDocument();

    const mine = await fake.plans.mine();
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({ title: 'Strength', description: 'Simple and heavy', authorHandle: 'user_aaaa1111' });
    // the copy that is shared is never marked active, and carries no account details
    expect(await fake.plans.get(mine[0]!.id)).toMatchObject({ payload: { name: 'Strength', isActive: false } });
  });

  it('lists my published plans and unpublishes one', async () => {
    const user = userEvent.setup();
    const fake = new FakeCommunity();
    renderApp('/profile', makeDevice(null, fake));
    await signIn(user);
    await fake.publish({ kind: 'diet', title: 'My cut', description: '', payload: {} });

    await user.click(await screen.findByRole('button', { name: 'My published plans' }));
    const list = await dialog('My published plans');
    expect(await within(list).findByText('My cut')).toBeInTheDocument();
    await user.click(within(list).getByRole('button', { name: 'Unpublish My cut' }));
    expect(await within(list).findByText(/not published anything yet/)).toBeInTheDocument();
    expect(await fake.plans.mine()).toHaveLength(0);
  });
});

describe('browsing and copying', () => {
  it('lets anyone browse without an account and copy a workout as an inactive plan', async () => {
    const user = userEvent.setup();
    const source = newTrainingPlan('Heavy legs', 'daily', { 0: [squat] });
    const { fake } = await withPublishedBy('coach_anna', 'training', 'Heavy legs', { ...source, isActive: false });
    const device = makeDevice(null, fake);
    renderApp('/community', device);

    const item = await screen.findByRole('link', { name: /Heavy legs/ });
    expect(item).toHaveTextContent('@coach_anna');
    await user.click(item);

    expect(await screen.findByRole('heading', { name: 'Heavy legs' })).toBeInTheDocument();
    expect(screen.getByText('Squat')).toBeInTheDocument();
    expect(screen.getByText('Good for beginners')).toBeInTheDocument();
    expect(screen.getByText(/Not medical advice/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Copy to my workouts' }));
    expect(await screen.findByText(/Copied “Heavy legs” to your workouts/)).toBeInTheDocument();
    const [copy] = await device.db.trainingPlans.toArray();
    expect(copy).toMatchObject({ name: 'Heavy legs', isActive: false });
    expect(copy!.id).not.toBe(source.id);
  });

  it('previews and copies a diet, and filters by kind and title', async () => {
    const user = userEvent.setup();
    const { plan } = addMeal(newDietPlan('Bulk', 'daily'), 0, 'Lunch', '13:00');
    const { fake } = await withPublishedBy('coach_anna', 'diet', 'Bulk plan', plan);
    await fake.signInWithGoogle(); // anyone else, already signed in
    const device = makeDevice(null, fake);
    renderApp('/community', device);

    expect(await screen.findByText(/Nothing published yet/)).toBeInTheDocument(); // workouts tab is empty
    await user.click(screen.getByRole('radio', { name: 'Diets' }));
    await user.click(await screen.findByRole('link', { name: /Bulk plan/ }));
    expect(await screen.findByText('Lunch')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Copy to my diets' }));
    expect(await screen.findByText(/Copied “Bulk” to your diets/)).toBeInTheDocument();
    expect(await device.db.dietPlans.count()).toBe(1);
  });

  it('searches by title', async () => {
    const user = userEvent.setup();
    const { fake } = await withPublishedBy('coach_anna', 'training', 'Push day', { ...newTrainingPlan('Push day', 'daily'), isActive: false });
    fake.nextUser = 'coach_anna';
    await fake.signInWithGoogle();
    await fake.publish({ kind: 'training', title: 'Pull day', description: '', payload: {} });
    renderApp('/community', makeDevice(null, fake));

    await user.type(await screen.findByLabelText('Search plans'), 'pull');
    expect(await screen.findByRole('link', { name: /Pull day/ })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('link', { name: /Push day/ })).not.toBeInTheDocument()); // after the debounce
  });

  it('refuses to show or copy content that is not a valid plan', async () => {
    const user = userEvent.setup();
    const { fake, id } = await withPublishedBy('mallory', 'training', 'Free supplements', { evil: '<img src=x onerror=alert(1)>', sessions: 'nope' });
    const device = makeDevice(null, fake);
    renderApp(`/community/${id}`, device);

    expect(await screen.findByText(/not in a format the app can read/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy to my workouts' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Copy to my workouts' }));
    expect(await device.db.trainingPlans.count()).toBe(0);
    expect(document.querySelector('img')).toBeNull(); // nothing from the payload was rendered as HTML
  });

  it('says so when a plan no longer exists', async () => {
    renderApp('/community/does-not-exist', makeDevice(null, new FakeCommunity()));
    expect(await screen.findByText(/no longer available/)).toBeInTheDocument();
  });
});

describe('reporting', () => {
  it('needs an account, then thanks the reporter, and a plan reported by three people disappears from the list', async () => {
    const user = userEvent.setup();
    const { fake, id } = await withPublishedBy('mallory', 'training', 'Dangerous crash diet', { ...newTrainingPlan('x', 'daily'), isActive: false });
    renderApp(`/community/${id}`, makeDevice(null, fake));

    await user.click(await screen.findByRole('button', { name: 'Report this plan' }));
    const prompt = await dialog('Sign in'); // signed out: sign in first
    await user.click(within(prompt).getByLabelText(/I am at least 16/));
    await user.click(within(prompt).getByRole('button', { name: /Sign in with Google/ }));

    await user.click(await screen.findByRole('button', { name: 'Report this plan' }));
    const form = await dialog('Report this plan');
    expect(within(form).getByRole('button', { name: 'Send report' })).toBeDisabled(); // a reason is required
    await user.type(within(form).getByLabelText('What is wrong with it?'), 'Promotes starvation');
    await user.click(within(form).getByRole('button', { name: 'Send report' }));
    expect(await screen.findByText('Thanks, we will review it.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Report this plan' }));
    await user.type(within(await dialog('Report this plan')).getByLabelText('What is wrong with it?'), 'Again');
    await user.click(within(await dialog('Report this plan')).getByRole('button', { name: 'Send report' }));
    expect(await screen.findByText('You already reported this plan.')).toBeInTheDocument();

    fake.reportAsOthers(id, 2);
    expect(await fake.plans.list({ kind: 'training', search: '' })).toHaveLength(0);
  });

  it('does not offer to report your own plan', async () => {
    const fake = new FakeCommunity();
    fake.nextUser = 'owner_x';
    await fake.signInWithGoogle();
    const published = await fake.publish({ kind: 'training', title: 'Mine', description: '', payload: { ...newTrainingPlan('Mine', 'daily'), isActive: false } });
    renderApp(`/community/${published.status === 'ok' ? published.id : ''}`, makeDevice(null, fake));
    expect(await screen.findByRole('heading', { name: 'Mine' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Report this plan' })).not.toBeInTheDocument();
  });
});

describe('deleting the account', () => {
  it('asks for confirmation, then removes the account and its published plans', async () => {
    const user = userEvent.setup();
    const fake = new FakeCommunity();
    renderApp('/profile', makeDevice(null, fake));
    await signIn(user);
    await fake.publish({ kind: 'training', title: 'Mine', description: '', payload: {} });

    await user.click(await screen.findByRole('button', { name: 'Delete account' }));
    const confirm = await dialog('Delete your account?');
    expect(confirm).toHaveTextContent(/permanently removes your account, your public profile, the plans you published/);
    expect(confirm).toHaveTextContent(/workouts, food and weight on this device are not touched/);
    await user.click(within(confirm).getByRole('button', { name: 'Delete account' }));

    expect(await screen.findByText('Account deleted')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /Sign in with Google/ })).toBeInTheDocument();
    expect(await fake.plans.list({ kind: 'training', search: '' })).toHaveLength(0);
  });

  it('keeps the data on the device when the account is deleted', async () => {
    const user = userEvent.setup();
    const fake = new FakeCommunity();
    const device = makeDevice(null, fake);
    await device.repos.trainingPlans.save(newTrainingPlan('Local plan', 'daily'));
    renderApp('/profile', device);
    await signIn(user);
    await user.click(await screen.findByRole('button', { name: 'Delete account' }));
    await user.click(within(await dialog('Delete your account?')).getByRole('button', { name: 'Delete account' }));
    await screen.findByText('Account deleted');
    expect(await device.db.trainingPlans.count()).toBe(1);
  });
});

describe('legal pages', () => {
  it('publish a Privacy Policy that matches what the app does, with the contact address', async () => {
    renderApp('/privacy', makeDevice());
    expect(await screen.findByRole('heading', { name: 'Privacy Policy' })).toBeInTheDocument();
    const page = document.querySelector('.legal')!;
    for (const topic of ['Who is responsible', 'stay on your device', 'Signing in with Google', 'Open Food Facts', 'Cloudflare', 'Supabase', 'jsDelivr', 'Your rights', 'Children', 'Cookies']) {
      expect(page.textContent).toContain(topic);
    }
    expect(page.textContent).toContain('Limited Use');
    expect(within(page as HTMLElement).getAllByRole('link', { name: CONTACT_EMAIL })[0]).toHaveAttribute('href', `mailto:${CONTACT_EMAIL}`);
    expect(screen.queryByRole('navigation', { name: 'Main' })).not.toBeInTheDocument();
  });

  it('publish Terms that include the not-medical-advice notice and moderation', async () => {
    renderApp('/terms', makeDevice());
    expect(await screen.findByRole('heading', { name: 'Terms of Service' })).toBeInTheDocument();
    const text = document.querySelector('.legal')!.textContent!;
    expect(text).toContain('not medical, dietetic or fitness-professional advice');
    expect(text).toContain('Reports and moderation');
    expect(text).toContain('eating disorders');
    expect(text).toContain('at least 16');
  });

  it('are reachable from the account card', async () => {
    renderApp('/profile', makeDevice(null, new FakeCommunity()));
    const account = await screen.findByRole('region', { name: 'Account' });
    expect(account).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Privacy Policy' })[0]).toHaveAttribute('href', '/privacy');
  });
});
