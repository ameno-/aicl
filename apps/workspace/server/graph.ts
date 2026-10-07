/**
 * Wave 2, work package E — canvas graph: /api/graph, canvas_graph tool, neighbourhood context.
 * The browser builds the graph from the live tldraw store and pushes it here.
 */
import { defineTool } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import type { CanvasGraph } from '../shared/agentic.ts';
import { formatGraph, neighbourhood } from '../shared/canvas-graph.ts';
import { emptyFeature, type FeatureContext, type FeatureModule } from './feature.ts';
import { json, readJson } from './http.ts';

const GRAPH_PROMPT = `## The canvas is a graph
Every shape on the canvas is a node; "contains" (frames, cards inside cards), "connects" (arrows), "near" (within ~160px) and "overlaps" link them. The <canvas-context> "neighbourhood" lists what surrounds the user's selection. Before placing or editing, call canvas_graph (whole canvas, or { focus: [ids], depth }) to see what is near and connected. Put related things near each other and join them with arrows when they relate.`;

const WHOLE_CANVAS_CAP = 60;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function createGraph(context: FeatureContext): FeatureModule {
  void context;
  let latest: CanvasGraph | undefined;

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

  return {
    ...emptyFeature(),
    tools: [canvasGraph],
    prompt: GRAPH_PROMPT,
    routes: {
      'PUT /api/graph': async (req, res) => {
        const body = await readJson<Partial<CanvasGraph>>(req);
        if (!Array.isArray(body.nodes) || !Array.isArray(body.edges)) return json(res, 400, { error: 'nodes and edges required' });
        latest = { nodes: body.nodes, edges: body.edges, builtAt: Date.now() };
        json(res, 200, { ok: true });
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
