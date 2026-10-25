import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useContainer } from '../app/hooks';
import { exportBackup, restoreBackup, type Backup } from '../data/backup';
import { LinkTooLargeError, codeFromText, startLink, takeLink, type StartedLink } from '../transfer/deviceLink';
import { GoogleButton, SignInDialog, useAuth } from './Account';
import { useToast } from './hooks';
import { Loading, Modal, PageHeader } from './kit';
import { ScannerDialog } from './Scanner';
import { QrImage } from './Transfer';

const time = (d: Date) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const counts = ({ data: d }: Backup): string =>
  `${d.trainingPlans.length} workout plans, ${d.dietPlans.length} diets, ${d.workouts.length} workouts, ${d.foodLogDays.length} food-log days and ${d.weights.length} weigh-ins`;

type Sending = { status: 'idle' } | { status: 'sending'; sent: number; parts: number } | { status: 'ready'; link: StartedLink } | { status: 'failed'; message: string };

/**
 * On the device that has the data: encrypts everything, parks it on the server for the same
 * account, and shows the QR the new device scans.
 */
export const AddDeviceDialog = ({ handle, onClose }: { handle: string; onClose: () => void }) => {
  const { community, store } = useContainer();
  const [state, setState] = useState<Sending>({ status: 'idle' });

  const start = async () => {
    if (!community) return;
    setState({ status: 'sending', sent: 0, parts: 1 });
    try {
      const backup = await exportBackup(store);
      const link = await startLink(community.devices, backup, window.location.origin, {
        onProgress: (sent, parts) => setState({ status: 'sending', sent, parts }),
      });
      setState({ status: 'ready', link });
    } catch (error) {
      setState({
        status: 'failed',
        message: error instanceof LinkTooLargeError
          ? 'There is too much data to send this way. Use Export backup and import the file on the new device.'
          : 'Could not upload. Check your connection and try again.',
      });
    }
  };

  return (
    <Modal title="Add a device" onClose={onClose}>
      {state.status === 'ready' ? (
        <>
          <ol className="steps">
            <li>On the new device, open Tracker and sign in with Google as <strong>@{handle}</strong>.</li>
            <li>Go to Profile → <strong>Get data from another device</strong> and scan this code. Or scan it with the camera app.</li>
          </ol>
          <QrImage text={state.link.url} />
          <div className="code" aria-label="Device code">{state.link.code}</div>
          <p className="small muted" style={{ textAlign: 'center' }}>
            Valid until {time(state.link.expiresAt)}, once. Only your account can fetch it, and only this code can read it.
          </p>
          <div className="actions"><button className="btn" onClick={onClose}>Done</button></div>
        </>
      ) : (
        <>
          <p className="muted">
            Copies everything on this device (plans, workouts, food log, weight and profile) to another device where you sign in
            as @{handle}. It is encrypted here first; the server cannot read it and deletes it once it is taken, or after 30 minutes.
          </p>
          {state.status === 'failed' && <p className="danger-text" role="alert">{state.message}</p>}
          <div className="actions">
            <button className="btn secondary" onClick={onClose}>Cancel</button>
            <button className="btn" disabled={state.status === 'sending'} onClick={() => void start()}>
              {state.status === 'sending' ? (state.parts > 1 ? `Uploading ${state.sent} of ${state.parts}…` : 'Uploading…') : 'Create code'}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
};

/** The code survives the trip to Google and back in this tab's storage. */
const PENDING = 'tracker-link-code';

const readPending = (): string | null => {
  try {
    return sessionStorage.getItem(PENDING);
  } catch {
    return null;
  }
};

const writePending = (code: string | null) => {
  try {
    if (code) sessionStorage.setItem(PENDING, code);
    else sessionStorage.removeItem(PENDING);
  } catch {
    // Private mode: the code is typed again after signing in.
  }
};

const PROBLEMS = {
  invalid_code: "That doesn't look like a code. It has 10 letters and digits, like K7QM2-X9RTA.",
  not_found: 'Nothing found. Sign in with the same Google account on both devices, and create a new code if this one is older than 30 minutes or was already used.',
  unreadable: "The data couldn't be read. Update the app on both devices and try again.",
  offline: 'Could not reach the server. Check your connection.',
} as const;

/** What the box shows for a scanned QR or a pasted link: just the code. */
const codePart = (text: string) => (text.includes('#') ? decodeURIComponent(text.slice(text.lastIndexOf('#') + 1)) : text);

/**
 * "Get data from another device", and where the QR of Add a device leads (/link#CODE): signs in
 * if needed, fetches, decrypts and merges everything into this device.
 */
export const LinkScreen = () => {
  const { community, store } = useContainer();
  const auth = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const { hash } = useLocation();
  const [text, setText] = useState(() => (hash.length > 1 ? codePart(hash) : readPending() ?? ''));
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [dialog, setDialog] = useState<'signIn' | 'scan' | null>(null);
  const tried = useRef(false);

  const receive = async (input: string) => {
    if (!community) return;
    setBusy(true);
    setProblem(null);
    try {
      const result = await takeLink(community.devices, input);
      if (result.status !== 'ok') return setProblem(PROBLEMS[result.status]);
      writePending(null);
      await restoreBackup(store, result.backup);
      toast(`Brought ${counts(result.backup)}`);
      navigate('/', { replace: true });
    } catch {
      setProblem(PROBLEMS.offline);
    } finally {
      setBusy(false);
    }
  };

  // Arriving from the QR, or back from Google, with a code: fetch at once.
  const signedIn = auth?.status === 'signedIn';
  useEffect(() => {
    if (!signedIn || tried.current || !codeFromText(text)) return;
    tried.current = true;
    void receive(text);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn]);

  if (!community) return <><PageHeader back title="Get your data" /><p className="muted">Accounts aren't available in this build.</p></>;
  if (!auth || auth.status === 'loading') return <Loading />;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void receive(text);
  };

  return (
    <>
      <PageHeader back title="Get your data" subtitle="From another device" />
      <section className="card">
        <p className="muted">
          On the device that has your data, open Profile → <strong>Add a device</strong>, then scan its code here. Everything is
          added to what this device already has.
        </p>
        {auth.status === 'signedIn' ? (
          <form className="stack" onSubmit={submit}>
            <p className="small muted">Signed in as @{auth.account.handle}. Use the same account on both devices.</p>
            <input className="field" value={text} placeholder="K7QM2-X9RTA" autoCapitalize="characters" autoComplete="off"
              aria-label="Device code" onChange={(e) => setText(e.target.value)} />
            {problem && <p className="danger-text" role="alert">{problem}</p>}
            <div className="actions">
              <button type="button" className="btn secondary" onClick={() => setDialog('scan')}>Scan QR</button>
              <button type="submit" className="btn" disabled={busy || text.trim() === ''}>{busy ? 'Getting your data…' : 'Get data'}</button>
            </div>
          </form>
        ) : (
          <div className="stack">
            <p className="small muted">First sign in with the Google account you use on your other device.</p>
            <GoogleButton onClick={() => setDialog('signIn')} />
          </div>
        )}
      </section>
      {dialog === 'signIn' && (
        <SignInDialog returnTo="/link" onClose={() => setDialog(null)} onLeave={() => writePending(codeFromText(text) ? text : null)} />
      )}
      {dialog === 'scan' && (
        <ScannerDialog title="Scan the code" onClose={() => setDialog(null)} onResult={(scanned) => {
          setDialog(null);
          setText(codePart(scanned));
          void receive(scanned);
        }} />
      )}
    </>
  );
};
