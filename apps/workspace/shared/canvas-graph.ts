/**
 * The canvas as a graph (wave 2, work package E). Pure: tldraw records in,
 * CanvasGraph out. Parents, arrow bindings, and page bounds come from tldraw;
 * rbush (an R-tree) answers "what is near what" without an O(n²) scan.
 */
import RBush from 'rbush';
import {
  NEAR_DISTANCE,
  type CanvasGraph,
  type GraphEdge,
  type GraphNode,
  type GraphNodeKind,
} from './agentic.ts';
import { richTextToPlain } from './scratch.ts';

type Bounds = GraphNode['bounds'];

export interface ShapeRec {
  typeName: 'shape';
  id: string;
  type: string;
  x: number;
  y: number;
  parentId?: string;
  props: Record<string, unknown>;
}

interface BindingRec {
  typeName: 'binding';
  type: string;
  fromId: string;
  toId: string;
  props: { terminal?: string };
}

const short = (id: string): string => (id.startsWith('shape:') ? id.slice(6) : id);
const LABEL_MAX = 60;

function clip(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > LABEL_MAX ? `${flat.slice(0, LABEL_MAX - 1)}…` : flat;
}

const str = (v: unknown): string | undefined => (typeof v === 'string' && v ? v : undefined);

export function nodeKind(s: ShapeRec): { kind: GraphNodeKind; component?: string } {
  if (s.type === 'aicl-component') {
    const component = str(s.props['component']);
    if (component === 'screen') return { kind: 'screen', component };
    if (component === 'agent') return { kind: 'agent', component };
    return component ? { kind: 'component', component } : { kind: 'component' };
  }
  if (s.type === 'note' || s.type === 'text' || s.type === 'image' || s.type === 'frame' || s.type === 'group') return { kind: s.type };
  return { kind: 'shape' };
}

export function labelOf(s: ShapeRec): string {
  const p = s.props;
  const inner = (p['props'] && typeof p['props'] === 'object' ? p['props'] : {}) as Record<string, unknown>;
  if (s.type === 'aicl-component') return clip(str(p['title']) ?? str(inner['name']) ?? str(inner['title']) ?? str(p['component']) ?? '');
  if (s.type === 'frame') return clip(str(p['name']) ?? '');
  const text = p['richText'] ? richTextToPlain(p['richText']) : '';
  if (text) return clip(text);
  if (s.type === 'image') return clip(str(p['altText']) ?? '');
  return '';
}

export function stateOf(s: ShapeRec): Record<string, unknown> | undefined {
  if (s.type !== 'aicl-component') return undefined;
  const component = str(s.props['component']);
  const inner = (s.props['props'] && typeof s.props['props'] === 'object' ? s.props['props'] : {}) as Record<string, unknown>;
  const state: Record<string, unknown> = {};
  if (component === 'screen') {
    for (const k of ['name', 'frame', 'preset']) if (str(inner[k])) state[k] = inner[k];
  } else if (component === 'plan' || component === 'live-plan') {
    const list = Array.isArray(inner['steps']) ? inner['steps'] : Array.isArray(inner['items']) ? inner['items'] : undefined;
    if (list) {
      state['total'] = list.length;
      state['done'] = list.filter((i) => i && typeof i === 'object' && (i as { status?: unknown }).status === 'done').length;
    }
  } else if (component === 'agent') {
    if (str(inner['name'])) state['name'] = inner['name'];
  } else if (component === 'applet') {
    if (str(inner['id'])) state['id'] = inner['id'];
  }
  return Object.keys(state).length ? state : undefined;
}

const area = (b: Bounds): number => b.w * b.h;
const contains = (outer: Bounds, inner: Bounds): boolean =>
  outer.x <= inner.x && outer.y <= inner.y && outer.x + outer.w >= inner.x + inner.w && outer.y + outer.h >= inner.y + inner.h;
const intersects = (a: Bounds, b: Bounds): boolean => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

function gap(a: Bounds, b: Bounds): number {
  const dx = Math.max(0, a.x - (b.x + b.w), b.x - (a.x + a.w));
  const dy = Math.max(0, a.y - (b.y + b.h), b.y - (a.y + a.h));
  return Math.hypot(dx, dy);
}

const KIND_ORDER = { contains: 0, connects: 1, overlaps: 2, near: 3 } as const;

/**
 * `bounds` returns page-space bounds (the editor's getShapePageBounds); without
 * it, bounds come from x/y/props with parent offsets added.
 */
export function buildGraph(records: Iterable<unknown>, bounds?: (id: string) => Bounds | undefined): CanvasGraph {
  const shapes = new Map<string, ShapeRec>();
  const bindings: BindingRec[] = [];
  for (const raw of records) {
    const rec = raw as { typeName?: string; type?: string };
    if (rec.typeName === 'shape') shapes.set((raw as ShapeRec).id, raw as ShapeRec);
    else if (rec.typeName === 'binding' && rec.type === 'arrow') bindings.push(raw as BindingRec);
  }

  const fallback = (s: ShapeRec): Bounds => {
    let x = s.x;
    let y = s.y;
    for (let p = s.parentId && shapes.get(s.parentId); p; p = p.parentId ? shapes.get(p.parentId) : undefined) {
      x += p.x;
      y += p.y;
    }
    const w = typeof s.props['w'] === 'number' ? s.props['w'] : 0;
    const h = typeof s.props['h'] === 'number' ? s.props['h'] : 0;
    return { x, y, w, h };
  };

  const nodes: GraphNode[] = [];
  for (const s of shapes.values()) {
    if (s.type === 'arrow') continue;
    const b = bounds?.(s.id) ?? fallback(s);
    const { kind, component } = nodeKind(s);
    const node: GraphNode = {
      id: short(s.id),
      kind,
      label: labelOf(s),
      bounds: { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.w), h: Math.round(b.h) },
    };
    if (component) node.component = component;
    const state = stateOf(s);
    if (state) node.state = state;
    nodes.push(node);
  }
  nodes.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const byId = new Map(nodes.map((n) => [n.id, n]));

  const edges: GraphEdge[] = [];
  const related = new Set<string>(); // pairs already linked by contains
  const pair = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

  // contains: tldraw parents first, then geometric containment for the rest.
  const parented = new Set<string>();
  for (const s of shapes.values()) {
    if (s.type === 'arrow' || !s.parentId?.startsWith('shape:')) continue;
    const parent = short(s.parentId);
    if (!byId.has(parent) || !byId.has(short(s.id))) continue;
    edges.push({ from: parent, to: short(s.id), kind: 'contains' });
    parented.add(short(s.id));
    related.add(pair(parent, short(s.id)));
  }
  for (const child of nodes) {
    if (parented.has(child.id) || area(child.bounds) <= 0) continue;
    let best: GraphNode | undefined;
    for (const outer of nodes) {
      if (outer === child || area(outer.bounds) <= area(child.bounds) || !contains(outer.bounds, child.bounds)) continue;
      if (!best || area(outer.bounds) < area(best.bounds)) best = outer;
    }
    if (best) {
      edges.push({ from: best.id, to: child.id, kind: 'contains' });
      related.add(pair(best.id, child.id));
    }
  }

  // connects: arrow bindings, start → end.
  const ends = new Map<string, { start?: string; end?: string }>();
  for (const b of bindings) {
    const e = ends.get(b.fromId) ?? {};
    if (b.props.terminal === 'start') e.start = short(b.toId);
    else if (b.props.terminal === 'end') e.end = short(b.toId);
    ends.set(b.fromId, e);
  }
  for (const [arrowId, e] of ends) {
    if (!e.start || !e.end || !byId.has(e.start) || !byId.has(e.end)) continue;
    const text = shapes.get(arrowId)?.props['richText'];
    const label = text ? clip(richTextToPlain(text)) : '';
    edges.push(label ? { from: e.start, to: e.end, kind: 'connects', label } : { from: e.start, to: e.end, kind: 'connects' });
  }

  // near / overlaps via an R-tree over boxes grown by NEAR_DISTANCE.
  type Item = { minX: number; minY: number; maxX: number; maxY: number; node: GraphNode };
  const tree = new RBush<Item>();
  tree.load(
    nodes.map((node) => ({
      minX: node.bounds.x - NEAR_DISTANCE,
      minY: node.bounds.y - NEAR_DISTANCE,
      maxX: node.bounds.x + node.bounds.w + NEAR_DISTANCE,
      maxY: node.bounds.y + node.bounds.h + NEAR_DISTANCE,
      node,
    })),
  );
  for (const a of nodes) {
    for (const hit of tree.search({ minX: a.bounds.x, minY: a.bounds.y, maxX: a.bounds.x + a.bounds.w, maxY: a.bounds.y + a.bounds.h })) {
      const b = hit.node;
      if (b.id <= a.id || related.has(pair(a.id, b.id))) continue;
      if (intersects(a.bounds, b.bounds)) {
        if (!contains(a.bounds, b.bounds) && !contains(b.bounds, a.bounds)) edges.push({ from: a.id, to: b.id, kind: 'overlaps' });
        continue;
      }
      const d = gap(a.bounds, b.bounds);
      if (d <= NEAR_DISTANCE) edges.push({ from: a.id, to: b.id, kind: 'near', distance: Math.round(d) });
    }
  }

  edges.sort(
    (x, y) =>
      KIND_ORDER[x.kind] - KIND_ORDER[y.kind] ||
      (x.from < y.from ? -1 : x.from > y.from ? 1 : 0) ||
      (x.to < y.to ? -1 : x.to > y.to ? 1 : 0) ||
      (x.label ?? '').localeCompare(y.label ?? ''),
  );
  return { nodes, edges, builtAt: Date.now() };
}

/** The given nodes plus everything linked to them by any edge within `depth` hops, and the edges among them. */
export function neighbourhood(graph: CanvasGraph, ids: string[], depth = 1): CanvasGraph {
  const known = new Set(graph.nodes.map((n) => n.id));
  const keep = new Set(ids.map(short).filter((id) => known.has(id)));
  let frontier = [...keep];
  for (let hop = 0; hop < depth && frontier.length; hop++) {
    const next: string[] = [];
    for (const e of graph.edges) {
      for (const [a, b] of [[e.from, e.to], [e.to, e.from]] as const) {
        if (frontier.includes(a) && !keep.has(b)) {
          keep.add(b);
          next.push(b);
        }
      }
    }
    frontier = next;
  }
  return {
    nodes: graph.nodes.filter((n) => keep.has(n.id)),
    edges: graph.edges.filter((e) => keep.has(e.from) && keep.has(e.to)),
    builtAt: graph.builtAt,
  };
}

const tag = (n: GraphNode): string => `${n.kind === 'component' ? (n.component ?? 'component') : n.kind}#${n.id}`;

/**
 * Compact text, one line per node:
 * `screen#s1 "Agent thread" [desktop, lovable] @40,80 600x400 — near note#n3 "Todo" (40px), connects→ agent#a1 "Writer"`
 */
export function formatGraph(graph: CanvasGraph, options: { maxNodes?: number } = {}): string {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const ref = (id: string): string => {
    const n = byId.get(id);
    return n ? `${tag(n)}${n.label ? ` "${n.label}"` : ''}` : id;
  };
  const rels = new Map<string, string[]>();
  const add = (id: string, text: string) => {
    const list = rels.get(id) ?? [];
    list.push(text);
    rels.set(id, list);
  };
  for (const e of graph.edges) {
    if (e.kind === 'contains') {
      add(e.from, `contains ${ref(e.to)}`);
      add(e.to, `inside ${ref(e.from)}`);
    } else if (e.kind === 'connects') {
      const l = e.label ? ` "${e.label}"` : '';
      add(e.from, `connects${l}→ ${ref(e.to)}`);
      add(e.to, `←connects${l} from ${ref(e.from)}`);
    } else if (e.kind === 'overlaps') {
      add(e.from, `overlaps ${ref(e.to)}`);
      add(e.to, `overlaps ${ref(e.from)}`);
    } else {
      add(e.from, `near ${ref(e.to)} (${e.distance ?? 0}px)`);
      add(e.to, `near ${ref(e.from)} (${e.distance ?? 0}px)`);
    }
  }
  const max = options.maxNodes ?? graph.nodes.length;
  const lines = graph.nodes.slice(0, max).map((n) => {
    const state = n.state ? ` [${Object.entries(n.state).map(([k, v]) => (k === 'done' || k === 'total' ? `${k} ${v}` : String(v))).join(', ')}]` : '';
    const b = n.bounds;
    const r = rels.get(n.id);
    return `${tag(n)}${n.label ? ` "${n.label}"` : ''}${state} @${b.x},${b.y} ${b.w}x${b.h}${r ? ` — ${r.join(', ')}` : ''}`;
  });
  if (graph.nodes.length > max) lines.push(`… ${graph.nodes.length - max} more nodes`);
  return lines.join('\n');
}
