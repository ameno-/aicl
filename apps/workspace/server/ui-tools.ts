/**
 * Agent tools for designing chat UIs as screens (ScreenSpec trees stored on
 * `aicl-component` shapes with component "screen"). Spec logic lives in
 * shared/ui-ops.ts and is injectable so tests do not depend on it.
 */

import { defineTool } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import type { ScratchOp, ScratchResult } from '../shared/scratch.ts';
import * as realOps from '../shared/ui-ops.ts';
import {
  FRAME_SIZES,
  NODE_TYPES,
  THEME_PRESETS,
  type ScreenFrame,
  type ScreenSpec,
  type UiNode,
  type UiPatchOp,
} from '../shared/ui-spec.ts';
import type { Relay } from './relay.ts';

export interface UiOps {
  normalizeSpec: (raw: unknown) => ScreenSpec;
  applyPatch: (spec: ScreenSpec, ops: UiPatchOp[]) => ScreenSpec;
  findNode: (spec: ScreenSpec, id: string) => { node: UiNode } | undefined;
  outlineSpec: (spec: ScreenSpec) => string;
  toReactCode: (spec: ScreenSpec) => string;
}

type RelayLike = Pick<Relay, 'request'>;

const literals = <T extends readonly string[]>(values: T) => Type.Union(values.map((v) => Type.Literal(v)));
const FRAMES = Object.keys(FRAME_SIZES) as ScreenFrame[];
const PRESETS = Object.keys(THEME_PRESETS) as (keyof typeof THEME_PRESETS)[];
const HEADER = 32;
const PREVIEW_SCALE = 0.6;

/** Compact generated catalog of elements, themes and frames, for tool descriptions. */
export function describeCatalog(): string {
  const nodes = NODE_TYPES.map((n) => `- ${n.type}${n.container ? ' (container)' : ''}: ${n.description} props: ${n.propsHint}`).join('\n');
  const themes = PRESETS.map((p) => `${p}: ${THEME_PRESETS[p].description}`).join('; ');
  const frames = FRAMES.map((f) => `${f} ${FRAME_SIZES[f].w}x${FRAME_SIZES[f].h}`).join(', ');
  return `Elements (node = { id, type, props?, children? }; only containers take children):\n${nodes}\nTheme presets: ${themes}.\nFrames: ${frames}.`;
}

const Overrides = Type.Record(Type.String(), Type.Unknown(), {
  description: 'Theme token overrides: mode, accent, accentFg, bg, surface, sidebar, text, textMuted, border, bubbleUser, radius (px), font, density.',
});
const Preset = literals(PRESETS);
const Frame = literals(FRAMES);
const Node = Type.Object(
  {
    id: Type.String({ description: 'Unique within the screen; short stable slug like "composer".' }),
    type: Type.String(),
    props: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
    children: Type.Optional(Type.Array(Type.Any())),
  },
  { description: 'A screen element.' },
);

const PatchOp = Type.Union([
  Type.Object({ op: Type.Literal('update'), id: Type.String(), props: Type.Record(Type.String(), Type.Unknown(), { description: 'shallow-merged into the node props' }) }),
  Type.Object({ op: Type.Literal('replace'), id: Type.String(), node: Node }),
  Type.Object({ op: Type.Literal('insert'), parent: Type.String(), index: Type.Optional(Type.Number()), node: Node }),
  Type.Object({ op: Type.Literal('remove'), id: Type.String() }),
  Type.Object({ op: Type.Literal('move'), id: Type.String(), parent: Type.String(), index: Type.Optional(Type.Number()) }),
  Type.Object({ op: Type.Literal('theme'), preset: Type.Optional(Preset), overrides: Type.Optional(Overrides) }),
  Type.Object({ op: Type.Literal('rename'), name: Type.String() }),
  Type.Object({ op: Type.Literal('frame'), frame: Frame }),
]);

const text = (value: unknown) => ({ content: [{ type: 'text' as const, text: typeof value === 'string' ? value : JSON.stringify(value) }], details: {} });

export function createUiTools(relay: RelayLike, ops: UiOps = realOps) {
  const run = (op: ScratchOp, signal?: AbortSignal): Promise<ScratchResult> => relay.request(op, signal);

  const load = async (id: string, signal?: AbortSignal): Promise<ScreenSpec> => {
    const result = await run({ op: 'ui_get', id }, signal);
    if (result.op !== 'ui_get') throw new Error('Unexpected relay answer for ui_get.');
    return ops.normalizeSpec(result.spec);
  };
  const store = async (id: string, spec: ScreenSpec, signal?: AbortSignal) => {
    await run({ op: 'ui_set', id, spec }, signal);
  };

  const create = defineTool({
    name: 'ui_create_screen',
    label: 'Create screen',
    description:
      'Create a chat UI screen on the canvas: a device-sized frame rendering a tree of decoupled chat elements with a theme. Returns the screen id and an outline of node ids; edit it afterwards with ui_patch_screen.\n\n' +
      describeCatalog(),
    parameters: Type.Object({
      id: Type.Optional(Type.String({ description: 'Stable handle for the screen shape, e.g. "agent-thread".' })),
      name: Type.Optional(Type.String()),
      frame: Type.Optional(Frame),
      theme: Type.Optional(Type.Object({ preset: Type.Optional(Preset), overrides: Type.Optional(Overrides) })),
      root: Type.Optional(Node),
      x: Type.Optional(Type.Number()),
      y: Type.Optional(Type.Number()),
    }),
    async execute(_id, params, signal) {
      const spec = ops.normalizeSpec({
        name: params.name,
        frame: params.frame,
        theme: params.theme,
        root: params.root ?? {
          id: 'root',
          type: 'column',
          props: { surface: 'bg', grow: true },
          children: [{ id: 'empty', type: 'emptyState', props: { title: 'Empty screen', hint: 'Add elements with ui_patch_screen.' } }],
        },
      });
      const size = FRAME_SIZES[spec.frame];
      const result = await run(
        {
          op: 'add',
          shapes: [
            {
              kind: 'component',
              component: 'screen',
              id: params.id,
              title: spec.name,
              props: spec as unknown as Record<string, unknown>,
              x: params.x,
              y: params.y,
              w: Math.round(size.w * PREVIEW_SCALE),
              h: Math.round(size.h * PREVIEW_SCALE) + HEADER,
            },
          ],
        },
        signal,
      );
      const ids = 'ids' in result ? result.ids : [];
      return text({ id: ids[0], outline: ops.outlineSpec(spec) });
    },
  });

  const read = defineTool({
    name: 'ui_read_screen',
    label: 'Read screen',
    description: 'Read a screen: name, frame, theme preset, and an outline of every node id/type. Pass nodeId to also get that node\'s full JSON subtree.',
    parameters: Type.Object({ id: Type.String(), nodeId: Type.Optional(Type.String()) }),
    async execute(_id, params, signal) {
      const spec = await load(params.id, signal);
      const out: Record<string, unknown> = { name: spec.name, frame: spec.frame, theme: spec.theme, outline: ops.outlineSpec(spec) };
      if (params.nodeId) {
        const found = ops.findNode(spec, params.nodeId);
        if (!found) throw new Error(`No node "${params.nodeId}" in screen "${params.id}". Call ui_read_screen without nodeId for the outline.`);
        out['node'] = found.node;
      }
      return text(out);
    },
  });

  const patch = defineTool({
    name: 'ui_patch_screen',
    label: 'Edit screen',
    description:
      'Edit a screen with id-addressed ops, applied in order; the whole batch fails if one op is invalid. ' +
      'Ops: update {id, props} shallow-merges props; replace {id, node}; insert {parent, index?, node}; remove {id}; move {id, parent, index?}; theme {preset?, overrides?}; rename {name}; frame {frame}. Returns the new outline. Prefer this over recreating a screen.',
    parameters: Type.Object({ id: Type.String(), ops: Type.Array(PatchOp, { minItems: 1 }) }),
    async execute(_id, params, signal) {
      const spec = await load(params.id, signal);
      const next = ops.applyPatch(spec, params.ops as UiPatchOp[]);
      await store(params.id, next, signal);
      return text({ id: params.id, changes: params.ops.length, outline: ops.outlineSpec(next) });
    },
  });

  const theme = defineTool({
    name: 'ui_set_theme',
    label: 'Restyle screen',
    description: `Restyle a whole screen: choose a preset and/or override tokens (overrides merge over the current ones). Presets: ${PRESETS.map((p) => `${p} (${THEME_PRESETS[p].description})`).join('; ')}`,
    parameters: Type.Object({ id: Type.String(), preset: Type.Optional(Preset), overrides: Type.Optional(Overrides) }),
    async execute(_id, params, signal) {
      if (!params.preset && !params.overrides) throw new Error('Give a preset and/or overrides.');
      const spec = await load(params.id, signal);
      const op = { op: 'theme', preset: params.preset, overrides: params.overrides } as UiPatchOp;
      const next = ops.applyPatch(spec, [op]);
      await store(params.id, next, signal);
      return text({ id: params.id, theme: next.theme });
    },
  });

  const exportCode = defineTool({
    name: 'ui_export_code',
    label: 'Export code',
    description: 'Export a screen as a React + TypeScript module built on @aicl/react, with the theme applied. Returns the source text.',
    parameters: Type.Object({ id: Type.String() }),
    async execute(_id, params, signal) {
      return text(ops.toReactCode(await load(params.id, signal)));
    },
  });

  const list = defineTool({
    name: 'ui_list_screens',
    label: 'List screens',
    description: 'List the screens on the canvas: id, name, frame, theme preset.',
    parameters: Type.Object({}),
    async execute(_id, _params, signal) {
      const result = await run({ op: 'read' }, signal);
      const shapes = result.op === 'read' ? result.shapes : [];
      const screens = shapes
        .filter((s) => s.kind === 'component' && s.component === 'screen')
        .map((s) => {
          const p = (s.props ?? {}) as { name?: string; frame?: string; theme?: { preset?: string } };
          return { id: s.id, name: p.name ?? s.title, frame: p.frame, preset: p.theme?.preset };
        });
      return text(screens);
    },
  });

  return [create, read, patch, theme, exportCode, list];
}
