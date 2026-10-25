// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { FoodRecognizer } from '../data/foodRecognizer';
import type { RecogniserModel } from '../domain/photoFoods';
import { makeDevice, renderApp } from './testing';

afterEach(cleanup);

beforeAll(() => {
  // jsdom has no object URLs; the screen only uses them to show the photo back.
  URL.createObjectURL = () => 'blob:meal';
  URL.revokeObjectURL = () => {};
});

const model: RecogniserModel = {
  size: 224,
  grid: 1,
  threshold: 0.3,
  classes: [
    { id: 'pasta', name: 'Pasta', foods: [{ code: '000805', grams: 200 }], share: null },
    { id: 'tomato-sauce', name: 'Tomato sauce', foods: [{ code: '006670', grams: 80 }, { code: '009210', grams: 5 }], share: null },
    { id: 'water', name: 'Water', foods: [], share: null },
    { id: 'rice', name: 'Rice', foods: [{ code: '000105', grams: 180 }], share: null },
  ],
};

/** Sees pasta (90%) with tomato sauce (50%) and a glass of water; rice is a long shot (20%). */
const recognizer: FoodRecognizer = {
  recognize: async (_photo, onProgress) => {
    onProgress?.(1);
    return { model, recognition: { likelihoods: Float32Array.from([0.9, 0.5, 0.8, 0.2]), patches: Float32Array.from([1, 0, 0, 0, 0]) } };
  },
};

const takePhoto = () => fireEvent.change(screen.getByLabelText('Choose a photo'), { target: { files: [new File(['jpeg'], 'meal.jpg', { type: 'image/jpeg' })] } });

describe('logging a meal from a photo', () => {
  it('lists the foods it sees with their weights, follows every change, and logs what was checked', async () => {
    const user = userEvent.setup();
    const device = { ...makeDevice(), foodRecognizer: recognizer };
    renderApp('/food/photo?date=2026-10-25&meal=Lunch', device);
    takePhoto();

    // Pasta, cooked (CREA 000805, 175 kcal per 100 g): 200 g is 350 kcal.
    const pasta = await screen.findByRole('region', { name: 'Pasta' });
    expect(within(pasta).getByLabelText('Grams of Pasta')).toHaveValue('200');
    expect(within(pasta).getByText('350 kcal')).toBeInTheDocument();
    // Tomato sauce is passata (80 g, 21 kcal per 100 g) with olive oil (5 g, 899): 16.8 + 45 = 62 kcal.
    const sauce = screen.getByRole('region', { name: 'Tomato sauce' });
    expect(within(sauce).getByText('62 kcal')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Water' })).not.toBeInTheDocument(); // nothing to log
    expect(within(screen.getByRole('region', { name: 'This meal' })).getByText('412')).toBeInTheDocument();

    // Halving the pasta halves its energy and the meal's total follows.
    await user.clear(within(pasta).getByLabelText('Grams of Pasta'));
    await user.type(within(pasta).getByLabelText('Grams of Pasta'), '100');
    expect(within(pasta).getByText('175 kcal')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'This meal' })).getByText('237')).toBeInTheDocument();

    // Doubling the sauce doubles both of its foods.
    await user.clear(within(sauce).getByLabelText('Grams of Tomato sauce'));
    await user.type(within(sauce).getByLabelText('Grams of Tomato sauce'), '170');
    await user.click(within(sauce).getByText('Ingredients'));
    expect(within(sauce).getByLabelText('Grams of Pomodori, passata')).toHaveValue('160');
    expect(within(sauce).getByLabelText('Grams of Olio di oliva extra vergine')).toHaveValue('10');

    // The sauce was really rice: swapping gives rice's usual 180 g (CREA 000105, 100 kcal per 100 g).
    await user.click(within(screen.getByRole('group', { name: 'Not Tomato sauce?' })).getByRole('button', { name: 'Rice' }));
    const rice = await screen.findByRole('region', { name: 'Rice' });
    expect(within(rice).getByText('180 kcal')).toBeInTheDocument();

    // A missing food is added by hand.
    await user.click(screen.getByRole('button', { name: 'Add a food' }));
    await user.type(within(screen.getByRole('dialog')).getByLabelText('Search foods'), 'parmigiano');
    await user.click(await within(screen.getByRole('dialog')).findByRole('button', { name: /Parmigiano Reggiano DOP/ }));
    expect(screen.getByRole('region', { name: 'Parmigiano Reggiano DOP' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Log 3 foods to Lunch' }));
    await waitFor(async () => {
      const day = await device.repos.foodLog.getDay('2026-10-25');
      expect(day.entries.map((e) => [e.meal, e.portion.food.id, e.portion.grams])).toEqual([
        ['Lunch', 'crea:000805', 100], ['Lunch', 'crea:000105', 180], ['Lunch', 'crea:166000', 50],
      ]);
    });
  });

  it('says so when the recogniser cannot be loaded, and lets the photo be tried again', async () => {
    const device = { ...makeDevice(), foodRecognizer: { recognize: async () => { throw new TypeError('offline'); } } };
    renderApp('/food/photo?date=2026-10-25&meal=Lunch', device);
    takePhoto();
    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't look at the photo");
    expect(screen.getByLabelText('Choose a photo')).toBeInTheDocument();
  });
});
