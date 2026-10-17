/**
 * What the build was configured with. Without Supabase values the app is fully usable on the
 * device; only sending an item to another device is switched off.
 */
export interface AppConfig {
  readonly supabaseUrl: string;
  readonly supabaseKey: string;
  readonly transferEnabled: boolean;
}

export const readConfig = (url: string, key: string): AppConfig => ({
  supabaseUrl: url.replace(/\/+$/, ''),
  supabaseKey: key,
  transferEnabled: url.startsWith('https://') && key.length > 0,
});

export const appConfig: AppConfig = readConfig(
  typeof __SUPABASE_URL__ === 'undefined' ? '' : __SUPABASE_URL__,
  typeof __SUPABASE_KEY__ === 'undefined' ? '' : __SUPABASE_KEY__,
);
