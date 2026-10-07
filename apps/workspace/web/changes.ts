/**
 * Records what changed on the canvas, and who did it (AICL-30). Listens to the
 * tldraw store, tags changes made while the agent's relay ops execute as
 * 'agent' (everything else is 'user'), coalesces bursts, keeps a ring buffer,
 * and posts batches to POST /api/graph/changes (see shared/canvas-changes.ts).
 */
import type { Editor } from 'tldraw';
import { coalesce, diffRecords, type CanvasChange, type ChangeSource } from '../shared/canvas-changes.ts';
import { isAgentOrigin } from './canvasContext.ts';

const FLUSH_MS = 500;
const RING = 500;

let pending: CanvasChange[] = [];
let timer: ReturnType<typeof setTimeout> | undefined;
let seq = 0;
const ring: CanvasChange[] = [];

/** The last ~500 flushed changes, oldest first (local seq numbers; the server assigns its own). */
export function getChanges(): CanvasChange[] {
  return ring;
}

/** Queue changes (from the store listener or the graph differ). */
export function recordChanges(changes: CanvasChange[]): void {
  if (!changes.length) return;
  pending.push(...changes);
  clearTimeout(timer);
  timer = setTimeout(flushChanges, FLUSH_MS);
}

/** Send what is pending now (called before a chat request so the agent sees fresh state). */
export function flushChanges(): void {
  clearTimeout(timer);
  if (!pending.length) return;
  const batch = coalesce(pending.map((c, i) => ({ ...c, seq: i + 1 }))).map((c) => ({ ...c, seq: ++seq }));
  pending = [];
  ring.push(...batch);
  if (ring.length > RING) ring.splice(0, ring.length - RING);
  void fetch('/api/graph/changes', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ changes: batch }),
    keepalive: true,
  }).catch(() => undefined);
}

/** Start tracking an editor; returns a stop function. */
export function startChangeTracker(editor: Editor): () => void {
  const stop = editor.store.listen(
    ({ changes, source }) => {
      if (source === 'remote') return;
      const at = Date.now();
      const out: CanvasChange[] = [];
      const sourceOf = (id: string): ChangeSource => (isAgentOrigin(id) ? 'agent' : 'user');
      for (const rec of Object.values(changes.added)) if (rec.typeName === 'shape') out.push(...diffRecords(undefined, rec, sourceOf(rec.id), at));
      for (const rec of Object.values(changes.removed)) if (rec.typeName === 'shape') out.push(...diffRecords(rec, undefined, sourceOf(rec.id), at));
      for (const [from, to] of Object.values(changes.updated)) if (to.typeName === 'shape') out.push(...diffRecords(from, to, sourceOf(to.id), at));
      recordChanges(out);
    },
    { scope: 'document' },
  );
  return () => {
    stop();
    flushChanges();
  };
}
