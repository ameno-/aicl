// OpenAI-compatible Chat Completions (OpenAI, LiteLLM, OpenRouter, Ollama, vLLM…) → AICL stream events.
//
//   OPENAI_API_KEY      required by most providers (Ollama accepts any value)
//   OPENAI_BASE_URL     optional, e.g. http://localhost:11434/v1 for Ollama
//   OPENAI_MODEL        required: the model id your endpoint serves
//   AICL_SYSTEM_PROMPT  optional system prompt
//
// `reasoning_content` deltas (DeepSeek, vLLM, LiteLLM) render as a reasoning
// block. Requires `npm install openai`.

import { partIndexer, toTurns } from '../backend.js';

const FINISH = { stop: 'stop', length: 'length', tool_calls: 'tool-calls', function_call: 'tool-calls', content_filter: 'content-filter' };

/** @returns {import('../backend.js').ChatBackend} */
export function createOpenAIBackend(env = process.env, options = {}) {
  const model = env.OPENAI_MODEL;
  // `options.client` injects an SDK client (tests, custom auth); otherwise one is built from the environment.
  let client = options.client;

  return {
    async *stream({ messages, signal }) {
      if (!model) throw new Error('Set OPENAI_MODEL to the model id your endpoint serves.');
      if (!client) {
        const { default: OpenAI } = await import('openai');
        client = new OpenAI({ apiKey: env.OPENAI_API_KEY || 'unset' });
      }
      const { system, turns } = toTurns(messages);
      const prompt = [env.AICL_SYSTEM_PROMPT, system].filter(Boolean).join('\n\n');
      const stream = await client.chat.completions.create(
        {
          model,
          stream: true,
          stream_options: { include_usage: true },
          messages: [...(prompt ? [{ role: 'system', content: prompt }] : []), ...turns],
        },
        { signal },
      );

      const index = partIndexer();
      const tools = new Map(); // tool call index → { part, json }
      let reasoning = false;
      let hasText = false;
      let started = false;
      let finish = 'stop';
      let usage;

      for await (const chunk of stream) {
        if (!started) {
          started = true;
          yield { type: 'message-start', id: chunk.id || crypto.randomUUID(), role: 'assistant' };
        }
        if (chunk.usage) usage = { inputTokens: chunk.usage.prompt_tokens, outputTokens: chunk.usage.completion_tokens };
        const choice = chunk.choices?.[0];
        if (!choice) continue;
        const delta = choice.delta ?? {};
        const thought = delta.reasoning_content ?? delta.reasoning;
        if (typeof thought === 'string' && thought) {
          if (!reasoning) {
            reasoning = true;
            yield { type: 'part-start', index: index('reasoning'), part: { type: 'reasoning', text: '' } };
          }
          yield { type: 'part-delta', index: index('reasoning'), delta: thought };
        }
        if (typeof delta.content === 'string' && delta.content) {
          if (!hasText) {
            hasText = true;
            yield { type: 'part-start', index: index('text'), part: { type: 'text', text: '' } };
          }
          yield { type: 'part-delta', index: index('text'), delta: delta.content };
        }
        for (const call of delta.tool_calls ?? []) {
          let entry = tools.get(call.index);
          if (!entry) {
            entry = { part: { type: 'tool-call', toolCallId: call.id || crypto.randomUUID(), name: call.function?.name || 'tool', args: {}, status: 'running' }, json: '' };
            tools.set(call.index, entry);
            yield { type: 'part-start', index: index(`tool:${call.index}`), part: entry.part };
          }
          const args = call.function?.arguments;
          if (args) {
            entry.json += args;
            yield { type: 'part-delta', index: index(`tool:${call.index}`), delta: args };
          }
        }
        if (choice.finish_reason) finish = choice.finish_reason;
      }
      if (!started) yield { type: 'message-start', id: crypto.randomUUID(), role: 'assistant' };
      for (const [i, entry] of tools) {
        let args = {};
        try {
          args = entry.json ? JSON.parse(entry.json) : {};
        } catch {}
        yield { type: 'part-end', index: index(`tool:${i}`), part: { ...entry.part, args, status: 'success' } };
      }
      yield { type: 'message-end', finishReason: FINISH[finish] ?? 'stop', ...(usage ? { usage } : {}) };
    },
  };
}
