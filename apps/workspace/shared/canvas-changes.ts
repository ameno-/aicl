/**
 * Canvas state over time (AICL-30). Pure: tldraw records / graphs in,
 * CanvasChange[] out. Answers "what changed since my last turn, and who did it".
 *
 * Wire protocol (browser → server):
 *   POST /api/graph/changes  { changes: CanvasChange[] }   (seq is reassigned by the server)
 *   GET  /api/graph/changes?since=<seq>&shape=<id>         → { head, changes, timeline? }
 * The browser coalesces + batches changes (debounced) and posts them next to
 * its PUT /api/graph pushes. Agent tool: canvas_changes { since?, shape? }.
 * Each session has a cursor (last seq it saw) kept by ChangeLog; the
 * <canvas-context> block shows what happened after it on the next turn.
 */
import type { CanvasGraph, GraphNode } from './agentic.ts';
import { labelOf, nodeKind, stateOf, type ShapeRec } from './canvas-graph.ts';
import { richTextToPlain } from './scratch.ts';

export type ChangeSource = 'user' | 'agent';
export type ChangeKind = 'created' | 'deleted' | 'moved' | 'resized' | 'edited' | 'state' | 'linked' | 'unlinked';

export interface CanvasChange {
  seq: number;
  /** ms epoch. */
  at: number;
  source: ChangeSource;
  kind: ChangeKind;
  /** Short shape id. */
  id: string;
  /** Display ref, e.g. `note#n3 "Ideas"`. */
  label: string;
  /** Human summary of the change itself, e.g. `(+240,0)` or `text "a" → "b"`. */
  detail: string;
  /** Which property (edited/state/resized): text, title, props, size, progress, preset… */
  field?: string;
  before?: string;
  after?: string;
  /** moved: net page-space delta. */
  delta?: [number, number];
  /** linked/unlinked: the other node, edge kind, and its display ref. */
  other?: string;
  otherLabel?: string;
  rel?: 'contains' | 'connects' | 'near' | 'overlaps';
}

export const COALESCE_MS = 2000;
export const DEFAULT_CAP = 10;

const short = (id: string): string => (id.startsWith('shape:') ? id.slice(6) : id);
const clip = (t: string, n = 60): string => {
  const flat = t.replace(/\s+/g, ' ').trim();
  return flat.length > n ? `${flat.slice(0, n - 1)}…` : flat;
};

export function refOf(shape: ShapeRec): string {
  const { kind, component } = nodeKind(shape);
  const label = labelOf(shape);
  return `${kind === 'component' ? (component ?? 'component') : kind}#${short(shape.id)}${label ? ` "${label}"` : ''}`;
}

const nodeRef = (n: GraphNode): string => `${n.kind === 'component' ? (n.component ?? 'component') : n.kind}#${n.id}${n.label ? ` "${n.label}"` : ''}`;

const signed = (n: number): string => `${n >= 0 ? '+' : ''}${Math.round(n)}`;
const moveDetail = (d: [number, number]): string => `(${signed(d[0])},${signed(d[1])})`;
const quoted = (field: string): boolean => field === 'text' || field === 'title';

function editDetail(field: string, before: string, after: string): string {
  const q = (v: string) => (quoted(field) ? `"${v}"` : v);
  return `${field} ${q(before)} → ${q(after)}`;
}

const inner = (s: ShapeRec): Record<string, unknown> =>
  (s.props['props'] && typeof s.props['props'] === 'object' ? s.props['props'] : {}) as Record<string, unknown>;

/** stateOf() flattened to display strings; plan done/total becomes `progress`. */
function stateStrings(s: ShapeRec): Record<string, string> {
  const raw = stateOf(s) ?? {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (k === 'done' || k === 'total') continue;
    out[k] = String(v);
  }
  if (typeof raw['total'] === 'number') out['progress'] = `${String(raw['done'] ?? 0)}/${String(raw['total'])}`;
  return out;
}

const textOf = (s: ShapeRec): string => (s.props['richText'] ? clip(richTextToPlain(s.props['richText'])) : '');
const sizeOf = (s: ShapeRec): string | undefined =>
  typeof s.props['w'] === 'number' && typeof s.props['h'] === 'number' ? `${Math.round(s.props['w'])}x${Math.round(s.props['h'])}` : undefined;

/**
 * Changes between two versions of one tldraw record (either may be missing).
 * Non-shape records are ignored. `seq` is 0 until a ChangeLog assigns it.
 */
export function diffRecords(prev: unknown, next: unknown, source: ChangeSource, at: number = Date.now()): CanvasChange[] {
  const p = prev as ShapeRec | undefined;
  const n = next as ShapeRec | undefined;
  if ((p && p.typeName !== 'shape') || (n && n.typeName !== 'shape') || (!p && !n)) return [];
  const make = (shape: ShapeRec, kind: ChangeKind, detail: string, extra: Partial<CanvasChange> = {}): CanvasChange => ({
    seq: 0,
    at,
    source,
    kind,
    id: short(shape.id),
    label: refOf(shape),
    detail,
    ...extra,
  });
  if (!p && n) return [make(n, 'created', `at ${Math.round(n.x)},${Math.round(n.y)}`)];
  if (p && !n) return [make(p, 'deleted', '')];
  if (!p || !n) return [];

  const out: CanvasChange[] = [];
  const isArrow = n.type === 'arrow';
  if (!isArrow && (p.x !== n.x || p.y !== n.y)) {
    const delta: [number, number] = [n.x - p.x, n.y - p.y];
    out.push(make(n, 'moved', moveDetail(delta), { delta }));
  }
  if (!isArrow) {
    const a = sizeOf(p);
    const b = sizeOf(n);
    if (a && b && a !== b) out.push(make(n, 'resized', `${a} → ${b}`, { field: 'size', before: a, after: b }));
  }
  const edit = (field: string, before: string, after: string) =>
    out.push(make(n, 'edited', editDetail(field, before, after), { field, before, after }));
  const ta = textOf(p);
  const tb = textOf(n);
  if (ta !== tb) edit('text', ta, tb);
  if (n.type === 'aicl-component') {
    const titleA = typeof p.props['title'] === 'string' ? p.props['title'] : '';
    const titleB = typeof n.props['title'] === 'string' ? n.props['title'] : '';
    if (titleA !== titleB) edit('title', titleA, titleB);
    const sa = stateStrings(p);
    const sb = stateStrings(n);
    let stateChanged = false;
    for (const k of new Set([...Object.keys(sa), ...Object.keys(sb)])) {
      if (sa[k] === sb[k]) continue;
      stateChanged = true;
      const before = sa[k] ?? '';
      const after = sb[k] ?? '';
      out.push(make(n, 'state', editDetail(k, before, after), { field: k, before, after }));
    }
    if (!stateChanged && JSON.stringify(inner(p)) !== JSON.stringify(inner(n))) {
      const a = inner(p);
      const b = inner(n);
      const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]));
      out.push(make(n, 'edited', `props changed: ${keys.join(', ')}`, { field: 'props', before: '', after: keys.join(', ') }));
    }
  }
  return out;
}

/** Links that appeared / disappeared between two graphs (only between nodes present in both). */
export function diffGraphs(prev: CanvasGraph, next: CanvasGraph, source: ChangeSource = 'user', at: number = Date.now()): CanvasChange[] {
  const pn = new Map(prev.nodes.map((n) => [n.id, n]));
  const nn = new Map(next.nodes.map((n) => [n.id, n]));
  const key = (e: { kind: string; from: string; to: string }) => `${e.kind}|${e.from}|${e.to}`;
  const pe = new Set(prev.edges.map(key));
  const ne = new Set(next.edges.map(key));
  const out: CanvasChange[] = [];
  const emit = (e: CanvasGraph['edges'][number], kind: 'linked' | 'unlinked') => {
    const a = nn.get(e.from) ?? pn.get(e.from);
    const b = nn.get(e.to) ?? pn.get(e.to);
    if (!a || !b) return;
    const verb: Record<string, string> = { contains: 'inside', connects: 'connected to', near: 'near', overlaps: 'overlapping' };
    // contains reads "from contains to": report on the child.
    const [subject, object] = e.kind === 'contains' ? [b, a] : [a, b];
    const rel = verb[e.kind] ?? e.kind;
    out.push({
      seq: 0,
      at,
      source,
      kind,
      id: subject.id,
      label: nodeRef(subject),
      detail: kind === 'linked' ? `${rel} ${nodeRef(object)}` : `no longer ${rel} ${nodeRef(object)}`,
      other: object.id,
      otherLabel: nodeRef(object),
      rel: e.kind,
    });
  };
  for (const e of next.edges) if (!pe.has(key(e)) && pn.has(e.from) && pn.has(e.to)) emit(e, 'linked');
  for (const e of prev.edges) if (!ne.has(key(e)) && nn.has(e.from) && nn.has(e.to)) emit(e, 'unlinked');
  return out;
}

/**
 * Merge bursts: repeated same-kind changes to one shape (same source and
 * field) within 2s become one. A drag is a single `moved` with the net delta;
 * a typing burst is one `edited` from the first before to the last after.
 * A created shape that is then edited/moved/resized within the window stays
 * one `created`; a move that nets to zero disappears.
 */
export function coalesce(changes: CanvasChange[]): CanvasChange[] {
  const out: CanvasChange[] = [];
  const last = new Map<string, CanvasChange>();
  for (const c of [...changes].sort((a, b) => a.seq - b.seq || a.at - b.at)) {
    const k = `${c.source}|${c.kind}|${c.id}|${c.field ?? ''}|${c.other ?? ''}`;
    const prev = last.get(k);
    if (prev && c.at - prev.at <= COALESCE_MS && (c.kind === 'moved' || c.kind === 'resized' || c.kind === 'edited' || c.kind === 'state')) {
      prev.at = c.at;
      prev.seq = c.seq;
      prev.label = c.label;
      if (c.kind === 'moved' && prev.delta && c.delta) {
        prev.delta = [prev.delta[0] + c.delta[0], prev.delta[1] + c.delta[1]];
        prev.detail = moveDetail(prev.delta);
      } else if (c.field !== undefined) {
        prev.after = c.after;
        if (c.kind === 'resized') prev.detail = `${prev.before ?? ''} → ${prev.after ?? ''}`;
        else if (c.field === 'props') prev.detail = c.detail;
        else prev.detail = editDetail(c.field, prev.before ?? '', prev.after ?? '');
      }
      continue;
    }
    const copy = { ...c };
    out.push(copy);
    last.set(k, copy);
  }
  return out.filter((c) => !(c.kind === 'moved' && c.delta && Math.round(c.delta[0]) === 0 && Math.round(c.delta[1]) === 0) && !(c.before !== undefined && c.before === c.after && c.kind !== 'edited'));
}

const VERB: Record<ChangeKind, string> = {
  created: 'created',
  deleted: 'deleted',
  moved: 'moved',
  resized: 'resized',
  edited: 'edited',
  state: 'updated',
  linked: '',
  unlinked: '',
};

function line(c: CanvasChange, nowNear: string[]): string {
  const tail = nowNear.length ? ` · now ${nowNear.join(', ')}` : '';
  switch (c.kind) {
    case 'created':
      return `${c.source} created ${c.label} ${c.detail}${tail}`.trim();
    case 'deleted':
      return `${c.source} deleted ${c.label}`;
    case 'moved':
      return `${c.source} moved ${c.label} ${c.detail}${tail}`;
    case 'resized':
      return `${c.source} resized ${c.label} ${c.detail}`;
    case 'edited':
      return `${c.source} edited ${c.label}: ${c.detail}`;
    case 'state':
      return `${c.source} ${VERB.state} ${c.label}: ${c.detail}`;
    default:
      return `${c.source}: ${c.label} ${c.detail}`;
  }
}

/**
 * One line per change, user changes first, then agent (each chronological),
 * at most `cap` lines. A move/create followed by a new near/overlap link for
 * the same shape reads `… · now near screen#s1 "Title"`.
 */
export function formatChanges(changes: CanvasChange[], cap = DEFAULT_CAP): string {
  const merged = coalesce(changes);
  const attached = new Set<CanvasChange>();
  const nearOf = (c: CanvasChange): string[] => {
    if (c.kind !== 'moved' && c.kind !== 'created') return [];
    const found: string[] = [];
    for (const l of merged) {
      if (l.kind !== 'linked' || l.source !== c.source || (l.rel !== 'near' && l.rel !== 'overlaps')) continue;
      if (l.at < c.at - 500 || l.at > c.at + 5000) continue;
      if (l.id === c.id) found.push(l.detail);
      else if (l.other === c.id) found.push(`${l.rel === 'overlaps' ? 'overlapping' : 'near'} ${l.label}`);
      else continue;
      attached.add(l);
    }
    return found;
  };
  const rendered = merged.map((c) => ({ c, text: line(c, nearOf(c)) }));
  const shown = rendered.filter((r) => !attached.has(r.c));
  const ordered = [...shown.filter((r) => r.c.source === 'user'), ...shown.filter((r) => r.c.source === 'agent')];
  const lines = ordered.slice(0, cap).map((r) => r.text);
  if (ordered.length > cap) lines.push(`… ${ordered.length - cap} more (call canvas_changes for the full history)`);
  return lines.join('\n');
}

/** How a shape's component state evolved, e.g. `plan#p1 progress: 1/3 → 2/3 → 3/3`. */
export function stateTimeline(changes: CanvasChange[], shapeId: string): string {
  const id = short(shapeId);
  const chains = new Map<string, { label: string; steps: string[] }>();
  for (const c of coalesce(changes.filter((x) => x.id === id && x.kind === 'state' && x.field))) {
    const f = c.field ?? '';
    const chain = chains.get(f) ?? { label: c.label, steps: c.before ? [c.before] : [] };
    chain.label = c.label;
    if (c.after) chain.steps.push(c.after);
    chains.set(f, chain);
  }
  return [...chains].map(([f, ch]) => `${ch.label} ${f}: ${ch.steps.join(' → ')}`).join('\n');
}

/** Ring buffer of changes with server-assigned seq numbers and a per-session "seen up to" cursor. */
export class ChangeLog {
  private items: CanvasChange[] = [];
  private seq = 0;
  private cursors = new Map<string, number>();
  private readonly max: number;
  constructor(max = 500) {
    this.max = max;
  }

  get head(): number {
    return this.seq;
  }

  add(changes: CanvasChange[]): void {
    for (const c of changes) this.items.push({ ...c, seq: ++this.seq });
    if (this.items.length > this.max) this.items.splice(0, this.items.length - this.max);
  }

  since(seq = 0, shape?: string): CanvasChange[] {
    const id = shape ? short(shape) : undefined;
    return this.items.filter((c) => c.seq > seq && (!id || c.id === id || c.other === id));
  }

  /**
   * What a session has not seen yet; moves its cursor to head. A session's
   * first call only sets the cursor and returns undefined (no "last turn" to compare with).
   */
  take(sessionId: string): CanvasChange[] | undefined {
    const cursor = this.cursors.get(sessionId);
    this.cursors.set(sessionId, this.seq);
    return cursor === undefined ? undefined : this.since(cursor);
  }
}
