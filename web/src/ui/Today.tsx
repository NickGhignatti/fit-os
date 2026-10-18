import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useContainer, useStream } from '../app/hooks';
import { weekdayOf } from '../domain/plan';
import { observeCalorieDay, observeDailyTargets, observeDayAgenda, observeTrainingWeeks, startPlannedSession, type TrainingWeek } from '../domain/useCases';
import { doneSetsOf, totalSetsOf } from '../domain/workout';
import { DEFAULT_MEALS, dateTitle, formatKcal, formatKg, parseNumber, shortDayName, today } from './format';
import { useToast } from './hooks';
import { ActionMenu, Loading, MacroChips, PageHeader, ProgressBar, ProgressRing, PromptDialog } from './kit';

interface Count { readonly done: number; readonly total: number }

const PlayIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M8 5v14l11-7z" fill="currentColor" /></svg>
);

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
  const navigate = useNavigate();
  const agenda = useStream((c) => observeDayAgenda(c.repos, date), [date]);
  const weeks = useStream((c) => observeTrainingWeeks(c.repos, date), [date]);
  const calories = useStream((c) => observeCalorieDay(c.repos, date, DEFAULT_MEALS), [date]);
  const targets = useStream((c) => observeDailyTargets(c.repos.profile, date), [date]);
  const [weighing, setWeighing] = useState(false);

  // `null` means "not enough data"; `undefined` means "still loading".
  if (!agenda || !calories || weeks === undefined || targets === undefined) return <Loading />;

  const goal = targets?.nutrients.kcal;
  // Today lists only what is left to do; the workout itself is logged on the day's page.
  const day = `/day/${date}`;
  const unfinished = agenda.workouts.filter((w) => totalSetsOf(w) === 0 || doneSetsOf(w) < totalSetsOf(w));
  const nothingToDo = agenda.pendingSessions.length === 0 && unfinished.length === 0;

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
        <p className="muted">No active workout.</p>
      )}
      {nothingToDo ? (
        agenda.workouts.length > 0 ? <p className="muted">Training done for today.</p>
          : agenda.hasTrainingPlan && <p className="muted">Rest day: nothing planned.</p>
      ) : (
        <section className="card" aria-label="Training to do">
          {agenda.pendingSessions.map((session) => (
            <div key={session.planId} className="list-item" style={{ cursor: 'default' }}>
              <div className="grow">
                <div className="title">{session.title}</div>
                <div className="small muted">
                  {session.exercises.length} {session.exercises.length === 1 ? 'exercise' : 'exercises'} · {session.exercises.reduce((n, e) => n + e.sets.length, 0)} sets
                </div>
              </div>
              <button className="play" aria-label={`Start ${session.title}`}
                onClick={() => void startPlannedSession(repos, date, session.planId).then(() => navigate(day))}>
                <PlayIcon />
              </button>
            </div>
          ))}
          {unfinished.map((w) => (
            <div key={w.id} className="list-item" style={{ cursor: 'default' }}>
              <div className="grow">
                <div className="title">{w.title}</div>
                <div className="small muted">{doneSetsOf(w)} of {totalSetsOf(w)} sets done</div>
              </div>
              <Link className="play" aria-label={`Continue ${w.title}`} to={day}><PlayIcon /></Link>
            </div>
          ))}
        </section>
      )}

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
            </div>
          ))}
        </section>
      ) : (
        <p className="muted">No active diet.</p>
      )}

      <div className="fab-space" />
      <ActionMenu label="Log food or weight" icon="+" className="fab" actions={[
        { label: 'Food', onSelect: () => navigate('/tracker') },
        { label: 'Weight', onSelect: () => setWeighing(true) },
      ]} />
      {weighing && (
        <PromptDialog title="Weight" label="Weight (kg)" inputMode="decimal" confirmLabel="Save" onClose={() => setWeighing(false)}
          validate={(v) => { const n = parseNumber(v); return n !== null && n >= 20 && n <= 500; }}
          onSubmit={(v) => void repos.profile.setWeight(date, parseNumber(v)!).then(() => toast(`Logged ${formatKg(parseNumber(v)!)}`))} />
      )}
    </>
  );
};
