// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { customExerciseId } from '../domain/catalog';
import { newTrainingPlan } from '../domain/edit';
import { makeDevice, renderApp } from './testing';

afterEach(cleanup);

const dialog = (name: string | RegExp) => screen.findByRole('dialog', { name });
type User = ReturnType<typeof userEvent.setup>;

/** On a plan's picker: "Add your own exercise…", fill the form, Save. */
const createFromPicker = async (user: User, name: string, details: { muscle?: string; notes?: string } = {}) => {
  await user.type(await screen.findByLabelText('Search exercises'), name);
  await user.click(screen.getByRole('button', { name: 'Add your own exercise…' }));
  const form = await dialog('New exercise');
  expect(within(form).getByLabelText('Name')).toHaveValue(name); // what was typed carries over
  if (details.muscle) await user.selectOptions(within(form).getByLabelText('Main muscle (optional)'), details.muscle);
  if (details.notes) await user.type(within(form).getByLabelText('Notes (optional)'), details.notes);
  await user.click(within(form).getByRole('button', { name: 'Save' }));
};

describe('making up an exercise', () => {
  it('saves it on the device while adding it to a plan, linked so it is the same exercise next time', async () => {
    const user = userEvent.setup();
    const device = makeDevice();
    const plan = newTrainingPlan('Strongman', 'daily');
    await device.repos.trainingPlans.save(plan);
    renderApp(`/exercises/pick?plan=${plan.id}&day=0`, device);

    await createFromPicker(user, 'Sandbag carry', { muscle: 'forearms', notes: 'Hug it, walk 20 m' });

    // it carries straight on to "Add exercise", with the name filled in
    const add = await dialog('Add exercise');
    expect(within(add).getByLabelText('Exercise')).toHaveValue('Sandbag carry');
    await user.click(within(add).getByRole('button', { name: 'Add' }));

    await waitFor(async () => expect(await device.db.customExercises.count()).toBe(1));
    const [saved] = await device.db.customExercises.toArray();
    expect(saved).toMatchObject({ name: 'Sandbag carry', muscle: 'forearms', equipment: null, notes: 'Hug it, walk 20 m' });
    expect(saved!.id).toMatch(/^custom:/);

    const stored = (await device.repos.trainingPlans.getPlan(plan.id))!;
    expect(stored.sessions[0]![0]).toMatchObject({ name: 'Sandbag carry', catalogId: saved!.id });
  });

  it('is offered again the next time, marked as yours, with no need to create it twice', async () => {
    const user = userEvent.setup();
    const device = makeDevice();
    const plan = newTrainingPlan('Strongman', 'daily');
    await device.repos.trainingPlans.save(plan);
    const sandbag = { id: customExerciseId('abc'), name: 'Sandbag carry', muscle: 'forearms' as const, equipment: null, notes: '' };
    await device.repos.customExercises.save(sandbag);
    renderApp(`/exercises/pick?plan=${plan.id}&day=0`, device);

    await user.type(await screen.findByLabelText('Search exercises'), 'sandbag');
    // yours are on top even before searching, so wait for the search itself to replace the list
    await waitFor(() => expect(screen.queryByRole('button', { name: /3\/4 Sit-Up/ })).not.toBeInTheDocument(), { timeout: 8000 });
    const row = await screen.findByRole('button', { name: /Sandbag carry/ });
    expect(within(row).getByText('Yours')).toBeInTheDocument();
    await user.click(row);
    await user.click(within(await dialog('Add exercise')).getByRole('button', { name: 'Add' }));

    await waitFor(async () => expect((await device.repos.trainingPlans.getPlan(plan.id))!.sessions[0]).toHaveLength(1));
    expect((await device.repos.trainingPlans.getPlan(plan.id))!.sessions[0]![0]!.catalogId).toBe(sandbag.id);
    expect(await device.db.customExercises.count()).toBe(1); // still just the one
  });

  it('needs a name', async () => {
    const user = userEvent.setup();
    renderApp('/workouts?tab=library', makeDevice());
    await user.click(await screen.findByRole('button', { name: 'Add your own exercise…' }));
    const form = await dialog('New exercise');
    expect(within(form).getByRole('button', { name: 'Save' })).toBeDisabled();
    await user.type(within(form).getByLabelText('Name'), '   ');
    expect(within(form).getByRole('button', { name: 'Save' })).toBeDisabled();
    await user.type(within(form).getByLabelText('Name'), 'Bear crawl');
    expect(within(form).getByRole('button', { name: 'Save' })).toBeEnabled();
  });
});

describe('the exercise library', () => {
  it('lets you create one there, and shows it at once, filterable like the rest', async () => {
    const user = userEvent.setup();
    const device = makeDevice();
    renderApp('/workouts?tab=library', device);

    await user.click(await screen.findByRole('button', { name: 'Add your own exercise…' }));
    const form = await dialog('New exercise');
    await user.type(within(form).getByLabelText('Name'), 'Zzz Sled push');
    await user.selectOptions(within(form).getByLabelText('Main muscle (optional)'), 'quadriceps');
    await user.selectOptions(within(form).getByLabelText('Equipment (optional)'), 'other');
    await user.click(within(form).getByRole('button', { name: 'Save' }));

    expect(await screen.findByText(/Saved “Zzz Sled push” to your exercises/)).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: /Zzz Sled push/ })).toBeInTheDocument(); // no reload needed
    await user.click(screen.getByRole('button', { name: 'Quads' }));
    await waitFor(() => expect(screen.getByRole('link', { name: /Zzz Sled push/ })).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Quads' })); // off
    await user.click(screen.getByRole('button', { name: 'Chest' }));
    await waitFor(() => expect(screen.queryByRole('link', { name: /Zzz Sled push/ })).not.toBeInTheDocument());
    expect(await device.db.customExercises.count()).toBe(1);
  });

  it('survives closing and reopening the app', async () => {
    const device = makeDevice();
    await device.repos.customExercises.save({ id: customExerciseId('keep'), name: 'Kept exercise', muscle: null, equipment: null, notes: '' });
    cleanup();
    renderApp('/workouts?tab=library', device); // a fresh render of the app on the same device storage
    expect(await screen.findByRole('link', { name: /Kept exercise/ })).toBeInTheDocument();
  });
});

describe("an exercise's own page", () => {
  const seed = async () => {
    const device = makeDevice();
    const sandbag = { id: customExerciseId('page'), name: 'Sandbag carry', muscle: 'forearms' as const, equipment: 'other' as const, notes: 'Hug it\nwalk 20 m' };
    await device.repos.customExercises.save(sandbag);
    return { device, sandbag };
  };

  it('shows what you wrote, without the catalogue extras, and says it is yours', async () => {
    const { device, sandbag } = await seed();
    renderApp(`/exercises/${encodeURIComponent(sandbag.id)}`, device);

    expect(await screen.findByRole('heading', { name: 'Sandbag carry' })).toBeInTheDocument();
    expect(screen.getByText('Your exercise')).toBeInTheDocument();
    expect(screen.getByText('Forearms')).toBeInTheDocument();
    expect(screen.getByText('Other')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Notes' })).toBeInTheDocument();
    expect(screen.queryByText(/free-exercise-db/)).not.toBeInTheDocument();
    expect(screen.queryByText('Strength')).not.toBeInTheDocument(); // no made-up category
    expect(document.querySelector('img')).toBeNull();
    expect(screen.getByText('Saved on this device only.')).toBeInTheDocument();
  });

  it('can be edited', async () => {
    const user = userEvent.setup();
    const { device, sandbag } = await seed();
    renderApp(`/exercises/${encodeURIComponent(sandbag.id)}`, device);

    await user.click(await screen.findByRole('button', { name: 'Edit' }));
    const form = await dialog('Edit your exercise');
    const name = within(form).getByLabelText('Name');
    await user.clear(name);
    await user.type(name, 'Sandbag walk');
    await user.click(within(form).getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('heading', { name: 'Sandbag walk' })).toBeInTheDocument();
    expect((await device.repos.customExercises.getAll())[0]).toMatchObject({ id: sandbag.id, name: 'Sandbag walk' }); // same id, so plans stay linked
  });

  it('can be deleted, and plans that used it keep its name', async () => {
    const user = userEvent.setup();
    const { device, sandbag } = await seed();
    const plan = newTrainingPlan('Strongman', 'daily', { 0: [{ name: 'Sandbag carry', notes: '', catalogId: sandbag.id, sets: [{ reps: 5, weight: 40 }] }] });
    await device.repos.trainingPlans.save(plan);
    renderApp(`/exercises/${encodeURIComponent(sandbag.id)}`, device);

    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    const confirm = await dialog('Delete exercise?');
    expect(confirm).toHaveTextContent(/keep its name, and its records stay/);
    await user.click(within(confirm).getByRole('button', { name: 'Delete' }));

    await waitFor(async () => expect(await device.db.customExercises.count()).toBe(0));
    expect(await screen.findByRole('button', { name: 'Add your own exercise…' })).toBeInTheDocument(); // back in the library
    expect((await device.repos.trainingPlans.getPlan(plan.id))!.sessions[0]![0]).toMatchObject({ name: 'Sandbag carry' });
  });

  it('offers no edit or delete for a bundled exercise', async () => {
    const device = makeDevice();
    const [first] = await device.repos.exercises.search('bench press', { muscle: null, equipment: null });
    renderApp(`/exercises/${encodeURIComponent(first!.id)}`, device);
    expect(await screen.findByRole('heading', { name: 'How to do it' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
  });
});

describe('records for your own exercises', () => {
  it('line up with the exercise, so the page and the record share a history', async () => {
    const user = userEvent.setup();
    const device = makeDevice();
    const sandbag = { id: customExerciseId('rec'), name: 'Sandbag carry', muscle: null, equipment: null, notes: '' };
    await device.repos.customExercises.save(sandbag);
    renderApp('/workouts?tab=records', device);

    await user.click(await screen.findByRole('button', { name: 'Add a record' }));
    await user.click(await screen.findByRole('button', { name: 'Add record' }));
    const form = await dialog('Add personal record');
    await user.type(within(form).getByLabelText('Exercise'), 'sandbag');
    await user.click(await within(form).findByRole('button', { name: 'Sandbag carry' }));
    await user.type(within(form).getByLabelText('Weight (kg)'), '40');
    await user.click(within(form).getByRole('button', { name: 'Save' }));

    await waitFor(async () => expect(await device.db.records.count()).toBe(1));
    const [record] = await device.db.records.toArray();
    expect(record).toMatchObject({ catalogId: sandbag.id, exerciseKey: sandbag.id, value: 40 });
  });
});
