import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useContainer } from '../app/hooks';
import type { PlanKind, PublicPlan, PublicPlanSummary } from '../community/ports';
import { mealNutrients, mealsOnDay, type DietPlan } from '../domain/diet';
import { copyDietPlan, copyTrainingPlan } from '../domain/copy';
import { daysOf } from '../domain/plan';
import { dietPlanSchema, trainingPlanSchema } from '../domain/schemas';
import { sessionOnDay, type TrainingPlan } from '../domain/trainingPlan';
import { SignInDialog, useAuth } from './Account';
import { dayName, formatKcal, setSummary } from './format';
import { useAsync, useToast } from './hooks';
import { Empty, Loading, Modal, PageHeader, PromptDialog, Segmented, useDebounced } from './kit';
import { LegalLinks } from './Legal';

const KINDS = [{ value: 'training', label: 'Workouts' }, { value: 'diet', label: 'Diets' }] as const;

const authorOf = (p: PublicPlanSummary) => (p.authorName ? `${p.authorName} (@${p.authorHandle})` : `@${p.authorHandle}`);
const dateOf = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

export const CommunityScreen = () => {
  const { community } = useContainer();
  const [kind, setKind] = useState<PlanKind>('training');
  const [search, setSearch] = useState('');
  const debounced = useDebounced(search.trim());
  const [items, setItems] = useState<readonly PublicPlanSummary[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [more, setMore] = useState(false);

  // A new kind or search starts again from the newest plan.
  useEffect(() => {
    if (!community) return;
    let current = true;
    setState('loading');
    community.plans.list({ kind, search: debounced }).then(
      (page) => { if (current) { setItems(page); setMore(page.length >= 20); setState('ready'); } },
      () => { if (current) setState('failed'); },
    );
    return () => { current = false; };
  }, [community, kind, debounced]);

  const loadMore = async () => {
    const last = items.at(-1);
    if (!community || !last) return;
    const page = await community.plans.list({ kind, search: debounced, before: last.createdAt });
    setItems((all) => [...all, ...page]);
    setMore(page.length >= 20);
  };

  if (!community) return <><PageHeader back title="Community" /><Empty>The community isn't available in this build.</Empty></>;

  return (
    <>
      <PageHeader back title="Community" subtitle="Plans shared by other people" />
      <Segmented<PlanKind> label="Kind" value={kind} onChange={setKind} options={KINDS} />
      <input className="field" type="search" value={search} placeholder="Search by title" aria-label="Search plans" onChange={(e) => setSearch(e.target.value)} />
      <p className="small muted" style={{ marginTop: 8 }}>
        Plans are made by users and not checked by professionals. See the <Link to="/terms">Terms</Link>.
      </p>
      {state === 'loading' && <Loading />}
      {state === 'failed' && <Empty>Could not load the community. Check your connection and try again.</Empty>}
      {state === 'ready' && items.length === 0 && <Empty>{debounced ? 'No plans match.' : 'Nothing published yet. Be the first!'}</Empty>}
      {state === 'ready' && items.length > 0 && (
        <section className="card">
          {items.map((p) => (
            <Link key={p.id} to={`/community/${p.id}`} className="list-item">
              <span className="grow">
                <span className="title">{p.title}</span>
                <br />
                <span className="small muted">{authorOf(p)} · {dateOf(p.createdAt)}</span>
                {p.description && <><br /><span className="small">{p.description}</span></>}
              </span>
              <span className="muted">›</span>
            </Link>
          ))}
        </section>
      )}
      {more && <button className="btn secondary" onClick={() => void loadMore()}>Load more</button>}
    </>
  );
};

const TrainingPreview = ({ plan }: { plan: TrainingPlan }) => (
  <>
    {daysOf(plan.recurrence).map((day) => {
      const session = sessionOnDay(plan, day);
      if (session.length === 0) return null;
      return (
        <section key={day} className="card" aria-label={dayName(day)}>
          {plan.recurrence === 'weekly' && <div className="title">{dayName(day)}</div>}
          {session.map((e) => (
            <div key={e.id} className="list-item" style={{ cursor: 'default' }}>
              <span className="grow"><span className="title">{e.name}</span><br /><span className="small muted">{setSummary(e.sets)}</span></span>
            </div>
          ))}
        </section>
      );
    })}
  </>
);

const DietPreview = ({ plan }: { plan: DietPlan }) => (
  <>
    {daysOf(plan.recurrence).map((day) => {
      const meals = mealsOnDay(plan, day);
      if (meals.length === 0) return null;
      return (
        <section key={day} className="card" aria-label={dayName(day)}>
          {plan.recurrence === 'weekly' && <div className="title">{dayName(day)}</div>}
          {meals.map((m) => {
            const n = mealNutrients(m);
            return (
              <div key={m.id} style={{ margin: '8px 0' }}>
                <div className="title">{m.name} {n && <span className="muted">· {formatKcal(n.kcal)}</span>}</div>
                <div className="small muted">{m.foods.map((f) => f.name).join(', ') || 'No foods listed'}</div>
              </div>
            );
          })}
        </section>
      );
    })}
  </>
);

type Parsed = { kind: 'training'; plan: TrainingPlan } | { kind: 'diet'; plan: DietPlan } | null;

/** Content from the community is untrusted: it must be a valid plan before it is shown or copied. */
const parse = (plan: PublicPlan): Parsed => {
  if (plan.kind === 'training') {
    const r = trainingPlanSchema.safeParse(plan.payload);
    return r.success ? { kind: 'training', plan: r.data } : null;
  }
  const r = dietPlanSchema.safeParse(plan.payload);
  return r.success ? { kind: 'diet', plan: r.data } : null;
};

export const CommunityPlanScreen = () => {
  const { id = '' } = useParams();
  const { community, repos } = useContainer();
  const navigate = useNavigate();
  const toast = useToast();
  const auth = useAuth();
  const [dialog, setDialog] = useState<'report' | 'signIn' | null>(null);
  const result = useAsync(() => (community ? community.plans.get(id) : Promise.resolve(null)), [id, community]);

  if (!community) return <><PageHeader back title="Community" /><Empty>The community isn't available in this build.</Empty></>;
  if (result.state === 'loading') return <Loading />;
  if (result.state === 'failed') return <><PageHeader back title="Plan" /><Empty>Could not load this plan. Check your connection.</Empty></>;
  const plan = result.value;
  if (!plan) return <><PageHeader back title="Plan" /><Empty>This plan is no longer available.</Empty></>;
  const parsed = parse(plan);

  const copy = async () => {
    if (!parsed) return;
    if (parsed.kind === 'training') {
      const copyOf = copyTrainingPlan(parsed.plan);
      await repos.trainingPlans.save(copyOf);
      toast(`Copied “${copyOf.name}” to your workouts`);
      navigate(`/workouts/plan/${copyOf.id}`);
    } else {
      const copyOf = copyDietPlan(parsed.plan);
      await repos.dietPlans.save(copyOf);
      toast(`Copied “${copyOf.name}” to your diets`);
      navigate(`/food/plan/${copyOf.id}`);
    }
  };

  const report = async (reason: string) => {
    const outcome = await community.plans.report(plan.id, reason);
    if (outcome === 'signedOut') return setDialog('signIn');
    toast(outcome === 'ok' ? 'Thanks, we will review it.' : outcome === 'already' ? 'You already reported this plan.' : 'Could not send the report. Try again.');
  };

  return (
    <>
      <PageHeader back title={plan.title} subtitle={`${authorOf(plan)} · ${dateOf(plan.createdAt)}`} />
      {plan.hidden && <p className="chip carbs" role="status">Hidden for review: only you can see this</p>}
      {plan.description && <p>{plan.description}</p>}
      {parsed ? (
        parsed.kind === 'training' ? <TrainingPreview plan={parsed.plan} /> : <DietPreview plan={parsed.plan} />
      ) : (
        <Empty>This plan's content is not in a format the app can read.</Empty>
      )}
      <div className="stack">
        <button className="btn" disabled={!parsed} onClick={() => void copy()}>Copy to my {plan.kind === 'training' ? 'workouts' : 'diets'}</button>
        {!plan.mine && (
          <button className="btn secondary" onClick={() => (auth?.status === 'signedIn' ? setDialog('report') : setDialog('signIn'))}>Report this plan</button>
        )}
      </div>
      <p className="small muted">Made by another user, not by professionals. Not medical advice. <LegalLinks />.</p>
      {dialog === 'report' && (
        <PromptDialog title="Report this plan" label="What is wrong with it?" confirmLabel="Send report" onClose={() => setDialog(null)}
          validate={(v) => v.trim().length >= 3} hint="Tell us briefly: for example spam, dangerous advice, or someone's personal information."
          onSubmit={(reason) => void report(reason.slice(0, 500))} />
      )}
      {dialog === 'signIn' && <SignInDialog onClose={() => setDialog(null)} />}
    </>
  );
};

/** "Publish to community" for a plan the user owns. Hidden in builds without accounts. */
export const PublishButton = ({ kind, plan }: { kind: PlanKind; plan: TrainingPlan | DietPlan }) => {
  const { community } = useContainer();
  const toast = useToast();
  const auth = useAuth();
  const [dialog, setDialog] = useState<'publish' | 'signIn' | null>(null);
  const [title, setTitle] = useState(plan.name);
  const [description, setDescription] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!community) return null;

  const publish = async () => {
    setBusy(true);
    setProblem(null);
    const result = await community.plans.publish({ kind, title: title.trim(), description: description.trim(), payload: { ...plan, isActive: false } });
    setBusy(false);
    if (result.status === 'ok') {
      toast('Published to the community');
      setDialog(null);
    } else {
      setProblem(
        result.status === 'limit' ? 'You have 30 published plans already. Unpublish one first.'
        : result.status === 'tooFast' ? 'You are publishing too fast. Try again in a while.'
        : result.status === 'signedOut' ? 'Your session ended. Sign in again.'
        : 'Could not publish. Check your connection and try again.',
      );
    }
  };

  return (
    <>
      <button className="menu-item" onClick={() => setDialog(auth?.status === 'signedIn' ? 'publish' : 'signIn')}>Publish to community</button>
      {dialog === 'signIn' && <SignInDialog onClose={() => setDialog(null)} />}
      {dialog === 'publish' && (
        <Modal title="Publish to community" onClose={() => setDialog(null)}>
          <p className="muted">
            Anyone can read and copy this {kind === 'training' ? 'workout' : 'diet'}, with your handle next to it.
            Do not include personal information.
          </p>
          <form className="stack" onSubmit={(e) => { e.preventDefault(); if (title.trim() && agreed) void publish(); }}>
            <label className="stack"><span className="small muted">Title</span>
              <input className="field" value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} /></label>
            <label className="stack"><span className="small muted">Description (optional)</span>
              <textarea className="field" rows={3} value={description} maxLength={500} onChange={(e) => setDescription(e.target.value)} /></label>
            <label className="row" style={{ alignItems: 'flex-start' }}>
              <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} style={{ marginTop: 4 }} />
              <span className="small">I have the right to share this and it follows the <LegalLinks />.</span>
            </label>
            {problem && <p className="danger-text" role="alert">{problem}</p>}
            <div className="actions">
              <button type="button" className="btn secondary" onClick={() => setDialog(null)}>Cancel</button>
              <button type="submit" className="btn" disabled={!title.trim() || !agreed || busy}>{busy ? 'Publishing…' : 'Publish'}</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
};
