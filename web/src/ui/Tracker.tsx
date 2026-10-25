import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useContainer, useStream } from '../app/hooks';
import { withGrams, withoutEntry, type FoodLogEntry } from '../domain/foodLog';
import { mealNutrients } from '../domain/diet';
import { portionNutrients, type Nutrients } from '../domain/nutrition';
import { addDays } from '../domain/plan';
import { logPlannedMeal, observeCalorieDay, observeDailyTargets } from '../domain/useCases';
import { clockNow, mealAt } from '../domain/mealTime';
import { MAX_MEALS, type Profile } from '../domain/profile';
import { DEFAULT_MEALS, formatGrams, formatKcal, parseNumber, relativeDay, today } from './format';
import { useToast } from './hooks';
import { Carousel, EnergyCard, Fab, Icons, Loading, Modal, PageHeader } from './kit';
import { WeightDialog } from './Weight';
import { ShareButton } from './Transfer';
import { TargetsDialog } from './TargetsDialog';

const EditIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
    <path d="M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** The meals of a day the user chose, or the usual four. Diet plans with meals that day win over it. */
export const mealNamesOf = (profile: Profile): readonly string[] => profile.mealNames ?? DEFAULT_MEALS;

const SUGGESTED: Record<number, readonly string[]> = {
  1: ['Meal'],
  2: ['Lunch', 'Dinner'],
  3: ['Breakfast', 'Lunch', 'Dinner'],
  4: DEFAULT_MEALS,
  5: ['Breakfast', 'Morning snack', 'Lunch', 'Afternoon snack', 'Dinner'],
  6: ['Breakfast', 'Morning snack', 'Lunch', 'Afternoon snack', 'Dinner', 'Evening snack'],
};
const suggested = (n: number): readonly string[] => SUGGESTED[n] ?? [...SUGGESTED[6]!, ...Array.from({ length: n - 6 }, (_, i) => `Meal ${i + 7}`)];

/**
 * How many meals a day, and their names. Untouched suggestions follow the count; once a name is
 * edited, changing the count only adds or drops meals at the end.
 */
const MealsDialog = ({ names, planSetsMeals, onSave, onClose }: {
  names: readonly string[]; planSetsMeals: boolean; onSave: (names: readonly string[]) => void; onClose: () => void;
}) => {
  const [list, setList] = useState<readonly string[]>(names);
  const resize = (n: number) => setList((l) => {
    if (l.join('\n') === suggested(l.length).join('\n')) return suggested(n);
    return n < l.length ? l.slice(0, n) : [...l, ...suggested(n).slice(l.length)];
  });
  const clean = list.map((name) => name.trim());
  const valid = clean.every(Boolean) && new Set(clean.map((name) => name.toLowerCase())).size === clean.length;
  return (
    <Modal title="Meals per day" onClose={onClose}>
      <form className="stack" onSubmit={(e) => { e.preventDefault(); if (valid) { onSave(clean); onClose(); } }}>
        <div className="stepper" role="group" aria-label="Number of meals">
          <button type="button" className="icon-btn round" aria-label="One meal fewer" disabled={list.length <= 1} onClick={() => resize(list.length - 1)}>−</button>
          <span className="stepper-value" aria-live="polite">{list.length}</span>
          <button type="button" className="icon-btn round" aria-label="One more meal" disabled={list.length >= MAX_MEALS} onClick={() => resize(list.length + 1)}>+</button>
        </div>
        {list.map((name, i) => (
          <input key={i} className="field" aria-label={`Meal ${i + 1}`} value={name} maxLength={40}
            onChange={(e) => setList((l) => l.map((n, j) => (j === i ? e.target.value : n)))} />
        ))}
        {!valid && <p className="small danger-text">Give every meal its own name.</p>}
        {planSetsMeals && <p className="small muted">Your active diet sets the meals today. These are used on days it plans none.</p>}
        <div className="actions">
          <button type="button" className="btn secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn" disabled={!valid}>Save</button>
        </div>
      </form>
    </Modal>
  );
};

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
  const profile = useStream((c) => c.repos.profile.observeProfile());
  const names = profile ? mealNamesOf(profile) : DEFAULT_MEALS;
  const day = useStream((c) => observeCalorieDay(c.repos, date, names), [date, names.join('\n')]);
  const [editingMeals, setEditingMeals] = useState(false);
  const logDay = useStream((c) => c.repos.foodLog.observeDay(date), [date]);
  const targets = useStream((c) => observeDailyTargets(c.repos.profile, date), [date]);
  const go = (d: string) => { setSlide(null); setParams(d === now ? {} : { date: d }, { replace: true }); };

  if (!day || !logDay || !profile || targets === undefined) return <Loading />;

  const goal = targets?.nutrients.kcal ?? day.planned?.kcal;
  const goalLabel = targets ? 'goal' : 'planned';
  // The carousel opens on the meal for the time of day; the + adds to the meal in view.
  const next = mealAt(day.meals.map((m) => ({ name: m.name, time: m.planned?.time })), clockNow());
  const active = Math.min(slide ?? next, day.meals.length - 1);
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
        <div className="row" style={{ gap: 4 }}>
          <h2>Meals</h2>
          <button className="icon-btn small-icon" aria-label="Edit meals" onClick={() => setEditingMeals(true)}><EditIcon /></button>
        </div>
        <span className="small muted">{day.meals.filter((m) => m.entries.length > 0).length} of {day.meals.length} logged</span>
      </div>
      <Carousel key={date} label="Meals" titles={day.meals.map((m) => m.name)} index={active} onIndex={setSlide}>
        {day.meals.map((m, i) => {
          const logged = m.entries.length > 0;
          const planned = m.planned ? mealNutrients(m.planned) : null;
          const status = logged ? 'Logged' : i === next ? 'Now' : 'Pending';
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

      {logDay.entries.length > 0 && <ShareButton kind="food_log_day" data={logDay} title={`Food log ${date}`} label="Share this day's food log" />}

      {meal && (
        <Fab label="Log food or weight" actions={[
          { label: `Search food for ${meal.name}`, short: 'Search', icon: Icons.search, onSelect: () => navigate(pickLink(meal.name)) },
          { label: `Scan a barcode for ${meal.name}`, short: 'Scan', icon: Icons.scan, onSelect: () => navigate(pickLink(meal.name, '&scan=1')) },
          { label: 'Log weight', short: 'Weight', icon: Icons.weight, onSelect: () => setWeighing(true) },
        ]} />
      )}
      {editingMeals && (
        <MealsDialog names={mealNamesOf(profile)} planSetsMeals={day.meals.some((m) => m.planned)} onClose={() => setEditingMeals(false)}
          onSave={(list) => { setSlide(null); void repos.profile.saveProfile({ ...profile, mealNames: list.join('\n') === DEFAULT_MEALS.join('\n') ? null : list }); }} />
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
