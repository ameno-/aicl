/**
 * Server-Sent Events transport.
 *
 * Reference implementation of `ChatTransport`. It is intentionally small: the
 * interface is the contract, and swapping this for WebSocket, plain JSON, or an
 * in-memory fake must require no change to the components.
 */

import type { ChatTransport, SendRequest, StreamEvent } from '../types.js';

export interface SseTransportOptions {
  url: string;
  headers?: Record<string, string>;
  credentials?: RequestCredentials;
  /**
   * Maps a raw SSE payload to a `StreamEvent`. Override to consume a backend
   * that already has its own wire format. Returning `null` skips the frame.
   */
  parse?: (data: string) => StreamEvent | null;
  fetch?: typeof globalThis.fetch;
}

const defaultParse = (data: string): StreamEvent | null => {
  if (data === '[DONE]') return null;
  try {
    return JSON.parse(data) as StreamEvent;
  } catch {
    return null;
  }
};

export function createSseTransport(options: SseTransportOptions): ChatTransport {
  const doFetch = options.fetch ?? globalThis.fetch;
  const parse = options.parse ?? defaultParse;

  return {
    async *send(req: SendRequest, signal: AbortSignal): AsyncIterable<StreamEvent> {
      const response = await doFetch(options.url, {
        method: 'POST',
        signal,
        credentials: options.credentials,
        headers: {
          'content-type': 'application/json',
          accept: 'text/event-stream',
          ...options.headers,
          ...req.headers,
        },
        body: JSON.stringify({ messages: req.messages, ...req.body }),
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        throw new Error(
          `Chat request failed: ${response.status} ${response.statusText}${
            detail ? ` - ${detail.slice(0, 200)}` : ''
          }`,
        );
      }
      if (!response.body) throw new Error('Chat response has no body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          // stream:true is required: a multi-byte character can be split across
          // chunk boundaries, and decoding without it corrupts non-ASCII text.
          buffer += decoder.decode(value, { stream: true });

          // SSE frames are separated by a blank line. Normalise CRLF first;
          // some proxies rewrite line endings.
          buffer = buffer.replace(/\r\n/g, '\n');
          let boundary = buffer.indexOf('\n\n');

          while (boundary !== -1) {
            const frame = buffer.slice(0, boundary);
            buffer = buffer.slice(boundary + 2);
            boundary = buffer.indexOf('\n\n');

            // A frame may carry several data: lines, which concatenate.
            const data = frame
              .split('\n')
              .filter((line) => line.startsWith('data:'))
              .map((line) => line.slice(5).trimStart())
              .join('\n');

            if (!data) continue;
            const event = parse(data);
            if (event) yield event;
          }
        }
      } finally {
        // Releasing the lock lets the connection be torn down promptly on abort
        // instead of lingering until GC.
        reader.releaseLock();
      }
    },
  };
}
