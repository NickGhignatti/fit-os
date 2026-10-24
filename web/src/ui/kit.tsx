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

/** The ⋮ button, or any [icon] in its place: opens a list of actions. */
export const ActionMenu = ({ actions, label = 'More options', icon = '⋮', className = 'icon-btn' }: {
  actions: readonly MenuAction[]; label?: string; icon?: string; className?: string;
}) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className={className} aria-label={label} onClick={() => setOpen(true)}>{icon}</button>
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

export const PlayIcon = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" fill="currentColor" /></svg>
);

const BackIcon = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
    <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/**
 * A large title with an optional small line above it. Detail screens get a bar on top with the
 * back button on the left and their [actions] on the right; top-level screens put [actions]
 * beside the title.
 */
export const PageHeader = ({
  title, subtitle, back = false, actions,
}: { title: string; subtitle?: string; back?: boolean; actions?: ReactNode }) => {
  const navigate = useNavigate();
  return (
    <header className="page-header">
      {back && (
        <div className="page-nav">
          <button className="icon-btn nav-btn" aria-label="Back" onClick={() => navigate(-1)}><BackIcon /></button>
          {actions && <div className="page-actions">{actions}</div>}
        </div>
      )}
      <div className="page-title">
        <div className="grow">
          {subtitle && <p className="eyebrow">{subtitle}</p>}
          <h1>{title}</h1>
        </div>
        {!back && actions && <div className="page-actions">{actions}</div>}
      </div>
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

export const ProgressBar = ({ value, max, label, color }: { value: number; max: number; label: string; color?: string }) => (
  <div className="progress" role="progressbar" aria-label={label} aria-valuenow={Math.round(value)} aria-valuemax={Math.round(max)}>
    <span style={{ width: `${max > 0 ? Math.min(100, (value / max) * 100) : 0}%`, ...(color ? { background: color } : {}) }} />
  </div>
);

/** A round meter with the percentage in its middle; a dash when there is nothing to count. */
export const ProgressRing = ({ value, max }: { value: number; max: number }) => {
  const r = 28;
  const length = 2 * Math.PI * r;
  const ratio = max > 0 ? Math.min(value / max, 1) : 0;
  return (
    <svg className="ring" viewBox="0 0 72 72" aria-hidden="true">
      <circle className="ring-track" cx="36" cy="36" r={r} />
      {ratio > 0 && (
        <circle className="ring-fill" cx="36" cy="36" r={r} transform="rotate(-90 36 36)"
          strokeDasharray={length} strokeDashoffset={length * (1 - ratio)} />
      )}
      <text x="36" y="36" textAnchor="middle" dominantBaseline="central">{max > 0 ? `${Math.round(ratio * 100)}%` : '–'}</text>
    </svg>
  );
};

const ENERGY_MACROS = [
  { key: 'protein', label: 'Protein', color: 'var(--protein)' },
  { key: 'carbs', label: 'Carbs', color: 'var(--carbs)' },
  { key: 'fat', label: 'Fat', color: 'var(--fat)' },
] as const;

/**
 * A day's energy as one big ring: what is left of [goal] in the middle and the macros beside it,
 * each against [macroGoals] when there are some. Without a goal the ring stays empty and the
 * middle shows what was eaten; [children] then goes in the footer, to say how to get one.
 */
export const EnergyCard = ({ label, eaten, goal, goalLabel = 'goal', macroGoals, action, children }: {
  label: string; eaten: Nutrients; goal: number | undefined; goalLabel?: string; macroGoals?: Nutrients;
  action?: ReactNode; children?: ReactNode;
}) => {
  const r = 54;
  const length = 2 * Math.PI * r;
  const ratio = goal !== undefined && goal > 0 ? Math.min(eaten.kcal / goal, 1) : 0;
  const left = goal !== undefined ? Math.round(goal - eaten.kcal) : 0;
  const over = goal !== undefined && left < 0;
  return (
    <section className="card energy" aria-label={label}>
      <div className="energy-body">
        <div className="energy-ring" role="progressbar" aria-label="Energy consumed"
          aria-valuenow={Math.round(eaten.kcal)} aria-valuemax={goal !== undefined ? Math.round(goal) : undefined}>
          <svg viewBox="0 0 128 128" aria-hidden="true">
            <circle className="energy-track" cx="64" cy="64" r={r} />
            {ratio > 0 && (
              <circle className={`energy-fill ${over ? 'over' : ''}`} cx="64" cy="64" r={r} transform="rotate(-90 64 64)"
                strokeDasharray={length} strokeDashoffset={length * (1 - ratio)} />
            )}
          </svg>
          <div className="energy-center">
            <span className="energy-number">{goal !== undefined ? Math.abs(left) : Math.round(eaten.kcal)}</span>{' '}
            <span className="energy-unit">{goal !== undefined ? (over ? 'kcal over' : 'kcal left') : 'kcal eaten'}</span>
          </div>
        </div>
        <div className="energy-macros">
          {ENERGY_MACROS.map((m) => (
            <div key={m.key} className="macro">
              <div className="row between">
                <span className="macro-label"><i style={{ background: m.color }} />{m.label}</span>
                <span className="macro-value">
                  {Math.round(eaten[m.key])}{macroGoals && <span className="muted"> / {Math.round(macroGoals[m.key])}</span>} g
                </span>
              </div>
              {macroGoals && <ProgressBar value={eaten[m.key]} max={macroGoals[m.key]} label={`${m.label} eaten`} color={m.color} />}
            </div>
          ))}
        </div>
      </div>
      <div className="energy-foot small muted">
        {goal !== undefined ? <><span>{Math.round(eaten.kcal)} eaten</span><span className="grow">of {Math.round(goal)} {goalLabel}</span></> : <span className="grow">{children}</span>}
        {action}
      </div>
    </section>
  );
};

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
