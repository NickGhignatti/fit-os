import type { ManifestOptions } from 'vite-plugin-pwa';

/** The colour of the app's own background (--canvas in styles.css): the status bar and splash match it. */
export const APP_COLOR = '#fbfbfa';

/**
 * What lets a phone install Tracker as a real app (no browser bar) instead of a bookmark:
 * a name, a start page inside its scope, display "standalone", and PNG icons at 192 and 512 px.
 * Without those PNGs Android only makes a shortcut that opens in the browser, address bar and all.
 * web/src/app/manifest.test.ts checks every one of them.
 */
export const manifest: Partial<ManifestOptions> = {
  id: '/',
  name: 'Tracker',
  short_name: 'Tracker',
  description: 'Training, diet and calories, on your device.',
  lang: 'en',
  start_url: '/',
  scope: '/',
  display: 'standalone',
  display_override: ['standalone', 'minimal-ui'],
  theme_color: APP_COLOR,
  background_color: APP_COLOR,
  categories: ['health', 'fitness', 'lifestyle'],
  // Lets Tracker appear in Android's share sheet, so a shared Tracker file (.fitos.txt) can be opened in it.
  // Files shared before were .json, and some apps label files as bytes, so those types are accepted
  // too; the app reads the content to tell what the file is. public/share-target.js receives the post.
  share_target: {
    action: '/share-target',
    method: 'POST',
    enctype: 'multipart/form-data',
    params: { files: [{ name: 'file', accept: ['text/plain', '.txt', 'application/json', '.json', 'application/octet-stream'] }] },
  },
  icons: [
    { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
  ],
};
