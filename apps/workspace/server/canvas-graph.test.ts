import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildGraph, formatGraph, neighbourhood } from '../shared/canvas-graph.ts';
import { formatCanvasContext } from '../shared/canvas-context-format.ts';

const shape = (id: string, type: string, x: number, y: number, w: number, h: number, extra: Record<string, unknown> = {}, parentId = 'page:page') => ({
  typeName: 'shape',
  id: `shape:${id}`,
  type,
  x,
  y,
  parentId,
  props: { w, h, ...extra },
});
const rich = (t: string) => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: t }] }] });
const binding = (arrow: string, target: string, terminal: string) => ({
  typeName: 'binding',
  type: 'arrow',
  fromId: `shape:${arrow}`,
  toId: `shape:${target}`,
  props: { terminal },
});

const records = () => [
  shape('f1', 'frame', 0, 0, 500, 300, { name: 'Inside' }),
  shape('n1', 'note', 20, 20, 100, 100, { richText: rich('Alpha') }, 'shape:f1'),
  shape('n2', 'note', 200, 20, 100, 100, { richText: rich('Beta') }, 'shape:f1'),
  shape('far', 'note', 3000, 3000, 100, 100),
  shape('p1', 'note', 1000, 0, 100, 100),
  shape('p2', 'note', 1160, 0, 100, 100), // gap 60 from p1
  shape('ar', 'arrow', 0, 0, 0, 0, { richText: rich('feeds') }),
  binding('ar', 'p1', 'start'),
  binding('ar', 'p2', 'end'),
  shape('s1', 'aicl-component', 1000, 400, 400, 300, { component: 'screen', title: 'Agent thread', props: { name: 'thread', frame: 'desktop', preset: 'lovable' } }),
  shape('pl', 'aicl-component', 1000, 420, 100, 100, { component: 'plan', props: { steps: [{ status: 'done' }, { status: 'pending' }] } }),
  shape('ov', 'note', 1350, 650, 200, 200), // overlaps screen s1
];

const key = (e: { from: string; to: string; kind: string }) => `${e.kind} ${e.from} ${e.to}`;

test('contains from parents and geometry, connects from bindings', () => {
  const g = buildGraph(records());
  const edges = g.edges.map(key);
  assert.ok(edges.includes('contains f1 n1'));
  assert.ok(edges.includes('contains f1 n2'));
  assert.ok(edges.includes('contains s1 pl'), 'card fully inside another card');
  assert.ok(edges.includes('connects p1 p2'));
  assert.equal(g.edges.find((e) => e.kind === 'connects')?.label, 'feeds');
  assert.ok(!g.nodes.some((n) => n.id === 'ar'), 'arrows are edges, not nodes');
});

test('near within threshold with distance, none for far shapes, overlaps not contained', () => {
  const g = buildGraph(records());
  const near = g.edges.find((e) => e.kind === 'near' && e.from === 'p1' && e.to === 'p2');
  assert.equal(near?.distance, 60);
  assert.ok(!g.edges.some((e) => e.kind === 'near' && (e.from === 'far' || e.to === 'far')));
  assert.ok(g.edges.some((e) => key(e) === 'overlaps ov s1'));
  assert.ok(!g.edges.some((e) => e.kind === 'overlaps' && (e.from === 'pl' || e.to === 'pl')));
});

test('near threshold is inclusive at 160 and exclusive beyond', () => {
  const g = buildGraph([shape('a', 'note', 0, 0, 100, 100), shape('b', 'note', 260, 0, 100, 100), shape('c', 'note', 0, 261, 100, 100)]);
  assert.ok(g.edges.some((e) => key(e) === 'near a b'));
  assert.ok(!g.edges.some((e) => key(e) === 'near a c'));
});

test('kinds, labels, state', () => {
  const g = buildGraph(records());
  const by = (id: string) => g.nodes.find((n) => n.id === id)!;
  assert.equal(by('s1').kind, 'screen');
  assert.deepEqual(by('s1').state, { name: 'thread', frame: 'desktop', preset: 'lovable' });
  assert.equal(by('pl').component, 'plan');
  assert.deepEqual(by('pl').state, { total: 2, done: 1 });
  assert.equal(by('n1').label, 'Alpha');
  assert.equal(by('f1').label, 'Inside');
});

test('deterministic regardless of record order', () => {
  const a = buildGraph(records());
  const b = buildGraph(records().reverse());
  assert.deepEqual({ ...a, builtAt: 0 }, { ...b, builtAt: 0 });
});

test('neighbourhood by depth', () => {
  const g = buildGraph([shape('a', 'note', 0, 0, 100, 100), shape('b', 'note', 200, 0, 100, 100), shape('c', 'note', 400, 0, 100, 100), shape('d', 'note', 600, 0, 100, 100)]);
  assert.deepEqual(neighbourhood(g, ['a'], 1).nodes.map((n) => n.id), ['a', 'b']);
  assert.deepEqual(neighbourhood(g, ['a'], 2).nodes.map((n) => n.id), ['a', 'b', 'c']);
  assert.deepEqual(neighbourhood(g, ['nope'], 1).nodes, []);
});

test('formatGraph and context rendering', () => {
  const g = buildGraph(records());
  const text = formatGraph(g);
  assert.match(text, /screen#s1 "Agent thread" \[thread, desktop, lovable\] @1000,400 400x300/);
  assert.match(text, /note#p1 .*connects "feeds"→ note#p2/);
  assert.match(text, /near note#p2 \(60px\)/);
  const ctx = formatCanvasContext({ selectedShapes: ['p1'], uiSelection: null, route: { tab: 'canvas' }, neighbourhood: neighbourhood(g, ['p1']) } as never);
  assert.match(ctx, /neighbourhood/);
  assert.match(ctx, /note#p2/);
});
