// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { newTrainingPlan } from '../domain/edit';
import { exerciseKey, type PersonalRecord } from '../domain/records';
import { makeDevice, renderApp } from './testing';

afterEach(cleanup);

const dialog = (name: string | RegExp) => screen.findByRole('dialog', { name });

/** Gives asynchronous work time to show something, before asserting that nothing appeared. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 150));
type User = ReturnType<typeof userEvent.setup>;

/** Records tab -> Add record -> fill the dialog -> Save. */
const addFromTab = async (user: User, fill: (form: HTMLElement) => Promise<void>) => {
  await user.click(await screen.findByRole('button', { name: 'Add record' }));
  const form = await dialog('Add personal record');
  await fill(form);
  await user.click(within(form).getByRole('button', { name: 'Save' }));
};

const record = (over: Partial<PersonalRecord> = {}): PersonalRecord => ({
  id: `r-${Math.random()}`, exerciseKey: exerciseKey('Squat', null), exerciseName: 'Squat', catalogId: null,
  metric: 'weight', value: 100, reps: 5, date: '2026-09-01', note: '', ...over,
});

describe('the Records tab', () => {
  it('starts empty, and records a lift with its reps', async () => {
    const user = userEvent.setup();
    renderApp('/workouts?tab=records');
    expect(await screen.findByText(/No personal records yet/)).toBeInTheDocument();

    await addFromTab(user, async (form) => {
      await user.type(within(form).getByLabelText('Exercise'), 'Back squat');
      await user.type(within(form).getByLabelText('Weight (kg)'), '100');
      await user.type(within(form).getByLabelText('Reps'), '5');
      expect(within(form).getByRole('status')).toHaveTextContent('Estimated one-rep max: 116.67 kg');
      fireEvent.change(within(form).getByLabelText('Date'), { target: { value: '2026-10-01' } });
      await user.type(within(form).getByLabelText('Note (optional)'), 'belt on');
    });

    const list = await screen.findByRole('region', { name: 'Personal records' });
    expect(list).toHaveTextContent('Back squat');
    expect(list).toHaveTextContent('Weight: 100 kg × 5');

    await user.click(within(list).getByRole('link', { name: /Back squat/ }));
    const weight = await screen.findByRole('region', { name: 'Weight' });
    expect(weight).toHaveTextContent('100 kg × 5');
    expect(weight).toHaveTextContent('≈ 116.67 kg 1RM');
    expect(weight).toHaveTextContent('2026-10-01');
    expect(weight).toHaveTextContent('belt on');
    expect(within(weight).getByText('PR')).toBeInTheDocument();
  });

  it('moves the PR badge to a better result, charts the trend, and deletes a record', async () => {
    const user = userEvent.setup();
    const device = makeDevice();
    await device.repos.records.save(record({ id: 'old', value: 100, reps: 5, date: '2026-08-01' }));
    renderApp(`/records/${encodeURIComponent(exerciseKey('Squat', null))}`, device);

    expect(await screen.findByText('PR')).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /trend/ })).not.toBeInTheDocument(); // one point is not a trend

    await user.click(screen.getByRole('button', { name: 'Add record' }));
    const form = await dialog('Add personal record');
    expect(within(form).getByLabelText('Exercise')).toHaveAttribute('readonly'); // adding to this exercise
    await user.type(within(form).getByLabelText('Weight (kg)'), '110');
    await user.type(within(form).getByLabelText('Reps'), '5');
    await user.click(within(form).getByRole('button', { name: 'Save' }));

    const section = await screen.findByRole('region', { name: 'Weight' });
    await waitFor(() => expect(within(section).getAllByText(/kg × 5/)).toHaveLength(3)); // best, and the two rows
    expect(section).toHaveTextContent('110 kg × 5');
    expect(within(section).getAllByText('PR')).toHaveLength(1);
    expect(within(section).getByRole('img', { name: 'Weight trend over 2 records' })).toBeInTheDocument();
    expect(within(section).getByText('110 kg × 5', { selector: '.big-number' })).toBeInTheDocument();

    await user.click(within(section).getByRole('button', { name: /Options for 110 kg × 5/ }));
    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    await user.click(within(await dialog('Delete record?')).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(screen.getByRole('region', { name: 'Weight' })).toHaveTextContent('100 kg × 5'));
    expect(await device.db.records.count()).toBe(1);
  });

  it('records a time, a distance and a rep count for other exercises', async () => {
    const user = userEvent.setup();
    renderApp('/workouts?tab=records');

    await addFromTab(user, async (form) => {
      await user.type(within(form).getByLabelText('Exercise'), '5 km run');
      await user.click(within(form).getByRole('radio', { name: 'Time' }));
      await user.type(within(form).getByLabelText('Time'), '21:45');
    });
    await addFromTab(user, async (form) => {
      await user.type(within(form).getByLabelText('Exercise'), 'Long run');
      await user.click(within(form).getByRole('radio', { name: 'Distance' }));
      await user.type(within(form).getByLabelText('Distance (km)'), '12,5');
    });
    await addFromTab(user, async (form) => {
      await user.type(within(form).getByLabelText('Exercise'), 'Pull-ups');
      await user.click(within(form).getByRole('radio', { name: 'Reps' }));
      await user.type(within(form).getByLabelText('Reps in one go'), '18');
    });

    const list = await screen.findByRole('region', { name: 'Personal records' });
    await waitFor(() => expect(within(list).getAllByRole('link')).toHaveLength(3));
    expect(list).toHaveTextContent('Time: 21:45');
    expect(list).toHaveTextContent('Distance: 12.5 km');
    expect(list).toHaveTextContent('Reps: 18 reps');
  });

  it('will not save a time that is not a time, or a lift without a weight', async () => {
    const user = userEvent.setup();
    renderApp('/workouts?tab=records');
    await user.click(await screen.findByRole('button', { name: 'Add record' }));
    const form = await dialog('Add personal record');
    const save = within(form).getByRole('button', { name: 'Save' });

    await user.type(within(form).getByLabelText('Exercise'), 'Sprint');
    expect(save).toBeDisabled(); // no weight yet
    await user.click(within(form).getByRole('radio', { name: 'Time' }));
    await user.type(within(form).getByLabelText('Time'), '99:99');
    expect(save).toBeDisabled();
    await user.clear(within(form).getByLabelText('Time'));
    await user.type(within(form).getByLabelText('Time'), '0:11');
    expect(save).toBeEnabled();
  });

  it('suggests catalogue exercises so records line up with the exercise page', async () => {
    const user = userEvent.setup();
    const device = makeDevice();
    renderApp('/workouts?tab=records', device);
    await addFromTab(user, async (form) => {
      await user.type(within(form).getByLabelText('Exercise'), 'bench press');
      await user.click((await within(form).findAllByRole('button', { name: /bench press/i }))[0]!);
      await user.type(within(form).getByLabelText('Weight (kg)'), '80');
    });
    await waitFor(async () => expect(await device.db.records.count()).toBe(1));
    const [saved] = await device.db.records.toArray();
    expect(saved!.catalogId).not.toBeNull();
    expect(saved!.exerciseKey).toBe(saved!.catalogId);

    await user.click(await screen.findByRole('link', { name: /bench/i }));
    expect(await screen.findByRole('link', { name: 'How to do this exercise' })).toBeInTheDocument();
  });

  it('edits a record', async () => {
    const user = userEvent.setup();
    const device = makeDevice();
    await device.repos.records.save(record({ id: 'e1', value: 100, reps: 5 }));
    renderApp(`/records/${encodeURIComponent(exerciseKey('Squat', null))}`, device);
    await user.click(await screen.findByRole('button', { name: /Options for 100 kg × 5/ }));
    await user.click(await screen.findByRole('button', { name: 'Edit' }));
    const form = await dialog('Edit record');
    const weight = within(form).getByLabelText('Weight (kg)');
    await user.clear(weight);
    await user.type(weight, '102.5');
    await user.click(within(form).getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('region', { name: 'Weight' })).toHaveTextContent('102.5 kg × 5');
    expect(await device.db.records.count()).toBe(1);
  });
});

describe('on an exercise page', () => {
  it('shows the bests for that exercise and adds a record without retyping the name', async () => {
    const user = userEvent.setup();
    const device = makeDevice();
    const [target] = await device.repos.exercises.search('bench press', { muscle: null, equipment: null });
    renderApp(`/exercises/${encodeURIComponent(target!.id)}`, device);

    const records = await screen.findByRole('region', { name: 'Personal records' });
    expect(records).toHaveTextContent('No record yet for this exercise.');
    await user.click(within(records).getByRole('button', { name: 'Add record' }));
    const form = await dialog('Add personal record');
    expect(within(form).getByLabelText('Exercise')).toHaveValue(target!.name);
    await user.type(within(form).getByLabelText('Weight (kg)'), '90');
    await user.type(within(form).getByLabelText('Reps'), '3');
    await user.click(within(form).getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(screen.getByRole('region', { name: 'Personal records' })).toHaveTextContent('90 kg × 3'));
    expect((await device.db.records.toArray())[0]).toMatchObject({ catalogId: target!.id, exerciseKey: target!.id });
  });
});

describe('during a workout', () => {
  const planWith = (kg: number, reps = 5) => ({
    ...newTrainingPlan('Legs', 'daily', { 0: [{ name: 'Squat', notes: '', catalogId: null, sets: [{ reps, weight: kg }] }] }),
    isActive: true,
  });

  const startAndTick = async (user: User) => {
    await user.click(await screen.findByRole('button', { name: 'Start workout' }));
    await user.click(await screen.findByRole('button', { name: 'Set 1 not done' }));
  };

  it('offers to save a set that beats the stored record, and saves it', async () => {
    const user = userEvent.setup();
    const device = makeDevice();
    await device.repos.records.save(record({ id: 'old', value: 100, reps: 5 }));
    await device.repos.trainingPlans.save(planWith(105));
    renderApp('/', device);
    await startAndTick(user);

    const prompt = await screen.findByText('New personal best!');
    expect(prompt.parentElement).toHaveTextContent('Squat: 105 kg × 5');
    expect(prompt.parentElement).toHaveTextContent('≈ 122.5 kg 1RM');
    expect(await device.db.records.count()).toBe(1); // not saved until asked

    await user.click(screen.getByRole('button', { name: 'Save as PR' }));
    expect(await screen.findByText('Personal record saved')).toBeInTheDocument();
    expect(screen.queryByText('New personal best!')).not.toBeInTheDocument();
    const saved = await device.db.records.toArray();
    expect(saved).toHaveLength(2);
    expect(saved.find((r) => r.id !== 'old')).toMatchObject({ value: 105, reps: 5, exerciseKey: exerciseKey('Squat', null) });
  });

  it('stays quiet when the set is not a record, or when there was no record to beat', async () => {
    const user = userEvent.setup();
    const lighter = makeDevice();
    await lighter.repos.records.save(record({ value: 100, reps: 5 }));
    await lighter.repos.trainingPlans.save(planWith(95));
    renderApp('/', lighter);
    await startAndTick(user);
    await screen.findByText('1/1 sets done');
    await settle();
    expect(screen.queryByText('New personal best!')).not.toBeInTheDocument();
    cleanup();

    const first = makeDevice();
    await first.repos.trainingPlans.save(planWith(200));
    renderApp('/', first);
    await startAndTick(user);
    await screen.findByText('1/1 sets done');
    await settle();
    expect(screen.queryByText('New personal best!')).not.toBeInTheDocument(); // the first record beats nothing
  });

  it('can be dismissed, and does not appear when a set is un-ticked', async () => {
    const user = userEvent.setup();
    const device = makeDevice();
    await device.repos.records.save(record({ value: 100, reps: 5 }));
    await device.repos.trainingPlans.save(planWith(105));
    renderApp('/', device);
    await startAndTick(user);
    await user.click(await screen.findByRole('button', { name: 'Not now' }));
    expect(screen.queryByText('New personal best!')).not.toBeInTheDocument();
    expect(await device.db.records.count()).toBe(1);

    await user.click(screen.getByRole('button', { name: 'Set 1 done' })); // un-tick
    await screen.findByText('0/1 sets done');
    await settle();
    expect(screen.queryByText('New personal best!')).not.toBeInTheDocument();
  });

  it('counts a bodyweight set as reps', async () => {
    const user = userEvent.setup();
    const device = makeDevice();
    await device.repos.records.save(record({ exerciseKey: exerciseKey('Pull-ups', null), exerciseName: 'Pull-ups', metric: 'reps', value: 10, reps: null }));
    await device.repos.trainingPlans.save({
      ...newTrainingPlan('Back', 'daily', { 0: [{ name: 'Pull-ups', notes: '', catalogId: null, sets: [{ reps: 12, weight: null }] }] }),
      isActive: true,
    });
    renderApp('/', device);
    await startAndTick(user);
    const prompt = await screen.findByText('New personal best!');
    expect(prompt.parentElement).toHaveTextContent('Pull-ups: 12 reps');
  });
});
