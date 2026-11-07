/** Injected at build time by vite.config.ts from the repo-root .env. Empty when not configured. */
declare const __SUPABASE_URL__: string;
declare const __SUPABASE_KEY__: string;
/** A free key from fdc.nal.usda.gov for looking barcodes up there. Empty uses a shared key with a small allowance. */
declare const __USDA_API_KEY__: string;
/** The release notes read from git at build time by changelog.ts; see src/app/changelog.ts. */
declare const __CHANGELOG__: readonly import('./domain/changelog').ChangelogEntry[];
