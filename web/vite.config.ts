/// <reference types="vitest" />
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { manifest } from './pwa-manifest';

/**
 * Configuration comes from the repo-root `.env` (git-ignored). Only the two public values below
 * reach the app, each named explicitly: a prefix shortcut such as envPrefix: 'SUPABASE_' would
 * also ship SUPABASE_SECRET_KEY to every visitor.
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '..', '');
  return {
    define: {
      __SUPABASE_URL__: JSON.stringify(env.SUPABASE_URL ?? ''),
      __SUPABASE_KEY__: JSON.stringify(env.SUPABASE_PUBLISHABLE_KEY ?? ''),
    },
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['icon.svg', 'apple-touch-icon.png'],
        manifest,
        workbox: {
          // The exercise and food catalogues are large; cache them on first use, not at install.
          // The SQLite WebAssembly is needed offline, and is bigger than Workbox's 2 MiB default.
          globPatterns: ['**/*.{js,css,html,svg,png,woff2,wasm}'],
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
          // The "mc-" SQLite builds are only for encrypted databases, which the app does not use.
          globIgnores: ['**/mc-wa-sqlite*'],
          runtimeCaching: [
            {
              urlPattern: ({ url }) => url.pathname.startsWith('/catalog/'),
              handler: 'CacheFirst',
              options: { cacheName: 'catalog', expiration: { maxEntries: 20 } },
            },
          ],
        },
      }),
    ],
    // PowerSync ships web workers and WebAssembly that Vite's dependency pre-bundling breaks.
    optimizeDeps: { exclude: ['@powersync/web'] },
    worker: { format: 'es' },
    // The screen tests drive a real IndexedDB; build servers are slower than a laptop, so allow for it.
    test: { environment: 'node', testTimeout: 30_000, hookTimeout: 30_000 },
  };
});
