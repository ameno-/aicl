import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ChatHandlerError, createChatHandler } from './handler.js';
import type { Message, StreamEvent } from '@aicl/core';

function makeMessages(): Message[] {
  return [
    { id: 'u1', role: 'user', parts: [{ type: 'text', text: 'hi' }] },
  ];
}

function makeBody(messages: Message[] = makeMessages()) {
  return { messages, model: 'gpt-4o', temperature: 0.5 };
}

function decode(sse: Uint8Array): string {
  return new TextDecoder().decode(sse);
}

async function collect(sse: AsyncIterable<Uint8Array>): Promise<string[]> {
  const frames: string[] = [];
  for await (const frame of sse) frames.push(decode(frame));
  return frames;
}

test('createChatHandler streams SSE events from the handler', async () => {
  const handler = createChatHandler(async function* () {
    yield { type: 'message-start', id: 'a1', role: 'assistant' as const };
    yield { type: 'part-start', index: 0, part: { type: 'text', text: '' } };
    yield { type: 'part-delta', index: 0, delta: 'Hello' };
    yield { type: 'part-end', index: 0 };
    yield { type: 'message-end', finishReason: 'stop' as const };
  });

  const response = await handler(makeBody());
  const frames = await collect(response.toSse());
  const events = frames.filter((f) => f.startsWith('data: ') && !f.includes('[DONE]')).map((f) => JSON.parse(f.slice(6)) as StreamEvent);

  assert.equal(events.length, 5);
  assert.equal(events[0]?.type, 'message-start');
  assert.equal(events.at(-1)?.type, 'message-end');
  assert.ok(frames.some((f) => f.includes('[DONE]')));
});

test('createChatHandler surfaces handler errors as ChatHandlerError', async () => {
  const handler = createChatHandler(async function* () {
    throw new ChatHandlerError(401, 'no token', false);
    yield { type: 'message-start' as const, id: 'a1', role: 'assistant' as const };
  });

  await assert.rejects(async () => {
    const response = await handler(makeBody());
    for await (const _ of response.toSse()) {
      // drain until the throw surfaces
    }
  }, (err: unknown) => {
    assert.ok(err instanceof ChatHandlerError);
    assert.equal((err as ChatHandlerError).status, 401);
    assert.equal((err as ChatHandlerError).retryable, false);
    return true;
  });
});

test('createChatHandler rejects malformed bodies with 400', async () => {
  const handler = createChatHandler(async function* () {
    yield { type: 'message-start', id: 'a1', role: 'assistant' as const };
  });

  await assert.rejects(() => handler(null), (err: unknown) => {
    assert.ok(err instanceof ChatHandlerError);
    assert.equal((err as ChatHandlerError).status, 400);
    return true;
  });
});

test('toSse() converts a thrown stream error into a StreamEvent error frame', async () => {
  const handler = createChatHandler(async function* () {
    yield { type: 'message-start', id: 'a1', role: 'assistant' as const };
    throw new Error('upstream closed');
  });

  const response = await handler(makeBody());
  const frames = await collect(response.toSse());
  const errorFrame = frames.find((f) => f.includes('"type":"error"'));
  assert.ok(errorFrame, 'error frame is emitted');
  assert.ok(frames.some((f) => f.includes('[DONE]')));
});
