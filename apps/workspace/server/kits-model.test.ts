import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Message, Part } from '@aicl/core';
import { KITS } from '../shared/kits.ts';
import { aggregateTimeline, segmentParts, turnSeconds } from '../web/kits/model.ts';
import { buildThread } from '../web/ui/run-thread.ts';

const call = (id: string, name: string, status: 'success' | 'running' = 'success'): Part => ({ type: 'tool-call', toolCallId: id, name, args: {}, status });
const parts: Part[] = [
  { type: 'reasoning', text: 'hm', durationMs: 2000 },
  call('1', 'read'),
  call('2', 'grep'),
  call('3', 'plan_update'),
  call('4', 'bash', 'running'),
  { type: 'text', text: 'done' },
];

test('segments: standalone tools break groups; cards never fold', () => {
  const kinds = (s: ReturnType<typeof segmentParts>) => s.map((x) => x.kind);
  assert.deepEqual(kinds(segmentParts(parts, { toolCalls: 'timeline', reasoning: 'inline' })), ['reasoning', 'work', 'standalone', 'work', 'text']);
  assert.deepEqual(kinds(segmentParts(parts, { toolCalls: 'cards', reasoning: 'inline' })), ['reasoning', 'work', 'work', 'standalone', 'work', 'text']);
});

test('segments: work-summary folds the whole turn (reasoning included) into one group', () => {
  const segs = segmentParts(parts, { toolCalls: 'work-summary', reasoning: 'in-work' });
  assert.deepEqual(segs.map((s) => s.kind), ['work', 'standalone', 'text']);
  const work = segs[0]!;
  assert.equal(work.kind === 'work' && work.items.length, 4);
});

test('ask_user stays standalone in every kit', () => {
  for (const kit of Object.values(KITS)) {
    const segs = segmentParts([call('q', 'ask_user'), call('r', 'read')], { toolCalls: kit.transcript.toolCalls, reasoning: kit.transcript.reasoning });
    assert.equal(segs[0]!.kind, 'standalone', kit.id);
  }
});

test('timeline: consecutive successes aggregate into "Ran N actions"', () => {
  const segs = segmentParts(parts, { toolCalls: 'timeline', reasoning: 'inline' });
  const work = segs[1]!;
  assert.ok(work.kind === 'work');
  const entries = aggregateTimeline(work.items);
  assert.equal(entries[0]!.kind, 'aggregate');
});

test('turnSeconds prefers the gap to the next message', () => {
  const msgs: Message[] = [
    { id: 'a', role: 'assistant', createdAt: 1000, parts: [call('1', 'read')] },
    { id: 'u', role: 'user', createdAt: 12000, parts: [] },
  ];
  assert.equal(turnSeconds(msgs, 0), 11);
});

test('buildThread folds steps per kit', () => {
  const messages: Message[] = [
    { id: 'u', role: 'user', parts: [{ type: 'text', text: 'hi' }] },
    { id: 'a', role: 'assistant', parts: [{ type: 'reasoning', text: 'hm', durationMs: 4000 }, call('1', 'read'), call('2', 'grep'), { type: 'text', text: 'hello' }] },
  ];
  const label = (p: { name: string }) => p.name;
  const types = (k: keyof typeof KITS) => buildThread(messages, { busy: false, label, kit: KITS[k] }).map((n) => n.type);
  assert.deepEqual(types('aicl'), ['userMessage', 'reasoning', 'toolStep', 'toolStep', 'assistantMessage']);
  assert.deepEqual(types('devin'), ['userMessage', 'reasoning', 'assistantMessage']);
  assert.deepEqual(types('manus'), ['userMessage', 'reasoning', 'assistantMessage']);
  assert.deepEqual(types('lovable'), ['userMessage', 'reasoning', 'toolStep', 'assistantMessage']);
  assert.deepEqual(types('cofounder'), ['userMessage', 'reasoning', 'toolStep', 'assistantMessage']);
  const devin = buildThread(messages, { busy: false, label, kit: KITS.devin })[1]!;
  assert.equal((devin.props as { steps: unknown[] }).steps.length, 2);
  assert.equal((devin.props as { durationSec: number }).durationSec, 4);
});
