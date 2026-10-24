import QRCode from 'qrcode';
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useContainer } from '../app/hooks';
import { importEnvelope } from '../data/importItem';
import { normalizeCode } from '../transfer/code';
import { envelopeFile, parseEnvelope, receiveTransfer, sendTransfer, type SentTransfer, type TransferKind } from '../transfer/transfer';
import { useToast } from './hooks';
import { Icons, Modal, type FabAction } from './kit';
import { ScannerDialog } from './Scanner';

const LIFETIMES = [
  { minutes: 60, label: '1 hour' },
  { minutes: 360, label: '6 hours' },
  { minutes: 1440, label: '24 hours' },
] as const;

const KIND_LABEL: Record<TransferKind, string> = {
  training_plan: 'workout plan', diet_plan: 'diet', workout: 'workout', food_log_day: 'food log',
};

const QrImage = ({ text }: { text: string }) => {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    let current = true;
    QRCode.toDataURL(text, { margin: 1, width: 240, errorCorrectionLevel: 'M' }).then((u) => current && setUrl(u), () => undefined);
    return () => {
      current = false;
    };
  }, [text]);
  return url ? <img src={url} width={240} height={240} alt="QR code of the transfer code" style={{ display: 'block', margin: '0 auto' }} /> : null;
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


/** Saves [text] as a file through the browser's download. */
export const download = (name: string, text: string) => {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const fileName = (title: string) => `${title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'item'}.fitos.json`;

/**
 * Hands the item to the phone's share sheet as a .fitos.json file (to a chat, mail, drive…), or
 * downloads it where the browser cannot share files.
 */
const shareFile = async (kind: TransferKind, data: unknown, title: string) => {
  const name = fileName(title);
  const text = envelopeFile(kind, data);
  const file = typeof File === 'undefined' ? null : new File([text], name, { type: 'application/json' });
  if (file && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title });
    } catch {
      // closed without sharing
    }
  } else {
    download(name, text);
  }
};

/**
 * The share icon of a plan: a sheet with "Share as file" (anyone can import it) and, when sending
 * is set up, "Send with a code" to your own other device.
 */
export const ShareButton = ({ kind, data, title }: { kind: TransferKind; data: unknown; title: string }) => {
  const { transfer } = useContainer();
  const [open, setOpen] = useState<'menu' | 'code' | null>(null);
  return (
    <>
      <button className="icon-btn" aria-label="Share" onClick={() => setOpen('menu')}>{Icons.share}</button>
      {open === 'menu' && (
        <Modal title={`Share “${title}”`} onClose={() => setOpen(null)}>
          <div className="stack">
            <button className="menu-item with-icon" onClick={() => { setOpen(null); void shareFile(kind, data, title); }}>
              {Icons.file}<span className="grow">Share as file<br /><span className="small muted">A .fitos.json file anyone can import</span></span>
            </button>
            {transfer && (
              <button className="menu-item with-icon" onClick={() => setOpen('code')}>
                {Icons.receive}<span className="grow">Send with a code<br /><span className="small muted">To your other device, once</span></span>
              </button>
            )}
          </div>
        </Modal>
      )}
      {open === 'code' && <SendDialog kind={kind} data={data} onClose={() => setOpen(null)} />}
    </>
  );
};

/** The "Import a file" action of a +: reads a .fitos.json file and stores its item as a copy. */
export const useImportFileAction = (): [FabAction, ReactNode] => {
  const { store } = useContainer();
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const onFile = async (file: File | undefined) => {
    if (!file) return;
    const envelope = parseEnvelope(await file.text());
    const imported = envelope ? await importEnvelope(store, envelope) : { status: 'invalid' as const };
    toast(imported.status === 'imported' ? `Imported ${KIND_LABEL[imported.kind]} “${imported.title}”` : "That file can't be imported.");
    if (input.current) input.current.value = '';
  };
  return [
    { label: 'Import a file', short: 'Import', icon: Icons.file, onSelect: () => input.current?.click() },
    <input ref={input} type="file" accept=".json,application/json" hidden aria-label="Item file" onChange={(e) => void onFile(e.target.files?.[0])} />,
  ];
};
