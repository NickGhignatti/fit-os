import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useContainer } from '../app/hooks';
import { deleteExercise, deleteSet, renameWorkout, updateExercise, type ExerciseDetails } from '../domain/edit';
import type { LocalDate } from '../domain/plan';
import type { PendingSession } from '../domain/trainingPlan';
import { addSetLikeLast, copyWorkoutTo, logSet, saveWorkoutAsPlan, setStopwatch, startPlannedSession, toggleSetDone } from '../domain/useCases';
import { newId } from '../domain/id';
import { beatsBest, exerciseKey, type PersonalRecord } from '../domain/records';
import { markedDone, doneSets, doneSetsOf, deviatesFromPlan, elapsedOn, restOf, stopwatchOf, totalSetsOf, type Exercise, type ExerciseSet, type Workout } from '../domain/workout';
import { clockTime, elapsedTime, formatKg, formatRest, parseNumber, relativeDay, setSummary, today } from './format';
import { useToast } from './hooks';
import { ActionMenu, ConfirmDialog, Icons, Modal, PlayIcon, ProgressBar, PromptDialog } from './kit';
import { PrPrompt } from './Records';
import { ShareButton } from './Transfer';

export const DateDialog = ({ title, initial, confirmLabel, onSubmit, onClose }: {
  title: string; initial: LocalDate; confirmLabel: string; onSubmit: (date: LocalDate) => void; onClose: () => void;
}) => {
  const [date, setDate] = useState(initial);
  return (
    <Modal title={title} onClose={onClose}>
      <input type="date" className="field" value={date} aria-label="Date" onChange={(e) => setDate(e.target.value)} />
      <div className="actions">
        <button className="btn secondary" onClick={onClose}>Cancel</button>
        <button className="btn" disabled={!date} onClick={() => { onSubmit(date); onClose(); }}>{confirmLabel}</button>
      </div>
    </Modal>
  );
};

const numberText = (n: number | null) => (n === null ? '' : String(n));

const SetDialog = ({ number, set, onSave, onDelete, onClose }: {
  number: number; set: ExerciseSet; onSave: (set: ExerciseSet) => void; onDelete: () => void; onClose: () => void;
}) => {
  const [plannedReps, setPlannedReps] = useState(numberText(set.plannedReps));
  const [plannedWeight, setPlannedWeight] = useState(numberText(set.plannedWeight));
  const [actualReps, setActualReps] = useState(numberText(set.actualReps));
  const [actualWeight, setActualWeight] = useState(numberText(set.actualWeight));
  const [done, setDone] = useState(set.done);

  const reps = parseNumber(plannedReps);
  const valid = reps !== null && reps > 0 && Number.isInteger(reps);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    const optionalInt = (text: string) => { const n = parseNumber(text); return n === null ? null : Math.round(n); };
    onSave({
      ...set, done,
      plannedReps: reps, plannedWeight: parseNumber(plannedWeight),
      actualReps: optionalInt(actualReps), actualWeight: parseNumber(actualWeight),
    });
    onClose();
  };
  const field = (label: string, value: string, set: (v: string) => void) => (
    <label className="stack grow"><span className="small muted">{label}</span>
      <input className="field" inputMode="decimal" value={value} onChange={(e) => set(e.target.value)} /></label>
  );
  return (
    <Modal title={`Set ${number}`} onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <p className="small muted">Planned</p>
        <div className="row">{field('Reps', plannedReps, setPlannedReps)}{field('kg', plannedWeight, setPlannedWeight)}</div>
        <p className="small muted">Actually done</p>
        <div className="row">{field('Reps', actualReps, setActualReps)}{field('kg', actualWeight, setActualWeight)}</div>
        <label className="row"><input type="checkbox" checked={done} onChange={(e) => setDone(e.target.checked)} /> Completed</label>
        <div className="actions">
          <button type="button" className="btn danger" onClick={() => { onDelete(); onClose(); }}>Delete set</button>
          <button type="submit" className="btn" disabled={!valid}>Save</button>
        </div>
      </form>
    </Modal>
  );
};

const REST_CHOICES = [0, 30, 45, 60, 90, 120, 180, 240];

/** The rest after each set, as a row of choices; a time set elsewhere (say, an imported plan) joins them. */
export const RestPicker = ({ value, onChange }: { value: number; onChange: (seconds: number) => void }) => (
  <div className="stack">
    <span className="small muted">Rest between sets</span>
    <div className="pills" role="radiogroup" aria-label="Rest between sets">
      {[...new Set([...REST_CHOICES, value])].sort((a, b) => a - b).map((s) => (
        <button key={s} type="button" role="radio" aria-checked={s === value} className={`pill ${s === value ? 'on' : ''}`}
          onClick={() => onChange(s)}>{formatRest(s)}</button>
      ))}
    </div>
  </div>
);

export const ExerciseDialog = ({ exercise, onSave, onClose }: {
  exercise: { name: string; notes: string; restSeconds?: number | null }; onSave: (details: ExerciseDetails) => void; onClose: () => void;
}) => {
  const [name, setName] = useState(exercise.name);
  const [notes, setNotes] = useState(exercise.notes);
  const [rest, setRest] = useState(restOf(exercise));
  return (
    <Modal title="Edit exercise" onClose={onClose}>
      <form className="stack" onSubmit={(e) => {
        e.preventDefault();
        if (name.trim()) { onSave({ name: name.trim(), notes: notes.trim(), restSeconds: rest }); onClose(); }
      }}>
        <label className="stack"><span className="small muted">Exercise</span>
          <input className="field" value={name} onChange={(e) => setName(e.target.value)} /></label>
        <label className="stack"><span className="small muted">Notes (optional)</span>
          <input className="field" value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
        <RestPicker value={rest} onChange={setRest} />
        <div className="actions">
          <button type="button" className="btn secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn" disabled={!name.trim()}>Save</button>
        </div>
      </form>
    </Modal>
  );
};

/** A rest running after the set [setId] of [exerciseId], until [endsAt] (epoch ms). */
interface Rest {
  readonly exerciseId: string;
  readonly setId: string;
  readonly endsAt: number;
  readonly total: number;
}

/** Running rests by workout, kept outside the card so a look at an exercise's page doesn't stop one. */
const rests = new Map<string, Rest>();

const useRest = (workoutId: string): [Rest | null, (rest: Rest | null) => void] => {
  const [rest, setRest] = useState(() => rests.get(workoutId) ?? null);
  const update = (r: Rest | null) => {
    if (r) rests.set(workoutId, r); else rests.delete(workoutId);
    setRest(r);
  };
  return [rest, update];
};

const SHOW_OVER_MS = 6000;

/**
 * The countdown between two sets, sitting right under the set just done. When it runs out the
 * phone buzzes, the timer says so for a few seconds, then folds away.
 */
const RestTimer = ({ rest, onChange }: { rest: Rest; onChange: (rest: Rest | null) => void }) => {
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
    <div className={`rest-timer ${over ? 'over' : ''}`} role="timer" aria-label="Rest">
      <div className="grow">
        <div className="rest-label">{over ? 'Rest over' : 'Rest'}</div>
        <div className="rest-time">{over ? 'Next set' : clockTime(left)}</div>
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
const SessionClock = ({ workout }: { workout: Workout }) => {
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

type Dialog =
  | { kind: 'rename' } | { kind: 'delete' } | { kind: 'saveAsPlan' } | { kind: 'copy' }
  | { kind: 'editExercise'; exercise: Exercise } | { kind: 'deleteExercise'; exercise: Exercise }
  | { kind: 'editSet'; exercise: Exercise; set: ExerciseSet; number: number };

export const WorkoutCard = ({ workout }: { workout: Workout }) => {
  const { repos } = useContainer();
  const toast = useToast();
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const close = () => setDialog(null);
  const save = (w: Workout) => void repos.workouts.save(w);
  const [pr, setPr] = useState<PersonalRecord | null>(null);

  /** After a set is done: if it beats a stored personal record, offer to save it. */
  const checkForPr = async (exercise: Exercise, set: ExerciseSet) => {
    const reps = set.actualReps ?? set.plannedReps;
    const weight = set.actualWeight ?? set.plannedWeight;
    const candidate: PersonalRecord = {
      id: newId(), exerciseKey: exerciseKey(exercise.name, exercise.catalogId), exerciseName: exercise.name, catalogId: exercise.catalogId,
      ...(weight !== null && weight > 0 ? { metric: 'weight' as const, value: weight, reps } : { metric: 'reps' as const, value: reps, reps: null }),
      date: workout.date, note: '',
    };
    if (reps > 0 && beatsBest(candidate, await repos.records.getFor(candidate.exerciseKey))) setPr(candidate);
  };

  const [rest, setRest] = useRest(workout.id);
  // Exercises with every set done fold into one line; these are the ones opened again.
  const [unfolded, setUnfolded] = useState<ReadonlySet<string>>(new Set());
  const unfold = (id: string, open: boolean) =>
    setUnfolded((s) => { const next = new Set(s); if (open) next.add(id); else next.delete(id); return next; });

  const toggle = async (exercise: Exercise, set: ExerciseSet) => {
    await toggleSetDone(repos, workout.id, set);
    if (!set.done) { // it just became done
      const seconds = restOf(exercise);
      if (seconds > 0) setRest({ exerciseId: exercise.id, setId: set.id, endsAt: Date.now() + seconds * 1000, total: seconds });
      void checkForPr(exercise, markedDone(set));
    } else if (rest?.setId === set.id) {
      setRest(null);
    }
  };
  const timerAfter = (exerciseId: string, setId: string | null) =>
    rest && rest.exerciseId === exerciseId && (setId === null || rest.setId === setId)
      ? <RestTimer key={rest.setId} rest={rest} onChange={setRest} /> : null;

  return (
    <section className="card" aria-label={workout.title}>
      <div className="row between">
        <div className="grow">
          <div className="title">{workout.title}</div>
          <div className="small muted">{doneSetsOf(workout)}/{totalSetsOf(workout)} sets done</div>
        </div>
        <ShareButton kind="workout" data={workout} title={workout.title} />
        <ActionMenu actions={[
          { label: 'Rename', onSelect: () => setDialog({ kind: 'rename' }) },
          { label: 'Save as daily workout', onSelect: () => setDialog({ kind: 'saveAsPlan' }) },
          { label: 'Copy to another day', onSelect: () => setDialog({ kind: 'copy' }) },
          { label: 'Delete', danger: true, onSelect: () => setDialog({ kind: 'delete' }) },
        ]} />
      </div>
      <ProgressBar value={doneSetsOf(workout)} max={totalSetsOf(workout)} label={`${workout.title} progress`} />
      <SessionClock workout={workout} />

      {workout.exercises.map((exercise) => {
        const finished = exercise.sets.length > 0 && doneSets(exercise) === exercise.sets.length;
        const plan = setSummary(exercise.sets.map((s) => ({ reps: s.plannedReps, weight: s.plannedWeight })));
        if (finished && !unfolded.has(exercise.id)) {
          return (
            <div key={exercise.id} className="exercise-block">
              <button className="exercise-done" aria-expanded={false} aria-label={`${exercise.name}, done`} onClick={() => unfold(exercise.id, true)}>
                <span className="set-check on" aria-hidden="true"><span className="set-box">{Icons.check}</span></span>
                <span className="grow">
                  <span className="title">{exercise.name}</span>
                  <span className="small muted">{exercise.sets.length}/{exercise.sets.length} sets · {plan}</span>
                </span>
                <span className="fold-icon" aria-hidden="true">{Icons.chevron}</span>
              </button>
              {timerAfter(exercise.id, null)}
            </div>
          );
        }
        return (
          <div key={exercise.id} className="exercise-block">
            <div className="row between">
              <div className="grow">
                {exercise.catalogId
                  ? <Link className="title" to={`/exercises/${encodeURIComponent(exercise.catalogId)}`}>{exercise.name}</Link>
                  : <span className="title">{exercise.name}</span>}
                <div className="small muted">
                  {exercise.notes ? `${exercise.notes} · ` : ''}{doneSets(exercise)}/{exercise.sets.length} sets · {plan}
                  {restOf(exercise) > 0 ? ` · ${formatRest(restOf(exercise))} rest` : ''}
                </div>
              </div>
              {finished && (
                <button className="icon-btn small-icon fold-icon open" aria-expanded={true} aria-label={`Fold ${exercise.name}`}
                  onClick={() => unfold(exercise.id, false)}>{Icons.chevron}</button>
              )}
              <ActionMenu label={`${exercise.name} options`} actions={[
                { label: 'Add set', onSelect: () => void addSetLikeLast(repos, workout.id, exercise.id) },
                { label: 'Edit', onSelect: () => setDialog({ kind: 'editExercise', exercise }) },
                { label: 'Delete', danger: true, onSelect: () => setDialog({ kind: 'deleteExercise', exercise }) },
              ]} />
            </div>
            {exercise.sets.length === 0 && <p className="small muted">No sets. Use ⋮ › Add set.</p>}
            {exercise.sets.map((set, index) => (
              <div key={set.id}>
                <div className={`set-row ${set.done ? 'done' : ''}`}>
                  <button className="set-main" onClick={() => setDialog({ kind: 'editSet', exercise, set, number: index + 1 })}>
                    <span className="set-label">Set {index + 1}</span>{' '}
                    <span className="set-target">{set.plannedReps}{set.plannedWeight !== null ? ` × ${formatKg(set.plannedWeight)}` : ''}</span>
                    {deviatesFromPlan(set) && (
                      <span className="chip carbs">
                        Did {set.actualReps ?? set.plannedReps}{set.actualWeight !== null ? ` × ${formatKg(set.actualWeight)}` : ''}
                      </span>
                    )}
                  </button>
                  <button className={`set-check ${set.done ? 'on' : ''}`} aria-label={`Set ${index + 1} ${set.done ? 'done' : 'not done'}`}
                    aria-pressed={set.done} onClick={() => void toggle(exercise, set)}><span className="set-box">{Icons.check}</span></button>
                </div>
                {timerAfter(exercise.id, set.id)}
              </div>
            ))}
          </div>
        );
      })}

      {pr && <PrPrompt record={pr} onClose={() => setPr(null)} />}

      {dialog?.kind === 'rename' && (
        <PromptDialog title="Rename workout" label="Name" initial={workout.title} onClose={close} onSubmit={(t) => save(renameWorkout(workout, t))} />
      )}
      {dialog?.kind === 'delete' && (
        <ConfirmDialog title="Delete workout?" message={`“${workout.title}” and everything logged in it will be removed.`} onClose={close}
          onConfirm={() => void repos.workouts.delete(workout.id)} />
      )}
      {dialog?.kind === 'saveAsPlan' && (
        <PromptDialog title="Save as daily workout" label="Name" initial={workout.title} confirmLabel="Save" onClose={close}
          onSubmit={(name) => void saveWorkoutAsPlan(repos, workout.id, name).then(() => toast(`Saved as workout “${name}” in Workouts`))} />
      )}
      {dialog?.kind === 'copy' && (
        <DateDialog title="Copy to another day" initial={today()} confirmLabel="Copy" onClose={close}
          onSubmit={(date) => void copyWorkoutTo(repos, workout.id, date).then(() => toast(`Copied to ${relativeDay(date)}`))} />
      )}
      {dialog?.kind === 'editExercise' && (
        <ExerciseDialog exercise={dialog.exercise} onClose={close} onSave={(details) => save(updateExercise(workout, dialog.exercise.id, details))} />
      )}
      {dialog?.kind === 'deleteExercise' && (
        <ConfirmDialog title="Delete exercise?" message={`“${dialog.exercise.name}” and its sets will be removed.`} onClose={close}
          onConfirm={() => save(deleteExercise(workout, dialog.exercise.id))} />
      )}
      {dialog?.kind === 'editSet' && (
        <SetDialog number={dialog.number} set={dialog.set} onClose={close}
          onSave={(s) => void logSet(repos, workout.id, s).then(() => (s.done ? checkForPr(dialog.exercise, s) : undefined))} onDelete={() => save(deleteSet(workout, dialog.set.id))} />
      )}
    </section>
  );
};

/** A session the active plan asks for today, until it is started. */
export const PendingSessionCard = ({ session, date }: { session: PendingSession; date: LocalDate }) => {
  const { repos } = useContainer();
  return (
    <section className="session" aria-label={`${session.title}, from your plan`}>
      <div className="grow">
        <div className="eyebrow">From your plan</div>
        <div className="session-title">{session.title}</div>
        <ul className="session-list">
          {session.exercises.map((e, i) => (
            <li key={i}>{e.name} <span>{setSummary(e.sets)}</span></li>
          ))}
        </ul>
      </div>
      <button className="play" aria-label="Start workout" onClick={() => void startPlannedSession(repos, date, session.planId)}>
        <PlayIcon />
      </button>
    </section>
  );
};
