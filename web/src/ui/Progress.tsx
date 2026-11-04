import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useContainer, useStream } from '../app/hooks';
import { progressCsv } from '../data/progressExport';
import { newId } from '../domain/id';
import {
  METRICS, bestOf, exerciseKey, groupByExercise, newestFirst, oldestFirst, oneRepMax,
  type ExerciseProgress, type Metric, type ProgressEntry,
} from '../domain/progress';
import {
  METRIC_LABEL, describeEntry, formatDuration, formatKg, formatSeconds, impliedOneRepMax, parseDuration, parseNumber, today,
} from './format';
import { useAsync, useToast } from './hooks';
import { ActionMenu, ConfirmDialog, Empty, Fab, Icons, Loading, Modal, PageHeader, useDebounced, type FabAction } from './kit';
import { CSV_FILE, useShareFile } from './Transfer';

/**
 * Progress: measurements of exercises over time (a lift, a rep count, a jump, a hold, a run), each
 * exercise with its trend and its best. Everything can be exported as a CSV file for a spreadsheet.
 */

/** What the dialog starts from: an exercise to add to, or an entry to edit. */
export interface EntryDraft {
  readonly name?: string;
  readonly catalogId?: string | null;
  readonly metric?: Metric;
  readonly edit?: ProgressEntry;
}

/** The exercise box with catalogue suggestions underneath. */
const ExerciseField = ({ name, onChange, onPick, locked }: {
  name: string; onChange: (name: string) => void; onPick: (id: string, name: string) => void; locked: boolean;
}) => {
  const { repos } = useContainer();
  const debounced = useDebounced(name.trim());
  const suggestions = useAsync(
    () => (locked || debounced.length < 2 ? Promise.resolve([]) : repos.exercises.search(debounced, { muscle: null, equipment: null })),
    [debounced, locked],
  );
  return (
    <div className="stack">
      <label className="stack"><span className="small muted">Exercise</span>
        <input className="field" value={name} readOnly={locked} onChange={(e) => onChange(e.target.value)} placeholder="e.g. Back squat, vertical jump, plank" /></label>
      {suggestions.state === 'ready' && suggestions.value.length > 0 && (
        <div className="pills" aria-label="Suggestions">
          {suggestions.value.slice(0, 5).map((e) => (
            <button key={e.id} type="button" className="pill" onClick={() => onPick(e.id, e.name)}>{e.name}</button>
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * The measurement to log, as wrapping pills: six choices do not fit one segmented row on a
 * phone, and a menu would hide them.
 */
const MetricPicker = ({ value, onChange }: { value: Metric; onChange: (metric: Metric) => void }) => (
  <div className="stack">
    <span className="small muted">Measurement</span>
    <div className="pills wrap" role="radiogroup" aria-label="Measurement">
      {METRICS.map((m) => (
        <button key={m} type="button" role="radio" aria-checked={m === value} className={`pill ${m === value ? 'on' : ''}`}
          onClick={() => onChange(m)}>{METRIC_LABEL[m]}</button>
      ))}
    </div>
  </div>
);

/** The text a field starts from when [entry] is edited; empty for any other metric. */
const initialText = (entry: ProgressEntry | undefined, metric: Metric): string => {
  if (entry?.metric !== metric) return '';
  switch (metric) {
    case 'time': return formatDuration(entry.value);
    case 'hold': return String(entry.value);
    case 'distance': return String(entry.value / 1000);
    default: return String(entry.value);
  }
};

export const AddEntryDialog = ({ draft = {}, onClose }: { draft?: EntryDraft; onClose: () => void }) => {
  const { repos } = useContainer();
  const toast = useToast();
  const editing = draft.edit;
  const [name, setName] = useState(editing?.exerciseName ?? draft.name ?? '');
  const [catalogId, setCatalogId] = useState<string | null>(editing?.catalogId ?? draft.catalogId ?? null);
  const [metric, setMetric] = useState<Metric>(editing?.metric ?? draft.metric ?? 'weight');
  const [weight, setWeight] = useState(initialText(editing, 'weight'));
  const [reps, setReps] = useState(editing?.metric === 'weight' ? String(editing.reps) : initialText(editing, 'reps'));
  const [cm, setCm] = useState(initialText(editing, 'length'));
  const [held, setHeld] = useState(initialText(editing, 'hold'));
  const [time, setTime] = useState(initialText(editing, 'time'));
  const [km, setKm] = useState(initialText(editing, 'distance'));
  const [date, setDate] = useState(editing?.date ?? today());
  const [note, setNote] = useState(editing?.note ?? '');
  const locked = Boolean(draft.name) && !editing;

  const n = (text: string) => parseNumber(text);
  /** The value typed for the chosen metric, in its stored unit; null while it is not a valid one. */
  const parsed: { value: number; reps: number | null } | null = (() => {
    switch (metric) {
      case 'weight': {
        const [kg, r] = [n(weight), n(reps || '1')];
        return kg !== null && kg > 0 && r !== null && Number.isInteger(r) && r >= 1 && r <= 1000 ? { value: kg, reps: r } : null;
      }
      case 'reps': {
        const r = n(reps);
        return r !== null && Number.isInteger(r) && r >= 1 && r <= 100_000 ? { value: r, reps: null } : null;
      }
      case 'length': {
        const c = n(cm);
        return c !== null && c > 0 && c <= 10_000 ? { value: c, reps: null } : null;
      }
      case 'hold': {
        const s = parseDuration(held);
        return s !== null ? { value: s, reps: null } : null;
      }
      case 'time': {
        const s = parseDuration(time);
        return s !== null ? { value: s, reps: null } : null;
      }
      case 'distance': {
        const d = n(km);
        return d !== null && d > 0 && d <= 10_000 ? { value: Math.round(d * 1000), reps: null } : null;
      }
    }
  })();
  const valid = name.trim() !== '' && parsed !== null && date !== '';

  const save = async () => {
    if (!valid || !parsed) return;
    const entry: ProgressEntry = {
      id: editing?.id ?? newId(),
      exerciseKey: exerciseKey(name, catalogId),
      exerciseName: name.trim(),
      catalogId,
      metric,
      value: parsed.value,
      reps: parsed.reps,
      date,
      note: note.trim(),
    };
    await repos.progress.save(entry);
    toast(editing ? 'Entry updated' : 'Progress saved');
    onClose();
  };

  const field = (label: string, value: string, set: (v: string) => void, props: { placeholder?: string; mode?: 'decimal' | 'numeric' | 'text' } = {}) => (
    <label className="stack grow"><span className="small muted">{label}</span>
      <input className="field" inputMode={props.mode ?? 'decimal'} value={value} placeholder={props.placeholder} onChange={(e) => set(e.target.value)} /></label>
  );

  return (
    <Modal title={editing ? 'Edit entry' : 'Log progress'} onClose={onClose}>
      <form className="stack" onSubmit={(e) => { e.preventDefault(); void save(); }}>
        <ExerciseField name={name} locked={locked} onChange={(v) => { setName(v); setCatalogId(null); }} onPick={(id, picked) => { setName(picked); setCatalogId(id); }} />
        {!editing && <MetricPicker value={metric} onChange={setMetric} />}
        {metric === 'weight' && <div className="row">{field('Weight (kg)', weight, setWeight)}{field('Reps', reps, setReps, { placeholder: '1', mode: 'numeric' })}</div>}
        {metric === 'reps' && field('Reps in one go', reps, setReps, { mode: 'numeric' })}
        {metric === 'length' && field('Height or length (cm)', cm, setCm, { placeholder: 'e.g. 62, or 320 for a reach' })}
        {metric === 'hold' && field('Time held', held, setHeld, { placeholder: 'seconds, or m:ss', mode: 'text' })}
        {metric === 'time' && field('Time', time, setTime, { placeholder: 'mm:ss or h:mm:ss', mode: 'text' })}
        {metric === 'distance' && field('Distance (km)', km, setKm)}
        <label className="stack"><span className="small muted">Date</span>
          <input type="date" className="field" value={date} max={today()} onChange={(e) => setDate(e.target.value)} /></label>
        {field('Note (optional)', note, setNote, { mode: 'text' })}
        {metric === 'weight' && parsed && parsed.reps !== null && parsed.reps > 1 && (
          <p className="small muted" role="status">Estimated one-rep max: {formatKg(oneRepMax(parsed.value, parsed.reps))}</p>
        )}
        {metric === 'hold' && parsed && <p className="small muted" role="status">{formatSeconds(parsed.value)} held</p>}
        <div className="actions">
          <button type="button" className="btn secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn" disabled={!valid}>Save</button>
        </div>
      </form>
    </Modal>
  );
};

/** A value over time as a line. Lifts are charted by the one-rep max they imply. */
const TrendChart = ({ entries, metric }: { entries: readonly ProgressEntry[]; metric: Metric }) => {
  const points = oldestFirst(entries).map((e) => ({
    id: e.id, date: e.date, y: metric === 'weight' ? oneRepMax(e.value, e.reps ?? 1) : e.value,
  }));
  if (points.length < 2) return null;
  const [w, h, pad] = [320, 120, 12];
  const [lo, hi] = [Math.min(...points.map((p) => p.y)), Math.max(...points.map((p) => p.y))];
  const [t0, t1] = [Date.parse(points[0]!.date), Date.parse(points.at(-1)!.date)];
  const x = (date: string) => pad + ((t1 === t0 ? 0.5 : (Date.parse(date) - t0) / (t1 - t0)) * (w - 2 * pad));
  const y = (v: number) => h - pad - (hi === lo ? 0.5 : (v - lo) / (hi - lo)) * (h - 2 * pad);
  return (
    <svg className="chart" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`${METRIC_LABEL[metric]} trend over ${points.length} entries`}>
      <polyline points={points.map((p) => `${x(p.date).toFixed(1)},${y(p.y).toFixed(1)}`).join(' ')} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p) => <circle key={p.id} cx={x(p.date)} cy={y(p.y)} r="3.5" fill="var(--accent)"><title>{p.date}</title></circle>)}
    </svg>
  );
};

const EntryRow = ({ entry, isBest, onEdit, onDelete }: { entry: ProgressEntry; isBest: boolean; onEdit: () => void; onDelete: () => void }) => (
  <div className="list-item" style={{ cursor: 'default' }}>
    <div className="grow">
      <div className="title">{describeEntry(entry)} {isBest && <span className="badge">Best</span>}</div>
      <div className="small muted">
        {[entry.date, impliedOneRepMax(entry), entry.note].filter(Boolean).join(' · ')}
      </div>
    </div>
    <ActionMenu label={`Options for ${describeEntry(entry)} on ${entry.date}`} actions={[
      { label: 'Edit', onSelect: onEdit },
      { label: 'Delete', danger: true, onSelect: onDelete },
    ]} />
  </div>
);

/** All entries of one exercise, grouped by what was measured. */
const MetricSections = ({ entries }: { entries: readonly ProgressEntry[] }) => {
  const { repos } = useContainer();
  const [editing, setEditing] = useState<ProgressEntry | null>(null);
  const [deleting, setDeleting] = useState<ProgressEntry | null>(null);
  return (
    <>
      {METRICS.filter((m) => entries.some((e) => e.metric === m)).map((metric) => {
        const ofMetric = newestFirst(entries.filter((e) => e.metric === metric));
        const best = bestOf(entries, metric)!;
        return (
          <section key={metric} className="card" aria-label={METRIC_LABEL[metric]}>
            <div className="small muted">{METRIC_LABEL[metric]} · best</div>
            <div className="big-number">{describeEntry(best)}</div>
            <div className="small muted">{[best.date, impliedOneRepMax(best)].filter(Boolean).join(' · ')}</div>
            <TrendChart entries={ofMetric} metric={metric} />
            {ofMetric.map((e) => (
              <EntryRow key={e.id} entry={e} isBest={e.id === best.id} onEdit={() => setEditing(e)} onDelete={() => setDeleting(e)} />
            ))}
          </section>
        );
      })}
      {editing && <AddEntryDialog draft={{ edit: editing }} onClose={() => setEditing(null)} />}
      {deleting && (
        <ConfirmDialog title="Delete entry?" message={`${describeEntry(deleting)} on ${deleting.date} will be removed.`} onClose={() => setDeleting(null)}
          onConfirm={() => void repos.progress.delete(deleting.id)} />
      )}
    </>
  );
};

/** The FAB action that hands [entries] out as a CSV file named after [title]. */
const useExportAction = (title: string, entries: readonly ProgressEntry[]): FabAction => {
  const share = useShareFile();
  return {
    label: 'Export as CSV', short: 'Export', icon: Icons.download, disabled: entries.length === 0,
    onSelect: () => void share(title, progressCsv(entries), CSV_FILE),
  };
};

/** The "Progress" tab of Workouts: every exercise with something logged, with its bests. */
export const ProgressTab = () => {
  const entries = useStream((c) => c.repos.progress.observeAll());
  const [adding, setAdding] = useState(false);
  const exportAll = useExportAction(`Progress ${today()}`, entries ?? []);
  if (!entries) return <Loading />;
  const groups = groupByExercise(entries);
  return (
    <>
      {groups.length === 0 ? (
        <Empty>Nothing tracked yet.<br />Log lifts, jumps, holds and runs to see how you improve.</Empty>
      ) : (
        <section className="card" aria-label="Progress">
          {groups.map((g: ExerciseProgress) => (
            <Link key={g.exerciseKey} to={`/progress/${encodeURIComponent(g.exerciseKey)}`} className="list-item">
              <span className="grow">
                <span className="title">{g.exerciseName}</span>
                <br />
                <span className="small muted">{g.bests.map((b) => `${METRIC_LABEL[b.metric]}: ${describeEntry(b)}`).join(' · ')}</span>
              </span>
              <span className="muted">›</span>
            </Link>
          ))}
        </section>
      )}
      <Fab label="Progress actions" actions={[{ label: 'Log progress', short: 'Log', icon: Icons.record, onSelect: () => setAdding(true) }, exportAll]} />
      {adding && <AddEntryDialog onClose={() => setAdding(false)} />}
    </>
  );
};

/** One exercise: a card per measurement with its best, its trend and every entry. */
export const ProgressScreen = () => {
  const { key = '' } = useParams();
  const navigate = useNavigate();
  const [adding, setAdding] = useState(false);
  const entries = useStream((c) => c.repos.progress.observeFor(key), [key]);
  const latest = entries?.[0];
  const exportThis = useExportAction(`${latest?.exerciseName ?? 'Exercise'} progress ${today()}`, entries ?? []);
  if (!entries) return <Loading />;
  if (!latest) {
    return <><PageHeader back title="Progress" /><Empty>Nothing logged for this exercise.<br /><button className="link" onClick={() => navigate('/workouts?tab=progress', { replace: true })}>Back to progress</button></Empty></>;
  }
  return (
    <>
      <PageHeader back title={latest.exerciseName} subtitle="Progress" />
      {latest.catalogId && <p><Link to={`/exercises/${encodeURIComponent(latest.catalogId)}`}>How to do this exercise</Link></p>}
      <MetricSections entries={entries} />
      <Fab label="Progress actions" actions={[{ label: 'Log progress', short: 'Log', icon: Icons.record, onSelect: () => setAdding(true) }, exportThis]} />
      {adding && <AddEntryDialog draft={{ name: latest.exerciseName, catalogId: latest.catalogId }} onClose={() => setAdding(false)} />}
    </>
  );
};

/** Shown on an exercise's page: its bests, and a way to log more. */
export const ExerciseProgressSection = ({ name, catalogId }: { name: string; catalogId: string }) => {
  const entries = useStream((c) => c.repos.progress.observeFor(catalogId), [catalogId]);
  const [adding, setAdding] = useState(false);
  if (!entries) return null;
  const bests = METRICS.flatMap((m) => bestOf(entries, m) ?? []);
  return (
    <>
      <h2>Progress</h2>
      <section className="card" aria-label="Progress">
        {bests.length === 0 && <p className="muted">Nothing logged yet for this exercise.</p>}
        {bests.map((b) => (
          <div key={b.id} className="row between" style={{ margin: '6px 0' }}>
            <span className="muted">{METRIC_LABEL[b.metric]}</span>
            <span><span className="title">{describeEntry(b)}</span> <span className="small muted">{b.date}</span></span>
          </div>
        ))}
        <div className="row" style={{ marginTop: 8 }}>
          <button className="btn secondary" onClick={() => setAdding(true)}>Log progress</button>
          {entries.length > 0 && <Link to={`/progress/${encodeURIComponent(catalogId)}`}>History</Link>}
        </div>
      </section>
      {adding && <AddEntryDialog draft={{ name, catalogId }} onClose={() => setAdding(false)} />}
    </>
  );
};

/** "New best!" after completing a set that beats the best logged so far. */
export const NewBestPrompt = ({ entry, onClose }: { entry: ProgressEntry; onClose: () => void }) => {
  const { repos } = useContainer();
  const toast = useToast();
  return (
    <div className="card" role="status" style={{ background: 'var(--accent-container)', borderColor: 'transparent' }}>
      <div className="title">New best!</div>
      <div>{entry.exerciseName}: {describeEntry(entry)}{impliedOneRepMax(entry) ? ` (${impliedOneRepMax(entry)})` : ''}</div>
      <div className="actions" style={{ justifyContent: 'flex-start' }}>
        <button className="btn done" onClick={() => void repos.progress.save(entry).then(() => { toast('Saved to progress'); onClose(); })}>Save to progress</button>
        <button className="btn secondary" onClick={onClose}>Not now</button>
      </div>
    </div>
  );
};
