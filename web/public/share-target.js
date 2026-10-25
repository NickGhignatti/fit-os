/*
 * Runs inside the app's service worker (imported by the one Workbox writes, see vite.config.ts).
 * When a file is shared to the installed app from another app (Android: Share → Tracker), the
 * phone posts it to /share-target, as the manifest's share_target says. The file is left in a
 * cache for the app (src/data/importFile.ts) and the app is opened on /import to bring it in.
 */
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'POST' || url.pathname !== '/share-target') return;
  event.respondWith((async () => {
    const form = await event.request.formData();
    const file = form.getAll('file').find((f) => typeof f === 'object');
    if (file) {
      const cache = await caches.open('shared-files');
      await cache.put('/shared-file', new Response(file, {
        headers: { 'content-type': file.type || 'application/json', 'x-file-name': encodeURIComponent(file.name || '') },
      }));
    }
    return Response.redirect(new URL('/import', url).href, 303);
  })());
});
