/**
 * The surface index (shared/surfaces.ts): every open surface, broadcast to
 * every page. Kind services (./terminal.ts, ./browser.ts, …) call upsert when
 * they open or change something and remove when it closes.
 */
import type { SurfaceInfo, SurfaceKind } from '../../shared/surfaces.ts';
import { json, type RouteTable } from '../http.ts';
import type { Relay } from '../relay.ts';

export interface SurfaceRegistry {
  upsert(info: Omit<SurfaceInfo, 'createdAt' | 'updatedAt'> & Partial<Pick<SurfaceInfo, 'createdAt'>>): SurfaceInfo;
  /** Merge a change into an open surface; ignored when it is not open. */
  patch(kind: SurfaceKind, id: string, change: Partial<Omit<SurfaceInfo, 'kind' | 'id'>>): SurfaceInfo | undefined;
  remove(kind: SurfaceKind, id: string): void;
  get(kind: SurfaceKind, id: string): SurfaceInfo | undefined;
  list(kind?: SurfaceKind): SurfaceInfo[];
  /** A kind service registers how to close its surfaces (DELETE /api/surfaces/:kind/:id). */
  onClose(kind: SurfaceKind, close: (id: string) => void | Promise<void>): void;
  routes: RouteTable;
}

export function createSurfaceRegistry(relay: Pick<Relay, 'broadcast'>): SurfaceRegistry {
  const open = new Map<string, SurfaceInfo>();
  const closers = new Map<SurfaceKind, (id: string) => void | Promise<void>>();
  const key = (kind: string, id: string) => `${kind}/${id}`;

  const registry: SurfaceRegistry = {
    upsert(info) {
      const prev = open.get(key(info.kind, info.id));
      const now = Date.now();
      const next: SurfaceInfo = { ...prev, ...info, createdAt: prev?.createdAt ?? info.createdAt ?? now, updatedAt: now };
      open.set(key(info.kind, info.id), next);
      relay.broadcast({ type: 'surface', surface: next });
      return next;
    },
    patch(kind, id, change) {
      const prev = open.get(key(kind, id));
      if (!prev) return undefined;
      return registry.upsert({ ...prev, ...change, kind, id });
    },
    remove(kind, id) {
      if (!open.delete(key(kind, id))) return;
      relay.broadcast({ type: 'surface-removed', kind, id });
    },
    get: (kind, id) => open.get(key(kind, id)),
    list: (kind) => [...open.values()].filter((s) => !kind || s.kind === kind).sort((a, b) => a.createdAt - b.createdAt),
    onClose(kind, close) {
      closers.set(kind, close);
    },
    routes: {
      'GET /api/surfaces': (_req, res) => json(res, 200, { surfaces: registry.list() }),
      'DELETE /api/surfaces/:kind/:id': async (_req, res, { params }) => {
        const kind = params['kind'] as SurfaceKind;
        const id = params['id']!;
        if (!open.has(key(kind, id))) return json(res, 404, { message: 'no such surface' });
        await closers.get(kind)?.(id);
        registry.remove(kind, id);
        json(res, 200, { ok: true });
      },
    },
  };
  return registry;
}
