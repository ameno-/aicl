// Anthropic Messages API (and compatible gateways) → AICL stream events.
//
//   ANTHROPIC_API_KEY      required (or any credential the SDK resolves)
//   ANTHROPIC_BASE_URL     optional: a compatible gateway or proxy
//   ANTHROPIC_MODEL        default claude-opus-5-5
//   ANTHROPIC_THINKING     'summarized' (default): stream reasoning summaries; 'off': send no thinking config
//   ANTHROPIC_FALLBACKS    'default' (default): on a safety refusal the API re-runs the request on a
//                          fallback model server-side; 'off' for gateways that reject the beta
//   AICL_SYSTEM_PROMPT     optional system prompt
//
// Requires `npm install @anthropic-ai/sdk`.

import { partIndexer, toTurns } from '../backend.js';

const FINISH = { end_turn: 'stop', stop_sequence: 'stop', max_tokens: 'length', tool_use: 'tool-calls', refusal: 'content-filter', pause_turn: 'stop' };

/** @returns {import('../backend.js').ChatBackend} */
export function createAnthropicBackend(env = process.env, options = {}) {
  const model = env.ANTHROPIC_MODEL || 'claude-opus-5-5';
  const thinking = (env.ANTHROPIC_THINKING || 'summarized') !== 'off';
  const fallbacks = (env.ANTHROPIC_FALLBACKS || 'default') !== 'off';
  // `options.client` injects an SDK client (tests, custom auth); otherwise one is built from the environment.
  let client = options.client;

  return {
    async *stream({ messages, signal }) {
      if (!client) {
        const { default: Anthropic } = await import('@anthropic-ai/sdk');
        client = new Anthropic();
      }
      const { system, turns } = toTurns(messages);
      while (turns.length && turns[0].role !== 'user') turns.shift(); // the first turn must be the user's
      const params = {
        model,
        max_tokens: 64000,
        messages: turns,
        ...(system || env.AICL_SYSTEM_PROMPT ? { system: [env.AICL_SYSTEM_PROMPT, system].filter(Boolean).join('\n\n') } : {}),
        ...(thinking ? { thinking: { type: 'adaptive', display: 'summarized' } } : {}),
        ...(fallbacks ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' } : {}),
      };
      const stream = fallbacks ? client.beta.messages.stream(params, { signal }) : client.messages.stream(params, { signal });

      const index = partIndexer();
      const blocks = new Map(); // anthropic block index → { part, started, json }
      let stopReason = 'end_turn';
      const usage = {};

      for await (const event of stream) {
        switch (event.type) {
          case 'message_start':
            if (event.message.usage?.input_tokens !== undefined) usage.inputTokens = event.message.usage.input_tokens;
            yield { type: 'message-start', id: event.message.id, role: 'assistant' };
            break;
          case 'content_block_start': {
            const block = event.content_block;
            let part;
            if (block.type === 'text') part = { type: 'text', text: block.text ?? '' };
            else if (block.type === 'thinking') part = { type: 'reasoning', text: block.thinking ?? '' };
            else if (block.type === 'tool_use' || block.type === 'server_tool_use') part = { type: 'tool-call', toolCallId: block.id, name: block.name, args: {}, status: 'running' };
            else break; // fallback markers, redacted thinking, server tool results: not shown
            blocks.set(event.index, { part, started: Date.now(), json: '' });
            yield { type: 'part-start', index: index(event.index), part };
            break;
          }
          case 'content_block_delta': {
            const entry = blocks.get(event.index);
            if (!entry) break;
            const d = event.delta;
            const delta = d.type === 'text_delta' ? d.text : d.type === 'thinking_delta' ? d.thinking : d.type === 'input_json_delta' ? d.partial_json : undefined;
            if (!delta) break;
            if (d.type === 'input_json_delta') entry.json += delta;
            yield { type: 'part-delta', index: index(event.index), delta };
            break;
          }
          case 'content_block_stop': {
            const entry = blocks.get(event.index);
            if (!entry) break;
            if (entry.part.type === 'tool-call') {
              let args = {};
              try {
                args = entry.json ? JSON.parse(entry.json) : {};
              } catch {}
              yield { type: 'part-end', index: index(event.index), part: { ...entry.part, args, status: 'success' } };
            } else if (entry.part.type === 'reasoning') {
              yield { type: 'part-end', index: index(event.index) };
            }
            break;
          }
          case 'message_delta':
            if (event.delta?.stop_reason) stopReason = event.delta.stop_reason;
            if (event.usage?.output_tokens !== undefined) usage.outputTokens = event.usage.output_tokens;
            break;
        }
      }
      if (stopReason === 'refusal') {
        yield { type: 'part-start', index: index('refusal'), part: { type: 'error', message: 'The model declined this request.', retryable: false } };
      }
      yield { type: 'message-end', finishReason: FINISH[stopReason] ?? 'stop', usage };
    },
  };
}
