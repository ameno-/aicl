import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Message } from '@aicl/core';
import { buildThread, findRunTargets, readRunSessionId, withRunSessionId } from '../web/ui/run-thread.ts';
import { SAMPLE_SCREEN, type UiNode } from '../shared/ui-spec.ts';

const label = (p: { name: string }) => `did ${p.name}`;

test('targets: sample uses thread and composer ids', () => {
  const t = findRunTargets(SAMPLE_SCREEN.root);
  assert.equal(t.threadId, 'thread');
  assert.equal(t.composerId, 'composer');
  assert.deepEqual(t.keepIds, []);
});

test('targets: falls back to the composer column and keeps the composer', () => {
  const root = {
    id: 'r',
    type: 'column',
    children: [{ id: 'main', type: 'column', children: [{ id: 'c1', type: 'composer' }] }],
  } as UiNode;
  assert.deepEqual(findRunTargets(root), { threadId: 'main', composerId: 'c1', keepIds: ['c1'] });
});

test('buildThread maps parts to screen elements', () => {
  const messages = [
    { id: 'u', role: 'user', parts: [{ type: 'text', text: 'hi' }] },
    {
      id: 'a',
      role: 'assistant',
      parts: [
        { type: 'reasoning', text: 'hm', durationMs: 4000 },
        { type: 'tool-call', toolCallId: 't', name: 'read', args: {}, status: 'success' },
        { type: 'tool-call', toolCallId: 'p', name: 'plan_update', args: { steps: [{ label: 'a', status: 'done' }] }, status: 'success' },
        { type: 'text', text: 'hello' },
      ],
    },
  ] as Message[];
  const nodes = buildThread(messages, { busy: false, label });
  assert.deepEqual(nodes.map((n) => n.type), ['userMessage', 'reasoning', 'toolStep', 'plan', 'assistantMessage']);
  assert.equal((nodes[2]!.props as { label: string }).label, 'did read');
  assert.equal(new Set(nodes.map((n) => n.id)).size, nodes.length);
});

test('buildThread appends a streaming indicator while busy', () => {
  const nodes = buildThread([{ id: 'u', role: 'user', parts: [{ type: 'text', text: 'hi' }] }] as Message[], { busy: true, label });
  assert.equal(nodes.at(-1)!.type, 'reasoning');
});

test('run session id lives on root props', () => {
  const spec = withRunSessionId(structuredClone(SAMPLE_SCREEN), 's1');
  assert.equal(readRunSessionId(spec.root), 's1');
});
