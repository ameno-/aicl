/** Every open surface (shared/surfaces.ts), kept live from the event stream. */
import { useSyncExternalStore } from 'react';
import type { SurfaceInfo, SurfaceKind } from '../../shared/surfaces.ts';
import { onReconnect, onServerEvent } from '../events.ts';

let surfaces: SurfaceInfo[] = [];
const listeners = new Set<() => void>();
let started = false;

const key = (s: { kind: string; id: string }) => `${s.kind}/${s.id}`;
function set(next: SurfaceInfo[]): void {
  surfaces = next;
  for (const l of [...listeners]) l();
}

function load(): void {
  void fetch('/api/surfaces')
    .then((r) => r.json() as Promise<{ surfaces: SurfaceInfo[] }>)
    .then((b) => set(b.surfaces))
    .catch(() => {});
}

function start(): void {
  if (started || typeof window === 'undefined') return;
  started = true;
  onServerEvent('surface', (e) => {
    const k = key(e.surface);
    const i = surfaces.findIndex((s) => key(s) === k);
    set(i < 0 ? [...surfaces, e.surface] : surfaces.map((s, j) => (j === i ? e.surface : s)));
  });
  onServerEvent('surface-removed', (e) => set(surfaces.filter((s) => key(s) !== key(e))));
  onReconnect(load);
  load();
}

export function useSurfaces(kind?: SurfaceKind): SurfaceInfo[] {
  start();
  const all = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => surfaces,
    () => surfaces,
  );
  return kind ? all.filter((s) => s.kind === kind) : all;
}

export function useSurface(kind: SurfaceKind, id: string): SurfaceInfo | undefined {
  return useSurfaces().find((s) => s.kind === kind && s.id === id);
}

export async function closeSurface(kind: SurfaceKind, id: string): Promise<void> {
  await fetch(`/api/surfaces/${kind}/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
