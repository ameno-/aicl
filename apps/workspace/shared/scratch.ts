/**
 * The scratchpad contract shared by the agent tools (server) and the canvas
 * executor (browser).
 *
 * The agent never sees tldraw records. It works with a small primitive layer —
 * text, rect, ellipse, note, arrow — addressed by short stable ids, so prompts
 * stay readable and survive tldraw schema changes.
 */

import { COMPONENT_SHAPE_TYPE } from './components.ts';

export const COLORS = ['black', 'grey', 'blue', 'light-blue', 'green', 'light-green', 'yellow', 'orange', 'red', 'light-red', 'violet', 'light-violet', 'white'] as const;
export type Color = (typeof COLORS)[number];

export const FILLS = ['none', 'semi', 'solid', 'pattern'] as const;
export type Fill = (typeof FILLS)[number];

export type ShapeKind = 'text' | 'rect' | 'ellipse' | 'note' | 'arrow' | 'component' | 'image' | 'other';

/** An arrow end: another shape's id, or a free point. */
export type Endpoint = string | { x: number; y: number };

export interface AddShape {
  kind: Exclude<ShapeKind, 'other'>;
  id?: string;
  /** kind "image": a URL, `/api/file?…` path, or a corpus reference ("Devin web Aug 2026 (1)/… 83.png"). */
  src?: string;
  alt?: string;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  text?: string;
  color?: Color;
  fill?: Fill;
  from?: Endpoint;
  to?: Endpoint;
  /** kind 'component': a COMPONENT_NAMES entry. */
  component?: string;
  /** kind 'component': JSON props for the component. */
  props?: Record<string, unknown>;
  /** kind 'component': header title (defaults to the component's). */
  title?: string;
}

export interface UpdateShape {
  id: string;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  text?: string;
  color?: Color;
  /** Component shapes: replaces the component's props. */
  props?: Record<string, unknown>;
  /** Component shapes: header title. */
  title?: string;
}

export type ScratchOp =
  | { op: 'read' }
  /** `ids` renders only those shapes (e.g. one screenshot or one screen); omitted → whole canvas. */
  | { op: 'view'; ids?: string[] }
  | { op: 'add'; shapes: AddShape[] }
  | { op: 'update'; shapes: UpdateShape[] }
  | { op: 'delete'; ids: string[] }
  | { op: 'clear' }
  /** Read the ScreenSpec stored on a screen shape (aicl-component, component "screen"). */
  | { op: 'ui_get'; id: string }
  /** Replace a screen shape's ScreenSpec (already normalised/patched by the server). */
  | { op: 'ui_set'; id: string; spec: unknown }
  /** Tidy shapes with the editor's own align/distribute/stack, or a grid. */
  | { op: 'arrange'; ids: string[]; mode: ArrangeMode; gap?: number }
  /** Animate the USER's camera to these shapes or page bounds. */
  | { op: 'focus'; ids?: string[]; bounds?: { x: number; y: number; w: number; h: number } }
  /** Create or update one swarm run frame (agent cards + arrows); the layout is the server's. */
  | { op: 'swarm'; run: SwarmRun };

export type SwarmStatus = 'idle' | 'running' | 'done' | 'error' | 'stopped';

/** One box of a swarm run: the root (a plain box) or an agent card bound to a session. Positions are relative to the frame. */
export interface SwarmRunNode {
  /** Short shape id of the box. */
  id: string;
  /** Agent card: the session it shows. Absent for the root box. */
  sessionId?: string;
  name: string;
  role?: string;
  /** Short shape id of the parent box; an arrow runs parent → this, labelled `label`. */
  parent?: string;
  label?: string;
  status: SwarmStatus;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SwarmRun {
  /** Short shape id of the frame. */
  frameId: string;
  title: string;
  /** Create the frame when missing (a spawn happened); otherwise only update what exists. */
  create: boolean;
  w: number;
  h: number;
  nodes: SwarmRunNode[];
}

export const ARRANGE_MODES = [
  'align-left',
  'align-center-horizontal',
  'align-right',
  'align-top',
  'align-center-vertical',
  'align-bottom',
  'distribute-horizontal',
  'distribute-vertical',
  'stack-horizontal',
  'stack-vertical',
  'grid',
] as const;
export type ArrangeMode = (typeof ARRANGE_MODES)[number];

/** What the agent reads back. Coordinates are page space, rounded. */
export interface ShapeSummary {
  id: string;
  kind: ShapeKind;
  /** The tldraw type, kept for shapes outside the primitive layer (freehand, frames, images). */
  type: string;
  x: number;
  y: number;
  w?: number;
  h?: number;
  text?: string;
  color?: string;
  from?: string;
  to?: string;
  /** Component shapes. */
  component?: string;
  title?: string;
  props?: Record<string, unknown>;
}

export type ScratchResult =
  | { op: 'read'; shapes: ShapeSummary[] }
  | { op: 'view'; png: string | null }
  | { op: 'add' | 'update' | 'delete' | 'clear' | 'ui_set' | 'arrange' | 'focus'; ids: string[] }
  | { op: 'ui_get'; spec: unknown }
  | { op: 'swarm'; ids: string[] };

/** Agent-facing ids drop tldraw's `shape:` prefix. */
export const shortId = (id: string): string => (id.startsWith('shape:') ? id.slice(6) : id);
export const fullId = (id: string): string => (id.startsWith('shape:') ? id : `shape:${id}`);

interface RichNode {
  type?: string;
  text?: string;
  content?: RichNode[];
}

/** Plain text from tldraw rich text; paragraphs become lines. */
export function richTextToPlain(doc: unknown): string {
  const node = doc as RichNode | undefined;
  if (!node) return '';
  if (typeof node.text === 'string') return node.text;
  const children = (node.content ?? []).map(richTextToPlain);
  return node.type === 'doc' ? children.join('\n') : children.join('');
}

interface ShapeRecord {
  typeName: 'shape';
  id: string;
  type: string;
  x: number;
  y: number;
  props: Record<string, unknown>;
}

interface BindingRecord {
  typeName: 'binding';
  type: string;
  fromId: string;
  toId: string;
  props: { terminal?: 'start' | 'end' };
}

type Bounds = { x: number; y: number; w: number; h: number };

/**
 * Summarises tldraw records into agent-facing shapes. Works on live editor
 * records or an on-disk snapshot; `bounds` supplies measured geometry when an
 * editor is available, and props are the fallback.
 */
export function summarize(records: Iterable<unknown>, bounds?: (id: string) => Bounds | undefined): ShapeSummary[] {
  const shapes: ShapeRecord[] = [];
  const arrowEnds = new Map<string, { from?: string; to?: string }>();

  for (const raw of records) {
    const rec = raw as { typeName?: string };
    if (rec.typeName === 'shape') shapes.push(raw as ShapeRecord);
    if (rec.typeName === 'binding') {
      const b = raw as BindingRecord;
      if (b.type !== 'arrow') continue;
      const ends = arrowEnds.get(b.fromId) ?? {};
      if (b.props.terminal === 'start') ends.from = shortId(b.toId);
      else ends.to = shortId(b.toId);
      arrowEnds.set(b.fromId, ends);
    }
  }

  return shapes.map((s) => {
    const p = s.props;
    const kind = kindOf(s);
    const box = bounds?.(s.id);
    const out: ShapeSummary = {
      id: shortId(s.id),
      kind,
      type: s.type,
      x: Math.round(box?.x ?? s.x),
      y: Math.round(box?.y ?? s.y),
    };
    const w = box?.w ?? (typeof p.w === 'number' ? p.w : undefined);
    const h = box?.h ?? (typeof p.h === 'number' ? p.h : undefined);
    if (w !== undefined) out.w = Math.round(w);
    if (h !== undefined) out.h = Math.round(h);
    const text = p.richText ? richTextToPlain(p.richText) : '';
    if (text) out.text = text;
    if (typeof p.color === 'string') out.color = p.color;
    if (s.type === COMPONENT_SHAPE_TYPE) {
      if (typeof p.component === 'string') out.component = p.component;
      if (typeof p.title === 'string') out.title = p.title;
      if (p.props && typeof p.props === 'object') out.props = p.props as Record<string, unknown>;
    }
    if (s.type === 'image') {
      const meta = (s as unknown as { meta?: Record<string, unknown> }).meta ?? {};
      const alt = typeof p.altText === 'string' && p.altText ? p.altText : typeof meta.alt === 'string' ? meta.alt : '';
      if (alt) out.text = alt;
      if (typeof meta.src === 'string') out.title = meta.src;
    }
    const ends = arrowEnds.get(s.id);
    if (ends?.from) out.from = ends.from;
    if (ends?.to) out.to = ends.to;
    return out;
  });
}

function kindOf(s: ShapeRecord): ShapeKind {
  if (s.type === COMPONENT_SHAPE_TYPE) return 'component';
  if (s.type === 'image') return 'image';
  if (s.type === 'text' || s.type === 'note' || s.type === 'arrow') return s.type;
  if (s.type === 'geo') {
    if (s.props.geo === 'rectangle') return 'rect';
    if (s.props.geo === 'ellipse') return 'ellipse';
  }
  return 'other';
}
