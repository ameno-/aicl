import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { StreamEvent } from '@aicl/core';
import type { ShapeSummary } from '../shared/scratch.ts';
import { stripCanvasContext } from './sessions.ts';
import { createNodeLogic, inputsOf, nodeContextBlock } from './nodes.ts';

const comp = (id: string, component: string, props: Record<string, unknown>, title?: string): ShapeSummary => ({
  id,
  kind: 'component',
  type: 'aicl-component',
  x: 0,
  y: 0,
  component,
  props,
  ...(title ? { title } : {}),
});
const arrow = (id: string, from: string, to: string): ShapeSummary => ({ id, kind: 'arrow', type: 'arrow', x: 0, y: 0, from, to });
const note = (id: string, text: string): ShapeSummary => ({ id, kind: 'note', type: 'note', x: 0, y: 0, text });

const canvas = (): ShapeSummary[] => [
  comp('res', 'agent', { name: 'Researcher', role: 'list facts', sessionId: 's-res' }),
  comp('wri', 'agent', { name: 'Writer', role: 'write a paragraph', sessionId: 's-wri' }),
  note('n1', 'topic: octopuses'),
  comp('out', 'plan', { steps: [] }),
  arrow('a1', 'res', 'wri'),
  arrow('a2', 'n1', 'wri'),
  arrow('a3', 'wri', 'out'), // outgoing: ignored for wri
];

test('inputsOf keeps arrows into the node and ignores outgoing ones', () => {
  assert.deepEqual(inputsOf(canvas(), 'wri').map((s) => s.id), ['res', 'n1']);
  assert.deepEqual(inputsOf(canvas(), 'res'), []);
  assert.deepEqual(inputsOf(canvas(), 'out').map((s) => s.id), ['wri']);
});

test('context block carries the role and inputs, and is stripped from history', () => {
  const shapes = canvas();
  const block = nodeContextBlock(shapes[1]!, inputsOf(shapes, 'wri'), (id) => (id === 's-res' ? '1. Eight arms' : undefined));
  assert.match(block, /^\n\n<canvas-context>\n/);
  assert.match(block, /Your role: write a paragraph/);
  assert.match(block, /agent "Researcher" \(res\), its latest reply: 1\. Eight arms/);
  assert.match(block, /note \(n1\): topic: octopuses/);
  assert.equal(stripCanvasContext(`hello${block}`), 'hello');
});

test('a node with no role and no inputs gets no block', () => {
  assert.equal(nodeContextBlock(comp('x', 'agent', { name: 'X' }), [], () => undefined), '');
});

/** A hub whose "agents" answer from a script and remember their prompts. */
function fakeHub() {
  const messages = new Map<string, unknown[]>([['s-res', [{ role: 'assistant', content: [{ type: 'text', text: 'Fact A. Fact B.' }] }]]]);
  const prompts: Array<{ id: string; text: string }> = [];
  const busy = new Set<string>();
  const hub = {
    reserve(id: string) {
      if (busy.has(id)) throw new Error('busy');
      busy.add(id);
    },
    async *run(id: string, text: string): AsyncGenerator<StreamEvent> {
      prompts.push({ id, text });
      messages.set(id, [...(messages.get(id) ?? []), { role: 'assistant', content: [{ type: 'text', text: `reply to: ${stripCanvasContext(text)}` }] }]);
      busy.delete(id);
      yield { type: 'text-delta', id: 't', delta: 'x' } as unknown as StreamEvent;
    },
    async agent(id: string) {
      return { messages: messages.get(id) ?? [] } as never;
    },
    async create() {
      return { id: 'new-session' } as never;
    },
  };
  return { hub, prompts };
}

test('agent_send runs the node with its role and inputs, and returns the reply', async () => {
  const { hub, prompts } = fakeHub();
  const logic = createNodeLogic({ hub: () => hub, readCanvas: async () => canvas(), saveSession: async () => {} });
  const reply = await logic.send('shape:wri', 'Write it.');
  assert.equal(reply, 'reply to: Write it.');
  assert.equal(prompts.length, 1);
  assert.equal(prompts[0]!.id, 's-wri');
  assert.match(prompts[0]!.text, /Your role: write a paragraph/);
  assert.match(prompts[0]!.text, /Fact A\. Fact B\./);
});

test('agent_send creates and saves a session for a node that has none; unknown nodes fail', async () => {
  const { hub } = fakeHub();
  const saved: Array<{ id: string; props: Record<string, unknown> }> = [];
  const shapes = [comp('fresh', 'agent', { name: 'Fresh' })];
  const logic = createNodeLogic({ hub: () => hub, readCanvas: async () => shapes, saveSession: async (id, props) => void saved.push({ id, props }) });
  assert.equal(await logic.send('fresh', 'hi'), 'reply to: hi');
  assert.deepEqual(saved, [{ id: 'fresh', props: { name: 'Fresh', sessionId: 'new-session' } }]);
  await assert.rejects(logic.send('nope', 'hi'), /No agent node "nope"/);
});

test('contextForSession finds the node by its session id', async () => {
  const { hub } = fakeHub();
  const logic = createNodeLogic({ hub: () => hub, readCanvas: async () => canvas(), saveSession: async () => {} });
  assert.match(await logic.contextForSession('s-wri'), /Fact A\./);
  assert.equal(await logic.contextForSession('main'), '');
});
