// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { Tables } from '../data/schema';
import { makeDevice, renderApp } from './testing';

afterEach(cleanup);

type User = ReturnType<typeof userEvent.setup>;

const openDialog = async (user: User) => {
  await user.click(await screen.findByRole('button', { name: 'Add a workout' }));
  await user.click(await screen.findByRole('button', { name: 'Create with AI' }));
  return screen.findByRole('dialog', { name: 'Create with AI' });
};

/** Pastes [text] as the AI's answer. (Typed text would read "{" and "[" as key names.) */
const paste = async (user: User, dialog: HTMLElement, text: string) => {
  const box = within(dialog).getByLabelText("The AI's answer");
  await user.clear(box);
  await user.click(box);
  await user.paste(text);
};

/** A chat answer as assistants write it: a sentence, the JSON in a code block, a sign-off. */
const chatAnswer = (sets: string) => `Here's your plan!

\`\`\`json
{"kind": "training_plan", "data": {"name": "Jump Day", "sessions": {"1": [
  {"name": "Pull-ups", "sets": [{"reps": 5}, {"reps": 5}]},
  {"name": "Wall sit", "sets": ${sets}}
]}}}
\`\`\`

Train hard!`;

describe('creating a plan with an AI', () => {
  it('copies a prompt with the format and the goal, then imports the answer and opens the plan', async () => {
    const user = userEvent.setup(); // also stands in for the clipboard
    const device = makeDevice();
    renderApp('/workouts', device);
    const dialog = await openDialog(user);

    await user.type(within(dialog).getByLabelText('What plan do you want?'), 'Jump higher, 3 days, no weights');
    const copy = within(dialog).getByRole('button', { name: 'Copy prompt' });
    await waitFor(() => expect(copy).toBeEnabled()); // once the format is loaded
    await user.click(copy);
    expect(await screen.findByText('Prompt copied. Paste it into your AI chat.')).toBeInTheDocument();
    const prompt = await navigator.clipboard.readText();
    expect(prompt).toContain('Jump higher, 3 days, no weights');
    expect(prompt).toContain('"kind": "training_plan"');
    expect(prompt).toContain('/schemas/training-plan.schema.json');
    expect(within(dialog).getByRole('link', { name: 'Format reference' })).toHaveAttribute('href', '/llms.txt');

    await paste(user, dialog, chatAnswer('[{"reps": 1, "seconds": 60}]'));
    await user.click(within(dialog).getByRole('button', { name: 'Review plan' }));
    expect(await device.store.direct.count('training_plans')).toBe(0); // nothing is kept before it is confirmed
    const review = await screen.findByRole('dialog', { name: 'Review the plan' });
    await user.click(within(review).getByRole('button', { name: 'Import plan' }));

    expect(await screen.findByRole('heading', { name: 'Jump Day' })).toBeInTheDocument();
    expect(screen.getByText('Imported workout plan “Jump Day”')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Pull-ups' })).toHaveAttribute('href', '/exercises/Pullups'); // linked by name
    expect(screen.getByText(/1 × 1m/)).toBeInTheDocument(); // the wall sit, a timed set
    const [plan] = await device.store.direct.list(Tables.trainingPlans);
    expect(plan).toMatchObject({ name: 'Jump Day', isActive: false });
  });

  it('lists what is wrong and words it for the AI to fix, importing nothing', async () => {
    const user = userEvent.setup();
    const device = makeDevice();
    renderApp('/workouts', device);
    const dialog = await openDialog(user);

    await paste(user, dialog, chatAnswer('[{"reps": 1, "seconds": 0}]'));
    await user.click(within(dialog).getByRole('button', { name: 'Review plan' }));
    const alert = await within(dialog).findByRole('alert');
    expect(alert).toHaveTextContent('Monday › Wall sit › set 1 › seconds: Number must be greater than 0');

    await user.click(within(dialog).getByRole('button', { name: 'Copy for the AI' }));
    const reply = await navigator.clipboard.readText();
    expect(reply).toContain('fit-os could not import the plan you wrote');
    expect(reply).toContain('- Monday › Wall sit › set 1 › seconds');
    expect(await device.store.direct.count('training_plans')).toBe(0);

    await paste(user, dialog, 'I could not write a plan, sorry.');
    expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument(); // a new answer clears the old verdict
    await user.click(within(dialog).getByRole('button', { name: 'Review plan' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent("doesn't look like a workout plan");
  });

  it('says which fields were not understood when the plan is reviewed, and keeps the rest', async () => {
    const user = userEvent.setup();
    renderApp('/workouts');
    const dialog = await openDialog(user);

    await paste(user, dialog, chatAnswer('[{"reps": 1, "duration": 60}]'));
    await user.click(within(dialog).getByRole('button', { name: 'Review plan' }));
    const review = await screen.findByRole('dialog', { name: 'Review the plan' });
    expect(within(review).getByRole('status')).toHaveTextContent('Monday › Wall sit › set 1 › duration');

    await user.click(within(review).getByRole('button', { name: 'Import plan' }));
    expect(await screen.findByRole('heading', { name: 'Jump Day' })).toBeInTheDocument();
  });

  it('lets loads and rests be changed on every day before anything is kept, and drops it on cancel', async () => {
    const user = userEvent.setup();
    const device = makeDevice();
    renderApp('/workouts', device);
    const dialog = await openDialog(user);
    await paste(user, dialog, chatAnswer('[{"reps": 1, "seconds": 60}]'));
    await user.click(within(dialog).getByRole('button', { name: 'Review plan' }));

    const review = await screen.findByRole('dialog', { name: 'Review the plan' });
    await user.click(within(within(review).getByRole('radiogroup', { name: 'Rest between sets, everywhere' })).getByRole('radio', { name: 'Off' }));
    await user.type(within(review).getByLabelText('Pull-ups load in kg'), '10');
    await user.click(within(review).getByRole('button', { name: 'Remove Wall sit' }));
    await user.click(within(review).getByRole('button', { name: 'Cancel' }));
    expect(await device.store.direct.count('training_plans')).toBe(0);

    const back = await screen.findByRole('dialog', { name: 'Create with AI' }); // the answer is still there
    await user.click(within(back).getByRole('button', { name: 'Review plan' }));
    const again = await screen.findByRole('dialog', { name: 'Review the plan' });
    await user.click(within(within(again).getByRole('radiogroup', { name: 'Rest between sets, everywhere' })).getByRole('radio', { name: 'Off' }));
    await user.type(within(again).getByLabelText('Pull-ups load in kg'), '10');
    await user.click(within(again).getByRole('button', { name: 'Remove Wall sit' }));
    await user.click(within(again).getByRole('button', { name: 'Import plan' }));

    await screen.findByRole('heading', { name: 'Jump Day' });
    const [plan] = await device.store.direct.list(Tables.trainingPlans);
    const [pullups, ...others] = plan!.sessions[1]!;
    expect(others).toEqual([]);
    expect(pullups).toMatchObject({ name: 'Pull-ups', restSeconds: 0 });
    expect(pullups!.sets.map((s) => s.weight)).toEqual([10, 10]);
  });
});

describe('importing a plan file that has problems', () => {
  it('shows what needs fixing instead of a bare refusal', async () => {
    const user = userEvent.setup({ applyAccept: false });
    renderApp('/workouts');
    const text = JSON.stringify({ name: 'Bad', sessions: { 1: [{ name: 'Squat', sets: [{ reps: 0 }] }] } });
    const file = Object.assign(new File([text], 'plan.json', { type: 'application/json' }), { text: async () => text });
    await user.upload(await screen.findByLabelText('File to import'), file);

    const dialog = await screen.findByRole('dialog', { name: "Can't import this file" });
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Monday › Squat › set 1 › reps: Number must be greater than 0');
  });
});
