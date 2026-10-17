import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useContainer, useStream } from '../app/hooks';
import { newWorkout } from '../domain/edit';
import { addDays } from '../domain/plan';
import { observeDayAgenda } from '../domain/useCases';
import { dateTitle, relativeDay, today } from './format';
import { Empty, Loading, PageHeader, PromptDialog } from './kit';
import { PendingSessionCard, WorkoutCard } from './WorkoutCard';

const VALID_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const Day = () => {
  const { date = '' } = useParams();
  const navigate = useNavigate();
  const { repos } = useContainer();
  const valid = VALID_DATE.test(date);
  const agenda = useStream((c) => observeDayAgenda(c.repos, valid ? date : today()), [date, valid]);
  const [adding, setAdding] = useState(false);

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
      {agenda.pendingSession && <PendingSessionCard session={agenda.pendingSession} date={date} />}
      {agenda.workouts.map((w) => <WorkoutCard key={w.id} workout={w} />)}
      {!agenda.pendingSession && agenda.workouts.length === 0 && (
        <Empty>Nothing planned for this day.<br />Tap “Add workout” to log one.</Empty>
      )}
      <button className="btn" onClick={() => setAdding(true)}>Add workout</button>
      {adding && (
        <PromptDialog title="Add workout" label="Name" initial="Workout" confirmLabel="Add" onClose={() => setAdding(false)}
          onSubmit={(title) => void repos.workouts.save(newWorkout(date, title))} />
      )}
    </>
  );
};
