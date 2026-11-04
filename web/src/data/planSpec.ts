import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { authoredTrainingPlanSchema } from '../domain/schemas';
import { SPEC_PATHS } from './planSpecPaths';

/**
 * How to write a training plan the app can import, for people and for AI models, in three forms:
 * - a JSON Schema, published at /schemas/training-plan.schema.json;
 * - a plain-text guide, published at /llms.txt (the convention for documentation meant for LLMs);
 * - a prompt to paste into any AI chat, copied from Workouts › Create with AI.
 *
 * All three come from [authoredTrainingPlanSchema], the schema the importer validates with, and
 * from the descriptions written on its fields: the documentation cannot promise a format the app
 * does not accept. Tests import [EXAMPLE] through the real importer and check it against the
 * published schema.
 */

/** The file as an AI should write it: the app's envelope around the plan; "v" and "sentAt" may be left out. */
const authoredFileSchema = z.object({
  kind: z.literal('training_plan').describe('Always "training_plan".'),
  data: authoredTrainingPlanSchema.describe('The plan.'),
  v: z.literal(1).optional().describe('Optional format version; 1 if given.'),
  sentAt: z.string().optional().describe('Optional; ignored on import.'),
});

/** The JSON Schema of an importable training-plan file, every definition inlined so it reads top to bottom. */
export const trainingPlanJsonSchema = (): Record<string, unknown> => ({
  ...zodToJsonSchema(authoredFileSchema, { $refStrategy: 'none', effectStrategy: 'input', target: 'jsonSchema7' }),
  title: 'fit-os training plan',
  description: 'A training plan to import into the fit-os app. Days are keys of data.sessions; each exercise lists its sets one by one.',
});

/** A complete plan that uses every feature once: catalogue names, a load, timed holds, per-side reps, rests. */
export const EXAMPLE = {
  kind: 'training_plan',
  data: {
    name: 'Strength and core',
    sessions: {
      1: [
        {
          name: 'Pullups',
          notes: 'Full range. Add load when all sets reach 8 reps.',
          restSeconds: 150,
          sets: [{ reps: 6 }, { reps: 6 }, { reps: 6, weight: 5 }],
        },
        { name: 'Plank', notes: 'Ribs down, glutes tight.', sets: [{ reps: 1, seconds: 45 }, { reps: 1, seconds: 45 }] },
      ],
      4: [
        {
          name: 'Bulgarian split squat',
          notes: 'Reps are per leg. 3 s down, up fast.',
          restSeconds: 120,
          sets: [{ reps: 8, weight: 10 }, { reps: 8, weight: 10 }, { reps: 8, weight: 10 }],
        },
        {
          name: 'Overcoming isometric squat',
          notes: 'Stand on a strap at quarter squat and pull up as hard as you can.',
          sets: [{ reps: 5, seconds: 5 }, { reps: 5, seconds: 5 }],
          restAfterSeconds: 60,
        },
      ],
    },
  },
} as const;

const RULES = [
  'Reply with the JSON only, in one ```json code block: no text before or after it.',
  'The top level is {"kind": "training_plan", "data": {...}}.',
  'data.sessions maps days to exercises. Weekly plans use "1" (Monday) to "7" (Sunday); leave rest days out. A plan with the same session every day uses only "0".',
  'Each exercise has a name and its sets, one object per set: 3 sets of 10 reps are three {"reps": 10}. Sets may differ (a pyramid, a back-off set).',
  'weight is the extra load in kg (barbell, dumbbells, weighted vest). Leave it out, or null, for bodyweight.',
  'Timed sets use seconds, the duration of each rep: a 45 s plank is {"reps": 1, "seconds": 45}; five 5 s isometric pushes are {"reps": 5, "seconds": 5}. Never put seconds in reps.',
  'For exercises done per leg or per arm, give the reps for one side and say "per leg" in notes.',
  'restSeconds is the rest after each set, restAfterSeconds the rest before the next exercise, both in seconds. Leave them out for the defaults (90 s and 120 s).',
  'Put coaching cues, tempo and how to progress in notes: the athlete reads them while training.',
  'Exercise names that match the app catalogue exactly (for example "Pullups", "Plank", "Plyo Push-up", "Hurdle Hops") are linked to photos and instructions. Any other name is fine too.',
  'Use only the fields in the schema. Ids are not needed: the app creates them.',
  'Limits: plan name up to 80 characters, exercise name up to 120, notes up to 2000; up to 100 exercises per day and 100 sets per exercise.',
];

const json = (value: unknown) => JSON.stringify(value, null, 2);

/** The format, explained: rules, schema and example. [base] prefixes links ("" for paths relative to the site). */
export const formatGuide = (base = ''): string => [
  '## Rules',
  RULES.map((rule, i) => `${i + 1}. ${rule}`).join('\n'),
  '## JSON Schema',
  `Also at ${base}/${SPEC_PATHS.schema}`,
  `\`\`\`json\n${json(trainingPlanJsonSchema())}\n\`\`\``,
  '## Example',
  `\`\`\`json\n${json(EXAMPLE)}\n\`\`\``,
  '## Exercise catalogue',
  `The names and ids of the exercises the app knows: ${base}/${SPEC_PATHS.catalog}. Using one of these names exactly links the exercise.`,
].join('\n\n');

/** The /llms.txt file: what fit-os is, and how to write a plan for it. */
export const llmsTxt = (): string => [
  '# fit-os',
  '> A workout, diet and progress tracker that runs in the browser and keeps its data on the device. Training plans can be written by hand or by an AI and imported as JSON.',
  'To import a plan: in the app open Workouts, tap +, then "Create with AI" to paste the JSON, or "Import a file" for a .json file.',
  formatGuide(),
].join('\n\n') + '\n';

const NO_GOAL = '(Describe the plan here: your goal, level, available days, session length, equipment, injuries.)';

/** What to paste into an AI chat: the request, the format, and the plan the person wants. */
export const aiPrompt = (goal: string, origin = ''): string => [
  'I use the workout app fit-os. Write a training plan I can import into it, as JSON in the exact format below.',
  formatGuide(origin),
  '## The plan I want',
  goal.trim() || NO_GOAL,
].join('\n\n');

/** The files published with the site, path → content. */
export const specFiles = (): Record<string, string> => ({
  [SPEC_PATHS.guide]: llmsTxt(),
  [SPEC_PATHS.schema]: `${json(trainingPlanJsonSchema())}\n`,
});
