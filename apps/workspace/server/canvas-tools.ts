/**
 * Canvas agent upgrades (work package D): arrange/focus tools and the HTTP
 * tool API used by the `aicl` CLI for external agents.
 * CONTRACT: shared/runtime.ts. main.ts mounts `routes` and `tools`.
 *
 * The canvas context (viewport, recent actions) is not a tool: it arrives in
 * every prompt as the hidden <canvas-context> block.
 */
import { defineTool, type ToolDefinition } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import { ARRANGE_MODES } from '../shared/scratch.ts';
import { json, readJson, type RouteTable } from './http.ts';
import type { Relay } from './relay.ts';

/** Appended to the agent's system prompt: viewport/actions context and arranging. */
export const CANVAS_PROMPT = `## Seeing what the user sees
Each prompt may end with a hidden <canvas-context> block: the user's selection, their viewport (page coordinates they are looking at), and their recent actions (e.g. "moved screen s1 to (420, 80)"). Use it:
- Place new work inside or right next to the viewport, not far away. Pass x/y yourself when you know the viewport.
- "this", "here", "that one" mean the selection or the thing in the recent actions.
- To tidy, call canvas_arrange (align, distribute, stack, grid) instead of computing coordinates by hand.
- Finish visual work with canvas_focus on the shapes you made, so the user sees them.`;

export interface CanvasToolsModule {
  tools: ToolDefinition[];
  /** Built after all tools exist, so the CLI can call any of them. */
  routes(allTools: ToolDefinition[]): RouteTable;
}

const text = (value: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(value) }], details: {} });

export function createCanvasTools(options: { relay: Relay }): CanvasToolsModule {
  const { relay } = options;

  const arrange = defineTool({
    name: 'canvas_arrange',
    label: 'Arrange shapes',
    description:
      'Tidy shapes by id using the editor itself. Modes: align-left | align-center-horizontal | align-right | align-top | align-center-vertical | align-bottom | distribute-horizontal | distribute-vertical | stack-horizontal | stack-vertical | grid. `gap` (default 40) applies to stack and grid. Stacks and grids keep the given order. Returns the arranged ids; scratch_read to see new positions.',
    parameters: Type.Object({
      ids: Type.Array(Type.String(), { minItems: 1 }),
      mode: Type.Union(ARRANGE_MODES.map((m) => Type.Literal(m))),
      gap: Type.Optional(Type.Number({ description: 'Space between shapes for stack-* and grid.' })),
    }),
    async execute(_id, params, signal) {
      return text(await relay.request({ op: 'arrange', ids: params.ids, mode: params.mode, ...(params.gap !== undefined ? { gap: params.gap } : {}) }, signal));
    },
  });

  const focus = defineTool({
    name: 'canvas_focus',
    label: 'Show the user',
    description:
      "Animate the USER's camera to shapes (`ids`) or page `bounds` so they see what you made. Call it at the end of visual work. With neither, frames everything.",
    parameters: Type.Object({
      ids: Type.Optional(Type.Array(Type.String())),
      bounds: Type.Optional(Type.Object({ x: Type.Number(), y: Type.Number(), w: Type.Number(), h: Type.Number() })),
    }),
    async execute(_id, params, signal) {
      return text(await relay.request({ op: 'focus', ...(params.ids ? { ids: params.ids } : {}), ...(params.bounds ? { bounds: params.bounds } : {}) }, signal));
    },
  });

  return { tools: [arrange, focus], routes: (all) => toolRoutes(all, relay) };
}

type Execute = (id: string, params: unknown, signal?: AbortSignal) => Promise<{ content: { type: string; text?: string; data?: string; mimeType?: string }[] }>;

/** GET /api/tools, POST /api/tools/:name — the HTTP face of every agent tool. */
export function toolRoutes(allTools: ToolDefinition[], relay?: Pick<Relay, 'broadcast'>): RouteTable {
  const byName = new Map(allTools.map((t) => [t.name, t]));
  const table: RouteTable = {
    'GET /api/tools': (_req, res) => {
      json(
        res,
        200,
        allTools.map((t) => ({ name: t.name, description: t.description, parameters: t.parameters })),
      );
    },
    'POST /api/tools/:name': async (req, res, { params }) => {
      const tool = byName.get(params['name'] ?? '');
      if (!tool) return json(res, 404, { error: `No tool named "${params['name']}".` });
      let body: { params?: unknown };
      try {
        body = await readJson<{ params?: unknown }>(req);
      } catch {
        return json(res, 400, { error: 'Body must be JSON: {"params": {...}}.' });
      }
      try {
        const result = await (tool.execute as unknown as Execute)(`http-${Date.now()}`, body.params ?? {});
        json(res, 200, { content: result.content });
      } catch (cause) {
        json(res, 200, { error: cause instanceof Error ? cause.message : String(cause) });
      }
    },
  };
  if (relay) {
    table['POST /api/navigate'] = async (req, res) => {
      const body = await readJson<{ address?: string }>(req);
      if (typeof body.address !== 'string' || !body.address.startsWith('aicl:/')) return json(res, 400, { error: 'address must look like aicl:/canvas.' });
      relay.broadcast({ type: 'navigate', address: body.address });
      json(res, 200, { ok: true });
    };
  }
  return table;
}
