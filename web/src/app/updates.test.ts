import { describe, expect, it } from 'vitest';
import { keepUpToDate, type UpdateEnvironment } from './updates';

const fakeEnvironment = (controlled: boolean) => {
  const log = { reloads: 0, checks: 0 };
  const listeners: { return: (() => void)[]; controller: (() => void)[]; timer: (() => void)[] } = { return: [], controller: [], timer: [] };
  const env: UpdateEnvironment = {
    onReturn: (l) => void listeners.return.push(l),
    controlled,
    onControllerChange: (l) => void listeners.controller.push(l),
    every: (_ms, l) => void listeners.timer.push(l),
    reload: () => void log.reloads++,
  };
  const check = () => void log.checks++;
  return { env, check, log, listeners };
};

describe('keeping the app up to date', () => {
  it('looks for a new version at start, each time the app comes back, and on a timer', () => {
    const { env, check, log, listeners } = fakeEnvironment(true);
    keepUpToDate(check, env);
    expect(log.checks).toBe(1);
    listeners.return.forEach((l) => l());
    listeners.timer.forEach((l) => l());
    expect(log.checks).toBe(3);
  });

  it('reloads once when a new worker takes over a page that already had one', () => {
    const { env, check, log, listeners } = fakeEnvironment(true);
    keepUpToDate(check, env);
    listeners.controller.forEach((l) => l());
    listeners.controller.forEach((l) => l());
    expect(log.reloads).toBe(1);
  });

  it('does not reload on the first visit, when the first worker takes control', () => {
    const { env, check, log, listeners } = fakeEnvironment(false);
    keepUpToDate(check, env);
    expect(listeners.controller).toHaveLength(0);
    expect(log.reloads).toBe(0);
  });
});
