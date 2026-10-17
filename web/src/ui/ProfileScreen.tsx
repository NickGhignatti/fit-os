import { useRef, useState } from 'react';
import { useContainer, useStream } from '../app/hooks';
import { exportBackup, parseBackup, restoreBackup, type Backup } from '../data/backup';
import { ACTIVITY_FACTOR, PACE_KG_PER_WEEK, ageOn, type ActivityLevel, type GoalPace, type Profile, type Sex, type WeightEntry } from '../domain/profile';
import { observeDailyTargets } from '../domain/useCases';
import { AccountSection } from './Account';
import { Calendar } from './Calendar';
import { ACTIVITY_LABEL, PACE_LABEL, SEX_LABEL, formatKcal, formatKg, parseNumber, today } from './format';
import { useToast } from './hooks';
import { ConfirmDialog, Loading, MacroChips, Modal, PageHeader, PromptDialog } from './kit';
import { TargetsDialog } from './TargetsDialog';
import { LegalLinks } from './Legal';
import { ReceiveButton } from './Transfer';

const ProfileDialog = ({ profile, onSave, onClose }: { profile: Profile; onSave: (p: Profile) => void; onClose: () => void }) => {
  const [sex, setSex] = useState<Sex | ''>(profile.sex ?? '');
  const [birthDate, setBirthDate] = useState(profile.birthDate ?? '');
  const [height, setHeight] = useState(profile.heightCm === null ? '' : String(profile.heightCm));
  const [activity, setActivity] = useState<ActivityLevel>(profile.activity);
  const [pace, setPace] = useState<GoalPace>(profile.pace);
  const h = parseNumber(height);
  const valid = (height.trim() === '' || (h !== null && h >= 50 && h <= 260));

  return (
    <Modal title="Edit profile" onClose={onClose}>
      <form className="stack" onSubmit={(e) => {
        e.preventDefault();
        if (!valid) return;
        onSave({ ...profile, sex: sex || null, birthDate: birthDate || null, heightCm: height.trim() === '' ? null : h, activity, pace });
        onClose();
      }}>
        <label className="stack"><span className="small muted">Sex</span>
          <select className="field" value={sex} onChange={(e) => setSex(e.target.value as Sex | '')}>
            <option value="">Not set</option>
            {(Object.keys(SEX_LABEL) as Sex[]).map((s) => <option key={s} value={s}>{SEX_LABEL[s]}</option>)}
          </select></label>
        <label className="stack"><span className="small muted">Birth date</span>
          <input type="date" className="field" value={birthDate} max={today()} onChange={(e) => setBirthDate(e.target.value)} /></label>
        <label className="stack"><span className="small muted">Height (cm)</span>
          <input className="field" inputMode="decimal" value={height} onChange={(e) => setHeight(e.target.value)} /></label>
        <label className="stack"><span className="small muted">Activity</span>
          <select className="field" value={activity} onChange={(e) => setActivity(e.target.value as ActivityLevel)}>
            {(Object.keys(ACTIVITY_FACTOR) as ActivityLevel[]).map((a) => <option key={a} value={a}>{ACTIVITY_LABEL[a].title} — {ACTIVITY_LABEL[a].description}</option>)}
          </select></label>
        <label className="stack"><span className="small muted">Goal</span>
          <select className="field" value={pace} onChange={(e) => setPace(e.target.value as GoalPace)}>
            {(Object.keys(PACE_KG_PER_WEEK) as GoalPace[]).map((p) => <option key={p} value={p}>{PACE_LABEL[p]}</option>)}
          </select></label>
        <div className="actions">
          <button type="button" className="btn secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn" disabled={!valid}>Save</button>
        </div>
      </form>
    </Modal>
  );
};

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

const download = (name: string, text: string) => {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const summarize = (b: Backup): string => {
  const d = b.data;
  return `${d.trainingPlans.length} workout plans, ${d.dietPlans.length} diets, ${d.workouts.length} workouts, ${d.foodLogDays.length} food-log days and ${d.weights.length} weigh-ins`;
};

const DataSection = () => {
  const { db } = useContainer();
  const toast = useToast();
  const file = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<Backup | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const onFile = async (selected: File | undefined) => {
    if (!selected) return;
    setProblem(null);
    const parsed = parseBackup(await selected.text());
    if (parsed.ok) setPending(parsed.backup);
    else setProblem(`That file can't be imported (${parsed.error}).`);
    if (file.current) file.current.value = '';
  };

  return (
    <>
      <h2>Your data</h2>
      <section className="card">
        <p className="muted">Everything is stored on this device only. Save a backup file now and then, in case the browser clears its storage.</p>
        <div className="stack">
          <button className="btn secondary" onClick={() => void exportBackup(db).then((b) => download(`tracker-backup-${today()}.json`, JSON.stringify(b)))}>
            Export backup
          </button>
          <button className="btn secondary" onClick={() => file.current?.click()}>Import backup</button>
          <input ref={file} type="file" accept="application/json,.json" hidden aria-label="Backup file" onChange={(e) => void onFile(e.target.files?.[0])} />
          <ReceiveButton />
        </div>
        {problem && <p className="danger-text" role="alert">{problem}</p>}
      </section>
      {pending && (
        <ConfirmDialog title="Import this backup?" confirmLabel="Import" danger={false} onClose={() => setPending(null)}
          message={`It contains ${summarize(pending)}. Items with the same id are replaced; everything else on this device is kept.`}
          onConfirm={() => void restoreBackup(db, pending).then(() => toast('Backup imported'))} />
      )}
    </>
  );
};

export const ProfileScreen = () => {
  const { repos } = useContainer();
  const toast = useToast();
  const date = today();
  const profile = useStream((c) => c.repos.profile.observeProfile());
  const weights = useStream((c) => c.repos.profile.observeWeights());
  const targets = useStream((c) => observeDailyTargets(c.repos.profile, date), [date]);
  const [dialog, setDialog] = useState<'profile' | 'weight' | 'targets' | null>(null);

  if (!profile || !weights || targets === undefined) return <Loading />;

  const latest = weights.at(-1);
  const first = weights[0];
  const age = ageOn(profile, date);
  const missing = [
    profile.sex === null && 'sex', age === null && 'birth date', profile.heightCm === null && 'height', !latest && 'a weigh-in',
  ].filter(Boolean) as string[];
  const hasDetails = profile.sex !== null || profile.birthDate !== null || profile.heightCm !== null;

  return (
    <>
      <PageHeader title="Profile" />

      <AccountSection />

      <h2>About you</h2>
      <section className="card">
        {hasDetails ? (
          <p>{[profile.sex && SEX_LABEL[profile.sex], age !== null && `${age} years`, profile.heightCm !== null && `${profile.heightCm} cm`].filter(Boolean).join(' · ')}</p>
        ) : (
          <p className="muted">Tell the app a little about you to get a daily calorie goal.</p>
        )}
        <button className="btn secondary" onClick={() => setDialog('profile')}>{hasDetails ? 'Edit profile' : 'Set up profile'}</button>
      </section>

      <h2>Daily goal</h2>
      <section className="card" aria-label="Daily goal">
        {targets ? (
          <>
            <div className="big-number">{formatKcal(targets.nutrients.kcal)}</div>
            <MacroChips n={targets.nutrients} />
            <p className="small muted">
              {targets.isCustom
                ? 'Includes your own numbers. Anything you did not set is worked out from your profile.'
                : 'From your profile and latest weight (Mifflin–St Jeor). Protein 1.8 g per kg, fat 25% of calories, carbs for the rest.'}
            </p>
          </>
        ) : (
          <p className="muted">To work out your goal the app still needs: {missing.join(', ') || 'a few details'}. Or set your own targets.</p>
        )}
        <button className="btn secondary" style={{ marginTop: 8 }} onClick={() => setDialog('targets')}>Customize targets</button>
      </section>

      <h2>Weight</h2>
      <section className="card" aria-label="Weight">
        {latest ? (
          <>
            <div className="big-number">{formatKg(latest.kg)}</div>
            {first && first.id !== latest.id && (
              <p className="small muted">{`${latest.kg - first.kg >= 0 ? '+' : '−'}${formatKg(Math.abs(latest.kg - first.kg))} since ${first.date}`}</p>
            )}
            <WeightChart entries={weights} />
          </>
        ) : (
          <p className="muted">No weigh-ins yet. Log your weight to see its trend and get a daily goal.</p>
        )}
        <button className="btn" style={{ marginTop: 8 }} onClick={() => setDialog('weight')}>Log weight</button>
      </section>

      <h2>Calendar</h2>
      <Calendar />

      <DataSection />

      <p className="small muted" style={{ marginTop: 24 }}><LegalLinks />.</p>
      <p className="small muted">
        Basic foods: CREA, Tabelle di composizione degli alimenti. Packaged products: Open Food Facts (ODbL). Exercises and photos: free-exercise-db (public domain).
      </p>

      {dialog === 'profile' && <ProfileDialog profile={profile} onClose={() => setDialog(null)} onSave={(p) => void repos.profile.saveProfile(p)} />}
      {dialog === 'targets' && <TargetsDialog onClose={() => setDialog(null)} />}
      {dialog === 'weight' && (
        <PromptDialog title="Weight" label="Weight (kg)" inputMode="decimal" initial={latest ? String(latest.kg) : ''} onClose={() => setDialog(null)}
          validate={(v) => { const n = parseNumber(v); return n !== null && n >= 20 && n <= 500; }}
          onSubmit={(v) => void repos.profile.setWeight(date, parseNumber(v)!).then(() => toast(`Logged ${formatKg(parseNumber(v)!)}`))} />
      )}
    </>
  );
};
