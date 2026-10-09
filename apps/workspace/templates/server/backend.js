// The one interface your backend implements.
//
//   /** @type {ChatBackend} */
//   const backend = {
//     async *stream({ messages, body, signal }) {
//       yield { type: 'message-start', id: crypto.randomUUID(), role: 'assistant' };
//       yield { type: 'part-start', index: 0, part: { type: 'text', text: '' } };
//       yield { type: 'part-delta', index: 0, delta: 'Hello' };
//       yield { type: 'message-end', finishReason: 'stop' };
//     },
//   };
//
// `messages` is the conversation (AICL shape: { id, role, parts[] }), oldest
// first. `body` holds any extra fields the client sent. Honour `signal`: it
// aborts when the user presses Stop or closes the page.
//
// Events (the AICL wire, one JSON object per SSE frame):
//   message-start { id, role: 'assistant' }   first, once
//   part-start    { index, part }             part: text | reasoning | tool-call | tool-result | artifact | error
//   part-delta    { index, delta }            appends to text/reasoning, or to a tool call's argsText
//   part-end      { index, part? }            optional final form of the part
//   message-end   { finishReason, usage? }    'stop' | 'length' | 'tool-calls' | 'content-filter' | 'error'
//   error         { error: { message, retryable? } }
//
// Ready-made backends: ./backends/anthropic.js, ./backends/openai.js, ./backends/echo.js.

/**
 * @typedef {{ id: string; role: 'user' | 'assistant' | 'system'; parts: Array<{ type: string; text?: string }> }} Message
 * @typedef {{ type: string; [key: string]: unknown }} StreamEvent
 * @typedef {{ stream(input: { messages: Message[]; body: Record<string, unknown>; signal: AbortSignal }): AsyncIterable<StreamEvent> }} ChatBackend
 */

/** Text of a message, joined across its text parts. */
export const textOf = (message) =>
  (message.parts ?? [])
    .filter((p) => p && p.type === 'text' && typeof p.text === 'string')
    .map((p) => p.text)
    .join('\n');

/** user/assistant turns with text, oldest first; system messages are returned separately. */
export function toTurns(messages) {
  const system = [];
  const turns = [];
  for (const m of messages ?? []) {
    const text = textOf(m).trim();
    if (!text) continue;
    if (m.role === 'system') system.push(text);
    else if (m.role === 'user' || m.role === 'assistant') turns.push({ role: m.role, content: text });
  }
  return { system: system.join('\n\n'), turns };
}

/** Assigns stable AICL part indices to a provider's content blocks or channels. */
export function partIndexer() {
  const map = new Map();
  return (key) => {
    if (!map.has(key)) map.set(key, map.size);
    return map.get(key);
  };
}
