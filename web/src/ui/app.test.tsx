// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Blob as NodeBlob } from 'node:buffer';
import { webcrypto } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { addMeal, newDietPlan, newTrainingPlan } from '../domain/edit';
import { InMemoryTransferGateway } from '../transfer/gateway';
import { makeDevice, renderApp } from './testing';

// jsdom lacks WebCrypto and Blob streams, which the transfer encryption needs; Node has both.
Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
globalThis.Blob = NodeBlob as unknown as typeof Blob;

afterEach(cleanup);

const dialog = (name: string | RegExp) => screen.findByRole('dialog', { name });

/** Opens a ⋮ menu and picks an entry, like a user would. */
const chooseFromMenu = async (user: ReturnType<typeof userEvent.setup>, menu: string, entry: string) => {
  await user.click(screen.getByRole('button', { name: menu }));
  await user.click(await screen.findByRole('button', { name: entry }));
};

const firstFoodResult = async () => (await screen.findAllByRole('button', { name: /per 100 g/ }))[0]!;

describe('navigation', () => {
  it('opens on Today with the five tabs, and unknown addresses go back there', async () => {
    renderApp('/nowhere/at/all');
    expect(await screen.findByRole('heading', { name: 'Today' })).toBeInTheDocument();
    const tabs = within(screen.getByRole('navigation', { name: 'Main' })).getAllByRole('link');
    expect(tabs.map((t) => t.textContent)).toEqual(['Today', 'Workouts', 'Food', 'Tracker', 'Profile']);
  });

  it('hides the tab bar on detail screens and rejects a bad date', async () => {
    renderApp('/day/not-a-date');
    expect(await screen.findByText(/isn't a date/)).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Main' })).not.toBeInTheDocument();
  });
});

describe('the + on Today', () => {
  it('logs a weight, or goes to the food tracker', async () => {
    const user = userEvent.setup();
    const device = makeDevice();
    renderApp('/', device);

    await user.click(await screen.findByRole('button', { name: 'Log food or weight' }));
    await user.click(within(await dialog('Log food or weight')).getByRole('button', { name: 'Weight' }));
    await user.type(await screen.findByLabelText('Weight (kg)'), '80');
    await user.click(within(await dialog('Weight')).getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Logged 80 kg')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Log food or weight' }));
    await user.click(within(await dialog('Log food or weight')).getByRole('button', { name: 'Food' }));
    expect(await screen.findByRole('heading', { name: 'Tracker' })).toBeInTheDocument();
  });
});

describe('what Today shows', () => {
  it('leaves out training and meals on a day with nothing planned', async () => {
    const device = makeDevice();
    await device.repos.trainingPlans.save({ ...newTrainingPlan('Rest', 'weekly'), isActive: true }); // no session on any day
    renderApp('/', device);
    await screen.findByRole('region', { name: 'Energy consumed' });
    expect(screen.queryByRole('heading', { name: 'Training' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Meals' })).not.toBeInTheDocument();
    cleanup();

    await device.repos.trainingPlans.save({ ...newTrainingPlan('Legs', 'daily', { 0: [{ name: 'Squat', notes: '', catalogId: null, sets: [{ reps: 5, weight: 100 }] }] }), isActive: true });
    renderApp('/', device);
    expect(await screen.findByRole('heading', { name: 'Training' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start Legs' })).toBeInTheDocument();
  });
});

describe('a workout plan, from creation to a logged session', () => {
  it('builds a plan with a catalogue exercise, activates it, and ticks off sets on Today', async () => {
    const user = userEvent.setup();
    renderApp('/workouts');

    await user.click(await screen.findByRole('button', { name: 'New workout' }));
    const create = await dialog('New workout');
    await user.clear(within(create).getByLabelText('Name'));
    await user.type(within(create).getByLabelText('Name'), 'Push day');
    await user.click(within(create).getByRole('button', { name: 'Create' }));

    expect(await screen.findByRole('heading', { name: 'Push day' })).toBeInTheDocument();
    expect(screen.getByText(/No exercises yet/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Add exercise' }));
    await user.type(await screen.findByLabelText('Search exercises'), 'bench press');
    const results = await screen.findAllByRole('button', { name: /bench/i });
    await user.click(results[0]!);

    const add = await dialog('Add exercise');
    await user.click(within(add).getByRole('button', { name: 'Add' }));
    expect(await screen.findByText(/3 × 10/)).toBeInTheDocument();

    await chooseFromMenu(user, 'More options', 'Set as active');
    expect(await screen.findByText('Daily · Active')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Back' }));
    await user.click(await screen.findByRole('link', { name: 'Today' }));

    await user.click(await screen.findByRole('button', { name: 'Start Push day' }));
    expect(await screen.findByText('0/3 sets done')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Set 1 not done' }));
    expect(await screen.findByText('1/3 sets done')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Set 1 done' }));
    expect(await screen.findByText('0/3 sets done')).toBeInTheDocument();
  });

  it('edits a set that deviates from the plan', async () => {
    const user = userEvent.setup();
    const device = makeDevice();
    await device.repos.trainingPlans.save({ ...newTrainingPlan('Legs', 'daily', { 0: [{ name: 'Squat', notes: '', catalogId: null, sets: [{ reps: 5, weight: 100 }] }] }), isActive: true });
    renderApp('/', device);

    await user.click(await screen.findByRole('button', { name: 'Start Legs' }));
    await user.click(await screen.findByRole('button', { name: /^Set 1 \d/ }));
    const editor = await dialog('Set 1');
    const actual = within(editor).getAllByLabelText('Reps')[1]!;
    await user.type(actual, '4');
    await user.click(within(editor).getByLabelText('Completed'));
    await user.click(within(editor).getByRole('button', { name: 'Save' }));

    expect(await screen.findByText(/Did 4/)).toBeInTheDocument();
  });

  it('shows a deleted plan as gone instead of loading forever', async () => {
    const device = makeDevice();
    renderApp('/workouts/plan/missing', device);
    expect(await screen.findByText(/no longer exists/)).toBeInTheDocument();
  });
});

describe('a diet, from creation to a logged meal', () => {
  it('plans a meal with a real food, logs it as planned, and lists it on Today', async () => {
    const user = userEvent.setup();
    renderApp('/food');

    await user.click(await screen.findByRole('button', { name: 'New diet' }));
    const create = await dialog('New diet');
    await user.clear(within(create).getByLabelText('Name'));
    await user.type(within(create).getByLabelText('Name'), 'Cut');
    await user.click(within(create).getByRole('button', { name: 'Create' }));
    expect(await screen.findByRole('heading', { name: 'Cut' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Add meal' }));
    const meal = await dialog('Add meal');
    await user.type(within(meal).getByLabelText('Meal'), 'Lunch');
    await user.click(within(meal).getByRole('button', { name: 'Save' }));

    const lunch = await screen.findByRole('region', { name: 'Lunch' });
    await user.click(within(lunch).getByRole('button', { name: 'Add item' }));
    await user.type(await screen.findByLabelText('Search foods'), 'pollo');
    await user.click(await firstFoodResult());

    const amount = await screen.findByRole('dialog');
    const grams = within(amount).getByLabelText('Grams');
    await user.clear(grams);
    await user.type(grams, '150');
    await user.click(within(amount).getByRole('button', { name: 'Add' }));

    expect(await screen.findByText(/150 g · \d+ kcal/)).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Day total' })).toHaveTextContent(/Planned: \d+ kcal/);

    await chooseFromMenu(user, 'More options', 'Set as active');
    await user.click(await screen.findByRole('button', { name: 'Back' }));
    await user.click(await screen.findByRole('link', { name: 'Today' }));
    const meals = await screen.findByRole('region', { name: 'Nutrition checklist' });
    expect(within(meals).getByText('Lunch')).toBeInTheDocument();
    expect(within(meals).queryByRole('button')).not.toBeInTheDocument(); // a list only: food is added elsewhere

    await user.click(screen.getByRole('link', { name: 'Tracker' }));
    await user.click(await screen.findByRole('button', { name: 'Log as planned' }));
    expect(await screen.findByText(/Logged 1 food as Lunch/)).toBeInTheDocument();
    expect(await screen.findByText(/150 g · \d+ kcal/)).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: 'Today' }));
    expect(await screen.findByText('Logged')).toBeInTheDocument();
  });

  it('copies a weekly diet day onto other days', async () => {
    const user = userEvent.setup();
    renderApp('/food');
    await user.click(await screen.findByRole('button', { name: 'New diet' }));
    const create = await dialog('New diet');
    await user.click(within(create).getByRole('radio', { name: 'Weekly' }));
    await user.click(within(create).getByRole('button', { name: 'Create' }));
    await screen.findByRole('tablist', { name: 'Day of the week' });

    await user.click(screen.getByRole('button', { name: 'Add meal' }));
    const meal = await dialog('Add meal');
    await user.type(within(meal).getByLabelText('Meal'), 'Dinner');
    await user.click(within(meal).getByRole('button', { name: 'Save' }));
    await screen.findByRole('region', { name: 'Dinner' });

    await user.click(screen.getByRole('button', { name: /Copy Monday to other days/ }));
    const copy = await dialog(/Copy Monday to/);
    await user.click(within(copy).getByLabelText('Tuesday'));
    await user.click(within(copy).getByRole('button', { name: 'Copy' }));
    expect(await screen.findByText(/Copied Monday to 1 day/)).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /Tue/ }));
    expect(await screen.findByRole('region', { name: 'Dinner' })).toBeInTheDocument();
  });
});

describe('the calorie tracker', () => {
  it('logs a food, changes its grams, and removes it', async () => {
    const user = userEvent.setup();
    renderApp('/tracker');
    await user.click(await screen.findByRole('link', { name: 'Search food' }));
    await user.type(await screen.findByLabelText('Search foods'), 'mela');
    await user.click(await firstFoodResult());
    const amount = await screen.findByRole('dialog');
    await user.click(within(amount).getByRole('button', { name: 'Add' }));

    const entry = await screen.findByRole('button', { name: /g · \d+ kcal/ });
    await user.click(entry);
    const edit = await screen.findByRole('dialog');
    const grams = within(edit).getByLabelText('Grams');
    await user.clear(grams);
    await user.type(grams, '200');
    await user.click(within(edit).getByRole('button', { name: 'Save' }));
    expect(await screen.findByText(/200 g · \d+ kcal/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /200 g/ }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Remove' }));
    // "Pending" was already on screen for the other meals, so it proves nothing: wait for the entry itself to go.
    await waitFor(() => expect(screen.queryByText(/200 g/)).not.toBeInTheDocument());
  });

  it('creates a custom food and logs it', async () => {
    const user = userEvent.setup();
    renderApp('/food/pick?date=2026-10-14&meal=Snack');
    await user.type(await screen.findByLabelText('Search foods'), 'Barretta');
    await user.click(screen.getByRole('button', { name: 'Create a food…' }));
    const form = await dialog('New food');
    await user.type(within(form).getByLabelText('kcal'), '400');
    await user.type(within(form).getByLabelText('Protein g'), '20');
    await user.click(within(form).getByRole('button', { name: 'Create' }));
    const amount = await dialog('Barretta');
    expect(amount).toHaveTextContent('400 kcal per 100 g');
  });

  it('says so when a barcode is unknown offline', async () => {
    const user = userEvent.setup();
    renderApp('/food/pick?date=2026-10-14&meal=Snack');
    await user.type(await screen.findByLabelText('Search foods'), '8076800195057');
    expect(await screen.findByText(/Can't reach Open Food Facts/, { selector: '[role=alert]' })).toBeInTheDocument();
  });
});

describe('custom daily targets', () => {
  it('sets calories and macros from the pencil on the Tracker, and shows progress against them', async () => {
    const user = userEvent.setup();
    renderApp('/tracker');
    expect(await screen.findByText(/Set up your profile/)).toBeInTheDocument(); // nothing known yet

    await user.click(screen.getByRole('button', { name: 'Edit daily targets' }));
    const form = await dialog('Daily targets');
    await user.type(within(form).getByLabelText('Calories (kcal)'), '2200');
    await user.type(within(form).getByLabelText('Protein (g)'), '160');
    await user.type(within(form).getByLabelText('Fat (g)'), '70');
    await user.click(within(form).getByRole('button', { name: 'Save' }));

    const card = await screen.findByRole('region', { name: 'Daily energy balance' });
    expect(card).toHaveTextContent('of 2200 goal');
    expect(card).toHaveTextContent('2200 kcal left');
    expect(card).toHaveTextContent('0 / 160 g'); // protein, as typed
    expect(card).toHaveTextContent('0 / 70 g'); // fat, as typed
    // carbs are what is left: (2200 − 160·4 − 70·9) / 4 = 232.5, shown rounded
    expect(card).toHaveTextContent(/0 \/ 23[23] g/);
    expect(within(card).getByRole('progressbar', { name: 'Protein eaten' })).toBeInTheDocument();
  });

  it('shows the automatic value as a hint, reflects it back when reopened, and resets', async () => {
    const user = userEvent.setup();
    const device = makeDevice();
    await device.repos.profile.saveProfile({
      sex: 'male', birthDate: '1996-01-01', heightCm: 180, activity: 'moderate', pace: 'maintain',
      customKcal: null, customProtein: null, customCarbs: null, customFat: null,
    });
    await device.repos.profile.setWeight('2026-10-01', 80);
    renderApp('/tracker', device);

    await user.click(await screen.findByRole('button', { name: 'Edit daily targets' }));
    const form = await dialog('Daily targets');
    expect(within(form).getByLabelText('Protein (g)')).toHaveAttribute('placeholder', 'automatic: 144');
    expect(within(form).getByRole('button', { name: 'Reset to automatic' })).toBeDisabled();

    await user.type(within(form).getByLabelText('Protein (g)'), '200');
    await user.click(within(form).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.getByRole('region', { name: 'Daily energy balance' })).toHaveTextContent('0 / 200 g'));

    await user.click(screen.getByRole('button', { name: 'Edit daily targets' }));
    const again = await dialog('Daily targets');
    expect(within(again).getByLabelText('Protein (g)')).toHaveValue('200');
    expect(within(again).getByLabelText('Calories (kcal)')).toHaveValue(''); // still automatic
    await user.click(within(again).getByRole('button', { name: 'Reset to automatic' }));
    await waitFor(() => expect(screen.getByRole('region', { name: 'Daily energy balance' })).toHaveTextContent('0 / 144 g'));
  });

  it('refuses out-of-range numbers and explains what the macros add up to', async () => {
    const user = userEvent.setup();
    renderApp('/tracker');
    await user.click(await screen.findByRole('button', { name: 'Edit daily targets' }));
    const form = await dialog('Daily targets');

    await user.type(within(form).getByLabelText('Calories (kcal)'), '50');
    expect(within(form).getByText(/Between 500 and 10000 kcal/)).toBeInTheDocument();
    expect(within(form).getByRole('button', { name: 'Save' })).toBeDisabled();
    await user.clear(within(form).getByLabelText('Calories (kcal)'));

    await user.type(within(form).getByLabelText('Protein (g)'), '150');
    await user.type(within(form).getByLabelText('Carbs (g)'), '250');
    await user.type(within(form).getByLabelText('Fat (g)'), '70');
    expect(within(form).getByRole('status')).toHaveTextContent('Your calories will be 2230 kcal, from your macros.');
    await user.click(within(form).getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('of 2230 goal')).toBeInTheDocument();
  });

  it('can also be opened from the Profile goal card', async () => {
    const user = userEvent.setup();
    renderApp('/profile');
    await user.click(await screen.findByRole('button', { name: 'Customize targets' }));
    const form = await dialog('Daily targets');
    await user.type(within(form).getByLabelText('Calories (kcal)'), '1900');
    await user.click(within(form).getByRole('button', { name: 'Save' }));
    const goal = await screen.findByRole('region', { name: 'Daily goal' });
    expect(goal).toHaveTextContent('1900 kcal');
    expect(goal).toHaveTextContent('Includes your own numbers');
  });
});

describe('the profile', () => {
  it('works out a daily goal from the profile and a weigh-in', async () => {
    const user = userEvent.setup();
    renderApp('/profile');
    const goal = await screen.findByRole('region', { name: 'Daily goal' });
    expect(goal).toHaveTextContent(/still needs: sex, birth date, height, a weigh-in/);

    await user.click(screen.getByRole('button', { name: 'Set up profile' }));
    const form = await dialog('Edit profile');
    await user.selectOptions(within(form).getByLabelText('Sex'), 'male');
    fireEvent.change(within(form).getByLabelText('Birth date'), { target: { value: '1996-01-01' } });
    await user.type(within(form).getByLabelText('Height (cm)'), '180');
    await user.click(within(form).getByRole('button', { name: 'Save' }));

    await user.click(await screen.findByRole('button', { name: 'Log weight' }));
    await user.type(await screen.findByLabelText('Weight (kg)'), '80');
    await user.click(within(await dialog('Weight')).getByRole('button', { name: 'Save' }));

    expect(await within(await screen.findByRole('region', { name: 'Daily goal' })).findByText(/\d+ kcal/)).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Weight' })).toHaveTextContent('80 kg');
  });

  it('shows the calendar for the month and opens a day', async () => {
    const user = userEvent.setup();
    renderApp('/profile');
    const calendar = await screen.findByRole('region', { name: 'Calendar' });
    await user.click(within(calendar).getAllByRole('button', { name: /^15/ })[0]!);
    expect(await screen.findByRole('button', { name: 'Previous day' })).toBeInTheDocument();
    expect(screen.getByText(/Nothing planned for this day/)).toBeInTheDocument();
  });
});

describe('moving a plan to another device', () => {
  it('sends it with a one-time code and receives it on a second device', async () => {
    const user = userEvent.setup();
    const server = new InMemoryTransferGateway();

    const phone = makeDevice(server);
    const plan = newTrainingPlan('Strength', 'daily', { 0: [{ name: 'Squat', notes: '', catalogId: null, sets: [{ reps: 5, weight: 100 }] }] });
    await phone.repos.trainingPlans.save(plan);
    const first = renderApp(`/workouts/plan/${plan.id}`, phone);

    await user.click(await screen.findByRole('button', { name: 'Send this workout to another device' }));
    await user.click(within(await dialog(/Send this workout plan/)).getByRole('button', { name: 'Create code' }));
    const code = (await screen.findByLabelText('Transfer code')).textContent!;
    expect(code).toMatch(/^[0-9A-Z]{5}-[0-9A-Z]{5}$/);
    expect(server.size).toBe(1);
    first.unmount();

    const laptop = makeDevice(server);
    renderApp('/workouts', laptop);
    await user.click(await screen.findByRole('button', { name: 'Receive from another device' }));
    const receive = await dialog('Receive from another device');
    await user.type(within(receive).getByLabelText('Transfer code'), code.toLowerCase());
    await user.click(within(receive).getByRole('button', { name: 'Receive' }));

    expect(await screen.findByText(/Imported workout plan “Strength”/)).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: /Strength/ })).toBeInTheDocument();
    expect(server.size).toBe(0);
  }, 20_000);

  it('explains a wrong or already used code', async () => {
    const user = userEvent.setup();
    renderApp('/workouts', makeDevice(new InMemoryTransferGateway()));
    await user.click(await screen.findByRole('button', { name: 'Receive from another device' }));
    const receive = await dialog('Receive from another device');
    await user.type(within(receive).getByLabelText('Transfer code'), 'K7QM2-X9RTA');
    await user.click(within(receive).getByRole('button', { name: 'Receive' }));
    expect(await within(receive).findByRole('alert')).toHaveTextContent(/No transfer found/);

    await user.clear(within(receive).getByLabelText('Transfer code'));
    await user.type(within(receive).getByLabelText('Transfer code'), 'nope');
    await user.click(within(receive).getByRole('button', { name: 'Receive' }));
    expect(await within(receive).findByRole('alert')).toHaveTextContent(/doesn't look like a code/);
  }, 20_000);

  it('turns sending off when the build has no Supabase', async () => {
    const user = userEvent.setup();
    renderApp('/workouts', makeDevice(null));
    expect(await screen.findByRole('button', { name: 'Receive from another device' })).toBeDisabled();
    expect(screen.getByText(/isn't set up in this build/)).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Food' }));
  });
});

describe('staying on the same day of a weekly plan', () => {
  it('returns to the chosen weekday after adding an exercise, instead of Monday', async () => {
    const user = userEvent.setup();
    const device = makeDevice();
    const plan = newTrainingPlan('Split', 'weekly');
    await device.repos.trainingPlans.save(plan);
    renderApp(`/workouts/plan/${plan.id}`, device);

    await user.click(await screen.findByRole('tab', { name: /Wed/ }));
    expect(screen.getByRole('tab', { name: /Wed/ })).toHaveAttribute('aria-selected', 'true');

    await user.click(screen.getByRole('button', { name: 'Add exercise' }));
    await user.type(await screen.findByLabelText('Search exercises'), 'squat');
    await user.click((await screen.findAllByRole('button', { name: /squat/i }))[0]!);
    await user.click(within(await dialog('Add exercise')).getByRole('button', { name: 'Add' }));

    // back on the plan: still Wednesday, and the exercise is there
    expect(await screen.findByText(/3 × 10/)).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Wed/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: /Mon/ })).toHaveAttribute('aria-selected', 'false');
    const saved = (await device.repos.trainingPlans.getPlan(plan.id))!;
    expect(Object.keys(saved.sessions)).toEqual(['3']); // it went into Wednesday
  });

  it('returns to the chosen weekday after adding a food to a weekly diet', async () => {
    const user = userEvent.setup();
    const device = makeDevice();
    const { plan } = addMeal(newDietPlan('Week', 'weekly'), 4, 'Lunch', '');
    await device.repos.dietPlans.save(plan);
    renderApp(`/food/plan/${plan.id}`, device);

    await user.click(await screen.findByRole('tab', { name: /Thu/ }));
    const lunch = await screen.findByRole('region', { name: 'Lunch' });
    await user.click(within(lunch).getByRole('button', { name: 'Add item' }));
    await user.type(await screen.findByLabelText('Search foods'), 'mela');
    await user.click((await screen.findAllByRole('button', { name: /per 100 g/ }))[0]!);
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Add' }));

    expect(await screen.findByText(/\d+ g · \d+ kcal/)).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Thu/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('region', { name: 'Lunch' })).toBeInTheDocument();
  });

  it('opens on the day in the address, and falls back to the first day for a bad one', async () => {
    const device = makeDevice();
    const plan = newTrainingPlan('Split', 'weekly');
    await device.repos.trainingPlans.save(plan);
    renderApp(`/workouts/plan/${plan.id}?day=5`, device);
    expect(await screen.findByRole('tab', { name: /Fri/ })).toHaveAttribute('aria-selected', 'true');
    cleanup();

    renderApp(`/workouts/plan/${plan.id}?day=99`, device);
    expect(await screen.findByRole('tab', { name: /Mon/ })).toHaveAttribute('aria-selected', 'true');
    cleanup();

    const daily = newTrainingPlan('Daily', 'daily');
    await device.repos.trainingPlans.save(daily);
    renderApp(`/workouts/plan/${daily.id}?day=3`, device); // a daily plan has no weekdays
    expect(await screen.findByRole('heading', { name: 'Daily' })).toBeInTheDocument();
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(screen.getByText(/No exercises yet/)).toBeInTheDocument();
  });
});

describe('following several workouts at once', () => {
  const exercise = (name: string) => ({ name, notes: '', catalogId: null, sets: [{ reps: 10, weight: null }] });
  const twoPlans = async () => {
    const device = makeDevice();
    await device.repos.trainingPlans.save(newTrainingPlan('Lifting', 'daily', { 0: [exercise('Squat')] }));
    await device.repos.trainingPlans.save(newTrainingPlan('Volleyball', 'daily', { 0: [exercise('Pogo jump')] }));
    return device;
  };

  it('lets you switch on a second workout without switching off the first', async () => {
    const user = userEvent.setup();
    renderApp('/workouts', await twoPlans());

    await user.click(await screen.findByRole('button', { name: 'Set as active Lifting' }));
    await user.click(await screen.findByRole('button', { name: 'Set as active Volleyball' }));

    expect(await screen.findByRole('region', { name: 'Active program: Lifting' })).toBeInTheDocument();
    expect(await screen.findByRole('region', { name: 'Active program: Volleyball' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Start today's session/ })).toHaveLength(2);

    await user.click(screen.getByRole('button', { name: 'Deactivate Lifting' })); // turning one off leaves the other
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Active program: Lifting' })).not.toBeInTheDocument());
    expect(screen.getByRole('region', { name: 'Active program: Volleyball' })).toBeInTheDocument();
  });

  it('lists each plan to do on Today, and finishing one does not tick the other', async () => {
    const user = userEvent.setup();
    const device = await twoPlans();
    for (const plan of (await device.db.trainingPlans.toArray())) await device.repos.trainingPlans.setPlanActive(plan.id, true);
    renderApp('/', device);

    const todo = await screen.findByRole('region', { name: 'Training to do' });
    expect(within(todo).getByRole('button', { name: 'Start Lifting' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Lifting, this week' })).not.toBeInTheDocument(); // folded until asked
    await user.click(screen.getByRole('button', { name: /^This week:/ }));
    expect(screen.getByRole('region', { name: 'Lifting, this week' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Volleyball, this week' })).toBeInTheDocument();

    await user.click(within(todo).getByRole('button', { name: 'Start Volleyball' })); // opens the day to log it
    expect(await screen.findByRole('region', { name: 'Volleyball' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Lifting, from your plan' })).toBeInTheDocument(); // the other still waits
    await user.click(screen.getByRole('button', { name: 'Set 1 not done' }));
    await screen.findByText('1/1 sets done');

    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(await screen.findByRole('button', { name: 'Start Lifting' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Start Volleyball' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Continue Volleyball' })).not.toBeInTheDocument(); // done, nothing left
    await user.click(screen.getByRole('button', { name: /^This week:/ }));
    expect(await screen.findByRole('link', { name: /^Volleyball, .*, completed$/ })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^Lifting, .*, completed$/ })).not.toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /^Lifting, .*, 0% done$/ })[0]).toHaveStyle({ '--fill': '0%' });
    expect(screen.getAllByRole('link', { name: /^Volleyball, .*, completed$/ })[0]).toHaveStyle({ '--fill': '100%' });
  });

  it('sums today and the week of every plan in two rings that open to show what is left', async () => {
    const user = userEvent.setup();
    const device = await twoPlans();
    for (const plan of await device.db.trainingPlans.toArray()) await device.repos.trainingPlans.setPlanActive(plan.id, true);
    renderApp('/', device);

    expect(await screen.findByRole('button', { name: 'Today: 0%, 0 of 2 sets' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('button', { name: 'This week: 0%, 0 of 14 sessions' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Start Volleyball' }));
    await user.click(await screen.findByRole('button', { name: 'Set 1 not done' }));
    await screen.findByText('1/1 sets done');
    await user.click(screen.getByRole('button', { name: 'Back' }));
    await user.click(await screen.findByRole('button', { name: 'Today: 50%, 1 of 2 sets' }));

    const detail = screen.getByRole('region', { name: 'Training progress' });
    expect(within(detail).getByText('Done ✓')).toBeInTheDocument(); // Volleyball
    expect(within(detail).getByText('Not started · 1 sets')).toBeInTheDocument(); // Lifting
    expect(screen.getByRole('button', { name: 'This week: 7%, 1 of 14 sessions' })).toBeInTheDocument();
  });

  it('can start both on the same day, and goes back to an unfinished one', async () => {
    const user = userEvent.setup();
    const device = await twoPlans();
    for (const plan of await device.db.trainingPlans.toArray()) await device.repos.trainingPlans.setPlanActive(plan.id, true);
    renderApp('/', device);

    await user.click(await screen.findByRole('button', { name: 'Start Lifting' }));
    await screen.findByRole('region', { name: 'Lifting' });
    await user.click(screen.getByRole('button', { name: 'Back' }));
    await user.click(await screen.findByRole('button', { name: 'Start Volleyball' }));

    expect(await screen.findByRole('region', { name: 'Lifting' })).toBeInTheDocument();
    expect(await screen.findByRole('region', { name: 'Volleyball' })).toBeInTheDocument();
    expect(await device.db.workouts.count()).toBe(2);

    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(await screen.findByRole('link', { name: 'Continue Lifting' })).toHaveAttribute('href', expect.stringMatching(/^\/day\//));
    expect(screen.getByRole('link', { name: 'Continue Volleyball' })).toBeInTheDocument();
  });
});
