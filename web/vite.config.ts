/// <reference types="vitest" />
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { readChangelog } from './changelog';
import { manifest } from './pwa-manifest';
import { specFiles } from './src/data/planSpec';
import { SPEC_PATHS } from './src/data/planSpecPaths';

/** Escapes [text] for use inside a regular expression. */
const literal = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Publishes how to write a training plan (/llms.txt and its JSON Schema) next to the app. They are
 * generated from the importer's own schema at build time rather than kept in public/, so they can
 * never describe a format the app no longer accepts. The dev server serves them too.
 */
const planSpec = (): Plugin => ({
  name: 'fit-os-plan-spec',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      const file = specFiles()[(req.url ?? '').split('?')[0]!.replace(/^\//, '')];
      if (file === undefined) return next();
      res.setHeader('Content-Type', req.url!.endsWith('.json') ? 'application/json' : 'text/plain; charset=utf-8');
      res.end(file);
    });
  },
  generateBundle() {
    for (const [fileName, source] of Object.entries(specFiles())) this.emitFile({ type: 'asset', fileName, source });
  },
});

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
      __CHANGELOG__: JSON.stringify(readChangelog(__dirname)),
    },
    plugins: [
      react(),
      planSpec(),
      VitePWA({
        registerType: 'autoUpdate',
        // src/main.tsx registers the service worker itself, to look for updates while the app is open.
        injectRegister: false,
        includeAssets: ['icon.svg', 'apple-touch-icon.png'],
        manifest,
        workbox: {
          // A new version takes over open pages at once (the plugin only sets these when it registers
          // the worker itself, and here src/main.tsx does).
          skipWaiting: true,
          clientsClaim: true,
          // The exercise and food catalogues are large; cache them on first use, not at install.
          // The SQLite WebAssembly is needed offline, and is bigger than Workbox's 2 MiB default.
          globPatterns: ['**/*.{js,css,html,svg,png,woff2,wasm}'],
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
          // Receives files shared to the app from Android's share sheet; loaded before Workbox's routes.
          importScripts: ['/share-target.js'],
          // The worker answers every page the app opens with the app itself (deep links are
          // client-side routes). The published files are not pages of the app: opening them, as
          // the "Format reference" link does, must reach the real file.
          navigateFallbackDenylist: Object.values(SPEC_PATHS).map((path) => new RegExp(`^/${literal(path)}$`)),
          // The "mc-" SQLite builds are only for encrypted databases, which the app does not use.
          // The photo food recogniser (its engine and model, about 40 MB) is fetched the first time
          // someone logs a photo, not at install.
          globIgnores: ['**/mc-wa-sqlite*', '**/ort-wasm*'],
          runtimeCaching: [
            {
              urlPattern: ({ url }) => url.pathname.startsWith('/catalog/'),
              handler: 'CacheFirst',
              options: { cacheName: 'catalog', expiration: { maxEntries: 20 } },
            },
            {
              // The model's address carries its version, and Vite's names carry a hash, so a cached copy is never stale.
              urlPattern: ({ url }) => url.pathname.endsWith('.onnx') || /\/ort-wasm[^/]*\.wasm$/.test(url.pathname),
              handler: 'CacheFirst',
              options: { cacheName: 'food-recognizer', expiration: { maxEntries: 4 } },
            },
            {
              urlPattern: ({ url }) => url.pathname === '/models/food-classes.json',
              handler: 'NetworkFirst',
              options: { cacheName: 'food-recognizer-classes', expiration: { maxEntries: 1 } },
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
