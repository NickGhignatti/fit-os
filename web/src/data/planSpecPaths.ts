/**
 * Where the plan format is published, relative to the site root (see planSpec.ts). Kept apart from
 * planSpec.ts so the app can link to the guide without loading the schema generator.
 */
export const SPEC_PATHS = {
  guide: 'llms.txt',
  schema: 'schemas/training-plan.schema.json',
  catalog: 'catalog/exercises.json',
} as const;
