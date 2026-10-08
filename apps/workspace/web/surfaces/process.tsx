/**
 * Surface view: process (shared/surfaces.ts). A long-running command with its
 * status, uptime, listening ports (each opens the browser surface), a live log
 * tail, and Stop / Restart.
 */
import { useEffect, useRef, useState } from 'react';
import { RotateCw, Square, X } from 'lucide-react';
import './process/process.css';
import { closeSurface } from './store.ts';
import type { SurfaceViewProps } from './types.ts';

// Same event the terminal view exports; duplicated so this view does not pull xterm in.
const SURFACE_OPEN_EVENT = 'aicl-surface-open';
const ANSI = /\u001b(?:\[[0-?]*[ -/]*[@-~]|\][^\u0007\u001b]*(?:\u0007|\u001b\\)|[@-Z\\-_=>])/g;

interface ProcessMeta {
  pid?: number;
  ports?: number[];
  status?: 'running' | 'exited';
  exitCode?: number | null;
  startedAt?: number;
  endedAt?: number;
  command?: string;
}

const clock = (ms: number): string => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h ? `${h}h ${m}m` : m ? `${m}m ${s % 60}s` : `${s}s`;
};

async function openInBrowser(port: number): Promise<void> {
  const r = await fetch('/api/surfaces/browser', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url: `http://localhost:${port}` }),
  });
  const { surface } = (await r.json().catch(() => ({}))) as { surface?: { id: string } };
  if (surface) window.dispatchEvent(new CustomEvent(SURFACE_OPEN_EVENT, { detail: { kind: 'browser', id: surface.id } }));
}

const act = (id: string, verb: 'stop' | 'restart') => void fetch(`/api/surfaces/process/${encodeURIComponent(id)}/${verb}`, { method: 'POST' });

export default function ProcessSurface({ id, info, variant }: SurfaceViewProps) {
  const meta = (info?.meta ?? {}) as ProcessMeta;
  const running = meta.status === 'running';
  const [log, setLog] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const pre = useRef<HTMLPreElement>(null);
  const pinned = useRef(true);

  useEffect(() => {
    let alive = true;
    const load = () =>
      void fetch(`/api/surfaces/process/${encodeURIComponent(id)}/logs?lines=400`)
        .then((r) => (r.ok ? (r.json() as Promise<{ data: string }>) : null))
        .then((b) => b && alive && setLog(b.data.replace(ANSI, '')))
        .catch(() => {});
    load();
    const t = running ? setInterval(load, 1000) : undefined;
    return () => {
      alive = false;
      if (t) clearInterval(t);
    };
  }, [id, running, meta.startedAt]);

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [running]);

  useEffect(() => {
    const el = pre.current;
    if (el && pinned.current) el.scrollTop = el.scrollHeight;
  }, [log]);

  const uptime = meta.startedAt ? clock((running ? now : (meta.endedAt ?? now)) - meta.startedAt) : '';
  const status = running ? 'running' : `exited (${meta.exitCode ?? '?'})`;

  return (
    <div className="proc" data-variant={variant}>
      <div className="proc-head">
        <span className="proc-dot" data-status={running ? 'running' : meta.exitCode ? 'error' : 'done'} />
        <span className="proc-name">{info?.title ?? 'process'}</span>
        <span className="proc-state">
          {info ? status : 'gone'}
          {uptime ? ` · ${uptime}` : ''}
        </span>
        <span className="proc-spacer" />
        {running ? (
          <button type="button" className="proc-btn" title="Stop" aria-label="Stop process" onClick={() => act(id, 'stop')}>
            <Square size={13} />
            <span>Stop</span>
          </button>
        ) : null}
        <button type="button" className="proc-btn" title="Restart" aria-label="Restart process" disabled={!info} onClick={() => act(id, 'restart')}>
          <RotateCw size={13} />
          <span>Restart</span>
        </button>
        <button type="button" className="proc-btn proc-icon" title="Close" aria-label="Close process" onClick={() => void closeSurface('process', id)}>
          <X size={14} />
        </button>
      </div>
      <div className="proc-meta">
        <code className="proc-cmd" title={meta.command}>
          $ {meta.command ?? ''}
        </code>
        {(meta.ports ?? []).map((port) => (
          <button key={port} type="button" className="proc-port" title={`Open http://localhost:${port} in the browser`} onClick={() => void openInBrowser(port)}>
            :{port}
          </button>
        ))}
      </div>
      <pre
        className="proc-log"
        ref={pre}
        onScroll={(e) => {
          const el = e.currentTarget;
          pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
        }}
      >
        {log || '(no output yet)'}
      </pre>
    </div>
  );
}
