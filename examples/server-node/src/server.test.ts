import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createChatHandler } from '@aicl/server';

void StreamEvents;
async function* StreamEvents() {
  yield { type: 'message-start', id: 'a1', role: 'assistant' as const };
  yield { type: 'part-start', index: 0, part: { type: 'text', text: '' } };
  yield { type: 'part-delta', index: 0, delta: 'hi' };
  yield { type: 'message-end', finishReason: 'stop' as const };
}

test('createChatHandler is exported and yields events', async () => {
  const handler = createChatHandler(StreamEvents);
  const body = {
    messages: [{ id: 'u1', role: 'user', parts: [{ type: 'text', text: 'ping' }] }],
    model: 'gpt-4o',
  };
  const response = await handler(body);
  const frames: string[] = [];
  for await (const frame of response.toSse()) frames.push(new TextDecoder().decode(frame));
  assert.ok(frames.some((f) => f.startsWith('data: ')));
  assert.ok(frames.some((f) => f.includes('[DONE]')));
});
