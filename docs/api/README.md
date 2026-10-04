# AICL API style

A library like AICL is only as good as the API a backend speaks into it. This
document defines the wire and handler contract that connects an AI model to
`@aicl/core`'s component surface, and the conventions that keep that contract
honest across providers.

## The premise

The chat UI consumes a single sequence of `StreamEvent` values:

```
message-start
part-start { index, part }
part-delta { index, delta }
…
message-end { finishReason, usage? }
error { message, retryable? }
```

`Part` is a discriminated union, not a string. Reasoning, tool calls, tool
results, files, citations, artifacts, errors, and a `data-${string}` extension
point all live there. Every event the UI ever renders is one of those.

A backend that yields this sequence can drive any AICL adapter. A backend
that does not is rewritten, not adapted — adapters around a custom wire are
the failure mode that produced the existing landscape.

## Wire shape

### Request

```http
POST /chat
Authorization: Bearer <token>
Content-Type: application/json

{
  "messages": [
    { "id": "...", "role": "user", "parts": [...] }
  ],
  "model": "claude-sonnet-4",
  "temperature": 0.7,
  "metadata": { "mode": "research" }
}
```

`messages` carries the active branch, oldest first. `model`, `temperature`,
`metadata`, and any other keys are opaque to the library — they are forwarded
verbatim. The library is the wrong place to model providers.

### Response

A 200 response streams newline-delimited JSON, one `StreamEvent` per line.
The reference adapter uses Server-Sent Events with the SSE framing; a plain
JSON-line stream is also valid.

Non-2xx responses carry the same wire shape as the stream event `{ type:
"error"; error: { message; retryable? } }`, surfaced as a `ChatStatus: 'error'`
in the controller.

## The handler contract

For backends that prefer to compose the stream rather than serialize SSE,
`@aicl/server` exposes `createChatHandler`:

```ts
import { createChatHandler } from '@aicl/server';

export const POST = createChatHandler(async function* (req) {
  const { messages, body, signal } = req;
  const model = (body.model as string) ?? 'claude-sonnet-4';

  yield { type: 'message-start', id: crypto.randomUUID(), role: 'assistant' };
  yield { type: 'part-start', index: 0, part: { type: 'reasoning', text: 'Reading.' } };

  // Stream text deltas as the model produces them.
  for await (const delta of streamModel({ model, messages, signal })) {
    yield { type: 'part-start', index: 1, part: { type: 'text', text: '' } };
    yield { type: 'part-delta', index: 1, delta };
  }

  yield { type: 'message-end', finishReason: 'stop', usage: await usage() };
});
```

The handler receives the parsed request and an `AbortSignal`. It yields
`StreamEvent` values. Anything in `body` that isn't `messages` is opaque —
the handler decides what to do with `model`, `temperature`, and the rest.

A handler is a `ChatHandler`:

```ts
export interface ChatHandler {
  (req: ChatHandlerRequest): AsyncIterable<StreamEvent> | Promise<AsyncIterable<StreamEvent>>;
}

export interface ChatHandlerRequest {
  messages: Message[];                  // active branch, oldest first
  body: Record<string, unknown>;        // opaque backend params
  headers: Record<string, string>;       // request headers (Authorization, etc.)
  signal: AbortSignal;                   // abort when the consumer stops or navigates
  requestId: string;                     // server-issued id for tracing
}
```

`createChatHandler` turns a `ChatHandler` into a request handler that any HTTP
framework can mount. It owns the SSE framing, the JSON serialization, and the
401/400 status codes. The handler itself stays framework-free.

## Tool execution

Tools are resolved server-side (ADR-T1). The handler yields a tool call as
`{ type: 'part-start', index: N, part: { type: 'tool-call', toolCallId, name,
args, status: 'running' } }`, runs the tool, and yields a tool result:

```ts
yield { type: 'part-start', index: 1, part: { type: 'tool-call', toolCallId, name, args, status: 'running' } };
const result = await runTool(name, args, signal);
yield {
  type: 'part-end',
  index: 1,
  part: { type: 'tool-call', toolCallId, name, args, status: 'success' },
};
yield { type: 'part-start', index: 2, part: { type: 'tool-result', toolCallId, result } };
```

The UI never sees the tool's runtime. It renders a disclosure that opens on
error, a result body, and that's it. Approval is the host's responsibility.

## Connectors

A connector is a function from "what a provider gives us" to "what the
handler yields". Connectors live in their own packages so a backend can pick
exactly one:

```
@aicl/connect-anthropic   — turns Messages API streams into StreamEvents
@aicl/connect-openai      — same for Chat Completions
@aicl/connect-google      — same for Gemini
@aicl/connect-bedrock     — same for AWS
```

A connector never owns the request. It exposes an async generator that the
handler consumes:

```ts
import { createChatHandler } from '@aicl/server';
import { fromAnthropic } from '@aicl/connect-anthropic';

export const POST = createChatHandler(async function* (req) {
  for await (const event of fromAnthropic({
    model: req.body.model as string,
    messages: toAnthropic(req.messages),
    signal: req.signal,
  })) {
    yield event;
  }
});
```

A connector is responsible for:

1. Translating `Message` → provider input.
2. Yielding the canonical `StreamEvent` sequence, never a provider type.
3. Surfacing provider errors as `{ type: 'error'; error: { message, retryable } }`.
4. Honouring `signal` for cooperative abort.

A connector is **not** responsible for:

1. Auth. The handler is constructed by the application, which holds secrets.
2. Routing. The application picks the provider by picking the connector.
3. UI. Connectors yield events; the UI is in `@aicl/react` / `@aicl/svelte` / `@aicl/vue`.

## Auth

The handler is constructed in the application layer with whatever auth the
consumer wants. The canonical pattern is a bearer token, but cookies, mTLS,
and signed requests are equally valid. The library does not read or write
secrets (ADR-T2).

```ts
const handler = createChatHandler(async function* (req) {
  if (!isAuthorized(req.headers.authorization)) {
    throw new ChatHandlerError(401, 'unauthorized', false);
  }
  // ...
});
```

`@aicl/server` exports `ChatHandlerError` so a handler can declare a status
code without depending on a specific framework.

## Idempotency

Handlers should be safe to call twice with the same `requestId`. The library
never sends twice for the same user action — `ChatController.send()` rejects
while busy (ADR-T5) — but consumers retry on transport failure, and the
handler is the right place to dedupe.

## Conventions

| Convention | Why |
|---|---|
| `message-start` is the first event | The UI needs an assistant id before any part lands |
| `part-delta` appends by index, not by part id | Parts come and go via typed arrays; an indexed protocol survives reordering |
| Errors yield `{ type: 'error' }` rather than throw | Stream errors are recoverable UI states, not crashes |
| `signal` must be honoured | Without it, abort doesn't free the upstream request |
| Connectors yield the canonical sequence, never a provider type | A connector that leaks provider types forces the UI to know about every provider |

## Why this style

The corpus shows what happens when the chat wire is bespoke: four products
with four different stream protocols, four different ways to signal a tool
call, four different ways to fail. The library's job is to give every consumer
one wire that holds across providers. Connectors do the translation.
