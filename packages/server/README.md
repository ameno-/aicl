# `@aicl/server`

Framework-free server helpers. A handler is an async iterable of `@aicl/core` `StreamEvent`
values. `createChatHandler` validates the request and turns the events into SSE frames.
Mounting the result in an HTTP framework is up to you.

Full examples (fetch-style `Request`/`Response` and Node `http`): `docs/ADOPTION.md#3-server-stream-events`.
Wire contract and conventions: `docs/api/README.md`.

## API (`src/handler.ts`)

```ts
const chat = createChatHandler(handler);
const response = await chat(body, headers?, signal?, requestId?);   // ChatResponse
for await (const bytes of response.toSse()) write(bytes);          // 'data: {...}\n\n' … 'data: [DONE]\n\n'
```

| Symbol | Notes |
|---|---|
| `ChatHandler` | `(req: ChatHandlerRequest) => AsyncIterable<StreamEvent> \| Promise<AsyncIterable<StreamEvent>>` |
| `ChatHandlerRequest` | `{ messages, body, headers, signal, requestId }`. `body` is the request body without `messages` |
| `ChatHandlerError(status, message, retryable = true)` | Throw it to choose the HTTP status. You map `.status` to your framework's response |
| `ChatResponse.toSse()` | Stops when `signal` aborts. Ends with `[DONE]` |

## Error behaviour (verified)

| What happens | Result |
|---|---|
| `body` is not an object | `chat()` rejects with `ChatHandlerError(400)` |
| `body.messages` is not an array | `chat()` rejects with `ChatHandlerError(400)` |
| A plain `async` handler throws `ChatHandlerError` before returning | `chat()` rejects with it, so you can send a real status |
| A plain `async` handler throws another error | `chat()` rejects with `ChatHandlerError(500, message, true)` |
| An `async function*` handler throws `ChatHandlerError` | `chat()` resolves. `toSse()` re-throws it mid-stream, after you have sent a 200 |
| Any other error while streaming | An in-band `{ type: 'error', error: { message, retryable: true } }` frame, then `[DONE]` |

So: **validate and authorise in a plain `async` function that returns your generator**, never
inside the generator.

`messages` are not schema-checked beyond `Array.isArray`. Validate parts yourself if you
accept untrusted input.

## Develop

```bash
npm run build && npm test   # tests: src/handler.test.ts
```
