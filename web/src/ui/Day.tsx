import { useNavigate, useParams } from 'react-router-dom';
import { useStream } from '../app/hooks';
import { addDays } from '../domain/plan';
import { observeDayAgenda } from '../domain/useCases';
import { dateTitle, relativeDay, today } from './format';
import { Empty, Fab, Icons, Loading, PageHeader, type FabAction } from './kit';
import { PendingSessionCard, WorkoutCard } from './WorkoutCard';

const VALID_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const Day = () => {
  const { date = '' } = useParams();
  const navigate = useNavigate();
  const valid = VALID_DATE.test(date);
  const agenda = useStream((c) => observeDayAgenda(c.repos, valid ? date : today()), [date, valid]);

  // While training the + only adds exercises: to the session under way, or, with several, to the
  // one picked from the fan. On an empty day the first exercise brings its own workout.
  const addExercise: FabAction[] = !agenda || agenda.workouts.length === 0
    ? [{ label: 'Add exercise', icon: Icons.workout, onSelect: () => navigate(`/exercises/pick?date=${date}`) }]
    : agenda.workouts.map((w) => ({
      label: agenda.workouts.length > 1 ? `Add exercise to ${w.title}` : 'Add exercise', short: w.title, icon: Icons.workout,
      onSelect: () => navigate(`/exercises/pick?workout=${w.id}`),
    }));

  if (!valid) return <Empty>That isn't a date. <button className="link" onClick={() => navigate('/')}>Go to today</button></Empty>;
  if (!agenda) return <Loading />;

  return (
    <>
      <PageHeader back title={relativeDay(date)} subtitle={date === today() ? dateTitle(date) : undefined} actions={
        <>
          <button className="icon-btn" aria-label="Previous day" onClick={() => navigate(`/day/${addDays(date, -1)}`, { replace: true })}>‹</button>
          <button className="icon-btn" aria-label="Next day" onClick={() => navigate(`/day/${addDays(date, 1)}`, { replace: true })}>›</button>
        </>
      } />
      {agenda.pendingSessions.map((session) => <PendingSessionCard key={session.planId} session={session} date={date} />)}
      {agenda.workouts.map((w) => <WorkoutCard key={w.id} workout={w} />)}
      {agenda.pendingSessions.length === 0 && agenda.workouts.length === 0 && (
        <Empty>Nothing planned for this day.<br />Tap + to add an exercise.</Empty>
      )}
      <Fab label="Add an exercise" actions={addExercise} />
    </>
  );
};
