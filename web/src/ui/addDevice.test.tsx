// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Blob as NodeBlob } from 'node:buffer';
import { webcrypto } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { FakeCommunity } from '../community/fake';
import { Tables } from '../data/schema';
import { newTrainingPlan } from '../domain/edit';
import { InMemoryDeviceLinks } from '../transfer/deviceLink';
import { makeDevice, renderApp } from './testing';

// jsdom lacks WebCrypto and Blob streams, which the encryption needs; Node has both.
Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
globalThis.Blob = NodeBlob as unknown as typeof Blob;

afterEach(cleanup);

const plan = newTrainingPlan('Strength', 'daily', { 0: [{ name: 'Squat', notes: '', catalogId: null, sets: [{ reps: 5, weight: 100 }] }] });

const signIn = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(await screen.findByRole('button', { name: /Sign in with Google/ }));
  const prompt = await screen.findByRole('dialog', { name: 'Sign in' });
  await user.click(within(prompt).getByLabelText(/I am at least 16/));
  await user.click(within(prompt).getByRole('button', { name: /Sign in with Google/ }));
};

/** The old phone, signed in as @nick with a plan and a weigh-in, shows the code of Add a device. */
const codeFromOldPhone = async (user: ReturnType<typeof userEvent.setup>, server: InMemoryDeviceLinks) => {
  const fake = new FakeCommunity(server);
  fake.nextUser = 'nick';
  await fake.signInWithGoogle();
  const old = makeDevice(null, fake);
  await old.repos.trainingPlans.save(plan);
  await old.repos.profile.setWeight('2026-10-20', 80);
  renderApp('/profile', old);
  await user.click(await screen.findByRole('button', { name: 'Add a device' }));
  const dialog = await screen.findByRole('dialog', { name: 'Add a device' });
  expect(dialog).toHaveTextContent(/encrypted here first/);
  await user.click(within(dialog).getByRole('button', { name: 'Create code' }));
  const code = (await within(dialog).findByLabelText('Device code')).textContent!;
  expect(dialog).toHaveTextContent('sign in with Google as @nick');
  cleanup();
  return code;
};

describe('adding a device', () => {
  it('brings everything to a new phone that opens the QR link and signs in to the same account', async () => {
    const user = userEvent.setup();
    const server = new InMemoryDeviceLinks(() => null);
    const code = await codeFromOldPhone(user, server);
    expect(server.size).toBe(1);

    // The new phone scans the QR with its camera: the app opens on /link with the code, signed out.
    const fake = new FakeCommunity(server);
    fake.nextUser = 'nick';
    const fresh = makeDevice(null, fake);
    renderApp(`/link#${code}`, fresh);
    expect(await screen.findByText(/First sign in with the Google account/)).toBeInTheDocument();
    await signIn(user);
    expect(fake.returnTo).toBe('/link'); // back here after Google

    expect(await screen.findByText('Brought 1 workout plans, 0 diets, 0 workouts, 0 food-log days and 1 weigh-ins')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Today' })).toBeInTheDocument();
    expect((await fresh.store.direct.list(Tables.trainingPlans)).map((p) => p.name)).toEqual(['Strength']);
    expect((await fresh.store.direct.list(Tables.weightEntries)).map((w) => w.kg)).toEqual([80]);
    expect(server.size).toBe(0); // nothing left on the server
  });

  it('finds nothing for another account, and says what to check', async () => {
    const user = userEvent.setup();
    const server = new InMemoryDeviceLinks(() => null);
    const code = await codeFromOldPhone(user, server);

    const fake = new FakeCommunity(server);
    fake.nextUser = 'someone_else';
    await fake.signInWithGoogle();
    const fresh = makeDevice(null, fake);
    renderApp('/profile', fresh);
    await user.click(await screen.findByRole('button', { name: 'Get data from another device' }));
    await user.type(await screen.findByLabelText('Device code'), code);
    await user.click(screen.getByRole('button', { name: 'Get data' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/same Google account on both devices/);
    expect(await fresh.store.direct.list(Tables.trainingPlans)).toEqual([]);
    expect(server.size).toBe(1);
  });
});
