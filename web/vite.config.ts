/// <reference types="vitest" />
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

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
        includeAssets: ['icon.svg'],
        manifest: {
          name: 'Tracker',
          short_name: 'Tracker',
          description: 'Training, diet and calories, on your device.',
          theme_color: '#111418',
          background_color: '#111418',
          display: 'standalone',
          start_url: '/',
          icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
        },
        workbox: {
          // The exercise and food catalogues are large; cache them on first use, not at install.
          globPatterns: ['**/*.{js,css,html,svg,woff2}'],
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
    // The screen tests drive a real IndexedDB; build servers are slower than a laptop, so allow for it.
    test: { environment: 'node', testTimeout: 30_000, hookTimeout: 30_000 },
  };
});
