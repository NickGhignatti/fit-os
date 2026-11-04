// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { newTrainingPlan } from '../domain/edit';
import { exerciseKey, type ProgressEntry } from '../domain/progress';
import { makeDevice, renderApp } from './testing';
import { Tables } from '../data/schema';

afterEach(cleanup);

const dialog = (name: string | RegExp) => screen.findByRole('dialog', { name });

/** Gives asynchronous work time to show something, before asserting that nothing appeared. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 150));
type User = ReturnType<typeof userEvent.setup>;

/** Progress tab -> Log progress -> fill the dialog -> Save. */
const addFromTab = async (user: User, fill: (form: HTMLElement) => Promise<void>) => {
  await user.click(await screen.findByRole('button', { name: 'Progress actions' }));
  await user.click(await screen.findByRole('button', { name: 'Log progress' }));
  const form = await dialog('Log progress');
  await fill(form);
  await user.click(within(form).getByRole('button', { name: 'Save' }));
};

const entry = (over: Partial<ProgressEntry> = {}): ProgressEntry => ({
  id: `r-${Math.random()}`, exerciseKey: exerciseKey('Squat', null), exerciseName: 'Squat', catalogId: null,
  metric: 'weight', value: 100, reps: 5, date: '2026-09-01', note: '', ...over,
});

describe('the Progress tab', () => {
  it('starts empty, and logs a lift with its reps', async () => {
    const user = userEvent.setup();
    renderApp('/workouts?tab=progress');
    expect(await screen.findByText(/Nothing tracked yet/)).toBeInTheDocument();

    await addFromTab(user, async (form) => {
      await user.type(within(form).getByLabelText('Exercise'), 'Back squat');
      await user.type(within(form).getByLabelText('Weight (kg)'), '100');
      await user.type(within(form).getByLabelText('Reps'), '5');
      expect(within(form).getByRole('status')).toHaveTextContent('Estimated one-rep max: 116.67 kg');
      fireEvent.change(within(form).getByLabelText('Date'), { target: { value: '2026-10-01' } });
      await user.type(within(form).getByLabelText('Note (optional)'), 'belt on');
    });

    const list = await screen.findByRole('region', { name: 'Progress' });
    expect(list).toHaveTextContent('Back squat');
    expect(list).toHaveTextContent('Weight: 100 kg × 5');

    await user.click(within(list).getByRole('link', { name: /Back squat/ }));
    const weight = await screen.findByRole('region', { name: 'Weight' });
    expect(weight).toHaveTextContent('100 kg × 5');
    expect(weight).toHaveTextContent('≈ 116.67 kg 1RM');
    expect(weight).toHaveTextContent('2026-10-01');
    expect(weight).toHaveTextContent('belt on');
    expect(within(weight).getByText('Best')).toBeInTheDocument();
  });

  it('moves the Best badge to a better result, charts the trend, and deletes an entry', async () => {
    const user = userEvent.setup();
    const device = makeDevice();
    await device.repos.progress.save(entry({ id: 'old', value: 100, reps: 5, date: '2026-08-01' }));
    renderApp(`/progress/${encodeURIComponent(exerciseKey('Squat', null))}`, device);

    expect(await screen.findByText('Best')).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /trend/ })).not.toBeInTheDocument(); // one point is not a trend

    await user.click(screen.getByRole('button', { name: 'Progress actions' }));
    await user.click(await screen.findByRole('button', { name: 'Log progress' }));
    const form = await dialog('Log progress');
    expect(within(form).getByLabelText('Exercise')).toHaveAttribute('readonly'); // adding to this exercise
    await user.type(within(form).getByLabelText('Weight (kg)'), '110');
    await user.type(within(form).getByLabelText('Reps'), '5');
    await user.click(within(form).getByRole('button', { name: 'Save' }));

    const section = await screen.findByRole('region', { name: 'Weight' });
    await waitFor(() => expect(within(section).getAllByText(/kg × 5/)).toHaveLength(3)); // best, and the two rows
    expect(section).toHaveTextContent('110 kg × 5');
    expect(within(section).getAllByText('Best')).toHaveLength(1);
    expect(within(section).getByRole('img', { name: 'Weight trend over 2 entries' })).toBeInTheDocument();
    expect(within(section).getByText('110 kg × 5', { selector: '.big-number' })).toBeInTheDocument();

    await user.click(within(section).getByRole('button', { name: /Options for 110 kg × 5/ }));
    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    await user.click(within(await dialog('Delete entry?')).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(screen.getByRole('region', { name: 'Weight' })).toHaveTextContent('100 kg × 5'));
    expect(await device.store.direct.count('records')).toBe(1);
  });

  it('logs a time, a distance and a rep count for other exercises', async () => {
    const user = userEvent.setup();
    renderApp('/workouts?tab=progress');

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

    const list = await screen.findByRole('region', { name: 'Progress' });
    await waitFor(() => expect(within(list).getAllByRole('link')).toHaveLength(3));
    expect(list).toHaveTextContent('Time: 21:45');
    expect(list).toHaveTextContent('Distance: 12.5 km');
    expect(list).toHaveTextContent('Reps: 18 reps');
  });

  it('will not save a time that is not a time, or a lift without a weight', async () => {
    const user = userEvent.setup();
    renderApp('/workouts?tab=progress');
    await user.click(await screen.findByRole('button', { name: 'Progress actions' }));
    await user.click(await screen.findByRole('button', { name: 'Log progress' }));
    const form = await dialog('Log progress');
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

  it('suggests catalogue exercises so progress lines up with the exercise page', async () => {
    const user = userEvent.setup();
    const device = makeDevice();
    renderApp('/workouts?tab=progress', device);
    await addFromTab(user, async (form) => {
      await user.type(within(form).getByLabelText('Exercise'), 'bench press');
      await user.click((await within(form).findAllByRole('button', { name: /bench press/i }))[0]!);
      await user.type(within(form).getByLabelText('Weight (kg)'), '80');
    });
    await waitFor(async () => expect(await device.store.direct.count('records')).toBe(1));
    const [saved] = await device.store.direct.list(Tables.progress);
    expect(saved!.catalogId).not.toBeNull();
    expect(saved!.exerciseKey).toBe(saved!.catalogId);

    await user.click(await screen.findByRole('link', { name: /bench/i }));
    expect(await screen.findByRole('link', { name: 'How to do this exercise' })).toBeInTheDocument();
  });

  it('edits an entry', async () => {
    const user = userEvent.setup();
    const device = makeDevice();
    await device.repos.progress.save(entry({ id: 'e1', value: 100, reps: 5 }));
    renderApp(`/progress/${encodeURIComponent(exerciseKey('Squat', null))}`, device);
    await user.click(await screen.findByRole('button', { name: /Options for 100 kg × 5/ }));
    await user.click(await screen.findByRole('button', { name: 'Edit' }));
    const form = await dialog('Edit entry');
    const weight = within(form).getByLabelText('Weight (kg)');
    await user.clear(weight);
    await user.type(weight, '102.5');
    await user.click(within(form).getByRole('button', { name: 'Save' }));
    const region = await screen.findByRole('region', { name: 'Weight' });
    await waitFor(() => expect(region).toHaveTextContent('102.5 kg × 5'));
    expect(await device.store.direct.count('records')).toBe(1);
  });
});

describe('on an exercise page', () => {
  it('shows the bests for that exercise and logs progress without retyping the name', async () => {
    const user = userEvent.setup();
    const device = makeDevice();
    const [target] = await device.repos.exercises.search('bench press', { muscle: null, equipment: null });
    renderApp(`/exercises/${encodeURIComponent(target!.id)}`, device);

    const progress = await screen.findByRole('region', { name: 'Progress' });
    expect(progress).toHaveTextContent('Nothing logged yet for this exercise.');
    await user.click(within(progress).getByRole('button', { name: 'Log progress' }));
    const form = await dialog('Log progress');
    expect(within(form).getByLabelText('Exercise')).toHaveValue(target!.name);
    await user.type(within(form).getByLabelText('Weight (kg)'), '90');
    await user.type(within(form).getByLabelText('Reps'), '3');
    await user.click(within(form).getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(screen.getByRole('region', { name: 'Progress' })).toHaveTextContent('90 kg × 3'));
    expect((await device.store.direct.list(Tables.progress))[0]).toMatchObject({ catalogId: target!.id, exerciseKey: target!.id });
  });
});

describe('during a workout', () => {
  const planWith = (kg: number, reps = 5) => ({
    ...newTrainingPlan('Legs', 'daily', { 0: [{ name: 'Squat', notes: '', catalogId: null, sets: [{ reps, weight: kg }] }] }),
    isActive: true,
  });

  const startAndTick = async (user: User) => {
    await user.click(await screen.findByRole('button', { name: /^Start / }));
    await user.click(await screen.findByRole('button', { name: 'Set 1 not done' }));
  };

  it('offers to save a set that beats the best so far, and saves it', async () => {
    const user = userEvent.setup();
    const device = makeDevice();
    await device.repos.progress.save(entry({ id: 'old', value: 100, reps: 5 }));
    await device.repos.trainingPlans.save(planWith(105));
    renderApp('/', device);
    await startAndTick(user);

    const prompt = await screen.findByText('New best!');
    expect(prompt.parentElement).toHaveTextContent('Squat: 105 kg × 5');
    expect(prompt.parentElement).toHaveTextContent('≈ 122.5 kg 1RM');
    expect(await device.store.direct.count('records')).toBe(1); // not saved until asked

    await user.click(screen.getByRole('button', { name: 'Save to progress' }));
    expect(await screen.findByText('Saved to progress')).toBeInTheDocument();
    expect(screen.queryByText('New best!')).not.toBeInTheDocument();
    const saved = await device.store.direct.list(Tables.progress);
    expect(saved).toHaveLength(2);
    expect(saved.find((r) => r.id !== 'old')).toMatchObject({ value: 105, reps: 5, exerciseKey: exerciseKey('Squat', null) });
  });

  it('stays quiet when the set is not a new best, or when there was nothing to beat', async () => {
    const user = userEvent.setup();
    const lighter = makeDevice();
    await lighter.repos.progress.save(entry({ value: 100, reps: 5 }));
    await lighter.repos.trainingPlans.save(planWith(95));
    renderApp('/', lighter);
    await startAndTick(user);
    await screen.findByText('1/1 sets done');
    await settle();
    expect(screen.queryByText('New best!')).not.toBeInTheDocument();
    cleanup();

    const first = makeDevice();
    await first.repos.trainingPlans.save(planWith(200));
    renderApp('/', first);
    await startAndTick(user);
    await screen.findByText('1/1 sets done');
    await settle();
    expect(screen.queryByText('New best!')).not.toBeInTheDocument(); // the first entry beats nothing
  });

  it('can be dismissed, and does not appear when a set is un-ticked', async () => {
    const user = userEvent.setup();
    const device = makeDevice();
    await device.repos.progress.save(entry({ value: 100, reps: 5 }));
    await device.repos.trainingPlans.save(planWith(105));
    renderApp('/', device);
    await startAndTick(user);
    await user.click(await screen.findByRole('button', { name: 'Not now' }));
    expect(screen.queryByText('New best!')).not.toBeInTheDocument();
    expect(await device.store.direct.count('records')).toBe(1);

    await user.click(screen.getByRole('button', { name: /Completed exercises/ })); // the finished exercise moved there
    await user.click(within(await screen.findByRole('dialog', { name: 'Completed exercises' })).getByRole('button', { name: 'Set 1 done' })); // un-tick
    await screen.findByText('0/1 sets done');
    await settle();
    expect(screen.queryByText('New best!')).not.toBeInTheDocument();
  });

  it('counts a bodyweight set as reps', async () => {
    const user = userEvent.setup();
    const device = makeDevice();
    await device.repos.progress.save(entry({ exerciseKey: exerciseKey('Pull-ups', null), exerciseName: 'Pull-ups', metric: 'reps', value: 10, reps: null }));
    await device.repos.trainingPlans.save({
      ...newTrainingPlan('Back', 'daily', { 0: [{ name: 'Pull-ups', notes: '', catalogId: null, sets: [{ reps: 12, weight: null }] }] }),
      isActive: true,
    });
    renderApp('/', device);
    await startAndTick(user);
    const prompt = await screen.findByText('New best!');
    expect(prompt.parentElement).toHaveTextContent('Pull-ups: 12 reps');
  });
});

describe('jumps and holds', () => {
  it('logs a jump in centimetres and a hold in seconds', async () => {
    const user = userEvent.setup();
    renderApp('/workouts?tab=progress');

    await addFromTab(user, async (form) => {
      await user.type(within(form).getByLabelText('Exercise'), 'Approach jump reach');
      await user.click(within(form).getByRole('radio', { name: 'Jump / length' }));
      await user.type(within(form).getByLabelText('Height or length (cm)'), '318,5');
    });
    await addFromTab(user, async (form) => {
      await user.type(within(form).getByLabelText('Exercise'), 'Spanish squat');
      await user.click(within(form).getByRole('radio', { name: 'Hold' }));
      await user.type(within(form).getByLabelText('Time held'), '1:15');
      expect(within(form).getByRole('status')).toHaveTextContent('1m 15s held');
    });

    const list = await screen.findByRole('region', { name: 'Progress' });
    await waitFor(() => expect(within(list).getAllByRole('link')).toHaveLength(2));
    expect(list).toHaveTextContent('Jump / length: 318.5 cm');
    expect(list).toHaveTextContent('Hold: 1m 15s');
  });

  it('offers a longer hold in a workout as a new best', async () => {
    const user = userEvent.setup();
    const device = makeDevice();
    await device.repos.progress.save(entry({ exerciseKey: exerciseKey('Plank', null), exerciseName: 'Plank', metric: 'hold', value: 45, reps: null }));
    await device.repos.trainingPlans.save({
      ...newTrainingPlan('Core', 'daily', { 0: [{ name: 'Plank', notes: '', catalogId: null, sets: [{ reps: 1, weight: null, seconds: 60 }] }] }),
      isActive: true,
    });
    renderApp('/', device);
    await user.click(await screen.findByRole('button', { name: /^Start / }));
    await user.click(await screen.findByRole('button', { name: 'Set 1 not done' }));
    const prompt = await screen.findByText('New best!');
    expect(prompt.parentElement).toHaveTextContent('Plank: 1m');
  });
});

describe('exporting progress', () => {
  /** The phone's share sheet: keeps each file handed to it. */
  let shared: File[] = [];
  const shareSheet = () => {
    shared = [];
    Object.assign(navigator, {
      canShare: (data: { files?: File[] }) => (data.files?.length ?? 0) > 0,
      share: async (data: { files: File[] }) => { shared.push(...data.files); },
    });
  };
  const readText = (file: File) => new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.readAsText(file);
  });

  it('hands every entry to the share sheet as a CSV file', async () => {
    shareSheet();
    const user = userEvent.setup();
    const device = makeDevice();
    await device.repos.progress.save(entry({ date: '2026-09-01', value: 100, reps: 5 }));
    await device.repos.progress.save(entry({ exerciseKey: 'name:vertical jump', exerciseName: 'Vertical jump', metric: 'length', value: 64, reps: null, date: '2026-09-02' }));
    renderApp('/workouts?tab=progress', device);

    await screen.findByRole('region', { name: 'Progress' });
    await user.click(screen.getByRole('button', { name: 'Progress actions' }));
    await user.click(await screen.findByRole('button', { name: 'Export as CSV' }));
    await waitFor(() => expect(shared).toHaveLength(1));
    expect(shared[0]!.name).toMatch(/^progress-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(shared[0]!.type).toBe('text/csv');
    const lines = (await readText(shared[0]!)).replace(/^﻿/, '').trim().split('\r\n');
    expect(lines).toEqual([
      'date,exercise,measurement,value,unit,reps,estimated_1rm_kg,note',
      '2026-09-01,Squat,weight,100,kg,5,116.67,',
      '2026-09-02,Vertical jump,length,64,cm,,,',
    ]);
  });

  it('exports just one exercise from its page, and offers nothing to export when empty', async () => {
    shareSheet();
    const user = userEvent.setup();
    const device = makeDevice();
    await device.repos.progress.save(entry({ value: 100, reps: 5 }));
    await device.repos.progress.save(entry({ exerciseKey: 'name:plank', exerciseName: 'Plank', metric: 'hold', value: 60, reps: null }));
    renderApp(`/progress/${encodeURIComponent(exerciseKey('Squat', null))}`, device);

    await screen.findByRole('region', { name: 'Weight' });
    await user.click(screen.getByRole('button', { name: 'Progress actions' }));
    await user.click(await screen.findByRole('button', { name: 'Export as CSV' }));
    await waitFor(() => expect(shared).toHaveLength(1));
    expect(shared[0]!.name).toMatch(/^squat-progress-/);
    expect((await readText(shared[0]!)).trim().split('\r\n')).toHaveLength(2); // the header and the squat
    cleanup();

    renderApp('/workouts?tab=progress');
    await screen.findByText(/Nothing tracked yet/);
    await user.click(screen.getByRole('button', { name: 'Progress actions' }));
    expect(await screen.findByRole('button', { name: 'Export as CSV' })).toBeDisabled();
  });
});

describe('links from when progress was called records', () => {
  it('still open the tab and an exercise page', async () => {
    const device = makeDevice();
    await device.repos.progress.save(entry({ value: 100, reps: 5 }));
    renderApp('/workouts?tab=records', device);
    expect(await screen.findByRole('region', { name: 'Progress' })).toHaveTextContent('Squat');
    cleanup();

    renderApp(`/records/${encodeURIComponent(exerciseKey('Squat', null))}`, device);
    expect(await screen.findByRole('region', { name: 'Weight' })).toHaveTextContent('100 kg × 5');
  });
});
