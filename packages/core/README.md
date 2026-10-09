# `@aicl/core`

The framework-agnostic conversation engine: the message model, the streaming state machine,
the transport interface and an SSE transport, plus small stores for sessions and toasts.
It has no DOM access, no framework imports and no dependencies, and it runs in plain Node.

Wiring it end to end with a server and React: `docs/ADOPTION.md`.

## Exports (`src/index.ts`)

| Export | File | What it is |
|---|---|---|
| `Message`, `Part` and the part interfaces, `StreamEvent`, `ChatTransport`, `ChatState`, `ChatStatus`, `Attachment`, `Mention`, `toFilePart` | `src/types.ts` | The data model. Read this file first. |
| `ChatController`, `ChatOptions` | `src/chat.ts` | Status transitions, stream reduction, branching, abort |
| `createSseTransport` | `src/transports/sse.ts` | `ChatTransport` over `fetch` + SSE. `parse` adapts a foreign wire format, and `fetch` lets you rewrite requests |
| `createRendererRegistry` | `src/registry.ts` | Part type → renderer map with a `data-` wildcard and a fallback. Adapters wrap it. |
| `createStore`, `batched`, `derived` | `src/store.ts` | The ~60-line observable every adapter binds to |
| `createSessionStore`, `bucketByRecency`, `SessionMeta` | `src/session.ts` | Session-list state, kept separate from the transcript (D11) |
| `createToastQueue` | `src/toast.ts` | Toast queue with injectable clock |
| `createComboboxModel` | `src/combobox.ts` | `@internal`. The listbox model behind the React menus (D12) |

## `ChatController` in brief

```ts
const chat = new ChatController({ transport, body: { model: 'x' } });
await chat.send('hello');           // resolves when the turn ends (idle, error or aborted)
chat.messages;                      // active branch, oldest first
chat.status;                        // 'idle' | 'submitted' | 'streaming' | 'aborted' | 'error'
chat.state.get().error;             // { message, retryable? } after a failure
chat.stop();                        // keeps partial output; running tools → 'cancelled'
await chat.regenerate();            // only when the last message is an assistant message
await chat.edit(userMessageId, t);  // forks a sibling branch; the original stays in the tree
chat.selectBranch(messageId);       // switch branches; path extends along first children
```

Behaviour to rely on:

- `send`, `edit` and `regenerate` return without doing anything in `submitted` and `streaming`.
  They don't queue.
- An `error` event is terminal: the reducer stops reading the stream.
- A transport that throws becomes `status: 'error'` with `retryable: true`. A user's `stop()`
  is never overwritten by that error.
- `controller.state` is a **batched** store: subscribers fire once per microtask, however many
  events arrived. `messages` and `status` read the unbatched value synchronously.
- State is a normalised `nodes` map plus a `path` of ids. Only the message being streamed gets
  a new object identity, so adapters can memoise per message.

## Invariants (do not break)

- No `document`, `window` or framework import anywhere under `src/`. This is enforced by
  review only, since there is no CI.
- New `Part` variants are a breaking change for every renderer. Prefer `data-*` parts. Changing
  the union needs a `docs/DECISIONS.md` entry.
- Every public export needs a test in `src/*.test.ts`.

## Develop

```bash
npm run build      # tsc → dist/ (consumers resolve dist/; it is git-ignored)
npm run typecheck
npm test           # compiles to dist-test/, then node --test on chat and services tests
```

A new test file must be added to the `test` script in `package.json`, which lists files
explicitly.
