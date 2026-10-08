/**
 * Below the chats tree (AICL-46): what is live right now — open terminals,
 * processes, browser pages and diffs — and the external clients (MCP bridges,
 * the CLI) connected to the assistant. Compact, collapsible, clickable.
 */
import { useEffect, useState, useSyncExternalStore } from 'react';
import { ChevronRight, Cpu, GitCompare, Globe, Plug, Radio, SquareTerminal } from 'lucide-react';
import type { ClientConnection } from '../../shared/runtime.ts';
import type { SurfaceInfo, SurfaceKind } from '../../shared/surfaces.ts';
import { onReconnect, onServerEvent } from '../events.ts';
import { navigate } from '../router.ts';
import { useSurfaces } from '../surfaces/index.tsx';
import { setPrefs } from './prefs.ts';

/* Connections store: GET /api/connections + 'connection' events. */
let connections: ClientConnection[] = [];
let started = false;
const listeners = new Set<() => void>();
const set = (next: ClientConnection[]) => {
  connections = next;
  for (const l of [...listeners]) l();
};
const load = () =>
  void fetch('/api/connections')
    .then((r) => r.json() as Promise<{ connections: ClientConnection[] }>)
    .then((b) => set(b.connections))
    .catch(() => undefined);
function useConnections(): ClientConnection[] {
  if (!started && typeof window !== 'undefined') {
    started = true;
    onServerEvent('connection', (e) => set([e.connection, ...connections.filter((c) => c.name !== e.connection.name)]));
    onReconnect(load);
    load();
  }
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => connections,
    () => connections,
  );
}

const ICON: Partial<Record<SurfaceKind, typeof Globe>> = { terminal: SquareTerminal, process: Cpu, browser: Globe, diff: GitCompare, review: GitCompare, sideshow: Radio };
/** Where each kind opens in the work panel; kinds without a tab open on the canvas. */
const TAB: Partial<Record<SurfaceKind, string>> = { terminal: 'terminal', browser: 'browser', diff: 'changes', review: 'changes', file: 'files' };

function open(s: SurfaceInfo): void {
  const tab = TAB[s.kind];
  if (tab) {
    setPrefs({ workPanelOpen: true, workTab: tab });
    navigate({ tab: 'agent', ...(s.sessionId ? { sessionId: s.sessionId } : {}) });
  } else navigate({ tab: 'canvas' });
}

/** "2m ago" style, refreshed by the caller's re-render. */
const since = (t: number) => {
  const s = Math.round((Date.now() - t) / 1000);
  return s < 60 ? 'now' : s < 3600 ? `${Math.floor(s / 60)}m` : `${Math.floor(s / 3600)}h`;
};

function Group({ title, count, children, defaultOpen }: { title: string; count: number; children: React.ReactNode; defaultOpen: boolean }) {
  const [openState, setOpen] = useState(defaultOpen);
  return (
    <section className="lr-group" data-open={openState || undefined}>
      <button type="button" className="lr-head" aria-expanded={openState} onClick={() => setOpen((o) => !o)}>
        <ChevronRight size={12} aria-hidden="true" className="lr-chev" />
        <span>{title}</span>
        <span className="lr-count">{count}</span>
      </button>
      {openState ? <ul className="lr-list">{children}</ul> : null}
    </section>
  );
}

export function LiveResources() {
  // Files are many and live in the Files tab; the rest are "running things".
  const live = useSurfaces().filter((s) => s.kind !== 'file' && s.status !== 'closed');
  const clients = useConnections();
  const [, tick] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => tick((n) => n + 1), 30_000);
    return () => window.clearInterval(t);
  }, []);
  if (!live.length && !clients.length) return null;
  return (
    <div className="lr" data-live-resources="">
      {live.length ? (
        <Group title="Live" count={live.length} defaultOpen>
          {live
            .slice()
            .sort((a, b) => b.updatedAt - a.updatedAt)
            .map((s) => {
              const Icon = ICON[s.kind] ?? Radio;
              return (
                <li key={`${s.kind}/${s.id}`}>
                  <button type="button" className="lr-row" title={s.summary ?? s.title} onClick={() => open(s)}>
                    <Icon size={13} aria-hidden="true" />
                    <span className="lr-name">{s.title}</span>
                    <span className="lr-dot" data-status={s.status} aria-label={s.status} />
                  </button>
                </li>
              );
            })}
        </Group>
      ) : null}
      {clients.length ? (
        <Group title="Connected" count={clients.length} defaultOpen={false}>
          {clients.map((c) => (
            <li key={c.name}>
              <span className="lr-row" title={`${c.calls} tool call${c.calls === 1 ? '' : 's'}${c.lastTool ? ` · last: ${c.lastTool}` : ''}`}>
                <Plug size={13} aria-hidden="true" />
                <span className="lr-name">{c.name.replace(/^mcp:/, '')}</span>
                <span className="lr-meta">{c.kind === 'mcp' ? 'MCP' : c.kind === 'cli' ? 'CLI' : ''} · {since(c.lastSeen)}</span>
              </span>
            </li>
          ))}
        </Group>
      ) : null}
    </div>
  );
}
