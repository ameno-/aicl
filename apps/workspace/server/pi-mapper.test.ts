import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ChatController, type ChatTransport, type StreamEvent } from '@aicl/core';
import { createPiEventMapper, type PiEvent } from './pi-mapper.ts';

const call = { type: 'toolCall' as const, id: 'tc1', name: 'scratch_add', arguments: { shapes: [] } };
const assistant = (extra: object = {}) => ({
  role: 'assistant',
  content: [],
  stopReason: 'stop',
  usage: { input: 10, output: 5, cost: { total: 0.01 } },
  ...extra,
});

/** Two turns: thinking + tool call, then the tool runs, then a text answer. */
const twoTurns: PiEvent[] = [
  { type: 'agent_start' },
  { type: 'turn_start' },
  { type: 'message_start', message: { role: 'user' } },
  { type: 'message_start', message: { role: 'assistant' } },
  { type: 'message_update', assistantMessageEvent: { type: 'thinking_start', contentIndex: 0, partial: assistant() } },
  { type: 'message_update', assistantMessageEvent: { type: 'thinking_delta', contentIndex: 0, delta: 'plan' } },
  { type: 'message_update', assistantMessageEvent: { type: 'thinking_end', contentIndex: 0, content: 'plan' } },
  {
    type: 'message_update',
    assistantMessageEvent: { type: 'toolcall_start', contentIndex: 1, partial: assistant({ content: [{ type: 'thinking' }, call] }) },
  },
  { type: 'message_update', assistantMessageEvent: { type: 'toolcall_delta', contentIndex: 1, delta: '{"shapes"' } },
  { type: 'message_update', assistantMessageEvent: { type: 'toolcall_end', contentIndex: 1, toolCall: call } },
  { type: 'message_end', message: assistant({ stopReason: 'toolUse' }) },
  { type: 'tool_execution_start', toolCallId: 'tc1' },
  { type: 'tool_execution_end', toolCallId: 'tc1', isError: false },
  { type: 'turn_end' },
  { type: 'turn_start' },
  { type: 'message_start', message: { role: 'assistant' } },
  { type: 'message_update', assistantMessageEvent: { type: 'text_start', contentIndex: 0, partial: assistant() } },
  { type: 'message_update', assistantMessageEvent: { type: 'text_delta', contentIndex: 0, delta: 'Drew ' } },
  { type: 'message_update', assistantMessageEvent: { type: 'text_delta', contentIndex: 0, delta: 'it.' } },
  { type: 'message_update', assistantMessageEvent: { type: 'text_end', contentIndex: 0, content: 'Drew it.' } },
  { type: 'message_end', message: assistant() },
  { type: 'agent_end' },
];

const mapAll = (events: PiEvent[]): StreamEvent[] => {
  const map = createPiEventMapper('m1');
  return events.flatMap(map);
};

test('turns append to one message; the second turn does not overwrite the first', () => {
  const out = mapAll(twoTurns);
  assert.deepEqual(out[0], { type: 'message-start', id: 'm1', role: 'assistant' });
  const starts = out.filter((e) => e.type === 'part-start').map((e) => (e as { index: number }).index);
  assert.deepEqual(starts, [0, 1, 2], 'text from turn two lands at index 2, not 0');
  const last = out[out.length - 1]!;
  assert.equal(last.type, 'message-end');
  assert.deepEqual((last as { usage: unknown }).usage, { inputTokens: 20, outputTokens: 10, costUsd: 0.02 });
});

test('tool status walks pending → running → success', () => {
  const statuses = mapAll(twoTurns)
    .filter((e) => e.type === 'part-end' && e.part?.type === 'tool-call')
    .map((e) => ((e as { part: { status: string } }).part.status));
  assert.deepEqual(statuses, ['pending', 'running', 'success']);
});

test('an empty thinking block emits nothing; text still lands at index 0', () => {
  const out = mapAll([
    { type: 'agent_start' },
    { type: 'message_start', message: { role: 'assistant' } },
    { type: 'message_update', assistantMessageEvent: { type: 'thinking_start', contentIndex: 0, partial: assistant() } },
    { type: 'message_update', assistantMessageEvent: { type: 'thinking_end', contentIndex: 0, content: '' } },
    { type: 'message_update', assistantMessageEvent: { type: 'text_start', contentIndex: 1, partial: assistant() } },
    { type: 'message_update', assistantMessageEvent: { type: 'text_end', contentIndex: 1, content: 'ok' } },
    { type: 'message_end', message: assistant() },
    { type: 'agent_end' },
  ]);
  const parts = out.filter((e) => e.type === 'part-start').map((e) => (e as { index: number; part: { type: string } }));
  assert.deepEqual(parts.map((p) => [p.index, p.part.type]), [[0, 'text']]);
});

test('a failed run surfaces as an error event, not a clean finish', () => {
  const out = mapAll([
    { type: 'agent_start' },
    { type: 'message_start', message: { role: 'assistant' } },
    { type: 'message_end', message: assistant({ stopReason: 'error', errorMessage: 'rate limited' }) },
    { type: 'agent_end' },
  ]);
  assert.deepEqual(out[out.length - 1], { type: 'error', error: { message: 'rate limited', retryable: true } });
});

test('the mapped stream drives a ChatController to the expected message', async () => {
  const transport: ChatTransport = {
    async *send() {
      yield* mapAll(twoTurns);
    },
  };
  const chat = new ChatController({ transport });
  await chat.send('draw it');
  const reply = chat.messages[1]!;
  assert.equal(chat.state.get().status, 'idle');
  assert.deepEqual(
    reply.parts.map((p) => p.type),
    ['reasoning', 'tool-call', 'text'],
  );
  assert.equal((reply.parts[2] as { text: string }).text, 'Drew it.');
  assert.equal((reply.parts[1] as { status: string }).status, 'success');
});
