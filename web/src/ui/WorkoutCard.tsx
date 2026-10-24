import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useContainer } from '../app/hooks';
import { deleteExercise, deleteSet, renameWorkout, updateExercise, type ExerciseDetails } from '../domain/edit';
import { newId } from '../domain/id';
import type { LocalDate } from '../domain/plan';
import { beatsBest, exerciseKey, type PersonalRecord } from '../domain/records';
import type { PendingSession } from '../domain/trainingPlan';
import {
  addSetLikeLast, copyWorkoutTo, logSet, saveWorkoutAsPlan, startPlannedSession, toggleSetDone,
} from '../domain/useCases';
import {
  deviatesFromPlan, doneSets, doneSetsOf, isExerciseDone, markedDone, restAfterOf, restOf, totalSetsOf,
  type Exercise, type ExerciseSet, type Workout,
} from '../domain/workout';
import { formatKg, formatRest, formatWeight, parseNumber, relativeDay, setSummary, today } from './format';
import { useToast } from './hooks';
import { ActionMenu, ConfirmDialog, Icons, Modal, PlayIcon, ProgressBar, PromptDialog, SwipeToComplete } from './kit';
import { PrPrompt } from './Records';
import { BETWEEN_EXERCISES, RestTimer, SessionClock, restFor, useRest } from './Timers';
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
  const [note, setNote] = useState(set.note ?? '');
  const [done, setDone] = useState(set.done);

  const reps = parseNumber(plannedReps);
  const valid = reps !== null && reps > 0 && Number.isInteger(reps);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    const optionalInt = (text: string) => { const n = parseNumber(text); return n === null ? null : Math.round(n); };
    onSave({
      ...set, done, note: note.trim(),
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
        <label className="stack"><span className="small muted">Note</span>
          <textarea className="field" rows={2} maxLength={500} value={note} placeholder="How did it go? Grip, tempo, a niggle…"
            onChange={(e) => setNote(e.target.value)} /></label>
        <label className="row"><input type="checkbox" checked={done} onChange={(e) => setDone(e.target.checked)} /> Completed</label>
        <div className="actions">
          <button type="button" className="btn danger" onClick={() => { onDelete(); onClose(); }}>Delete set</button>
          <button type="submit" className="btn" disabled={!valid}>Save</button>
        </div>
      </form>
    </Modal>
  );
};

const REST_CHOICES = [0, 30, 45, 60, 90, 120, 180, 240, 300];

/** A rest time as a row of choices; a time set elsewhere (say, an imported plan) joins them. */
export const RestPicker = ({ label, value, onChange }: { label: string; value: number; onChange: (seconds: number) => void }) => (
  <div className="stack">
    <span className="small muted">{label}</span>
    <div className="pills" role="radiogroup" aria-label={label}>
      {[...new Set([...REST_CHOICES, value])].sort((a, b) => a - b).map((s) => (
        <button key={s} type="button" role="radio" aria-checked={s === value} className={`pill ${s === value ? 'on' : ''}`}
          onClick={() => onChange(s)}>{formatRest(s)}</button>
      ))}
    </div>
  </div>
);

export const ExerciseDialog = ({ exercise, onSave, onClose }: {
  exercise: { name: string; notes: string; restSeconds?: number | null; restAfterSeconds?: number | null };
  onSave: (details: ExerciseDetails) => void; onClose: () => void;
}) => {
  const [name, setName] = useState(exercise.name);
  const [notes, setNotes] = useState(exercise.notes);
  const [rest, setRest] = useState(restOf(exercise));
  const [restAfter, setRestAfter] = useState(restAfterOf(exercise));
  return (
    <Modal title="Edit exercise" onClose={onClose}>
      <form className="stack" onSubmit={(e) => {
        e.preventDefault();
        if (name.trim()) { onSave({ name: name.trim(), notes: notes.trim(), restSeconds: rest, restAfterSeconds: restAfter }); onClose(); }
      }}>
        <label className="stack"><span className="small muted">Exercise</span>
          <input className="field" value={name} onChange={(e) => setName(e.target.value)} /></label>
        <label className="stack"><span className="small muted">Notes (optional)</span>
          <input className="field" value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
        <RestPicker label="Rest between sets" value={rest} onChange={setRest} />
        <RestPicker label="Rest after the exercise" value={restAfter} onChange={setRestAfter} />
        <div className="actions">
          <button type="button" className="btn secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn" disabled={!name.trim()}>Save</button>
        </div>
      </form>
    </Modal>
  );
};

/** "1m 30s between sets · 2m after", leaving out the rests that are off. */
export const restLine = (e: { readonly restSeconds?: number | null; readonly restAfterSeconds?: number | null }): string =>
  [restOf(e) > 0 ? `${formatRest(restOf(e))} between sets` : '', restAfterOf(e) > 0 ? `${formatRest(restAfterOf(e))} after` : '']
    .filter(Boolean).join(' · ');

/**
 * One set: its number, what to do spelled out ("5 reps · 100 kg"), its note or room for one, and
 * the box to tick on the right. A tap on the left opens the set to edit it.
 */
const SetRow = ({ set, number, onToggle, onEdit }: { set: ExerciseSet; number: number; onToggle: () => void; onEdit: () => void }) => (
  <div className={`set-row ${set.done ? 'done' : ''}`}>
    <button className="set-main" onClick={onEdit}>
      <span className="set-label">Set {number}</span>{' '}
      <span className="set-what">
        <span className="set-vals">
          <span className="set-val"><b>{set.plannedReps}</b> reps</span>{' '}
          <span className="set-val">{set.plannedWeight === null ? 'bodyweight' : <><b>{formatWeight(set.plannedWeight)}</b> kg</>}</span>
          {deviatesFromPlan(set) && (
            <span className="chip carbs">Did {set.actualReps ?? set.plannedReps}{set.actualWeight !== null ? ` × ${formatKg(set.actualWeight)}` : ''}</span>
          )}
        </span>{' '}
        <span className={`set-note ${set.note ? '' : 'blank'}`}>{set.note || 'Add a note'}</span>
      </span>
    </button>
    <button className={`set-check ${set.done ? 'on' : ''}`} aria-label={`Set ${number} ${set.done ? 'done' : 'not done'}`}
      aria-pressed={set.done} onClick={onToggle}><span className="set-box">{Icons.check}</span></button>
  </div>
);

/** The exercise just finished, offering the rest before the next one. */
interface Offer {
  readonly done: string;
  readonly next: string;
  readonly seconds: number;
}

type Dialog =
  | { kind: 'rename' } | { kind: 'delete' } | { kind: 'saveAsPlan' } | { kind: 'copy' } | { kind: 'completed' }
  | { kind: 'editExercise'; exercise: Exercise } | { kind: 'deleteExercise'; exercise: Exercise }
  | { kind: 'editSet'; exercise: Exercise; set: ExerciseSet; number: number };

/**
 * A workout being done. On top, the stopwatch and, after an exercise, the rest before the next;
 * then a card gathering the exercises already done; then what is left, each exercise swiped away
 * (or ticked set by set) once finished.
 */
export const WorkoutCard = ({ workout }: { workout: Workout }) => {
  const { repos } = useContainer();
  const toast = useToast();
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const close = () => setDialog(null);
  const save = (w: Workout) => void repos.workouts.save(w);
  const [pr, setPr] = useState<PersonalRecord | null>(null);
  const [rest, setRest] = useRest(workout.id);
  const [offer, setOffer] = useState<Offer | null>(null);
  const [shownDone, setShownDone] = useState<ReadonlySet<string>>(new Set());
  const toggleShownDone = (id: string) =>
    setShownDone((s) => { const next = new Set(s); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const done = workout.exercises.filter(isExerciseDone);
  const left = workout.exercises.filter((e) => !isExerciseDone(e));

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

  /** An exercise just got its last set: offer the rest before the next one, if any is left. */
  const finished = (exercise: Exercise) => {
    const next = left.find((e) => e.id !== exercise.id);
    const seconds = restAfterOf(exercise);
    if (rest && rest.at !== BETWEEN_EXERCISES) setRest(null);
    setOffer(next && seconds > 0 ? { done: exercise.name, next: next.name, seconds } : null);
  };

  const toggle = async (exercise: Exercise, set: ExerciseSet) => {
    await toggleSetDone(repos, workout.id, set);
    if (set.done) {
      if (rest?.at === set.id) setRest(null);
      return;
    }
    void checkForPr(exercise, markedDone(set));
    if (exercise.sets.every((s) => s.done || s.id === set.id)) {
      finished(exercise);
    } else if (restOf(exercise) > 0) {
      setOffer(null);
      setRest(restFor(set.id, restOf(exercise)));
    }
  };

  const setRow = (exercise: Exercise, set: ExerciseSet, index: number) => (
    <SetRow set={set} number={index + 1} onToggle={() => void toggle(exercise, set)}
      onEdit={() => setDialog({ kind: 'editSet', exercise, set, number: index + 1 })} />
  );
  const setRows = (exercise: Exercise) => exercise.sets.map((set, index) => <div key={set.id}>{setRow(exercise, set, index)}</div>);

  /**
   * The sets still to do, each swiped away (or ticked) once done; done ones step aside, shown
   * again on request. The rest after a set sits where that set was, above the next one.
   */
  const openSets = (exercise: Exercise) => {
    const resting = rest !== null && exercise.sets.some((s) => s.id === rest.at);
    const done = exercise.sets.filter((s) => s.done).length;
    const showing = shownDone.has(exercise.id);
    return (
      <>
        {done > 0 && (
          <button className="done-sets-toggle" aria-expanded={showing} onClick={() => toggleShownDone(exercise.id)}>
            {Icons.check}{done} {done === 1 ? 'set' : 'sets'} done · {showing ? 'hide' : 'show'}
          </button>
        )}
        {resting && <RestTimer key={rest.at} rest={rest} label="Rest" onChange={setRest} />}
        {exercise.sets.map((set, index) => set.done
          ? showing && <div key={set.id} className="done-set">{setRow(exercise, set, index)}</div>
          : (
            <SwipeToComplete key={set.id} label={`Set ${index + 1} of ${exercise.name}`} onComplete={() => void toggle(exercise, set)}>
              {setRow(exercise, set, index)}
            </SwipeToComplete>
          ))}
      </>
    );
  };

  return (
    <section className="card workout" aria-label={workout.title}>
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

      <div className="timer-zone">
        <SessionClock workout={workout} />
        {rest?.at === BETWEEN_EXERCISES ? (
          <RestTimer key={rest.at} rest={rest} label="Rest before the next exercise" onChange={setRest} />
        ) : offer && (
          <div className="rest-offer" role="status">
            <div className="grow">
              <div className="rest-label">{offer.done} done</div>
              <div className="rest-next">Next: {offer.next}</div>
            </div>
            <button className="btn small" onClick={() => { setRest(restFor(BETWEEN_EXERCISES, offer.seconds)); setOffer(null); }}>
              Rest {formatRest(offer.seconds)}
            </button>
            <button className="icon-btn small-icon" aria-label="No rest" onClick={() => setOffer(null)}>×</button>
          </div>
        )}
      </div>

      {done.length > 0 && (
        <button className="done-card" aria-haspopup="dialog" onClick={() => setDialog({ kind: 'completed' })}>
          <span className="set-check on" aria-hidden="true"><span className="set-box">{Icons.check}</span></span>
          <span className="grow">
            <span className="title">Completed exercises</span>
            <span className="small muted">{done.map((e) => e.name).join(' · ')}</span>
          </span>
          <span className="done-count">{done.length}/{workout.exercises.length}</span>
          <span className="done-chevron" aria-hidden="true">{Icons.chevron}</span>
        </button>
      )}

      {left.length === 0 && workout.exercises.length > 0 && <p className="all-done">Every exercise is done. Well trained.</p>}
      {left.map((exercise) => (
        <div key={exercise.id} className="exercise-block" role="group" aria-label={exercise.name}>
          <div className="row between">
            <div className="grow">
              {exercise.catalogId
                ? <Link className="title" to={`/exercises/${encodeURIComponent(exercise.catalogId)}`}>{exercise.name}</Link>
                : <span className="title">{exercise.name}</span>}
              <div className="small muted">
                {doneSets(exercise)}/{exercise.sets.length} sets · {setSummary(exercise.sets.map((s) => ({ reps: s.plannedReps, weight: s.plannedWeight })))}
              </div>
              {restLine(exercise) && <div className="exercise-rest">Rest {restLine(exercise)}</div>}
              {exercise.notes && <div className="exercise-notes">{exercise.notes}</div>}
            </div>
            <ActionMenu label={`${exercise.name} options`} actions={[
              { label: 'Add set', onSelect: () => void addSetLikeLast(repos, workout.id, exercise.id) },
              { label: 'Edit', onSelect: () => setDialog({ kind: 'editExercise', exercise }) },
              { label: 'Delete', danger: true, onSelect: () => setDialog({ kind: 'deleteExercise', exercise }) },
            ]} />
          </div>
          {exercise.sets.length === 0 && <p className="small muted">No sets. Use ⋮ › Add set.</p>}
          {openSets(exercise)}
        </div>
      ))}
      {left.length > 0 && <p className="swipe-hint">Swipe a set sideways when it's done.</p>}

      {pr && <PrPrompt record={pr} onClose={() => setPr(null)} />}

      {dialog?.kind === 'completed' && (
        <Modal title="Completed exercises" onClose={close}>
          {done.length === 0 ? <p className="muted">None left here: they're all back in the list.</p> : done.map((exercise) => (
            <section key={exercise.id} className="completed-exercise" aria-label={exercise.name}>
              <div className="title">{exercise.name}</div>
              <div className="small muted">{setSummary(exercise.sets.map((s) => ({ reps: s.plannedReps, weight: s.plannedWeight })))}</div>
              {setRows(exercise)}
            </section>
          ))}
          <p className="small muted">Untick a set to put its exercise back in the list.</p>
        </Modal>
      )}
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
          onSave={(s) => void logSet(repos, workout.id, s).then(() => (s.done ? checkForPr(dialog.exercise, s) : undefined))}
          onDelete={() => save(deleteSet(workout, dialog.set.id))} />
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
