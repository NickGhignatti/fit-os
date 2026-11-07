import { useState, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import type { PlanDay, Recurrence } from '../domain/plan';
import type { PlanRepository } from '../domain/repositories';
import { Empty, Loading, Modal, ActionMenu, ConfirmDialog, PromptDialog, Segmented, type FabAction, type MenuAction } from './kit';

export interface PlanLike {
  readonly id: string;
  readonly name: string;
  readonly recurrence: Recurrence;
  readonly isActive: boolean;
}

export interface PlanTexts {
  /** "workout" or "diet": used in sentences. */
  readonly noun: string;
  readonly newLabel: string;
  readonly defaultName: string;
  readonly empty: string;
  readonly daily: string;
  readonly weekly: string;
  readonly deleteMessage: string;
}

export const TRAINING_TEXTS: PlanTexts = {
  noun: 'workout',
  newLabel: 'New workout',
  defaultName: 'Workout',
  empty: 'No workouts yet.\nTap + to create a daily or weekly one.',
  daily: 'The same workout every day',
  weekly: 'Its own workout on each day of the week',
  deleteMessage: 'Its exercises will be removed. Workouts you already logged from it are kept.',
};

export const DIET_TEXTS: PlanTexts = {
  noun: 'diet',
  newLabel: 'New diet',
  defaultName: 'Diet',
  empty: 'No diets yet.\nTap + to create a daily or weekly one.',
  daily: 'The same meals every day',
  weekly: 'Its own meals on each day of the week',
  deleteMessage: 'Its meals and foods will be removed.',
};

export const NewPlanDialog = ({ texts, onCreate, onClose }: {
  texts: PlanTexts; onCreate: (name: string, recurrence: Recurrence) => void; onClose: () => void;
}) => {
  const [name, setName] = useState(texts.defaultName);
  const [recurrence, setRecurrence] = useState<Recurrence>('daily');
  return (
    <Modal title={texts.newLabel} onClose={onClose}>
      <form className="stack" onSubmit={(e) => { e.preventDefault(); if (name.trim()) { onCreate(name.trim(), recurrence); onClose(); } }}>
        <label className="stack"><span className="small muted">Name</span>
          <input className="field" value={name} onChange={(e) => setName(e.target.value)} autoFocus /></label>
        <span className="small muted">Repeats</span>
        <Segmented<Recurrence> label="Repeats" value={recurrence} onChange={setRecurrence}
          options={[{ value: 'daily', label: 'Daily' }, { value: 'weekly', label: 'Weekly' }]} />
        <p className="small muted">{recurrence === 'daily' ? texts.daily : texts.weekly}</p>
        <div className="actions">
          <button type="button" className="btn secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn" disabled={!name.trim()}>Create</button>
        </div>
      </form>
    </Modal>
  );
};

/** The ⋮ menu of a plan: rename, make active, delete, plus [extra] actions of the screen. */
export const PlanMenu = <P extends PlanLike>({ plan, repo, texts, extra = [], afterDelete }: {
  plan: P; repo: PlanRepository<P>; texts: PlanTexts; extra?: readonly MenuAction[]; afterDelete?: () => void;
}) => {
  const [dialog, setDialog] = useState<'rename' | 'delete' | null>(null);
  return (
    <>
      <ActionMenu actions={[
        { label: 'Rename', onSelect: () => setDialog('rename') },
        { label: plan.isActive ? 'Deactivate' : 'Set as active', onSelect: () => void repo.setPlanActive(plan.id, !plan.isActive) },
        ...extra,
        { label: 'Delete', danger: true, onSelect: () => setDialog('delete') },
      ]} />
      {dialog === 'rename' && (
        <PromptDialog title="Rename" label="Name" initial={plan.name} onClose={() => setDialog(null)}
          onSubmit={(name) => void repo.save({ ...plan, name })} />
      )}
      {dialog === 'delete' && (
        <ConfirmDialog title={`Delete “${plan.name}”?`} message={texts.deleteMessage} onClose={() => setDialog(null)}
          onConfirm={() => void repo.delete(plan.id).then(afterDelete)} />
      )}
    </>
  );
};

/** Every saved plan, each with a switch to follow it or not, a ⋮ to delete it, and a tap to open it. */
export const PlanRows = <P extends PlanLike>({ plans, repo, texts, summary, href, onOpen }: {
  plans: readonly P[]; repo: PlanRepository<P>; texts: PlanTexts; summary: (plan: P) => string; href: (plan: P) => string; onOpen?: () => void;
}) => {
  const [deleting, setDeleting] = useState<P | null>(null);
  return (
    <>
      {plans.map((plan) => (
        <div key={plan.id} className="list-item" style={{ cursor: 'default' }}>
          <Link to={href(plan)} className="grow" style={{ color: 'inherit', textDecoration: 'none' }} onClick={onOpen}>
            <div className="title">{plan.name} {plan.isActive && <span className="badge">Active</span>}</div>
            <div className="small muted">{plan.recurrence === 'daily' ? 'Daily' : 'Weekly'} · {summary(plan)}</div>
          </Link>
          <button className="btn secondary" aria-label={`${plan.isActive ? 'Deactivate' : 'Set as active'} ${plan.name}`}
            onClick={() => void repo.setPlanActive(plan.id, !plan.isActive)}>
            {plan.isActive ? 'Deactivate' : 'Activate'}
          </button>
          <ActionMenu label={`${plan.name} options`} actions={[{ label: 'Delete', danger: true, onSelect: () => setDeleting(plan) }]} />
        </div>
      ))}
      {deleting && (
        <ConfirmDialog title={`Delete “${deleting.name}”?`} message={texts.deleteMessage} onClose={() => setDeleting(null)}
          onConfirm={() => void repo.delete(deleting.id)} />
      )}
    </>
  );
};

/** The "New …" action of a +, and the dialog it opens; a new plan opens right away. */
export const usePlanCreation = <P extends PlanLike>({ repo, texts, icon, create, href }: {
  repo: PlanRepository<P>; texts: PlanTexts; icon: ReactNode; create: (name: string, recurrence: Recurrence) => P; href: (plan: P) => string;
}): [FabAction, ReactNode] => {
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();
  return [
    { label: texts.newLabel, short: 'New', icon, onSelect: () => setCreating(true) },
    creating && (
      <NewPlanDialog texts={texts} onClose={() => setCreating(false)} onCreate={(name, recurrence) => {
        const plan = create(name, recurrence);
        void repo.save(plan).then(() => navigate(href(plan)));
      }} />
    ),
  ];
};

/** The saved plans as a card, or a hint to create one. */
export const PlanList = <P extends PlanLike>({ plans, repo, texts, summary, href }: {
  plans: readonly P[] | undefined; repo: PlanRepository<P>; texts: PlanTexts; summary: (plan: P) => string; href: (plan: P) => string;
}) => {
  if (!plans) return <Loading />;
  if (plans.length === 0) return <Empty>{texts.empty.split('\n').map((line, i) => <div key={i}>{line}</div>)}</Empty>;
  return (
    <section className="card" aria-label="Saved plans">
      <PlanRows plans={plans} repo={repo} texts={texts} summary={summary} href={href} />
    </section>
  );
};

/**
 * The day of a weekly plan being looked at. It lives in the address (?day=3), not in memory, so
 * going to a picker and back, a refresh, or a shared link all stay on the same day.
 */
export const usePlanDay = (days: readonly PlanDay[]): [PlanDay, (day: PlanDay) => void] => {
  const [params, setParams] = useSearchParams();
  const requested = Number(params.get('day'));
  const day = days.find((d) => d === requested) ?? days[0] ?? 0;
  return [day, (next) => setParams({ day: String(next) }, { replace: true })];
};
