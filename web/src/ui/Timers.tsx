import { useEffect, useRef, useState } from 'react';
import { useContainer } from '../app/hooks';
import { setStopwatch } from '../domain/useCases';
import { doneSetsOf, elapsedOn, stopwatchOf, totalSetsOf, type Workout } from '../domain/workout';
import { clockTime, elapsedTime } from './format';
import { Icons, PlayIcon } from './kit';

/**
 * A rest running until [endsAt] (epoch ms). [at] says where it shows: under the set with that id,
 * or [BETWEEN_EXERCISES] for the rest after a finished exercise, at the top of the session.
 */
export interface Rest {
  readonly at: string;
  readonly endsAt: number;
  readonly total: number;
}

export const BETWEEN_EXERCISES = 'between-exercises';

export const restFor = (at: string, seconds: number): Rest => ({ at, endsAt: Date.now() + seconds * 1000, total: seconds });

/** Running rests by workout, kept outside the card so a look at an exercise's page doesn't stop one. */
const rests = new Map<string, Rest>();

export const useRest = (workoutId: string): [Rest | null, (rest: Rest | null) => void] => {
  const [rest, setRest] = useState(() => rests.get(workoutId) ?? null);
  const update = (r: Rest | null) => {
    if (r) rests.set(workoutId, r); else rests.delete(workoutId);
    setRest(r);
  };
  return [rest, update];
};

const SHOW_OVER_MS = 6000;

/**
 * A rest counting down. When it runs out the phone buzzes, the timer says so for a few seconds,
 * then folds away.
 */
export const RestTimer = ({ rest, label, onChange }: { rest: Rest; label: string; onChange: (rest: Rest | null) => void }) => {
  const [now, setNow] = useState(Date.now);
  const change = useRef(onChange);
  change.current = onChange;
  const running = useRef(rest.endsAt > Date.now()); // came back after it ended: no buzz
  const left = Math.max(0, rest.endsAt - now);
  const over = left === 0;
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(tick);
  }, []);
  useEffect(() => {
    if (!over) return;
    if (running.current) navigator.vibrate?.([200, 100, 200]);
    const end = setTimeout(() => change.current(null), SHOW_OVER_MS);
    return () => clearTimeout(end);
  }, [over]);
  const shift = (seconds: number) => {
    const endsAt = Math.max(Date.now(), rest.endsAt + seconds * 1000);
    running.current = true;
    onChange({ ...rest, endsAt, total: Math.max(rest.total + seconds, 1) });
  };
  return (
    <div className={`rest-timer ${over ? 'over' : ''}`} role="timer" aria-label={label}>
      <div className="grow">
        <div className="rest-label">{over ? 'Rest over' : label}</div>
        <div className="rest-time">{over ? 'Go on' : clockTime(left)}</div>
      </div>
      {!over && <>
        <button className="rest-btn" aria-label="15 seconds less" onClick={() => shift(-15)}>−15</button>
        <button className="rest-btn" aria-label="15 seconds more" onClick={() => shift(15)}>+15</button>
      </>}
      <button className="rest-btn" aria-label={over ? 'Close timer' : 'Skip rest'} onClick={() => onChange(null)}>{over ? '✓' : 'Skip'}</button>
      <span className="rest-bar" style={{ width: `${Math.min(100, (left / (rest.total * 1000)) * 100)}%` }} />
    </div>
  );
};

/**
 * The stopwatch at the top of a session. Start (or the first ticked set) sets it going and the
 * last set stops it, but it is an ordinary stopwatch too: stop, go on, back to zero.
 */
export const SessionClock = ({ workout }: { workout: Workout }) => {
  const { repos } = useContainer();
  const clock = stopwatchOf(workout);
  const running = clock.runningSince !== null;
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!running) return;
    setNow(Date.now());
    const tick = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(tick);
  }, [running]);
  const ms = elapsedOn(clock, now);
  const total = totalSetsOf(workout);
  const finished = !running && ms > 0 && total > 0 && doneSetsOf(workout) === total;
  const act = (action: 'start' | 'stop' | 'reset') => void setStopwatch(repos, workout.id, action);
  return (
    <div className={`stopwatch ${running ? 'running' : ''} ${finished ? 'finished' : ''}`}>
      <div role="timer" aria-label="Workout time">
        <div className="stopwatch-label">{finished ? 'Finished in' : !running && ms > 0 ? 'Stopped' : 'Workout time'}</div>
        <div className="stopwatch-time">{elapsedTime(ms)}</div>
      </div>
      <div className="stopwatch-controls">
        <button className="stopwatch-btn" aria-label="Reset stopwatch" disabled={ms === 0} onClick={() => act('reset')}>{Icons.reset}</button>
        <button className="stopwatch-btn main" aria-label={running ? 'Stop stopwatch' : ms > 0 ? 'Resume stopwatch' : 'Start stopwatch'}
          onClick={() => act(running ? 'stop' : 'start')}>{running ? Icons.pause : <PlayIcon />}</button>
      </div>
    </div>
  );
};
