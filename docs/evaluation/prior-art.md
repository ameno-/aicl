# Prior Art Scan: AI Chat UI Libraries

Phase 1 research for AICL (aicl-4s9.1). Goal: identify what existing open-source
chat UI libraries get right, what they get wrong, and where AICL's positioning —
framework-free core, framework adapters, headless data-* components — is differentiated.

Sources: GitHub, npm, API references, blog posts, community discussions. No API
shapes invented.

---

## Libraries Surveyed

### 1. assistant-ui

**What it is.** Open-source TypeScript/React library for production-grade AI chat.
Founded 2024, AgentbaseAI-backed. Actively developed (0.15.x as of Sep 2026).
Ships a full runtime layer with adapters for LangChain, Vercel AI SDK.

**API shape.** `createAuiRuntime(...)` owns message storage, streaming, tool
execution. Interaction via React context/hooks: `useAui()`, `useAuiState()`. Also
ships an **External Store API** letting consumers own state outside the runtime.

**Message model.** Structured — typed content blocks (text, images, tool calls,
tool results). `MessagePartPrimitive` named primitives. Supports interleaved
content within a single assistant turn.

**State management.** Runtime-owned by default. External Store API is the escape
hatch. Storage is not directly observable.

**Styling.** Styled by default. External-store path allows full replacement.

**Framework coupling.** React-only. No Svelte, Vue, or framework-free core.

**Transport coupling.** Ships adapters for Vercel AI SDK and LangChain. Runtime
still orchestrates — not a pure transport interface.

**Does well:** Structured message parts, External Store API, active maintenance.

**Does not do:** Framework-free core; styled-by-default is the primary API;
transport embedded in runtime.

---

### 2. chatscope / chat-ui-kit-react

**What it is.** React component library. Two packages: styled
`@chatscope/chat-ui-kit-react` and state-hook `@chatscope/use-chat`.

**API shape.** Drop-in components: `ChatContainer`, `MessageList`, `Message`,
`Avatar`, `SendButton`. `use-chat` hook manages state:

```ts
const { messages, sendMessage, setMessages, clearMessages } = useChat(config);
```

**Message model.** `content: string` with a `position` field
(`'single' | 'first' | 'normal' | 'last'`). No typed parts, no tool calls,
no interleaving. Extensions are ad-hoc metadata.

**State management.** Hook owns `messages` in React state. No observable, no
external store.

**Styling.** Fully styled. CSS variables on the container only. No headless path.

**Framework coupling.** React-only. Appears largely abandoned (last publish ~1 year ago).

**Transport coupling.** `service` config accepts an async send function — a
callback, not an adapter interface.

**Does well:** Separate state and UI packages; transport-agnostic hook.

**Does not do:** String-only message model; styled-only; position-based layout
breaks during streaming/edits; no streaming in the model.

---

### 3. Vercel AI SDK useChat

**What it is.** Part of the Vercel AI SDK — the most widely deployed TypeScript AI
toolkit. `useChat` is a React hook for streaming chat UIs on top of `streamText`.

**API shape:**

```ts
const { messages, input, isLoading, sendMessage, stop } = useChat({ api: '/api/chat' });
```

**Message model.** String `content` with parallel `tool_calls` array:

```ts
interface CoreMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  tool_calls?: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }>;
  tool_call_id?: string; // on tool-result messages
}
```

Prose before and after a tool call cannot be interleaved — tool results appear
after the entire content string.

**State management.** Hook owns state internally via `useSyncExternalStore`. No
external store, no observable, no replaceable path.

**Styling.** None shipped. SDK is a data layer; every consumer rebuilds transcript,
composer, scroll.

**Framework coupling.** React-first. Svelte/Vue equivalents less prominent.

**Transport coupling.** `streamText` server-side function is the endpoint. No
transport interface — consumer wires client to server through a route handler.

**Does well:** Type-safe streaming primitives, tool calling, provider-agnostic
server API, wide community adoption.

**Does not do:** String-plus-parallel-tool_calls model; no headless components;
opaque state; `submitted` vs `streaming` not explicit; no transport interface.

---

### 4. deep-chat

**What it is.** Web-component-based chat component. Drop in with one line of HTML
or use a React/Vue/Svelte wrapper. "One-for-all" pitch: connects to ChatGPT,
Claude, OpenRouter, Azure, custom backends.

**API shape.**

```html
<deep-chat demo='{"directConnection": {"openAI": {"key": "..."}}}'></deep-chat>
```

**Message model.** Not structured. Plain objects with `role` and `text`/`html`/`files`
fields. No typed parts, no tool call model, no interleaving.

**State management.** Fully encapsulated. No hook, no API for external state.

**Styling.** Shadow DOM with CSS variable configuration. Limited consumer styling.

**Framework coupling.** Low — web component foundation. React/Vue/Svelte wrappers.

**Transport coupling.** High. Direct API connection bypasses consumer backends in
the default configuration. Custom backends are the minority path.

**Does well:** True drop-in, multi-provider, web-component foundation, native
file/audio handling.

**Does not do:** Structured message model; external state; headless path;
low transport coupling.

---

### 5. shadcn/chat

**What it is.** New (mid-2026) chat components from shadcn/ui. Ships
`MessageScroller`, `Message`, `Bubble`, `Attachment`, `Marker`. The headline:
`MessageScroller` ships as a **headless primitive** in `@shadcn/react` alongside
styled defaults.

**API shape.** Components installed via CLI. Consumer manages all state, streaming,
transport. `MessageScroller` provides scroll behavior (anchor-to-bottom, streaming
follow, prepend preservation, scroll commands).

**Message model.** Not defined by components. Consumer decides what a message is.

**State management.** None. Stateless presentational components. Honest headless
path: no state, no store, no opinion.

**Styling.** Two paths: styled defaults (shadcn/ui + Tailwind) and headless
primitive (`@shadcn/react`).

**Framework coupling.** React-only.

**Transport coupling.** None.

**Does well:** Headless scroller solves streaming scroll without coupling to state
or visuals; consumer-owns-state is the right headless default; scroll anchoring
is genuinely hard and solved well.

**Does not do:** No message model; no state management; no transport abstraction;
React-only.

---

### 6. Alibaba ChatUI

**What it is.** React library and UI design language from Alibaba.
`@chatui/core`. General conversational UI toolkit (not AI-specific).

**API shape.**

```tsx
<Chat locale="en-US" messages={messages} onSend={handleSend} renderMessage={CustomMessage} />
```

**Message model.** `content: string` with a `type` field (`'text' | 'image' | 'card' | 'quick-reply'`).
No typed parts, no tool calls, no interleaving.

**State management.** Stateless. Consumer passes `messages`, owns all state.

**Styling.** Styled components with a design system. No headless path.

**Framework coupling.** React-only.

**Transport coupling.** None.

**Does well:** Simple stateless API; quick-reply and card types show awareness
of non-text content.

**Does not do:** String-only message model; no streaming; no headless primitives;
maintenance appears to have slowed.

---

### 7. LangChain JS / LangGraph React Runtime

**What it is.** LangChain does not ship a chat UI library. It ships
`@langchain/core` (message primitives, LCEL) and `@langchain/langgraph`
(agent orchestration). UI integration is through assistant-ui and Vercel AI SDK.

**Message model.** `BaseMessage.content` can be a string **or** `ContentBlock[]`:

```ts
interface BaseMessage {
  content: string | (BaseMessageChunk | ContentBlock)[];
  additional_kwargs: Record<string, unknown>;
  response_metadata: Record<string, unknown>;
  type: string;
  id?: string | string[];
  example: boolean;
}
```

Closest existing model to AICL's part array — but `ContentBlock` is
Anthropic-style, not a generic union with a `data-*` extension point.

**State management.** No opinion. UI state is consumer's responsibility.
Integration through assistant-ui's LangChain adapter.

**Framework coupling.** Core is framework-agnostic. React hooks in `@langchain/react`.
No Svelte or Vue.

**Transport coupling.** LCEL streams are the protocol. `useStream` bridges to any UI.

**Does well:** `ContentBlock[]` is structurally closest to AICL's part array;
framework-free core; well-specified streaming protocol.

**Does not do:** `ContentBlock` is provider-shaped; no UI components; no headless
primitives.

---

## Synthesis

### Adopt — What AICL Should Do

1. **Structured message parts over strings.** assistant-ui and LangChain show the
   string-only model is a known mistake. AICL's discriminated union (D1) aligns
   and goes further with the `data-*` extension point.

2. **Transport-agnostic state.** chatscope's `use-chat` and shadcn's headless
   `MessageScroller` show separating state from visuals is right. AICL's
   `ChatTransport` interface (D3) is the cleaner version.

3. **Headless primitives for hard behavior.** shadcn's `MessageScroller` is
   headless because scroll anchoring is hard. AICL's primitives (Transcript,
   Composer, ToolCallDisclosure) follow the same reasoning.

4. **External store / observable state.** assistant-ui's External Store API and
   chatscope's `setMessages` show consumers need state ownership. AICL's
   `ReadableStore` (D3, D8) is the cleanest implementation.

5. **Streaming delta protocol.** Vercel AI SDK's `StreamEvent`-shaped protocol
   is well-understood. AICL's indexed deltas (part-start/delta/end) refine it.

6. **Abort preserves partial output.** Vercel AI SDK's `stop()` and
   assistant-ui's interrupt show this is expected. AICL's `aborted` flag (D5)
   is correct.

7. **Consumer-owns-state for headless.** shadcn/chat and Alibaba ChatUI show
   stateless components with consumer-provided state are the right headless default.

---

### Avoid — What AICL Should Not Repeat

1. **Styled-by-default as the primary API.** assistant-ui and chatscope ship
   styled as the main product, headless as an afterthought. AICL must ship
   headless as the primary contract, styled as a separate opt-in package.

2. **`content: string` as the message model.** chatscope, deep-chat, Alibaba
   ChatUI, and Vercel AI SDK all use this. The failure mode is known: every
   product that starts with a string bolts on a parallel channel. AICL's part
   array must be the only model.

3. **Opaque state management.** Vercel AI SDK's `useChat` and assistant-ui's
   runtime own state internally. Persistence, optimistic updates, and
   cross-component state sharing become impossible. AICL's `ReadableStore` must
   be observable and replaceable.

4. **React-only as the only framework path.** Every surveyed library except
   deep-chat (web component) and LangChain core is React-only. AICL's three-layer
   split is the answer, but `@aicl/core` must never import a framework — enforced
   in CI.

5. **Coupling the component to a specific backend.** deep-chat's direct API
   connection, Vercel AI SDK's route handler coupling, assistant-ui's provider
   adapters. AICL's `ChatTransport` interface must be first-class, not a workaround.

6. **Position-based message layout.** chatscope's `position: 'first' | 'normal' | 'last'`
   breaks during streaming and edits. AICL renders by id from a normalised map —
   this must stay.

7. **No virtualisation strategy.** No surveyed library addresses long-conversation
   performance. AICL's normalised store with O(1) appends and the virtualisation
   open question (D8 open item 2) must be resolved, not deferred.

---

### Positioning Statement

Existing libraries fail in two ways:

**Failure mode 1: Opinionated monolith.** The library owns your backend
(assistant-ui's adapters, deep-chat's direct connection), your state
(assistant-ui's runtime, Vercel AI SDK's `useChat`), and your visuals
(chatscope, Alibaba ChatUI). You can theme slightly, but cannot escape. When
your product diverges, you fork.

**Failure mode 2: Stateless primitives.** The library ships components that
render whatever you pass them (shadcn/chat, Alibaba ChatUI). You get scroll
behavior or layout, but rebuild all state, streaming, abort, branching, and
transport yourself. The library solves the easy problem.

AICL occupies the gap:

> AICL is the only library that ships framework-free, headless, stateful
> components with a first-class transport interface and a typed part array model
> supporting arbitrary domain extensions.

The three-layer split means:
- Svelte teams use `@aicl/svelte`, not a React library with a Svelte wrapper.
- Teams with a design system use headless primitives and their own CSS.
- Teams with a custom backend implement `ChatTransport`, not a provider adapter.
- Teams building agentic products use `data-*` extension points without forking.

---

### Key Gaps AICL Fills

1. **Framework-free + stateful + headless.** assistant-ui is stateful and headless-ish
   but React-only. Vercel AI SDK is framework-free but stateless. shadcn/chat
   is headless but stateless. No library combines all three.

2. **Typed part array with `data-*` extension point.** LangChain's
   `ContentBlock[]` is closest but provider-shaped. Every other library uses
   `content: string`. The `data-invoice`, `data-plan`, `data-terminal` extension
   point is unique.

3. **Explicit `submitted` vs `streaming` state machine.** Vercel AI SDK conflates
   them; most libraries ignore the state machine entirely. Required for correct
   send/stop button behavior.

4. **Branching as a first-class model.** No surveyed library models editing or
   regeneration as branching. AICL's normalised node map with parent/child links
   (D6) is uncharted territory.

5. **Virtualisation-first transcript design.** Long-conversation performance is
   open across all surveyed libraries. AICL's normalised store with O(1) appends
   is the right foundation.

6. **Cooperative abort with partial-output preservation in a headless library.**
   No other library combines headless primitives + observable state + cooperative
   abort + partial output preservation.

---

*Prior-art scan (aicl-4s9.1). Researched via WebSearch of GitHub, npm, official
docs, and community discussions. No API shapes invented.*
