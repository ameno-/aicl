/**
 * Applets in the browser (work package B): the applet list, the workspace
 * config, and AppletHost, which loads /api/applets/:id/bundle.js through the
 * host runtime (./host.ts) and renders it in an error boundary.
 */
import { Component, useEffect, useState, useSyncExternalStore, type ComponentType, type ReactNode } from 'react';
import type { AppletInfo, WorkspaceConfig } from '../../shared/runtime.ts';
import { onServerEvent } from '../events.ts';
import { sendToSession } from '../sessionsApi.ts';
import './host.ts';

/* ── applet list ─────────────────────────────────────────────────── */

let applets: AppletInfo[] = [];
let loadedList = false;
let started = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function refresh(): void {
  fetch('/api/applets')
    .then((r) => r.json() as Promise<{ applets: AppletInfo[] }>)
    .then((body) => {
      applets = body.applets;
      loadedList = true;
      emit();
    })
    .catch(() => undefined);
}

function start(): void {
  if (started) return;
  started = true;
  refresh();
  onServerEvent('applet', (event) => {
    const next = event.applet;
    applets = applets.some((a) => a.id === next.id)
      ? applets.map((a) => (a.id === next.id ? next : a))
      : [...applets, next].sort((a, b) => a.id.localeCompare(b.id));
    emit();
  });
  onServerEvent('applet-removed', (event) => {
    applets = applets.filter((a) => a.id !== event.id);
    emit();
  });
}

function subscribe(listener: () => void): () => void {
  start();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useApplets(): AppletInfo[] {
  return useSyncExternalStore(subscribe, () => applets, () => applets);
}

/* ── workspace config ────────────────────────────────────────────── */

let config: WorkspaceConfig = { name: 'Workspace', overview: [] };
let configStarted = false;
const configListeners = new Set<() => void>();
const emitConfig = () => configListeners.forEach((l) => l());

function fetchConfig(): void {
  fetch('/api/workspace')
    .then((r) => r.json() as Promise<WorkspaceConfig>)
    .then((next) => {
      if (JSON.stringify(next) !== JSON.stringify(config)) {
        config = next;
        emitConfig();
      }
    })
    .catch(() => undefined);
}

function startConfig(): void {
  if (configStarted) return;
  configStarted = true;
  fetchConfig();
  // applet_place on 'overview' edits workspace.json and announces it with an 'applet' event.
  onServerEvent('applet', fetchConfig);
}

function setConfig(next: WorkspaceConfig): void {
  const previous = config;
  config = next;
  emitConfig();
  fetch('/api/workspace', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(next) })
    .then((r) => {
      if (!r.ok) throw new Error(String(r.status));
    })
    .catch(() => {
      config = previous;
      emitConfig();
    });
}

export function useWorkspaceConfig(): [WorkspaceConfig, (next: WorkspaceConfig) => void] {
  const value = useSyncExternalStore(
    (l) => {
      startConfig();
      configListeners.add(l);
      return () => configListeners.delete(l);
    },
    () => config,
    () => config,
  );
  return [value, setConfig];
}

/* ── AppletHost ──────────────────────────────────────────────────── */

function reportError(id: string, error: unknown): void {
  const e = error instanceof Error ? error : new Error(String(error));
  fetch(`/api/applets/${encodeURIComponent(id)}/log`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ message: e.message, stack: e.stack }),
  }).catch(() => undefined);
}

function ErrorCard({ id, message }: { id: string; message: string }) {
  return (
    <div
      role="alert"
      style={{
        padding: 12,
        display: 'grid',
        gap: 8,
        alignContent: 'start',
        fontSize: 12,
        height: '100%',
        overflow: 'auto',
        color: 'var(--aicl-color-text-muted, inherit)',
      }}
    >
      <div style={{ fontWeight: 600 }}>“{id}” hit an error</div>
      <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'inherit', opacity: 0.8 }}>{message.slice(0, 600)}</pre>
      <button
        type="button"
        onClick={() => sendToSession(`The applet "${id}" is broken:\n${message.slice(0, 1500)}\nCheck applet_logs, fix it, and rebuild.`)}
        style={{
          justifySelf: 'start',
          font: 'inherit',
          padding: '4px 10px',
          borderRadius: 6,
          border: '1px solid var(--aicl-color-border, currentColor)',
          background: 'transparent',
          color: 'inherit',
          cursor: 'pointer',
        }}
      >
        Ask the agent to fix it
      </button>
    </div>
  );
}

class Boundary extends Component<{ id: string; children: ReactNode }, { error?: string }> {
  state: { error?: string } = {};
  static getDerivedStateFromError(error: unknown) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
  componentDidCatch(error: unknown) {
    reportError(this.props.id, error);
  }
  render() {
    return this.state.error !== undefined ? <ErrorCard id={this.props.id} message={this.state.error} /> : this.props.children;
  }
}

type Loaded = { status: 'loading' } | { status: 'ready'; Applet: ComponentType } | { status: 'error'; message: string };

/** Renders one applet filling its container. */
export function AppletHost({ id }: { id: string }) {
  const list = useApplets();
  const info = list.find((a) => a.id === id);
  const builtAt = info?.builtAt;
  // Wait for the list before judging that an applet is missing.
  const known = loadedList || info !== undefined;
  const [loaded, setLoaded] = useState<Loaded>({ status: 'loading' });

  useEffect(() => {
    if (!known || !info) return;
    let cancelled = false;
    import(/* @vite-ignore */ `/api/applets/${encodeURIComponent(id)}/bundle.js?v=${builtAt ?? 0}`)
      .then((mod: { default?: unknown }) => {
        if (cancelled) return;
        if (typeof mod.default !== 'function' && (typeof mod.default !== 'object' || mod.default === null)) {
          throw new Error('The applet has no default export.');
        }
        setLoaded({ status: 'ready', Applet: mod.default as ComponentType });
      })
      .catch(async (cause: unknown) => {
        if (cancelled) return;
        // A failed build answers with its errors as JSON; show those rather than the generic import failure.
        let message = cause instanceof Error ? cause.message : String(cause);
        try {
          const r = await fetch(`/api/applets/${encodeURIComponent(id)}/bundle.js`);
          if (!r.ok) message = ((await r.json()) as { error?: string }).error ?? message;
        } catch {
          /* keep the import error */
        }
        if (cancelled) return;
        reportError(id, new Error(message));
        setLoaded({ status: 'error', message });
      });
    return () => {
      cancelled = true;
    };
  }, [id, builtAt, known, info === undefined]);

  if (known && !info) return <ErrorCard id={id} message="This applet no longer exists." />;
  if (loaded.status === 'error') return <ErrorCard id={id} message={loaded.message} />;
  if (loaded.status === 'loading') return <div style={{ padding: 12, fontSize: 12, opacity: 0.6 }}>Loading…</div>;
  const { Applet } = loaded;
  return (
    <div style={{ width: '100%', height: '100%', overflow: 'auto', position: 'relative' }}>
      <Boundary id={id} key={builtAt ?? 0}>
        <Applet />
      </Boundary>
    </div>
  );
}
