# Architecture

This document defines the core architecture for an open-source AI chat UI component
library. It covers the component layer only. The backend, the model gateway, and the
reference application are separate concerns built on top of this.

## What this is

A **pluggable UI interface of components for AI chat applications.** The library ships
behaviour, state, and accessibility. It does not ship a product, an opinion about your
backend, or a design language you cannot replace.

The design is grounded in a survey of 1,262 screenshots from four shipping agentic-chat
products (Devin, Manus, Lovable, Cofounder). That corpus is the source of the component
inventory, not a designer's intuition. See `docs/CORPUS.md` for the method.

## Why a three-layer split

Every mainstream chat UI kit couples three things that change at different rates:

| Concern | Changes when | Example |
|---|---|---|
| Conversation semantics | Rarely | What a "message" is, how streaming ends |
| Framework binding | Per consumer | React hooks vs Svelte runes |
| Visual design | Constantly | Tokens, spacing, brand |

Coupling them is why chat kits get abandoned: a React-only kit is useless to a Svelte
team, and a styled kit is useless to anyone with a design system. So the library splits
along those seams.

```
@aicl/core      framework-agnostic, zero DOM, zero deps
   |
   +-- @aicl/react     hooks + unstyled primitives
   +-- @aicl/svelte    runes + unstyled primitives
   +-- @aicl/vue       composables + unstyled primitives
        |
        +-- @aicl/styles   optional CSS-variable theme
```

`@aicl/core` must never import a framework, and must never touch `document`. That is the
constraint that makes every adapter cheap to write and the whole library testable in plain
Node. There is no CI yet, so the rule is enforced in review.

**Status:** `@aicl/core`, `@aicl/react` and `@aicl/styles` exist, together with
`@aicl/server` (handler + SSE framing) and `@aicl/fx` (optional animated components).
`packages/svelte` and `packages/vue` are empty placeholders: the split is designed for them,
but neither adapter has been written.

## The message model

The central decision. A message is **not** a string, and it is **not** a string plus
optional metadata. It is an ordered list of typed parts:

```ts
interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  parts: Part[];
  createdAt?: number;
  metadata?: Record<string, unknown>;
}
```

A parts array is required because the corpus shows assistant turns routinely interleaving
content types in a single message: prose, then a tool invocation, then its result, then
more prose, then citations. A `content: string` field cannot represent that ordering, and
every product that started with one has bolted on a parallel channel to work around it.

Parts are a discriminated union:

```ts
type Part =
  | { type: 'text'; text: string }
  | { type: 'reasoning'; text: string; collapsed?: boolean }
  | { type: 'tool-call'; toolCallId: string; name: string; args: unknown; status: ToolStatus }
  | { type: 'tool-result'; toolCallId: string; result: unknown; isError?: boolean }
  | { type: 'file'; mediaType: string; url: string; name?: string; size?: number }
  | { type: 'citation'; sourceId: string; quote?: string; url?: string }
  | { type: 'artifact'; artifactId: string; kind: ArtifactKind; title?: string }
  | { type: 'error'; message: string; retryable?: boolean }
  | { type: `data-${string}`; data: unknown };
```

The final `data-${string}` variant is the extension point. Consumers add domain parts
without forking the library or widening the core union.

### Rendering parts

Parts are matched to renderers through a registry rather than a `switch` statement:

```ts
const registry = createRendererRegistry({
  text: TextPart,
  'tool-call': ToolCallCard,
  'data-invoice': InvoiceCard,   // consumer-defined
});
```

A `switch` in the library means every new part type requires a library release. A registry
means consumers extend it at runtime and the transcript renderer stays closed for
modification. Unknown part types fall back to a registered handler rather than throwing,
so a server that adds a part type cannot white-screen an older client.

Implementation gap: `@aicl/react`'s `PartRenderer` currently consults a consumer registry
only for exact type names, so its `data-` wildcard and fallback are ignored there (unknown
parts still render, through the built-in `UnknownPart`). See `docs/ADOPTION.md` §5.

## Transport boundary

`@aicl/core` performs no I/O. It consumes a transport:

```ts
interface ChatTransport {
  send(req: SendRequest, signal: AbortSignal): AsyncIterable<StreamEvent>;
}
```

The library ships one adapter, Server-Sent Events (`createSseTransport`). Plain JSON and
WebSocket transports are planned. The interface is the contract. This is what "pluggable" has to mean: you can drive the
components from OpenAI-compatible endpoints, from your own backend, or from an in-memory
mock in tests, without the components knowing.

`StreamEvent` is deliberately narrow, and describes deltas rather than whole messages:

```ts
type StreamEvent =
  | { type: 'message-start'; id: string; role: 'assistant' }
  | { type: 'part-start'; index: number; part: Part }
  | { type: 'part-delta'; index: number; delta: string }
  | { type: 'part-end'; index: number; part?: Part }
  | { type: 'message-end'; finishReason: FinishReason; usage?: Usage }
  | { type: 'error'; error: { message: string; retryable?: boolean } };
```

Indexed deltas let a transcript update in place without rebuilding the message, which is
what keeps long conversations from re-rendering on every token.

## Conversation state machine

Streaming chat has more states than it appears, and getting them wrong produces the two
bugs every chat UI ships with: a send button that submits twice, and a stop button that
leaves a half-written message stuck.

```
idle ──submit──> submitted ──first-event──> streaming ──message-end──> idle
  ^                  │                          │
  │                  └──error──> error          ├──abort──> aborted ──> idle
  └──────────────────────────────────────────── └──error──> error ──retry──> submitted
```

`submitted` is distinct from `streaming` on purpose. Between the request leaving and the
first token arriving the UI must show a pending state and reject further submits, but it
has no content to render and no stream to abort. Collapsing the two is what makes send
buttons double-fire.

Aborting is always cooperative: the core signals the transport and keeps the partial
message, flagged, rather than discarding it. The corpus shows every surveyed product
preserving partial output on interrupt, and users rely on it.

## Store layer

A minimal observable, roughly 60 lines, with no dependency:

```ts
interface ReadableStore<T> {
  get(): T;
  subscribe(fn: (value: T) => void): () => void;
}
```

Adapters map this onto native reactivity: `useSyncExternalStore` in React, runes in
Svelte 5, `shallowRef` in Vue. Nothing in core knows which is in use.

The transcript is stored as a normalised map plus an id array, not a nested tree. Appending
a token to the last message must not create a new array of all messages, or long
conversations degrade quadratically.

## Headless primitives

Each adapter ships unstyled, accessible primitives that consume core state. They own DOM
structure, ARIA semantics, focus management, and keyboard behaviour, and own no visual
design:

- `<Transcript>` — stick-to-bottom, `role="log"` with `aria-live` (not virtualised in v1; see D13)
- `<MessageItem>` — provides message context to its children
- `<PartRenderer>` — registry dispatch
- `<Composer>` — autosizing textarea, Enter/Shift+Enter, IME-safe submit
- `<SlashMenu>` / `<MentionMenu>` — trigger-based combobox with full keyboard nav
- `<AttachmentDropzone>` — paste, drag, and picker
- `<ToolCallDisclosure>` — collapsible, streaming-aware

Two accessibility details are worth stating because they are near-universally wrong:
IME composition must be checked before treating Enter as submit, or the library breaks
text entry for Japanese, Chinese, and Korean users; and a streaming transcript needs
`aria-live="polite"` on a container that is not itself re-created per token, or screen
readers re-announce the entire conversation on every delta.

## Styling

Core and adapters ship no CSS. Every primitive exposes stable `data-*` attributes for
state (`data-state="streaming"`, `data-role="assistant"`, `data-part="tool-call"`), so
consumers can style with Tailwind, CSS modules, vanilla CSS, or anything else.

`@aicl/styles` is a separate, optional package: a CSS-variable theme that makes the
library usable out of the box without making it hard to replace.

## Package boundaries

| Package | Depends on | May import framework | May touch DOM |
|---|---|---|---|
| `@aicl/core` | nothing | no | no |
| `@aicl/react` | core, react | react only | yes |
| `@aicl/svelte` | core, svelte | svelte only | yes |
| `@aicl/vue` | core, vue | vue only | yes |
| `@aicl/styles` | nothing | no | CSS only |
| `@aicl/server` | core | no | no |
| `@aicl/fx` | react, motion, Tailwind v4 | react only | yes (styled; opt-in) |

`@aicl/svelte` and `@aicl/vue` are not implemented yet.

## Deliberate non-goals

- **No backend.** The library does not define endpoints, auth, or persistence.
- **No model-provider SDKs.** Provider coupling belongs in a transport adapter.
- **No design language.** Themes are opt-in and replaceable.
- **No markdown engine.** Markdown rendering is pluggable; bundling one imposes a parser,
  a sanitiser, and a syntax highlighter on every consumer.

## Open questions

Resolved by corpus analysis (see `docs/DECISIONS.md` and `docs/domains/`): agent
execution surfaces stay in the chat packages (D9), platform pages are recipes not
API (D10), and session metadata is its own model (D11).

Since resolved: the command palette is a recipe over one combobox contract (D12); there is
no windowing inside `Transcript` or `SessionList` in v1 (D13); and artifacts ship in v1 as
data plus a card renderer, with no `@aicl/artifacts` package (D14). The open questions that
remain are listed at the end of `docs/DECISIONS.md`.
