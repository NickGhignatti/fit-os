import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useContainer, useStream } from '../app/hooks';
import { newTrainingPlan } from '../domain/edit';
import { sessionOnDay, trainingDays, type TrainingPlan } from '../domain/trainingPlan';
import { observeTrainingWeek, startPlannedSession } from '../domain/useCases';
import { ExerciseBrowser } from './Exercises';
import { shortDayName, today } from './format';
import { PageHeader, Segmented } from './kit';
import { PlanList, TRAINING_TEXTS } from './Plans';
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

type Tab = 'plans' | 'library';

export const Workouts = () => {
  const [params, setParams] = useSearchParams();
  const tab: Tab = params.get('tab') === 'library' ? 'library' : 'plans';
  const date = today();
  const { repos, community } = useContainer();
  const navigate = useNavigate();
  const plans = useStream((c) => c.repos.trainingPlans.observePlans());
  const week = useStream((c) => observeTrainingWeek(c.repos, date), [date]);

  const tabs = (
    <Segmented<Tab> label="Workouts" value={tab} onChange={(t) => setParams(t === 'plans' ? {} : { tab: t }, { replace: true })}
      options={[{ value: 'plans', label: 'My plans' }, { value: 'library', label: 'Exercise library' }]} />
  );

  return (
    <>
      <PageHeader title="Workouts" />
      {tabs}
      {tab === 'library' ? (
        <ExerciseBrowser />
      ) : (
        <PlanList
          plans={plans}
          repo={repos.trainingPlans}
          texts={TRAINING_TEXTS}
          summary={trainingSummary}
          create={(name, recurrence) => newTrainingPlan(name, recurrence)}
          href={(p) => `/workouts/plan/${p.id}`}
          header={week ? (
            <section className="card" aria-label="Active program">
              <div className="small muted">Active program</div>
              <div className="title">{week.plan.name}</div>
              <div className="small muted">{week.completedCount} of {week.days.length} sessions completed</div>
              {week.hasPendingSessionToday && (
                <button className="btn" style={{ marginTop: 8 }}
                  onClick={() => void startPlannedSession(repos, date).then(() => navigate('/'))}>
                  Start today's session
                </button>
              )}
            </section>
          ) : week === null ? <p className="muted">No active plan. Set one as active to follow it here.</p> : undefined}
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
