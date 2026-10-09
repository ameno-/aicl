// A backend that needs no API key: it "thinks", runs a pretend tool, and
// streams back what you wrote. Use it to try the UI, then switch to a real one.

import { textOf } from '../backend.js';

const sleep = (ms, signal) =>
  new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => (clearTimeout(timer), resolve()), { once: true });
  });

/** @returns {import('../backend.js').ChatBackend} */
export function createEchoBackend({ delayMs = 25 } = {}) {
  return {
    async *stream({ messages, signal }) {
      const last = [...messages].reverse().find((m) => m.role === 'user');
      const said = last ? textOf(last) : '';
      const started = Date.now();
      yield { type: 'message-start', id: crypto.randomUUID(), role: 'assistant' };
      yield { type: 'part-start', index: 0, part: { type: 'reasoning', text: '' } };
      for (const word of `Reading the message and choosing a reply.`.split(/(\s+)/)) {
        if (signal.aborted) return;
        yield { type: 'part-delta', index: 0, delta: word };
        await sleep(delayMs, signal);
      }
      yield { type: 'part-end', index: 0, part: { type: 'reasoning', text: 'Reading the message and choosing a reply.', durationMs: Date.now() - started } };
      const call = { type: 'tool-call', toolCallId: crypto.randomUUID(), name: 'echo', args: { text: said }, status: 'running' };
      yield { type: 'part-start', index: 1, part: call };
      await sleep(delayMs * 8, signal);
      if (signal.aborted) return;
      yield { type: 'part-end', index: 1, part: { ...call, status: 'success' } };
      yield { type: 'part-start', index: 2, part: { type: 'text', text: '' } };
      const reply = `You said: **${said.replace(/\*/g, '')}**\n\nThis is the echo backend. Set \`AICL_BACKEND=anthropic\` or \`AICL_BACKEND=openai\` (see README.md) to talk to a model.`;
      for (const piece of reply.split(/(\s+)/)) {
        if (signal.aborted) return;
        yield { type: 'part-delta', index: 2, delta: piece };
        await sleep(delayMs, signal);
      }
      yield { type: 'message-end', finishReason: 'stop' };
    },
  };
}
