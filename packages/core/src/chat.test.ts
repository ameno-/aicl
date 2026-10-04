/**
 * Behavioural tests for the conversation engine. Run with `node --test`
 * after compiling, or via tsx. No DOM and no framework required, which is the
 * point of keeping core framework-agnostic.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ChatController } from './chat.js';
import type { ChatTransport, StreamEvent } from './types.js';

function fakeTransport(events: StreamEvent[], delayMs = 0): ChatTransport {
  return {
    async *send(_req, signal) {
      for (const event of events) {
        if (signal.aborted) return;
        if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
        yield event;
      }
    },
  };
}

const textReply = (id: string, chunks: string[]): StreamEvent[] => [
  { type: 'message-start', id, role: 'assistant' },
  { type: 'part-start', index: 0, part: { type: 'text', text: '' } },
  ...chunks.map((delta) => ({ type: 'part-delta' as const, index: 0, delta })),
  { type: 'part-end', index: 0 },
  { type: 'message-end', finishReason: 'stop' as const },
];

test('accumulates streamed deltas into a single text part', async () => {
  const chat = new ChatController({
    transport: fakeTransport(textReply('a1', ['Hel', 'lo, ', 'world'])),
  });

  await chat.send('hi');

  assert.equal(chat.messages.length, 2);
  const reply = chat.messages[1]!;
  assert.equal(reply.role, 'assistant');
  assert.equal(reply.parts.length, 1);
  assert.deepEqual(reply.parts[0], { type: 'text', text: 'Hello, world' });
  assert.equal(chat.status, 'idle');
});

test('rejects a second submit while a turn is in flight', async () => {
  const chat = new ChatController({
    transport: fakeTransport(textReply('a1', ['one']), 5),
  });

  const first = chat.send('first');
  // Not awaited: this lands while status is 'submitted'/'streaming'.
  await chat.send('second');
  await first;

  const users = chat.messages.filter((m) => m.role === 'user');
  assert.equal(users.length, 1, 'second submit must be dropped, not queued');
});

test('stop() preserves partial output and flags it aborted', async () => {
  const chat = new ChatController({
    transport: fakeTransport(textReply('a1', ['par', 'tial', ' more']), 10),
  });

  const running = chat.send('hi');
  await new Promise((r) => setTimeout(r, 35));
  chat.stop();
  await running;

  const reply = chat.messages[1]!;
  assert.equal(reply.aborted, true);
  assert.equal(chat.status, 'aborted');
  const part = reply.parts[0]!;
  assert.equal(part.type, 'text');
  assert.ok(
    part.type === 'text' && part.text.length > 0,
    'partial text must be retained on abort',
  );
});

test('tool-call deltas accumulate into argsText, not text', async () => {
  const chat = new ChatController({
    transport: fakeTransport([
      { type: 'message-start', id: 'a1', role: 'assistant' },
      {
        type: 'part-start',
        index: 0,
        part: { type: 'tool-call', toolCallId: 't1', name: 'search', args: {}, status: 'running' },
      },
      { type: 'part-delta', index: 0, delta: '{"q":' },
      { type: 'part-delta', index: 0, delta: '"vllm"}' },
      {
        type: 'part-end',
        index: 0,
        part: {
          type: 'tool-call',
          toolCallId: 't1',
          name: 'search',
          args: { q: 'vllm' },
          status: 'success',
        },
      },
      { type: 'message-end', finishReason: 'tool-calls' },
    ]),
  });

  await chat.send('search for vllm');
  const part = chat.messages[1]!.parts[0]!;
  assert.equal(part.type, 'tool-call');
  assert.deepEqual(part.type === 'tool-call' ? part.args : null, { q: 'vllm' });
  assert.equal(part.type === 'tool-call' ? part.status : null, 'success');
});

test('editing a user message forks instead of destroying history', async () => {
  const chat = new ChatController({
    transport: fakeTransport(textReply('a1', ['ok'])),
  });

  await chat.send('original');
  const originalUserId = chat.messages[0]!.id;

  await chat.edit(originalUserId, 'revised');

  // The active path shows the revision.
  assert.equal(
    chat.messages[0]!.parts[0]!.type === 'text' &&
      (chat.messages[0]!.parts[0] as { text: string }).text,
    'revised',
  );
  // The original is still reachable.
  chat.selectBranch(originalUserId);
  assert.equal(
    chat.messages[0]!.parts[0]!.type === 'text' &&
      (chat.messages[0]!.parts[0] as { text: string }).text,
    'original',
  );
});

test('transport failure surfaces as retryable error state', async () => {
  const chat = new ChatController({
    transport: {
      // eslint-disable-next-line require-yield
      async *send() {
        throw new Error('upstream 503');
      },
    },
    onError: () => {},
  });

  await chat.send('hi');
  assert.equal(chat.status, 'error');
});

test('status is submitted before the first event, then idle after message-end', async () => {
  let release: (() => void) | undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const chat = new ChatController({
    transport: {
      async *send(_req, signal) {
        await gate;
        if (signal.aborted) return;
        yield { type: 'message-start', id: 'a1', role: 'assistant' };
        yield { type: 'part-start', index: 0, part: { type: 'text', text: 'x' } };
        yield { type: 'message-end', finishReason: 'stop' };
      },
    },
  });

  const pending = chat.send('hi');
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(chat.status, 'submitted');
  release?.();
  await pending;
  assert.equal(chat.status, 'idle');
  assert.equal(chat.messages[1]?.role, 'assistant');
});

test('stop during submitted returns to idle and does not invent an assistant message', async () => {
  let release: (() => void) | undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const chat = new ChatController({
    transport: {
      async *send(_req, signal) {
        await gate;
        if (signal.aborted) return;
        yield { type: 'message-start', id: 'a1', role: 'assistant' };
      },
    },
  });

  const pending = chat.send('hi');
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(chat.status, 'submitted');
  chat.stop();
  release?.();
  await pending;
  assert.equal(chat.status, 'idle');
  assert.equal(chat.messages.length, 1);
  assert.equal(chat.messages[0]?.role, 'user');
});

test('stop marks in-flight tool calls cancelled, not failed', async () => {
  let release: (() => void) | undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const chat = new ChatController({
    transport: {
      async *send(_req, signal) {
        yield { type: 'message-start', id: 'a1', role: 'assistant' };
        yield {
          type: 'part-start',
          index: 0,
          part: { type: 'text', text: 'partial' },
        };
        yield {
          type: 'part-start',
          index: 1,
          part: { type: 'tool-call', toolCallId: 't1', name: 'search', args: {}, status: 'running' },
        };
        await gate;
        if (signal.aborted) return;
        yield { type: 'message-end', finishReason: 'stop' };
      },
    },
  });

  const pending = chat.send('hi');
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(chat.status, 'streaming');
  chat.stop();
  release?.();
  await pending;

  assert.equal(chat.status, 'aborted');
  const reply = chat.messages[1]!;
  assert.equal(reply.aborted, true);
  const tool = reply.parts[1];
  assert.equal(tool?.type, 'tool-call');
  assert.equal(tool?.type === 'tool-call' ? tool.status : null, 'cancelled');
});

test('an error event is terminal and is not overwritten by idle', async () => {
  const chat = new ChatController({
    transport: fakeTransport([
      { type: 'message-start', id: 'a1', role: 'assistant' },
      { type: 'part-start', index: 0, part: { type: 'text', text: 'partial' } },
      { type: 'error', error: { message: 'model failed', retryable: true } },
      { type: 'message-end', finishReason: 'stop' },
    ]),
  });

  await chat.send('hi');
  assert.equal(chat.status, 'error');
  assert.equal(chat.state.get().error?.message, 'model failed');
  assert.equal(chat.messages[1]?.parts[0]?.type === 'text' ? chat.messages[1]?.parts[0].text : '', 'partial');
});

test('empty submissions are ignored', async () => {
  const chat = new ChatController({ transport: fakeTransport([]) });
  await chat.send('   ');
  assert.equal(chat.messages.length, 0);
});
