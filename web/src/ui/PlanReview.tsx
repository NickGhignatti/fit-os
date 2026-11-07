import { useState } from 'react';
import { deletePlannedExercise, renamePlan, setPlannedLoad, setPlannedRests, updatePlannedExercise } from '../domain/edit';
import { daysOf } from '../domain/plan';
import { sessionOnDay, type PlannedExercise, type TrainingPlan } from '../domain/trainingPlan';
import { restAfterOf, restOf } from '../domain/workout';
import { dayName, formatRest, parseNumber, setSummary } from './format';
import { Modal, RestPicker, restChoices } from './kit';

/** The one value [pick] reads from every exercise, or null when they differ. */
const common = (exercises: readonly PlannedExercise[], pick: (e: PlannedExercise) => number): number | null => {
  const [first, ...others] = exercises.map(pick);
  return first !== undefined && others.every((v) => v === first) ? first : null;
};

/** The load of every set of the exercise as text: empty for bodyweight, null when the sets differ. */
const loadText = (e: PlannedExercise): string | null => {
  const [first] = e.sets;
  if (!first || !e.sets.every((s) => s.weight === first.weight)) return null;
  return first.weight === null ? '' : String(first.weight);
};

const LoadField = ({ exercise, onChange }: { exercise: PlannedExercise; onChange: (weight: number | null) => void }) => {
  const initial = loadText(exercise);
  const [text, setText] = useState(initial ?? '');
  const invalid = text.trim() !== '' && (parseNumber(text) ?? -1) < 0;
  return (
    <label className="stack grow"><span className="small muted">kg, every set</span>
      <input className="field" inputMode="decimal" value={text} placeholder={initial === null ? 'mixed' : 'bodyweight'} aria-invalid={invalid}
        aria-label={`${exercise.name} load in kg`}
        onChange={(e) => {
          setText(e.target.value);
          const w = parseNumber(e.target.value);
          if (e.target.value.trim() === '') onChange(null);
          else if (w !== null && w >= 0) onChange(w);
        }} /></label>
  );
};

const RestSelect = ({ label, value, onChange }: { label: string; value: number; onChange: (seconds: number) => void }) => (
  <label className="stack grow"><span className="small muted">{label}</span>
    <select className="field" value={value} onChange={(e) => onChange(Number(e.target.value))}>
      {restChoices(value).map((s) => <option key={s} value={s}>{formatRest(s)}</option>)}
    </select></label>
);

const ExerciseReview = ({ exercise, onChange }: { exercise: PlannedExercise; onChange: (edit: (plan: TrainingPlan) => TrainingPlan) => void }) => {
  const details = (rests: { restSeconds?: number; restAfterSeconds?: number }) =>
    onChange((plan) => updatePlannedExercise(plan, exercise.id, {
      name: exercise.name, notes: exercise.notes, restSeconds: exercise.restSeconds, restAfterSeconds: exercise.restAfterSeconds, ...rests,
    }));
  return (
    <section className="review-exercise stack" aria-label={exercise.name}>
      <div className="row between">
        <div className="grow">
          <div className="title">{exercise.name}</div>
          <div className="small muted">{setSummary(exercise.sets)}</div>
        </div>
        <button type="button" className="link danger-text" aria-label={`Remove ${exercise.name}`}
          onClick={() => onChange((plan) => deletePlannedExercise(plan, exercise.id))}>Remove</button>
      </div>
      <div className="row">
        <LoadField exercise={exercise} onChange={(w) => onChange((plan) => setPlannedLoad(plan, exercise.id, w))} />
        <RestSelect label="Rest between sets" value={restOf(exercise)} onChange={(s) => details({ restSeconds: s })} />
        <RestSelect label="Rest after" value={restAfterOf(exercise)} onChange={(s) => details({ restAfterSeconds: s })} />
      </div>
    </section>
  );
};

/**
 * A plan read from a file or an AI's answer, laid out day by day before it is kept: loads and
 * rests can be changed here, for one exercise or for all of them, then [onConfirm] stores the
 * plan as edited. Nothing is stored until then; [onClose] drops it.
 */
export const PlanReview = ({ initial, ignored = [], onConfirm, onClose }: {
  initial: TrainingPlan; ignored?: readonly string[]; onConfirm: (plan: TrainingPlan) => void; onClose: () => void;
}) => {
  const [plan, setPlan] = useState(initial);
  const days = daysOf(plan.recurrence).filter((d) => sessionOnDay(plan, d).length > 0);
  const all = days.flatMap((d) => sessionOnDay(plan, d));

  return (
    <Modal title="Review the plan" onClose={onClose}>
      <div className="stack">
        <label className="stack"><span className="small muted">Name</span>
          <input className="field" value={plan.name} maxLength={80} onChange={(e) => setPlan(renamePlan(plan, e.target.value))} /></label>
        <p className="small muted" style={{ margin: 0 }}>
          {days.length} {days.length === 1 ? 'day' : 'days'}, {all.length} exercises. Change loads and rests here, then import.
        </p>
        {ignored.length > 0 && (
          <div role="status" className="stack small">
            <span>These fields were not understood, so they were left out:</span>
            <ul style={{ margin: 0, paddingLeft: 18 }}>{ignored.map((line, i) => <li key={i}>{line}</li>)}</ul>
          </div>
        )}

        {all.length > 0 && (
          <section className="stack" aria-label="All exercises">
            <div className="title">All exercises</div>
            <RestPicker label="Rest between sets, everywhere" value={common(all, restOf)}
              onChange={(s) => setPlan(setPlannedRests(plan, { restSeconds: s }))} />
            <RestPicker label="Rest after each exercise, everywhere" value={common(all, restAfterOf)}
              onChange={(s) => setPlan(setPlannedRests(plan, { restAfterSeconds: s }))} />
          </section>
        )}

        {days.map((day) => (
          <section key={day} className="stack" aria-label={dayName(day)}>
            <div className="eyebrow">{dayName(day)}</div>
            {sessionOnDay(plan, day).map((exercise) => (
              <ExerciseReview key={exercise.id} exercise={exercise} onChange={(edit) => setPlan(edit(plan))} />
            ))}
          </section>
        ))}

        <div className="actions">
          <button type="button" className="btn secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="btn" disabled={!plan.name.trim() || all.length === 0}
            onClick={() => onConfirm({ ...plan, name: plan.name.trim() })}>
            Import plan
          </button>
        </div>
      </div>
    </Modal>
  );
};
