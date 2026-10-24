import { useState, type FormEvent } from 'react';
import { useContainer, useStream } from '../app/hooks';
import { BODY_MEASURES, type BodyComposition, type BodyMeasureInfo, type WeightEntry } from '../domain/profile';
import { formatKg, formatWeight, parseNumber } from './format';
import { useToast } from './hooks';
import { Icons, Modal } from './kit';

const measureText = (m: BodyMeasureInfo, value: number) => `${formatWeight(value)}${m.unit === '%' ? '%' : m.unit ? ` ${m.unit}` : ''}`;

/** Weight over time as a line. Text alternatives carry the same numbers for screen readers. */
export const WeightChart = ({ entries }: { entries: readonly WeightEntry[] }) => {
  if (entries.length < 2) return null;
  const [w, h, pad] = [320, 140, 12];
  const kgs = entries.map((e) => e.kg);
  const [lo, hi] = [Math.min(...kgs), Math.max(...kgs)];
  const span = hi - lo || 1;
  const t0 = Date.parse(entries[0]!.date);
  const t1 = Date.parse(entries.at(-1)!.date);
  const x = (date: string) => pad + ((t1 === t0 ? 0.5 : (Date.parse(date) - t0) / (t1 - t0)) * (w - 2 * pad));
  const y = (kg: number) => h - pad - ((kg - lo) / span) * (h - 2 * pad);
  const points = entries.map((e) => `${x(e.date).toFixed(1)},${y(e.kg).toFixed(1)}`).join(' ');
  return (
    <svg className="chart" viewBox={`0 0 ${w} ${h}`} role="img"
      aria-label={`Weight trend, from ${formatKg(entries[0]!.kg)} to ${formatKg(entries.at(-1)!.kg)} over ${entries.length} weigh-ins`}>
      <polyline points={points} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {entries.map((e) => <circle key={e.id} cx={x(e.date)} cy={y(e.kg)} r="3.5" fill="var(--accent)"><title>{`${e.date}: ${formatKg(e.kg)}`}</title></circle>)}
    </svg>
  );
};

/** The latest weigh-in, the change since the first one, and the trend. */
export const WeightCard = () => {
  const weights = useStream((c) => c.repos.profile.observeWeights());
  if (!weights) return null;
  const latest = weights.at(-1);
  const first = weights[0];
  return (
    <section className="card" aria-label="Weight">
      {latest ? (
        <>
          <div className="row between">
            <div className="big-number">{formatKg(latest.kg)}</div>
            {first && first.id !== latest.id && (
              <span className="small muted">{`${latest.kg - first.kg >= 0 ? '+' : '−'}${formatKg(Math.abs(latest.kg - first.kg))} since ${first.date}`}</span>
            )}
          </div>
          {latest.body && Object.keys(latest.body).length > 0 && (
            <div className="body-stats">
              {BODY_MEASURES.filter((m) => latest.body?.[m.key] !== undefined).map((m) => (
                <div key={m.key} className="body-stat"><b>{measureText(m, latest.body![m.key]!)}</b><span>{m.label}</span></div>
              ))}
            </div>
          )}
          <WeightChart entries={weights} />
        </>
      ) : (
        <p className="muted">No weigh-ins yet. Log one with the + to see its trend.</p>
      )}
    </section>
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
