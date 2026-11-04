import { useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useContainer } from '../app/hooks';
import {
  EQUIPMENT, MUSCLES, customExerciseId, customToInfo, noFilter,
  type CustomExercise, type Equipment, type ExerciseFilter, type ExerciseInfo, type Muscle,
} from '../domain/catalog';
import { addExercise, addPlannedExercise, newWorkout } from '../domain/edit';
import { newId } from '../domain/id';
import type { PlanDay } from '../domain/plan';
import { DEFAULT_REST, DEFAULT_REST_AFTER, type ExercisePlan } from '../domain/workout';
import {
  CATEGORY_LABEL, EQUIPMENT_LABEL, LEVEL_LABEL, MUSCLE_LABEL, parseNumber,
} from './format';
import { useAsync, useToast } from './hooks';
import { ConfirmDialog, Empty, Icons, Loading, Modal, PageHeader, useDebounced } from './kit';
import { ExerciseRecordsSection } from './Records';
import { RestPicker } from './WorkoutCard';

/** Makes up an exercise, or edits one. Only the name is needed; it is kept on this device. */
const CustomExerciseDialog = ({ initialName = '', exercise, onSaved, onClose }: {
  initialName?: string; exercise?: CustomExercise; onSaved: (exercise: CustomExercise) => void; onClose: () => void;
}) => {
  const { repos } = useContainer();
  const [name, setName] = useState(exercise?.name ?? initialName);
  const [muscle, setMuscle] = useState<Muscle | ''>(exercise?.muscle ?? '');
  const [equipment, setEquipment] = useState<Equipment | ''>(exercise?.equipment ?? '');
  const [notes, setNotes] = useState(exercise?.notes ?? '');
  const valid = name.trim() !== '';

  const save = async () => {
    if (!valid) return;
    const saved: CustomExercise = {
      id: exercise?.id ?? customExerciseId(newId()),
      name: name.trim(),
      muscle: muscle || null,
      equipment: equipment || null,
      notes: notes.trim(),
    };
    await repos.customExercises.save(saved);
    onSaved(saved);
    onClose();
  };

  return (
    <Modal title={exercise ? 'Edit your exercise' : 'New exercise'} onClose={onClose}>
      <form className="stack" onSubmit={(e) => { e.preventDefault(); void save(); }}>
        <p className="small muted">Saved on this device, so you can pick it again next time.</p>
        <label className="stack"><span className="small muted">Name</span>
          <input className="field" value={name} autoFocus onChange={(e) => setName(e.target.value)} /></label>
        <label className="stack"><span className="small muted">Main muscle (optional)</span>
          <select className="field" value={muscle} onChange={(e) => setMuscle(e.target.value as Muscle | '')}>
            <option value="">Not set</option>
            {MUSCLES.map((m) => <option key={m} value={m}>{MUSCLE_LABEL[m]}</option>)}
          </select></label>
        <label className="stack"><span className="small muted">Equipment (optional)</span>
          <select className="field" value={equipment} onChange={(e) => setEquipment(e.target.value as Equipment | '')}>
            <option value="">Not set</option>
            {EQUIPMENT.map((q) => <option key={q} value={q}>{EQUIPMENT_LABEL[q]}</option>)}
          </select></label>
        <label className="stack"><span className="small muted">Notes (optional)</span>
          <textarea className="field" rows={3} value={notes} maxLength={2000} onChange={(e) => setNotes(e.target.value)} /></label>
        <div className="actions">
          <button type="button" className="btn secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn" disabled={!valid}>Save</button>
        </div>
      </form>
    </Modal>
  );
};

/** Search box, filters and the matching exercises. [onPick] turns rows into buttons; otherwise they open the detail page. */
export const ExerciseBrowser = ({ onPick }: { onPick?: (exercise: ExerciseInfo) => void }) => {
  const { repos } = useContainer();
  const toast = useToast();
  const [creating, setCreating] = useState(false);
  const [version, setVersion] = useState(0); // bumped when an exercise is made, so the list shows it
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<ExerciseFilter>(noFilter);
  const debounced = useDebounced(query);
  const result = useAsync(() => repos.exercises.search(debounced, filter), [debounced, filter, version]);
  // While a new search loads, keep showing the last results instead of emptying the list: nothing
  // flickers, and a tap on a row can never land on one that is about to be replaced.
  const last = useRef<readonly ExerciseInfo[]>([]);
  if (result.state === 'ready') last.current = result.value;
  const rows = result.state === 'ready' ? result.value : last.current;

  const [showFilters, setShowFilters] = useState(false);
  const active = [
    ...(filter.muscle ? [{ name: MUSCLE_LABEL[filter.muscle], clear: () => setFilter({ ...filter, muscle: null }) }] : []),
    ...(filter.equipment ? [{ name: EQUIPMENT_LABEL[filter.equipment], clear: () => setFilter({ ...filter, equipment: null }) }] : []),
  ];

  const pills = <T extends string>(label: string, options: readonly T[], names: Record<T, string>, value: T | null, set: (v: T | null) => void) => (
    <div className="filter-group">
      <div className="filter-title">{label}</div>
      <div className="pills wrap" role="group" aria-label={label}>
        {options.map((o) => (
          <button key={o} className={`pill ${value === o ? 'on' : ''}`} aria-pressed={value === o} onClick={() => set(value === o ? null : o)}>
            {names[o]}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <>
      <div className="search-row">
        <label className="search-field">
          {Icons.search}
          <input type="search" value={query} placeholder="Search exercises" aria-label="Search exercises" enterKeyHint="done"
            onChange={(e) => setQuery(e.target.value)} />
          {query && <button type="button" className="search-clear" aria-label="Clear search" onClick={() => setQuery('')}>{Icons.close}</button>}
        </label>
        <button className={`icon-btn filter-btn ${showFilters ? 'on' : ''}`} aria-label="Filters" aria-expanded={showFilters}
          onClick={() => setShowFilters(!showFilters)}>
          {Icons.filter}{active.length > 0 && <span className="count" aria-hidden="true">{active.length}</span>}
        </button>
      </div>
      {showFilters && (
        <div className="filter-panel" role="region" aria-label="Filter exercises">
          {pills<Muscle>('Muscle', MUSCLES, MUSCLE_LABEL, filter.muscle, (muscle) => setFilter({ ...filter, muscle }))}
          {pills<Equipment>('Equipment', EQUIPMENT, EQUIPMENT_LABEL, filter.equipment, (equipment) => setFilter({ ...filter, equipment }))}
        </div>
      )}
      {active.length > 0 && (
        <div className="active-filters" aria-label="Active filters" role="group">
          {active.map((f) => (
            <button key={f.name} className="filter-chip" aria-label={`Remove filter ${f.name}`} onClick={f.clear}>{f.name}{Icons.close}</button>
          ))}
          <button className="link" onClick={() => setFilter(noFilter)}>Clear filters</button>
        </div>
      )}
      <button className="add-row" onClick={() => setCreating(true)}>{Icons.plus}Add your own exercise</button>
      {creating && (
        <CustomExerciseDialog
          initialName={query.trim()}
          onClose={() => setCreating(false)}
          onSaved={(saved) => {
            setVersion((v) => v + 1);
            if (onPick) onPick(customToInfo(saved)); // carry on to adding it
            else toast(`Saved “${saved.name}” to your exercises`);
          }}
        />
      )}
      {result.state === 'loading' && rows.length === 0 && <Loading />}
      {result.state === 'failed' && <Empty>Could not load the exercise catalogue. Check your connection and reload.</Empty>}
      {result.state === 'ready' && result.value.length === 0 && <Empty>No exercises match. Try fewer words or clear a filter.</Empty>}
      <div className="exercise-cards">
        {rows.slice(0, 100).map((e) => {
          const body = (
            <>
              <span className="grow">
                <span className="exercise-card-name">{e.name}</span>
                <span className="exercise-card-muscles">{e.primaryMuscles.map((m) => MUSCLE_LABEL[m]).join(', ') || CATEGORY_LABEL[e.category]}</span>
                <span className="exercise-card-tags">
                  {e.custom && <span className="tag yours">Yours</span>}
                  {e.equipment && <span className="tag">{EQUIPMENT_LABEL[e.equipment]}</span>}
                  {!e.custom && <span className="tag">{LEVEL_LABEL[e.level]}</span>}
                </span>
              </span>
              <span className={`exercise-card-go ${onPick ? 'add' : ''}`} aria-hidden="true">{onPick ? Icons.plus : '›'}</span>
            </>
          );
          return onPick
            ? <button key={e.id} className="exercise-card" onClick={() => onPick(e)}>{body}</button>
            : <Link key={e.id} className="exercise-card" to={`/exercises/${encodeURIComponent(e.id)}`}>{body}</Link>;
        })}
      </div>
      {rows.length > 100 && <p className="small muted">Showing 100 of {rows.length}. Refine your search to see others.</p>}
    </>
  );
};

/** Sets, reps and weight for a new exercise. */
const AddExerciseDialog = ({ name, catalogId, onSubmit, onClose }: {
  name: string; catalogId: string | null; onSubmit: (plan: ExercisePlan) => void; onClose: () => void;
}) => {
  const [title, setTitle] = useState(name);
  const [sets, setSets] = useState('3');
  const [reps, setReps] = useState('10');
  const [seconds, setSeconds] = useState('');
  const [weight, setWeight] = useState('');
  const [notes, setNotes] = useState('');
  const [rest, setRest] = useState(DEFAULT_REST);
  const [restAfter, setRestAfter] = useState(DEFAULT_REST_AFTER);
  const n = parseNumber(sets);
  const r = parseNumber(reps);
  const sec = parseNumber(seconds);
  const w = parseNumber(weight);
  const valid = title.trim() !== '' && n !== null && n >= 1 && n <= 50 && Number.isInteger(n) && r !== null && r >= 1 && Number.isInteger(r)
    && (seconds.trim() === '' || (sec !== null && sec >= 1 && Number.isInteger(sec)))
    && (weight.trim() === '' || (w !== null && w >= 0));

  const input = (label: string, value: string, set: (v: string) => void, mode: 'text' | 'decimal' = 'decimal') => (
    <label className="stack grow"><span className="small muted">{label}</span>
      <input className="field" inputMode={mode} value={value} onChange={(e) => set(e.target.value)} /></label>
  );
  return (
    <Modal title="Add exercise" onClose={onClose}>
      <form className="stack" onSubmit={(e) => {
        e.preventDefault();
        if (!valid) return;
        onSubmit({ name: title.trim(), notes: notes.trim(), catalogId, restSeconds: rest, restAfterSeconds: restAfter, sets: Array.from({ length: n }, () => ({ reps: r, weight: w, seconds: sec })) });
        onClose();
      }}>
        {input('Exercise', title, setTitle, 'text')}
        <div className="row">{input('Sets', sets, setSets)}{input('Reps', reps, setReps)}{input('Seconds', seconds, setSeconds)}{input('kg', weight, setWeight)}</div>
        <p className="small muted">For a bodyweight move, kg is the extra load (a vest, a belt); leave it empty for none. Seconds are for timed sets: a 45 s hold is 1 rep of 45 seconds. You can tweak single sets later.</p>
        {input('Notes (optional)', notes, setNotes, 'text')}
        <RestPicker label="Rest between sets" value={rest} onChange={setRest} />
        <RestPicker label="Rest after the exercise" value={restAfter} onChange={setRestAfter} />
        <div className="actions">
          <button type="button" className="btn secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn" disabled={!valid}>Add</button>
        </div>
      </form>
    </Modal>
  );
};

/**
 * Picks a catalogue exercise for a workout (`?workout=ID`), a plan's day (`?plan=ID&day=N`), or an
 * empty day (`?date=YYYY-MM-DD`), which gets a new workout only once something is added.
 */
export const ExercisePicker = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { repos } = useContainer();
  const [chosen, setChosen] = useState<{ name: string; catalogId: string | null } | null>(null);
  const workoutId = params.get('workout');
  const planId = params.get('plan');
  const day = Number(params.get('day') ?? 0) as PlanDay;
  const date = params.get('date');

  const add = async (plan: ExercisePlan) => {
    await repos.transaction.run(async () => {
      if (workoutId) {
        const workout = await repos.workouts.getWorkout(workoutId);
        if (workout) await repos.workouts.save(addExercise(workout, plan));
      } else if (planId) {
        const target = await repos.trainingPlans.getPlan(planId);
        if (target) await repos.trainingPlans.save(addPlannedExercise(target, day, plan));
      } else if (date) {
        await repos.workouts.save(newWorkout(date, 'Workout', [plan]));
      }
    });
    navigate(-1);
  };

  if (!workoutId && !planId && !date) return <Empty>Choose where to add exercises from a workout or a plan.</Empty>;

  return (
    <>
      <PageHeader back title="Add exercise" />
      <ExerciseBrowser onPick={(e) => setChosen({ name: e.name, catalogId: e.id })} />
      {chosen && <AddExerciseDialog name={chosen.name} catalogId={chosen.catalogId} onClose={() => setChosen(null)} onSubmit={(p) => void add(p)} />}
    </>
  );
};

export const ExerciseDetail = () => {
  const { id = '' } = useParams();
  const { repos } = useContainer();
  const navigate = useNavigate();
  const toast = useToast();
  const [version, setVersion] = useState(0);
  const [dialog, setDialog] = useState<'edit' | 'delete' | null>(null);
  const result = useAsync(async () => {
    const info = await repos.exercises.get(id);
    const own = info?.custom ? (await repos.customExercises.getAll()).find((e) => e.id === id) : undefined;
    return info ? { info, own } : null;
  }, [id, version]);

  const found = result.state === 'ready' ? result.value : null;
  const exercise = found?.info;

  return (
    <>
      <PageHeader back title={exercise ? exercise.name : 'Exercise'} />
      {result.state === 'loading' && <Loading />}
      {result.state === 'failed' && <Empty>Could not load the exercise catalogue.</Empty>}
      {result.state === 'ready' && !exercise && <Empty>This exercise is no longer in the catalogue.</Empty>}
      {exercise && (
        <>
          {exercise.imageUrls.length > 0 && (
            <div className="photos">
              {exercise.imageUrls.map((url, i) => (
                <img key={url} className="photo" src={url} loading="lazy" alt={`${exercise.name}, photo ${i + 1}`} />
              ))}
            </div>
          )}
          <p className="row" style={{ flexWrap: 'wrap' }}>
            {exercise.custom ? (
              <span className="chip">Your exercise</span>
            ) : (
              <>
                <span className="chip">{CATEGORY_LABEL[exercise.category]}</span>
                <span className="chip">{LEVEL_LABEL[exercise.level]}</span>
              </>
            )}
            {exercise.equipment && <span className="chip">{EQUIPMENT_LABEL[exercise.equipment]}</span>}
          </p>
          {exercise.primaryMuscles.length > 0 && (
            <p><span className="small muted">Main muscles</span><br />{exercise.primaryMuscles.map((m) => MUSCLE_LABEL[m]).join(', ')}</p>
          )}
          {exercise.secondaryMuscles.length > 0 && (
            <p><span className="small muted">Also works</span><br />{exercise.secondaryMuscles.map((m) => MUSCLE_LABEL[m]).join(', ')}</p>
          )}
          {exercise.instructions.length > 0 && (
            exercise.custom ? (
              <>
                <h2>Notes</h2>
                <p style={{ whiteSpace: 'pre-wrap' }}>{exercise.instructions[0]}</p>
              </>
            ) : (
              <>
                <h2>How to do it</h2>
                <ol style={{ paddingLeft: 20 }}>{exercise.instructions.map((step, i) => <li key={i} style={{ marginBottom: 8 }}>{step}</li>)}</ol>
              </>
            )
          )}
          {found?.own && (
            <div className="row" style={{ margin: '12px 0' }}>
              <button className="btn secondary" onClick={() => setDialog('edit')}>Edit</button>
              <button className="btn danger" onClick={() => setDialog('delete')}>Delete</button>
            </div>
          )}
          <ExerciseRecordsSection name={exercise.name} catalogId={exercise.id} />
          {exercise.custom
            ? <p className="small muted">Saved on this device only.</p>
            : <p className="small muted">Exercises and photos: free-exercise-db (public domain).</p>}
        </>
      )}
      {dialog === 'edit' && found?.own && (
        <CustomExerciseDialog exercise={found.own} onClose={() => setDialog(null)} onSaved={() => { setVersion((v) => v + 1); toast('Exercise updated'); }} />
      )}
      {dialog === 'delete' && found?.own && (
        <ConfirmDialog
          title="Delete exercise?"
          message={`“${found.own.name}” will be removed from your exercises. Plans and workouts that used it keep its name, and its records stay.`}
          onClose={() => setDialog(null)}
          onConfirm={() => void repos.customExercises.delete(found.own!.id).then(() => navigate('/workouts?tab=library', { replace: true }))}
        />
      )}
    </>
  );
};
