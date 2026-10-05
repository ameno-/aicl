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

export type ShapeKind = 'text' | 'rect' | 'ellipse' | 'note' | 'arrow' | 'component' | 'other';

/** An arrow end: another shape's id, or a free point. */
export type Endpoint = string | { x: number; y: number };

export interface AddShape {
  kind: Exclude<ShapeKind, 'other'>;
  id?: string;
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
  | { op: 'view' }
  | { op: 'add'; shapes: AddShape[] }
  | { op: 'update'; shapes: UpdateShape[] }
  | { op: 'delete'; ids: string[] }
  | { op: 'clear' };

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
  | { op: 'add' | 'update' | 'delete' | 'clear'; ids: string[] };

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
    const ends = arrowEnds.get(s.id);
    if (ends?.from) out.from = ends.from;
    if (ends?.to) out.to = ends.to;
    return out;
  });
}

function kindOf(s: ShapeRecord): ShapeKind {
  if (s.type === COMPONENT_SHAPE_TYPE) return 'component';
  if (s.type === 'text' || s.type === 'note' || s.type === 'arrow') return s.type;
  if (s.type === 'geo') {
    if (s.props.geo === 'rectangle') return 'rect';
    if (s.props.geo === 'ellipse') return 'ellipse';
  }
  return 'other';
}
