/**
 * Wave 2, work package E — canvas graph: /api/graph, canvas_graph tool, neighbourhood context.
 * The browser builds the graph from the live tldraw store and pushes it here.
 */
import { defineTool } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import type { CanvasGraph } from '../shared/agentic.ts';
import { ChangeLog, formatChanges, stateTimeline, type CanvasChange } from '../shared/canvas-changes.ts';
import { formatGraph, neighbourhood } from '../shared/canvas-graph.ts';
import { emptyFeature, type FeatureContext, type FeatureModule } from './feature.ts';
import { json, readJson } from './http.ts';

const GRAPH_PROMPT = `## The canvas is a graph
Every shape on the canvas is a node; "contains" (frames, cards inside cards), "connects" (arrows), "near" (within ~160px) and "overlaps" link them. The <canvas-context> "neighbourhood" lists what surrounds the user's selection. Before placing or editing, call canvas_graph (whole canvas, or { focus: [ids], depth }) to see what is near and connected. Put related things near each other and join them with arrows when they relate.

## What changed on the canvas
A hidden <canvas-context> block may start with "since your last turn:", listing what the user (and agent) changed on the canvas since your previous message. Acknowledge the changes that matter to the request, never undo or overwrite the user's edits unless asked, and treat "agent" lines as your own earlier work. Call canvas_changes ({ since?, shape? }) for older history or a shape's state timeline (e.g. plan 1/3 → 2/3 → 3/3).`;

const WHOLE_CANVAS_CAP = 60;
const HISTORY_CAP = 30;
const KINDS = ['created', 'deleted', 'moved', 'resized', 'edited', 'state', 'linked', 'unlinked'];
const isChange = (c: unknown): c is CanvasChange => {
  const x = c as Partial<CanvasChange> | null;
  return !!x && typeof x.id === 'string' && typeof x.label === 'string' && typeof x.detail === 'string' && typeof x.at === 'number' &&
    (x.source === 'user' || x.source === 'agent') && typeof x.kind === 'string' && KINDS.includes(x.kind);
};
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function createGraph(context: FeatureContext): FeatureModule {
  void context;
  let latest: CanvasGraph | undefined;
  const log = new ChangeLog();

  const canvasGraph = defineTool({
    name: 'canvas_graph',
    label: 'Canvas graph',
    description:
      'The canvas as a graph: what is near, inside, and connected to what, with bounds (@x,y wxh). Pass focus (shape ids) to see just their neighbourhood, depth hops out (default 1). Without focus, returns the whole canvas (capped).',
    parameters: Type.Object({
      focus: Type.Optional(Type.Array(Type.String(), { description: 'Shape ids to centre on.' })),
      depth: Type.Optional(Type.Number({ description: 'Hops out from focus (default 1).' })),
    }),
    async execute(_id, params) {
      await wait(350); // let the browser's debounced push catch up with shapes just created
      const text = (t: string) => ({ content: [{ type: 'text' as const, text: t }], details: {} });
      if (!latest) return text('No canvas graph yet (the canvas is not open in a browser).');
      if (params.focus?.length) {
        const sub = neighbourhood(latest, params.focus, params.depth ?? 1);
        return text(sub.nodes.length ? formatGraph(sub) : 'None of those ids are on the canvas.');
      }
      return text(latest.nodes.length ? formatGraph(latest, { maxNodes: WHOLE_CANVAS_CAP }) : 'The canvas is empty.');
    },
  });

  const canvasChanges = defineTool({
    name: 'canvas_changes',
    label: 'Canvas changes',
    description:
      'What changed on the canvas over time, and who did it (user or agent). Pass since (a seq number) for changes after it, and/or shape (a shape id) for that shape\'s history plus its component state timeline (e.g. plan 1/3 → 2/3 → 3/3). Default: the most recent changes.',
    parameters: Type.Object({
      since: Type.Optional(Type.Number({ description: 'Only changes with seq greater than this.' })),
      shape: Type.Optional(Type.String({ description: 'Shape id to show the history of.' })),
    }),
    async execute(_id, params) {
      await wait(350);
      return { content: [{ type: 'text' as const, text: historyText(params.since, params.shape) }], details: {} };
    },
  });

  function historyText(since?: number, shape?: string): string {
    const changes = log.since(since ?? 0, shape);
    if (!changes.length) return `No changes recorded${shape ? ` for ${shape}` : ''}${since ? ` after seq ${since}` : ''}. (head: seq ${log.head})`;
    const recent = since === undefined && !shape ? changes.slice(-HISTORY_CAP) : changes;
    const text = formatChanges(recent, HISTORY_CAP);
    const timeline = shape ? stateTimeline(changes, shape) : '';
    return `${text}${timeline ? `\n\nstate timeline:\n${timeline}` : ''}\n\n(head: seq ${log.head})`;
  }

  return {
    ...emptyFeature(),
    tools: [canvasGraph, canvasChanges],
    async contextFor(sessionId) {
      await wait(250); // let the browser's debounced change push land
      const changes = log.take(sessionId);
      if (!changes) return '';
      const text = changes.length ? formatChanges(changes) : 'no canvas changes';
      return `\n\n<canvas-context>\nsince your last turn:\n${text}\n</canvas-context>`;
    },
    prompt: GRAPH_PROMPT,
    routes: {
      'PUT /api/graph': async (req, res) => {
        const body = await readJson<Partial<CanvasGraph>>(req);
        if (!Array.isArray(body.nodes) || !Array.isArray(body.edges)) return json(res, 400, { error: 'nodes and edges required' });
        latest = { nodes: body.nodes, edges: body.edges, builtAt: Date.now() };
        json(res, 200, { ok: true });
      },
      'POST /api/graph/changes': async (req, res) => {
        const body = await readJson<{ changes?: unknown }>(req);
        if (!Array.isArray(body.changes)) return json(res, 400, { error: 'changes required' });
        log.add(body.changes.filter(isChange));
        json(res, 200, { ok: true, head: log.head });
      },
      'GET /api/graph/changes': (_req, res, { url }) => {
        const since = Number(url.searchParams.get('since') ?? 0);
        const shape = url.searchParams.get('shape') ?? undefined;
        const changes = log.since(Number.isFinite(since) ? since : 0, shape);
        json(res, 200, { head: log.head, changes, ...(shape ? { timeline: stateTimeline(changes, shape) } : {}) });
      },
      'GET /api/graph': (_req, res, { url }) => {
        if (!latest) return json(res, 200, { nodes: [], edges: [], builtAt: 0 });
        const focus = (url.searchParams.get('focus') ?? '').split(',').filter(Boolean);
        const depth = Number(url.searchParams.get('depth') ?? 1);
        json(res, 200, focus.length ? neighbourhood(latest, focus, Number.isFinite(depth) ? depth : 1) : latest);
      },
    },
  };
}
