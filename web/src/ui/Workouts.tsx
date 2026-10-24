import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useContainer, useStream } from '../app/hooks';
import { newTrainingPlan } from '../domain/edit';
import { weekdayOf, type LocalDate } from '../domain/plan';
import { sessionOn, sessionOnDay, trainingDays, type TrainingPlan } from '../domain/trainingPlan';
import { observeTrainingWeeks, startPlannedSession, type TrainingWeek } from '../domain/useCases';
import { ExerciseBrowser } from './Exercises';
import { WEEKDAYS, dateTitle, setSummary, shortDayName, today } from './format';
import { Carousel, Empty, Fab, Icons, Loading, Modal, PageHeader, PlayIcon, Segmented } from './kit';
import { PlanRows, TRAINING_TEXTS, usePlanCreation } from './Plans';
import { RecordsTab } from './Records';
import { useImportFileAction, useReceiveAction } from './Transfer';

export const trainingSummary = (plan: TrainingPlan): string => {
  const days = trainingDays(plan);
  if (days.length === 0) return 'No exercises yet';
  if (plan.recurrence === 'daily') {
    const count = sessionOnDay(plan, 0).length;
    return `${count} ${count === 1 ? 'exercise' : 'exercises'}`;
  }
  return days.map(shortDayName).join(' · ');
};

type Tab = 'plans' | 'library' | 'records';

/** Exercises a week card shows before the rest fold away behind its dots. */
const SHOWN_ROWS = 4;

const percent = (done: number, total: number) => (total > 0 ? Math.round(Math.min(done / total, 1) * 100) : 0);

/**
 * The training days of this week as cards to swipe through, opening on today (or the next day
 * with training). Each card lists what every active plan has that day, cut short with dots to see
 * the rest; tapping the card opens the day, and today's has a start button.
 */
const WeekCarousel = ({ weeks, date }: { weeks: readonly TrainingWeek[]; date: LocalDate }) => {
  const { repos } = useContainer();
  const navigate = useNavigate();
  const days = [...new Set(weeks.flatMap((w) => w.days.map((d) => d.date)))].sort();
  const next = days.findIndex((d) => d >= date);
  const [slide, setSlide] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<LocalDate | null>(null);
  if (days.length === 0) return <Empty>Nothing planned this week.<br />Add exercises to an active workout.</Empty>;
  const index = Math.min(slide ?? (next === -1 ? days.length - 1 : next), days.length - 1);

  return (
    <Carousel label="Training days" titles={days.map((d) => shortDayName(weekdayOf(d)))} index={index} onIndex={setSlide}>
      {days.map((d) => {
        const entries = weeks.flatMap((week) => week.days.filter((x) => x.date === d).map((day) => ({ week, day })));
        const sets = entries.reduce((n, e) => ({ done: n.done + e.day.sets.done, total: n.total + e.day.sets.total }), { done: 0, total: 0 });
        const done = entries.every((e) => e.day.isCompleted);
        const status = d === date ? 'Today' : done ? 'Done' : d < date ? 'Missed' : 'Coming up';
        const pending = d === date ? entries.filter((e) => e.week.hasPendingSessionToday) : [];
        // Short cards: the first few exercises, the rest behind the dots.
        const open = expanded === d;
        let room = open ? Infinity : SHOWN_ROWS;
        const blocks = entries.map(({ week }) => {
          const all = sessionOn(week.plan, d);
          const rows = all.slice(0, Math.max(room, 0));
          room -= all.length;
          return { week, rows };
        }).filter((b) => b.rows.length > 0);
        const hidden = open ? 0 : -Math.min(room, 0);
        return (
          <section key={d} className={`card meal-card week-card ${open ? 'open' : ''}`} aria-label={WEEKDAYS[weekdayOf(d) - 1]}>
            <div className="meal-head">
              <div className="grow">
                <div className={`eyebrow ${d === date ? 'next' : ''}`}>{status} · {dateTitle(d).split(' ').slice(1).join(' ')}</div>
                <Link className="meal-name card-link" to={`/day/${d}`}>{WEEKDAYS[weekdayOf(d) - 1]}</Link>
              </div>
              <div className="meal-kcal">
                <b>{done ? '✓' : `${percent(sets.done, sets.total)}%`}</b>
                <span className="small muted">{sets.done}/{sets.total} sets</span>
              </div>
            </div>
            {blocks.map(({ week, rows }) => (
              <div key={week.plan.id} className="plan-block">
                <div className="plan-block-name">{week.plan.name}</div>
                {rows.map((e) => (
                  <div key={e.id} className="exercise-row"><span>{e.name}</span><span className="muted">{setSummary(e.sets)}</span></div>
                ))}
              </div>
            ))}
            {hidden > 0 || open ? (
              <button className="more-btn" aria-expanded={open} aria-label={open ? 'Show fewer exercises' : `Show ${hidden} more exercises`}
                onClick={() => setExpanded(open ? null : d)}>
                {open ? 'Show less' : '•••'}
              </button>
            ) : null}
            <div className="spacer" />
            {pending.map(({ week }) => (
              <button key={week.plan.id} className="btn start" aria-label={`Start today's session of ${week.plan.name}`}
                onClick={() => void startPlannedSession(repos, date, week.plan.id).then(() => navigate(`/day/${date}`))}>
                <PlayIcon />Start {pending.length > 1 ? week.plan.name : 'workout'}
              </button>
            ))}
          </section>
        );
      })}
    </Carousel>
  );
};

export const Workouts = () => {
  const [params, setParams] = useSearchParams();
  const requested = params.get('tab');
  const tab: Tab = requested === 'library' || requested === 'records' ? requested : 'plans';
  const date = today();
  const { repos } = useContainer();
  const plans = useStream((c) => c.repos.trainingPlans.observePlans());
  const weeks = useStream((c) => observeTrainingWeeks(c.repos, date), [date]);
  const [listing, setListing] = useState(false);
  const href = (p: TrainingPlan) => `/workouts/plan/${p.id}`;
  const [create, creating] = usePlanCreation({ repo: repos.trainingPlans, texts: TRAINING_TEXTS, icon: Icons.workout, create: newTrainingPlan, href });
  const [importFile, importing] = useImportFileAction();
  const [receive, receiving] = useReceiveAction();
  const week = (weeks ?? []).reduce((n, w) => ({ done: n.done + w.completedCount, total: n.total + w.days.length }), { done: 0, total: 0 });
  // Active ones first, then by name: the list is mostly for switching plans on and off.
  const sorted = [...(plans ?? [])].sort((a, b) => Number(b.isActive) - Number(a.isActive) || a.name.localeCompare(b.name));

  return (
    <>
      <PageHeader title="Workouts" actions={
        <button className="icon-btn count-btn" aria-label="All workouts" onClick={() => setListing(true)}>
          {Icons.list}{plans && plans.length > 0 && <span className="count" aria-hidden="true">{plans.length}</span>}
        </button>
      } />
      <Segmented<Tab> label="Workouts" value={tab} onChange={(t) => setParams(t === 'plans' ? {} : { tab: t }, { replace: true })}
        options={[{ value: 'plans', label: 'This week' }, { value: 'library', label: 'Library' }, { value: 'records', label: 'Records' }]} />
      {tab === 'library' ? (
        <ExerciseBrowser />
      ) : tab === 'records' ? (
        <RecordsTab />
      ) : weeks === undefined ? (
        <Loading />
      ) : weeks.length === 0 ? (
        <Empty>
          No active workout.<br />
          Open <button className="link" onClick={() => setListing(true)}>all workouts</button> to switch one on, or tap + to create one.
        </Empty>
      ) : (
        <section aria-label="This week">
          <div className="section-head">
            <h2>{weeks.map((w) => w.plan.name).join(' · ')}</h2>
            <span className="small muted">{week.done} of {week.total} done</span>
          </div>
          <WeekCarousel weeks={weeks} date={date} />
        </section>
      )}
      {tab === 'plans' && <Fab label="Add a workout" actions={[create, importFile, receive]} />}
      {listing && (
        <Modal title="Your workouts" onClose={() => setListing(false)}>
          {sorted.length === 0
            ? <p className="muted">No workouts yet. Tap + to create one.</p>
            : <PlanRows plans={sorted} repo={repos.trainingPlans} summary={trainingSummary} href={href} onOpen={() => setListing(false)} />}
        </Modal>
      )}
      {creating}
      {importing}
      {receiving}
    </>
  );
};
