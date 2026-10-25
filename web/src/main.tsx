import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './app/App';
import { appConfig } from './app/config';
import { PowerSyncDatabase } from '@powersync/web';
import { registerSW } from 'virtual:pwa-register';
import { createContainer } from './app/container';
import { ContainerProvider } from './app/hooks';
import { copyLegacyData } from './data/legacy';
import { AppSchema } from './data/schema';
import { Store } from './data/store';
import './app/styles.css';

// SQLite in the browser, kept in IndexedDB by PowerSync's default storage, which every browser has.
const store = new Store(new PowerSyncDatabase({ schema: AppSchema, database: { dbFilename: 'tracker.sqlite' } }));
const container = createContainer(appConfig, store);

// An installed app can stay open for days, and a new version found when it starts only shows on
// the start after. So look for one each time the app comes back on screen, and every hour; a new
// version found takes over and reloads the page at once (registerType 'autoUpdate').
registerSW({
  immediate: true,
  onRegisteredSW: (_url, registration) => {
    if (!registration) return;
    const check = () => void registration.update().catch(() => undefined);
    document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && check());
    setInterval(check, 60 * 60 * 1000);
  },
});

// Ask the browser not to evict our data under storage pressure. Not guaranteed; the backup
// file is the real safety net. Failure is harmless.
void navigator.storage?.persist?.().catch(() => undefined);

const render = () => createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ContainerProvider container={container}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ContainerProvider>
  </StrictMode>,
);

// Data from before SQLite is copied over first, so the screens open on all of it. A failed copy
// is retried on the next start; the app opens anyway.
void copyLegacyData(store).catch((cause: unknown) => console.error('Could not copy the old data', cause)).finally(render);
