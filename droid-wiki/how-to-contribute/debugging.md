# Debugging

## Logs

- `@aicl/core` and `@aicl/server` log nothing. To trace a stream, wrap the transport: pass a custom `fetch` to `createSseTransport` (which sees each request), or a custom `parse` (which sees each frame).
- The workspace server logs its listen line (workspace, model, web root) and `[aicl]`-prefixed errors. Unhandled rejections are logged instead of crashing the process.
- `logs/` directories in the tree come from local Claude Code hooks. They are git-ignored and are not app logs.

## Common errors

| Symptom | Likely cause | Where to look |
| --- | --- | --- |
| `Cannot find module …/dist/index.js` | Root `npm run build` not run | `packages/*/package.json` `exports` |
| `Chat request failed: 400 … messages must be an array` | Body without a `messages` array | `packages/server/src/handler.ts` (`parseMessages`) |
| A 401 you threw shows up as a broken 200 stream | `ChatHandlerError` thrown inside an `async function*` | `docs/ADOPTION.md` §3 |
| Retry button does nothing after a network error | `regenerate()` needs a trailing assistant message, so use `edit()` | `docs/ADOPTION.md` §4 |
| Custom `data-*` part renders as "unknown" | Registered by wildcard or fallback only, and `PartRenderer` needs the exact name | `packages/react/src/parts.tsx` (`PartRenderer`) |
| Changing `useChat` options has no effect | Options are read once | `packages/react/src/useChat.ts` |
| Send double-fires | `submitted` collapsed into `streaming` somewhere | `packages/core/src/chat.ts` (`BUSY`) |
| Stopped turn shows a spinning tool | Tool status not moved to `cancelled` | `packages/core/src/chat.ts` (`cancelInFlightTools`) |
| Tool args stay raw text | `argsText` streamed but no `part-end` with parsed `args` | the server/connector, not the renderer |
| Composer submits mid-word with an IME | Composition not checked before Enter | `packages/react/src/Composer.tsx` (`handleKeyDown`) |
| Theme wrong | No `data-theme` above the chat, so the system preference wins | `packages/styles/src/tokens.css` |
| Workspace `409 The agent is still working` | One run per session | `apps/workspace/server/sessions.ts` (`reserve`) |
| `The scratchpad is not open in a browser` | Canvas tools need a connected tab | `apps/workspace/server/relay.ts` |

More workspace symptoms: `apps/workspace/AGENTS.md#troubleshooting`.

## Reproducing

- Core: a `node --test` script with an in-memory transport (`packages/core/src/chat.test.ts`).
- React: `examples/slice-1` at `http://localhost:5179/?view=scenarios` (scripted transports for each state in `examples/slice-1/App.tsx`).
- Server: run `examples/server-node` and `curl -N -X POST http://127.0.0.1:5174/chat -H 'content-type: application/json' -d '{"messages":[]}'`.
- Workspace: run on spare ports with a throwaway `AICL_WORKSPACE` (see `apps/workspace/AGENTS.md`).

## Streaming-state sanity check

`ChatStatus` is `idle`, `submitted`, `streaming`, `aborted`, `error`. A stuck UI usually comes from one of:

1. `submitted` forever: the transport never yielded `message-start`. Check the wire.
2. `error` after a user's Stop: an abort was mistaken for a failure. The controller guards this; check custom transports that swallow `AbortError`.
3. `idle` while parts still arrive: an early `message-end` from the backend.
