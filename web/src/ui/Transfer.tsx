import QRCode from 'qrcode';
import { useEffect, useState, type FormEvent } from 'react';
import { useContainer } from '../app/hooks';
import { importEnvelope } from '../data/importItem';
import { normalizeCode } from '../transfer/code';
import { receiveTransfer, sendTransfer, type SentTransfer, type TransferKind } from '../transfer/transfer';
import { useToast } from './hooks';
import { Modal } from './kit';
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
  const { transfer, db } = useContainer();
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
      const imported = await importEnvelope(db, result.envelope);
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

export const ReceiveButton = () => {
  const { transfer } = useContainer();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="btn secondary" disabled={!transfer} onClick={() => setOpen(true)}>Receive from another device</button>
      {!transfer && <p className="small muted">Sending between devices isn't set up in this build.</p>}
      {open && <ReceiveDialog onClose={() => setOpen(false)} />}
    </>
  );
};
