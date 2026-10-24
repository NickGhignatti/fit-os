import { useState, type FormEvent } from 'react';
import { useContainer, useStream } from '../app/hooks';
import {
  BODY_MEASURES, type BodyComposition, type BodyMeasure, type BodyMeasureInfo, type WeightEntry, type WidgetSize, type WidgetSlot,
} from '../domain/profile';
import { formatKg, formatWeight, parseNumber } from './format';
import { useToast } from './hooks';
import { Icons, Modal } from './kit';
import { WidgetBoard, type WidgetKind } from './Widgets';

type Metric = 'weight' | BodyMeasure;

interface MetricInfo {
  readonly key: Metric;
  readonly label: string;
  readonly unit: BodyMeasureInfo['unit'];
}

/** Weight first, then every measure a body-composition scale adds. */
export const METRICS: readonly MetricInfo[] = [{ key: 'weight', label: 'Weight', unit: 'kg' }, ...BODY_MEASURES];

const valueText = (m: MetricInfo, value: number) => `${formatWeight(value)}${m.unit === '%' ? '%' : m.unit ? ` ${m.unit}` : ''}`;

interface Point { readonly id: string; readonly date: string; readonly value: number }

const pointsOf = (entries: readonly WeightEntry[], key: Metric): Point[] =>
  entries.flatMap((e) => {
    const value = key === 'weight' ? e.kg : e.body?.[key];
    return value === undefined ? [] : [{ id: e.id, date: e.date, value }];
  });

/** A measure over time as a line. Text alternatives carry the same numbers for screen readers. */
const MetricChart = ({ metric, points, height }: { metric: MetricInfo; points: readonly Point[]; height: number }) => {
  if (points.length < 2) return null;
  const [w, h, pad] = [320, height, 10];
  const values = points.map((p) => p.value);
  const [lo, hi] = [Math.min(...values), Math.max(...values)];
  const span = hi - lo || 1;
  const t0 = Date.parse(points[0]!.date);
  const t1 = Date.parse(points.at(-1)!.date);
  const x = (date: string) => pad + ((t1 === t0 ? 0.5 : (Date.parse(date) - t0) / (t1 - t0)) * (w - 2 * pad));
  const y = (v: number) => h - pad - ((v - lo) / span) * (h - 2 * pad);
  const line = points.map((p) => `${x(p.date).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  return (
    <svg className="chart" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" role="img"
      aria-label={`${metric.label} trend, from ${valueText(metric, points[0]!.value)} to ${valueText(metric, points.at(-1)!.value)} over ${points.length} readings`}>
      <polyline points={line} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      {points.map((p) => (
        <circle key={p.id} cx={x(p.date)} cy={y(p.value)} r="3.5" fill="var(--accent)"><title>{`${p.date}: ${valueText(metric, p.value)}`}</title></circle>
      ))}
    </svg>
  );
};

/** One measure: its latest reading, the change since the first, and the trend; smaller when half-width. */
export const MetricCard = ({ metric, entries, size }: { metric: MetricInfo; entries: readonly WeightEntry[]; size: WidgetSize }) => {
  const points = pointsOf(entries, metric.key);
  const latest = points.at(-1);
  const first = points[0];
  const change = latest && first && first.id !== latest.id ? latest.value - first.value : null;
  return (
    <section className={`card metric ${size}`} aria-label={metric.label}>
      <div className="metric-label">{metric.label}</div>
      {latest ? (
        <>
          <div className="metric-value">{valueText(metric, latest.value)}</div>
          {change !== null && (
            <div className="small muted">{`${change >= 0 ? '+' : '−'}${valueText(metric, Math.abs(change))}`}{size === 'full' ? ` since ${first!.date}` : ''}</div>
          )}
          <MetricChart metric={metric} points={points} height={size === 'full' ? 120 : 70} />
        </>
      ) : (
        <p className="small muted">{metric.key === 'weight' ? 'No weigh-ins yet. Log one with the +.' : 'No readings yet. Add one under “More measurements” when you log your weight.'}</p>
      )}
    </section>
  );
};

/** Every measure as a widget, for any board that offers them. */
export const metricWidgets = (entries: readonly WeightEntry[]): WidgetKind[] =>
  METRICS.map((m) => ({
    id: m.key,
    title: m.label,
    description: m.key === 'weight' ? 'Your weight and its trend' : `${m.label} from your scale, over time`,
    sizes: m.key === 'weight' ? ['full', 'half'] : ['half', 'full'],
    render: (size) => <MetricCard metric={m} entries={entries} size={size} />,
  }));

const DEFAULT_BODY: readonly WidgetSlot[] = [{ id: 'weight', size: 'full' }, { id: 'fatPct', size: 'half' }, { id: 'muscleKg', size: 'half' }];

/** The body charts on Diet: weight and scale readings as widgets the user picks and sizes. */
export const BodyBoard = () => {
  const { repos } = useContainer();
  const weights = useStream((c) => c.repos.profile.observeWeights());
  const profile = useStream((c) => c.repos.profile.observeProfile());
  if (!weights || !profile) return null;
  return (
    <WidgetBoard label="Body" kinds={metricWidgets(weights)} slots={profile.layout?.body ?? DEFAULT_BODY}
      onChange={(body) => void repos.profile.saveProfile({ ...profile, layout: { ...profile.layout, body } })} />
  );
};

/**
 * Logs a weigh-in for [date]. Shared by every + that offers it. Weight is all it needs; the arrow
 * opens the rest a body-composition scale reports (fat, lean and muscle mass, …), each optional.
 */
export const WeightDialog = ({ date, onClose }: { date: string; onClose: () => void }) => {
  const { repos } = useContainer();
  const toast = useToast();
  const [kg, setKg] = useState('');
  const [more, setMore] = useState(false);
  const [measures, setMeasures] = useState<Record<string, string>>({});
  const weight = parseNumber(kg);
  const parsed = BODY_MEASURES.map((m) => ({ m, text: measures[m.key] ?? '', value: parseNumber(measures[m.key] ?? '') }));
  const wrong = parsed.filter((p) => p.text.trim() !== '' && (p.value === null || p.value < p.m.min || p.value > p.m.max));
  const valid = weight !== null && weight >= 20 && weight <= 500 && wrong.length === 0;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    const body: BodyComposition = Object.fromEntries(parsed.filter((p) => p.value !== null).map((p) => [p.m.key, p.value]));
    const extra = Object.keys(body).length;
    void repos.profile.setWeight(date, weight, body)
      .then(() => toast(`Logged ${formatKg(weight)}${extra > 0 ? ` and ${extra} more ${extra === 1 ? 'measure' : 'measures'}` : ''}`));
    onClose();
  };
  return (
    <Modal title="Weight" onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <label className="stack"><span className="small muted">Weight (kg)</span>
          <input className="field" inputMode="decimal" autoFocus value={kg} onChange={(e) => setKg(e.target.value)} /></label>
        <button type="button" className={`more-toggle ${more ? 'open' : ''}`} aria-expanded={more} onClick={() => setMore(!more)}>
          <span className="grow">More measurements</span>
          <span className="small muted">Body fat, lean mass, muscle…</span>
          {Icons.chevron}
        </button>
        {more && (
          <div className="measure-grid">
            {parsed.map(({ m, text }) => (
              <label key={m.key} className={`measure ${wrong.some((w) => w.m.key === m.key) ? 'wrong' : ''}`}>
                <span className="small muted">{m.label}{m.unit ? ` (${m.unit})` : ''}</span>
                <input className="field" inputMode="decimal" value={text} placeholder={`${m.min}–${m.max}`}
                  onChange={(e) => setMeasures({ ...measures, [m.key]: e.target.value })} />
              </label>
            ))}
          </div>
        )}
        <div className="actions">
          <button type="button" className="btn secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn" disabled={!valid}>Save</button>
        </div>
      </form>
    </Modal>
  );
};
