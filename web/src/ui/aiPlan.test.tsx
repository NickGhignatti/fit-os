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
    await user.click(within(dialog).getByRole('button', { name: 'Import plan' }));

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
    await user.click(within(dialog).getByRole('button', { name: 'Import plan' }));
    const alert = await within(dialog).findByRole('alert');
    expect(alert).toHaveTextContent('Monday › Wall sit › set 1 › seconds: Number must be greater than 0');

    await user.click(within(dialog).getByRole('button', { name: 'Copy for the AI' }));
    const reply = await navigator.clipboard.readText();
    expect(reply).toContain('fit-os could not import the plan you wrote');
    expect(reply).toContain('- Monday › Wall sit › set 1 › seconds');
    expect(await device.store.direct.count('training_plans')).toBe(0);

    await paste(user, dialog, 'I could not write a plan, sorry.');
    expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument(); // a new answer clears the old verdict
    await user.click(within(dialog).getByRole('button', { name: 'Import plan' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent("doesn't look like a workout plan");
  });

  it('imports a plan with unknown fields but says which, so the AI can do better', async () => {
    const user = userEvent.setup();
    renderApp('/workouts');
    const dialog = await openDialog(user);

    await paste(user, dialog, chatAnswer('[{"reps": 1, "duration": 60}]'));
    await user.click(within(dialog).getByRole('button', { name: 'Import plan' }));
    const status = await within(dialog).findByRole('status');
    expect(status).toHaveTextContent('Monday › Wall sit › set 1 › duration');
    await user.click(within(dialog).getByRole('button', { name: 'Copy for the AI' }));
    expect(await navigator.clipboard.readText()).toContain('ignored fields it does not know');

    await user.click(within(dialog).getByRole('button', { name: 'Open plan' }));
    expect(await screen.findByRole('heading', { name: 'Jump Day' })).toBeInTheDocument();
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
