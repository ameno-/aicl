/**
 * Canvas-first mode (AICL-41): the dock's chat, floating over the canvas. Same
 * ChatPanel content with a compact composer; drag by the bar, collapse to a pill.
 */
import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { GripHorizontal, Maximize2, MessageSquare, Minus } from 'lucide-react';
import type { ProviderKit } from '../../shared/kits.ts';
import { ChatPanel } from '../ChatPanel.tsx';
import { setFocusMode } from '../router.ts';

const KEY = 'aicl.floatingChat';
const W = 380;

interface Placement {
  x: number;
  y: number;
  collapsed: boolean;
}

function load(): Placement {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Placement | null;
    if (v && Number.isFinite(v.x) && Number.isFinite(v.y)) return v;
  } catch {
    // fall through to the default
  }
  return { x: Math.max(16, window.innerWidth - W - 16), y: 16, collapsed: false };
}

export function FloatingChat({ kit }: { kit: ProviderKit }) {
  const [place, setPlace] = useState(load);
  const drag = useRef<{ dx: number; dy: number } | null>(null);

  const save = (next: Placement) => {
    setPlace(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      // position just won't survive a reload
    }
  };
  const clamp = (x: number, y: number) => ({
    x: Math.min(Math.max(0, x), Math.max(0, window.innerWidth - 120)),
    y: Math.min(Math.max(0, y), Math.max(0, window.innerHeight - 80)),
  });

  const onDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button')) return;
    drag.current = { dx: e.clientX - place.x, dy: e.clientY - place.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (drag.current) setPlace((p) => ({ ...p, ...clamp(e.clientX - drag.current!.dx, e.clientY - drag.current!.dy) }));
  };
  const onUp = () => {
    if (drag.current) save(place);
    drag.current = null;
  };

  return (
    <>
      <div
        className="floating-chat"
        role="complementary"
        aria-label="Floating chat"
        data-collapsed={place.collapsed}
        style={{ left: place.x, top: place.y }}
      >
        <div className="floating-chat__bar" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
          <GripHorizontal size={14} aria-hidden="true" />
          <span>Chat</span>
          <button type="button" className="icon-button" aria-label="Collapse chat" title="Collapse" onClick={() => save({ ...place, collapsed: true })}>
            <Minus size={14} aria-hidden="true" />
          </button>
          <button type="button" className="icon-button" aria-label="Exit canvas-first mode" title="Exit canvas-first mode (⌘⇧F)" onClick={() => setFocusMode(false)}>
            <Maximize2 size={14} aria-hidden="true" />
          </button>
        </div>
        <ChatPanel kit={kit} compact />
      </div>
      {place.collapsed ? (
        <button type="button" className="floating-chat-pill" aria-label="Expand chat" onClick={() => save({ ...place, collapsed: false })}>
          <MessageSquare size={14} aria-hidden="true" /> Chat
        </button>
      ) : null}
    </>
  );
}
