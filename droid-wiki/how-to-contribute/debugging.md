# Debugging

## Logs

- The engine in `packages/core/src/chat.ts` writes nothing. To trace a stream, log inside your `ChatTransport` adapter or pass a logger into `createSseTransport` from `packages/core/src/transports/sse.ts`.
- The handler in `packages/server/src/handler.ts` emits nothing to stdout by default. Errors thrown out of a `ChatHandler` are surfaced as `ChatHandlerError` with a `status` and a `retryable` flag; any other thrown error becomes a wire-level `{ type: 'error', error }` `StreamEvent` frame.
- The workspace server in `apps/workspace/server/main.ts` logs the listening URL on startup and stderr on uncaught errors. The keep-alive comment frame fires every 15 seconds so proxies don't time the stream out.

## Common errors

| Symptom | Likely cause | Where to look |
| --- | --- | --- |
| `Chat request failed: 400 ...` on the wire | Handler rejected the body; the most common message is `messages must be an array` | `packages/server/src/handler.ts` (`parseMessages`) |
| `ChatHandlerError 409 'agent is still working'` | Workspace agent still streaming; submit was rejected by `ChatController` | `apps/workspace/server/main.ts` |
| Send button double-fires | Status collapsed `submitted` into `streaming`; the `BUSY` set no longer rejects the second click | `packages/core/src/chat.ts` (`BUSY` constant) |
| Stop button leaves a half-written message visible forever | Stream completion path didn't run `cancelInFlightTools` on `aborted` parts | `packages/core/src/chat.ts` (`stop`) |
| Tool args show as raw text | `argsText` was never promoted to `args` on `part-end`; check the connector, not the renderer | `packages/core/src/types.ts` (`ToolCallPart`) |
| Sidebar/chat theme wrong | `data-theme` not set on a container above the chat; system preference wins by default | `packages/styles/src/tokens.css` |
| Composer submits mid-word in IME composition | `composingRef` or `nativeEvent.isComposing` not consulted before treating `Enter` as submit | `packages/react/src/Composer.tsx` (`handleKeyDown`) |

## Reproducing

- **Core.** Write a `node --test` script that constructs a `ChatController` with an in-memory transport. The pattern is in `packages/core/src/chat.test.ts`.
- **React adapter.** Use the slice-1 gallery (`examples/slice-1/`) and append `?view=scenarios` to load `examples/slice-1/App.tsx`.
- **Server.** Hit `examples/server-node` with `curl -N http://127.0.0.1:<port>/chat` after wiring a handler in `examples/server-node/src/server.ts`.
- **Workspace.** Set `AICL_PORT=5180` and `AICL_WEB_PORT=5181`, then run `apps/workspace/scripts/dev.mjs` and watch stdout for the listen line and the keep-alive comment frames.

## Streaming-state sanity check

The conversation state machine in `packages/core/src/types.ts` is `idle`, `submitted`, `streaming`, `aborted`, `error`. A stuck UI usually traces back to one of three transitions:

1. `submitted → idle` without ever reaching `streaming`. The transport never produced a `message-start` event; check the wire and the backend.
2. `streaming → error` on a user-initiated stop. The catch in `packages/core/src/chat.ts` (`run`) overwrote the abort; the user abort and the transport failure must remain distinguishable.
3. `streaming → idle` while parts are still arriving. The reducer in `packages/core/src/chat.ts` saw a `message-end` it should have ignored; check the backend's framing.
