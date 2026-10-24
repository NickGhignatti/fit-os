import { useEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from 'react';
import type { WidgetSize, WidgetSlot } from '../domain/profile';
import { Icons, Modal } from './kit';

/** A kind of widget a board can hold. [render] returns null when it has nothing to show right now. */
export interface WidgetKind {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  /** The sizes it comes in; the first is the one it gets when added. */
  readonly sizes: readonly WidgetSize[];
  readonly render: (size: WidgetSize) => ReactNode;
}

const HOLD_MS = 500;

/**
 * Widgets in two columns, filling from the top: a half-width one moves up into any gap, so there
 * are never holes and nothing is placed by hand. Holding any widget (or "Edit widgets") starts
 * editing, as on a phone's home screen: widgets wiggle, a red button removes one, another
 * switches its width, and "Add widget" opens the ones not on the board.
 */
export const WidgetBoard = ({ label, kinds, slots, onChange }: {
  label: string; kinds: readonly WidgetKind[]; slots: readonly WidgetSlot[]; onChange: (slots: WidgetSlot[]) => void;
}) => {
  const [editing, setEditingState] = useState(false);
  const [adding, setAdding] = useState(false);
  // While editing, the board follows its own copy, so quick taps build on each other instead of
  // on a layout that is still being saved.
  const [draft, setDraft] = useState<WidgetSlot[] | null>(null);
  const setEditing = (on: boolean) => { setEditingState(on); if (!on) setDraft(null); };
  const change = (next: WidgetSlot[]) => { setDraft(next); onChange(next); };
  const press = useRef<{ timer: number; x: number; y: number } | null>(null);
  const held = useRef(false); // the hold that started editing must not also count as a tap
  const byId = new Map(kinds.map((k) => [k.id, k]));
  const shown = (draft ?? slots).filter((s) => byId.has(s.id));
  const missing = kinds.filter((k) => !shown.some((s) => s.id === k.id));

  useEffect(() => {
    if (!editing) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setEditing(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [editing]);

  const cancel = () => {
    if (press.current) window.clearTimeout(press.current.timer);
    press.current = null;
  };
  const down = (e: PointerEvent) => {
    if (editing || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const timer = window.setTimeout(() => {
      press.current = null;
      held.current = true;
      navigator.vibrate?.(15);
      setEditing(true);
    }, HOLD_MS);
    press.current = { timer, x: e.clientX, y: e.clientY };
  };
  const move = (e: PointerEvent) => {
    if (press.current && Math.hypot(e.clientX - press.current.x, e.clientY - press.current.y) > 10) cancel();
  };
  const resize = (slot: WidgetSlot, size: WidgetSize) => change(shown.map((s) => (s.id === slot.id ? { ...s, size } : s)));

  return (
    <section className={`board ${editing ? 'editing' : ''}`} aria-label={label}>
      {editing && (
        <div className="board-bar">
          <span className="grow small muted">Remove, resize or add widgets</span>
          <button className="btn small" onClick={() => setEditing(false)}>Done</button>
        </div>
      )}
      <div className="board-grid" onPointerDown={down} onPointerMove={move} onPointerUp={cancel} onPointerCancel={cancel} onPointerLeave={cancel}
        onContextMenu={(e) => e.preventDefault()}
        onClickCapture={(e) => { if (held.current) { held.current = false; e.preventDefault(); e.stopPropagation(); } }}>
        {shown.map((slot, i) => {
          const kind = byId.get(slot.id)!;
          const content = kind.render(slot.size);
          if (content === null && !editing) return null;
          const other = kind.sizes.find((s) => s !== slot.size);
          return (
            <div key={slot.id} className={`widget ${slot.size}`} style={{ '--i': i } as CSSProperties}>
              <div className="widget-body" aria-hidden={editing || undefined}>
                {content ?? <div className="card widget-empty"><div className="title">{kind.title}</div><div className="small muted">Nothing to show today</div></div>}
              </div>
              {editing && (
                <>
                  <button className="widget-remove" aria-label={`Remove ${kind.title}`} onClick={() => change(shown.filter((s) => s.id !== slot.id))}>
                    <span aria-hidden="true">−</span>
                  </button>
                  {other && (
                    <button className="widget-size" aria-label={`Make ${kind.title} ${other === 'full' ? 'wide' : 'small'}`} onClick={() => resize(slot, other)}>
                      {other === 'full' ? Icons.expand : Icons.shrink}
                    </button>
                  )}
                </>
              )}
            </div>
          );
        })}
        {editing && (
          <button className="widget-add" disabled={missing.length === 0} onClick={() => setAdding(true)}>
            {Icons.plus}{missing.length === 0 ? 'Every widget is on' : 'Add widget'}
          </button>
        )}
      </div>
      {!editing && <button className="board-edit" onClick={() => setEditing(true)}>Edit widgets</button>}
      {adding && (
        <Modal title="Add a widget" onClose={() => setAdding(false)}>
          <div className="stack">
            {missing.map((k) => (
              <button key={k.id} className="menu-item" aria-label={`Add ${k.title}`}
                onClick={() => { change([...shown, { id: k.id, size: k.sizes[0]! }]); setAdding(false); }}>
                <span className="title">{k.title}</span><br /><span className="small muted">{k.description}</span>
              </button>
            ))}
          </div>
        </Modal>
      )}
    </section>
  );
};
