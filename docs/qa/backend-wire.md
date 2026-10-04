# Backend wire QA report

Captured against a real end-to-end wire round-trip:

- **Server** — `examples/server-node` running on `127.0.0.1:5174`. The handler is
  wrapped by `@aicl/server`'s `createChatHandler` and yields a scripted
  sequence: `message-start` → `part-start reasoning` → `part-start text` →
  word-by-word `part-delta` → tool call → artifact → `message-end`.
- **Proxy** — Vite forwards `/api/*` to the server (CORS-free).
- **Client** — `examples/slice-1` `?scenario=remote` issues a real `fetch`
  through the Vite proxy, parses SSE, and feeds the controller.

## Direct curl

```
$ curl -sN -X POST http://127.0.0.1:5174/chat \
    -H "content-type: application/json" \
    -d '{"messages":[{"id":"u1","role":"user",
                     "parts":[{"type":"text","text":"ping"}]}]}'
data: {"type":"message-start","id":"74ac4a62-...","role":"assistant"}
data: {"type":"part-start","index":0,
       "part":{"type":"reasoning","text":"Thinking about: ping."}}
data: {"type":"part-start","index":1,"part":{"type":"text","text":""}}
data: {"type":"part-delta","index":1,"delta":"Edited"}
...
data: {"type":"message-end","finishReason":"stop"}
data: [DONE]
```

## Through the Vite proxy

```
$ curl -s -X POST http://127.0.0.1:5179/api/chat \
    -H "content-type: application/json" \
    -d '{"messages":[{"id":"u1","role":"user",
                     "parts":[{"type":"text","text":"hi"}]}]}'
data: {"type":"message-start", ... }
data: {"type":"part-start", "index":0,
       "part":{"type":"reasoning","text":"Thinking about: hi."}}
data: {"type":"part-delta","index":1,"delta":"Edited"}
...
```

The proxy transparently forwards SSE frames.

## Through the fixture (browser)

DOM after the round trip:

```
{
  status: "idle",
  parts: ["text", "text"],
  cards: 1,
  threadText: true   // "Network round-trip"
}
```

- The controller reached `idle` — `message-end` flushed.
- The artifact card is in the transcript.
- The user's "Network round-trip" message is preserved.
- The thread renders alongside the artifact.

## Test results

`@aicl/server` test suite (`npm test -w @aicl/server`):

```
ok 1 - createChatHandler streams SSE events from the handler
ok 2 - createChatHandler surfaces handler errors as ChatHandlerError
ok 3 - createChatHandler rejects malformed bodies with 400
ok 4 - toSse() converts a thrown stream error into a StreamEvent error frame
1..4
# pass 4 # fail 0
```

## Verdict

PASS. The wire round-trip works end to end:

- The client speaks canonical `StreamEvent` only.
- The server yields canonical `StreamEvent` only.
- The contract is verifiable without any provider SDK or browser-only code.
- Screenshots after the disk hit 100% returned EAGAIN; DOM evidence captured
  before that proves the round trip.
