import 'fake-indexeddb/auto';
import Ajv from 'ajv';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { catalogLinker, customExerciseId } from '../domain/catalog';
import { newTrainingPlan } from '../domain/edit';
import { authoredTrainingPlanSchema, trainingPlanSchema } from '../domain/schemas';
import type { TrainingPlan } from '../domain/trainingPlan';
import { envelopeFile } from '../transfer/transfer';
import { ExerciseLibrary, StaticExerciseCatalog } from './catalog';
import { extractJson, readFileContents } from './importFile';
import { importEnvelope, type ImportResult } from './importItem';
import { fixPrompt } from './importProblems';
import { EXAMPLE, aiPrompt, llmsTxt, specFiles, trainingPlanJsonSchema } from './planSpec';
import { SPEC_PATHS } from './planSpecPaths';
import { SqlCustomExercises } from './repositories';
import { Tables } from './schema';
import type { Store } from './store';
import { testStore } from './testStore';

let db: Store;
beforeEach(() => {
  db = testStore();
});

const library = (store: Store) => new ExerciseLibrary(
  new StaticExerciseCatalog(async () => readFileSync(join(process.cwd(), 'public', 'catalog', 'exercises.json'), 'utf8')),
  new SqlCustomExercises(store),
);

/** Reads [text] as a file would be read, imports what it holds, and returns the stored plan. */
const importText = async (text: string, link = false): Promise<{ result: ImportResult; plan: TrainingPlan | undefined }> => {
  const contents = readFileContents(text);
  if (contents.kind !== 'item') throw new Error(`not an item: ${contents.kind}`);
  const result = await importEnvelope(db, contents.envelope, link ? { linkExercise: catalogLinker(library(db)) } : {});
  const plan = result.status === 'imported' ? await db.direct.get(Tables.trainingPlans, result.id) : undefined;
  return { result, plan };
};

const plank = { name: 'Plank', sets: [{ reps: 1, seconds: 45 }, { reps: 1, seconds: 45 }] };

describe('a plan written by hand or by an AI', () => {
  it('imports without ids, notes, loads, rests or a recurrence', async () => {
    const { result, plan } = await importText(JSON.stringify({ kind: 'training_plan', data: { name: 'Core', sessions: { 2: [plank] } } }));
    expect(result).toMatchObject({ status: 'imported', title: 'Core', ignored: [] });
    expect(plan).toMatchObject({ name: 'Core', recurrence: 'weekly', isActive: false });
    const [exercise] = plan!.sessions[2]!;
    expect(exercise).toMatchObject({ name: 'Plank', notes: '', catalogId: null, restSeconds: null, restAfterSeconds: null });
    expect(exercise!.sets.map((s) => [s.reps, s.weight, s.seconds])).toEqual([[1, null, 45], [1, null, 45]]);
    expect(exercise!.id).not.toBe('');
    expect(new Set(exercise!.sets.map((s) => s.id)).size).toBe(2); // fresh, distinct ids
  });

  it('reads the recurrence from the days, and refuses days that contradict it', () => {
    expect(authoredTrainingPlanSchema.parse({ name: 'Daily', sessions: { 0: [plank] } }).recurrence).toBe('daily');
    expect(authoredTrainingPlanSchema.parse({ name: 'Weekly', sessions: { 1: [plank], 5: [plank] } }).recurrence).toBe('weekly');
    expect(authoredTrainingPlanSchema.safeParse({ name: 'Mixed', sessions: { 0: [plank], 1: [plank] } }).success).toBe(false);
    expect(authoredTrainingPlanSchema.safeParse({ name: 'Wrong', recurrence: 'daily', sessions: { 1: [plank] } }).success).toBe(false);
  });

  it('checks values as strictly as a stored plan', () => {
    const bad = [
      { name: '', sessions: { 1: [plank] } },
      { name: 'x', sessions: { 1: [{ name: 'Plank', sets: [{ reps: 0 }] }] } },
      { name: 'x', sessions: { 1: [{ name: 'Plank', sets: [{ reps: 1, seconds: 0 }] }] } },
      { name: 'x', sessions: { 1: [{ name: 'Plank', sets: [{ reps: '10' }] }] } },
      { name: 'x', sessions: { 8: [plank] } },
    ];
    for (const plan of bad) expect(authoredTrainingPlanSchema.safeParse(plan).success, JSON.stringify(plan)).toBe(false);
  });

  it('still accepts every plan the app writes itself, even an empty one or an exercise without sets', () => {
    const plans = [
      newTrainingPlan('Strength', 'weekly', { 1: [{ name: 'Squat', notes: 'belt', catalogId: 'Squat', sets: [{ reps: 5, weight: 100, seconds: null }] }] }),
      newTrainingPlan('Just created', 'weekly'),
      newTrainingPlan('Daily', 'daily', { 0: [{ name: 'Stretch', notes: '', catalogId: null, sets: [] }] }),
    ];
    for (const stored of plans) expect(authoredTrainingPlanSchema.parse(stored), stored.name).toEqual(trainingPlanSchema.parse(stored));
  });
});

describe('reading what was pasted or saved', () => {
  const data = { name: 'Core', sessions: { 1: [plank] } };

  it('finds the JSON in a chat answer: in a code block, or with text around it', () => {
    const json = JSON.stringify({ kind: 'training_plan', data });
    expect(extractJson(`Here is your plan:\n\n\`\`\`json\n${json}\n\`\`\`\n\nEnjoy!`)).toBe(json);
    expect(extractJson(`Sure! ${json} Let me know.`)).toBe(json);
    expect(extractJson(`﻿${json}`)).toBe(json);
    expect(extractJson('no json here')).toBe('no json here');
  });

  it('takes the envelope without version or date, or a bare plan without any envelope', () => {
    for (const text of [JSON.stringify({ kind: 'training_plan', data }), JSON.stringify(data), envelopeFile('training_plan', data)]) {
      const contents = readFileContents(text);
      expect(contents.kind === 'item' && contents.envelope.kind, text).toBe('training_plan');
    }
  });

  it('refuses a version it does not know and what is not a plan at all', () => {
    expect(readFileContents(JSON.stringify({ v: 2, kind: 'training_plan', data })).kind).toBe('unknown');
    expect(readFileContents(JSON.stringify({ hello: 'world' })).kind).toBe('unknown');
    expect(readFileContents('not json').kind).toBe('unknown');
  });
});

describe('what the importer says back', () => {
  it('points at the problem in the plan\'s own words', async () => {
    const { result } = await importText(JSON.stringify({
      kind: 'training_plan',
      data: { name: 'Core', sessions: { 1: [{ name: 'Plank', sets: [{ reps: 1, seconds: 45 }, { reps: 1, seconds: 0 }] }], monday: [plank] } },
    }));
    expect(result.status).toBe('invalid');
    const problems = result.status === 'invalid' ? result.problems : [];
    expect(problems).toContain('Monday › Plank › set 2 › seconds: Number must be greater than 0');
    expect(problems.some((p) => p.startsWith('day "monday"'))).toBe(true);
    expect(fixPrompt(problems)).toContain('- Monday › Plank › set 2 › seconds');
  });

  it('imports a plan with fields it does not know, and names them', async () => {
    const { result, plan } = await importText(JSON.stringify({
      kind: 'training_plan', data: { name: 'Core', sessions: { 3: [{ name: 'Plank', tempo: '3-1-1', sets: [{ reps: 1, duration: 45 }] }] } },
    }));
    expect(result).toMatchObject({ status: 'imported', ignored: ['Wednesday › Plank › tempo', 'Wednesday › Plank › set 1 › duration'] });
    expect(plan?.sessions[3]?.[0]?.sets[0]?.seconds).toBeNull(); // "duration" meant nothing: which is why it is reported
  });
});

describe('linking exercises to the catalogue by name', () => {
  it('links exact names, ignoring case, spaces and punctuation, and leaves other names alone', async () => {
    const link = catalogLinker(library(db));
    expect(await link('Pullups')).toBe('Pullups');
    expect(await link('pull-ups')).toBe('Pullups');
    expect(await link('PLYO PUSH UP')).toBe('Plyo_Push-up');
    expect(await link('Spanish squat')).toBeNull();
  });

  it('prefers your own exercise of the same name', async () => {
    const mine = { id: customExerciseId('plank'), name: 'Plank', muscle: null, equipment: null, notes: '' };
    await new SqlCustomExercises(db).save(mine);
    expect(await catalogLinker(library(db))('plank')).toBe(mine.id);
  });

  it('links on import, but keeps a catalogue id the plan already gives', async () => {
    const { plan } = await importText(JSON.stringify({
      name: 'Pull', sessions: { 1: [{ name: 'Pull-ups', sets: [{ reps: 5 }] }, { name: 'Pullups', catalogId: 'Chin-Up', sets: [{ reps: 5 }] }, { name: 'Towel hang', sets: [{ reps: 1, seconds: 30 }] }] },
    }), true);
    expect(plan?.sessions[1]?.map((e) => e.catalogId)).toEqual(['Pullups', 'Chin-Up', null]);
  });
});

describe('the published format', () => {
  const ajv = new Ajv({ strict: false });
  const validate = ajv.compile(trainingPlanJsonSchema());
  const importable = (file: unknown) => {
    const contents = readFileContents(JSON.stringify(file));
    return contents.kind === 'item' && contents.envelope.kind === 'training_plan' && authoredTrainingPlanSchema.safeParse(contents.envelope.data).success;
  };

  it('has an example that imports cleanly and links its catalogue exercises', async () => {
    const { result, plan } = await importText(JSON.stringify(EXAMPLE), true);
    expect(result).toMatchObject({ status: 'imported', title: 'Strength and core', ignored: [] });
    expect(plan?.sessions[1]?.map((e) => e.catalogId)).toEqual(['Pullups', 'Plank']);
    expect(validate(EXAMPLE)).toBe(true);
  });

  it('publishes a JSON Schema that agrees with the importer', () => {
    const set = (over: object) => ({ kind: 'training_plan', data: { name: 'x', sessions: { 1: [{ name: 'Plank', sets: [{ reps: 1, ...over }] }] } } });
    const cases = [
      EXAMPLE,
      set({}),
      set({ seconds: 45 }),
      set({ weight: 10.5 }),
      set({ reps: 0 }),
      set({ seconds: 0 }),
      set({ seconds: 2.5 }),
      set({ weight: -1 }),
      set({ duration: 45 }), // unknown field: the schema forbids it; the importer drops it and says so
      { kind: 'training_plan', data: { name: 'x', sessions: { 9: [plank] } } },
      { kind: 'training_plan', data: { name: 'x', sessions: { 1: [{ name: 'Plank' }] } } },
      { kind: 'diet_plan', data: { name: 'x', sessions: { 1: [plank] } } },
    ];
    for (const file of cases) {
      const lenientOnly = JSON.stringify(file).includes('duration');
      expect(validate(file), JSON.stringify(file)).toBe(lenientOnly ? false : importable(file));
    }
  });

  it('is published as llms.txt and a JSON Schema, each holding the rules, schema and example', () => {
    const files = specFiles();
    expect(Object.keys(files).sort()).toEqual([SPEC_PATHS.guide, SPEC_PATHS.schema].sort());
    expect(JSON.parse(files[SPEC_PATHS.schema]!)).toEqual(trainingPlanJsonSchema());
    const guide = llmsTxt();
    expect(guide.startsWith('# fit-os\n')).toBe(true);
    expect(guide).toContain(JSON.stringify(EXAMPLE, null, 2));
    expect(guide).toContain('"seconds"');
    expect(guide).toContain(`/${SPEC_PATHS.schema}`);
  });

  it('builds the prompt around the plan the person wants', () => {
    const prompt = aiPrompt('3 days, no weights, jump higher', 'https://fit.example');
    expect(prompt).toContain('3 days, no weights, jump higher');
    expect(prompt).toContain('https://fit.example/schemas/training-plan.schema.json');
    expect(prompt).toContain('"kind": "training_plan"');
    expect(aiPrompt('  ')).toContain('Describe the plan here');
  });
});
