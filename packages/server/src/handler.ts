import type { Message, StreamEvent } from '@aicl/core';

export interface ChatHandlerRequest {
  messages: Message[];
  body: Record<string, unknown>;
  headers: Record<string, string>;
  signal: AbortSignal;
  requestId: string;
}

export type ChatHandlerResult = AsyncIterable<StreamEvent> | Promise<AsyncIterable<StreamEvent>>;

export interface ChatHandler {
  (req: ChatHandlerRequest): ChatHandlerResult;
}

export class ChatHandlerError extends Error {
  readonly status: number;
  readonly retryable: boolean;
  constructor(status: number, message: string, retryable = true) {
    super(message);
    this.status = status;
    this.retryable = retryable;
    this.name = 'ChatHandlerError';
  }
}

/**
 * Wraps a `ChatHandler` in a streaming framework handler.
 *
 * The wrapped handler:
 *   - Reads a JSON body of the form `{ messages, ...body }`.
 *   - Reads request headers.
 *   - Owns the SSE framing, JSON serialization, and a `RequestAbortController`.
 *   - Returns 401 for a `ChatHandlerError` with status 401, 400 for 400.
 *   - Streams `StreamEvent` values as `data:` lines, terminated by `[DONE]`.
 *
 * The wrapped handler is returned as a function so any framework can mount it:
 *   const handler = createChatHandler(myHandler);
 *   await handler(request);  // framework-agnostic core
 *
 * The wrapper does not own the HTTP response — it returns a `ChatResponse`
 * the caller serializes into the framework's response object.
 */
export function createChatHandler(handler: ChatHandler) {
  return async function chatResponse(
    body: unknown,
    headers: Record<string, string> = {},
    signal: AbortSignal = new AbortController().signal,
    requestId = randomUUID(),
  ): Promise<ChatResponse> {
    if (!body || typeof body !== 'object') {
      throw new ChatHandlerError(400, 'malformed request body');
    }
    const obj = body as { messages?: unknown };
    const messages = parseMessages(obj.messages);
    const opaque = stripMessages(obj);
    try {
      const events = await handler({ messages, body: opaque, headers, signal, requestId });
      return new ChatResponse(events, signal);
    } catch (cause) {
      if (cause instanceof ChatHandlerError) throw cause;
      const error = cause instanceof Error ? cause : new Error(String(cause));
      throw new ChatHandlerError(500, error.message, true);
    }
  };
}

export class ChatResponse {
  readonly events: AsyncIterable<StreamEvent>;
  private readonly signal: AbortSignal;

  constructor(events: AsyncIterable<StreamEvent>, signal: AbortSignal) {
    this.events = events;
    this.signal = signal;
  }

  /** Serialises the response as Server-Sent Events text/event-stream. */
  async *toSse(): AsyncIterable<Uint8Array> {
    const encoder = new TextEncoder();
    const writeEvent = (event: StreamEvent): Uint8Array =>
      encoder.encode(`data: ${JSON.stringify(event)}\n\n`);

    try {
      for await (const event of this.events) {
        if (this.signal.aborted) break;
        yield writeEvent(event);
      }
    } catch (cause) {
      // A ChatHandlerError escapes the SSE stream so the framework caller can
      // map its `status` to an HTTP code. Other errors become wire-level
      // StreamEvent-error frames so the client can render them.
      if (cause instanceof ChatHandlerError) throw cause;
      const error = cause instanceof Error ? cause : new Error(String(cause));
      yield writeEvent({ type: 'error', error: { message: error.message, retryable: true } });
    }
    yield encoder.encode('data: [DONE]\n\n');
  }
}

function parseMessages(value: unknown): Message[] {
  if (!Array.isArray(value)) {
    throw new ChatHandlerError(400, 'messages must be an array');
  }
  return value as Message[];
}

function stripMessages(obj: Record<string, unknown>): Record<string, unknown> {
  const { messages: _ignored, ...rest } = obj;
  return rest;
}

function randomUUID(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
