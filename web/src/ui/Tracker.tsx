import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useContainer, useStream } from '../app/hooks';
import { withGrams, withoutEntry, type FoodLogEntry } from '../domain/foodLog';
import { portionNutrients } from '../domain/nutrition';
import { addDays } from '../domain/plan';
import { logPlannedMeal, observeCalorieDay, observeDailyTargets } from '../domain/useCases';
import { DEFAULT_MEALS, formatGrams, formatKcal, parseNumber, relativeDay, today } from './format';
import { useToast } from './hooks';
import { EnergyCard, Loading, Modal, PageHeader } from './kit';
import { SendButton } from './Transfer';
import { TargetsDialog } from './TargetsDialog';

const EditIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
    <path d="M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const EntryDialog = ({ entry, onSave, onDelete, onClose }: {
  entry: FoodLogEntry; onSave: (grams: number) => void; onDelete: () => void; onClose: () => void;
}) => {
  const [text, setText] = useState(String(entry.portion.grams));
  const grams = parseNumber(text);
  const valid = grams !== null && grams > 0 && grams <= 100_000;
  return (
    <Modal title={entry.portion.food.name} onClose={onClose}>
      <form className="stack" onSubmit={(e) => { e.preventDefault(); if (valid) { onSave(grams); onClose(); } }}>
        <label className="stack"><span className="small muted">Grams</span>
          <input className="field" inputMode="decimal" value={text} autoFocus onChange={(e) => setText(e.target.value)} /></label>
        <div className="actions">
          <button type="button" className="btn danger" onClick={() => { onDelete(); onClose(); }}>Remove</button>
          <button type="submit" className="btn" disabled={!valid}>Save</button>
        </div>
      </form>
    </Modal>
  );
};

export const Tracker = () => {
  const [params, setParams] = useSearchParams();
  const now = today();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(params.get('date') ?? '') ? params.get('date')! : now;
  const { repos } = useContainer();
  const toast = useToast();
  const [editing, setEditing] = useState<FoodLogEntry | null>(null);
  const [editingTargets, setEditingTargets] = useState(false);
  const day = useStream((c) => observeCalorieDay(c.repos, date, DEFAULT_MEALS), [date]);
  const logDay = useStream((c) => c.repos.foodLog.observeDay(date), [date]);
  const targets = useStream((c) => observeDailyTargets(c.repos.profile, date), [date]);
  const go = (d: string) => setParams(d === now ? {} : { date: d }, { replace: true });

  if (!day || !logDay || targets === undefined) return <Loading />;

  const goal = targets?.nutrients.kcal ?? day.planned?.kcal;
  const goalLabel = targets ? 'goal' : 'planned';
  const firstFree = day.meals.find((m) => m.entries.length === 0) ?? day.meals[0];
  const pickLink = (meal: string, extra = '') => `/food/pick?date=${date}&meal=${encodeURIComponent(meal)}${extra}`;

  return (
    <>
      <PageHeader title="Tracker" subtitle={relativeDay(date, now)} actions={
        <>
          <button className="icon-btn" aria-label="Previous day" onClick={() => go(addDays(date, -1))}>‹</button>
          <button className="icon-btn" aria-label="Next day" onClick={() => go(addDays(date, 1))}>›</button>
        </>
      } />

      <EnergyCard label="Daily energy balance" eaten={day.eaten} goal={goal} goalLabel={goalLabel} macroGoals={targets?.nutrients}
        action={<button className="icon-btn" aria-label="Edit daily targets" onClick={() => setEditingTargets(true)}><EditIcon /></button>}>
        <span><Link to="/profile">Set up your profile</Link> to get a daily goal, <button className="link" onClick={() => setEditingTargets(true)}>set your own targets</button>, or plan your diet with foods from the database.</span>
      </EnergyCard>

      {firstFree && (
        <div className="row">
          <Link className="btn grow" style={{ textAlign: 'center', textDecoration: 'none' }} to={pickLink(firstFree.name, '&scan=1')}>Scan</Link>
          <Link className="btn secondary grow" style={{ textAlign: 'center', textDecoration: 'none' }} to={pickLink(firstFree.name)}>Search food</Link>
        </div>
      )}

      <div className="section-head">
        <h2>Logged meals</h2>
        <span className="small muted">{day.meals.filter((m) => m.entries.length > 0).length} of {day.meals.length} logged</span>
      </div>
      {day.meals.map((meal) => (
        <section key={meal.name} className="card" aria-label={meal.name}>
          <div className="row between">
            <div className="grow">
              <div className="title">{meal.name}</div>
              <div className="small muted">
                {meal.entries.length > 0 ? formatKcal(meal.eaten.kcal) : 'Pending'}
                {meal.planned && ' · planned'}
              </div>
            </div>
            {meal.canLogAsPlanned && meal.planned && (
              <button className="btn secondary" onClick={() => void logPlannedMeal(repos, date, meal.planned!).then((n) => toast(`Logged ${n} ${n === 1 ? 'food' : 'foods'} as ${meal.name}`))}>
                Log as planned
              </button>
            )}
          </div>
          {meal.entries.map((entry) => (
            <button key={entry.id} className="list-item" onClick={() => setEditing(entry)}>
              <span className="grow">
                <span className="title">{entry.portion.food.name}</span>
                <br />
                <span className="small muted">{formatGrams(entry.portion.grams)} · {formatKcal(portionNutrients(entry.portion).kcal)}</span>
              </span>
              <span className="muted">›</span>
            </button>
          ))}
          <Link className="btn secondary" style={{ display: 'inline-block', marginTop: 8, textDecoration: 'none' }} to={pickLink(meal.name)}>Add food</Link>
        </section>
      ))}

      {logDay.entries.length > 0 && <SendButton kind="food_log_day" data={logDay} label="Send this day's food log to another device" />}

      {editingTargets && <TargetsDialog onClose={() => setEditingTargets(false)} />}
      {editing && (
        <EntryDialog entry={editing} onClose={() => setEditing(null)}
          onSave={(grams) => void repos.foodLog.saveDay(withGrams(logDay, editing.id, grams))}
          onDelete={() => void repos.foodLog.saveDay(withoutEntry(logDay, editing.id))} />
      )}
    </>
  );
};
