import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ScratchOp, ScratchResult } from '../shared/scratch.ts';
import { UiSpecError } from '../shared/ui-ops.ts';
import { FRAME_SIZES, NODE_TYPES, THEME_PRESETS, type ScreenSpec } from '../shared/ui-spec.ts';
import { createUiTools, type UiOps } from './ui-tools.ts';

const spec = (name = 'S'): ScreenSpec => ({ name, frame: 'mobile', theme: { preset: 'default' }, root: { id: 'root', type: 'column' } });

function setup(opts: { stored?: unknown; patchError?: string } = {}) {
  const calls: string[] = [];
  const sent: ScratchOp[] = [];
  const relay = {
    async request(op: ScratchOp): Promise<ScratchResult> {
      sent.push(op);
      calls.push(op.op);
      if (op.op === 'add') return { op: 'add', ids: ['scr1'] };
      if (op.op === 'ui_get') return { op: 'ui_get', spec: opts.stored ?? spec() };
      if (op.op === 'ui_set') return { op: 'ui_set', ids: [op.id] };
      if (op.op === 'read') {
        return {
          op: 'read',
          shapes: [
            { id: 'a', kind: 'text', type: 'text', x: 0, y: 0 },
            { id: 'scr1', kind: 'component', type: 'aicl-component', x: 0, y: 0, component: 'screen', title: 'T', props: spec('Thread') as never },
          ],
        };
      }
      throw new Error('unexpected');
    },
  };
  const ops: UiOps = {
    normalizeSpec: (raw) => {
      calls.push('normalize');
      return { ...spec('normalized'), ...(raw as object), normalized: true } as ScreenSpec;
    },
    applyPatch: (s, patch) => {
      calls.push('apply');
      if (opts.patchError) throw new UiSpecError(opts.patchError);
      return { ...s, name: `patched-${patch.length}` };
    },
    findNode: () => undefined,
    outlineSpec: (s) => `outline:${s.name}`,
    toReactCode: (s) => `code:${s.name}`,
  };
  const tools = createUiTools(relay, ops);
  const tool = (name: string) => tools.find((t) => t.name === name)!;
  const exec = (name: string, params: unknown) => (tool(name).execute as (...a: unknown[]) => Promise<{ content: { text: string }[] }>)('id', params, undefined);
  return { calls, sent, tool, exec };
}

test('ui_create_screen sends an add op for a normalised screen component', async () => {
  const { sent, exec } = setup();
  const out = await exec('ui_create_screen', { id: 'thread', name: 'Thread', frame: 'mobile', x: 5, y: 6 });
  const op = sent[0] as Extract<ScratchOp, { op: 'add' }>;
  assert.equal(op.op, 'add');
  const shape = op.shapes[0]!;
  assert.equal(shape.kind, 'component');
  assert.equal(shape.component, 'screen');
  assert.equal(shape.id, 'thread');
  assert.equal((shape.props as Record<string, unknown>)['normalized'], true);
  assert.equal(shape.w, Math.round(FRAME_SIZES.mobile.w * 0.6));
  assert.equal(shape.h, Math.round(FRAME_SIZES.mobile.h * 0.6) + 32);
  const body = JSON.parse(out.content[0]!.text);
  assert.equal(body.id, 'scr1');
  assert.match(body.outline, /^outline:/);
});

test('ui_patch_screen does get, patch, set in order', async () => {
  const { calls, sent, exec } = setup();
  const out = await exec('ui_patch_screen', { id: 'scr1', ops: [{ op: 'rename', name: 'X' }] });
  assert.deepEqual(calls, ['ui_get', 'normalize', 'apply', 'ui_set']);
  const set = sent[1] as Extract<ScratchOp, { op: 'ui_set' }>;
  assert.equal((set.spec as ScreenSpec).name, 'patched-1');
  assert.match(out.content[0]!.text, /outline:patched-1/);
});

test('ui_patch_screen surfaces UiSpecError as a tool error and never sets', async () => {
  const { calls, exec } = setup({ patchError: 'No node "nope"' });
  await assert.rejects(exec('ui_patch_screen', { id: 'scr1', ops: [{ op: 'remove', id: 'nope' }] }), /No node "nope"/);
  assert.ok(!calls.includes('ui_set'));
});

test('ui_set_theme applies a theme op; ui_export_code returns code; ui_list_screens filters screens', async () => {
  const { calls, exec } = setup();
  await exec('ui_set_theme', { id: 'scr1', preset: 'lovable' });
  assert.deepEqual(calls.slice(-1), ['ui_set']);
  const code = await exec('ui_export_code', { id: 'scr1' });
  assert.equal(code.content[0]!.text, 'code:S');
  const list = JSON.parse((await exec('ui_list_screens', {})).content[0]!.text);
  assert.deepEqual(list, [{ id: 'scr1', name: 'Thread', frame: 'mobile', preset: 'default' }]);
});

test('ui_create_screen description lists every node type, preset and frame', () => {
  const { tool } = setup();
  const d = tool('ui_create_screen').description;
  for (const n of NODE_TYPES) assert.ok(d.includes(`- ${n.type}`), n.type);
  for (const p of Object.keys(THEME_PRESETS)) assert.ok(d.includes(`${p}:`), p);
  for (const f of Object.keys(FRAME_SIZES)) assert.ok(d.includes(f), f);
});
