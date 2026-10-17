import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useContainer, useStream } from '../app/hooks';
import { deletePlannedExercise, deletePlannedSet, updatePlannedExercise, updatePlannedSet } from '../domain/edit';
import { daysOf } from '../domain/plan';
import { sessionOnDay, type PlannedExercise, type PlannedSet, type TrainingPlan } from '../domain/trainingPlan';
import { addPlannedSetLikeLast } from '../domain/useCases';
import { dayName, formatKg, parseNumber, shortDayName, setSummary } from './format';
import { ActionMenu, ConfirmDialog, Empty, Loading, Modal, PageHeader } from './kit';
import { PlanMenu, TRAINING_TEXTS, usePlanDay } from './Plans';
import { PublishButton } from './Community';
import { SendButton } from './Transfer';
import { ExerciseDialog } from './WorkoutCard';

const PlannedSetDialog = ({ number, set, onSave, onDelete, onClose }: {
  number: number; set: PlannedSet; onSave: (reps: number, weight: number | null) => void; onDelete: () => void; onClose: () => void;
}) => {
  const [reps, setReps] = useState(String(set.reps));
  const [weight, setWeight] = useState(set.weight === null ? '' : String(set.weight));
  const r = parseNumber(reps);
  const w = parseNumber(weight);
  const valid = r !== null && r >= 1 && Number.isInteger(r) && (weight.trim() === '' || (w !== null && w >= 0));
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    onSave(r, w);
    onClose();
  };
  return (
    <Modal title={`Set ${number}`} onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <div className="row">
          <label className="stack grow"><span className="small muted">Reps</span>
            <input className="field" inputMode="numeric" value={reps} onChange={(e) => setReps(e.target.value)} /></label>
          <label className="stack grow"><span className="small muted">kg</span>
            <input className="field" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} /></label>
        </div>
        <p className="small muted">Leave kg empty for bodyweight.</p>
        <div className="actions">
          <button type="button" className="btn danger" onClick={() => { onDelete(); onClose(); }}>Delete set</button>
          <button type="submit" className="btn" disabled={!valid}>Save</button>
        </div>
      </form>
    </Modal>
  );
};

type Dialog =
  | { kind: 'edit'; exercise: PlannedExercise } | { kind: 'delete'; exercise: PlannedExercise }
  | { kind: 'set'; set: PlannedSet; number: number };

const PlanBody = ({ plan }: { plan: TrainingPlan }) => {
  const { repos } = useContainer();
  const navigate = useNavigate();
  const days = daysOf(plan.recurrence);
  const [day, setDay] = usePlanDay(days);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const session = sessionOnDay(plan, day);
  const save = (p: TrainingPlan) => void repos.trainingPlans.save(p);

  return (
    <>
      {plan.recurrence === 'weekly' && (
        <div className="pills" role="tablist" aria-label="Day of the week">
          {days.map((d) => (
            <button key={d} role="tab" aria-selected={d === day} className={`pill ${d === day ? 'on' : ''}`} onClick={() => setDay(d)}>
              {shortDayName(d)}{sessionOnDay(plan, d).length > 0 ? ' •' : ''}
            </button>
          ))}
        </div>
      )}

      {session.length === 0 && (
        <Empty>
          {plan.recurrence === 'daily'
            ? <>No exercises yet.<br />Tap “Add exercise” to build this workout.</>
            : <>Rest day.<br />Tap “Add exercise” to train on {dayName(day)}.</>}
        </Empty>
      )}

      {session.map((exercise) => (
        <section key={exercise.id} className="card" aria-label={exercise.name}>
          <div className="row between">
            <div className="grow">
              {exercise.catalogId
                ? <Link className="title" to={`/exercises/${encodeURIComponent(exercise.catalogId)}`}>{exercise.name}</Link>
                : <span className="title">{exercise.name}</span>}
              <div className="small muted">{exercise.notes ? `${exercise.notes} · ` : ''}{setSummary(exercise.sets)}</div>
            </div>
            <ActionMenu label={`${exercise.name} options`} actions={[
              { label: 'Add set', onSelect: () => void addPlannedSetLikeLast(repos, plan.id, exercise.id) },
              { label: 'Edit', onSelect: () => setDialog({ kind: 'edit', exercise }) },
              { label: 'Delete', danger: true, onSelect: () => setDialog({ kind: 'delete', exercise }) },
            ]} />
          </div>
          {exercise.sets.map((set, index) => (
            <button key={set.id} className="list-item" onClick={() => setDialog({ kind: 'set', set, number: index + 1 })}>
              <span className="grow"><span className="title">Set {index + 1}</span>{' '}
                <span className="muted">{set.reps}{set.weight !== null ? ` × ${formatKg(set.weight)}` : ''}</span></span>
              <span className="muted">›</span>
            </button>
          ))}
        </section>
      ))}

      <button className="btn" onClick={() => navigate(`/exercises/pick?plan=${plan.id}&day=${day}`)}>Add exercise</button>

      {dialog?.kind === 'edit' && (
        <ExerciseDialog exercise={dialog.exercise} onClose={() => setDialog(null)}
          onSave={(name, notes) => save(updatePlannedExercise(plan, dialog.exercise.id, name, notes))} />
      )}
      {dialog?.kind === 'delete' && (
        <ConfirmDialog title="Delete exercise?" message={`“${dialog.exercise.name}” and its sets will be removed.`} onClose={() => setDialog(null)}
          onConfirm={() => save(deletePlannedExercise(plan, dialog.exercise.id))} />
      )}
      {dialog?.kind === 'set' && (
        <PlannedSetDialog number={dialog.number} set={dialog.set} onClose={() => setDialog(null)}
          onSave={(reps, weight) => save(updatePlannedSet(plan, dialog.set.id, { reps, weight }))}
          onDelete={() => save(deletePlannedSet(plan, dialog.set.id))} />
      )}
    </>
  );
};

export const TrainingPlanScreen = () => {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { repos } = useContainer();
  const plan = useStream((c) => c.repos.trainingPlans.observePlan(id), [id]);

  if (plan === undefined) return <Loading />;
  if (plan === null) {
    return <Empty>This workout no longer exists.<br /><button className="link" onClick={() => navigate('/workouts', { replace: true })}>Back to workouts</button></Empty>;
  }

  return (
    <>
      <PageHeader back title={plan.name} subtitle={`${plan.recurrence === 'daily' ? 'Daily' : 'Weekly'}${plan.isActive ? ' · Active' : ''}`}
        actions={<PlanMenu plan={plan} repo={repos.trainingPlans} texts={TRAINING_TEXTS} afterDelete={() => navigate('/workouts', { replace: true })} />} />
      <PlanBody key={plan.id} plan={plan} />
      <div className="stack" style={{ marginTop: 12 }}>
        <SendButton kind="training_plan" data={plan} label="Send this workout to another device" />
        <PublishButton kind="training" plan={plan} />
      </div>
    </>
  );
};
