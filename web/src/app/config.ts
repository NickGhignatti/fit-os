/**
 * What the build was configured with. Without Supabase values the app is fully usable on the
 * device; only sending an item to another device is switched off.
 */
export interface AppConfig {
  readonly supabaseUrl: string;
  readonly supabaseKey: string;
  readonly transferEnabled: boolean;
  readonly usdaApiKey: string;
}

export const readConfig = (url: string, key: string, usdaApiKey = ''): AppConfig => ({
  supabaseUrl: url.replace(/\/+$/, ''),
  supabaseKey: key,
  transferEnabled: url.startsWith('https://') && key.length > 0,
  usdaApiKey,
});

export const appConfig: AppConfig = readConfig(
  typeof __SUPABASE_URL__ === 'undefined' ? '' : __SUPABASE_URL__,
  typeof __SUPABASE_KEY__ === 'undefined' ? '' : __SUPABASE_KEY__,
  typeof __USDA_API_KEY__ === 'undefined' ? '' : __USDA_API_KEY__,
);
