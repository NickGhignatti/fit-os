import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Nutrients } from '../domain/nutrition';

/** A dialog that slides up on phones. Closes on Escape and on a tap outside. */
export const Modal = ({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) => {
  const titleId = useId();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <h2 id={titleId} className="modal-title">{title}</h2>
        {children}
      </div>
    </div>
  );
};

export const ConfirmDialog = ({
  title, message, confirmLabel = 'Delete', danger = true, onConfirm, onClose,
}: {
  title: string; message?: string; confirmLabel?: string; danger?: boolean; onConfirm: () => void; onClose: () => void;
}) => (
  <Modal title={title} onClose={onClose}>
    {message && <p className="muted">{message}</p>}
    <div className="actions">
      <button className="btn secondary" onClick={onClose}>Cancel</button>
      <button className={`btn ${danger ? 'danger' : ''}`} onClick={() => { onConfirm(); onClose(); }}>{confirmLabel}</button>
    </div>
  </Modal>
);

/** Asks for a line of text (a name, a weight). Submit is disabled while [validate] says no. */
export const PromptDialog = ({
  title, label, initial = '', confirmLabel = 'Save', inputMode, hint, validate = (v) => v.trim() !== '', onSubmit, onClose,
}: {
  title: string; label: string; initial?: string; confirmLabel?: string; hint?: string;
  inputMode?: 'text' | 'decimal' | 'numeric'; validate?: (value: string) => boolean;
  onSubmit: (value: string) => void; onClose: () => void;
}) => {
  const [value, setValue] = useState(initial);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => ref.current?.select(), []);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!validate(value)) return;
    onSubmit(value.trim());
    onClose();
  };
  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={submit} className="stack">
        <label className="stack">
          <span className="small muted">{label}</span>
          <input ref={ref} className="field" value={value} inputMode={inputMode} onChange={(e) => setValue(e.target.value)} />
        </label>
        {hint && <p className="small muted">{hint}</p>}
        <div className="actions">
          <button type="button" className="btn secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn" disabled={!validate(value)}>{confirmLabel}</button>
        </div>
      </form>
    </Modal>
  );
};

export interface MenuAction {
  readonly label: string;
  readonly onSelect: () => void;
  readonly danger?: boolean;
}

/** The ⋮ button: opens a list of actions. */
export const ActionMenu = ({ actions, label = 'More options' }: { actions: readonly MenuAction[]; label?: string }) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="icon-btn" aria-label={label} onClick={() => setOpen(true)}>⋮</button>
      {open && (
        <Modal title={label} onClose={() => setOpen(false)}>
          <div className="stack">
            {actions.map((a) => (
              <button key={a.label} className={`menu-item ${a.danger ? 'danger-text' : ''}`} onClick={() => { setOpen(false); a.onSelect(); }}>
                {a.label}
              </button>
            ))}
          </div>
        </Modal>
      )}
    </>
  );
};

export const PageHeader = ({
  title, subtitle, back = false, actions,
}: { title: string; subtitle?: string; back?: boolean; actions?: ReactNode }) => {
  const navigate = useNavigate();
  return (
    <header className="page-header">
      {back && <button className="icon-btn" aria-label="Back" onClick={() => navigate(-1)}>←</button>}
      <div className="grow">
        <h1>{title}</h1>
        {subtitle && <p className="muted small">{subtitle}</p>}
      </div>
      {actions}
    </header>
  );
};

export const Segmented = <T extends string>({
  options, value, onChange, label,
}: { options: readonly { value: T; label: string }[]; value: T; onChange: (v: T) => void; label: string }) => (
  <div className="seg" role="radiogroup" aria-label={label}>
    {options.map((o) => (
      <button key={o.value} type="button" role="radio" aria-checked={o.value === value} className={o.value === value ? 'on' : ''} onClick={() => onChange(o.value)}>
        {o.label}
      </button>
    ))}
  </div>
);

export const MacroChips = ({ n }: { n: Nutrients }) => (
  <span className="chips">
    <span className="chip protein">P {Math.round(n.protein)} g</span>
    <span className="chip carbs">C {Math.round(n.carbs)} g</span>
    <span className="chip fat">F {Math.round(n.fat)} g</span>
  </span>
);

export const ProgressBar = ({ value, max, label }: { value: number; max: number; label: string }) => (
  <div className="progress" role="progressbar" aria-label={label} aria-valuenow={Math.round(value)} aria-valuemax={Math.round(max)}>
    <span style={{ width: `${max > 0 ? Math.min(100, (value / max) * 100) : 0}%` }} />
  </div>
);

export const Loading = () => <p className="muted" role="status">Loading…</p>;

export const Empty = ({ children }: { children: ReactNode }) => <div className="empty">{children}</div>;

export const useDebounced = <T,>(value: T, ms = 200): T => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return debounced;
};
