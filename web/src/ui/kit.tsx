import { Children, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type FormEvent, type PointerEvent, type ReactNode } from 'react';
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

const Glyph = ({ d }: { d: string }) => (
  <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
    <path d={d} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** Line icons for the actions of the +. */
export const Icons = {
  plus: <Glyph d="M12 5v14M5 12h14" />,
  search: <Glyph d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4" />,
  scan: <Glyph d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M8 8v8M12 8v8M16 8v8" />,
  camera: <Glyph d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />,
  weight: <Glyph d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM8 10a4 4 0 0 1 8 0zM12 10l1.5-2.5" />,
  receive: <Glyph d="M8 2h8a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zM12 6v7M9.5 10.5 12 13l2.5-2.5M11 18h2" />,
  download: <Glyph d="M12 3v12M7 10l5 5 5-5M5 21h14" />,
  upload: <Glyph d="M12 15V3M7 8l5-5 5 5M5 21h14" />,
  share: <Glyph d="M12 3v12M8 7l4-4 4 4M6 11H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-1" />,
  file: <Glyph d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5M12 18v-6M9.5 14.5 12 12l2.5 2.5" />,
  list: <Glyph d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01" />,
  person: <Glyph d="M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9zM4 21a8 8 0 0 1 16 0" />,
  copy: <Glyph d="M9 9h11v11H9zM5 15H4V4h11v1" />,
  meal: <Glyph d="M7 2v8a3 3 0 0 0 3 3v9M7 2v6M4 2v6a3 3 0 0 0 3 3M17 2c-2 2-3 5-3 8s1 4 3 4v8" />,
  workout: <Glyph d="M6 7v10M3 9v6M18 7v10M21 9v6M6 12h12" />,
  chevron: <Glyph d="M6 9l6 6 6-6" />,
  expand: <Glyph d="M14 4h6v6M10 20H4v-6M20 4l-6 6M4 20l6-6" />,
  shrink: <Glyph d="M4 14h6v6M20 10h-6V4M10 14l-6 6M14 10l6-6" />,
  filter: <Glyph d="M4 6h16M7 12h10M10 18h4" />,
  close: <Glyph d="M6 6l12 12M18 6L6 18" />,
  check: <Glyph d="M5 12.5l4.5 4.5L19 7.5" />,
  pause: <Glyph d="M9 5v14M15 5v14" />,
  reset: <Glyph d="M4 12a8 8 0 1 0 2.4-5.7M4 4v4.5h4.5" />,
  record: <Glyph d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4" />,
};

export interface FabAction {
  /** The accessible name; also the caption under the icon unless [short] is given. */
  readonly label: string;
  readonly short?: string;
  readonly icon: ReactNode;
  readonly onSelect: () => void;
  readonly disabled?: boolean;
}

/**
 * The round + in the bottom-right corner of a screen. Its actions always fan out around it on a
 * quarter circle, from straight up to straight left, over a frosted backdrop; a lone action sits
 * halfway, up and to the left.
 */
export const Fab = ({ label, actions }: { label: string; actions: readonly FabAction[] }) => {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);
  // Wide enough that neighbours on the arc sit 100px apart, so icons and captions never touch.
  const step = Math.PI / 2 / Math.max(actions.length - 1, 1);
  const radius = Math.max(110, Math.round(100 / (2 * Math.sin(step / 2))));
  return (
    <>
      <div className="fab-space" />
      {open && <div className="fab-scrim" onClick={() => setOpen(false)} />}
      <div className={`fab-dial ${open ? 'open' : ''}`}>
        {open && (
          <div role="group" aria-label={label}>
            {actions.map((a, i) => {
              const angle = actions.length === 1 ? 1.25 * Math.PI : 1.5 * Math.PI - i * step;
              const at = { '--x': `${Math.round(radius * Math.cos(angle))}px`, '--y': `${Math.round(radius * Math.sin(angle))}px`, '--i': i };
              return (
                <button key={a.label} className="fab-item" aria-label={a.label} disabled={a.disabled} style={at as CSSProperties}
                  onClick={() => { setOpen(false); a.onSelect(); }}>
                  {a.icon}
                  <span className="fab-caption" aria-hidden="true">{a.short ?? a.label}</span>
                </button>
              );
            })}
          </div>
        )}
        <button className="fab" aria-label={label} aria-expanded={open} onClick={() => setOpen(!open)}>
          {Icons.plus}
        </button>
      </div>
    </>
  );
};

/**
 * Cards side by side, swiped through one at a time, with their [titles] as tabs above. [index] is
 * the card in view: a swipe reports it through [onIndex], and a new [index] from outside (a tap on
 * a tab, a card just added) scrolls there.
 */
export const Carousel = ({ label, titles, index, onIndex, children }: {
  label: string; titles: readonly string[]; index: number; onIndex: (index: number) => void; children: ReactNode;
}) => {
  const track = useRef<HTMLDivElement>(null);
  const shown = useRef(index); // the card the track is on
  const heading = useRef<number | null>(null); // the card a slide is going to; cards passed on the way don't count
  const offsetOf = (i: number) => (track.current?.children[i] as HTMLElement | undefined)?.offsetLeft ?? 0;
  const left = (i: number) => offsetOf(i) - offsetOf(0);

  // Open on the card in view without sliding there; later changes slide.
  useLayoutEffect(() => {
    if (track.current) track.current.scrollLeft = left(index);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (index === shown.current) return;
    shown.current = index;
    heading.current = index;
    track.current?.scrollTo?.({ left: left(index), behavior: 'smooth' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  const onScroll = () => {
    const t = track.current;
    const step = left(1);
    if (!t || step <= 0) return;
    const i = Math.min(Math.max(Math.round(t.scrollLeft / step), 0), titles.length - 1);
    if (heading.current !== null) {
      if (i === heading.current) heading.current = null;
      return;
    }
    if (i === shown.current) return;
    shown.current = i;
    onIndex(i);
  };

  return (
    <div className="carousel">
      <div className="carousel-tabs" role="tablist" aria-label={label}>
        {titles.map((t, i) => (
          <button key={`${t}-${i}`} role="tab" aria-selected={i === index} className={i === index ? 'on' : ''} onClick={() => onIndex(i)}>{t}</button>
        ))}
      </div>
      <div className="carousel-track" ref={track} onScroll={onScroll}>
        {Children.map(children, (child) => <div className="carousel-slide">{child}</div>)}
      </div>
    </div>
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

/** How far a row must travel sideways before letting go completes it. */
const SWIPE_DONE_PX = 96;

/**
 * A row that is swiped away, either way, to complete it: past [SWIPE_DONE_PX] it slides off and
 * [onComplete] runs; short of that it springs back. Up-and-down drags still scroll the page, and
 * a swipe never counts as a tap on what is inside.
 */
export const SwipeToComplete = ({ label, under = 'Done', onComplete, children }: {
  label: string; under?: string; onComplete: () => void; children: ReactNode;
}) => {
  const [dx, setDx] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const start = useRef<{ x: number; y: number } | null>(null);
  const sideways = useRef(false);
  const dragged = useRef(false);
  const down = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    start.current = { x: e.clientX, y: e.clientY };
    sideways.current = false;
    dragged.current = false;
  };
  const move = (e: PointerEvent<HTMLDivElement>) => {
    if (!start.current) return;
    const mx = e.clientX - start.current.x;
    const my = e.clientY - start.current.y;
    if (!sideways.current) {
      if (Math.abs(my) > 10 && Math.abs(my) > Math.abs(mx)) { start.current = null; return; } // a scroll
      if (Math.abs(mx) < 10) return;
      sideways.current = true;
      dragged.current = true;
      e.currentTarget.setPointerCapture?.(e.pointerId);
    }
    setDx(mx);
  };
  const up = () => {
    if (sideways.current && Math.abs(dx) >= SWIPE_DONE_PX) {
      setLeaving(true);
      setDx(Math.sign(dx) * window.innerWidth);
      setTimeout(onComplete, 180);
    } else {
      setDx(0);
    }
    start.current = null;
    sideways.current = false;
  };
  const ready = Math.abs(dx) >= SWIPE_DONE_PX;
  return (
    <div className={`swipe ${dx !== 0 ? 'moving' : ''} ${ready ? 'ready' : ''}`} aria-label={label} role="group">
      <div className={`swipe-under ${dx < 0 ? 'right' : ''}`} aria-hidden="true">{under === 'Done' ? Icons.check : Icons.reset}<span>{under}</span></div>
      <div className={`swipe-body ${leaving || dx === 0 ? 'settle' : ''}`} style={{ transform: dx ? `translateX(${dx}px)` : undefined }}
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
        onClickCapture={(e) => { if (dragged.current) { e.stopPropagation(); e.preventDefault(); dragged.current = false; } }}>
        {children}
      </div>
    </div>
  );
};
