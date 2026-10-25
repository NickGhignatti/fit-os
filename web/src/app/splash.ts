/** How long the start-up animation in index.html takes to play through once. */
export const SPLASH_MS = 1100;

/**
 * Fades the start-up animation into the app: once it has played through (counted from when the
 * page started loading), it fades out and is removed.
 */
export const hideSplash = (
  doc: Document = document,
  elapsed: () => number = () => performance.now(),
  later: (run: () => void, ms: number) => void = (run, ms) => void setTimeout(run, ms),
): void => {
  const splash = doc.getElementById('splash');
  if (!splash) return;
  later(() => {
    splash.classList.add('done');
    later(() => splash.remove(), 400); // after the fade
  }, Math.max(0, SPLASH_MS - elapsed()));
};
