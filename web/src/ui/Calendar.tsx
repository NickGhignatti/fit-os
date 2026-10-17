import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStream } from '../app/hooks';
import { addDays, weekdayOf, type LocalDate } from '../domain/plan';
import { sessionOn } from '../domain/trainingPlan';
import { combine } from '../domain/stream';
import { isCompleted } from '../domain/workout';
import { today } from './format';

const pad = (n: number) => String(n).padStart(2, '0');
const iso = (year: number, month: number, day: number): LocalDate => `${year}-${pad(month + 1)}-${pad(day)}`;

/** The weeks of a month as dates, Monday first, padded with the neighbouring months' days. [month] is 0-11. */
export const monthDays = (year: number, month: number): LocalDate[] => {
  const first = iso(year, month, 1);
  const start = addDays(first, -(weekdayOf(first) - 1));
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const weeks = Math.ceil((weekdayOf(first) - 1 + daysInMonth) / 7);
  return Array.from({ length: weeks * 7 }, (_, i) => addDays(start, i));
};

const HEADS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export const Calendar = () => {
  const now = today();
  const [year0, month0] = now.split('-').map(Number) as [number, number];
  const [cursor, setCursor] = useState({ year: year0, month: month0 - 1 });
  const navigate = useNavigate();
  const days = monthDays(cursor.year, cursor.month);
  const from = days[0]!;
  const to = days.at(-1)!;

  const info = useStream(
    (c) =>
      combine([c.repos.workouts.observeDaySummaries(from, to), c.repos.trainingPlans.observeActivePlans()], (summaries, plans) => ({
        completed: new Set(summaries.filter(isCompleted).map((s) => s.date)),
        logged: new Set(summaries.map((s) => s.date)),
        planned: (date: LocalDate) => plans.some((plan) => sessionOn(plan, date).length > 0),
      })),
    [from, to],
  );

  const shift = (delta: number) =>
    setCursor(({ year, month }) => {
      const m = month + delta;
      return { year: year + Math.floor(m / 12), month: ((m % 12) + 12) % 12 };
    });
  const title = new Date(Date.UTC(cursor.year, cursor.month, 1)).toLocaleString('en', { month: 'long', year: 'numeric', timeZone: 'UTC' });

  return (
    <section className="card" aria-label="Calendar">
      <div className="row between">
        <button className="icon-btn" aria-label="Previous month" onClick={() => shift(-1)}>‹</button>
        <button className="link" onClick={() => setCursor({ year: year0, month: month0 - 1 })}>{title}</button>
        <button className="icon-btn" aria-label="Next month" onClick={() => shift(1)}>›</button>
      </div>
      <div className="calendar">
        {HEADS.map((h, i) => <span key={i} className="head">{h}</span>)}
        {days.map((date) => {
          const day = Number(date.slice(8));
          const completed = info?.completed.has(date) ?? false;
          const planned = !completed && ((info?.logged.has(date) ?? false) || (info?.planned(date) ?? false));
          const outside = Number(date.slice(5, 7)) - 1 !== cursor.month;
          const classes = [completed ? 'completed' : '', planned ? 'planned' : '', date === now ? 'today' : '', outside ? 'outside' : ''].join(' ');
          return (
            <button key={date} className={classes} onClick={() => navigate(`/day/${date}`)}
              aria-label={`${day}${completed ? ', workout completed' : planned ? ', workout planned' : ''}`}>
              {day}
            </button>
          );
        })}
      </div>
      <div className="row small muted" style={{ marginTop: 8 }}>
        <span className="chip">○ Planned</span><span className="chip done">● Completed</span>
      </div>
    </section>
  );
};
