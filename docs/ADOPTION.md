# Adopting AICL

How to put AICL in front of your own backend: install it, stream from a server, render in
React, extend it with your own parts, and test it. Every code block here was typechecked against
the package sources and the server/client pair was run end to end. Where the library has a
sharp edge, this guide says so and gives the workaround.

For the design rationale read `docs/ARCHITECTURE.md` and `docs/DECISIONS.md`. For the wire
contract read `docs/api/README.md`.

## 0. What you get, and what you don't

| Package | Use it for | Runtime deps |
|---|---|---|
| `@aicl/core` | Message model, `ChatController` state machine, SSE transport, session and toast stores | none |
| `@aicl/server` | `createChatHandler`: turns an async iterable of `StreamEvent` into SSE frames | `@aicl/core` |
| `@aicl/react` | `useChat`, unstyled primitives (`Transcript`, `Composer`, part renderers, sessions, dialogs, toasts) | `@aicl/core`, `lucide-react`, `react-markdown`, `remark-gfm` |
| `@aicl/styles` | Optional CSS-variable theme for every `[data-aicl]` primitive | none (CSS) |
| `@aicl/fx` | Optional animated components (Tailwind v4 + motion + WebGPU ambience). Source only | see `packages/fx/README.md` |

Not provided: model-provider connectors, auth, persistence, Svelte or Vue adapters. The
`packages/svelte` and `packages/vue` directories are empty placeholders, and the
`@aicl/connect-*` packages named in `docs/api/README.md` are a design, not code.

## 1. Install

The packages are unpublished (`version: 0.0.0`). Consume them from a checkout:

```jsonc
// your app's package.json
"dependencies": {
  "@aicl/core":   "file:../aicl/packages/core",
  "@aicl/react":  "file:../aicl/packages/react",
  "@aicl/server": "file:../aicl/packages/server",
  "@aicl/styles": "file:../aicl/packages/styles"
}
```

Then build the library once, because `core`, `react` and `server` resolve to `dist/`, which is
git-ignored:

```bash
cd aicl && npm install && npm run build
```

Forget the build and you get `Cannot find module …/packages/server/dist/index.js` at runtime.
`@aicl/styles` and `@aicl/fx` ship source and need no build. If you bundle with Vite you can
alias the packages to their `src/` instead, as `apps/workspace/vite.config.ts` does, and skip the
build for browser code. Node code still needs `dist/`.

## 2. The contract in one screen

The UI consumes one ordered stream of events per assistant turn (`packages/core/src/types.ts`):

```
message-start { id, role: 'assistant' }   must come first
part-start    { index, part }             places a Part at index
part-delta    { index, delta }            appends text (text, reasoning) or argsText (tool-call)
part-end      { index, part? }            optionally replaces the part with its final form
message-end   { finishReason, usage? }
error         { error: { message, retryable? } }   terminal; stops the turn
```

`Part` is a discriminated union: `text`, `reasoning`, `tool-call`, `tool-result`, `file`,
`citation`, `artifact`, `error`, and `data-${string}` for your own types. Deltas address parts by
`index`, so you choose the indices and keep them stable for the turn.

## 3. Server: stream events

`createChatHandler(handler)` returns a framework-free function:

```ts
(body: unknown, headers?: Record<string, string>, signal?: AbortSignal, requestId?: string)
  => Promise<ChatResponse>      // ChatResponse.toSse(): AsyncIterable<Uint8Array>
```

It is **not** a `(Request) => Response` route handler. You mount it yourself. It validates
`body.messages` (400 when it is not an array), passes every other body key through as
`req.body`, and frames each event as `data: <json>\n\n`, ending with `data: [DONE]`.

### Fetch-style frameworks (Next.js route handlers, Hono, Bun, Deno, Workers)

```ts
import { ChatHandlerError, createChatHandler, type ChatHandlerRequest } from '@aicl/server';
import type { StreamEvent } from '@aicl/core';

async function* reply(req: ChatHandlerRequest): AsyncGenerator<StreamEvent> {
  yield { type: 'message-start', id: crypto.randomUUID(), role: 'assistant' };
  yield { type: 'part-start', index: 0, part: { type: 'text', text: '' } };
  for (const word of ['Hello', ' ', 'world']) {
    if (req.signal.aborted) return;
    yield { type: 'part-delta', index: 0, delta: word };
  }
  yield { type: 'part-end', index: 0 };
  yield { type: 'message-end', finishReason: 'stop' };
}

// Validate in a plain async function: it runs before the response starts, so
// a ChatHandlerError here becomes a real HTTP status.
const chat = createChatHandler(async (req) => {
  if (req.headers['authorization'] !== 'Bearer dev') throw new ChatHandlerError(401, 'unauthorized', false);
  return reply(req);
});

export async function POST(request: Request): Promise<Response> {
  let response;
  try {
    const headers = Object.fromEntries([...request.headers].map(([k, v]) => [k.toLowerCase(), v]));
    response = await chat(await request.json(), headers, request.signal);
  } catch (cause) {
    if (cause instanceof ChatHandlerError) {
      return Response.json({ message: cause.message, retryable: cause.retryable }, { status: cause.status });
    }
    return Response.json({ message: 'bad request' }, { status: 400 });
  }
  const frames = response.toSse()[Symbol.asyncIterator]();
  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { value, done } = await frames.next();
      if (done) controller.close();
      else controller.enqueue(value);
    },
    async cancel() {
      await frames.return?.();
    },
  });
  return new Response(body, { headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' } });
}
```

### Node `http`

`examples/server-node/src/server.ts` is the reference: read the JSON body, call the handler,
map `ChatHandlerError.status` to the HTTP status, then `res.write` each frame of `toSse()`.
`apps/workspace/server/main.ts` (`handleChat`) adds two things worth copying: it aborts the
handler's signal on `res.on('close')`, and it writes a `: ping\n\n` comment every 15 s so proxies
don't drop a stream that is idle while the model thinks.

### Server rules that bite

- **Throwing `ChatHandlerError` inside an `async function*` does not produce an HTTP status.** A
  generator body runs only when `toSse()` iterates it, after you have sent a 200, so the error
  escapes mid-stream. Do auth and validation in a plain `async` function that returns the
  generator, as above. `apps/workspace/server/main.ts` (`chat`) follows this pattern.
- Any other error thrown while streaming becomes an in-band `{ type: 'error', retryable: true }`
  frame followed by `[DONE]`. A `ChatHandlerError` thrown while streaming is re-thrown from
  `toSse()` instead, so wrap your write loop in `try/finally`.
- Honour `req.signal`. Without it, a client's Stop doesn't cancel the upstream model call.
- Tool calls are resolved on the server. Emit a `tool-call` part with `status: 'running'`,
  run the tool, emit `part-end` with the same part and `status: 'success' | 'error'`, then a
  `tool-result` part at a new index. See `docs/api/README.md#tool-execution`.
- Leave `toolCallId` unchanged between a call's `part-start` and `part-end`.
  `examples/server-node` changes it, and you shouldn't copy that.

## 4. Client: React

```tsx
import { createSseTransport } from '@aicl/core';
import { Composer, Transcript, createPartRegistry, useChat, type PartProps } from '@aicl/react';
import { markdownRenderers } from '@aicl/react/markdown';
import '@aicl/styles';

const transport = createSseTransport({ url: '/api/chat', headers: { authorization: 'Bearer dev' } });

function InvoiceCard({ part }: PartProps) {
  if (part.type !== 'data-invoice') return null;
  const data = part.data as { total: number };
  return <div data-aicl="part" data-part="data-invoice">Total: {data.total}</div>;
}

const registry = createPartRegistry({ ...markdownRenderers, 'data-invoice': InvoiceCard });

export function Chat() {
  const chat = useChat({ transport, body: { model: 'my-model' } });
  return (
    <div data-theme="light">
      <Transcript messages={chat.messages} status={chat.status} streamingId={chat.streamingId} registry={registry} />
      {chat.status === 'error' ? <p role="alert">{chat.error?.message}</p> : null}
      <Composer status={chat.status} onSubmit={(text) => void chat.send(text)} onStop={chat.stop} />
    </div>
  );
}
```

What the client sends: `POST url` with `{ messages: <active branch, oldest first>, ...body }`.
`body` and `headers` from `useChat` options are merged in on every request.

### Client rules that bite

- **`useChat(options)` reads its options once.** The controller is created on first render and
  never rebuilt, so a later change to `transport`, `body` or `headers` has no effect. For values
  that change per request (selected model, auth token), use a custom `fetch` in
  `createSseTransport` that reads current state and rewrites the body. `withCanvasContext` in
  `apps/workspace/web/chatStore.ts` does exactly this. Alternatively, remount with a `key`.
- **Pass `status`, not `isBusy`, to `<Composer>`.** `submitted` (request sent, nothing back
  yet) disables send but shows no Stop button. `streaming` shows Stop. `isBusy` is deprecated.
- **`<Composer onSubmit>` gets text only.** Staged attachments are yours: upload them, turn each
  `Attachment` into a part with `toFilePart(attachment, url)`, and call
  `chat.send(text, fileParts)`.
- **`<Transcript>` doesn't wire message actions.** It renders the default action buttons, but
  passes no `onAction`, so Retry and Edit do nothing. Copy and the thumbs work. For working
  actions, render `MessageItem` yourself:

  ```tsx
  {chat.messages.map((message) => (
    <MessageItem
      key={message.id}
      message={message}
      isStreaming={message.id === chat.streamingId}
      registry={registry}
      onAction={(action, m) => {
        if (action === 'retry') void chat.regenerate();
        if (action === 'edit') {
          const text = m.parts.find((p) => p.type === 'text');
          if (text?.type === 'text') void chat.edit(m.id, text.text);
        }
      }}
    />
  ))}
  ```

  You then own the `role="log" aria-live="polite"` container and stick-to-bottom.
- **There is no `retry()`.** `regenerate()` only re-runs when the last message is an assistant
  message. If the request failed before `message-start` (network error, 401, 500), the last
  message is the user's, so `regenerate()` does nothing. Retry by forking that user message:

  ```ts
  const last = chat.messages[chat.messages.length - 1];
  if (last?.role === 'assistant') void chat.regenerate();
  else if (last) {
    const text = last.parts.find((p) => p.type === 'text');
    if (text?.type === 'text') void chat.edit(last.id, text.text);
  }
  ```
- **A non-2xx response always becomes `error.retryable: true`**, and the message is
  `Chat request failed: <status> <statusText> - <first 200 chars of body>`. The transport throws,
  and the controller doesn't read the server's `retryable` flag. Read the status from the
  message if you need to tell a 401 from a 503.
- `ChatController` exposes `messages` and `status` as getters. The error, `streamingId` and
  the branch tree live on `controller.state.get()`. `useChat` flattens them for you.
- Send is idempotent while busy: `send`, `edit` and `regenerate` return without doing anything
  in `submitted` and `streaming`. They don't queue.
- `stop()` keeps the partial message, sets `aborted: true` on it, and turns in-flight tool calls
  into `cancelled`, not `error`.

## 5. Custom parts and the registry

- Name custom parts `data-<something>` and give them a `data` payload. The core union stays
  closed, so they never collide with future built-ins.
- **In React, register each custom type by its exact name.** `createRendererRegistry` supports a
  `'data-'` wildcard and a fallback renderer, but `<PartRenderer>` checks `registry.has(type)`,
  which matches exact names only. A wildcard-only or fallback-only registration falls through to
  the built-in `UnknownPart`. Exact names work.
- Write renderers as `(props: PartProps) => …` and narrow on `props.part.type` inside, as
  `InvoiceCard` does above. A renderer typed `PartProps<TextPart>` won't fit the registry type
  without a cast. That's why `createPartRegistry({ text: MarkdownTextPart })` doesn't compile
  and `createPartRegistry({ ...markdownRenderers })` does.
- Built-in parts render even without a registry: the default registry in
  `packages/react/src/parts.tsx` covers every core type plus `data-suggested-followups`. Your
  registry only overrides the types it names.
- The default `tool-result` renderer shows only "Result" or "Error", not the payload. Register
  your own `tool-result` renderer if users should see results.

## 6. Styling

Primitives ship no CSS. They expose stable attributes, for example `data-aicl="message"`,
`data-role`, `data-state="streaming|complete|aborted"`, `data-part`, and `data-status` on tool
calls. Style those with anything. To use the default theme, `import '@aicl/styles'` once and set
`data-theme="light" | "dark"` on a container. Without it the theme follows
`prefers-color-scheme`. The tokens are listed in `packages/styles/README.md`.

## 7. Testing without a backend

`ChatTransport` is one method, so a fake is a few lines and needs no DOM:

```ts
import type { ChatTransport } from '@aicl/core';

export function fakeTransport(): ChatTransport {
  return {
    async *send(_req, signal) {
      if (signal.aborted) return;
      yield { type: 'message-start', id: 'a1', role: 'assistant' };
      yield { type: 'part-start', index: 0, part: { type: 'text', text: 'hi' } };
      yield { type: 'message-end', finishReason: 'stop' };
    },
  };
}
```

Drive a `ChatController` with it under `node --test` (pattern: `packages/core/src/chat.test.ts`).
Remember the `batched` store: `controller.state` subscribers are notified on a microtask, so
`await` before you assert on a subscription. `controller.messages` and `controller.status` are
synchronous. For scripted UI states (submitted, streaming, tool running, tool error, stopped,
error), `examples/slice-1/App.tsx` builds transports that pause and hold the stream open.

## 8. Checklist for an agent wiring AICL into an app

1. `npm run build` in the AICL checkout. The app resolves `dist/`.
2. The server handler validates in an `async` wrapper and streams from a generator.
3. The server honours `req.signal`, sends keep-alives on long thinks, and keeps `toolCallId`
   stable.
4. The client passes `status` to `Composer`, and per-request values go through a custom `fetch`.
5. Custom parts are registered by exact `data-*` name.
6. Retry handles the "failed before `message-start`" case with `edit`.
7. Message actions are wired by rendering `MessageItem` with `onAction`, if users need Retry
   and Edit.
