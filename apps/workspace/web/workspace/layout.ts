/**
 * Work-frame geometry (AICL-41). Pure: rectangles in, rectangles out, no
 * tldraw, so server/workframes.test.ts can run it under node.
 *
 * A work frame belongs to one session. Surfaces its agent opens become cards
 * inside it. Cards are only ever appended; nothing here moves a card that
 * already exists unless the user asks for a tidy, and even then cards the user
 * moved (`meta.userMoved`) stay where they are.
 */

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A card already in a frame. `key` is "kind/id" of its surface. */
export interface FrameCard extends Rect {
  key?: string;
  kind?: string;
  /** The user dragged or resized it: never reposition. */
  userMoved?: boolean;
}

export const PAD = 28;
export const GAP = 24;
/** Frames grow downward past this width instead of sideways. */
export const MAX_FRAME_W = 1400;
export const MIN_FRAME = { w: 640, h: 240 };

const SIZES: Record<string, { w: number; h: number }> = {
  terminal: { w: 560, h: 340 },
  browser: { w: 640, h: 420 },
  file: { w: 520, h: 360 },
  diff: { w: 600, h: 400 },
  review: { w: 600, h: 400 },
  process: { w: 520, h: 300 },
  sideshow: { w: 560, h: 380 },
};
export const sizeFor = (kind: string): { w: number; h: number } => SIZES[kind] ?? { w: 520, h: 360 };

/** Which kinds a new card prefers to sit next to: a diff by the file it changes, a page by the terminal serving it. */
export const RELATED: Record<string, string[]> = {
  diff: ['file'],
  review: ['diff'],
  browser: ['terminal'],
  terminal: ['diff', 'file'],
  file: ['terminal'],
};

export const surfaceKey = (kind: string, id: string): string => `${kind}/${id}`;

export const overlaps = (a: Rect, b: Rect): boolean => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** The user's hand-placed cards are not ours to reposition. */
export const canReposition = (meta: { userMoved?: unknown } | undefined | null): boolean => !meta?.userMoved;

export interface FrameState {
  w: number;
  h: number;
}

export interface Placement extends Rect {
  /** The frame after growing to hold the card (never smaller than before). */
  frame: FrameState;
}

const grow = (frame: FrameState, r: Rect): FrameState => ({
  w: Math.max(frame.w, MIN_FRAME.w, r.x + r.w + PAD),
  h: Math.max(frame.h, MIN_FRAME.h, r.y + r.h + PAD),
});

/**
 * Where a card of `size` goes in a frame holding `cards`: beside a related
 * card when there is one, else the first free spot reading left to right,
 * top to bottom. Existing cards are never touched.
 */
export function placeCard(frame: FrameState, cards: Rect[], size: { w: number; h: number }, related?: Rect): Placement {
  const limit = Math.max(MAX_FRAME_W, size.w + 2 * PAD);
  const fits = (r: Rect) => r.x >= PAD && r.y >= PAD && r.x + r.w + PAD <= limit && !cards.some((c) => overlaps(r, c));
  const at = (x: number, y: number): Rect => ({ x, y, w: size.w, h: size.h });

  if (related) {
    for (const r of [at(related.x + related.w + GAP, related.y), at(related.x, related.y + related.h + GAP)]) {
      if (fits(r)) return { ...r, frame: grow(frame, r) };
    }
  }
  const xs = [PAD, ...cards.map((c) => c.x + c.w + GAP)];
  const ys = [PAD, ...cards.map((c) => c.y + c.h + GAP)];
  const candidates = ys.flatMap((y) => xs.map((x) => at(x, y))).sort((a, b) => a.y - b.y || a.x - b.x);
  const hit = candidates.find(fits);
  if (hit) return { ...hit, frame: grow(frame, hit) };
  // Unreachable in practice (the lowest row is always free); stay safe.
  const r = at(PAD, Math.max(PAD, ...cards.map((c) => c.y + c.h + GAP)));
  return { ...r, frame: grow(frame, r) };
}

export interface IncomingSurface {
  kind: string;
  id: string;
}

/**
 * Plans one surface card, or null when the frame already holds that surface
 * (the dedupe that keeps a reload or a repeated event from adding a twin).
 */
export function planSurface(frame: FrameState, cards: FrameCard[], incoming: IncomingSurface): Placement | null {
  const key = surfaceKey(incoming.kind, incoming.id);
  if (cards.some((c) => c.key === key)) return null;
  const wanted = RELATED[incoming.kind] ?? [];
  // Most recent related card: cards are in creation order.
  const related = [...cards].reverse().find((c) => c.kind && wanted.includes(c.kind));
  return placeCard(frame, cards, sizeFor(incoming.kind), related);
}

/**
 * Tidy a frame: cards the user moved stay put and act as obstacles; the rest
 * are packed again in creation order. Returns positions for movable cards
 * only (by index), and the frame size that holds everything.
 */
export function reflowFrame(cards: FrameCard[]): { moves: Map<number, Rect>; frame: FrameState } {
  const moves = new Map<number, Rect>();
  let frame: FrameState = { w: 0, h: 0 };
  const placed: Rect[] = cards.filter((c) => c.userMoved);
  for (const c of placed) frame = grow(frame, c);
  cards.forEach((c, i) => {
    if (c.userMoved) return;
    const p = placeCard(frame, placed, { w: c.w, h: c.h });
    const rect = { x: p.x, y: p.y, w: c.w, h: c.h };
    moves.set(i, rect);
    placed.push(rect);
    frame = p.frame;
  });
  return { moves, frame };
}

/* ── Lanes ───────────────────────────────────────────────────────── */

export interface LaneItem {
  id: string;
  w: number;
  h: number;
}

export interface Lane {
  key: string;
  items: LaneItem[];
}

export const LANE_GAP = 80;

/**
 * One row per lane, in the order given (most recent first), starting at
 * `origin`. A lane that would land on an obstacle (a shape the user placed
 * outside any frame) is pushed below it. Returns the top-left of every item.
 */
export function layoutLanes(lanes: Lane[], origin: { x: number; y: number }, obstacles: Rect[], gap = LANE_GAP): Map<string, { x: number; y: number }> {
  const out = new Map<string, { x: number; y: number }>();
  let y = origin.y;
  for (const lane of lanes) {
    if (!lane.items.length) continue;
    const w = lane.items.reduce((sum, i) => sum + i.w, 0) + gap * (lane.items.length - 1);
    const h = Math.max(...lane.items.map((i) => i.h));
    for (let guard = 0; guard < 200; guard++) {
      const row: Rect = { x: origin.x - gap / 2, y: y - gap / 2, w: w + gap, h: h + gap };
      const hit = obstacles.find((o) => overlaps(row, o));
      if (!hit) break;
      y = hit.y + hit.h + gap;
    }
    let x = origin.x;
    for (const item of lane.items) {
      out.set(item.id, { x, y });
      x += item.w + gap;
    }
    y += h + gap;
  }
  return out;
}
