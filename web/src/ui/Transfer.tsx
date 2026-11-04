import QRCode from 'qrcode';
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useContainer } from '../app/hooks';
import { restoreBackup, type Backup } from '../data/backup';
import { readFileContents } from '../data/importFile';
import { importEnvelope } from '../data/importItem';
import { normalizeCode } from '../transfer/code';
import { envelopeFile, receiveTransfer, sendTransfer, type SentTransfer, type TransferKind } from '../transfer/transfer';
import type { DietPlan } from '../domain/diet';
import type { TrainingPlan } from '../domain/trainingPlan';
import { PublishDialog } from './Community';
import { useToast } from './hooks';
import { ConfirmDialog, Empty, Icons, Modal, PageHeader, type FabAction } from './kit';
import { ScannerDialog } from './Scanner';

const LIFETIMES = [
  { minutes: 60, label: '1 hour' },
  { minutes: 360, label: '6 hours' },
  { minutes: 1440, label: '24 hours' },
] as const;

const KIND_LABEL: Record<TransferKind, string> = {
  training_plan: 'workout plan', diet_plan: 'diet', workout: 'workout', food_log_day: 'food log',
};

export const QrImage = ({ text, alt = 'QR code of the code below' }: { text: string; alt?: string }) => {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    let current = true;
    QRCode.toDataURL(text, { margin: 1, width: 240, errorCorrectionLevel: 'M' }).then((u) => current && setUrl(u), () => undefined);
    return () => {
      current = false;
    };
  }, [text]);
  return url ? <img src={url} width={240} height={240} alt={alt} style={{ display: 'block', margin: '0 auto' }} /> : null;
};

const SendDialog = ({ kind, data, onClose }: { kind: TransferKind; data: unknown; onClose: () => void }) => {
  const { transfer } = useContainer();
  const [minutes, setMinutes] = useState<number>(60);
  const [state, setState] = useState<{ status: 'idle' } | { status: 'sending' } | { status: 'sent'; sent: SentTransfer } | { status: 'failed' }>({ status: 'idle' });

  const send = async () => {
    if (!transfer) return;
    setState({ status: 'sending' });
    try {
      setState({ status: 'sent', sent: await sendTransfer(transfer, kind, data, { ttlMinutes: minutes }) });
    } catch {
      setState({ status: 'failed' });
    }
  };

  return (
    <Modal title={`Send this ${KIND_LABEL[kind]}`} onClose={onClose}>
      {state.status === 'sent' ? (
        <>
          <p className="muted">On your other device open Profile → Receive, then type this code or scan the QR.</p>
          <div className="code" aria-label="Transfer code">{state.sent.code}</div>
          <QrImage text={state.sent.code} />
          <p className="small muted" style={{ textAlign: 'center' }}>
            Works once, until {state.sent.expiresAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. It is
            encrypted on this device; the server only keeps unreadable data and deletes it when it is taken.
          </p>
          <div className="actions">
            <button className="btn secondary" onClick={() => void navigator.clipboard?.writeText(state.sent.code)}>Copy code</button>
            <button className="btn" onClick={onClose}>Done</button>
          </div>
        </>
      ) : (
        <>
          <p className="muted">
            A one-time code is created. Enter it on your other device to copy this {KIND_LABEL[kind]} there. Nothing else leaves this device.
          </p>
          <label className="stack">
            <span className="small muted">Code valid for</span>
            <select className="field" value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}>
              {LIFETIMES.map((l) => <option key={l.minutes} value={l.minutes}>{l.label}</option>)}
            </select>
          </label>
          {state.status === 'failed' && <p className="danger-text">Could not send. Check your connection and try again.</p>}
          <div className="actions">
            <button className="btn secondary" onClick={onClose}>Cancel</button>
            <button className="btn" disabled={state.status === 'sending'} onClick={() => void send()}>
              {state.status === 'sending' ? 'Sending…' : 'Create code'}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
};

/** "Send to another device": shown next to anything that can be moved. Hidden-safe when sending is off. */
export const SendButton = ({ kind, data, label = 'Send to another device' }: { kind: TransferKind; data: unknown; label?: string }) => {
  const { transfer } = useContainer();
  const [open, setOpen] = useState(false);
  if (!transfer) return null;
  return (
    <>
      <button className="menu-item" onClick={() => setOpen(true)}>{label}</button>
      {open && <SendDialog kind={kind} data={data} onClose={() => setOpen(false)} />}
    </>
  );
};

const MESSAGES = {
  invalid_code: "That doesn't look like a code. It has 10 letters and digits, like K7QM2-X9RTA.",
  not_found: 'No transfer found. The code may be wrong, expired, or already used.',
  unreadable: "The data couldn't be read. It may come from a newer version of the app.",
  invalid: 'The data is not valid, so nothing was imported.',
  offline: 'Could not reach the server. Check your connection.',
} as const;

const ReceiveDialog = ({ onClose }: { onClose: () => void }) => {
  const { transfer, store } = useContainer();
  const toast = useToast();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  const receive = async (input: string) => {
    if (!transfer) return;
    setBusy(true);
    setProblem(null);
    try {
      const result = await receiveTransfer(transfer, input);
      if (result.status !== 'ok') return setProblem(MESSAGES[result.status]);
      const imported = await importEnvelope(store, result.envelope);
      if (imported.status === 'invalid') return setProblem(MESSAGES.invalid);
      toast(`Imported ${KIND_LABEL[imported.kind]} “${imported.title}”`);
      onClose();
    } catch {
      setProblem(MESSAGES.offline);
    } finally {
      setBusy(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void receive(text);
  };

  if (scanning) {
    return (
      <ScannerDialog
        title="Scan the QR code"
        onClose={() => setScanning(false)}
        onResult={(scanned) => {
          setScanning(false);
          setText(scanned);
          if (normalizeCode(scanned)) void receive(scanned);
          else setProblem(MESSAGES.invalid_code);
        }}
      />
    );
  }

  return (
    <Modal title="Receive from another device" onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <p className="muted">Enter the code shown on the other device. The item is copied here as a new one.</p>
        <input className="field" value={text} placeholder="K7QM2-X9RTA" autoCapitalize="characters" autoComplete="off"
          aria-label="Transfer code" onChange={(e) => setText(e.target.value)} />
        {problem && <p className="danger-text" role="alert">{problem}</p>}
        <div className="actions">
          <button type="button" className="btn secondary" onClick={() => setScanning(true)}>Scan QR</button>
          <button type="submit" className="btn" disabled={busy || text.trim() === ''}>{busy ? 'Receiving…' : 'Receive'}</button>
        </div>
      </form>
    </Modal>
  );
};

/** The "Receive from another device" action of a +, and the dialog it opens while open. */
export const useReceiveAction = (): [FabAction, ReactNode] => {
  const { transfer } = useContainer();
  const [open, setOpen] = useState(false);
  return [
    { label: 'Receive from another device', short: 'Receive', icon: Icons.receive, disabled: !transfer, onSelect: () => setOpen(true) },
    open && <ReceiveDialog onClose={() => setOpen(false)} />,
  ];
};


/** How a file handed out is named and typed. */
export interface FileFormat {
  readonly extension: string;
  readonly type: string;
}

/**
 * Items and backups. The content is JSON, but Chrome on Android shares only a short list of file
 * types (images, PDF, plain text…), and .json is not on it: a .json file makes share() fail. So
 * the file is plain text, and the app tells what it holds from the content, not the name.
 */
export const FITOS_FILE: FileFormat = { extension: 'fitos.txt', type: 'text/plain' };

/** A table for spreadsheets. Where a browser cannot share it, it is downloaded instead. */
export const CSV_FILE: FileFormat = { extension: 'csv', type: 'text/csv' };

/** Saves [text] as a file through the browser's download. */
const download = (name: string, text: string, type: string) => {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

/** The file's name: [title] made safe for any file system, with the format's extension. */
const fileName = (title: string, format: FileFormat) =>
  `${title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'item'}.${format.extension}`;

export type ShareOutcome = 'shared' | 'cancelled' | 'downloaded';

/**
 * Hands [text] to the phone's share sheet as a file (to a chat, mail, drive, Files…). Where the
 * browser cannot share it, the file is downloaded instead, and the caller says where it went.
 */
export const shareFile = async (title: string, text: string, format: FileFormat = FITOS_FILE): Promise<ShareOutcome> => {
  const name = fileName(title, format);
  const file = typeof File === 'undefined' ? null : new File([text], name, { type: format.type });
  if (file && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title });
      return 'shared';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled'; // the sheet was closed
    }
  }
  download(name, text, format.type);
  return 'downloaded';
};

/** Shares a file and, when it was downloaded instead, says where to find it. */
export const useShareFile = () => {
  const toast = useToast();
  return (title: string, text: string, format: FileFormat = FITOS_FILE) => shareFile(title, text, format).then((outcome) => {
    if (outcome === 'downloaded') toast(`Saved to Downloads as ${fileName(title, format)}`);
  });
};

/**
 * The share icon of a plan, workout or day (or a row, given a [label]): a sheet with "Share as
 * file" (anyone can import it) and, when sending is set up, "Send with a code" to your own other device.
 */
export const ShareButton = ({ kind, data, title, label }: { kind: TransferKind; data: unknown; title: string; label?: string }) => {
  const { transfer, community } = useContainer();
  const share = useShareFile();
  const [open, setOpen] = useState<'menu' | 'code' | 'publish' | null>(null);
  const publishable = community && (kind === 'training_plan' || kind === 'diet_plan');
  return (
    <>
      {label
        ? <button className="menu-item" onClick={() => setOpen('menu')}>{label}</button>
        : <button className="icon-btn" aria-label="Share" onClick={() => setOpen('menu')}>{Icons.share}</button>}
      {open === 'menu' && (
        <Modal title={`Share “${title}”`} onClose={() => setOpen(null)}>
          <div className="stack">
            <button className="menu-item with-icon" onClick={() => { setOpen(null); void share(title, envelopeFile(kind, data)); }}>
              {Icons.file}<span className="grow">Share as file<br /><span className="small muted">A file any Tracker can import</span></span>
            </button>
            {transfer && (
              <button className="menu-item with-icon" onClick={() => setOpen('code')}>
                {Icons.receive}<span className="grow">Send with a code<br /><span className="small muted">To your other device, once</span></span>
              </button>
            )}
            {publishable && (
              <button className="menu-item with-icon" onClick={() => setOpen('publish')}>
                {Icons.community}<span className="grow">Publish to community<br /><span className="small muted">Anyone can find and copy it</span></span>
              </button>
            )}
          </div>
        </Modal>
      )}
      {open === 'code' && <SendDialog kind={kind} data={data} onClose={() => setOpen(null)} />}
      {open === 'publish' && (
        <PublishDialog kind={kind === 'training_plan' ? 'training' : 'diet'} plan={data as TrainingPlan | DietPlan} onClose={() => setOpen(null)} />
      )}
    </>
  );
};

const summarize = (b: Backup): string => {
  const d = b.data;
  return `${d.trainingPlans.length} workout plans, ${d.dietPlans.length} diets, ${d.workouts.length} workouts, ${d.foodLogDays.length} food-log days and ${d.weights.length} weigh-ins`;
};

/** Where to look at what a file brought in. */
const SCREEN_OF: Record<TransferKind | 'backup', string> = {
  training_plan: '/workouts', workout: '/workouts', diet_plan: '/food', food_log_day: '/tracker', backup: '/',
};

/**
 * Brings in the text of any file Tracker writes, recognised from its content: a shared item is
 * stored as a copy at once; a backup is first summarised and confirmed. [onDone] hears where to
 * look at the result, or null when nothing was imported.
 */
export const useFileImport = (onDone: (screen: string | null) => void = () => {}): [(text: string) => Promise<void>, ReactNode] => {
  const { store } = useContainer();
  const toast = useToast();
  const [backup, setBackup] = useState<Backup | null>(null);
  const importText = async (text: string) => {
    const contents = readFileContents(text);
    if (contents.kind === 'backup') return setBackup(contents.backup);
    const imported = contents.kind === 'item' ? await importEnvelope(store, contents.envelope) : { status: 'invalid' as const };
    toast(imported.status === 'imported' ? `Imported ${KIND_LABEL[imported.kind]} “${imported.title}”` : "That file can't be imported.");
    onDone(imported.status === 'imported' ? SCREEN_OF[imported.kind] : null);
  };
  const dialog = backup && (
    <ConfirmDialog title="Import this backup?" confirmLabel="Import" danger={false}
      message={`It contains ${summarize(backup)}. Items with the same id are replaced; everything else on this device is kept.`}
      onClose={() => { setBackup(null); onDone(null); }}
      onConfirm={() => void restoreBackup(store, backup).then(() => { toast('Backup imported'); onDone(SCREEN_OF.backup); })} />
  );
  return [importText, dialog];
};

/** The "Import a file" action of a +: opens any file Tracker wrote, an item or a whole backup. */
export const useImportFileAction = (): [FabAction, ReactNode] => {
  const input = useRef<HTMLInputElement>(null);
  const [importText, dialog] = useFileImport();
  const onFile = async (file: File | undefined) => {
    if (!file) return;
    await importText(await file.text());
    if (input.current) input.current.value = '';
  };
  return [
    { label: 'Import a file', short: 'Import', icon: Icons.file, onSelect: () => input.current?.click() },
    <>
      <input ref={input} type="file" accept=".txt,.json,text/plain,application/json" hidden aria-label="File to import" onChange={(e) => void onFile(e.target.files?.[0])} />
      {dialog}
    </>,
  ];
};

/**
 * Where the app opens when a file is shared to it from another app: imports the file the service
 * worker received, then goes to what it brought in.
 */
export const ImportShared = () => {
  const { sharedFiles } = useContainer();
  const navigate = useNavigate();
  const [state, setState] = useState<'reading' | 'empty' | 'importing'>('reading');
  const [importText, dialog] = useFileImport((screen) => navigate(screen ?? '/', { replace: true }));
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return; // React runs effects twice in development; the file is taken once
    started.current = true;
    void sharedFiles.take().then((file) => {
      if (!file) return setState('empty');
      setState('importing');
      return importText(file.text);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <>
      <PageHeader title="Import" />
      {state === 'empty' ? <Empty>No file to import. Share a Tracker file to the app, or use Import a file.</Empty> : <p className="muted" role="status">Importing…</p>}
      {dialog}
    </>
  );
};
