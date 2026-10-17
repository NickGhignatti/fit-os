import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useContainer } from '../app/hooks';
import { EQUIPMENT, MUSCLES, noFilter, type Equipment, type ExerciseFilter, type ExerciseInfo, type Muscle } from '../domain/catalog';
import { addExercise, addPlannedExercise } from '../domain/edit';
import type { PlanDay } from '../domain/plan';
import type { ExercisePlan } from '../domain/workout';
import {
  CATEGORY_LABEL, EQUIPMENT_LABEL, LEVEL_LABEL, MUSCLE_LABEL, parseNumber,
} from './format';
import { useAsync } from './hooks';
import { Empty, Loading, Modal, PageHeader, useDebounced } from './kit';

/** Search box, filters and the matching exercises. [onPick] turns rows into buttons; otherwise they open the detail page. */
export const ExerciseBrowser = ({ onPick, onCustom }: { onPick?: (exercise: ExerciseInfo) => void; onCustom?: (name: string) => void }) => {
  const { repos } = useContainer();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<ExerciseFilter>(noFilter);
  const debounced = useDebounced(query);
  const result = useAsync(() => repos.exercises.search(debounced, filter), [debounced, filter]);

  const pills = <T extends string>(label: string, options: readonly T[], names: Record<T, string>, value: T | null, set: (v: T | null) => void) => (
    <div className="pills" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o} className={`pill ${value === o ? 'on' : ''}`} aria-pressed={value === o} onClick={() => set(value === o ? null : o)}>
          {names[o]}
        </button>
      ))}
    </div>
  );

  return (
    <>
      <input className="field" type="search" value={query} placeholder="Search, e.g. squat, bench press, curl"
        aria-label="Search exercises" onChange={(e) => setQuery(e.target.value)} />
      {pills<Muscle>('Muscle', MUSCLES, MUSCLE_LABEL, filter.muscle, (muscle) => setFilter({ ...filter, muscle }))}
      {pills<Equipment>('Equipment', EQUIPMENT, EQUIPMENT_LABEL, filter.equipment, (equipment) => setFilter({ ...filter, equipment }))}
      {onCustom && (
        <button className="list-item" onClick={() => onCustom(query.trim())}>
          <span className="grow title">Add your own exercise…</span>
        </button>
      )}
      {result.state === 'loading' && <Loading />}
      {result.state === 'failed' && <Empty>Could not load the exercise catalogue. Check your connection and reload.</Empty>}
      {result.state === 'ready' && result.value.length === 0 && <Empty>No exercises match. Try fewer words or clear a filter.</Empty>}
      {result.state === 'ready' && result.value.slice(0, 100).map((e) => {
        const body = (
          <>
            <span className="grow">
              <span className="title">{e.name}</span>
              <br />
              <span className="small muted">
                {e.primaryMuscles.map((m) => MUSCLE_LABEL[m]).join(', ') || CATEGORY_LABEL[e.category]}
                {e.equipment ? ` · ${EQUIPMENT_LABEL[e.equipment]}` : ''}
              </span>
            </span>
            <span className="muted">{onPick ? '＋' : '›'}</span>
          </>
        );
        return onPick
          ? <button key={e.id} className="list-item" onClick={() => onPick(e)}>{body}</button>
          : <Link key={e.id} className="list-item" to={`/exercises/${encodeURIComponent(e.id)}`}>{body}</Link>;
      })}
      {result.state === 'ready' && result.value.length > 100 && <p className="small muted">Showing 100 of {result.value.length}. Refine your search to see others.</p>}
    </>
  );
};

/** Sets, reps and weight for a new exercise, as in the Android "Add exercise" dialog. */
const AddExerciseDialog = ({ name, catalogId, onSubmit, onClose }: {
  name: string; catalogId: string | null; onSubmit: (plan: ExercisePlan) => void; onClose: () => void;
}) => {
  const [title, setTitle] = useState(name);
  const [sets, setSets] = useState('3');
  const [reps, setReps] = useState('10');
  const [weight, setWeight] = useState('');
  const [notes, setNotes] = useState('');
  const n = parseNumber(sets);
  const r = parseNumber(reps);
  const w = parseNumber(weight);
  const valid = title.trim() !== '' && n !== null && n >= 1 && n <= 50 && Number.isInteger(n) && r !== null && r >= 1 && Number.isInteger(r) && (weight.trim() === '' || (w !== null && w >= 0));

  const input = (label: string, value: string, set: (v: string) => void, mode: 'text' | 'decimal' = 'decimal') => (
    <label className="stack grow"><span className="small muted">{label}</span>
      <input className="field" inputMode={mode} value={value} onChange={(e) => set(e.target.value)} /></label>
  );
  return (
    <Modal title="Add exercise" onClose={onClose}>
      <form className="stack" onSubmit={(e) => {
        e.preventDefault();
        if (!valid) return;
        onSubmit({ name: title.trim(), notes: notes.trim(), catalogId, sets: Array.from({ length: n }, () => ({ reps: r, weight: w })) });
        onClose();
      }}>
        {input('Exercise', title, setTitle, 'text')}
        <div className="row">{input('Sets', sets, setSets)}{input('Reps', reps, setReps)}{input('kg', weight, setWeight)}</div>
        {input('Notes (optional)', notes, setNotes, 'text')}
        <p className="small muted">Leave kg empty for bodyweight. You can tweak single sets later.</p>
        <div className="actions">
          <button type="button" className="btn secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn" disabled={!valid}>Add</button>
        </div>
      </form>
    </Modal>
  );
};

/** Picks a catalogue exercise for a workout (`?workout=ID`) or a plan's day (`?plan=ID&day=N`). */
export const ExercisePicker = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { repos } = useContainer();
  const [chosen, setChosen] = useState<{ name: string; catalogId: string | null } | null>(null);
  const workoutId = params.get('workout');
  const planId = params.get('plan');
  const day = Number(params.get('day') ?? 0) as PlanDay;

  const add = async (plan: ExercisePlan) => {
    await repos.transaction.run(async () => {
      if (workoutId) {
        const workout = await repos.workouts.getWorkout(workoutId);
        if (workout) await repos.workouts.save(addExercise(workout, plan));
      } else if (planId) {
        const target = await repos.trainingPlans.getPlan(planId);
        if (target) await repos.trainingPlans.save(addPlannedExercise(target, day, plan));
      }
    });
    navigate(-1);
  };

  if (!workoutId && !planId) return <Empty>Choose where to add exercises from a workout or a plan.</Empty>;

  return (
    <>
      <PageHeader back title="Add exercise" />
      <ExerciseBrowser onPick={(e) => setChosen({ name: e.name, catalogId: e.id })} onCustom={(name) => setChosen({ name, catalogId: null })} />
      {chosen && <AddExerciseDialog name={chosen.name} catalogId={chosen.catalogId} onClose={() => setChosen(null)} onSubmit={(p) => void add(p)} />}
    </>
  );
};

export const ExerciseDetail = () => {
  const { id = '' } = useParams();
  const { repos } = useContainer();
  const result = useAsync(() => repos.exercises.get(id), [id]);

  return (
    <>
      <PageHeader back title={result.state === 'ready' && result.value ? result.value.name : 'Exercise'} />
      {result.state === 'loading' && <Loading />}
      {result.state === 'failed' && <Empty>Could not load the exercise catalogue.</Empty>}
      {result.state === 'ready' && !result.value && <Empty>This exercise is no longer in the catalogue.</Empty>}
      {result.state === 'ready' && result.value && (
        <>
          <div className="photos">
            {result.value.imageUrls.map((url, i) => (
              <img key={url} className="photo" src={url} loading="lazy" alt={`${result.value!.name}, photo ${i + 1}`} />
            ))}
          </div>
          <p className="row" style={{ flexWrap: 'wrap' }}>
            <span className="chip">{CATEGORY_LABEL[result.value.category]}</span>
            <span className="chip">{LEVEL_LABEL[result.value.level]}</span>
            {result.value.equipment && <span className="chip">{EQUIPMENT_LABEL[result.value.equipment]}</span>}
          </p>
          {result.value.primaryMuscles.length > 0 && (
            <p><span className="small muted">Main muscles</span><br />{result.value.primaryMuscles.map((m) => MUSCLE_LABEL[m]).join(', ')}</p>
          )}
          {result.value.secondaryMuscles.length > 0 && (
            <p><span className="small muted">Also works</span><br />{result.value.secondaryMuscles.map((m) => MUSCLE_LABEL[m]).join(', ')}</p>
          )}
          {result.value.instructions.length > 0 && (
            <>
              <h2>How to do it</h2>
              <ol style={{ paddingLeft: 20 }}>{result.value.instructions.map((step, i) => <li key={i} style={{ marginBottom: 8 }}>{step}</li>)}</ol>
            </>
          )}
          <p className="small muted">Exercises and photos: free-exercise-db (public domain).</p>
        </>
      )}
    </>
  );
};
