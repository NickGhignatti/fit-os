import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useContainer, useStream } from '../app/hooks';
import { newTrainingPlan } from '../domain/edit';
import { sessionOnDay, trainingDays, type TrainingPlan } from '../domain/trainingPlan';
import { observeTrainingWeeks, startPlannedSession } from '../domain/useCases';
import { ExerciseBrowser } from './Exercises';
import { shortDayName, today } from './format';
import { PageHeader, PlayIcon, Segmented } from './kit';
import { PlanList, TRAINING_TEXTS } from './Plans';
import { RecordsTab } from './Records';
import { ReceiveButton } from './Transfer';

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

export const Workouts = () => {
  const [params, setParams] = useSearchParams();
  const requested = params.get('tab');
  const tab: Tab = requested === 'library' || requested === 'records' ? requested : 'plans';
  const date = today();
  const { repos, community } = useContainer();
  const navigate = useNavigate();
  const plans = useStream((c) => c.repos.trainingPlans.observePlans());
  const weeks = useStream((c) => observeTrainingWeeks(c.repos, date), [date]);

  const tabs = (
    <Segmented<Tab> label="Workouts" value={tab} onChange={(t) => setParams(t === 'plans' ? {} : { tab: t }, { replace: true })}
      options={[{ value: 'plans', label: 'My plans' }, { value: 'library', label: 'Library' }, { value: 'records', label: 'Records' }]} />
  );

  return (
    <>
      <PageHeader title="Workouts" />
      {tabs}
      {tab === 'library' ? (
        <ExerciseBrowser />
      ) : tab === 'records' ? (
        <RecordsTab />
      ) : (
        <PlanList
          plans={plans}
          repo={repos.trainingPlans}
          texts={TRAINING_TEXTS}
          summary={trainingSummary}
          create={(name, recurrence) => newTrainingPlan(name, recurrence)}
          href={(p) => `/workouts/plan/${p.id}`}
          header={weeks && weeks.length > 0 ? weeks.map((week) => (
            <section key={week.plan.id} className="session" aria-label={`Active program: ${week.plan.name}`}>
              <div className="grow">
                <div className="eyebrow">Active program</div>
                <div className="session-title">{week.plan.name}</div>
                <div className="session-meta">{week.completedCount} of {week.days.length} sessions completed</div>
                <div className="session-bar"><span style={{ width: `${week.days.length > 0 ? (week.completedCount / week.days.length) * 100 : 0}%` }} /></div>
              </div>
              {week.hasPendingSessionToday && (
                <button className="play" aria-label={`Start today's session of ${week.plan.name}`}
                  onClick={() => void startPlannedSession(repos, date, week.plan.id).then(() => navigate('/'))}>
                  <PlayIcon />
                </button>
              )}
            </section>
          )) : weeks ? <p className="muted">No active plan. Set one as active to follow it here. You can follow several at once.</p> : undefined}
        />
      )}
      {tab === 'plans' && (
        <div className="stack" style={{ marginTop: 12 }}>
          <ReceiveButton />
          {community && <Link className="btn secondary" style={{ textAlign: 'center', textDecoration: 'none' }} to="/community">Browse community workouts</Link>}
        </div>
      )}
    </>
  );
};
