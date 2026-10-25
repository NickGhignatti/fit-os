import { useState } from 'react';
import { useContainer, useStream } from '../app/hooks';
import { exportBackup } from '../data/backup';
import { ACTIVITY_FACTOR, PACE_KG_PER_WEEK, ageOn, type ActivityLevel, type GoalPace, type Profile, type Sex } from '../domain/profile';
import { Calendar } from './Calendar';
import { ACTIVITY_LABEL, PACE_LABEL, SEX_LABEL, formatKg, parseNumber, today } from './format';
import { Icons, Loading, Modal, PageHeader, type FabAction } from './kit';
import { LegalLinks } from './Legal';
import { useImportFileAction, useReceiveAction, useShareFile } from './Transfer';

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

const DataSection = () => {
  const { store } = useContainer();
  const share = useShareFile();
  const [importFile, importing] = useImportFileAction();
  const [receive, receiving] = useReceiveAction();
  const tools: FabAction[] = [
    { label: 'Export backup', icon: Icons.download, onSelect: () => void exportBackup(store).then((b) => share(`Tracker backup ${today()}`, JSON.stringify(b))) },
    importFile,
    receive,
  ];

  return (
    <>
      <h2>Your data</h2>
      <section className="card">
        <p className="muted">
          Everything is stored on this device only. Export a backup now and then, in case the browser clears its storage. On
          another phone, import the file, or share it to Tracker, to bring everything there.
        </p>
        <div className="tools">
          {tools.map((t) => (
            <button key={t.label} className="tool" aria-label={t.label} title={t.label} disabled={t.disabled} onClick={t.onSelect}>{t.icon}</button>
          ))}
        </div>
      </section>
      {importing}
      {receiving}
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
