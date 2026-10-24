import { useRef, useState } from 'react';
import { useContainer, useStream } from '../app/hooks';
import { exportBackup, parseBackup, restoreBackup, type Backup } from '../data/backup';
import { ACTIVITY_FACTOR, PACE_KG_PER_WEEK, ageOn, type ActivityLevel, type GoalPace, type Profile, type Sex } from '../domain/profile';
import { Calendar } from './Calendar';
import { ACTIVITY_LABEL, PACE_LABEL, SEX_LABEL, formatKg, parseNumber, today } from './format';
import { useToast } from './hooks';
import { ConfirmDialog, Icons, Loading, Modal, PageHeader, type FabAction } from './kit';
import { LegalLinks } from './Legal';
import { download, useReceiveAction } from './Transfer';

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

const summarize = (b: Backup): string => {
  const d = b.data;
  return `${d.trainingPlans.length} workout plans, ${d.dietPlans.length} diets, ${d.workouts.length} workouts, ${d.foodLogDays.length} food-log days and ${d.weights.length} weigh-ins`;
};

const DataSection = () => {
  const { store } = useContainer();
  const toast = useToast();
  const file = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<Backup | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [receive, receiving] = useReceiveAction();
  const tools: FabAction[] = [
    { label: 'Export backup', icon: Icons.download, onSelect: () => void exportBackup(store).then((b) => download(`tracker-backup-${today()}.json`, JSON.stringify(b))) },
    { label: 'Import backup', icon: Icons.upload, onSelect: () => file.current?.click() },
    receive,
  ];

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
        <div className="tools">
          {tools.map((t) => (
            <button key={t.label} className="tool" aria-label={t.label} title={t.label} disabled={t.disabled} onClick={t.onSelect}>{t.icon}</button>
          ))}
          <input ref={file} type="file" accept="application/json,.json" hidden aria-label="Backup file" onChange={(e) => void onFile(e.target.files?.[0])} />
        </div>
        {problem && <p className="danger-text" role="alert">{problem}</p>}
      </section>
      {receiving}
      {pending && (
        <ConfirmDialog title="Import this backup?" confirmLabel="Import" danger={false} onClose={() => setPending(null)}
          message={`It contains ${summarize(pending)}. Items with the same id are replaced; everything else on this device is kept.`}
          onConfirm={() => void restoreBackup(store, pending).then(() => toast('Backup imported'))} />
      )}
    </>
  );
};

export const ProfileScreen = () => {
  const { repos } = useContainer();
  const date = today();
  const profile = useStream((c) => c.repos.profile.observeProfile());
  const weights = useStream((c) => c.repos.profile.observeWeights());
  const [editing, setEditing] = useState(false);

  if (!profile || !weights) return <Loading />;

  const latest = weights.at(-1);
  const age = ageOn(profile, date);
  const hasDetails = profile.sex !== null || profile.birthDate !== null || profile.heightCm !== null;

  return (
    <>
      <PageHeader title="Profile" />

      <button className="card profile-hero" aria-label={hasDetails ? 'Edit profile' : 'Set up profile'} onClick={() => setEditing(true)}>
        <span className="avatar">{Icons.person}</span>
        <span className="grow">
          <span className="hero-title">{hasDetails ? 'About you' : 'Set up your profile'}</span>
          <span className="hero-line">
            {hasDetails
              ? [profile.sex && SEX_LABEL[profile.sex], age !== null && `${age} years`, profile.heightCm !== null && `${profile.heightCm} cm`, latest && formatKg(latest.kg)].filter(Boolean).join(' · ')
              : 'Tell the app a little about you to get a daily calorie goal.'}
          </span>
          {hasDetails && <span className="hero-line muted">{ACTIVITY_LABEL[profile.activity].title} · {PACE_LABEL[profile.pace]}</span>}
        </span>
        <span className="muted hero-chevron" aria-hidden="true">›</span>
      </button>

      <h2>Calendar</h2>
      <Calendar />

      <DataSection />

      <p className="small muted" style={{ marginTop: 24 }}><LegalLinks />.</p>
      <p className="small muted">
        Basic foods: CREA, Tabelle di composizione degli alimenti. Packaged products: Open Food Facts (ODbL). Exercises and photos: free-exercise-db (public domain).
      </p>

      {editing && <ProfileDialog profile={profile} onClose={() => setEditing(false)} onSave={(p) => void repos.profile.saveProfile(p)} />}
    </>
  );
};
