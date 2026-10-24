import { useState, type CSSProperties } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useContainer, useStream } from '../app/hooks';
import { mealNutrients } from '../domain/diet';
import type { Nutrients } from '../domain/nutrition';
import { weekdayOf } from '../domain/plan';
import { observeCalorieDay, observeDailyTargets, observeDayAgenda, observeTrainingWeeks, startPlannedSession, type TrainingWeek } from '../domain/useCases';
import { doneSetsOf, totalSetsOf } from '../domain/workout';
import { DEFAULT_MEALS, dateTitle, formatKcal, formatKg, parseNumber, shortDayName, today } from './format';
import { useToast } from './hooks';
import { ActionMenu, Loading, ProgressBar, ProgressRing, PromptDialog } from './kit';

interface Count { readonly done: number; readonly total: number }

const percentOf = (c: Count): number => (c.total > 0 ? Math.round(Math.min(c.done / c.total, 1) * 100) : 0);

/** "1,490": calories read better with a thousands separator. */
const kcal = (n: number): string => Math.round(n).toLocaleString('en');

const MACROS = [
  { key: 'protein', label: 'Protein', color: 'var(--protein)' },
  { key: 'carbs', label: 'Carbs', color: 'var(--carbs)' },
  { key: 'fat', label: 'Fat', color: 'var(--fat)' },
] as const;

const PlayIcon = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" fill="currentColor" /></svg>
);

const Chevron = () => (
  <svg className="chevron" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
    <path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const CheckIcon = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
    <path d="m5 12.5 4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/**
 * The day's energy as one big ring: what is left of the goal in the middle, the macros beside it.
 * Without a goal the ring stays empty and the middle shows what was eaten.
 */
const EnergyCard = ({ eaten, goal }: { eaten: Nutrients; goal: Nutrients | undefined }) => {
  const r = 54;
  const length = 2 * Math.PI * r;
  const ratio = goal && goal.kcal > 0 ? Math.min(eaten.kcal / goal.kcal, 1) : 0;
  const left = goal ? goal.kcal - eaten.kcal : 0;
  const over = goal !== undefined && left < 0;
  return (
    <section className="card today-energy" aria-label="Energy consumed">
      <div className="energy-body">
        <div className="energy-ring" role="progressbar" aria-label="Energy consumed"
          aria-valuenow={Math.round(eaten.kcal)} aria-valuemax={goal ? Math.round(goal.kcal) : undefined}>
          <svg viewBox="0 0 128 128" aria-hidden="true">
            <circle className="energy-track" cx="64" cy="64" r={r} />
            {ratio > 0 && (
              <circle className={`energy-fill ${over ? 'over' : ''}`} cx="64" cy="64" r={r} transform="rotate(-90 64 64)"
                strokeDasharray={length} strokeDashoffset={length * (1 - ratio)} />
            )}
          </svg>
          <div className="energy-center">
            <span className="energy-number">{kcal(goal ? Math.abs(left) : eaten.kcal)}</span>
            <span className="energy-unit">{goal ? (over ? 'kcal over' : 'kcal left') : 'kcal eaten'}</span>
          </div>
        </div>
        <div className="energy-macros">
          {MACROS.map((m) => (
            <div key={m.key} className="macro">
              <div className="row between">
                <span className="macro-label"><i style={{ background: m.color }} />{m.label}</span>
                <span className="macro-value">
                  {Math.round(eaten[m.key])}{goal && <span className="muted"> / {Math.round(goal[m.key])}</span>} g
                </span>
              </div>
              {goal && <ProgressBar value={eaten[m.key]} max={goal[m.key]} label={`${m.label} eaten`} color={m.color} />}
            </div>
          ))}
        </div>
      </div>
      <div className="energy-foot small muted">
        {goal ? <><span>{kcal(eaten.kcal)} eaten</span><span>{kcal(goal.kcal)} goal</span></>
          : <span><Link to="/profile">Set up your profile</Link> to get a daily goal.</span>}
      </div>
    </section>
  );
};

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
      aria-label={`${label}: ${count.total > 0 ? `${percentOf(count)}%, ` : ''}${caption}`}
      onClick={() => setOpen(open === key ? null : key)}>
      <ProgressRing value={count.done} max={count.total} />
      <span className="ring-text">
        <span className="title">{label} <Chevron /></span>
        <span className="small muted">{caption}</span>
      </span>
    </button>
  );

  return (
    <section className="card training-progress" aria-label="Training progress">
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
              <div className="week" style={{ marginTop: 10 }}>
                {w.days.map((d) => (
                  <Link key={d.date} to={`/day/${d.date}`} className={`day ${d.isCompleted ? 'done' : ''} ${d.isToday ? 'today' : ''}`}
                    style={{ '--fill': `${percentOf(d.sets)}%` } as CSSProperties}
                    aria-label={`${w.plan.name}, ${dateTitle(d.date)}, ${d.isCompleted ? 'completed' : `${percentOf(d.sets)}% done`}`}>
                    {shortDayName(weekdayOf(d.date))}
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

  // Today lists only what is left to do; the workout itself is logged on the day's page.
  const day = `/day/${date}`;
  const unfinished = agenda.workouts.filter((w) => totalSetsOf(w) === 0 || doneSetsOf(w) < totalSetsOf(w));
  const nothingToDo = agenda.pendingSessions.length === 0 && unfinished.length === 0;
  // A section shows only on a day it has something for: no rest-day or no-plan filler.
  const trainsToday = weeks.some((w) => w.todaySets !== null) || agenda.workouts.length > 0;
  const eatsByPlan = calories.hasDietPlan && calories.meals.length > 0;
  const loggedMeals = calories.meals.filter((m) => m.entries.length > 0).length;
  const nextMeal = calories.meals.find((m) => m.entries.length === 0);

  return (
    <div className="today">
      <header className="today-head">
        <p className="eyebrow">{dateTitle(date)}</p>
        <h1>Today</h1>
      </header>

      <EnergyCard eaten={calories.eaten} goal={targets?.nutrients} />

      {trainsToday && <h2>Training</h2>}
      {!trainsToday ? null : nothingToDo ? (
        <div className="card today-done">
          <span className="done-mark"><CheckIcon /></span>
          <span>Training done for today.</span>
        </div>
      ) : (
        <section className="today-todo" aria-label="Training to do">
          {agenda.pendingSessions.map((session) => (
            <div key={session.planId} className="session">
              <div className="grow">
                <div className="eyebrow">Up next</div>
                <div className="session-title">{session.title}</div>
                <div className="session-meta">
                  {session.exercises.length} {session.exercises.length === 1 ? 'exercise' : 'exercises'} · {session.exercises.reduce((n, e) => n + e.sets.length, 0)} sets
                </div>
                <div className="session-names">{session.exercises.map((e) => e.name).join(' · ')}</div>
              </div>
              <button className="play" aria-label={`Start ${session.title}`}
                onClick={() => void startPlannedSession(repos, date, session.planId).then(() => navigate(day))}>
                <PlayIcon />
              </button>
            </div>
          ))}
          {unfinished.map((w) => (
            <div key={w.id} className="session">
              <div className="grow">
                <div className="eyebrow">In progress</div>
                <div className="session-title">{w.title}</div>
                <div className="session-meta">{doneSetsOf(w)} of {totalSetsOf(w)} sets done</div>
                <div className="session-bar"><span style={{ width: `${percentOf({ done: doneSetsOf(w), total: totalSetsOf(w) })}%` }} /></div>
              </div>
              <Link className="play" aria-label={`Continue ${w.title}`} to={day}><PlayIcon /></Link>
            </div>
          ))}
        </section>
      )}
      {trainsToday && weeks.length > 0 && <TrainingProgress weeks={weeks} />}

      {eatsByPlan && (
        <div className="section-head">
          <h2>Meals</h2>
          <span className="small muted">{loggedMeals} of {calories.meals.length} logged</span>
        </div>
      )}
      {eatsByPlan && (
        <section className="card" aria-label="Nutrition checklist">
          <ol className="timeline">
            {calories.meals.map((meal) => {
              const logged = meal.entries.length > 0;
              const planned = meal.planned ? mealNutrients(meal.planned) : null;
              return (
                <li key={meal.name} className={logged ? 'logged' : meal === nextMeal ? 'next' : ''}>
                  <span className="dot">{logged && <CheckIcon />}</span>
                  <div className="grow">
                    <div className="title">{meal.name}</div>
                    <div className="small muted">
                      {logged ? 'Logged' : planned ? `${formatKcal(planned.kcal)} planned` : 'Pending'}
                    </div>
                  </div>
                  <span className="meal-side">{logged ? formatKcal(meal.eaten.kcal) : meal.planned?.time ?? ''}</span>
                </li>
              );
            })}
          </ol>
        </section>
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
    </div>
  );
};
