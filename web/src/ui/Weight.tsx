import { useContainer, useStream } from '../app/hooks';
import type { WeightEntry } from '../domain/profile';
import { formatKg, parseNumber } from './format';
import { useToast } from './hooks';
import { PromptDialog } from './kit';

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
          <WeightChart entries={weights} />
        </>
      ) : (
        <p className="muted">No weigh-ins yet. Log one with the + to see its trend.</p>
      )}
    </section>
  );
};

/** Logs a weigh-in for [date]. Shared by every + that offers it. */
export const WeightDialog = ({ date, onClose }: { date: string; onClose: () => void }) => {
  const { repos } = useContainer();
  const toast = useToast();
  return (
    <PromptDialog title="Weight" label="Weight (kg)" inputMode="decimal" confirmLabel="Save" onClose={onClose}
      validate={(v) => { const n = parseNumber(v); return n !== null && n >= 20 && n <= 500; }}
      onSubmit={(v) => void repos.profile.setWeight(date, parseNumber(v)!).then(() => toast(`Logged ${formatKg(parseNumber(v)!)}`))} />
  );
};
