// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Tables } from '../data/schema';
import { newTrainingPlan } from '../domain/edit';
import { emptyDay, withEntry } from '../domain/foodLog';
import { portionOf } from '../domain/nutrition';
import { envelopeFile, parseEnvelope } from '../transfer/transfer';
import { today } from './format';
import { makeDevice, renderApp } from './testing';

afterEach(cleanup);

// jsdom's File has no text(); browsers do.
const fileOf = (content: string, name: string) =>
  Object.assign(new File([content], name, { type: 'application/json' }), { text: async () => content });

const readText = (file: File) => new Promise<string>((resolve) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result as string);
  reader.readAsText(file);
});

/** The phone's share sheet: records each file handed to it. */
let shared: File[] = [];
beforeEach(() => {
  shared = [];
  Object.assign(navigator, {
    canShare: (data: { files?: File[] }) => (data.files?.length ?? 0) > 0,
    share: async (data: { files: File[] }) => { shared.push(...data.files); },
  });
});

const plan = newTrainingPlan('Strength', 'daily', { 0: [{ name: 'Squat', notes: '', catalogId: null, sets: [{ reps: 5, weight: 100 }] }] });

describe('moving data between phones with a file', () => {
  it('exports everything through the share sheet, and the other phone recognises the file as a backup wherever it is imported', async () => {
    const user = userEvent.setup({ applyAccept: false });
    const first = makeDevice();
    await first.repos.trainingPlans.save(plan);
    await first.repos.profile.setWeight('2026-10-20', 80);
    renderApp('/profile', first);
    await user.click(await screen.findByRole('button', { name: 'Export backup' }));
    await waitFor(() => expect(shared).toHaveLength(1));
    expect(shared[0]!.name).toBe(`tracker-backup-${today()}.fitos.txt`); // Chrome on Android refuses to share .json
    const backup = await readText(shared[0]!);
    cleanup();

    // On the other phone, from the workouts' + rather than from Profile.
    const second = makeDevice();
    renderApp('/workouts', second);
    await user.upload(await screen.findByLabelText('File to import'), fileOf(backup, shared[0]!.name));
    const confirm = await screen.findByRole('dialog', { name: 'Import this backup?' });
    expect(confirm).toHaveTextContent('1 workout plans, 0 diets, 0 workouts, 0 food-log days and 1 weigh-ins');
    await user.click(within(confirm).getByRole('button', { name: 'Import' }));
    expect(await screen.findByText('Backup imported')).toBeInTheDocument();
    expect((await second.store.direct.list(Tables.trainingPlans)).map((p) => p.name)).toEqual(['Strength']);
    expect((await second.store.direct.list(Tables.weightEntries)).map((w) => w.kg)).toEqual([80]);
  });

  it('shares a day of food log as a file that the other phone adds to that day', async () => {
    const user = userEvent.setup({ applyAccept: false });
    const first = makeDevice();
    const pasta = (await first.repos.basicFoods.byCode('000805'))!;
    await first.repos.foodLog.saveDay(withEntry(emptyDay(today()), { id: 'e1', meal: 'Lunch', portion: portionOf(pasta, 100) }));
    renderApp('/tracker', first);
    await user.click(await screen.findByRole('button', { name: "Share this day's food log" }));
    await user.click(within(await screen.findByRole('dialog', { name: `Share “Food log ${today()}”` })).getByRole('button', { name: /Share as file/ }));
    await waitFor(() => expect(shared).toHaveLength(1));
    const text = await readText(shared[0]!);
    expect(parseEnvelope(text)?.kind).toBe('food_log_day');
    cleanup();

    const second = makeDevice();
    renderApp('/profile', second);
    await user.upload(await screen.findByLabelText('File to import'), fileOf(text, shared[0]!.name));
    expect(await screen.findByText(`Imported food log “${today()}”`)).toBeInTheDocument();
    const day = await second.repos.foodLog.getDay(today());
    expect(day.entries.map((e) => [e.meal, e.portion.food.id, e.portion.grams])).toEqual([['Lunch', 'crea:000805', 100]]);
  });

  it('imports a file shared to the app from another app, then shows what it brought', async () => {
    const waiting = [{ name: 'strength.fitos.json', text: envelopeFile('training_plan', plan) }];
    const device = { ...makeDevice(), sharedFiles: { take: async () => waiting.shift() ?? null } };
    renderApp('/import', device);
    expect(await screen.findByText('Imported workout plan “Strength”')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Workouts' })).toBeInTheDocument();
    expect((await device.store.direct.list(Tables.trainingPlans)).map((p) => p.name)).toEqual(['Strength']);
  });

  it('says so when the app is opened to import but no file came with it', async () => {
    renderApp('/import', { ...makeDevice(), sharedFiles: { take: async () => null } });
    expect(await screen.findByText(/No file to import/)).toBeInTheDocument();
  });
});
