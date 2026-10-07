/**
 * Applies agent scratchpad ops to the live tldraw editor.
 *
 * Every mutation goes through the editor's shape API, so the agent's options
 * are exactly what the toolbar offers the user: neither author can make
 * something the other cannot.
 */

import { Box, createShapeId, toRichText, type Editor, type TLShapeId } from 'tldraw';
import { COMPONENT_NAMES, COMPONENT_SHAPE_TYPE, componentSpec } from '../shared/components.ts';
import {
  fullId,
  shortId,
  summarize,
  type AddShape,
  type ArrangeMode,
  type Endpoint,
  type ScratchOp,
  type ScratchResult,
  type UpdateShape,
} from '../shared/scratch.ts';
import { asAgent } from './canvasContext.ts';
import { addImage, viewShapes } from './executor-image.ts';
import { uiGet, uiSet } from './ui/executor-ui.ts';

const GAP = 80;
const DEFAULT_W = 200;
const DEFAULT_H = 120;

export function execute(editor: Editor, op: ScratchOp): Promise<ScratchResult> {
  return asAgent(() => run(editor, op));
}

async function run(editor: Editor, op: ScratchOp): Promise<ScratchResult> {
  switch (op.op) {
    case 'read':
      return { op: 'read', shapes: read(editor) };
    case 'view':
      return { op: 'view', png: op.ids?.length ? await viewShapes(editor, op.ids) : await view(editor) };
    case 'add': {
      const ids = add(editor, op.shapes);
      editor.zoomToFit({ animation: { duration: 240 } });
      return { op: 'add', ids };
    }
    case 'update':
      return { op: 'update', ids: update(editor, op.shapes) };
    case 'delete': {
      const ids = op.ids.map((id) => fullId(id) as TLShapeId).filter((id) => editor.getShape(id));
      editor.deleteShapes(ids);
      return { op: 'delete', ids: ids.map(shortId) };
    }
    case 'clear': {
      const ids = [...editor.getCurrentPageShapeIds()];
      editor.deleteShapes(ids);
      return { op: 'clear', ids: ids.map(shortId) };
    }
    case 'ui_get':
      return { op: 'ui_get', spec: uiGet(editor, op.id) };
    case 'ui_set':
      return { op: 'ui_set', ids: [uiSet(editor, op.id, op.spec)] };
    case 'arrange':
      return { op: 'arrange', ids: arrange(editor, op.ids, op.mode, op.gap) };
    case 'focus':
      return { op: 'focus', ids: focus(editor, op.ids, op.bounds) };
  }
}

function read(editor: Editor) {
  const pageShapes = new Set<string>(editor.getCurrentPageShapeIds());
  const records = editor.store
    .allRecords()
    .filter((r) => r.typeName !== 'shape' || pageShapes.has(r.id));
  return summarize(records, (id) => {
    const box = editor.getShapePageBounds(id as TLShapeId);
    return box ? { x: box.x, y: box.y, w: box.w, h: box.h } : undefined;
  });
}

async function view(editor: Editor): Promise<string | null> {
  const ids = [...editor.getCurrentPageShapeIds()];
  const bounds = editor.getCurrentPageBounds();
  if (!ids.length || !bounds) return null;
  // Keep the long side near 1600px: legible for vision, cheap for context.
  const scale = Math.min(2, 1600 / Math.max(bounds.w, bounds.h));
  const { blob } = await editor.toImage(ids, { format: 'png', background: true, scale });
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

function add(editor: Editor, shapes: AddShape[]): string[] {
  const created: string[] = [];
  // Shapes without coordinates flow in a row to the right of existing content.
  const page = editor.getCurrentPageBounds();
  let cursorX = page ? page.maxX + GAP * 2 : 0;
  const cursorY = page ? page.minY : 0;

  editor.run(() => {
    for (const shape of shapes) {
      const id = shape.id ? createShapeId(shape.id) : createShapeId();
      if (editor.getShape(id)) throw new Error(`A shape with id "${shortId(id)}" already exists. Use scratch_update.`);

      if (shape.kind === 'arrow') {
        addArrow(editor, id, shape);
        created.push(shortId(id));
        continue;
      }

      if (shape.kind === 'image') {
        addImage(editor, id, shape, { x: shape.x ?? cursorX, y: shape.y ?? cursorY });
        if (shape.x === undefined) cursorX += (shape.w ?? 640) + GAP;
        created.push(shortId(id));
        continue;
      }

      if (shape.kind === 'component') {
        const spec = componentSpec(shape.component ?? '');
        if (!spec) {
          throw new Error(`Unknown component "${shape.component}". Valid components: ${COMPONENT_NAMES.join(', ')}.`);
        }
        const cw = shape.w ?? spec.defaultSize.w;
        const cx = shape.x ?? cursorX;
        if (shape.x === undefined) cursorX += cw + GAP;
        editor.createShape({
          id,
          type: COMPONENT_SHAPE_TYPE,
          x: cx,
          y: shape.y ?? cursorY,
          props: { w: cw, h: shape.h ?? spec.defaultSize.h, component: spec.name, title: shape.title ?? spec.title, props: shape.props ?? {} },
        } as never);
        created.push(shortId(id));
        continue;
      }

      const w = shape.w ?? DEFAULT_W;
      const x = shape.x ?? cursorX;
      const y = shape.y ?? cursorY;
      if (shape.x === undefined) cursorX += w + GAP;
      const richText = toRichText(shape.text ?? '');

      if (shape.kind === 'rect' || shape.kind === 'ellipse') {
        editor.createShape({
          id,
          type: 'geo',
          x,
          y,
          props: {
            geo: shape.kind === 'rect' ? 'rectangle' : 'ellipse',
            w,
            h: shape.h ?? DEFAULT_H,
            richText,
            color: shape.color ?? 'black',
            fill: shape.fill ?? 'semi',
          },
        });
      } else if (shape.kind === 'note') {
        editor.createShape({ id, type: 'note', x, y, props: { richText, color: shape.color ?? 'yellow' } });
      } else {
        editor.createShape({
          id,
          type: 'text',
          x,
          y,
          props: { richText, color: shape.color ?? 'black', ...(shape.w ? { w: shape.w, autoSize: false } : {}) },
        });
      }
      created.push(shortId(id));
    }
  });
  return created;
}

function addArrow(editor: Editor, id: TLShapeId, shape: AddShape): void {
  if (!shape.from || !shape.to) throw new Error('An arrow needs both from and to.');
  const start = endpoint(editor, shape.from);
  const end = endpoint(editor, shape.to);

  editor.createShape({
    id,
    type: 'arrow',
    x: start.point.x,
    y: start.point.y,
    props: {
      start: { x: 0, y: 0 },
      end: { x: end.point.x - start.point.x, y: end.point.y - start.point.y },
      richText: toRichText(shape.text ?? ''),
      color: shape.color ?? 'black',
    },
  });

  const bindings = [
    { terminal: 'start' as const, target: start.target },
    { terminal: 'end' as const, target: end.target },
  ].filter((b) => b.target);
  editor.createBindings(
    bindings.map((b) => ({
      type: 'arrow' as const,
      fromId: id,
      toId: b.target!,
      props: {
        terminal: b.terminal,
        normalizedAnchor: { x: 0.5, y: 0.5 },
        isExact: false,
        isPrecise: false,
        snap: 'none' as const,
      },
    })),
  );
}

function endpoint(editor: Editor, end: Endpoint): { point: { x: number; y: number }; target?: TLShapeId } {
  if (typeof end !== 'string') return { point: end };
  const target = fullId(end) as TLShapeId;
  const box = editor.getShapePageBounds(target);
  if (!box) throw new Error(`No shape with id "${end}" to bind the arrow to.`);
  return { point: { x: box.midX, y: box.midY }, target };
}

function update(editor: Editor, patches: UpdateShape[]): string[] {
  const updated: string[] = [];
  editor.run(() => {
    for (const patch of patches) {
      const shape = editor.getShape(fullId(patch.id) as TLShapeId);
      if (!shape) throw new Error(`No shape with id "${patch.id}".`);
      const props: Record<string, unknown> = {};
      if (patch.text !== undefined && 'richText' in shape.props) props.richText = toRichText(patch.text);
      if (patch.color !== undefined && 'color' in shape.props) props.color = patch.color;
      if (shape.type === 'geo') {
        if (patch.w !== undefined) props.w = patch.w;
        if (patch.h !== undefined) props.h = patch.h;
      }
      if ((shape.type as string) === COMPONENT_SHAPE_TYPE) {
        if (patch.w !== undefined) props.w = patch.w;
        if (patch.h !== undefined) props.h = patch.h;
        if (patch.title !== undefined) props.title = patch.title;
        if (patch.props !== undefined) props.props = patch.props;
      }
      if (shape.type === 'text' && patch.w !== undefined) Object.assign(props, { w: patch.w, autoSize: false });
      editor.updateShape({
        id: shape.id,
        type: shape.type,
        ...(patch.x !== undefined ? { x: patch.x } : {}),
        ...(patch.y !== undefined ? { y: patch.y } : {}),
        props,
      });
      updated.push(shortId(shape.id));
    }
  });
  return updated;
}

function existing(editor: Editor, ids: string[]): TLShapeId[] {
  const found = ids.map((id) => fullId(id) as TLShapeId).filter((id) => editor.getShape(id));
  const missing = ids.filter((id) => !editor.getShape(fullId(id) as TLShapeId));
  if (missing.length) throw new Error(`No shape with id: ${missing.join(', ')}.`);
  return found;
}

function arrange(editor: Editor, ids: string[], mode: ArrangeMode, gap?: number): string[] {
  const shapes = existing(editor, ids);
  if (!shapes.length) throw new Error('arrange needs at least one id.');
  editor.run(() => {
    if (mode.startsWith('align-')) {
      editor.alignShapes(shapes, mode.slice(6) as never);
    } else if (mode.startsWith('distribute-')) {
      editor.distributeShapes(shapes, mode.slice(11) as never);
    } else if (mode === 'stack-horizontal') {
      stack(editor, shapes, 'x', gap ?? 40);
    } else if (mode === 'stack-vertical') {
      stack(editor, shapes, 'y', gap ?? 40);
    } else {
      grid(editor, shapes, gap ?? 40);
    }
  });
  return shapes.map(shortId);
}

/** One row (x) or column (y) in the given order, starting at the group's top-left. */
function stack(editor: Editor, shapes: TLShapeId[], axis: 'x' | 'y', gap: number): void {
  const boxes = shapes.map((id) => ({ id, box: editor.getShapePageBounds(id)! }));
  const left = Math.min(...boxes.map((b) => b.box.x));
  const top = Math.min(...boxes.map((b) => b.box.y));
  let cursor = axis === 'x' ? left : top;
  for (const { id, box } of boxes) {
    const target = axis === 'x' ? { x: cursor, y: top } : { x: left, y: cursor };
    const shape = editor.getShape(id)!;
    editor.updateShape({ id, type: shape.type, x: shape.x + (target.x - box.x), y: shape.y + (target.y - box.y) });
    cursor += (axis === 'x' ? box.w : box.h) + gap;
  }
}

/** Row-major grid anchored at the group's top-left; columns ≈ √n, cells fit the largest shape. */
function grid(editor: Editor, shapes: TLShapeId[], gap: number): void {
  const boxes = shapes.map((id) => ({ id, box: editor.getShapePageBounds(id)! }));
  const left = Math.min(...boxes.map((b) => b.box.x));
  const top = Math.min(...boxes.map((b) => b.box.y));
  const cols = Math.ceil(Math.sqrt(boxes.length));
  const cellW = Math.max(...boxes.map((b) => b.box.w)) + gap;
  const cellH = Math.max(...boxes.map((b) => b.box.h)) + gap;
  boxes.forEach(({ id, box }, i) => {
    const target = { x: left + (i % cols) * cellW, y: top + Math.floor(i / cols) * cellH };
    const shape = editor.getShape(id)!;
    editor.updateShape({ id, type: shape.type, x: shape.x + (target.x - box.x), y: shape.y + (target.y - box.y) });
  });
}

function focus(editor: Editor, ids?: string[], bounds?: { x: number; y: number; w: number; h: number }): string[] {
  const shapes = ids?.length ? existing(editor, ids) : [];
  const box = shapes.length
    ? Box.Common(shapes.map((id) => editor.getShapePageBounds(id)!))
    : bounds
      ? new Box(bounds.x, bounds.y, bounds.w, bounds.h)
      : editor.getCurrentPageBounds();
  if (box) editor.zoomToBounds(box, { inset: 64, targetZoom: 1, animation: { duration: 320 } });
  return shapes.map(shortId);
}
