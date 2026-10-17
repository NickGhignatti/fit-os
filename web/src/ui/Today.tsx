import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useContainer, useStream } from '../app/hooks';
import { newWorkout } from '../domain/edit';
import { weekdayOf } from '../domain/plan';
import { logPlannedMeal, observeCalorieDay, observeDailyTargets, observeDayAgenda, observeTrainingWeek } from '../domain/useCases';
import { DEFAULT_MEALS, dateTitle, formatKcal, formatKg, parseNumber, shortDayName, today } from './format';
import { useToast } from './hooks';
import { Loading, MacroChips, PageHeader, ProgressBar, PromptDialog } from './kit';
import { PendingSessionCard, WorkoutCard } from './WorkoutCard';

export const Today = () => {
  const date = today();
  const { repos } = useContainer();
  const toast = useToast();
  const agenda = useStream((c) => observeDayAgenda(c.repos, date), [date]);
  const week = useStream((c) => observeTrainingWeek(c.repos, date), [date]);
  const calories = useStream((c) => observeCalorieDay(c.repos, date, DEFAULT_MEALS), [date]);
  const targets = useStream((c) => observeDailyTargets(c.repos.profile, date), [date]);
  const [weighing, setWeighing] = useState(false);

  // `null` means "no active plan / not enough data"; `undefined` means "still loading".
  if (!agenda || !calories || week === undefined || targets === undefined) return <Loading />;

  const goal = targets?.nutrients.kcal;
  const restDay = agenda.hasTrainingPlan && !agenda.pendingSession && agenda.workouts.length === 0;

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
      {week ? (
        <section className="card" aria-label="This week">
          <div className="row between">
            <span className="title">{week.plan.name}</span>
            <span className="small muted">{week.completedCount} of {week.days.length} sessions completed</span>
          </div>
          <div className="week" style={{ marginTop: 8 }}>
            {week.days.map((d) => (
              <Link key={d.date} to={`/day/${d.date}`} className={`day ${d.isCompleted ? 'done' : ''} ${d.isToday ? 'today' : ''}`}
                aria-label={`${dateTitle(d.date)}${d.isCompleted ? ', completed' : ''}`}>
                {shortDayName(weekdayOf(d.date))}{d.isCompleted ? ' ✓' : ''}
              </Link>
            ))}
          </div>
        </section>
      ) : (
        <section className="card">
          <p className="muted">No active workout. Pick one to see it here every day.</p>
          <Link className="btn secondary" to="/workouts">Choose a workout</Link>
        </section>
      )}

      {agenda.pendingSession && <PendingSessionCard session={agenda.pendingSession} date={date} />}
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
