/**
 * Surface view: terminal (shared/surfaces.ts). xterm.js on the server's pty
 * over /ws/terminal/:id. This module is lazy (surfaces/index.tsx), so xterm
 * loads only when a terminal is shown.
 */
import { useEffect, useRef } from 'react';
import { Plus, X } from 'lucide-react';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { Terminal } from '@xterm/xterm';
import '@xterm/xterm/css/xterm.css';
import './terminal/terminal.css';
import { closeSurface } from './store.ts';
import type { SurfaceViewProps } from './types.ts';

/** Canvas hosts can listen for this to place a freshly opened terminal (detail: { kind, id }). */
export const SURFACE_OPEN_EVENT = 'aicl-surface-open';

function themeFrom(el: HTMLElement) {
  const css = getComputedStyle(el);
  const get = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
  const fg = get('--aicl-terminal-fg', '#f4f4f5');
  return {
    background: get('--aicl-terminal-bg', '#18181b'),
    foreground: fg,
    cursor: fg,
    cursorAccent: get('--aicl-terminal-bg', '#18181b'),
    selectionBackground: 'rgba(161,161,170,0.35)',
  };
}

async function newTerminal(): Promise<void> {
  const r = await fetch('/api/surfaces/terminal', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
  const { surface } = (await r.json()) as { surface?: { id: string } };
  if (surface) window.dispatchEvent(new CustomEvent(SURFACE_OPEN_EVENT, { detail: { kind: 'terminal', id: surface.id } }));
}

export default function TerminalSurface({ id, info, variant }: SurfaceViewProps) {
  const wrap = useRef<HTMLDivElement>(null);
  const host = useRef<HTMLDivElement>(null);
  // The reconnect loop reads this so it stops once the surface is gone.
  const closed = useRef(false);
  closed.current = info?.status === 'closed';

  useEffect(() => {
    const wrapEl = wrap.current;
    const el = host.current;
    if (!wrapEl || !el) return;

    // Typing here must not trigger canvas shortcuts or gestures: stop events natively, before tldraw's own listeners see them.
    const stop = (e: Event) => e.stopPropagation();
    const stopped = ['keydown', 'keyup', 'keypress', 'wheel', 'dblclick', 'contextmenu'] as const;
    for (const type of stopped) wrapEl.addEventListener(type, stop);

    const term = new Terminal({
      fontFamily: getComputedStyle(el).getPropertyValue('--aicl-font-mono').trim() || 'ui-monospace, Menlo, monospace',
      fontSize: variant === 'card' ? 12 : 13,
      cursorBlink: true,
      scrollback: 5000,
      allowProposedApi: true,
      theme: themeFrom(el),
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.loadAddon(new WebLinksAddon());
    term.open(el);

    let ws: WebSocket | null = null;
    let disposed = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;
    const send = (frame: unknown) => {
      if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(frame));
    };
    const sendSize = () => send({ t: 'resize', cols: term.cols, rows: term.rows });

    const connect = () => {
      const proto = location.protocol === 'https:' ? 'wss' : 'ws';
      const socket = new WebSocket(`${proto}://${location.host}/ws/terminal/${encodeURIComponent(id)}`);
      ws = socket;
      socket.onopen = () => {
        attempts = 0;
        sendSize();
      };
      socket.onmessage = (event) => {
        const m = JSON.parse(String(event.data)) as { t: string; d?: string; code?: number };
        if (m.t === 'replay') {
          term.reset();
          term.write(m.d ?? '');
        } else if (m.t === 'out') term.write(m.d ?? '');
        else if (m.t === 'exit') term.write(`\r\n\x1b[2m[process exited with code ${m.code ?? 0}]\x1b[0m\r\n`);
      };
      socket.onclose = () => {
        if (disposed || closed.current) return;
        retry = setTimeout(connect, Math.min(500 * 2 ** attempts++, 8000));
      };
    };
    connect();

    const input = term.onData((d) => send({ t: 'in', d }));
    const resized = term.onResize(sendSize);

    let frame = 0;
    const refit = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (el.clientWidth > 20 && el.clientHeight > 20) {
          try {
            fit.fit();
          } catch {
            /* detached */
          }
        }
      });
    };
    const observer = new ResizeObserver(refit);
    observer.observe(el);
    refit();

    const retheme = new MutationObserver(() => {
      term.options.theme = themeFrom(el);
    });
    retheme.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme'] });

    return () => {
      disposed = true;
      clearTimeout(retry);
      cancelAnimationFrame(frame);
      observer.disconnect();
      retheme.disconnect();
      input.dispose();
      resized.dispose();
      ws?.close();
      term.dispose();
      for (const type of stopped) wrapEl.removeEventListener(type, stop);
    };
  }, [id, variant]);

  return (
    <div className="term" data-variant={variant} ref={wrap}>
      <div className="term-head">
        <span className="term-dot" data-status={info?.status ?? 'idle'} title={info?.status ?? 'connecting'} />
        <span className="term-title">{info?.title ?? 'terminal'}</span>
        <span className="term-summary">{info?.summary ?? ''}</span>
        <button type="button" className="term-btn" title="New terminal" aria-label="New terminal" onClick={() => void newTerminal()}>
          <Plus size={14} />
        </button>
        <button type="button" className="term-btn" title="Close terminal" aria-label="Close terminal" onClick={() => void closeSurface('terminal', id)}>
          <X size={14} />
        </button>
      </div>
      <div className="term-body" ref={host} />
    </div>
  );
}
