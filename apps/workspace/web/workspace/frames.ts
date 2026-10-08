/**
 * Work frames on the live tldraw editor (AICL-41). The math is in ./layout.ts;
 * this applies it: find or create the session's frame, add a surface card
 * inside it, remember which cards the user moved, and tidy.
 *
 * A work frame is a tldraw frame `wf-<sessionId>` with meta { workframe, sessionId, autoName }.
 * A card is a "surface" component shape whose props.props = { kind, id }:
 * that pair is the identity used to refuse duplicates, so a reload (the
 * snapshot already holds the card) or a repeated event adds nothing.
 */
import { Box, createShapeId, type Editor, type TLShape, type TLShapeId } from 'tldraw';
import { COMPONENT_SHAPE_TYPE } from '../../shared/components.ts';
import type { ScratchOp, ScratchResult } from '../../shared/scratch.ts';
import { shortId } from '../../shared/scratch.ts';
import { isAgentOrigin } from '../canvasContext.ts';
import {
  canReposition,
  layoutLanes,
  planSurface,
  reflowFrame,
  surfaceKey,
  type FrameCard,
  type Lane,
  type Rect,
} from './layout.ts';

type WorkframeOp = Extract<ScratchOp, { op: 'workframe' }>;

interface AnyShape {
  id: TLShapeId;
  type: string;
  x: number;
  y: number;
  parentId: string;
  props: Record<string, unknown>;
  meta: Record<string, unknown>;
}

const asShape = (s: TLShape): AnyShape => s as unknown as AnyShape;

export const workframeId = (sessionId: string): TLShapeId => createShapeId(`wf-${sessionId}`);

/** The surface a card shows, if it is a surface card. */
export function surfaceOfShape(shape: TLShape): { kind: string; id: string } | null {
  const s = asShape(shape);
  if (s.type !== COMPONENT_SHAPE_TYPE || s.props['component'] !== 'surface') return null;
  const inner = (s.props['props'] ?? {}) as Record<string, unknown>;
  return typeof inner['kind'] === 'string' && typeof inner['id'] === 'string' ? { kind: inner['kind'], id: inner['id'] } : null;
}

/** Every surface card on the page, wherever it is. */
export function findSurfaceCard(editor: Editor, kind: string, id: string): TLShape | undefined {
  const key = surfaceKey(kind, id);
  return editor.getCurrentPageShapes().find((s) => {
    const ref = surfaceOfShape(s);
    return ref !== null && surfaceKey(ref.kind, ref.id) === key;
  });
}

const sizeOfShape = (editor: Editor, shape: TLShape): { w: number; h: number } => {
  const p = asShape(shape).props;
  if (typeof p['w'] === 'number' && typeof p['h'] === 'number') return { w: p['w'], h: p['h'] };
  const b = editor.getShapeGeometry(shape).bounds;
  return { w: b.w, h: b.h };
};

/** Cards inside a frame, in creation (z) order, in frame-relative coordinates. */
function cardsOf(editor: Editor, frame: TLShapeId): Array<FrameCard & { shape: TLShape }> {
  return editor.getSortedChildIdsForParent(frame).flatMap((id) => {
    const shape = editor.getShape(id);
    if (!shape || shape.type === 'arrow') return [];
    const ref = surfaceOfShape(shape);
    const s = asShape(shape);
    return [
      {
        shape,
        x: s.x,
        y: s.y,
        ...sizeOfShape(editor, shape),
        ...(ref ? { key: surfaceKey(ref.kind, ref.id), kind: ref.kind } : {}),
        userMoved: !canReposition(s.meta),
      },
    ];
  });
}

/** Where a brand-new frame goes: left-aligned under everything already on the page. */
function freeSpot(editor: Editor): { x: number; y: number } {
  const page = editor.getCurrentPageBounds();
  return page ? { x: page.minX, y: page.maxY + 160 } : { x: 0, y: 0 };
}

export function applyWorkframe(editor: Editor, op: WorkframeOp): Extract<ScratchResult, { op: 'workframe' }> {
  const { kind, id } = op.surface;
  if (findSurfaceCard(editor, kind, id)) return { op: 'workframe', ids: [], placed: false };

  const frameId = workframeId(op.sessionId);
  const frame = editor.getShape(frameId);
  const created = !frame;
  const cards = frame ? cardsOf(editor, frameId) : [];
  const size = frame ? { w: Number((frame.props as { w: number }).w), h: Number((frame.props as { h: number }).h) } : { w: 0, h: 0 };
  const plan = planSurface(size, cards, { kind, id });
  if (!plan) return { op: 'workframe', ids: [], placed: false };

  const cardId = createShapeId();
  editor.run(() => {
    if (!frame) {
      editor.createShape({
        id: frameId,
        type: 'frame',
        ...freeSpot(editor),
        props: { w: plan.frame.w, h: plan.frame.h, name: op.title },
        meta: { workframe: true, sessionId: op.sessionId, autoName: op.title },
      } as never);
    } else {
      const meta = asShape(frame).meta;
      const props: Record<string, unknown> = { w: plan.frame.w, h: plan.frame.h };
      // Follow the session's title unless the user renamed the frame.
      const name = (frame.props as { name?: string }).name;
      const renamable = name === meta['autoName'] || !meta['autoName'];
      if (renamable && op.title && name !== op.title) props['name'] = op.title;
      editor.updateShape({ id: frameId, type: 'frame', props, ...(renamable ? { meta: { ...meta, autoName: op.title } } : {}) } as never);
    }
    editor.createShape({
      id: cardId,
      type: COMPONENT_SHAPE_TYPE,
      parentId: frameId,
      x: plan.x,
      y: plan.y,
      props: { w: plan.w, h: plan.h, component: 'surface', title: op.surface.title, props: { kind, id } },
    } as never);
  });

  if (created) {
    const box = editor.getShapePageBounds(frameId);
    if (box) editor.zoomToBounds(box, { inset: 80, targetZoom: 1, animation: { duration: 320 } });
  }
  return { op: 'workframe', ids: [shortId(frameId), shortId(cardId)], placed: true };
}

/**
 * Marks surface cards (and anything inside a work frame) the user moved or
 * resized with meta.userMoved, so no later layout pass repositions them.
 * "User" is the change log's notion (changes.ts): not made by an agent op.
 */
export function trackUserMoves(editor: Editor): () => void {
  return editor.store.listen(
    ({ changes }) => {
      for (const [from, to] of Object.values(changes.updated)) {
        if (to.typeName !== 'shape' || to.type === 'arrow' || to.type === 'frame') continue;
        const a = from as unknown as AnyShape;
        const b = to as unknown as AnyShape;
        if (isAgentOrigin(b.id) || b.meta?.['userMoved']) continue;
        const moved = a.x !== b.x || a.y !== b.y || a.props['w'] !== b.props['w'] || a.props['h'] !== b.props['h'];
        const inFrame = b.parentId === a.parentId && (editor.getShape(b.parentId as TLShapeId) as TLShape | undefined)?.type === 'frame';
        if (!moved || !inFrame) continue;
        editor.run(() => editor.updateShape({ id: b.id, type: b.type, meta: { ...b.meta, userMoved: true } } as never), { history: 'ignore' });
      }
    },
    { source: 'user', scope: 'document' },
  );
}

/* ── Tidy ─────────────────────────────────────────────────────────── */

const RUN_FRAME = /^shape:run-(.+)-\d+$/;

/** The session a lane frame belongs to: a work frame's session, or a run frame's root. */
function laneKey(shape: AnyShape): string | null {
  if (shape.type !== 'frame') return null;
  if (shape.meta['workframe'] && typeof shape.meta['sessionId'] === 'string') return shape.meta['sessionId'];
  return RUN_FRAME.exec(shape.id)?.[1] ?? null;
}

async function sessionRecency(): Promise<Map<string, number>> {
  try {
    const { sessions } = (await (await fetch('/api/sessions')).json()) as { sessions: Array<{ id: string; updatedAt: number }> };
    return new Map(sessions.map((s) => [s.id, s.updatedAt]));
  } catch {
    return new Map();
  }
}

/**
 * Lays work and run frames out in lanes: one row per session, most recent
 * first. Cards inside frames are repacked except those the user moved.
 * Shapes the user placed outside any frame stay where they are; a lane that
 * would land on one is pushed below it. Returns how many frames moved.
 */
export async function tidyCanvas(editor: Editor): Promise<number> {
  const recency = await sessionRecency();
  const pageId = editor.getCurrentPageId();
  const top = editor.getCurrentPageShapes().filter((s) => asShape(s).parentId === pageId);
  const frames = top.filter((s) => laneKey(asShape(s)) !== null);
  if (!frames.length) return 0;

  editor.run(() => {
    for (const f of frames) {
      if (!asShape(f).meta['workframe']) continue;
      const cards = cardsOf(editor, f.id);
      if (!cards.length) continue;
      const { moves, frame } = reflowFrame(cards);
      for (const [i, r] of moves) editor.updateShape({ id: cards[i]!.shape.id, type: cards[i]!.shape.type, x: r.x, y: r.y } as never);
      editor.updateShape({ id: f.id, type: 'frame', props: { w: frame.w, h: frame.h } } as never);
    }
  });

  const byKey = new Map<string, TLShape[]>();
  for (const f of frames) {
    const key = laneKey(asShape(f))!;
    byKey.set(key, [...(byKey.get(key) ?? []), f]);
  }
  const lanes: Lane[] = [...byKey.entries()]
    .sort(([a], [b]) => (recency.get(b) ?? 0) - (recency.get(a) ?? 0) || a.localeCompare(b))
    .map(([key, list]) => ({
      key,
      items: list
        .sort((a, b) => asShape(a).x - asShape(b).x)
        .map((f) => ({ id: f.id as string, ...sizeOfShape(editor, f) })),
    }));

  const laneIds = new Set(frames.map((f) => f.id as string));
  const boxes = frames.map((f) => editor.getShapePageBounds(f.id)!);
  const origin = { x: Math.min(...boxes.map((b) => b.minX)), y: Math.min(...boxes.map((b) => b.minY)) };
  const obstacles: Rect[] = top
    .filter((s) => !laneIds.has(s.id) && s.type !== 'arrow')
    .flatMap((s) => {
      const b = editor.getShapePageBounds(s.id);
      return b ? [{ x: b.x, y: b.y, w: b.w, h: b.h }] : [];
    });

  const spots = layoutLanes(lanes, origin, obstacles);
  const updates = frames.flatMap((f) => {
    const at = spots.get(f.id);
    return at && (asShape(f).x !== at.x || asShape(f).y !== at.y) ? [{ id: f.id, type: 'frame', x: at.x, y: at.y }] : [];
  });
  if (updates.length) editor.animateShapes(updates as never, { animation: { duration: 360 } });
  window.setTimeout(() => {
    const all = Box.Common(frames.map((f) => editor.getShapePageBounds(f.id)!).filter(Boolean));
    editor.zoomToBounds(all.clone().expandBy(120), { animation: { duration: 360 }, targetZoom: 1 });
  }, 420);
  return updates.length;
}

/**
 * "Pin to canvas" from the work panel: the surface's card goes in the
 * session's work frame (created if needed). Already on the canvas: just show it.
 */
export function pinSurface(editor: Editor, session: { id: string; title: string }, surface: { kind: string; id: string; title: string }): void {
  if (!findSurfaceCard(editor, surface.kind, surface.id)) applyWorkframe(editor, { op: 'workframe', sessionId: session.id, title: session.title, surface });
  const found = findSurfaceCard(editor, surface.kind, surface.id);
  if (!found) return;
  editor.select(found.id);
  const box = editor.getShapePageBounds(found.id);
  if (box) editor.zoomToBounds(box, { inset: 100, targetZoom: 1, animation: { duration: 320 } });
}
