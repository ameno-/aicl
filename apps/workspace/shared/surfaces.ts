/**
 * Wave 4 contract (AICL-35): surfaces.
 *
 * A surface is a live platform object that people and agents share: a
 * terminal, a browser, a file, a diff or PR review, a process, a Sideshow
 * board. Each kind has ONE server service (server/surfaces/<kind>.ts: HTTP +
 * agent tools) and ONE view (web/surfaces/<kind>.tsx) that renders anywhere:
 * a canvas card (component "surface"), a work-panel tab, the app, an applet.
 * Other tools reach the same objects through HTTP, the `aicl` CLI and MCP.
 *
 * The registry below is the common index: every open surface is listed with
 * who opened it and for which session, so the canvas, the work panel and
 * external tools all see the same set.
 */

export type SurfaceKind = 'terminal' | 'browser' | 'file' | 'diff' | 'review' | 'process' | 'sideshow';

/** Address of one surface. `id` is unique within its kind. */
export interface SurfaceRef {
  kind: SurfaceKind;
  id: string;
}

export interface SurfaceInfo extends SurfaceRef {
  title: string;
  /** One line for lists and card headers ("npm test — running", "localhost:5173", "src/app.ts"). */
  summary?: string;
  status: 'idle' | 'busy' | 'done' | 'error' | 'closed';
  openedBy: 'user' | 'agent';
  /** The session that opened it (agent) or the active session when the user did. */
  sessionId?: string;
  createdAt: number;
  updatedAt: number;
  /** Kind-specific small state (cwd, url, path, pr number…). Keep it small: it is broadcast. */
  meta?: Record<string, unknown>;
}

/** `aicl:/surface/<kind>/<id>`: links in chat and on the canvas. */
export const surfaceAddress = (ref: SurfaceRef): string => `aicl:/surface/${ref.kind}/${encodeURIComponent(ref.id)}`;

export function parseSurfaceAddress(address: string): SurfaceRef | null {
  const m = /^aicl:\/surface\/([a-z]+)\/(.+)$/.exec(address);
  if (!m || !SURFACE_KINDS.includes(m[1] as SurfaceKind)) return null;
  return { kind: m[1] as SurfaceKind, id: decodeURIComponent(m[2]!) };
}

export const SURFACE_KINDS: SurfaceKind[] = ['terminal', 'browser', 'file', 'diff', 'review', 'process', 'sideshow'];

/*
 * HTTP (registry, server/surfaces/registry.ts):
 *   GET    /api/surfaces                 → { surfaces: SurfaceInfo[] }
 *   DELETE /api/surfaces/:kind/:id       → closes it (the kind's service cleans up)
 * Events: { type: 'surface', surface } on open/change, { type: 'surface-removed', kind, id }.
 * Kind services add their own routes under /api/surfaces/<kind>/… and may
 * accept WebSocket upgrades under /ws/<kind>/… (FeatureModule.upgrades).
 *
 * Views: web/surfaces/<kind>.tsx default-exports a SurfaceViewComponent.
 */
export type SurfaceVariant = 'card' | 'panel' | 'full';
