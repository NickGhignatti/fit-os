import { useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useContainer, useStream } from '../app/hooks';
import { addMeal, deleteFood, deleteMeal, newDietPlan, updateFood, updateMeal } from '../domain/edit';
import { mealNutrients, mealsOnDay, nutrientsOnDay, plannedDays, type DietPlan, type Meal, type PlannedFood } from '../domain/diet';
import { portionNutrients, portionOf } from '../domain/nutrition';
import { daysOf, type PlanDay } from '../domain/plan';
import { copyDietDay } from '../domain/useCases';
import { dayName, formatGrams, formatKcal, parseNumber, shortDayName } from './format';
import { useToast } from './hooks';
import { MacroLine } from './Tracker';
import { ActionMenu, Carousel, ConfirmDialog, Empty, Fab, Icons, Loading, MacroChips, Modal, PageHeader, type FabAction } from './kit';
import { DIET_TEXTS, PlanList, PlanMenu, usePlanDay } from './Plans';
import { PublishButton } from './Community';
import { SendButton, useReceiveAction } from './Transfer';

const dietSummary = (plan: DietPlan): string => {
  const days = plannedDays(plan);
  if (days.length === 0) return 'No meals yet';
  if (plan.recurrence === 'daily') {
    const n = mealsOnDay(plan, 0).length;
    return `${n} ${n === 1 ? 'meal' : 'meals'}`;
  }
  return days.map(shortDayName).join(' · ');
};

export const Food = () => {
  const { repos, community } = useContainer();
  const navigate = useNavigate();
  const plans = useStream((c) => c.repos.dietPlans.observePlans());
  const [receive, receiving] = useReceiveAction();
  const browse: FabAction[] = community ? [{ label: 'Browse community diets', short: 'Community', icon: Icons.community, onSelect: () => navigate('/community') }] : [];
  return (
    <>
      <PageHeader title="Diet" />
      <PlanList plans={plans} repo={repos.dietPlans} texts={DIET_TEXTS} summary={dietSummary} icon={Icons.meal} more={[receive, ...browse]}
        create={(name, recurrence) => newDietPlan(name, recurrence)} href={(p) => `/food/plan/${p.id}`} />
      {receiving}
    </>
  );
};

const MealDialog = ({ title, meal, onSubmit, onClose }: {
  title: string; meal?: Meal; onSubmit: (name: string, time: string) => void; onClose: () => void;
}) => {
  const [name, setName] = useState(meal?.name ?? '');
  const [time, setTime] = useState(meal?.time ?? '');
  return (
    <Modal title={title} onClose={onClose}>
      <form className="stack" onSubmit={(e: FormEvent) => { e.preventDefault(); if (name.trim()) { onSubmit(name.trim(), time.trim()); onClose(); } }}>
        <label className="stack"><span className="small muted">Meal</span>
          <input className="field" value={name} autoFocus placeholder="Breakfast" onChange={(e) => setName(e.target.value)} /></label>
        <label className="stack"><span className="small muted">Time (optional)</span>
          <input className="field" value={time} placeholder="08:00" onChange={(e) => setTime(e.target.value)} /></label>
        <div className="actions">
          <button type="button" className="btn secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn" disabled={!name.trim()}>Save</button>
        </div>
      </form>
    </Modal>
  );
};

const FoodDialog = ({ food, onSave, onDelete, onClose }: {
  food: PlannedFood; onSave: (name: string, quantity: string, grams: number | null) => void; onDelete: () => void; onClose: () => void;
}) => {
  const [name, setName] = useState(food.name);
  const [quantity, setQuantity] = useState(food.quantity);
  const [grams, setGrams] = useState(food.portion ? String(food.portion.grams) : '');
  const g = parseNumber(grams);
  const valid = name.trim() !== '' && (!food.portion || (g !== null && g > 0));
  return (
    <Modal title="Edit food" onClose={onClose}>
      <form className="stack" onSubmit={(e) => { e.preventDefault(); if (valid) { onSave(name.trim(), quantity.trim(), food.portion ? g : null); onClose(); } }}>
        <label className="stack"><span className="small muted">Food</span>
          <input className="field" value={name} onChange={(e) => setName(e.target.value)} /></label>
        {food.portion ? (
          <label className="stack"><span className="small muted">Grams</span>
            <input className="field" inputMode="decimal" value={grams} onChange={(e) => setGrams(e.target.value)} /></label>
        ) : (
          <label className="stack"><span className="small muted">Quantity (optional)</span>
            <input className="field" value={quantity} placeholder="80 g" onChange={(e) => setQuantity(e.target.value)} /></label>
        )}
        <div className="actions">
          <button type="button" className="btn danger" onClick={() => { onDelete(); onClose(); }}>Delete</button>
          <button type="submit" className="btn" disabled={!valid}>Save</button>
        </div>
      </form>
    </Modal>
  );
};

const CopyDayDialog = ({ plan, source, onCopy, onClose }: {
  plan: DietPlan; source: PlanDay; onCopy: (targets: ReadonlySet<PlanDay>) => void; onClose: () => void;
}) => {
  const [targets, setTargets] = useState<ReadonlySet<PlanDay>>(new Set());
  const toggle = (d: PlanDay) => setTargets((t) => { const next = new Set(t); if (next.has(d)) next.delete(d); else next.add(d); return next; });
  return (
    <Modal title={`Copy ${dayName(source)} to…`} onClose={onClose}>
      <p className="muted">Meals already planned on the selected days will be replaced.</p>
      <div className="stack">
        {daysOf(plan.recurrence).filter((d) => d !== source).map((d) => (
          <label key={d} className="row"><input type="checkbox" checked={targets.has(d)} onChange={() => toggle(d)} /> {dayName(d)}</label>
        ))}
      </div>
      <div className="actions">
        <button className="btn secondary" onClick={onClose}>Cancel</button>
        <button className="btn" disabled={targets.size === 0} onClick={() => { onCopy(targets); onClose(); }}>Copy</button>
      </div>
    </Modal>
  );
};

type Dialog =
  | { kind: 'addMeal' } | { kind: 'editMeal'; meal: Meal } | { kind: 'deleteMeal'; meal: Meal }
  | { kind: 'editFood'; food: PlannedFood } | { kind: 'copy' };

const PlanBody = ({ plan }: { plan: DietPlan }) => {
  const { repos } = useContainer();
  const toast = useToast();
  const navigate = useNavigate();
  const days = daysOf(plan.recurrence);
  const [day, setDay] = usePlanDay(days);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [slide, setSlide] = useState(0);
  const meals = mealsOnDay(plan, day);
  const total = nutrientsOnDay(plan, day);
  const save = (p: DietPlan) => void repos.dietPlans.save(p);

  return (
    <>
      {plan.recurrence === 'weekly' && (
        <div className="pills" role="tablist" aria-label="Day of the week">
          {days.map((d) => (
            <button key={d} role="tab" aria-selected={d === day} className={`pill ${d === day ? 'on' : ''}`} onClick={() => { setSlide(0); setDay(d); }}>
              {shortDayName(d)}{mealsOnDay(plan, d).length > 0 ? ' •' : ''}
            </button>
          ))}
        </div>
      )}

      {total && (
        <section className="card" aria-label="Day total">
          <div className="small muted">Planned: {formatKcal(total.kcal)}</div>
          <MacroChips n={total} />
        </section>
      )}

      {meals.length === 0 && (
        <Empty>{plan.recurrence === 'daily' ? <>No meals yet.<br />Tap + to add one.</> : <>No meals planned for {dayName(day)}.<br />Tap + to add one.</>}</Empty>
      )}

      {meals.length > 0 && (
        <Carousel key={day} label="Meals" titles={meals.map((m) => m.name)} index={Math.min(slide, meals.length - 1)} onIndex={setSlide}>
          {meals.map((meal, i) => {
            const n = mealNutrients(meal);
            const addItem = () => navigate(`/food/pick?plan=${plan.id}&meal=${meal.id}`);
            return (
              <section key={meal.id} className="card meal-card" aria-label={meal.name}>
                <div className="meal-head">
                  <div className="grow">
                    <div className="eyebrow">{meal.time || `Meal ${i + 1}`}</div>
                    <div className="meal-name">{meal.name}</div>
                  </div>
                  <div className="meal-kcal">
                    <b>{n ? Math.round(n.kcal) : '–'}</b>
                    <span className="small muted">kcal</span>
                  </div>
                  <ActionMenu label={`${meal.name} options`} actions={[
                    { label: 'Edit meal', onSelect: () => setDialog({ kind: 'editMeal', meal }) },
                    { label: 'Delete meal', danger: true, onSelect: () => setDialog({ kind: 'deleteMeal', meal }) },
                  ]} />
                </div>
                {n && <MacroLine n={n} />}
                {meal.foods.length === 0 && <p className="meal-empty small muted">No foods listed.</p>}
                {meal.foods.map((food) => (
                  <button key={food.id} className="list-item" onClick={() => setDialog({ kind: 'editFood', food })}>
                    <span className="grow">
                      <span className="title">{food.name}</span>
                      <br />
                      <span className="small muted">
                        {food.portion
                          ? `${formatGrams(food.portion.grams)} · ${formatKcal(portionNutrients(food.portion).kcal)}`
                          : `${food.quantity || 'no quantity'} · no nutrition data`}
                      </span>
                    </span>
                    <span className="muted">›</span>
                  </button>
                ))}
                <div className="spacer" />
                <button className="add-row" onClick={addItem}>{Icons.plus}Add item</button>
              </section>
            );
          })}
        </Carousel>
      )}

      <Fab label="Add to this day" actions={[
        { label: 'Add meal', short: 'Meal', icon: Icons.meal, onSelect: () => setDialog({ kind: 'addMeal' }) },
        ...(meals.length > 0 && plan.recurrence === 'weekly'
          ? [{ label: `Copy ${dayName(day)} to other days…`, short: 'Copy day', icon: Icons.copy, onSelect: () => setDialog({ kind: 'copy' }) } satisfies FabAction]
          : []),
      ]} />

      {dialog?.kind === 'addMeal' && (
        <MealDialog title="Add meal" onClose={() => setDialog(null)} onSubmit={(name, time) => { save(addMeal(plan, day, name, time).plan); setSlide(meals.length); }} />
      )}
      {dialog?.kind === 'editMeal' && (
        <MealDialog title="Edit meal" meal={dialog.meal} onClose={() => setDialog(null)} onSubmit={(name, time) => save(updateMeal(plan, dialog.meal.id, name, time))} />
      )}
      {dialog?.kind === 'deleteMeal' && (
        <ConfirmDialog title="Delete meal?" message={`“${dialog.meal.name}” and its foods will be removed.`} onClose={() => setDialog(null)}
          onConfirm={() => save(deleteMeal(plan, dialog.meal.id))} />
      )}
      {dialog?.kind === 'editFood' && (
        <FoodDialog food={dialog.food} onClose={() => setDialog(null)} onDelete={() => save(deleteFood(plan, dialog.food.id))}
          onSave={(name, quantity, grams) => save(updateFood(plan, dialog.food.id, name, quantity,
            dialog.food.portion && grams !== null ? portionOf(dialog.food.portion.food, grams) : null))} />
      )}
      {dialog?.kind === 'copy' && (
        <CopyDayDialog plan={plan} source={day} onClose={() => setDialog(null)}
          onCopy={(targets) => void copyDietDay(repos, plan.id, day, targets).then(() => toast(`Copied ${dayName(day)} to ${targets.size} ${targets.size === 1 ? 'day' : 'days'}`))} />
      )}
    </>
  );
};

export const DietPlanScreen = () => {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { repos } = useContainer();
  const plan = useStream((c) => c.repos.dietPlans.observePlan(id), [id]);

  if (plan === undefined) return <Loading />;
  if (plan === null) {
    return <Empty>This diet no longer exists.<br /><button className="link" onClick={() => navigate('/food', { replace: true })}>Back to diets</button></Empty>;
  }
  return (
    <>
      <PageHeader back title={plan.name} subtitle={`${plan.recurrence === 'daily' ? 'Daily' : 'Weekly'}${plan.isActive ? ' · Active' : ''}`}
        actions={<PlanMenu plan={plan} repo={repos.dietPlans} texts={DIET_TEXTS} afterDelete={() => navigate('/food', { replace: true })} />} />
      <PlanBody key={plan.id} plan={plan} />
      <div className="stack" style={{ marginTop: 12 }}>
        <SendButton kind="diet_plan" data={plan} label="Send this diet to another device" />
        <PublishButton kind="diet" plan={plan} />
      </div>
    </>
  );
};
