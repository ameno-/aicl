import assert from 'node:assert/strict';
import { test } from 'node:test';
import { COMPONENT_NAMES, COMPONENT_SHAPE_TYPE, COMPONENTS } from '../shared/components.ts';
import { summarize } from '../shared/scratch.ts';
import { createScratchTools, describeComponents } from './tools.ts';

test('summarize maps aicl-component records to component summaries', () => {
  const s = summarize([
    {
      typeName: 'shape',
      id: 'shape:plan1',
      type: COMPONENT_SHAPE_TYPE,
      x: 10.4,
      y: 20,
      props: { w: 340, h: 220, component: 'plan', title: 'Plan', props: { steps: [] } },
    },
  ])[0]!;
  assert.equal(s.kind, 'component');
  assert.equal(s.id, 'plan1');
  assert.equal(s.component, 'plan');
  assert.equal(s.title, 'Plan');
  assert.deepEqual(s.props, { steps: [] });
  assert.equal(s.w, 340);
  assert.equal(s.h, 220);
  assert.equal(s.x, 10);
});

test('summarize leaves text shapes unchanged', () => {
  const s = summarize([
    {
      typeName: 'shape',
      id: 'shape:t',
      type: 'text',
      x: 1,
      y: 2,
      props: {
        color: 'black',
        richText: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'hi' }] }] },
      },
    },
  ])[0]!;
  assert.equal(s.kind, 'text');
  assert.equal(s.text, 'hi');
  assert.equal(s.component, undefined);
  assert.equal(s.props, undefined);
});

test('scratch_add description lists every component', () => {
  const tools = createScratchTools({} as never, {} as never);
  const add = tools.find((t) => t.name === 'scratch_add')!;
  for (const spec of COMPONENTS) {
    assert.ok(add.description.includes(spec.name), spec.name);
    assert.ok(add.description.includes(spec.propsHint), `${spec.name} propsHint`);
  }
  assert.equal(COMPONENT_NAMES.length, describeComponents().split('\n').length);
});
