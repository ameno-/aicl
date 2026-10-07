/**
 * Scratchpad tools for the Pi agent. Each tool is a thin call into the relay;
 * the shape semantics live in the browser executor.
 */

import { defineTool } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import { COMPONENTS, COMPONENT_NAMES } from '../shared/components.ts';
import { COLORS, FILLS, summarize, type ScratchOp, type ScratchResult } from '../shared/scratch.ts';
import { NoCanvasError, type Relay } from './relay.ts';
import { snapshotRecords, type WorkspaceStore } from './store.ts';

const literals = <T extends readonly string[]>(values: T) => Type.Union(values.map((v) => Type.Literal(v)));

const Point = Type.Object({ x: Type.Number(), y: Type.Number() });
const Endpoint = Type.Union([Type.String({ description: 'id of a shape to bind to' }), Point]);
const Color = literals(COLORS);

const Props = Type.Record(Type.String(), Type.Unknown(), {
  description: 'Component props as a JSON object; see the scratch_add description for each component.',
});

/** One line per component for the scratch_add description. */
export function describeComponents(): string {
  return COMPONENTS.map((c) => `- ${c.name}: ${c.description} props: ${c.propsHint}`).join('\n');
}

const AddShape = Type.Object({
  kind: literals(['text', 'rect', 'ellipse', 'note', 'arrow', 'component', 'image'] as const),
  src: Type.Optional(Type.String({ description: 'kind "image": URL, /api/file path, or a reference ref from ref_search.' })),
  alt: Type.Optional(Type.String({ description: 'kind "image": what the image shows.' })),
  id: Type.Optional(Type.String({ description: 'Stable handle for later edits and arrow binding, e.g. "gateway".' })),
  x: Type.Optional(Type.Number({ description: 'Page x of the top-left corner. Not used by arrows.' })),
  y: Type.Optional(Type.Number()),
  w: Type.Optional(Type.Number({ description: 'rect/ellipse width (default 200); text wrap width.' })),
  h: Type.Optional(Type.Number({ description: 'rect/ellipse height (default 120).' })),
  text: Type.Optional(Type.String({ description: 'Label. Use \\n for line breaks.' })),
  color: Type.Optional(Color),
  fill: Type.Optional(literals(FILLS)),
  from: Type.Optional(Endpoint),
  to: Type.Optional(Endpoint),
  component: Type.Optional(literals(COMPONENT_NAMES)),
  props: Type.Optional(Props),
  title: Type.Optional(Type.String({ description: 'component header title (defaults to the component name)' })),
});

const UpdateShape = Type.Object({
  id: Type.String(),
  x: Type.Optional(Type.Number()),
  y: Type.Optional(Type.Number()),
  w: Type.Optional(Type.Number()),
  h: Type.Optional(Type.Number()),
  text: Type.Optional(Type.String()),
  color: Type.Optional(Color),
  props: Type.Optional(Props),
  title: Type.Optional(Type.String()),
});

const text = (value: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(value) }], details: {} });

export function createScratchTools(relay: Relay, store: WorkspaceStore) {
  const run = (op: ScratchOp, signal?: AbortSignal): Promise<ScratchResult> => relay.request(op, signal);

  const read = defineTool({
    name: 'scratch_read',
    label: 'Read scratchpad',
    description:
      'List every shape on the shared scratchpad as JSON: id, kind, position, size, text, color, and arrow endpoints. Use before editing, and to see what the user drew.',
    parameters: Type.Object({}),
    async execute(_id, _params, signal) {
      try {
        const result = await run({ op: 'read' }, signal);
        return text(result.op === 'read' ? result.shapes : result);
      } catch (cause) {
        if (!(cause instanceof NoCanvasError)) throw cause;
        // No tab open: answer from the last saved snapshot instead.
        const shapes = summarize(snapshotRecords(await store.readScratch()));
        return text({ source: 'disk (no canvas open)', shapes });
      }
    },
  });

  const view = defineTool({
    name: 'scratch_view',
    label: 'View scratchpad',
    description:
      'Render the scratchpad to an image so you can see freehand drawing, layout, images, and overlaps that JSON cannot show. Pass `ids` to render only some shapes.',
    parameters: Type.Object({
      ids: Type.Optional(Type.Array(Type.String(), { description: 'Render only these shapes, e.g. one screenshot or one screen' })),
    }),
    async execute(_id, params, signal) {
      const result = await run(params.ids?.length ? { op: 'view', ids: params.ids } : { op: 'view' }, signal);
      if (result.op !== 'view' || !result.png) return text({ empty: true });
      return { content: [{ type: 'image' as const, data: result.png, mimeType: 'image/png' }], details: {} };
    },
  });

  const add = defineTool({
    name: 'scratch_add',
    label: 'Draw on scratchpad',
    description:
      'Add shapes in one batch. Kinds: text, rect, ellipse, note (sticky), arrow, component, image (src + alt + w; height follows the aspect ratio). Give shapes an id so arrows can bind with from/to; bound arrows follow their shapes when moved. Shapes are created in order, so add boxes before the arrows that connect them. Returns the created ids.\n\n' +
      'kind "component" places a live component: set `component` to a name below and `props` to its JSON. w/h default to a good size.\n' +
      describeComponents(),
    parameters: Type.Object({ shapes: Type.Array(AddShape, { minItems: 1 }) }),
    async execute(_id, params, signal) {
      return text(await run({ op: 'add', shapes: params.shapes }, signal));
    },
  });

  const update = defineTool({
    name: 'scratch_update',
    label: 'Edit scratchpad',
    description:
      'Move, resize, relabel, or recolor existing shapes by id. For component shapes, `props` replaces the whole props object (scratch_read first) and `title` sets the header.',
    parameters: Type.Object({ shapes: Type.Array(UpdateShape, { minItems: 1 }) }),
    async execute(_id, params, signal) {
      return text(await run({ op: 'update', shapes: params.shapes }, signal));
    },
  });

  const remove = defineTool({
    name: 'scratch_delete',
    label: 'Delete from scratchpad',
    description: 'Delete shapes by id.',
    parameters: Type.Object({ ids: Type.Array(Type.String(), { minItems: 1 }) }),
    async execute(_id, params, signal) {
      return text(await run({ op: 'delete', ids: params.ids }, signal));
    },
  });

  const clear = defineTool({
    name: 'scratch_clear',
    label: 'Clear scratchpad',
    description: "Delete every shape. Only when the user asks for a fresh canvas — it also removes the user's own drawing.",
    parameters: Type.Object({}),
    async execute(_id, _params, signal) {
      return text(await run({ op: 'clear' }, signal));
    },
  });

  return [read, view, add, update, remove, clear];
}
