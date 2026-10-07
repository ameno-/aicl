/**
 * Keeps a live CanvasGraph from the tldraw store: rebuilt (debounced) on
 * document changes and pushed to the server (PUT /api/graph) so tools can read it.
 */
import type { Editor } from 'tldraw';
import type { CanvasGraph } from '../shared/agentic.ts';
import { diffGraphs } from '../shared/canvas-changes.ts';
import { buildGraph, neighbourhood } from '../shared/canvas-graph.ts';
import { agentRecently } from './canvasContext.ts';
import { recordChanges, startChangeTracker } from './changes.ts';

const REBUILD_MS = 150;

let tracked: Editor | null = null;
let graph: CanvasGraph | null = null;
let dirty = true;
let timer: ReturnType<typeof setTimeout> | undefined;
let lastPushed = '';

function rebuild(editor: Editor): CanvasGraph {
  const records = [
    ...editor.getCurrentPageShapes(),
    ...editor.store.allRecords().filter((r) => r.typeName === 'binding'),
  ];
  const before = graph;
  graph = buildGraph(records, (id) => {
    const b = editor.getShapePageBounds(id as never);
    return b ? { x: b.x, y: b.y, w: b.w, h: b.h } : undefined;
  });
  dirty = false;
  // Links that appeared/disappeared since the last build (only while tracking this editor).
  if (before && tracked === editor) recordChanges(diffGraphs(before, graph, agentRecently() ? 'agent' : 'user'));
  return graph;
}

function push(g: CanvasGraph): void {
  const body = JSON.stringify({ nodes: g.nodes, edges: g.edges });
  if (body === lastPushed) return;
  lastPushed = body;
  void fetch('/api/graph', { method: 'PUT', headers: { 'content-type': 'application/json' }, body }).catch(() => {
    lastPushed = '';
  });
}

/** Start tracking an editor; returns a stop function. */
export function startGraphTracker(editor: Editor): () => void {
  tracked = editor;
  dirty = true;
  const schedule = () => {
    dirty = true;
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (tracked === editor) push(rebuild(editor));
    }, REBUILD_MS);
  };
  const stop = editor.store.listen(schedule, { scope: 'document' });
  const stopChanges = startChangeTracker(editor);
  schedule();
  return () => {
    stop();
    stopChanges();
    clearTimeout(timer);
    if (tracked === editor) {
      tracked = null;
      graph = null;
    }
  };
}

/** The current graph (rebuilt now if the canvas changed since the last build). */
export function getGraph(): CanvasGraph | null {
  if (!tracked) return graph;
  return dirty || !graph ? rebuild(tracked) : graph;
}

/** The nodes `ids` plus what is near, inside, and connected to them. */
export function getNeighbourhood(ids: string[], depth = 1): { nodes: CanvasGraph['nodes']; edges: CanvasGraph['edges'] } | undefined {
  const g = getGraph();
  if (!g || !ids.length) return undefined;
  const sub = neighbourhood(g, ids, depth);
  return sub.nodes.length ? { nodes: sub.nodes, edges: sub.edges } : undefined;
}
