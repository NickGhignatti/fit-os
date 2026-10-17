import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useContainer } from '../app/hooks';
import { deleteExercise, deleteSet, renameWorkout, updateExercise } from '../domain/edit';
import type { LocalDate } from '../domain/plan';
import type { PendingSession } from '../domain/trainingPlan';
import { addSetLikeLast, copyWorkoutTo, logSet, saveWorkoutAsPlan, startPlannedSession, toggleSetDone } from '../domain/useCases';
import { newId } from '../domain/id';
import { beatsBest, exerciseKey, type PersonalRecord } from '../domain/records';
import { markedDone, doneSets, doneSetsOf, deviatesFromPlan, totalSetsOf, type Exercise, type ExerciseSet, type Workout } from '../domain/workout';
import { dateTitle, formatKg, parseNumber, relativeDay, setSummary, today } from './format';
import { useToast } from './hooks';
import { ActionMenu, ConfirmDialog, Modal, ProgressBar, PromptDialog } from './kit';
import { PrPrompt } from './Records';
import { SendButton } from './Transfer';

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

export const ExerciseDialog = ({ exercise, onSave, onClose }: { exercise: { name: string; notes: string }; onSave: (name: string, notes: string) => void; onClose: () => void }) => {
  const [name, setName] = useState(exercise.name);
  const [notes, setNotes] = useState(exercise.notes);
  return (
    <Modal title="Edit exercise" onClose={onClose}>
      <form className="stack" onSubmit={(e) => { e.preventDefault(); if (name.trim()) { onSave(name.trim(), notes.trim()); onClose(); } }}>
        <label className="stack"><span className="small muted">Exercise</span>
          <input className="field" value={name} onChange={(e) => setName(e.target.value)} /></label>
        <label className="stack"><span className="small muted">Notes (optional)</span>
          <input className="field" value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
        <div className="actions">
          <button type="button" className="btn secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn" disabled={!name.trim()}>Save</button>
        </div>
      </form>
    </Modal>
  );
};

type Dialog =
  | { kind: 'rename' } | { kind: 'delete' } | { kind: 'saveAsPlan' } | { kind: 'copy' }
  | { kind: 'editExercise'; exercise: Exercise } | { kind: 'deleteExercise'; exercise: Exercise }
  | { kind: 'editSet'; exercise: Exercise; set: ExerciseSet; number: number };

export const WorkoutCard = ({ workout }: { workout: Workout }) => {
  const { repos } = useContainer();
  const toast = useToast();
  const navigate = useNavigate();
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

  const toggle = async (exercise: Exercise, set: ExerciseSet) => {
    await toggleSetDone(repos, workout.id, set);
    if (!set.done) void checkForPr(exercise, markedDone(set)); // it just became done
  };

  return (
    <section className="card" aria-label={workout.title}>
      <div className="row between">
        <div className="grow">
          <div className="title">{workout.title}</div>
          <div className="small muted">{doneSetsOf(workout)}/{totalSetsOf(workout)} sets done</div>
        </div>
        <ActionMenu actions={[
          { label: 'Rename', onSelect: () => setDialog({ kind: 'rename' }) },
          { label: 'Add exercise', onSelect: () => navigate(`/exercises/pick?workout=${workout.id}`) },
          { label: 'Save as daily workout', onSelect: () => setDialog({ kind: 'saveAsPlan' }) },
          { label: 'Copy to another day', onSelect: () => setDialog({ kind: 'copy' }) },
          { label: 'Delete', danger: true, onSelect: () => setDialog({ kind: 'delete' }) },
        ]} />
      </div>
      <ProgressBar value={doneSetsOf(workout)} max={totalSetsOf(workout)} label={`${workout.title} progress`} />

      {workout.exercises.map((exercise) => (
        <div key={exercise.id} style={{ marginTop: 14 }}>
          <div className="row between">
            <div className="grow">
              {exercise.catalogId
                ? <Link className="title" to={`/exercises/${encodeURIComponent(exercise.catalogId)}`}>{exercise.name}</Link>
                : <span className="title">{exercise.name}</span>}
              <div className="small muted">
                {exercise.notes ? `${exercise.notes} · ` : ''}{doneSets(exercise)}/{exercise.sets.length} sets · {setSummary(exercise.sets.map((s) => ({ reps: s.plannedReps, weight: s.plannedWeight })))}
              </div>
            </div>
            <ActionMenu label={`${exercise.name} options`} actions={[
              { label: 'Add set', onSelect: () => void addSetLikeLast(repos, workout.id, exercise.id) },
              { label: 'Edit', onSelect: () => setDialog({ kind: 'editExercise', exercise }) },
              { label: 'Delete', danger: true, onSelect: () => setDialog({ kind: 'deleteExercise', exercise }) },
            ]} />
          </div>
          {exercise.sets.length === 0 && <p className="small muted">No sets. Use ⋮ › Add set.</p>}
          {exercise.sets.map((set, index) => (
            <div key={set.id} className="set-row">
              <button className={`check ${set.done ? 'on' : ''}`} aria-label={`Set ${index + 1} ${set.done ? 'done' : 'not done'}`}
                aria-pressed={set.done} onClick={() => void toggle(exercise, set)}>{set.done ? '✓' : ''}</button>
              <button className="list-item grow" style={{ border: 0, minHeight: 44, padding: 0 }}
                onClick={() => setDialog({ kind: 'editSet', exercise, set, number: index + 1 })}>
                <span className="grow">
                  <span className="title">Set {index + 1}</span>{' '}
                  <span className="muted">{set.plannedReps}{set.plannedWeight !== null ? ` × ${formatKg(set.plannedWeight)}` : ''}</span>
                  {deviatesFromPlan(set) && (
                    <span className="chip carbs" style={{ marginLeft: 8 }}>
                      Did {set.actualReps ?? set.plannedReps}{set.actualWeight !== null ? ` × ${formatKg(set.actualWeight)}` : ''}
                    </span>
                  )}
                </span>
              </button>
            </div>
          ))}
        </div>
      ))}

      <div className="actions" style={{ justifyContent: 'flex-start' }}>
        <button className="btn secondary" onClick={() => navigate(`/exercises/pick?workout=${workout.id}`)}>Add exercise</button>
      </div>
      <SendButton kind="workout" data={workout} />
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
        <ExerciseDialog exercise={dialog.exercise} onClose={close} onSave={(n, notes) => save(updateExercise(workout, dialog.exercise.id, n, notes))} />
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
    <section className="card" aria-label={`${session.title}, from your plan`}>
      <div className="small muted">From your plan · {dateTitle(date)}</div>
      <div className="title">{session.title}</div>
      <ul style={{ paddingLeft: 18, margin: '8px 0' }}>
        {session.exercises.map((e, i) => (
          <li key={i}>{e.name} <span className="muted">{setSummary(e.sets)}</span></li>
        ))}
      </ul>
      <button className="btn" onClick={() => void startPlannedSession(repos, date, session.planId)}>Start workout</button>
    </section>
  );
};
