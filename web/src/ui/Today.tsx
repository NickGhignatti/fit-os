import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useContainer, useStream } from '../app/hooks';
import { newWorkout } from '../domain/edit';
import { weekdayOf } from '../domain/plan';
import { logPlannedMeal, observeCalorieDay, observeDailyTargets, observeDayAgenda, observeTrainingWeeks, type TrainingWeek } from '../domain/useCases';
import { DEFAULT_MEALS, dateTitle, formatKcal, formatKg, parseNumber, shortDayName, today } from './format';
import { useToast } from './hooks';
import { Loading, MacroChips, PageHeader, ProgressBar, ProgressRing, PromptDialog } from './kit';
import { PendingSessionCard, WorkoutCard } from './WorkoutCard';

interface Count { readonly done: number; readonly total: number }

/**
 * Two rings for every active plan together: today's sets, and this week's sessions. Tapping a ring
 * opens what it counts, plan by plan, so you see what is done and what is left.
 */
const TrainingProgress = ({ weeks }: { weeks: readonly TrainingWeek[] }) => {
  const [open, setOpen] = useState<'day' | 'week' | null>(null);
  const planned = weeks.filter((w) => w.todaySets !== null);
  const day = planned.reduce<Count>((c, w) => ({ done: c.done + w.todaySets!.done, total: c.total + w.todaySets!.total }), { done: 0, total: 0 });
  const week = weeks.reduce<Count>((c, w) => ({ done: c.done + w.completedCount, total: c.total + w.days.length }), { done: 0, total: 0 });

  const ring = (key: 'day' | 'week', label: string, count: Count, caption: string) => (
    <button className="ring-btn" aria-expanded={open === key} aria-controls={`training-${key}`}
      aria-label={`${label}: ${count.total > 0 ? `${Math.round(Math.min(count.done / count.total, 1) * 100)}%, ` : ''}${caption}`}
      onClick={() => setOpen(open === key ? null : key)}>
      <ProgressRing value={count.done} max={count.total} />
      <span className="title">{label} {open === key ? '▴' : '▾'}</span>
      <span className="small muted">{caption}</span>
    </button>
  );

  return (
    <section className="card" aria-label="Training progress">
      <div className="rings">
        {ring('day', 'Today', day, planned.length === 0 ? 'Rest day' : `${day.done} of ${day.total} sets`)}
        {ring('week', 'This week', week, `${week.done} of ${week.total} sessions`)}
      </div>
      {open === 'day' && (
        <div id="training-day" className="ring-detail">
          {planned.length === 0 && <p className="small muted">No session planned today.</p>}
          {planned.map((w) => {
            const sets = w.todaySets!;
            const done = sets.total > 0 && sets.done === sets.total;
            return (
              <div key={w.plan.id} className="list-item" style={{ cursor: 'default' }}>
                <span className="grow title">{w.plan.name}</span>
                {done ? <span className="badge">Done ✓</span>
                  : <span className="small muted">{w.hasPendingSessionToday ? `Not started · ${sets.total} sets` : `${sets.done} of ${sets.total} sets`}</span>}
              </div>
            );
          })}
        </div>
      )}
      {open === 'week' && (
        <div id="training-week" className="ring-detail">
          {weeks.map((w) => (
            <section key={w.plan.id} aria-label={`${w.plan.name}, this week`}>
              <div className="row between">
                <span className="title">{w.plan.name}</span>
                <span className="small muted">{w.completedCount} of {w.days.length} sessions</span>
              </div>
              <div className="week" style={{ marginTop: 8 }}>
                {w.days.map((d) => (
                  <Link key={d.date} to={`/day/${d.date}`} className={`day ${d.isCompleted ? 'done' : ''} ${d.isToday ? 'today' : ''}`}
                    aria-label={`${w.plan.name}, ${dateTitle(d.date)}${d.isCompleted ? ', completed' : ''}`}>
                    {shortDayName(weekdayOf(d.date))}{d.isCompleted ? ' ✓' : ''}
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </section>
  );
};

export const Today = () => {
  const date = today();
  const { repos } = useContainer();
  const toast = useToast();
  const agenda = useStream((c) => observeDayAgenda(c.repos, date), [date]);
  const weeks = useStream((c) => observeTrainingWeeks(c.repos, date), [date]);
  const calories = useStream((c) => observeCalorieDay(c.repos, date, DEFAULT_MEALS), [date]);
  const targets = useStream((c) => observeDailyTargets(c.repos.profile, date), [date]);
  const [weighing, setWeighing] = useState(false);

  // `null` means "not enough data"; `undefined` means "still loading".
  if (!agenda || !calories || weeks === undefined || targets === undefined) return <Loading />;

  const goal = targets?.nutrients.kcal;
  const restDay = agenda.hasTrainingPlan && agenda.pendingSessions.length === 0 && agenda.workouts.length === 0;

  return (
    <>
      <PageHeader title="Today" subtitle={dateTitle(date)} />

      <section className="card" aria-label="Energy consumed">
        <div className="small muted">Energy consumed</div>
        <div className="row between" style={{ alignItems: 'baseline' }}>
          <span className="big-number">{Math.round(calories.eaten.kcal)}</span>
          <span className="muted">{goal !== undefined ? `/ ${Math.round(goal)} kcal` : 'kcal'}</span>
        </div>
        {goal !== undefined && <ProgressBar value={calories.eaten.kcal} max={goal} label="Energy consumed" />}
        <div style={{ marginTop: 10 }}><MacroChips n={calories.eaten} /></div>
        {goal === undefined && <p className="small muted"><Link to="/profile">Set up your profile</Link> to get a daily goal.</p>}
      </section>

      <h2>Training</h2>
      {weeks.length > 0 ? (
        <TrainingProgress weeks={weeks} />
      ) : (
        <section className="card">
          <p className="muted">No active workout. Pick one to see it here every day.</p>
          <Link className="btn secondary" to="/workouts">Choose a workout</Link>
        </section>
      )}

      {agenda.pendingSessions.map((session) => <PendingSessionCard key={session.planId} session={session} date={date} />)}
      {agenda.workouts.map((w) => <WorkoutCard key={w.id} workout={w} />)}
      {restDay && <p className="muted">Rest day: nothing planned.</p>}
      <button className="btn secondary" onClick={() => void repos.workouts.save(newWorkout(date, 'Workout'))}>Add a workout</button>

      <h2>Meals</h2>
      {calories.hasDietPlan ? (
        <section className="card" aria-label="Nutrition checklist">
          <div className="small muted">{calories.meals.filter((m) => m.entries.length > 0).length} of {calories.meals.length} logged</div>
          {calories.meals.map((meal) => (
            <div key={meal.name} className="list-item" style={{ cursor: 'default' }}>
              <div className="grow">
                <div className="title">{meal.name} {meal.entries.length > 0 && <span className="badge">logged</span>}</div>
                <div className="small muted">
                  {meal.entries.length > 0 ? formatKcal(meal.eaten.kcal) : meal.planned?.time ? `Scheduled ${meal.planned.time}` : 'Pending'}
                </div>
              </div>
              {meal.canLogAsPlanned && meal.planned && (
                <button className="btn secondary" onClick={() => void logPlannedMeal(repos, date, meal.planned!).then((n) => toast(`Logged ${n} ${n === 1 ? 'food' : 'foods'} as ${meal.name}`))}>
                  Log as planned
                </button>
              )}
            </div>
          ))}
        </section>
      ) : (
        <section className="card">
          <p className="muted">No active diet. Pick one to see your meals here.</p>
          <Link className="btn secondary" to="/food">Choose a diet</Link>
        </section>
      )}

      <h2>Quick actions</h2>
      <div className="row">
        <Link className="btn grow" to="/tracker" style={{ textAlign: 'center', textDecoration: 'none' }}>+ Food</Link>
        <button className="btn grow" onClick={() => setWeighing(true)}>+ Weight</button>
      </div>
      {weighing && (
        <PromptDialog title="Weight" label="Weight (kg)" inputMode="decimal" confirmLabel="Save" onClose={() => setWeighing(false)}
          validate={(v) => { const n = parseNumber(v); return n !== null && n >= 20 && n <= 500; }}
          onSubmit={(v) => void repos.profile.setWeight(date, parseNumber(v)!).then(() => toast(`Logged ${formatKg(parseNumber(v)!)}`))} />
      )}
    </>
  );
};
