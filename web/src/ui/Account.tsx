import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useContainer, useStream } from '../app/hooks';
import type { Account, AuthState, ProfileEdit, PublicPlanSummary } from '../community/ports';
import type { Stream } from '../domain/repositories';
import { useAsync, useToast } from './hooks';
import { ConfirmDialog, Modal } from './kit';
import { LegalLinks, MIN_AGE } from './Legal';

const signedOut: Stream<AuthState> = {
  subscribe(next) {
    next({ status: 'signedOut' });
    return () => undefined;
  },
};

/** The sign-in state; undefined only before the app has asked. Builds without accounts are "signed out". */
export const useAuth = (): AuthState | undefined => useStream((c) => c.community?.auth.observe() ?? signedOut);

const GoogleMark = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
    <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z" />
    <path fill="#FBBC05" d="M10.5 28.7c-.5-1.5-.8-3-.8-4.7s.3-3.2.8-4.7l-7.9-6.1C.9 16.4 0 20.1 0 24s.9 7.6 2.6 10.8l7.9-6.1z" />
    <path fill="#34A853" d="M24 48c6.3 0 11.8-2.1 15.7-5.7l-7.5-5.8c-2.1 1.4-4.8 2.3-8.2 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
  </svg>
);

/** Asks for explicit agreement before sending the user to Google. */
export const SignInDialog = ({ onClose }: { onClose: () => void }) => {
  const { community } = useContainer();
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const auth = useAuth();

  // Once signed in there is nothing left to ask.
  useEffect(() => {
    if (auth?.status === 'signedIn') onClose();
  }, [auth?.status, onClose]);

  const go = async () => {
    if (!community || !agreed) return;
    setBusy(true);
    setFailed(false);
    try {
      await community.auth.signInWithGoogle(); // leaves the page for Google
    } catch {
      setFailed(true);
      setBusy(false);
    }
  };

  return (
    <Modal title="Sign in" onClose={onClose}>
      <p className="muted">
        An account lets you publish your plans to the community. You do not need one to use the app or to copy plans.
        Your workouts, food and weight stay on your device either way.
      </p>
      <p className="small muted">
        Google tells us who you are; other people only ever see a handle that you choose. We never show your Google
        name, email or photo.
      </p>
      <label className="row" style={{ alignItems: 'flex-start', margin: '12px 0' }}>
        <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} style={{ marginTop: 4 }} />
        <span className="small">I am at least {MIN_AGE} years old and agree to the <LegalLinks />.</span>
      </label>
      {failed && <p className="danger-text" role="alert">Could not start sign-in. Check your connection and try again.</p>}
      <div className="actions">
        <button className="btn secondary" onClick={onClose}>Cancel</button>
        <button className="btn google" disabled={!agreed || busy} onClick={() => void go()}>
          <GoogleMark /> Sign in with Google
        </button>
      </div>
    </Modal>
  );
};

const PROFILE_MESSAGES: Record<Exclude<ProfileEdit['status'], 'ok'>, string> = {
  taken: 'That handle is already taken.',
  invalid: 'Use 3 to 24 lowercase letters, digits or underscores for the handle, and at most 40 characters for the name.',
  failed: 'Could not save. Check your connection and try again.',
};

const ProfileDialog = ({ account, onClose }: { account: Account; onClose: () => void }) => {
  const { community } = useContainer();
  const toast = useToast();
  const [handle, setHandle] = useState(account.handle);
  const [name, setName] = useState(account.displayName);
  const [problem, setProblem] = useState<string | null>(null);

  const save = async () => {
    const result = await community!.auth.updateProfile(handle.trim().toLowerCase(), name);
    if (result.status === 'ok') {
      toast('Public profile saved');
      onClose();
    } else {
      setProblem(PROFILE_MESSAGES[result.status]);
    }
  };

  return (
    <Modal title="Public profile" onClose={onClose}>
      <p className="small muted">This is all other people see: it appears next to the plans you publish.</p>
      <form className="stack" onSubmit={(e) => { e.preventDefault(); void save(); }}>
        <label className="stack"><span className="small muted">Handle</span>
          <input className="field" value={handle} autoCapitalize="none" autoComplete="off" onChange={(e) => setHandle(e.target.value)} /></label>
        <label className="stack"><span className="small muted">Display name (optional)</span>
          <input className="field" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} /></label>
        {problem && <p className="danger-text" role="alert">{problem}</p>}
        <div className="actions">
          <button type="button" className="btn secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn" disabled={handle.trim() === ''}>Save</button>
        </div>
      </form>
    </Modal>
  );
};

const MyPlansDialog = ({ onClose }: { onClose: () => void }) => {
  const { community } = useContainer();
  const [version, setVersion] = useState(0);
  const result = useAsync(() => community!.plans.mine(), [version]);
  const remove = async (plan: PublicPlanSummary) => {
    await community!.plans.unpublish(plan.id);
    setVersion((v) => v + 1);
  };
  return (
    <Modal title="My published plans" onClose={onClose}>
      {result.state === 'loading' && <p className="muted" role="status">Loading…</p>}
      {result.state === 'failed' && <p className="danger-text">Could not load your plans.</p>}
      {result.state === 'ready' && result.value.length === 0 && <p className="muted">You have not published anything yet. Open a plan and choose “Publish to community”.</p>}
      {result.state === 'ready' && result.value.map((plan) => (
        <div key={plan.id} className="list-item" style={{ cursor: 'default' }}>
          <Link to={`/community/${plan.id}`} className="grow" style={{ color: 'inherit', textDecoration: 'none' }} onClick={onClose}>
            <div className="title">{plan.title} {plan.hidden && <span className="chip carbs">Hidden for review</span>}</div>
            <div className="small muted">{plan.kind === 'training' ? 'Workout' : 'Diet'}</div>
          </Link>
          <button className="btn secondary" aria-label={`Unpublish ${plan.title}`} onClick={() => void remove(plan)}>Unpublish</button>
        </div>
      ))}
      <div className="actions"><button className="btn" onClick={onClose}>Close</button></div>
    </Modal>
  );
};

/** The account card on the Profile screen. Hidden in builds without accounts. */
export const AccountSection = () => {
  const { community } = useContainer();
  const toast = useToast();
  const auth = useAuth();
  const [dialog, setDialog] = useState<'signIn' | 'profile' | 'plans' | 'delete' | null>(null);
  if (!community || !auth) return null;

  return (
    <>
      <h2>Account</h2>
      <section className="card" aria-label="Account">
        {auth.status === 'loading' && <p className="muted" role="status">Checking sign-in…</p>}
        {auth.status === 'signedOut' && (
          <>
            <p className="muted">Sign in to publish your plans to the community. Not needed to use the app or to copy plans.</p>
            <div className="stack">
              <button className="btn google" onClick={() => setDialog('signIn')}><GoogleMark /> Sign in with Google</button>
              <Link className="btn secondary" style={{ textAlign: 'center', textDecoration: 'none' }} to="/community">Browse community plans</Link>
            </div>
          </>
        )}
        {auth.status === 'signedIn' && (
          <>
            <div className="title">@{auth.account.handle}</div>
            {auth.account.displayName && <div className="muted">{auth.account.displayName}</div>}
            <div className="stack" style={{ marginTop: 12 }}>
              <button className="btn secondary" onClick={() => setDialog('profile')}>Edit public profile</button>
              <button className="btn secondary" onClick={() => setDialog('plans')}>My published plans</button>
              <Link className="btn secondary" style={{ textAlign: 'center', textDecoration: 'none' }} to="/community">Browse community plans</Link>
              <button className="btn secondary" onClick={() => void community.auth.signOut()}>Sign out</button>
              <button className="btn danger" onClick={() => setDialog('delete')}>Delete account</button>
            </div>
          </>
        )}
      </section>
      <p className="small muted"><LegalLinks />.</p>

      {dialog === 'signIn' && <SignInDialog onClose={() => setDialog(null)} />}
      {dialog === 'profile' && auth.status === 'signedIn' && <ProfileDialog account={auth.account} onClose={() => setDialog(null)} />}
      {dialog === 'plans' && <MyPlansDialog onClose={() => setDialog(null)} />}
      {dialog === 'delete' && (
        <ConfirmDialog
          title="Delete your account?"
          message="This permanently removes your account, your public profile, the plans you published and the reports you sent. Your workouts, food and weight on this device are not touched. This cannot be undone."
          confirmLabel="Delete account"
          onClose={() => setDialog(null)}
          onConfirm={() => void community.auth.deleteAccount().then((r) => toast(r === 'ok' ? 'Account deleted' : 'Could not delete the account. Try again.'))}
        />
      )}
    </>
  );
};
