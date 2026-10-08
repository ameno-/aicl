/**
 * Surface view: browser. The live screencast of a server-side page
 * (server/surfaces/browser.ts) in a letterboxed canvas, with a URL bar,
 * history and viewport controls. The person's mouse, keys and wheel go to the
 * page; the agent's clicks show up as a fading dot.
 */
import { ArrowLeft, ArrowRight, Bot, Monitor, RotateCw, Smartphone, Tablet } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { SurfaceViewProps } from './types.ts';
import './browser/browser.css';

interface PageState {
  url: string;
  title: string;
  preset: string;
  viewport: { width: number; height: number };
  loading: boolean;
  canBack: boolean;
  canForward: boolean;
}

type Out =
  | { t: 'mouse'; type: 'down' | 'up' | 'move'; nx: number; ny: number; button?: 'left' | 'middle' | 'right'; clicks?: number }
  | { t: 'wheel'; nx: number; ny: number; dx: number; dy: number }
  | { t: 'key'; type: 'down' | 'up'; key: string }
  | { t: 'type'; text: string }
  | { t: 'navigate'; url: string }
  | { t: 'back' | 'forward' | 'reload' }
  | { t: 'viewport'; preset: string }
  | { t: 'view'; w: number; h: number; dpr: number };

interface Fit {
  ox: number;
  oy: number;
  dw: number;
  dh: number;
}

const PRESETS = [
  { id: 'desktop', label: 'Desktop', Icon: Monitor },
  { id: 'tablet', label: 'Tablet', Icon: Tablet },
  { id: 'mobile', label: 'Mobile', Icon: Smartphone },
] as const;

const BUTTONS = ['left', 'middle', 'right'] as const;

export default function BrowserSurface({ id, info, variant }: SurfaceViewProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const bitmapRef = useRef<ImageBitmap | null>(null);
  const fitRef = useRef<Fit | null>(null);
  const drawQueued = useRef(false);
  const [state, setState] = useState<PageState | null>(null);
  const [connected, setConnected] = useState(false);
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState(false);
  const [driving, setDriving] = useState(false);
  const [dot, setDot] = useState<{ nx: number; ny: number; key: number } | null>(null);
  const [fit, setFit] = useState<Fit | null>(null);
  const drivingTimer = useRef<number | undefined>(undefined);

  const send = useCallback((msg: Out) => {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  }, []);

  const userActed = useCallback(() => {
    window.clearTimeout(drivingTimer.current);
    setDriving(false);
  }, []);

  /* ── drawing ── */
  const draw = useCallback(() => {
    drawQueued.current = false;
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    const bmp = bitmapRef.current;
    if (!canvas || !stage) return;
    const dpr = window.devicePixelRatio || 1;
    const W = stage.clientWidth;
    const H = stage.clientHeight;
    if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
    }
    const g = canvas.getContext('2d');
    if (!g) return;
    g.clearRect(0, 0, canvas.width, canvas.height);
    if (!bmp || W === 0 || H === 0) return;
    const scale = Math.min(W / bmp.width, H / bmp.height);
    const dw = bmp.width * scale;
    const dh = bmp.height * scale;
    const next = { ox: (W - dw) / 2, oy: (H - dh) / 2, dw, dh };
    g.imageSmoothingQuality = 'high';
    g.drawImage(bmp, next.ox * dpr, next.oy * dpr, dw * dpr, dh * dpr);
    const prev = fitRef.current;
    fitRef.current = next;
    if (!prev || Math.abs(prev.ox - next.ox) > 0.5 || Math.abs(prev.oy - next.oy) > 0.5 || Math.abs(prev.dw - next.dw) > 0.5 || Math.abs(prev.dh - next.dh) > 0.5) setFit(next);
  }, []);
  const queueDraw = useCallback(() => {
    if (drawQueued.current) return;
    drawQueued.current = true;
    requestAnimationFrame(draw);
  }, [draw]);

  /* ── connection (with reconnect) ── */
  useEffect(() => {
    let closed = false;
    let retry = 0;
    let timer: number | undefined;
    const connect = () => {
      const proto = location.protocol === 'https:' ? 'wss' : 'ws';
      const ws = new WebSocket(`${proto}://${location.host}/ws/browser/${encodeURIComponent(id)}`);
      ws.binaryType = 'blob';
      wsRef.current = ws;
      ws.onopen = () => {
        retry = 0;
        setConnected(true);
        const stage = stageRef.current;
        if (stage) ws.send(JSON.stringify({ t: 'view', w: stage.clientWidth, h: stage.clientHeight, dpr: window.devicePixelRatio || 1 }));
      };
      ws.onmessage = (e: MessageEvent) => {
        if (typeof e.data === 'string') {
          const msg = JSON.parse(e.data) as { t: string } & Record<string, unknown>;
          if (msg.t === 'state') setState(msg as unknown as PageState);
          else if (msg.t === 'agent') {
            setDriving(true);
            window.clearTimeout(drivingTimer.current);
            drivingTimer.current = window.setTimeout(() => setDriving(false), 6000);
            if (typeof msg['nx'] === 'number' && typeof msg['ny'] === 'number') setDot({ nx: msg['nx'], ny: msg['ny'], key: Date.now() });
          }
          return;
        }
        void createImageBitmap(e.data as Blob).then((bmp) => {
          bitmapRef.current?.close();
          bitmapRef.current = bmp;
          queueDraw();
        });
      };
      ws.onclose = () => {
        setConnected(false);
        if (closed) return;
        retry += 1;
        timer = window.setTimeout(connect, Math.min(5000, 300 * 2 ** retry));
      };
    };
    connect();
    return () => {
      closed = true;
      window.clearTimeout(timer);
      window.clearTimeout(drivingTimer.current);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [id, queueDraw]);

  /* ── size: redraw and tell the server how big we are ── */
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    let t: number | undefined;
    const ro = new ResizeObserver(() => {
      queueDraw();
      window.clearTimeout(t);
      t = window.setTimeout(() => send({ t: 'view', w: stage.clientWidth, h: stage.clientHeight, dpr: window.devicePixelRatio || 1 }), 200);
    });
    ro.observe(stage);
    return () => {
      ro.disconnect();
      window.clearTimeout(t);
    };
  }, [queueDraw, send]);

  /* ── input: native listeners so tldraw never sees keys or wheel meant for the page ── */
  const point = (clientX: number, clientY: number, clamp: boolean): { nx: number; ny: number } | null => {
    const stage = stageRef.current;
    const f = fitRef.current;
    if (!stage || !f) return null;
    const r = stage.getBoundingClientRect();
    let nx = (clientX - r.left - f.ox) / f.dw;
    let ny = (clientY - r.top - f.oy) / f.dh;
    if (!clamp && (nx < 0 || nx > 1 || ny < 0 || ny > 1)) return null;
    nx = Math.min(1, Math.max(0, nx));
    ny = Math.min(1, Math.max(0, ny));
    return { nx, ny };
  };

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const onKey = (e: KeyboardEvent) => {
      e.stopPropagation();
      if (e.metaKey || e.key === 'Meta' || e.key === 'Dead' || e.key === 'Process') return; // leave Cmd shortcuts (and paste) to the browser
      e.preventDefault();
      if (e.type === 'keydown') userActed();
      send({ t: 'key', type: e.type === 'keydown' ? 'down' : 'up', key: e.key });
    };
    const onWheel = (e: WheelEvent) => {
      e.stopPropagation();
      e.preventDefault();
      const p = point(e.clientX, e.clientY, false);
      if (!p) return;
      userActed();
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
      send({ t: 'wheel', ...p, dx: e.deltaX * unit, dy: e.deltaY * unit });
    };
    const onPaste = (e: ClipboardEvent) => {
      const text = e.clipboardData?.getData('text/plain');
      if (!text) return;
      e.preventDefault();
      e.stopPropagation();
      send({ t: 'type', text });
    };
    stage.addEventListener('keydown', onKey);
    stage.addEventListener('keyup', onKey);
    stage.addEventListener('wheel', onWheel, { passive: false });
    stage.addEventListener('paste', onPaste);
    return () => {
      stage.removeEventListener('keydown', onKey);
      stage.removeEventListener('keyup', onKey);
      stage.removeEventListener('wheel', onWheel);
      stage.removeEventListener('paste', onPaste);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [send, userActed]);

  const moveQueued = useRef<{ x: number; y: number } | null>(null);
  const onPointerMove = (e: React.PointerEvent) => {
    if (!moveQueued.current) {
      requestAnimationFrame(() => {
        const q = moveQueued.current;
        moveQueued.current = null;
        if (!q) return;
        const p = point(q.x, q.y, true);
        if (p) send({ t: 'mouse', type: 'move', ...p });
      });
    }
    moveQueued.current = { x: e.clientX, y: e.clientY };
  };
  const onPointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    stageRef.current?.focus();
    const p = point(e.clientX, e.clientY, false);
    if (!p) return;
    userActed();
    stageRef.current?.setPointerCapture(e.pointerId);
    send({ t: 'mouse', type: 'down', ...p, button: BUTTONS[e.button] ?? 'left', clicks: e.detail || 1 });
  };
  const onPointerUp = (e: React.PointerEvent) => {
    e.stopPropagation();
    const p = point(e.clientX, e.clientY, true);
    if (!p) return;
    send({ t: 'mouse', type: 'up', ...p, button: BUTTONS[e.button] ?? 'left', clicks: e.detail || 1 });
  };

  /* ── toolbar ── */
  const url = state?.url ?? (typeof info?.meta?.['url'] === 'string' ? info.meta['url'] : '');
  const shownUrl = editing ? draft : url === 'about:blank' ? '' : url;
  const submitUrl = () => {
    const value = draft.trim();
    setEditing(false);
    if (value) send({ t: 'navigate', url: value });
  };

  return (
    <div className="aicl-browser" data-variant={variant} onPointerDown={(e) => e.stopPropagation()}>
      <div className="aicl-browser-bar">
        <button type="button" className="aicl-browser-btn" aria-label="Back" disabled={!state?.canBack} onClick={() => send({ t: 'back' })}>
          <ArrowLeft size={14} />
        </button>
        <button type="button" className="aicl-browser-btn" aria-label="Forward" disabled={!state?.canForward} onClick={() => send({ t: 'forward' })}>
          <ArrowRight size={14} />
        </button>
        <button type="button" className="aicl-browser-btn" aria-label="Reload" onClick={() => send({ t: 'reload' })}>
          <RotateCw size={13} className={state?.loading ? 'aicl-browser-spin' : undefined} />
        </button>
        <input
          className="aicl-browser-url"
          aria-label="Address"
          spellCheck={false}
          placeholder="Enter a URL"
          value={shownUrl}
          onFocus={(e) => {
            setDraft(url === 'about:blank' ? '' : url);
            setEditing(true);
            e.currentTarget.select();
          }}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => setEditing(false)}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Enter') {
              submitUrl();
              e.currentTarget.blur();
            } else if (e.key === 'Escape') {
              setEditing(false);
              e.currentTarget.blur();
            }
          }}
          onKeyUp={(e) => e.stopPropagation()}
        />
        <div className="aicl-browser-views" role="group" aria-label="Viewport">
          {PRESETS.map(({ id: preset, label, Icon }) => (
            <button
              key={preset}
              type="button"
              className="aicl-browser-btn"
              aria-label={label}
              aria-pressed={state?.preset === preset}
              title={label}
              onClick={() => send({ t: 'viewport', preset })}
            >
              <Icon size={14} />
            </button>
          ))}
        </div>
      </div>
      <div
        ref={stageRef}
        className="aicl-browser-stage"
        tabIndex={0}
        aria-label={info?.title ?? 'Browser page'}
        onPointerMove={onPointerMove}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onContextMenu={(e) => e.preventDefault()}
      >
        <canvas ref={canvasRef} className="aicl-browser-canvas" />
        {dot && fit ? (
          <span key={dot.key} className="aicl-browser-dot" style={{ left: fit.ox + dot.nx * fit.dw, top: fit.oy + dot.ny * fit.dh }} />
        ) : null}
        {driving ? (
          <span className="aicl-browser-driving" role="status">
            <Bot size={12} /> Agent is driving
          </span>
        ) : null}
        {!connected ? <span className="aicl-browser-status">{state ? 'Reconnecting…' : 'Connecting…'}</span> : null}
      </div>
    </div>
  );
}
