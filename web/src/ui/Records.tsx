import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useContainer, useStream } from '../app/hooks';
import { newId } from '../domain/id';
import {
  METRICS, bestOf, exerciseKey, groupByExercise, newestFirst, oldestFirst, oneRepMax,
  type ExerciseRecords, type PersonalRecord, type PrMetric,
} from '../domain/records';
import { METRIC_LABEL, describeRecord, formatDuration, formatKg, impliedOneRepMax, parseDuration, parseNumber, today } from './format';
import { useAsync, useToast } from './hooks';
import { ActionMenu, ConfirmDialog, Empty, Fab, Icons, Loading, Modal, PageHeader, Segmented, useDebounced } from './kit';

/** What the dialog starts from: an exercise to add to, or a record to edit. */
export interface RecordDraft {
  readonly name?: string;
  readonly catalogId?: string | null;
  readonly metric?: PrMetric;
  readonly edit?: PersonalRecord;
}

const METRIC_OPTIONS = METRICS.map((m) => ({ value: m, label: METRIC_LABEL[m] }));

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
        <input className="field" value={name} readOnly={locked} onChange={(e) => onChange(e.target.value)} placeholder="e.g. Back squat, 5 km run" /></label>
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

export const AddRecordDialog = ({ draft = {}, onClose }: { draft?: RecordDraft; onClose: () => void }) => {
  const { repos } = useContainer();
  const toast = useToast();
  const editing = draft.edit;
  const [name, setName] = useState(editing?.exerciseName ?? draft.name ?? '');
  const [catalogId, setCatalogId] = useState<string | null>(editing?.catalogId ?? draft.catalogId ?? null);
  const [metric, setMetric] = useState<PrMetric>(editing?.metric ?? draft.metric ?? 'weight');
  const [weight, setWeight] = useState(editing?.metric === 'weight' ? String(editing.value) : '');
  const [reps, setReps] = useState(editing ? String(editing.metric === 'weight' ? editing.reps : editing.metric === 'reps' ? editing.value : '') : '');
  const [time, setTime] = useState(editing?.metric === 'time' ? formatDuration(editing.value) : '');
  const [km, setKm] = useState(editing?.metric === 'distance' ? String(editing.value / 1000) : '');
  const [date, setDate] = useState(editing?.date ?? today());
  const [note, setNote] = useState(editing?.note ?? '');
  const locked = Boolean(draft.name) && !editing;

  const n = (text: string) => parseNumber(text);
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
    const record: PersonalRecord = {
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
    await repos.records.save(record);
    toast(editing ? 'Record updated' : 'Record saved');
    onClose();
  };

  const field = (label: string, value: string, set: (v: string) => void, props: { placeholder?: string; mode?: 'decimal' | 'numeric' | 'text' } = {}) => (
    <label className="stack grow"><span className="small muted">{label}</span>
      <input className="field" inputMode={props.mode ?? 'decimal'} value={value} placeholder={props.placeholder} onChange={(e) => set(e.target.value)} /></label>
  );

  return (
    <Modal title={editing ? 'Edit record' : 'Add personal record'} onClose={onClose}>
      <form className="stack" onSubmit={(e) => { e.preventDefault(); void save(); }}>
        <ExerciseField name={name} locked={locked} onChange={(v) => { setName(v); setCatalogId(null); }} onPick={(id, picked) => { setName(picked); setCatalogId(id); }} />
        {!editing && <Segmented<PrMetric> label="Measurement" value={metric} onChange={setMetric} options={METRIC_OPTIONS} />}
        {metric === 'weight' && <div className="row">{field('Weight (kg)', weight, setWeight)}{field('Reps', reps, setReps, { placeholder: '1', mode: 'numeric' })}</div>}
        {metric === 'reps' && field('Reps in one go', reps, setReps, { mode: 'numeric' })}
        {metric === 'time' && field('Time', time, setTime, { placeholder: 'mm:ss or h:mm:ss', mode: 'text' })}
        {metric === 'distance' && field('Distance (km)', km, setKm)}
        <label className="stack"><span className="small muted">Date</span>
          <input type="date" className="field" value={date} max={today()} onChange={(e) => setDate(e.target.value)} /></label>
        {field('Note (optional)', note, setNote, { mode: 'text' })}
        {metric === 'weight' && parsed && parsed.reps !== null && parsed.reps > 1 && (
          <p className="small muted" role="status">Estimated one-rep max: {formatKg(oneRepMax(parsed.value, parsed.reps))}</p>
        )}
        <div className="actions">
          <button type="button" className="btn secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn" disabled={!valid}>Save</button>
        </div>
      </form>
    </Modal>
  );
};

/** A value over time as a line. Weight records are charted by the one-rep max they imply. */
const TrendChart = ({ records, metric }: { records: readonly PersonalRecord[]; metric: PrMetric }) => {
  const points = oldestFirst(records).map((r) => ({
    id: r.id, date: r.date, y: metric === 'weight' ? oneRepMax(r.value, r.reps ?? 1) : r.value,
  }));
  if (points.length < 2) return null;
  const [w, h, pad] = [320, 120, 12];
  const [lo, hi] = [Math.min(...points.map((p) => p.y)), Math.max(...points.map((p) => p.y))];
  const [t0, t1] = [Date.parse(points[0]!.date), Date.parse(points.at(-1)!.date)];
  const x = (date: string) => pad + ((t1 === t0 ? 0.5 : (Date.parse(date) - t0) / (t1 - t0)) * (w - 2 * pad));
  const y = (v: number) => h - pad - (hi === lo ? 0.5 : (v - lo) / (hi - lo)) * (h - 2 * pad);
  return (
    <svg className="chart" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`${METRIC_LABEL[metric]} trend over ${points.length} records`}>
      <polyline points={points.map((p) => `${x(p.date).toFixed(1)},${y(p.y).toFixed(1)}`).join(' ')} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p) => <circle key={p.id} cx={x(p.date)} cy={y(p.y)} r="3.5" fill="var(--accent)"><title>{p.date}</title></circle>)}
    </svg>
  );
};

const RecordRow = ({ record, isBest, onEdit, onDelete }: { record: PersonalRecord; isBest: boolean; onEdit: () => void; onDelete: () => void }) => (
  <div className="list-item" style={{ cursor: 'default' }}>
    <div className="grow">
      <div className="title">{describeRecord(record)} {isBest && <span className="badge">PR</span>}</div>
      <div className="small muted">
        {[record.date, impliedOneRepMax(record), record.note].filter(Boolean).join(' · ')}
      </div>
    </div>
    <ActionMenu label={`Options for ${describeRecord(record)} on ${record.date}`} actions={[
      { label: 'Edit', onSelect: onEdit },
      { label: 'Delete', danger: true, onSelect: onDelete },
    ]} />
  </div>
);

/** All records of one exercise, grouped by what was measured. */
const MetricSections = ({ records }: { records: readonly PersonalRecord[] }) => {
  const { repos } = useContainer();
  const [editing, setEditing] = useState<PersonalRecord | null>(null);
  const [deleting, setDeleting] = useState<PersonalRecord | null>(null);
  return (
    <>
      {METRICS.filter((m) => records.some((r) => r.metric === m)).map((metric) => {
        const ofMetric = newestFirst(records.filter((r) => r.metric === metric));
        const best = bestOf(records, metric)!;
        return (
          <section key={metric} className="card" aria-label={METRIC_LABEL[metric]}>
            <div className="small muted">{METRIC_LABEL[metric]} · personal best</div>
            <div className="big-number">{describeRecord(best)}</div>
            <div className="small muted">{[best.date, impliedOneRepMax(best)].filter(Boolean).join(' · ')}</div>
            <TrendChart records={ofMetric} metric={metric} />
            {ofMetric.map((r) => (
              <RecordRow key={r.id} record={r} isBest={r.id === best.id} onEdit={() => setEditing(r)} onDelete={() => setDeleting(r)} />
            ))}
          </section>
        );
      })}
      {editing && <AddRecordDialog draft={{ edit: editing }} onClose={() => setEditing(null)} />}
      {deleting && (
        <ConfirmDialog title="Delete record?" message={`${describeRecord(deleting)} on ${deleting.date} will be removed.`} onClose={() => setDeleting(null)}
          onConfirm={() => void repos.records.delete(deleting.id)} />
      )}
    </>
  );
};

/** The "Records" tab of Workouts: every exercise that has a record, with its best. */
export const RecordsTab = () => {
  const records = useStream((c) => c.repos.records.observeAll());
  const [adding, setAdding] = useState(false);
  if (!records) return <Loading />;
  const groups = groupByExercise(records);
  return (
    <>
      {groups.length === 0 ? (
        <Empty>No personal records yet.<br />Add your best lifts, runs and rep counts to track progress.</Empty>
      ) : (
        <section className="card" aria-label="Personal records">
          {groups.map((g: ExerciseRecords) => (
            <Link key={g.exerciseKey} to={`/records/${encodeURIComponent(g.exerciseKey)}`} className="list-item">
              <span className="grow">
                <span className="title">{g.exerciseName}</span>
                <br />
                <span className="small muted">{g.bests.map((b) => `${METRIC_LABEL[b.metric]}: ${describeRecord(b)}`).join(' · ')}</span>
              </span>
              <span className="muted">›</span>
            </Link>
          ))}
        </section>
      )}
      <Fab label="Add" actions={[{ label: 'Add record', icon: Icons.record, onSelect: () => setAdding(true) }]} />
      {adding && <AddRecordDialog onClose={() => setAdding(false)} />}
    </>
  );
};

export const RecordsScreen = () => {
  const { key = '' } = useParams();
  const navigate = useNavigate();
  const [adding, setAdding] = useState(false);
  const records = useStream((c) => c.repos.records.observeFor(key), [key]);
  if (!records) return <Loading />;
  const latest = records[0];
  if (!latest) {
    return <><PageHeader back title="Records" /><Empty>No records for this exercise.<br /><button className="link" onClick={() => navigate('/workouts?tab=records', { replace: true })}>Back to records</button></Empty></>;
  }
  return (
    <>
      <PageHeader back title={latest.exerciseName} subtitle="Personal records" />
      {latest.catalogId && <p><Link to={`/exercises/${encodeURIComponent(latest.catalogId)}`}>How to do this exercise</Link></p>}
      <MetricSections records={records} />
      <Fab label="Add" actions={[{ label: 'Add record', icon: Icons.record, onSelect: () => setAdding(true) }]} />
      {adding && <AddRecordDialog draft={{ name: latest.exerciseName, catalogId: latest.catalogId }} onClose={() => setAdding(false)} />}
    </>
  );
};

/** Shown on an exercise's page: its bests, and a way to add one. */
export const ExerciseRecordsSection = ({ name, catalogId }: { name: string; catalogId: string }) => {
  const records = useStream((c) => c.repos.records.observeFor(catalogId), [catalogId]);
  const [adding, setAdding] = useState(false);
  if (!records) return null;
  const bests = METRICS.flatMap((m) => bestOf(records, m) ?? []);
  return (
    <>
      <h2>Personal records</h2>
      <section className="card" aria-label="Personal records">
        {bests.length === 0 && <p className="muted">No record yet for this exercise.</p>}
        {bests.map((b) => (
          <div key={b.id} className="row between" style={{ margin: '6px 0' }}>
            <span className="muted">{METRIC_LABEL[b.metric]}</span>
            <span><span className="title">{describeRecord(b)}</span> <span className="small muted">{b.date}</span></span>
          </div>
        ))}
        <div className="row" style={{ marginTop: 8 }}>
          <button className="btn secondary" onClick={() => setAdding(true)}>Add record</button>
          {records.length > 0 && <Link to={`/records/${encodeURIComponent(catalogId)}`}>History</Link>}
        </div>
      </section>
      {adding && <AddRecordDialog draft={{ name, catalogId }} onClose={() => setAdding(false)} />}
    </>
  );
};

/** "New personal best!" after completing a set that beats a stored record. */
export const PrPrompt = ({ record, onClose }: { record: PersonalRecord; onClose: () => void }) => {
  const { repos } = useContainer();
  const toast = useToast();
  return (
    <div className="card" role="status" style={{ background: 'var(--accent-container)', borderColor: 'transparent' }}>
      <div className="title">New personal best!</div>
      <div>{record.exerciseName}: {describeRecord(record)}{impliedOneRepMax(record) ? ` (${impliedOneRepMax(record)})` : ''}</div>
      <div className="actions" style={{ justifyContent: 'flex-start' }}>
        <button className="btn done" onClick={() => void repos.records.save(record).then(() => { toast('Personal record saved'); onClose(); })}>Save as PR</button>
        <button className="btn secondary" onClick={onClose}>Not now</button>
      </div>
    </div>
  );
};
