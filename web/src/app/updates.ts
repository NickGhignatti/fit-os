/** The slice of the browser that keeping up to date needs; the real one is [browserEnvironment]. */
export interface UpdateEnvironment {
  /** Calls [listener] each time the app comes back: on screen, into focus, out of the page cache, or online. */
  onReturn(listener: () => void): void;
  /** True while a service worker controls the page: false on the very first visit. */
  readonly controlled: boolean;
  /** Calls [listener] each time another service worker takes control of the page. */
  onControllerChange(listener: () => void): void;
  /** Calls [listener] every [ms] milliseconds. */
  every(ms: number, listener: () => void): void;
  reload(): void;
}

const HOUR_MS = 60 * 60 * 1000;

/**
 * Keeps an open app current. A new version is looked for as the app starts, whenever it comes
 * back (installed apps are often resumed, not started, and stay open for days) and every hour.
 * A version found takes over by itself (the worker skips waiting); the page then reloads once to
 * run it. Workbox's own reload covers this too, but it only fires for workers this page saw being
 * installed: reloading when control changes, as long as the page already had a worker (a first
 * visit has nothing to replace), does not depend on that.
 */
export const keepUpToDate = (check: () => void, env: UpdateEnvironment): void => {
  check();
  env.onReturn(check);
  env.every(HOUR_MS, check);
  if (!env.controlled) return;
  let reloading = false;
  env.onControllerChange(() => {
    if (reloading) return;
    reloading = true;
    env.reload();
  });
};

export const browserEnvironment = (): UpdateEnvironment => ({
  onReturn: (listener) => {
    document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && listener());
    for (const event of ['focus', 'pageshow', 'online'] as const) window.addEventListener(event, listener);
  },
  controlled: navigator.serviceWorker?.controller != null,
  onControllerChange: (listener) => navigator.serviceWorker?.addEventListener('controllerchange', listener),
  every: (ms, listener) => void setInterval(listener, ms),
  reload: () => window.location.reload(),
});
