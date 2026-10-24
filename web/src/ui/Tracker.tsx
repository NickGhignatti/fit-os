import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useContainer, useStream } from '../app/hooks';
import { withGrams, withoutEntry, type FoodLogEntry } from '../domain/foodLog';
import { mealNutrients } from '../domain/diet';
import { portionNutrients, type Nutrients } from '../domain/nutrition';
import { addDays } from '../domain/plan';
import { logPlannedMeal, observeCalorieDay, observeDailyTargets } from '../domain/useCases';
import { DEFAULT_MEALS, formatGrams, formatKcal, formatKg, parseNumber, relativeDay, today } from './format';
import { useToast } from './hooks';
import { Carousel, EnergyCard, Fab, Icons, Loading, Modal, PageHeader, PromptDialog } from './kit';
import { SendButton } from './Transfer';
import { TargetsDialog } from './TargetsDialog';

const EditIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
    <path d="M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const MACRO_DOTS = [
  { key: 'protein', label: 'P', color: 'var(--protein)' },
  { key: 'carbs', label: 'C', color: 'var(--carbs)' },
  { key: 'fat', label: 'F', color: 'var(--fat)' },
] as const;

export const MacroLine = ({ n }: { n: Nutrients }) => (
  <div className="meal-macros small muted">
    {MACRO_DOTS.map((m) => <span key={m.key}><i style={{ background: m.color }} />{m.label} {Math.round(n[m.key])} g</span>)}
  </div>
);

/** Logs a weigh-in for [date]. Shared by the + of Today and of the Tracker. */
export const WeightDialog = ({ date, onClose }: { date: string; onClose: () => void }) => {
  const { repos } = useContainer();
  const toast = useToast();
  return (
    <PromptDialog title="Weight" label="Weight (kg)" inputMode="decimal" confirmLabel="Save" onClose={onClose}
      validate={(v) => { const n = parseNumber(v); return n !== null && n >= 20 && n <= 500; }}
      onSubmit={(v) => void repos.profile.setWeight(date, parseNumber(v)!).then(() => toast(`Logged ${formatKg(parseNumber(v)!)}`))} />
  );
};

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
  const [slide, setSlide] = useState<number | null>(null);
  const [weighing, setWeighing] = useState(false);
  const navigate = useNavigate();
  const day = useStream((c) => observeCalorieDay(c.repos, date, DEFAULT_MEALS), [date]);
  const logDay = useStream((c) => c.repos.foodLog.observeDay(date), [date]);
  const targets = useStream((c) => observeDailyTargets(c.repos.profile, date), [date]);
  const go = (d: string) => { setSlide(null); setParams(d === now ? {} : { date: d }, { replace: true }); };

  if (!day || !logDay || targets === undefined) return <Loading />;

  const goal = targets?.nutrients.kcal ?? day.planned?.kcal;
  const goalLabel = targets ? 'goal' : 'planned';
  // The carousel opens on the first meal with nothing logged yet; the + adds to the meal in view.
  const next = day.meals.findIndex((m) => m.entries.length === 0);
  const active = Math.min(slide ?? Math.max(next, 0), day.meals.length - 1);
  const meal = day.meals[active];
  const pickLink = (name: string, extra = '') => `/food/pick?date=${date}&meal=${encodeURIComponent(name)}${extra}`;

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

      <div className="section-head">
        <h2>Meals</h2>
        <span className="small muted">{day.meals.filter((m) => m.entries.length > 0).length} of {day.meals.length} logged</span>
      </div>
      <Carousel key={date} label="Meals" titles={day.meals.map((m) => m.name)} index={active} onIndex={setSlide}>
        {day.meals.map((m, i) => {
          const logged = m.entries.length > 0;
          const planned = m.planned ? mealNutrients(m.planned) : null;
          const status = logged ? 'Logged' : i === next ? 'Up next' : 'Pending';
          return (
            <section key={m.name} className="card meal-card" aria-label={m.name}>
              <div className="meal-head">
                <div className="grow">
                  <div className={`eyebrow ${i === next ? 'next' : ''}`}>{[status, m.planned?.time].filter(Boolean).join(' · ')}</div>
                  <div className="meal-name">{m.name}</div>
                </div>
                <div className="meal-kcal">
                  <b>{Math.round(logged ? m.eaten.kcal : planned?.kcal ?? 0)}</b>
                  <span className="small muted">{logged || !planned ? 'kcal' : 'kcal planned'}</span>
                </div>
              </div>
              {logged && <MacroLine n={m.eaten} />}
              {m.entries.map((entry) => (
                <button key={entry.id} className="list-item" onClick={() => setEditing(entry)}>
                  <span className="grow">
                    <span className="title">{entry.portion.food.name}</span>
                    <br />
                    <span className="small muted">{formatGrams(entry.portion.grams)} · {formatKcal(portionNutrients(entry.portion).kcal)}</span>
                  </span>
                  <span className="muted">›</span>
                </button>
              ))}
              {!logged && m.planned && m.planned.foods.length > 0 && (
                <ul className="meal-planned small" aria-label={`${m.name} plan`}>
                  {m.planned.foods.map((f) => <li key={f.id}><span>{f.name}</span><span>{f.portion ? formatGrams(f.portion.grams) : f.quantity}</span></li>)}
                </ul>
              )}
              {!logged && !m.planned && <p className="meal-empty small muted">Nothing logged yet.</p>}
              {m.canLogAsPlanned && m.planned && (
                <button className="btn secondary" onClick={() => { setSlide(i); void logPlannedMeal(repos, date, m.planned!).then((n) => toast(`Logged ${n} ${n === 1 ? 'food' : 'foods'} as ${m.name}`)); }}>
                  Log as planned
                </button>
              )}
              <div className="spacer" />
              <Link className="add-row" to={pickLink(m.name)}>{Icons.plus}Add food</Link>
            </section>
          );
        })}
      </Carousel>

      {logDay.entries.length > 0 && <SendButton kind="food_log_day" data={logDay} label="Send this day's food log to another device" />}

      {meal && (
        <Fab label="Log food or weight" actions={[
          { label: `Search food for ${meal.name}`, short: 'Search', icon: Icons.search, onSelect: () => navigate(pickLink(meal.name)) },
          { label: `Scan a barcode for ${meal.name}`, short: 'Scan', icon: Icons.scan, onSelect: () => navigate(pickLink(meal.name, '&scan=1')) },
          { label: 'Log weight', short: 'Weight', icon: Icons.weight, onSelect: () => setWeighing(true) },
        ]} />
      )}
      {weighing && <WeightDialog date={date} onClose={() => setWeighing(false)} />}
      {editingTargets && <TargetsDialog onClose={() => setEditingTargets(false)} />}
      {editing && (
        <EntryDialog entry={editing} onClose={() => setEditing(null)}
          onSave={(grams) => void repos.foodLog.saveDay(withGrams(logDay, editing.id, grams))}
          onDelete={() => void repos.foodLog.saveDay(withoutEntry(logDay, editing.id))} />
      )}
    </>
  );
};
