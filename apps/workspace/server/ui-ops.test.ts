import assert from 'node:assert/strict';
import { test } from 'node:test';
import { UiSpecError, applyPatch, findNode, normalizeSpec, outlineSpec, toReactCode } from '../shared/ui-ops.ts';
import { SAMPLE_SCREEN, type ScreenSpec, type UiNode } from '../shared/ui-spec.ts';

const sample = (): ScreenSpec => structuredClone(SAMPLE_SCREEN);
const ids = (n: UiNode, out: string[] = []): string[] => {
  out.push(n.id);
  n.children?.forEach((c) => ids(c, out));
  return out;
};
const unique = (spec: ScreenSpec) => {
  const all = ids(spec.root);
  assert.equal(new Set(all).size, all.length, `duplicate ids: ${all.join(',')}`);
};
const throwsUi = (fn: () => unknown, re: RegExp) =>
  assert.throws(fn, (e: unknown) => e instanceof UiSpecError && re.test(e.message), String(re));

/* normalise */

test('normalizeSpec keeps a valid spec unchanged', () => {
  assert.deepEqual(normalizeSpec(sample()), sample());
});

test('normalizeSpec: unknown type becomes a text notice and keeps its id', () => {
  const spec = normalizeSpec({ root: { id: 'r', type: 'column', children: [{ id: 'x', type: 'hologram', props: { a: 1 } }] } });
  assert.deepEqual(spec.root.children![0], { id: 'x', type: 'text', props: { text: 'Unknown element "hologram"', tone: 'faint' } });
});

test('normalizeSpec: missing and duplicate ids become unique slugs', () => {
  const spec = normalizeSpec({
    root: { type: 'column', children: [{ id: 'a', type: 'divider' }, { id: 'a', type: 'divider' }, { type: 'divider' }, { type: 'divider', id: '' }] },
  });
  unique(spec);
  assert.deepEqual(ids(spec.root), ['column-1', 'a', 'divider-1', 'divider-2', 'divider-3']);
});

test('normalizeSpec: leaves drop children, containers default to []', () => {
  const spec = normalizeSpec({ root: { id: 'r', type: 'row', children: [{ id: 'm', type: 'userMessage', children: [{ type: 'divider' }] }, { id: 'c', type: 'column' }] } });
  assert.equal(spec.root.children![0]!.children, undefined);
  assert.deepEqual(spec.root.children![1]!.children, []);
});

test('normalizeSpec: bad props, frame, theme, name', () => {
  const spec = normalizeSpec({
    name: 5,
    frame: 'billboard',
    theme: { preset: 'nope', overrides: { accent: '#fff', radius: 'big', bogus: 1, mode: 'dark', font: 'comic' } },
    root: { id: 'r', type: 'column', props: 'x' },
  });
  assert.equal(spec.name, 'Untitled screen');
  assert.equal(spec.frame, 'desktop');
  assert.deepEqual(spec.theme, { preset: 'default', overrides: { accent: '#fff', mode: 'dark' } });
  assert.deepEqual(spec.root.props, {});
  assert.deepEqual(normalizeSpec({ root: { type: 'row' }, theme: 'x' }).theme, { preset: 'default' });
});

test('normalizeSpec: non-object root gives an empty-state column; non-object input throws', () => {
  const spec = normalizeSpec({ root: 'oops' });
  assert.equal(spec.root.type, 'column');
  assert.equal(spec.root.children![0]!.type, 'emptyState');
  for (const bad of [null, 'x', 3, [], undefined]) throwsUi(() => normalizeSpec(bad), /object/);
});

/* findNode */

test('findNode returns node, parent and index', () => {
  const spec = sample();
  assert.deepEqual({ parent: findNode(spec, 'root')!.parent, index: findNode(spec, 'root')!.index }, { parent: null, index: -1 });
  const hit = findNode(spec, 'step-2')!;
  assert.equal(hit.parent!.id, 'thread');
  assert.equal(hit.index, 3);
  assert.equal(findNode(spec, 'nope'), undefined);
});

/* ops */

test('applyPatch does not mutate the input', () => {
  const spec = sample();
  applyPatch(spec, [{ op: 'remove', id: 'composer' }, { op: 'rename', name: 'X' }]);
  assert.deepEqual(spec, SAMPLE_SCREEN);
});

test('update merges props; null deletes', () => {
  const out = applyPatch(sample(), [{ op: 'update', id: 'header', props: { title: 'New', model: null, subtitle: 'sub' } }]);
  assert.deepEqual(findNode(out, 'header')!.node.props, { title: 'New', actions: ['share', 'panel-right', 'more'], subtitle: 'sub' });
  throwsUi(() => applyPatch(sample(), [{ op: 'update', id: 'ghost', props: {} }]), /op 1 \(update\): id "ghost" not found/);
});

test('insert: append, index, auto-suffix of clashing descendants', () => {
  let out = applyPatch(sample(), [{ op: 'insert', parent: 'thread', node: { id: 'msg-9', type: 'userMessage', props: { text: 'hi' } } }]);
  assert.equal(findNode(out, 'thread')!.node.children!.at(-1)!.id, 'msg-9');
  out = applyPatch(sample(), [{ op: 'insert', parent: 'thread', index: 0, node: { id: 'wrap', type: 'column', children: [{ id: 'msg-1', type: 'text', props: { text: 'dup' } }, { id: 'msg-1', type: 'divider' }, { id: '', type: 'divider' }] } }]);
  assert.equal(findNode(out, 'thread')!.node.children![0]!.id, 'wrap');
  unique(out);
  assert.equal(findNode(out, 'msg-1')!.node.type, 'userMessage');
});

test('insert errors', () => {
  const node: UiNode = { id: 'n', type: 'divider' };
  throwsUi(() => applyPatch(sample(), [{ op: 'rename', name: 'a' }, { op: 'insert', parent: 'thread', node: { id: 'msg-1', type: 'divider' } }]), /op 2 \(insert\): id "msg-1" already exists/);
  throwsUi(() => applyPatch(sample(), [{ op: 'insert', parent: 'nope', node }]), /op 1 \(insert\): parent "nope" not found/);
  throwsUi(() => applyPatch(sample(), [{ op: 'insert', parent: 'composer', node }]), /parent "composer" is not a container \(type composer\)/);
});

test('replace swaps the subtree, keeps the target id, stays unique', () => {
  const out = applyPatch(sample(), [{ op: 'replace', id: 'sidebar', node: { id: 'other', type: 'column', children: [{ id: 'brand', type: 'text', props: { text: 'x' } }, { id: 'main', type: 'divider' }] } }]);
  const sidebar = findNode(out, 'sidebar')!;
  assert.equal(sidebar.node.children!.length, 2);
  unique(out);
  assert.equal(findNode(out, 'other'), undefined);
  assert.equal(findNode(out, 'main')!.node.type, 'column'); // original main untouched
  const root = applyPatch(sample(), [{ op: 'replace', id: 'root', node: { id: 'zzz', type: 'column' } }]);
  assert.deepEqual(root.root, { id: 'root', type: 'column', props: {}, children: [] });
  throwsUi(() => applyPatch(sample(), [{ op: 'replace', id: 'ghost', node: { id: 'g', type: 'divider' } }]), /id "ghost" not found/);
});

test('remove and root protection', () => {
  const out = applyPatch(sample(), [{ op: 'remove', id: 'sidebar' }]);
  assert.equal(findNode(out, 'sidebar'), undefined);
  assert.equal(findNode(out, 'brand'), undefined);
  throwsUi(() => applyPatch(sample(), [{ op: 'remove', id: 'root' }]), /cannot remove or move the root/);
  throwsUi(() => applyPatch(sample(), [{ op: 'move', id: 'root', parent: 'main' }]), /cannot remove or move the root/);
  throwsUi(() => applyPatch(sample(), [{ op: 'remove', id: 'ghost' }]), /op 1 \(remove\): id "ghost" not found/);
});

test('move reorders and reparents; rejects own subtree', () => {
  let out = applyPatch(sample(), [{ op: 'move', id: 'composer', parent: 'thread', index: 0 }]);
  assert.equal(findNode(out, 'composer')!.parent!.id, 'thread');
  assert.equal(findNode(out, 'composer')!.index, 0);
  unique(out);
  out = applyPatch(sample(), [{ op: 'move', id: 'step-2', parent: 'thread', index: 0 }]);
  assert.equal(findNode(out, 'thread')!.node.children![0]!.id, 'step-2');
  throwsUi(() => applyPatch(sample(), [{ op: 'move', id: 'main', parent: 'thread' }]), /cannot move a node into its own subtree/);
  throwsUi(() => applyPatch(sample(), [{ op: 'move', id: 'main', parent: 'main' }]), /own subtree/);
  throwsUi(() => applyPatch(sample(), [{ op: 'move', id: 'composer', parent: 'header' }]), /not a container \(type header\)/);
  throwsUi(() => applyPatch(sample(), [{ op: 'move', id: 'composer', parent: 'ghost' }]), /parent "ghost" not found/);
});

test('theme, rename, frame', () => {
  let out = applyPatch(sample(), [{ op: 'theme', preset: 'lovable', overrides: { accent: '#000' } }, { op: 'theme', overrides: { radius: 4 } }]);
  assert.deepEqual(out.theme, { preset: 'lovable', overrides: { accent: '#000', radius: 4 } });
  out = applyPatch(out, [{ op: 'rename', name: 'Renamed' }, { op: 'frame', frame: 'mobile' }]);
  assert.equal(out.name, 'Renamed');
  assert.equal(out.frame, 'mobile');
  throwsUi(() => applyPatch(sample(), [{ op: 'theme', preset: 'neon' as never }]), /unknown preset/);
  throwsUi(() => applyPatch(sample(), [{ op: 'frame', frame: 'wall' as never }]), /unknown frame/);
});

/* outline */

test('outlineSpec on SAMPLE_SCREEN', () => {
  const lines = outlineSpec(SAMPLE_SCREEN).split('\n');
  assert.equal(lines[0], 'screen "Agent thread" frame=desktop theme=default');
  assert.equal(lines[1], '  row#root surface=bg');
  assert.ok(lines.includes('      brand#brand "Acme Agent"'));
  assert.ok(lines.some((l) => /^ {6}sidebarNav#nav items=3$/.test(l)));
  assert.ok(lines.some((l) => /sessionList#sessions groups=2/.test(l)));
  assert.ok(lines.some((l) => /column#sidebar .*width=260/.test(l)));
  assert.equal(lines.length, 1 + ids(SAMPLE_SCREEN.root).length);
  assert.ok(lines.every((l) => l.length < 120));
  const themed = applyPatch(sample(), [{ op: 'theme', overrides: { accent: '#f00', radius: 3 } }]);
  assert.match(outlineSpec(themed), /theme=default\(\+2 overrides\)/);
});

/* codegen */

test('toReactCode for SAMPLE_SCREEN', () => {
  const code = toReactCode(SAMPLE_SCREEN);
  assert.match(code, /export default function AgentThreadScreen\(\)/);
  assert.match(code, /import \{ [^}]*Composer[^}]*\} from '@aicl\/react';/);
  assert.match(code, /import \{ Markdown \} from '@aicl\/react\/markdown';/);
  assert.match(code, /ReasoningDisclosure/);
  assert.match(code, /ArtifactCard/);
  assert.match(code, /"--aicl-accent": "#18181b"/);
  assert.match(code, /var\(--aicl-sidebar\)/);
  assert.match(code, /onSubmit=\{\(\) => \{\}\}/);
});

test('toReactCode escapes literals safely', () => {
  const spec = applyPatch(sample(), [{ op: 'update', id: 'msg-1', props: { text: 'a "quote" {brace} <tag> `tick` \\ \n line' } }, { op: 'rename', name: '9 lives!' }]);
  const code = toReactCode(spec);
  assert.match(code, /\{"a \\"quote\\" \{brace\} <tag> `tick` \\\\ \\n line"\}/);
  assert.match(code, /function Screen9LivesScreen\(\)/);
});

test('resolveTheme: flipping a light preset to dark brings a dark palette and a visible accent', async () => {
  const { resolveTheme } = await import('../shared/ui-spec.ts');
  const dark = resolveTheme({ preset: 'devin', overrides: { mode: 'dark' } });
  assert.equal(dark.mode, 'dark');
  assert.equal(dark.bg, '#161616');
  assert.equal(dark.accent, '#fafafa', 'near-black accent inverted');
  const violet = resolveTheme({ preset: 'default', overrides: { mode: 'dark', accent: '#7c3aed' } });
  assert.equal(violet.accent, '#7c3aed', 'explicit accent wins');
  assert.equal(violet.surface, '#1c1c1c');
  const lovableLight = resolveTheme({ preset: 'lovable', overrides: { mode: 'light' } });
  assert.equal(lovableLight.bg, '#f8f8f7');
  assert.equal(lovableLight.accent, '#e14a8b', 'coloured accent kept');
  const same = resolveTheme({ preset: 'manus' });
  assert.equal(same.bg, '#f8f8f7');
});
