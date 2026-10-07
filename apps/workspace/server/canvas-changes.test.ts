import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ChangeLog, coalesce, diffGraphs, diffRecords, formatChanges, stateTimeline, type CanvasChange } from '../shared/canvas-changes.ts';
import { buildGraph } from '../shared/canvas-graph.ts';

const rich = (t: string) => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: t }] }] });
const note = (id: string, x: number, y: number, text = '', extra: Record<string, unknown> = {}) => ({
  typeName: 'shape',
  id: `shape:${id}`,
  type: 'note',
  x,
  y,
  parentId: 'page:page',
  props: { richText: rich(text), w: 100, h: 100, ...extra },
});
const comp = (id: string, component: string, props: Record<string, unknown>, title = '', x = 0) => ({
  typeName: 'shape',
  id: `shape:${id}`,
  type: 'aicl-component',
  x,
  y: 0,
  parentId: 'page:page',
  props: { component, title, w: 300, h: 200, props },
});
const plan = (done: number) => comp('p1', 'plan', { steps: [0, 1, 2].map((i) => ({ status: i < done ? 'done' : 'pending' })) });
const ch = (over: Partial<CanvasChange>): CanvasChange => ({ seq: 0, at: 0, source: 'user', kind: 'moved', id: 'n1', label: 'note#n1', detail: '', ...over });

test('diffRecords: create, delete', () => {
  const [c] = diffRecords(undefined, note('n3', 10, 20, 'Ideas'), 'agent', 5);
  assert.deepEqual([c?.kind, c?.source, c?.id, c?.label, c?.at], ['created', 'agent', 'n3', 'note#n3 "Ideas"', 5]);
  const [d] = diffRecords(note('n3', 10, 20, 'Ideas'), undefined, 'user');
  assert.equal(d?.kind, 'deleted');
});

test('diffRecords: move, resize, edit', () => {
  const [m] = diffRecords(note('n3', 0, 0, 'Ideas'), note('n3', 240, -5, 'Ideas'), 'user');
  assert.equal(m?.kind, 'moved');
  assert.equal(m?.detail, '(+240,-5)');
  const [r] = diffRecords(note('n3', 0, 0, 'A'), note('n3', 0, 0, 'A', { w: 200 }), 'user');
  assert.equal(r?.kind, 'resized');
  assert.equal(r?.detail, '100x100 → 200x100');
  const [e] = diffRecords(note('n3', 0, 0, 'Ideas'), note('n3', 0, 0, 'Ideas v2'), 'user');
  assert.equal(e?.kind, 'edited');
  assert.equal(e?.detail, 'text "Ideas" → "Ideas v2"');
  assert.deepEqual(diffRecords(note('n3', 0, 0, 'A'), note('n3', 0, 0, 'A'), 'user'), []);
});

test('diffRecords: component state (plan progress, screen preset, title)', () => {
  const [s] = diffRecords(plan(1), plan(2), 'agent');
  assert.deepEqual([s?.kind, s?.field, s?.detail], ['state', 'progress', 'progress 1/3 → 2/3']);
  const a = comp('s1', 'screen', { name: 'x', preset: 'plain' });
  const b = comp('s1', 'screen', { name: 'x', preset: 'lovable' });
  assert.equal(diffRecords(a, b, 'user')[0]?.detail, 'preset plain → lovable');
  const t = diffRecords(comp('c', 'chat', {}, 'Old'), comp('c', 'chat', {}, 'New'), 'user');
  assert.equal(t[0]?.detail, 'title "Old" → "New"');
  const e = diffRecords(comp('c', 'chat', { a: 1 }), comp('c', 'chat', { a: 2 }), 'user');
  assert.match(e[0]?.detail ?? '', /props changed: a/);
});

test('coalesce: a drag is one moved with the net delta; edits within 2s merge', () => {
  const drag = [0, 1, 2, 3].map((i) => ch({ seq: i + 1, at: i * 100, delta: [10, 5], detail: '(+10,+5)' }));
  const [m, ...rest] = coalesce(drag);
  assert.equal(rest.length, 0);
  assert.equal(m?.detail, '(+40,+20)');
  assert.equal(m?.seq, 4);
  const edits = [
    ch({ seq: 1, at: 0, kind: 'edited', field: 'text', before: 'Id', after: 'Ide' }),
    ch({ seq: 2, at: 500, kind: 'edited', field: 'text', before: 'Ide', after: 'Ideas' }),
    ch({ seq: 3, at: 5000, kind: 'edited', field: 'text', before: 'Ideas', after: 'Ideas v2' }),
  ];
  const out = coalesce(edits);
  assert.equal(out.length, 2);
  assert.equal(out[0]?.detail, 'text "Id" → "Ideas"');
  assert.equal(coalesce([ch({ seq: 1, at: 0, delta: [5, 0] }), ch({ seq: 2, at: 10, delta: [-5, 0] })]).length, 0);
  assert.equal(coalesce([ch({ seq: 1, source: 'user', delta: [1, 0] }), ch({ seq: 2, source: 'agent', delta: [1, 0] })]).length, 2);
});

test('diffGraphs: links appear and disappear', () => {
  const g = (x: number) => buildGraph([note('n1', 0, 0, 'Ideas'), comp('s1', 'screen', { name: 'S' }, 'Screen', x)], (id) =>
    id === 'shape:n1' ? { x: 0, y: 0, w: 100, h: 100 } : { x, y: 0, w: 200, h: 100 },
  );
  const far = g(5000);
  const close = g(140);
  const [linked] = diffGraphs(far, close, 'user');
  assert.equal(linked?.kind, 'linked');
  assert.equal(linked?.id, 'n1');
  assert.match(linked?.detail ?? '', /^near screen#s1/);
  const [un] = diffGraphs(close, far, 'agent');
  assert.equal(un?.kind, 'unlinked');
  assert.equal(un?.source, 'agent');
  assert.deepEqual(diffGraphs(close, close), []);
  // a newly created node does not report its edges as "linked"
  assert.deepEqual(diffGraphs({ nodes: [], edges: [], builtAt: 0 }, close), []);
});

test('formatChanges: user first, attaches "now near", caps', () => {
  const moved = ch({ seq: 2, at: 1000, kind: 'moved', label: 'note#n3 "Ideas"', delta: [240, 0], detail: '(+240,+0)', id: 'n3' });
  const near = ch({ seq: 3, at: 1100, kind: 'linked', id: 'n3', label: 'note#n3 "Ideas"', other: 's1', otherLabel: 'screen#s1', rel: 'near', detail: 'near screen#s1' });
  const agent = ch({ seq: 1, at: 0, source: 'agent', kind: 'created', label: 'note#a1', id: 'a1', detail: 'at 0,0' });
  const text = formatChanges([agent, moved, near]);
  assert.equal(text, 'user moved note#n3 "Ideas" (+240,+0) · now near screen#s1\nagent created note#a1 at 0,0');
  const many = Array.from({ length: 14 }, (_, i) => ch({ seq: i + 1, at: i * 10_000, kind: 'deleted', id: `d${i}`, label: `note#d${i}` }));
  const lines = formatChanges(many).split('\n');
  assert.equal(lines.length, 11);
  assert.match(lines[10] ?? '', /^… 4 more/);
  assert.equal(formatChanges(many, 3).split('\n').length, 4);
});

test('stateTimeline: plan 1/3 → 2/3 → 3/3', () => {
  const steps = [diffRecords(plan(1), plan(2), 'agent', 0)[0], diffRecords(plan(2), plan(3), 'agent', 10_000)[0]].map((c, i) => ({ ...c, seq: i + 1 })) as CanvasChange[];
  assert.equal(stateTimeline(steps, 'p1'), 'plan#p1 "plan" progress: 1/3 → 2/3 → 3/3');
});

test('ChangeLog: per-session cursors see their own deltas; ring is bounded', () => {
  const log = new ChangeLog(5);
  assert.equal(log.take('a'), undefined); // first turn only sets the cursor
  assert.equal(log.take('b'), undefined);
  log.add([ch({ id: 'x' }), ch({ id: 'y' })]);
  assert.deepEqual(log.take('a')?.map((c) => c.id), ['x', 'y']);
  log.add([ch({ id: 'z' })]);
  assert.deepEqual(log.take('a')?.map((c) => c.id), ['z']);
  assert.deepEqual(log.take('b')?.map((c) => c.id), ['x', 'y', 'z']);
  assert.deepEqual(log.take('b'), []);
  assert.deepEqual(log.since(1).map((c) => c.seq), [2, 3]);
  assert.deepEqual(log.since(0, 'z').map((c) => c.id), ['z']);
  log.add(Array.from({ length: 10 }, () => ch({})));
  assert.equal(log.since(0).length, 5);
  assert.equal(log.head, 13);
});
