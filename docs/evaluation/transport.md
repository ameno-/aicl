# V2 — Transport and Backend Contracts

**Status:** draft — awaiting BLUEPRINT.md sign-off  
**Beads:** part of the V2 vertical, tracked in epic aicl-v2-transport

---

This document defines the contract between the AICL component library and the backend that drives it. It is the most important API the library will ever have: every component, every adapter, and every consumer's backend is derived from this interface.

Read in conjunction with:
- `packages/core/src/types.ts` — the live TypeScript source of truth
- `packages/core/src/transports/sse.ts` — the reference SSE transport implementation

---

## Current Interface

```typescript
export interface ChatTransport {
  send(req: SendRequest, signal: AbortSignal): AsyncIterable<StreamEvent>;
}

export interface SendRequest {
  messages: Message[];           // messages along active branch, oldest first
  body?: Record<string, unknown>; // opaque to library; forwarded verbatim to backend
  headers?: Record<string, string>;
}

export type StreamEvent =
  | { type: 'message-start';     id: string; role: 'assistant' }
  | { type: 'part-start';        index: number; part: Part }
  | { type: 'part-delta';        index: number; delta: string }
  | { type: 'part-end';          index: number; part?: Part }
  | { type: 'message-end';       finishReason: FinishReason; usage?: Usage }
  | { type: 'error';             error: { message: string; retryable?: boolean } };
```

The interface is intentionally minimal. Core performs no I/O, so any backend — OpenAI-compatible, custom, in-memory — works via this contract.

---

## What the Interface Gets Right

- **Indexed deltas.** `part-delta` appends to an existing part by index rather than resending the whole part per token. This is the correct granularity for streaming.
- **`submitted` ≠ `streaming`.** The `message-start` event separates the request-sent phase from the first-token phase. The library rejects double-sends in `submitted` without needing to check the stream.
- **Abortable.** The `signal: AbortSignal` is the standard browser primitive. The SSE transport releases the reader lock on abort so the connection tears down promptly.
- **Opaque body.** `body` is forwarded verbatim. No library opinion on what the backend expects.
- **No I/O in core.** Core is runnable in plain Node without DOM, which makes the state machine testable without a browser.

---

## Gaps in the Current Interface

The current interface is a clean foundation but leaves five decisions unmade. Each is resolved below as a proposed ADR.

---

### ADR-T1 — Tool Execution: Backend Resolves Tools

**Question.** Does the library execute tools in the browser, or does the backend resolve them?

**Current state.** `ToolCallPart` exists in the type system with `status: ToolStatus` but there is no mechanism in `StreamEvent` for the library to contribute a tool result back to the stream.

**Proposed resolution.** Tools are always resolved by the backend. The library is purely presentational.

**Rationale.** All four corpus products (Cofounder, Devin, Lovable, Manus) surface tool calls as transcript-native events — the tool executes server-side, the result streams back as a `tool-result` part. No product runs tool execution in the browser. The corpus evidence is unanimous.

**What this means for the stream.** The backend executes tools and emits the result as a `tool-result` event in the stream, interleaved with other events:

```
message-start          → assistant message begins
part-start {tool-call} → model requests a tool
part-end              → tool call complete
part-start {tool-result} → result streams in
part-end              → result complete
message-end           → turn complete
```

**Implication.** The library never calls `toolCall(args)`. It renders the state transitions (`pending → running → success/error`) and the result. The backend owns the execution environment.

**Escape hatch.** Consumers who need browser-side tool execution (local file access, custom tools the backend doesn't know about) can implement a custom `ChatTransport` that resolves tools in `send()` before forwarding the result. This is explicitly allowed by the interface — the library doesn't care where `send` gets its events.

**Decision.** `[proposed] backend resolves tools; library is purely presentational for tool calls; escape hatch via custom ChatTransport`.

---

### ADR-T2 — Auth Model: Library Holds No Secrets

**Question.** Where does the API key live?

**Proposed resolution.** The library holds no secrets. The transport is constructed with whatever credentials the consumer provides.

```typescript
// Consumer constructs the transport with their auth
const transport = createSseTransport({
  url: '/api/chat',
  headers: {
    Authorization: `Bearer ${apiKey}`,  // key lives in the app layer, not the library
  },
});
```

**Rationale.** The library is headless and consumer-owned. It cannot know where secrets should live — some consumers use cookies, some use bearer tokens, some proxy through their own backend. The transport is constructed by the consumer's application layer, which owns the auth decision.

**What this means for the reference app.** The reference backend (V3) should accept a bearer token and pass it to the inference API. The reference frontend passes its own API key or a session token to the backend. Neither the library nor the reference app backend needs to know the inference API key directly.

**Decision.** `[proposed] library holds no secrets; transport is constructed with whatever auth the consumer provides; reference app uses bearer tokens via a thin backend proxy`.

---

### ADR-T3 — Model Selection: Carried in Body

**Question.** How does the consumer specify which model to use?

**Proposed resolution.** Model selection is carried in `SendRequest.body`, not as a library-level config.

```typescript
controller.send('Hello', [], {
  // body is opaque to the library; forwarded verbatim to the backend
  body: { model: 'gpt-4o', temperature: 0.7 },
});
```

**Rationale.** The library has no opinion on what models exist. A consumer on OpenAI, a consumer on Anthropic, and a consumer on a custom endpoint all use the same library. The `body` field is the extension point for backend-specific parameters.

**What this means for the reference backend.** The reference backend reads `body.model` and routes to the appropriate inference endpoint. If `body.model` is absent, it uses a default.

**Model list.** The library does not maintain a model list. If a consumer wants to surface a model picker, they manage the list themselves.

**Decision.** `[proposed] model selection via SendRequest.body; library has no model list; backend routes from body`.

---

### ADR-T4 — Error Taxonomy

**Question.** How are errors surfaced to the consumer?

**Current state.** `StreamEvent` has `{ type: 'error'; error: { message: string; retryable?: boolean } }`. The SSE transport throws on non-2xx responses before yielding any events. The library maps this to `ChatStatus: 'error'` with the message in `ChatState.error`.

**Proposed resolution.** Three error categories, each handled differently:

| Category | Source | Library response | Consumer action |
|---|---|---|---|
| Transport error | Network, DNS, connection drop | `ChatStatus: 'error'`, `ChatState.error` set | Retry via `send()` |
| HTTP error (4xx/5xx) | Backend rejects the request | SSE transport throws before yielding; library sets `ChatStatus: 'error'` | Fix request or backend |
| Stream error | Model returned an error mid-stream | `StreamEvent: { type: 'error' }` yielded | `ErrorPart` rendered in transcript |
| Abort | User clicked stop, or parent cancelled | `ChatStatus: 'aborted'` — partial output preserved | Resume or edit |

**Error part.** `{ type: 'error' }` events yield `ErrorPart` objects, which render as error banners in the transcript via the `PartRenderer` registry. The library ships a default `ErrorPart` renderer that shows the message and a retry button.

**Retryability.** `error.retryable` is a hint. If `true`, the consumer's UI can show a retry affordance without prompting. If `false`, the error is permanent (auth failure, bad request) and retrying requires fixing the root cause first.

**Decision.** `[proposed] three error categories; ErrorPart via registry; retryable flag as UI hint; abort preserves partial output (D5)`.

---

### ADR-T5 — Transport Lifecycle and Backpressure

**Question.** What happens if `send()` is called while a stream is already in progress?

**Proposed resolution.** `ChatController.send()` is idempotent in the sense that calling it while `status === 'streaming'` or `status === 'submitted'` is a no-op (it returns a rejected promise). The consumer cannot accidentally double-send.

**What the library does not do.** The library does not implement queuing. If a consumer wants to queue a message while a stream is in progress — so it sends the moment the current stream ends — they implement that in their application layer, not in the library. The corpus shows no queued-message UX anyway (flagged as a gap in the composer evaluation).

**Backpressure.** The library consumes events as fast as they arrive. Slow consumers (heavy renders, network constraints) are not compensated for. If this becomes a problem, it is an adapter concern, not a core concern.

**Decision.** `[proposed] send() rejects during streaming/submitted; no queueing in core; backpressure is adapter-level`.

---

## Reference Backend Contract

For any backend to work with AICL, it must:

1. Accept a `POST` request with `Content-Type: application/json`
2. Read `body.messages` (array of `Message` objects) and `body.*` (opaque backend params)
3. Read `headers.Authorization` for auth
4. Stream `StreamEvent`-shaped JSON objects as SSE `data:` lines
5. Execute any tools server-side and emit `tool-result` events in the stream
6. Return appropriate HTTP status codes (401 for auth failure, 400 for malformed request, 200 for success)

### Minimum viable backend (pseudocode)

```
POST /chat
  auth: bearer token from Authorization header
  body: { messages: [...], model: "..." }

  for each message in messages:
    send to inference API (OpenAI-compatible or custom)

    for each event from inference API:
      if event is a tool call:
        result = execute_tool(event.name, event.args)
        emit { type: 'part-start', index: i, part: { type: 'tool-result', toolCallId: id, result } }
      else:
        emit event as SSE data:

  emit { type: 'message-end', finishReason: 'stop', usage: {...} }
```

### What the backend does NOT need to know

- The library's internal types (it works with plain JSON)
- How many adapters exist (React, Svelte, Vue — transparent)
- What rendering framework the consumer uses

---

## Open Questions

1. **Streaming format.** SSE is the reference implementation, but WebSocket and plain JSON-streaming are equally valid. Should we document a WebSocket transport adapter, or leave it to consumers?
2. **Multipart responses.** Some backends return a text response AND a structured JSON response (e.g., tool calls alongside text). Should `body` carry a `response_format` hint, or is this entirely backend-specific?
3. **Session persistence.** The transport carries `messages` per request — there is no session ID concept in the interface. Is session state a backend concern, or should the library carry a session identifier?

---

## Relationship to V1

V1 implements the component library against this contract. V2 defines the contract. The two are designed together: every component in V1 is driven by `StreamEvent`s from this interface, and every `StreamEvent` in this interface has a rendering path through the `PartRenderer` registry.

V3 (reference app) is a consumer of V2 — it implements the reference backend described above.
