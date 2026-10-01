# Blueprint — AICL v1

**Status:** draft, awaiting sign-off (beads `aicl-jva.1`).
**What this is.** The single build target for the one-shot v1 implementation: exact packages,
primitives, props, `data-*` attributes, core API. It contains **no new research** — it
synthesizes `docs/ARCHITECTURE.md`, `docs/DECISIONS.md` (D1–D11), the live core sources
(`packages/core/src/{types,chat,store,registry}.ts`, `transports/sse.ts`), the five domain
specs, and the seven comparative evaluations in `docs/evaluation/`.
**Authority order.** Evaluations > `ARCHITECTURE.md` and the domain specs. Every reconciled
disagreement is in §10, with the winner named.
**Reading order for implementers.** §2 → §3 (the contract every adapter binds) → §4 (the work)
→ §5 → §8 (build order) → §9 (definition of done). §6 is docs-only; §7 is the `DECISIONS.md`
append. Corpus basis: 1,262 labelled screens — Cofounder 385, Devin 250, Lovable 339, Manus 288.

---

## 2. System overview

### 2.1 Layers, package boundaries

Conversation semantics change rarely, framework bindings per consumer, visual design
constantly; `ARCHITECTURE.md` splits along those seams and the evaluations change nothing there.

```
@aicl/core  (framework-free, zero DOM, zero deps)
   +-- @aicl/react   hooks + unstyled primitives
   +-- @aicl/svelte  runes + unstyled primitives
   +-- @aicl/vue     composables + unstyled primitives
        +-- @aicl/styles  optional CSS-variable theme
```

| Package | Depends on | May import framework | May touch DOM |
|---|---|---|---|
| `@aicl/core` | nothing | no | no |
| `@aicl/react` | core, react | react only | yes |
| `@aicl/svelte` | core, svelte | svelte only | yes |
| `@aicl/vue` | core, vue | vue only | yes |
| `@aicl/styles` | nothing | no | CSS only |

CI gates: no `document`/`window`/framework import under `packages/core/src`; no
`className`/`class` prop in an adapter public type and no stylesheet shipped in an adapter.

### 2.2 Final v1 inventory (28 primitives + 10 default renderers, identical per adapter)

| Group | Exports |
|---|---|
| Transcript surface | `Transcript`, `MessageItem`, `MessageActions` |
| Part rendering | `PartRenderer`, `createPartRegistry`, `defaultRegistry`; default renderers `TextPart`, `CodeBlock`, `ReasoningDisclosure`, `ToolCallDisclosure`, `ToolResultView`, `FileChip`, `ArtifactCard`, `TerminalOutput`, `ErrorNotice`, `SuggestionRows`, `UnknownPart` |
| Composer surface | `Composer` (`.Root`/`.Above`/`.Input`/`.Toolbar`/`.LeadingSlot`/`.TrailingSlot`/`.AttachButton`/`.SendButton`), `AttachmentDropzone`, `AttachmentChip`, `TriggerMenu` (+ `SlashMenu`/`MentionMenu` presets), `SuggestionChips` |
| Agent execution | `PlanChecklist` |
| Session / navigation | `SessionList`, `SessionListItem`, `SessionSearch`, `SidebarNav` |
| Platform | `Dialog`, `AlertDialog`, `Drawer`, `ToastRegion` + `Toast`, `Field`, `Switch`, `Select`, `SegmentedControl` |
| Core services (no components) | `ChatController`, `createSessionStore`, `createStore`/`batched`/`derived`, `createRendererRegistry`, `createScrollPin`, `createComboboxModel` (`@internal`), `createToastQueue`, `createFormController`, `createApprovalsStore`, `createSseTransport` |

### 2.3 What changed against `ARCHITECTURE.md`, and what moved to recipes

A primitive ships behaviour a consumer cannot afford to rebuild correctly (IME-safe Enter,
streaming live-region discipline, focus traps, tail-follow, listbox keyboard models). A
recipe is markdown in `docs/recipes/` composing primitives.

| Change | Component | Reason (evaluation) |
|---|---|---|
| Added | `MessageActions` | `message_actions_bar` 215 frames, 4/4 (transcript §2) |
| Added | `PlanChecklist` | `plan_checklist` 78, 4/4; only 2/78 are chat surfaces, so it must work standalone (agent-execution §2, §3.1) |
| Added | `ArtifactCard`, `TerminalOutput` | artifact cards visible in Lovable 32, Manus 57/84/160 despite 0 labels (transcript §5); agent-execution §3.7; D14 |
| Added | `SuggestionRows`, `SuggestionChips` | transcript §3.6; composer C7 |
| Added | `SessionList`, `SessionListItem`, `SessionSearch`, `SidebarNav` | navigation §4.2 (D11 needs a surface) |
| Added | platform set, `CodeBlock`, `ToolResultView`, `UnknownPart` | D10; platform §3; transcript §2; D2 fallback |
| Adjusted | `Transcript` is **not** virtualised by default | transcript §5 + navigation §4.3 → D13 |
| Adjusted | `SlashMenu`/`MentionMenu` → presets over one `TriggerMenu` | composer C6: one grammar, two triggers, zero observed menus |
| Dropped | `InterruptButton` | the send/stop morph is **one** composer button (composer C3, agent-execution §3.4); D9's package split stands, its component list narrows |
| Dropped | `StepTimeline` | progress ships as derived data, no bar/timeline primitive (agent-execution §3.5) |
| Kept | `AttachmentDropzone`, `ToolCallDisclosure` | composer §2; agent-execution §3.2 |

Demoted to recipes, and therefore absent from every export surface: `CommandPalette` (D12),
`WorkspaceSwitcher` (navigation §3.7 — 205 labels collapse to 1/4 on inspection),
`NewSessionButton` (navigation §3.6), `RatingPrompt` (transcript §3.5 — a `data-*` part),
`CitationChip` (transcript §5), `StepTimeline`, `ArtifactPane`/`PreviewFrame`/`DiffViewer`
(D14), `VoiceButton` (composer §5.6), `SettingsPage`/`SettingsDialog`/`SecretForm`/
`PlanCardGrid`/`BulkSelectView`/`WorkspaceHome`/`TemplateGallery`/`Breadcrumbs`/`TabBar`
(D10, platform §4), `Checkbox`/`Input` (`Field` wires native controls; platform §2).

---

## 3. `@aicl/core` — the contract

Core ships no components, no CSS, no I/O: every adapter need is a type, a store, or a machine.

### 3.1 Final `Part` union

No new part types. transcript §5 (every divergence is a row attribute or a `data-*` part) and
agent-execution §4 ("No recommendation adds a core part type") agree, so
`packages/core/src/types.ts:120` is final, with one behavioural addition.

```ts
type Part =
  | { type: 'text'; text: string }
  | { type: 'reasoning'; text: string; collapsed?: boolean; durationMs?: number }
  | { type: 'tool-call'; toolCallId: string; name: string; args: unknown; status: ToolStatus; argsText?: string }
  | { type: 'tool-result'; toolCallId: string; result: unknown; isError?: boolean }
  | { type: 'file'; mediaType: string; url: string; name?: string; size?: number; uploadProgress?: number }
  | { type: 'citation'; sourceId: string; quote?: string; url?: string; title?: string }
  | { type: 'artifact'; artifactId: string; kind: ArtifactKind; title?: string; version?: number }
  | { type: 'error'; message: string; retryable?: boolean; code?: string }
  | { type: `data-${string}`; data: unknown };              // the extension point
type ToolStatus   = 'pending' | 'running' | 'success' | 'error' | 'cancelled';
type ArtifactKind = 'code' | 'document' | 'diff' | 'preview' | 'terminal' | 'table' | 'chart';
```

| Rule | Detail | Source |
|---|---|---|
| Abort resolves tools as cancelled | `stop()` sets `pending`/`running` tool-call parts of the in-flight message to `'cancelled'`; an abort must never render as a failure | agent-execution §3.4 |
| `'pending'` is the approval gate | No `ApprovalPart`: approval is a pending tool call plus a host resolver | agent-execution §3.3 |
| `data-*` carries the product domains | plans `data-plan`, follow-ups `data-suggested-followups`, ratings `data-rating`; terminal/diff/preview ride `ArtifactKind` | agent-execution §3.1–3.7; transcript §3.5–3.6 |

A staged draft attachment is not a `Part` yet (no URL, removable, can fail), so core also
exports the pre-message model:

```ts
interface Attachment { id: string; mediaType: string; name: string; size?: number; previewUrl?: string
  status: 'uploading' | 'ready' | 'error'; progress?: number }        // progress: [adjusted] extrapolation
export function toFilePart(a: Attachment, url: string): FilePart;
```

### 3.2 Message and MessageNode

```ts
interface Message { id: string; role: Role; parts: Part[]; createdAt?: number
  aborted?: boolean                        // D5: partial output is kept, flagged
  usage?: Usage                            // inputTokens / outputTokens / costUsd
  metadata?: Record<string, unknown> }     // mode/model selection travels with the turn
interface MessageNode { message: Message; parentId: string | null; childIds: string[] }
```

Storage is `Record<string, MessageNode>` + `path: string[]`, never a nested tree, so a token
append is O(1) and never rebuilds ancestor chains (D6). Node identity is untouched when
another node changes (`chat.ts:344`), so adapters memoise per message.

### 3.3 The status machine

```
 idle ── send | regenerate | edit ──> submitted ──message-start──> streaming
   ^                                     │                            │  │
   │                                error event/throw           stop()│  │message-end
   │                                     v                            v  v
   └────── next command ────────── error (resting)      aborted (resting)  idle
```

| From | Event | To | Side effects |
|---|---|---|---|
| `idle`/`error`/`aborted` | `send(draft)` / `regenerate()` / `edit(id, text)` | `submitted` | user message appended (or forked sibling created, path truncated at the edit point); `ChatState.error` cleared; transport called; `regenerate` first pops the last assistant node from the path, leaving it in `nodes` as a sibling |
| `submitted` | first `message-start` | `streaming` | assistant message appended; `streamingId` set |
| `submitted`/`streaming` | transport throw or `error` event | `error` | `ChatState.error = {message, retryable}`; partial assistant message kept on the path |
| `streaming` | `message-end` | `idle` | `streamingId` cleared; `onFinish(message)` |
| `streaming` | `stop()` | `aborted` | signal aborted; message flagged `aborted`; in-flight tool calls `'cancelled'`; partial parts kept |
| `submitted` | `stop()` | `idle` | nothing was streaming yet; no-op that leaves rest |

`BUSY = {submitted, streaming}`; every command is a no-op outside it — the busy-rejection
rule and the double-fire guard (D4). `aborted` and `error` are **resting** statuses: the
transcript renders the terminal status line on the interrupted turn (Devin 81 "Stopped
working", "Devin went to sleep") and the composer is already back to send. See §10.2.

### 3.4 `ReadableStore` and store helpers

```ts
interface ReadableStore<T> { get(): T; subscribe(l: (v: T) => void): () => void }
interface WritableStore<T> extends ReadableStore<T> { set(v: T): void; update(fn: (t: T) => T): void }
export function createStore<T>(initial: T): WritableStore<T>;
export function batched<T>(store: WritableStore<T>): WritableStore<T>;      // one notice per microtask
export function derived<T,U>(src: ReadableStore<T>, select: (v: T) => U, equals?: (a: U, b: U) => boolean): ReadableStore<U>;
```

Contract: notification is synchronous from the writing stack (except through `batched`); a
`set` with an `Object.is`-equal value does not notify; a listener may unsubscribe during
notification; `derived` is the only projection mechanism. Adapters map this onto
`useSyncExternalStore` (React), runes (Svelte 5), `shallowRef` (Vue). `ChatController.state` is
the batched view, because a streaming turn emits many events per frame.

### 3.5 `ChatController` — full public API

```ts
interface ChatOptions { transport: ChatTransport; initialMessages?: Message[]; generateId?: () => string
  body?: Record<string, unknown>; headers?: Record<string, string>
  onFinish?: (m: Message) => void; onError?: (e: Error) => void }
interface ChatDraft { text?: string; attachments?: Part[]; mentions?: Mention[]
  body?: Record<string, unknown>           // this turn only, merged over ChatOptions.body
  metadata?: Record<string, unknown> }     // → Message.metadata
interface Mention { id: string; label: string; range: [number, number]; metadata?: Record<string, unknown> }

class ChatController {
  constructor(options: ChatOptions);
  readonly state: ReadableStore<ChatState>                    // batched
  get messages(): Message[]; get status(): ChatStatus; get busy(): boolean
  send(draft: string | ChatDraft): Promise<void>
  stop(): void                                                // idempotent, keeps partial output (D5)
  regenerate(): Promise<void>                                 // re-runs the last assistant turn as a sibling
  edit(messageId: string, text: string): Promise<void>
  selectBranch(messageId: string): void
  siblings(messageId: string): { ids: string[]; index: number; count: number }   // addition, §10.2
}
```

| Method | Semantics |
|---|---|
| `send` | No-op if `busy`; no-op if neither non-whitespace text nor attachments (contract rule 3 allows attachments-only sends); empty text parts are never appended; sets `submitted` before awaiting the transport |
| `stop` | Aborts the signal, abandons the loop, flags the streaming message `aborted`, sets in-flight tool calls `'cancelled'`, sets `aborted`; safe twice. Also the supported external-interrupt entry point — Cofounder 84's "Stop task" is a consumer button calling this, not a second composer button |
| `regenerate` | Requires an assistant message at the path end, else no-op; the old message stays a sibling so the branch switcher shows both attempts; also the retry path after `error` |
| `edit` | Requires a `user` message; forks a sibling, truncates the path at the edit point, runs; the original stays reachable (D6) |
| `selectBranch` | Walks to the root, then extends along first children to the branch end; pure state, never touches the transport |
| `siblings` | Insertion-ordered sibling ids including `messageId`, plus `index`/`count`; feeds `data-branch-index`/`data-branch-count`; `selectBranch(ids[i])` switches |

No `retry()` exists: `regenerate()` covers post-completion re-generation and error-retry
identically ("run again from the same parent", transcript §5).

### 3.6 Session model (D11)

Separate model, separate store, never inside `ChatState`.

```ts
interface SessionMeta {
  id: string; title: string                  // title is consumer-supplied, never derived
  updatedAt?: number; createdAt?: number     // epoch ms: relative time + consumer sorting
  status?: 'idle' | 'running' | 'awaiting-input' | 'error' | `data-${string}`
  statusLine?: string                        // Devin "PR is ready · ⎇1" — product-authored composite
  preview?: string                           // Manus: snippet of the agent's last message
  unread?: boolean; starred?: boolean        // the library never mutates either
  parentId?: string                          // project/workspace parent — a FILTER, never a group
  archivedAt?: number                        // timestamp, not boolean (Cofounder prints the date)
  metadata?: Record<string, unknown>         // owner, thumbnail, badges, branch counts
}
interface SessionGroup { id: string; label?: string; sessions: SessionMeta[] }          // input shape
interface SessionState { byId: Record<string, SessionMeta>
  groups: { id: string; label?: string; ids: string[] }[]; activeId?: string }           // store shape
interface SessionStore extends ReadableStore<SessionState> {
  get(id: string): SessionMeta | undefined
  upsert(meta: SessionMeta): void                            // keeps group order
  patch(id: string, patch: Partial<SessionMeta>): void       // touches one row
  remove(id: string): void
  setGroups(groups: SessionGroup[]): void                    // normalises, never sorts
  setActive(id: string | undefined): void }
export function createSessionStore(initial?: SessionGroup[]): SessionStore;
export function bucketByRecency(sessions: SessionMeta[], now: number): SessionGroup[];   // exported, never applied
```

Rejected fields (navigation §4.1): `thumbnailUrl` (an item slot), `owner`, `messageCount`,
`model`, `branchCount` (inside `statusLine`/`metadata`).

### 3.7 Transport protocol

```ts
interface SendRequest { messages: Message[]; body?: Record<string, unknown>; headers?: Record<string, string> }
type StreamEvent =
  | { type: 'message-start'; id: string; role: 'assistant' }
  | { type: 'part-start'; index: number; part: Part }
  | { type: 'part-delta'; index: number; delta: string }        // never resends the part
  | { type: 'part-end'; index: number; part?: Part }
  | { type: 'message-end'; finishReason: FinishReason; usage?: Usage }
  | { type: 'error'; error: { message: string; retryable?: boolean } };
interface ChatTransport { send(req: SendRequest, signal: AbortSignal): AsyncIterable<StreamEvent> }
```

Delta rules (`chat.ts:265`): `part-delta` appends to `text` for `text`/`reasoning`, to
`argsText` for `tool-call` (arguments are not valid JSON until complete), and is ignored by
every other part type; `part-end` replaces the part wholesale.

| Error category | Source | Core response | Consumer action |
|---|---|---|---|
| Transport | network, DNS, connection drop | `status='error'`, `ChatState.error` | `regenerate()` |
| HTTP 4xx/5xx | SSE transport throws before the first event | `status='error'`, `retryable: true` | fix request/backend |
| Stream | mid-stream `{type:'error'}` | `status='error'`, partial message kept | render `ErrorPart`, retry if retryable |
| Abort | `stop()` | `status='aborted'`, partial output kept, tools `'cancelled'` | resume via `edit()`/`send()` |

v1 ships `createSseTransport` only (reference and end-to-end fixture path); JSON-line and
WebSocket transports are documented recipes over the same interface. Tools are always
backend-resolved (ADR-T1) with a custom transport as escape hatch; the library holds no secrets
(ADR-T2); model selection rides `ChatDraft.body` (ADR-T3); core never queues (ADR-T5;
composer §5.5 — see §10.6).

### 3.8 Other core services

```ts
// Scroll pin: pure state; all measurement stays in the adapter (transcript §3.8).
export function createScrollPin(o?: { thresholdPx?: number }): {
  state: ReadableStore<{ pinned: boolean; atBottom: boolean }>
  measured(distanceFromEndPx: number): void           // adapter reports measurement
  gesture(kind: 'up' | 'down' | 'jump'): void         // upward wheel/touch/key scroll unpins
  pin(): void }                                       // jump-to-latest click

// Shared combobox contract (D12). @internal — adapters bind it, consumers do not.
export function createComboboxModel<I>(o?: { isDisabled?: (i: I) => boolean }): {
  state: ReadableStore<{ open: boolean; items: I[]; activeIndex: number; query: string }>
  setItems(i: I[]): void; setQuery(q: string): void; open(): void; close(): void
  move(delta: 1 | -1): void; setActive(i: number): void; accept(): I | undefined }

// Toast queue: core owns the queue, the adapter owns the region (platform §3.5).
export function createToastQueue(o?: { maxVisible?: number; defaultDuration?: number }): {
  state: ReadableStore<ToastState[]>; push(i: ToastInput): string
  dismiss(id: string): void; pauseAll(): void; resumeAll(): void }

// Save modes + dirty tracking: store logic, not component forks (platform §3.2).
export function createFormController<T>(o: { initial: T; mode?: 'explicit' | 'auto'
  validate?: (v: T) => Record<string, string> | undefined; commit: (v: T) => Promise<void>
  debounceMs?: number }): {
  state: ReadableStore<{ value: T; dirty: boolean; valid: boolean
    saveState: 'idle' | 'saving' | 'saved' | 'error'; errors?: Record<string, string> }>
  setValue(p: Partial<T>): void; save(): Promise<void>; reset(): void }

// Approvals: pending tool calls with batch resolution (agent-execution §3.3).
export function createApprovalsStore(): { state: ReadableStore<{ pending: string[] }>
  track(id: string): void; resolve(id: string): void; approveAll(): void; rejectAll(): void }
```

`createApprovalsStore` is what makes Cofounder's "Decide all / Decide this one" buildable
without the host correlating ids by hand. With no `onApprove`/`onReject` resolver,
`'pending'` renders as ordinary in-flight and nothing blocks.

### 3.9 Final core export list

Every type in §3.1–§3.7; `ChatController`, `ChatOptions`, `ChatDraft`, `Attachment`,
`toFilePart`; `createStore`, `batched`, `derived`, `WritableStore`, `ReadableStore`;
`createRendererRegistry`, `RendererRegistry`; `createSessionStore`, `SessionMeta`,
`SessionGroup`, `SessionState`, `SessionStore`, `bucketByRecency`; `createScrollPin`;
`createComboboxModel` (`@internal`); `createToastQueue`, `ToastInput`, `ToastState`;
`createFormController`; `createApprovalsStore`; `createSseTransport`, `SseTransportOptions`.

---

## 4. Adapter layer — component inventory

Every adapter ships the same names, props, attributes, and DOM shape: React props are shown;
Svelte uses props + events of the same names, Vue props + `emit`. Each root carries
`data-aicl="<kebab>"`; chat-surface primitives take explicit props and the adapter's
`useChat()`/`<ChatContext>` may supply them (explicit wins). Rules for **every** component:
no `className`/`class` prop; no width/placement/chrome ownership; never throw on an unknown
part (D2); streaming never re-creates the live region or a row; every interactive element is
always in the DOM, visibility is paint only.

### 4.1 `Transcript` — scroll container over the selected branch path

Owns stick-to-bottom, the stable live region, day separators, the empty slot, load-more.

```ts
interface TranscriptProps {
  state: ChatState; messages: Message[]; stickToBottom?: boolean          // default true, ~1 viewport
  renderScrollToBottom?: (a: { atBottom: boolean; scrollToBottom(): void }) => ReactNode
  groupByDay?: boolean; renderDaySeparator?: (day: Date) => ReactNode; renderEmpty?: () => ReactNode
  renderMessage?: (m: Message, i: number) => ReactNode; registry?: RendererRegistry<ComponentType<PartProps>>
  hasMore?: boolean; loadingMore?: boolean; onLoadMore?: () => void      // sentinel contract
  onAtBottomChange?: (atBottom: boolean) => void; ariaLabel?: string }    // default "Conversation"
```

**Attrs.** `data-aicl="transcript"`, `data-status="idle|submitted|streaming|aborted|error"`, `data-at-bottom`, `data-empty`, `data-loading-more`, `data-count`.
**A11y/keys.** `role="log"` + `aria-live="polite"` on a container **never** re-created per token (otherwise screen readers re-announce the whole conversation); `aria-relevant="additions"`; the default jump-to-latest is a real `button`; PageUp/PageDown/Home/End scroll; Enter/Space re-pins.
**States.** empty, submitted (pending row), streaming, aborted (terminal status row), error, loading-more. Separators render only at calendar-day boundaries, never above the first group.
**Implements.** transcript §2 (`scroll_to_bottom` 72, 4/4), §3.7, §3.8, §5; navigation §4.3 (sentinel + `data-loading-more`); D13.

### 4.2 `MessageItem` — one message row

Role/alignment, identity exposure, branch switcher, pending row, edit/retry, part rendering.

```ts
type Alignment = 'start' | 'end' | 'full';
type MessageAction = 'copy'|'thumbs-up'|'thumbs-down'|'retry'|'edit'|'share'|'branch'|'more';
interface MessageItemProps {
  message: Message; isStreaming?: boolean                                 // id === streamingId
  alignment?: Alignment                                                   // default: user 'end', assistant 'full'
  identity?: { name?: string; mode?: 'auto' | 'always' }                   // never painted by default
  renderIdentity?: (i: { name?: string; role: Role; changed: boolean }) => ReactNode
  branch?: { index: number; count: number; onSelect(index: number): void }
  actions?: MessageAction[]; onAction?: (a: MessageAction, m: Message) => void   // role-scoped defaults
  onEdit?: (text: string) => void; onRetry?: () => void                   // → controller.edit / .regenerate
  renderPending?: () => ReactNode                                         // default: ReasoningDisclosure shell
  registry?: RendererRegistry<ComponentType<PartProps>> }
```

**Attrs.** `data-aicl="message"`, `data-role`, `data-alignment`, `data-state="complete|streaming|aborted|error"`, `data-message-id`, `data-branch-index`, `data-branch-count`, `data-identity="painted|none"`, `data-part-count`.
**A11y/keys.** The row's accessible name includes role plus identity when supplied: identity is universal as data and rare as pixels (transcript §3.2), so it is always exposed structurally and painted only when `renderIdentity` is given **and** the speaker changed (`identityMode:'always'` is the Cofounder-style override). Branch attributes are emitted whenever siblings exist, painted or not. `Message.aborted` renders "Stopped working". Tab reaches actions and the switcher; ArrowLeft/Right move between siblings; Escape in inline edit reverts without submitting.
**States.** complete, streaming (pending row when `parts.length === 0`), aborted, error. No bubble geometry — alignment is data, `@aicl/styles` owns tint and radius.
**Implements.** transcript §3.1, §3.2, §3.4, §5; D6, D5.

### 4.3 `MessageActions` — per-message action row

Always in the DOM and keyboard reachable; visibility resolved from context.

```ts
interface MessageActionsProps {
  message: Message; actions?: MessageAction[]                             // role-scoped defaults
  visibility?: 'auto' | 'persistent' | 'hover'                            // default 'auto'
  feedback?: 'up' | 'down' | 'none'; onFeedback?: (v: 'up' | 'down' | 'none', m: Message) => void
  onAction?: (a: MessageAction, m: Message) => void; renderMore?: () => ReactNode
  timestamp?: number }                                                    // rendered inline (Devin 89)
```

**Attrs.** `data-aicl="message-actions"`, `data-visibility`, `data-resolved="painted|hidden"`, `data-feedback="up|down|none"`, `data-message-id`, `data-role`.
**A11y/keys.** Never `display:none` until hover: `'auto'` paints persistently on coarse pointers and on the last assistant message, and reveals on hover **or** `:focus-within` elsewhere (transcript §3.3 — hover-only reveal is disqualifying). Copy is implemented by the library for text/code content only; reasoning, tool, and error parts are excluded (contract rule 6). Thumbs are `aria-pressed` toggles; the rating prompt is not here. Roving tabindex within the row; Escape dismisses `more`.
**States.** idle, hover-revealed, focus-revealed, feedback-selected, copied.
**Implements.** transcript §2, §3.3, §3.5, §5.

### 4.4 `PartRenderer` and the registry

Registry dispatch from `Part.type` to a component, never a `switch` (D2).

```ts
interface PartProps<P extends Part = Part> { part: P; message: Message; index: number; streaming: boolean }
interface PartRendererProps extends Omit<PartProps, 'part'> { part: Part; registry?: RendererRegistry<ComponentType<PartProps>> }
export function createPartRegistry(initial?: Partial<Record<string, ComponentType<PartProps>>>,
  fallback?: ComponentType<PartProps>): RendererRegistry<ComponentType<PartProps>>;
export function defaultRegistry(): RendererRegistry<ComponentType<PartProps>>;
```

**Attrs.** `data-aicl="part"`, `data-part="<part.type>"`, `data-index`.
**A11y/keys.** No role of its own; the transcript's log region owns announcement. Unknown types resolve to the fallback renderer, including a `'data-'` wildcard entry covering a whole family (`registry.ts`); a server adding a part type must not white-screen an older client.
**States.** n/a (dispatch). **Default registry.** `text`→`TextPart`; `reasoning`→`ReasoningDisclosure`; `tool-call`→`ToolCallDisclosure` (folds the matching `tool-result` by `toolCallId`); `tool-result`→folded when its call precedes it in the message, else `ToolResultView`; `file`→`FileChip`; `artifact`→`ArtifactCard` (`kind:'terminal'` opens `TerminalOutput`); `error`→`ErrorNotice`; `data-suggested-followups`→`SuggestionRows`; `citation`→*not registered*, falls to the fallback (transcript §5 ships no citation UI in v1); everything else→`UnknownPart`.
**Implements.** D1, D2, transcript §2/§5, agent-execution §3.2.

### 4.5 Default leaf renderers

**`TextPart`** — default body; markdown is pluggable, no parser ships (`ARCHITECTURE.md` non-goal; transcript §2 markdown_rich 70, 4/4). `interface TextPartProps extends PartProps<TextPart> { renderMarkdown?: (text: string, api: PartProps<TextPart>) => ReactNode; renderCode?: (code: { language?: string; content: string; inline: boolean }) => ReactNode }` → `data-part="text"`. No role. States: streaming (in-place growth), complete.
**`CodeBlock`** — the distinct code surface with the copy affordance that is table stakes but unobservable in stills (159 screens, 0 copy labels; transcript §2, §5). `interface CodeBlockProps { content: string; language?: string; inline?: boolean; collapsedLines?: number; copyable?: boolean; onCopied?: (c: string) => void }` → `data-aicl="code-block"`, `data-language`, `data-collapsed`, `data-copied`, `data-inline`. `figure`+`figcaption` naming the language; copy is a `button` confirming through a polite live region and follows §4.3's visibility rule; expand on Enter/Space. States: default, copied, truncated, expanded.
**`ToolResultView`** — standalone result when the call is not in the same message (out-of-order or truncated streams; agent-execution §3.2). `interface ToolResultViewProps extends PartProps<ToolResultPart> { renderBody?: (r: unknown) => ReactNode }` → `data-part="tool-result"`, `data-is-error`. A `region` labelled with the tool id, no interactive role. States: result, error.
**`FileChip`** — role-agnostic file/image part (transcript §2: `image_attachment` 40, 4/4). `interface FileChipProps extends PartProps<FilePart> { onRemove?: (p: FilePart) => void; onOpen?: (p: FilePart) => void }` → `data-part="file"`, `data-media-type`, `data-role`, `data-state="uploaded|uploading|error"`, `data-progress="0..100"`. Image chips are `role="img"` labelled with the file name, others a link/button to `url`; Enter opens, Delete removes when `onRemove` is supplied.
**`ErrorNotice`** — renders an `ErrorPart` (agent-execution §2 `error_banner` 24, 4/4; ADR-T4). `interface ErrorNoticeProps extends PartProps<ErrorPart> { onRetry?: () => void; renderDetail?: (p: ErrorPart) => ReactNode }` → `data-part="error"`, `data-retryable`, `data-code`. `role="alert"` while streaming, `role="status"` once the turn ended; retry is a `button`. States: message-only, message+retry, expanded detail.
**`UnknownPart`** — D2's fallback. `interface UnknownPartProps extends PartProps { renderUnknown?: (p: Part) => ReactNode }` → `data-part="unknown"`, `data-raw-type="<part.type>"`. Exposes the raw type as text so a misconfigured registry is diagnosable in production; never throws.

### 4.6 `ReasoningDisclosure` — collapsed reasoning row that doubles as the pending indicator

```ts
interface ReasoningDisclosureProps extends PartProps<ReasoningPart> {
  defaultOpen?: boolean                                     // default false
  label?: string                                            // Cofounder-style semantic summary
  renderLabel?: (a: { durationMs?: number; startedAt?: number; isStreaming: boolean; text: string }) => ReactNode }
```

**Attrs.** `data-part="reasoning"`, `data-collapsed`, `data-streaming`, `data-duration-ms`, `data-state="streaming|complete"`.
**A11y/keys.** Native disclosure (`button[aria-expanded]` + region), never a clickable div. The ticking element is `aria-live="off"` and completion is announced once — a deliberate divergence from Manus's per-second counter (agent-execution §3.6, accessibility veto). Excluded from copy. Enter/Space toggles.
**States.** pending (streaming message with no visible output parts), streaming, complete with `durationMs` ("Thought for Ns"), complete without it ("Thought").
**Implements.** transcript §3.4 (this row *is* the typing indicator; no separate primitive), §5; agent-execution §3.6.

### 4.7 `ToolCallDisclosure` — one tool invocation plus its result

Summary row, details region, grouping for consecutive calls, approval rendering when `pending`.

```ts
interface ToolCallDisclosureProps {
  toolCall: ToolCallPart; result?: ToolResultPart           // joined by toolCallId
  calls?: ToolCallPart[]; defaultOpen?: boolean              // group rollup; default false
  summary?: string                                           // Lovable-style "2 edits made"
  renderSummary?: (a: { calls: ToolCallPart[]; status: ToolStatus; count: number }) => ReactNode
  renderBody?: (a: { call: ToolCallPart; result?: ToolResultPart }) => ReactNode
  renderApproval?: (a: { call: ToolCallPart; approve(): void; reject(): void }) => ReactNode
  onApprove?: (id: string) => void; onReject?: (id: string) => void; onRetry?: (id: string) => void }
```

**Attrs.** `data-part="tool-call"`, `data-status="pending|running|success|error|cancelled"`, `data-open`, `data-count`, `data-approval`, `data-force-open`.
**A11y/keys.** Summary is a `button[aria-expanded]` + `aria-controls` region; a group of N calls is one disclosure with one tab stop. Enter/Space toggles; with a resolver supplied, approve→reject tab order is fixed and never moves on status change.
**States.** `pending` (force-open with a resolver, else in-flight shimmer using `argsText`), `running`, `success` (collapsed), `error` (**force-open** — no product shows recovery from a silently collapsed failure), `cancelled` (neutral, not an error). `defaultOpen:true` reproduces Manus 155's expanded step cards.
**Implements.** agent-execution §3.1, §3.2, §3.3, §3.4; transcript §3.4.

### 4.8 `ArtifactCard` — in-transcript artifact entry point

Title, kind, version, open. Covers the observed cards (Lovable 32 "Previewing latest
version", Manus 57/84/160) without owning the surface (D14).

```ts
interface ArtifactCardProps { part: ArtifactPart; open?: boolean        // 'terminal' renders inline
  renderPreview?: (a: { part: ArtifactPart }) => ReactNode; onOpen?: (p: ArtifactPart) => void }
```

**Attrs.** `data-part="artifact"`, `data-artifact-kind`, `data-artifact-version`, `data-open`, `data-artifact-id`.
**A11y/keys.** An `article` with a named heading; the open control's label includes kind and version ("Open terminal artifact, version 3"). Enter opens; the consumer's surface takes focus — this primitive never moves focus.
**States.** card, card-with-preview, open-inline (terminal), artifact-missing.
**Implements.** transcript §5 (0 labels, plainly visible cards), agent-execution §3.7, D14.

### 4.9 `TerminalOutput` — the only artifact body in v1

Append-only buffering, user-breakable tail-follow, bounded line count.

```ts
interface TerminalOutputProps { lines: string[]; streaming?: boolean; followOutput?: boolean   // default true
  maxLines?: number                                                        // ring buffer, default 5000
  onExit?: (code: number) => void; renderLine?: (line: string, i: number) => ReactNode }
```

**Attrs.** `data-aicl="terminal-output"`, `data-streaming`, `data-following`, `data-truncated`, `data-line-count`.
**A11y/keys.** `role="log"` with `aria-live="off"` while static (a streaming terminal is not a live region by default; hosts may opt in for short runs). PageUp/PageDown/Home/End scroll; the resume-follow control (Devin 81's "• Live" state) is a tab-reachable button while `data-following="false"`; `createScrollPin` drives the state.
**States.** static, streaming-following, streaming-broken (user scrolled up), truncated, exited.
**Implements.** agent-execution §3.7 (append-only, `data-following`, bounded cap; placement host-owned so it behaves in a pane or inline), D14.

### 4.10 `SuggestionRows` — default rendering of a `data-suggested-followups` part

Rendered in-transcript after the last assistant message.

```ts
interface SuggestionRowsProps {
  part: DataPart & { data: { suggestions: { id: string; label: string; prompt?: string }[] } }
  behavior?: 'insert' | 'send'                                             // default 'insert'
  onSelect?: (s: { id: string; label: string; prompt?: string }) => void }
```

**Attrs.** `data-part="data-suggested-followups"`, `data-count`, `data-behavior`.
**A11y/keys.** A list of buttons under a heading supplied by the part or the consumer; DOM order matches reading order (in-transcript rows are the observed majority — Manus OCR "Suggested follow" 54 screens); row buttons are tab-reachable.
**States.** list, single row, empty (renders nothing).
**Implements.** transcript §3.6; composer C7 (`'insert'` default because it is recoverable).

### 4.11 `Composer` (+ parts) — field, submit action, toolbar slots, above-band

One component for all three placements, owning keyboard semantics, IME safety, autosize, and
the send/stop affordance.

```ts
interface ComposerProps {
  value?: string; defaultValue?: string; onChange?: (v: string) => void
  placeholder?: string                                                     // per placement; never the a11y name
  status: ChatStatus                                                       // drives data-state + send/stop (D4)
  placement?: 'docked' | 'hero' | 'rail'                                   // default 'docked'; styling hook only
  maxRows?: number                                                         // default 10, then internal scroll
  submitOnEnter?: boolean                                                  // default true; false ⇒ Cmd/Ctrl+Enter
  attachments?: Attachment[]; disabledReason?: string                      // disables SEND only, never the field
  error?: string                                                           // rendered into Composer.Above, live region
  onSubmit: (draft: Draft) => void                                         // never fires during IME composition
  onStop?: () => void                                                      // the single send/stop button calls this
  onRemoveAttachment?: (id: string) => void; onRetryAttachment?: (id: string) => void; children?: ReactNode }
interface Draft { text: string; attachments: Attachment[]; mentions?: Mention[]
  metadata?: Record<string, unknown> }                                      // mode/model/tool selections travel with the turn
```

Parts: `.Root`, `.Above`, `.Input`, `.Toolbar`, `.LeadingSlot`, `.TrailingSlot`, `.AttachButton`
(pinned first in leading), `.SendButton` (pinned last in trailing). `Composer.Above` is **one**
slot between transcript and card; the corpus docks four different payloads there and no two
products agree, so the library supplies the region and the consumer the payload (composer C2).

**Attrs.** root `data-aicl="composer"`, `data-state="ready|submitted|streaming|error"`, `data-placement`, `data-has-text`, `data-has-attachments`, `data-disabled`, `data-disabled-reason`; `.Above` `data-aicl="composer-above"`; `.Input` `data-aicl="composer-input"`, `data-composing`; `.Toolbar` `data-aicl="composer-toolbar"`, `data-leading`, `data-trailing`; send `data-aicl="composer-action"`, `data-role="send|stop"`, `data-can-submit`; attach `data-aicl="composer-attach"`.
**Status mapping.** `idle`→`data-state="ready"`, send, editable. `submitted`→`submitted`, stop, editable. `streaming`→`streaming`, stop, editable. `aborted`→`ready`, send, editable. `error`→`error`, send (retry through `ErrorNotice`), editable.
**A11y/keys.** Field is `role="textbox" aria-multiline="true"`; an `aria-label` or visually-hidden `<label>` is required and the placeholder never is (C5); `disabledReason` reaches the field via `aria-describedby` plus the root attribute; the field is **never** disabled by streaming (C8, agent-execution §3.4). `Composer.SendButton` is **one** DOM node whose label and `data-role` swap — two conditionally rendered buttons destroy focus at the idle→streaming boundary (C3). Enter submits, Shift+Enter newlines, checked against both `event.isComposing` and the composition-event ref (IME safety); with `submitOnEnter:false`, Cmd/Ctrl+Enter submits. Escape closes an open trigger menu and never clears the field. `canSubmit = (text.trim() || attachments.length) && status !== 'submitted' && !disabledReason` — attachments-only sends are allowed (contract rule 3).
**States.** ready-empty, ready-filled, attachments-only, submitted, streaming, error-banner-in-Above, disabled-send-with-reason, uploading-attachment.
**Implements.** composer C1–C8, §2, §5.1–5.8; agent-execution §3.4; D4.

### 4.12 Composer surface primitives

```ts
// TriggerMenu + presets: one combobox, two grammars (composer C6; owns D12's shared contract)
interface TriggerMenuProps<I> { trigger: '/' | '@' | string; items: I[]; isOpen?: boolean
  getLabel: (i: I) => string; getKey: (i: I) => string; isDisabled?: (i: I) => boolean
  emptyLabel?: string; renderItem?: (i: I, s: { active: boolean }) => ReactNode
  onQueryChange?: (q: string) => void; onClose?: () => void
  onSelect: (i: I, a: { insertText: string; mentioned?: Mention }) => void }
export const SlashMenu: typeof TriggerMenu       // '/' → inserts verbatim text
export const MentionMenu: typeof TriggerMenu     // '@' → inserts text + a structured Mention

// Optional chips for Composer.Above; never inside the field (composer C7; transcript §3.6)
interface SuggestionChipsProps { suggestions: { id: string; label: string; prompt?: string }[]
  behavior?: 'insert' | 'send'                                            // default 'insert'
  onSelect: (s: { id: string; label: string; prompt?: string }, b: 'insert' | 'send') => void }

// File intake: drag, paste, picker (composer §2: file_upload 62, image_paste 29, both 4/4)
interface AttachmentDropzoneProps { onFiles: (files: unknown[], origin: 'drop'|'paste'|'picker') => void
  accept?: string; multiple?: boolean; maxSizeBytes?: number; disabled?: boolean
  onReject?: (reason: 'type'|'size'|'count', files: unknown[]) => void; children: ReactNode }

// One staged attachment with progress, remove, retry (composer §2 attachment_preview 52, 4/4)
interface AttachmentChipProps { attachment: Attachment; onRemove?: (id: string) => void; onRetry?: (id: string) => void }
```

**Attrs.** `data-aicl="trigger-menu"`, `data-trigger`, `data-state="open|closed"`, `data-count`, popup `role="listbox"` with options `role="option"` + `aria-selected` + `data-active`; `data-aicl="suggestion-chips"`, `data-count`, `data-behavior`; `data-aicl="attachment-dropzone"`, `data-dragover`, `data-reject="none|type|size|count"`; `data-aicl="attachment-chip"`, `data-status="uploading|ready|error"`, `data-progress`, `data-media-type`.
**A11y/keys.** TriggerMenu: focus stays in the input, `role="combobox"` with `aria-expanded`/`aria-controls`/`aria-activedescendant`, not a dialog and no focus trap; ArrowUp/Down wrap, Enter/Tab accept, Escape closes without clearing the field, the trigger fires only at a word boundary — no observed menu exists in the corpus, so this is `[extrapolation]` (C6). Chips: labelled horizontal list, Left/Right move, Enter/Space selects, never announced as part of the last message. Dropzone: `Composer.AttachButton` is the keyboard path, so it is never the only route. Chip: remove is a labelled button; progress is `role="progressbar"` with `aria-valuenow`.
**States.** TriggerMenu: closed, open-no-results, open-filtering, disabled item, accepted. Chips: list, single, empty. Dropzone: idle, dragover, rejecting, disabled. Chip: uploading, ready, error, image preview.
**Implements.** composer C2, C4, C6, C7, §2, §5.3 (progress is an `[adjusted]` extrapolation — the Manus "4/4" chips are task progress), §5.6, §5.8.

### 4.13 `PlanChecklist` — render-only ordered plan with a derived rollup

Standalone-capable and embed-able.

```ts
interface PlanStep { id: string; label: string; status: 'pending' | 'running' | 'done' | 'failed' }
interface PlanChecklistProps { steps: PlanStep[]                            // items, not a message
  rollup?: { completed: number; total: number; current?: string }            // derived when omitted
  title?: string; live?: boolean; renderStep?: (s: PlanStep, a: { index: number }) => ReactNode }
```

**Attrs.** `data-aicl="plan-checklist"`, `data-completed`, `data-total`, `data-current-step`, `data-progress="<n>/<m>"`, `data-live`; per step `data-step-status`, `data-step-index`.
**A11y/keys.** An `ol`/`li`; the rollup region is `aria-live="polite"` so step transitions announce without announcing every token; no `aria-live` per item. No interactive affordance in v1 — render-only, no edit, reorder, or approval gate.
**States.** tracking (mixed), complete, failed step, empty.
**Implements.** agent-execution §2, §3.1, §3.5 (`{completed,total,current}` as data, no bar and no cost meter); D9.

### 4.14 `SessionList` — host-agnostic session listbox

Grouping, active tracking, keyboard navigation, load-more sentinel. No width, placement, chrome.

```ts
interface SessionListProps {
  groups: { id: string; label?: string; ids: string[] }[]; byId: Record<string, SessionMeta>
  activeId?: string; onActiveChange?: (id: string) => void; onSelect?: (id: string) => void
  renderItem?: (m: SessionMeta, a: { active: boolean; index: number }) => ReactNode
  header?: ReactNode                                                       // pinned OUTSIDE the scroll container
  empty?: ReactNode; loading?: boolean                                     // skeleton rows, never a spinner
  hasMore?: boolean; loadingMore?: boolean; onLoadMore?: () => void
  formatTime?: (ts: number, ctx: { inDateGroup: boolean }) => string; ariaLabel?: string }
```

**Attrs.** `data-aicl="session-list"`, `data-empty`, `data-loading`, `data-loading-more`, `data-count`; the header is `data-pinned`; groups are `role="group"` + `aria-label`; exactly one row carries `data-active`.
**A11y/keys.** `role="listbox"` with `aria-activedescendant` while focus stays on the container (or roving tabindex — never both). A creation control must be a `button` **outside** the listbox; an action inside the list is an `option` with `data-kind="action"` so traversal stays coherent (navigation §3.6). ArrowUp/Down move the active row, Home/End jump, Enter selects; no typeahead.
**States.** populated, empty (`data-empty` + slot), loading (skeleton rows; `skeleton_loader` 85, 3/4), loading-more (sentinel + `data-loading-more`).
**Implements.** navigation §2, §3.1, §3.5, §3.6, §4.2, §4.3; D11; D13.

### 4.15 `SessionListItem` — one row

Title, one resolved secondary line, state attributes, overflow actions.

```ts
interface SessionListItemProps { meta: SessionMeta; active?: boolean; secondary?: ReactNode   // slot overrides
  actions?: string[]; onAction?: (action: string, meta: SessionMeta) => void                   // contents are the consumer's
  formatTime?: (ts: number, ctx: { inDateGroup: boolean }) => string }
```

**Attrs.** `data-aicl="session-item"`, `data-status`, `data-secondary="status|preview|time|none"`, `data-unread`, `data-starred`, `data-active`, `data-session-id`, `data-kind="session|action"`.
**A11y/keys.** `role="option"` + `aria-selected`; the resolved secondary line joins the option's accessible description so live state is announced, not just the title; the title truncates visually while the full text stays in the a11y tree. Per-row actions are always in the DOM and reveal on hover **or** `:focus-within` (transcript §3.3's rule applied); Escape closes the overflow menu.
**States.** idle, running/awaiting-input/error via `status`, unread, starred, archived, active. **Secondary resolution.** `statusLine` when `status !== 'idle'` → `preview` → relative time from `updatedAt` → nothing.
**Implements.** navigation §2, §3.2, §3.3, §3.4, §4.1.

### 4.16 `SessionSearch` — one incremental combobox for sessions

Inline or inside a dialog; also the vehicle for the Cmd-K recipe (D12).

```ts
interface SessionSearchProps { value: string; onChange: (q: string) => void
  groups: { id: string; label?: string; ids: string[] }[]; byId: Record<string, SessionMeta>   // consumer-filtered
  variant?: 'inline' | 'modal'; activeId?: string; loading?: boolean; empty?: ReactNode
  onActiveChange?: (id: string) => void; onSelect?: (id: string) => void; onClose?: () => void; placeholder?: string }
```

**Attrs.** `data-aicl="session-search"`, `data-variant="inline|modal"`, `data-state="open|closed"`, `data-count`, `data-empty`, `data-loading`.
**A11y/keys.** `role="combobox"` with `aria-expanded`/`aria-controls`/`aria-activedescendant`; focus stays in the input in both variants, and the modal variant uses `Dialog`'s trap and returns focus on close. Incremental only — no submit affordance anywhere, and an empty query renders whatever `results` holds, which is how both observed overlays show recents. ArrowUp/Down, Enter activates the active option, Escape closes the top layer only; debouncing is the consumer's. Result counts are announced politely (`[extrapolation]`, navigation §6).
**States.** empty-query recents, filtering, no-results, loading, modal-open.
**Implements.** navigation §3.4, §4.2, §6; D12.

### 4.17 `SidebarNav` — vertical nav host with controlled collapse

Identical DOM in both states; no rail CSS, no persistence.

```ts
interface SidebarNavProps {
  items: { id: string; label: string; icon?: ReactNode; href?: string; active?: boolean; badge?: ReactNode }[]
  collapsed?: boolean; defaultCollapsed?: boolean; onCollapsedChange?: (c: boolean) => void
  renderItem?: (i: SidebarNavItem, a: { collapsed: boolean; active: boolean }) => ReactNode
  header?: ReactNode; footer?: ReactNode; ariaLabel?: string }
```

**Attrs.** `data-aicl="sidebar-nav"`, `data-state="expanded|collapsed"`, `data-count`; items `data-collapsed`, `data-active`, `data-nav-id`.
**A11y/keys.** The toggle is a `button` with `aria-expanded` + `aria-controls`; every item keeps its accessible name when collapsed — tooltips are not accessible names, and demoting labels to `title` is an accessibility regression (navigation §3.8). Tab traverses items; any number of consumer triggers may drive the state.
**States.** expanded, collapsed, item active, item with badge, empty.
**Implements.** navigation §3.8, §6 (`sidebar_nav` 315, 4/4).

### 4.18 Overlays: `Dialog`, `AlertDialog`, `Drawer`

```ts
type DismissReason = 'escape' | 'scrim' | 'close-button' | 'programmatic';
interface DialogProps { open: boolean; onOpenChange: (open: boolean, reason: DismissReason) => void
  size?: 'sm' | 'md' | 'lg'                                                 // lg ≈ 85% viewport, internal scrolling
  dismissOnEscape?: boolean; dismissOnScrimClick?: boolean                   // both default true
  initialFocus?: 'first' | 'container' | unknown; returnFocus?: boolean       // default true
  dirty?: boolean; onDismissRequest?: (reason: DismissReason) => boolean | void }  // false vetoes
// Parts: Dialog.Trigger, .Scrim, .Content, .Title, .Description, .Close
interface AlertDialogProps extends Omit<DialogProps, 'dismissOnScrimClick' | 'size'> {
  variant: 'danger' | 'warning'; consequence: string                          // required content
  confirmationValue?: string; confirmLabel?: string                           // opt-in typed confirmation
  confirmStatus?: 'idle' | 'loading' | 'done'; onConfirm: () => void }
interface DrawerProps extends DialogProps { side: 'left' | 'right' | 'bottom'; swipeToDismiss?: boolean }
```

**Attrs.** `data-aicl="dialog"`, `data-state="open|closed"`, `data-modal`, `data-size`, `data-dirty`, `data-save-state`; `data-aicl="alert-dialog"`, `data-variant`, `data-confirm-enabled`, `data-state="idle|confirming|done"`; `data-aicl="drawer"`, `data-side`, `data-size`, `data-state="open|closed|dragging"`.
**A11y/keys.** `role="dialog"` + `aria-modal` + `aria-labelledby`/`aria-describedby`; focus trapped per layer, Escape and dismissal affect the top layer only, focus returns to the trigger, background inert + `aria-hidden`. AlertDialog: no scrim dismissal (every observed destructive confirm forces Cancel/Delete), initial focus on Cancel, confirm enters `loading` on commit, the consequence string wires the description, and `confirmationValue` keeps confirm disabled until it matches (typed confirmation is 2/4, so opt-in). Drawer: same contract, plus swipe.
**States.** Dialog: open, closed, dirty (every dismiss path fires `onDismissRequest`), saving, stacked. AlertDialog: idle, confirm-incomplete, confirming, done. Drawer: closed, open, dragging.
**Implements.** platform §2, §3.1 (`lg` must reach ~85% viewport — two of four products put the whole settings surface in a dialog), §3.3, §3.4 (Drawer is `[extrapolation]`: all 7 `drawer` labels are persistent rails; a mobile capture round showing full-screen routes would falsify it), §3.6, §5.

### 4.19 `ToastRegion` + `Toast` — transient status in a corner region

Driven by `createToastQueue`.

```ts
interface ToastRegionProps { placement?: 'bottom-end'|'bottom-start'|'top-center'|'top-start'   // default bottom-end
  maxVisible?: number                                                       // default 3, FIFO overflow
  children?: (t: ToastState, a: { dismiss(): void; action?(): void }) => ReactNode }
interface ToastProps { toast: ToastState; renderAction?: (t: ToastState) => ReactNode }
```

**Attrs.** region `data-aicl="toast-region"`, `data-placement`, `data-count`; toast `data-aicl="toast"`, `data-variant="info|success|error"`, `data-state="entering|open|leaving|paused"`, `data-has-action`.
**A11y/keys.** `info`/`success` → `role="status"` (polite); `error` with an action → `role="alert"` (assertive) and persistent until dismissed; auto-dismiss pauses on hover/focus; Escape dismisses the focused toast; the action is tab-reachable.
**States.** entering, open, leaving, paused, action-persistent.
**Implements.** platform §3.5 (toasts are 4/4 by OCR — ≥113 toast-shaped blocks — despite 6 labels, all false positives; observed concurrency is 1, so `maxVisible: 3` is `[extrapolation]` headroom), §5. Save acknowledgements are mandatory, not optional.

### 4.20 Form controls: `Field`, `Switch`, `Select`, `SegmentedControl`

```ts
interface FieldProps { label: string; description?: string; error?: string; required?: boolean
  saveMode?: 'explicit' | 'auto'                                            // explicit is the composite-form default
  saveState?: 'idle' | 'saving' | 'saved' | 'error'; dirty?: boolean; children: ReactNode }
interface SwitchProps { checked: boolean; onCheckedChange: (c: boolean) => void; disabled?: boolean
  label?: string; status?: 'idle' | 'saving' | 'error' }                    // optimistic toggle + rollback
interface SelectProps<T> { value: T | undefined
  options: { value: T; label: string; disabled?: boolean; description?: string }[]
  onValueChange: (v: T) => void; placeholder?: string; size?: 'sm' | 'md'; saveMode?: 'explicit' | 'auto' }
interface SegmentedControlProps<T> { value: T; options: { value: T; label: string; icon?: ReactNode }[]
  onValueChange: (v: T) => void; ariaLabel: string }
```

**Attrs.** `data-aicl="field"`, `data-dirty`, `data-invalid`, `data-save-state`, `data-save-mode`; `data-aicl="switch"`, `data-state="checked|unchecked"`, `data-save-state`; `data-aicl="select"`, `data-state="open|closed"`, `data-size`, `data-value`; `data-aicl="segmented"`, `data-value`, `data-save-state`.
**A11y/keys.** Field wires `aria-describedby` to description + error ids and `aria-invalid` from `error`; the save state is announced through the field's live region (acknowledgement is mandatory for auto-save). Switch: `role="switch"` + `aria-checked`, Space/Enter toggles, commits in `onCheckedChange` and never on blur. Select: combobox/listbox with typeahead, `aria-expanded`, `aria-activedescendant`; ArrowUp/Down, Enter commits, Escape closes — this is the primitive the workspace-switcher recipe composes, so the active-first/`aria-checked` ordering is consumer-set (navigation §3.7). SegmentedControl: `role="radiogroup"` + `aria-label`, items `role="radio"` + `aria-checked`, roving tabindex, arrows move **and** select (APG radio behaviour), Home/End jump.
**States.** Field: default, dirty, invalid, saving, saved, error-with-rollback. Switch: checked, unchecked, disabled, saving, error (rolled back). Select: closed, open, filtering, disabled option, empty, saving. Segmented: selected, disabled, saving.
**Implements.** platform §2, §3.2 (instant controls auto-save in 4/4; composite text forms default to explicit commit; `saveMode="auto"` is the documented Lovable deviation), Caveat 4 (`segmented_control` has 0 labels but is observed at Cofounder 349), §5.

---

## 5. `@aicl/styles` — the token contract

Optional, dependency-free, CSS only: usable out of the box without being hard to replace (D7).

**The rule.** `data-*` attributes are the entire styling surface. No class names shipped or
accepted, no CSS-in-JS, no visual inline styles written by a primitive (adapter-side
measurement — a textarea height — sets no visual property). Every state in §4 is reachable
from a selector. A consumer without `@aicl/styles` gets correct behaviour and semantics with
default browser paint.
**Files.** `tokens.css` (variables only), `components.css` (attribute-selector rules),
`reset.css` (focus-visible and reduced-motion guards), `index.css` (imports the three).

| Group | Tokens |
|---|---|
| Type | `--aicl-font-sans`, `--aicl-font-mono`, `--aicl-text-xs/sm/md/lg`, `--aicl-leading`, `--aicl-weight-normal/medium/bold` |
| Color | `--aicl-bg`, `--aicl-surface`, `--aicl-surface-raised`, `--aicl-text`, `--aicl-text-muted`, `--aicl-border`, `--aicl-accent`, `--aicl-accent-text`, `--aicl-danger`, `--aicl-success`, `--aicl-warning`, `--aicl-tint-user` |
| Space / shape | `--aicl-space-1`…`--aicl-space-6`, `--aicl-transcript-gap`, `--aicl-composer-max-width`, `--aicl-radius-sm/md/lg/full` |
| Elevation | `--aicl-shadow-sm`, `--aicl-shadow-md`, `--aicl-scrim` |
| Focus | `--aicl-focus-ring-width`, `--aicl-focus-ring-color`, `--aicl-focus-ring-offset` |
| Motion | `--aicl-duration-fast`, `--aicl-duration-base`, `--aicl-ease` |

Every token has a fallback, so partial themes work. Dark mode via
`@media (prefers-color-scheme: dark)` plus an explicit `[data-aicl-theme="dark|light"]`
override on any ancestor; reduced motion disables streaming and enter transitions. Focus rings
are always defined and never removed.
**Coverage rule.** `components.css` selects only on `[data-aicl=…]` plus the state attributes
published in §4 and the tokens: never a bare element tag, never `!important`, never a rule that
makes a required control unreachable (the `visibility:'auto'` rule in §4.3 is
`opacity`/`visibility`, never `display:none`).

---

## 6. Recipes (documented examples, not shipped components)

Each lives at `docs/recipes/<name>.md` and composes only primitives from §2.2.

**Cmd-K palette.** Bind `Cmd/Ctrl+K` in the app shell, open `Dialog` at `md`, render
`SessionSearch` with `variant="modal"` inside it, and pass an actions group as the first
`groups` entry with `data-kind="action"` on its row — exactly how Manus 165 mixes an action row
with date-grouped results; an empty query renders recents, as both observed overlays do.
Selecting a session closes the dialog and routes; selecting an action runs a callback. No new
primitive and no second keyboard model (D12).
**Workspace switcher.** A `Select` (or a `Dialog`-hosted menu) whose options are workspaces,
active entry first and `aria-checked`, an optional "Create new workspace" row last, with plan
and credit strings rendered as option descriptions. Everything Lovable 245 shows is
expressible; the payload is billing IA and stays app-level (navigation §3.7).
**Workspace home.** A page layout: hero `Composer` (`placement="hero"`) with both toolbar slots
filled by consumer controls, `Composer.Above` holding `SuggestionChips`, a "Recently viewed"
`SessionList`, and the template gallery below. Creation starts by submitting from the hero
composer — no creation button is needed (Lovable 18; navigation §3.6).
**Template gallery.** A card grid (no primitive) whose cards open a preview `Dialog`; selecting
a template submits its prompt through the normal `send()` path, so the transcript stays the
single source of truth. 10 frames, 2/4 (platform §4).
**Breadcrumbs.** A plain `<nav><ol>` with `aria-label="Breadcrumb"` and `aria-current="page"`
on the trailing crumb. No primitive: 26 frames, 3/4, no behaviour beyond markup
(navigation §4.2).
**Tab bar.** Consumer markup; no tab primitive ships because 30 of the 40 `tab_bar` frames are
Devin automation editors and no product switches sessions with tabs (navigation §1).
Recommended semantics: `role="tablist"`.
**Settings page.** Two documented shapes over the same primitives: `SettingsRoute` (route
layout, sub-nav built from `SidebarNav` items) and `SettingsDialog` (`Dialog size="lg"`, ~85%
viewport, internal scrolling, sub-nav inside). Both build forms from `Field` +
`Switch`/`Select`/`SegmentedControl`, instant controls in `saveMode="auto"` acknowledged by a
`ToastRegion` toast, composite text forms in the default explicit mode with the `Dialog`
dirty-guard. Settings search, secrets forms, plan cards, and integrations stay recipes (D10;
platform §3.1, §3.2, §4).

Also documented: **rating prompt** (a `data-rating` registry renderer with comment + consent
slots), **artifact pane / preview frame / diff viewer** (D14 — consumer surfaces over
`ArtifactCard`), **approval decision card** (`ToolCallDisclosure.renderApproval` +
`createApprovalsStore`), **confirm-delete** (`AlertDialog` with `confirmationValue`),
**bulk-select management view** (checkbox column from `SessionListItem`'s slot), **windowing
wrapper** (D13), **mobile drawer nav** (`Drawer` + `SidebarNav` at `collapsed`).

---

## 7. New decisions, ready to append to `DECISIONS.md`

### D12 — No `CommandPalette` primitive; one combobox contract, Cmd-K as a recipe

**Decision.** v1 ships no command-palette component. The listbox contract shared by
`SlashMenu`, `MentionMenu`, and `SessionSearch` is factored into one internal combobox
(`createComboboxModel`, `@internal`), and `SessionSearch` accepts non-session groups so an
actions group can sit beside results. Cmd-K ships as a documented recipe over
`Dialog` + `SessionSearch`.

**Why.** `command_palette` has **0 component frames, 0 archetype frames, and 0 `search_results`
frames** across 1,262 screens (navigation §3.9). The one product edging toward a palette built
it by adding an action row to a search overlay — Manus 165 shows a query field, a "+ New task"
action row, then a "Today"-grouped list with previews and times — and the closest palette
ergonomics in the corpus come from a search overlay with zero-query recents and a
pre-highlighted first option (Lovable 187). Devin 28 supplies the observed listbox contract
(the `@repo` mention combobox: arrow keys, active row, typeahead). The keyboard/ARIA behaviour
a palette needs is therefore already required three times over, and a palette primitive would
add a second vocabulary (`CommandSource`, `Command`) plus a fourth keyboard implementation to
keep in sync, in exchange for multi-source ranking that no capture supports. Resolves
`ARCHITECTURE.md` open question 3 and `DECISIONS.md`'s paired open item.

**Consequences.** `TriggerMenu`, `SessionSearch`, and the recipe read one combobox model, so
keyboard and IME fixes land once. Consumers wanting Cmd-K today get a recipe, not dead API.
`SessionGroup.label` doubles as an actions-group heading. Cost: the recipe cannot express
cross-source *scoring*.

**Rejected.** (a) Ship `CommandPalette` in v1 — API surface and a fourth keyboard model for
zero observed behaviour. (b) Ship nothing and let three comboboxes diverge — three keyboard
implementations, three places for wrap, IME, and `aria-activedescendant` bugs. (c) Defer the
combobox refactor to v2 — it is cheapest before the three ports exist.

**Falsification.** Falsified if a captured product ranks across heterogeneous sources (files,
settings, docs, sessions) with scoring the recipe cannot express, or if the
`SessionSearch`-in-`Dialog` recipe demonstrably fails on multi-source ranking or grouping —
then `CommandPalette` becomes a component over the same combobox contract, not a new keyboard
model.

### D13 — No windowing inside `Transcript` or `SessionList` in v1; both publish the wrapper contract

**Decision.** v1 ships no internal windowing in either list. Both render **one element per
message/row, in data order, never re-created per token**. Both expose a load-more path
(`hasMore`, `loadingMore`, `onLoadMore`, a sentinel, `data-loading-more`); `Transcript`
additionally exposes `onAtBottomChange`, `stickToBottom`, and stable per-message identity from
the normalised store, so an external windowing wrapper composes over the primitive. `Transcript`
keeps stick-to-bottom, the stable `role="log"` live region, and DOM order that find-in-page can
walk; `SessionList` keeps selection and keyboard traversal across a moving window. Windowing
itself is a documented recipe (`docs/recipes/windowing.md`) and a candidate for a separately
versioned wrapper beyond v1.

**Why.** Both evaluations reach this conclusion independently and do not conflict. Transcript
§5: "Virtualisation is out of scope (CRITERIA excludes performance benchmarking). One
transcript-side constraint stands: the `role="log"` container must survive re-renders, so any
virtualisation strategy has to keep the live region stable." Navigation §4.3: the session list
"shares the transcript's open question but not its difficulty" — fixed-height rows, no
stick-to-bottom, no live region, no find-in-page, and a longest observed list of six rows with
no pagination anywhere on a session list (`pagination` is 65 frames, 4/4, never on a session
list). Navigation adds the wrapper contract adopted here. `prior-art.md` demands the question be
*resolved rather than deferred* ("No surveyed library addresses long-conversation performance"),
and this resolves it on both axes that matter: placement (never in core, never default-on inside
a primitive) and capability (the hooks a wrapper needs are specified behaviour, not an open
question). Core keeps appends and per-row updates O(1), so state never degrades when the DOM does.

**Consequences.** A 5,000-message transcript paints every row until a consumer adds the wrapper;
the cost is rendering, not state. The live region stays outside any window by contract — the
wrapper recipe is the only sanctioned place to break DOM completeness. The sentinel makes
paginated backends work with no windowing at all.

**Rejected.** (a) Window inside `Transcript` — complicates stick-to-bottom, breaks find-in-page,
re-creates the live region; and per criterion 5 DOM measurement belongs in adapters. (b) Ship a
headless `<Virtualizer>` in the adapters — a third-party-shaped API with no corpus scale evidence
to shape it, plus a second way to mount a transcript. (c) Defer with no contract — leaves
`prior-art.md`'s failure mode open and forces every consumer to guess which invariants the
primitive guarantees.

**Falsification.** Falsified if a captured account shows an unpaginated session list of hundreds
of rows or a transcript of thousands of messages, or if a real wrapper cannot simultaneously
satisfy stick-to-bottom, find-in-page, and a stable live region through these hooks — then
windowing ships as `@aicl/window`, an optional separately versioned wrapper both primitives
support through the same contract.

### D14 — Artifacts ship in v1 as data + a card renderer + `TerminalOutput`; no `@aicl/artifacts`

**Decision.** Artifacts are in v1, inside the chat packages: the `ArtifactPart` model (already
in core, with `kind` and `version`), the `ArtifactCard` registry renderer for every kind, and
exactly one body primitive, `TerminalOutput` (`kind: 'terminal'`, append-only, tail-follow,
`data-following`, bounded line cap). No `@aicl/artifacts` package. No `ArtifactPane`,
`PreviewFrame`, `DiffViewer`, or canvas host: their placement and lifecycle are documented
recipes over `ArtifactCard`.

**Why.** Four reasons, in order of weight. (1) The domain is already modelled — D9 found "no new
part types were needed", with terminal output mapping onto `ArtifactPart{kind:'terminal'}`, diffs
onto `kind:'diff'`, previews onto `kind:'preview'` — so deferring saves no model work, only
rendering; the only question is which renderers ship. (2) The in-transcript entry point is
observed and label-invisible: artifact cards are plainly visible in Lovable 32 ("Previewing
latest version" with a Code chip) and Manus 57/84/160 (deck preview, "Meeting Summary" document
card) while `artifact_card` has 0 labels — a vocabulary artifact, not evidence of absence
(transcript §5). A card with `data-artifact-kind` is the cheap, evidence-backed renderer.
(3) `TerminalOutput` is the one artifact body a consumer cannot cheaply recompose: append-only
buffering, tail-follow that a user gesture breaks, a bounded line cap, and a visible
resume-follow state (Devin 81's "• Live" pill) — agent-execution §3.7's recommendation, on 12
`terminal_output` labels. (4) The rest is IA: live preview is 13 frames across 2 of 4 products,
the diff viewer 1 frame, and split-chat-artifact layouts are common but layout is exactly what
criterion 4 excludes from a headless library (agent-execution §3.7: "Pane-versus-inline is an IA
decision, which criterion 4 places outside a headless library"). A package boundary is wrong for
the same reason D9 rejected `@aicl/agent`: three of four products render artifact cards *inside*
the message flow, so a package would split a transcript-native surface from the transcript.

**Consequences.** v1 consumers get a versioned artifact card and a correct terminal body in both
pane and inline positions. Consumers building a canvas or preview pane write it against
`ArtifactCard`'s `onOpen` + `version`, and the recipe documents the sandboxed-iframe and
version-reload shape. Cost: a working preview surface and the diff viewer are the consumer's to
write. `Usage.costUsd` stays in core for billing surfaces (32 `settings_billing` frames, Devin
84's usage-limit modal) but ships no meter — both inspected `cost_tokens_meter` frames show
nothing (agent-execution §1, §3.5), and there is no ticking timer and no percentage bar.

**Rejected.** (a) Defer all artifact surfaces to v2 behind `@aicl/artifacts` (`ARCHITECTURE.md`'s
candidate split) — it saves one small renderer while leaving the most common artifact affordance
(a card in the transcript) unbuildable, and front-loads a package boundary the corpus does not
support. (b) Ship the full surface set — pane, canvas, preview, diff — in v1: it encodes one
product's workspace IA as the library's opinion (criterion 4: weak) on 13 + 1 frames of evidence.
(c) Ship `ArtifactCard` only, terminal as a recipe: it forks tail-follow behaviour into every
consumer and drops the one recommendation both agent-execution §3.7 and Devin 81 support.

**Falsification.** Falsified if a corpus round shows artifacts living predominantly outside the
transcript in a dedicated surface with its own lifecycle — a routed canvas or pane holding
multiple open artifacts, version history, and its own navigation — at ≥3/4 product spread; then
the surface moves behind a package boundary (`@aicl/artifacts`) owning a pane primitive, while the
part renderer and `TerminalOutput` stay in the chat packages. Also falsified if a capture shows
terminal output legible only when interleaved with per-step tool cards such that extraction loses
meaning (agent-execution §5.4) — that would force the component to own placement.

---

## 8. Implementation order

One-shot sequence; each stage has a mechanical done-definition and forbids drift beyond §4.

**Stage 1 — core (`packages/core`).** `types.ts` (final union per §3.1, `ChatDraft`,
`Attachment`, `toFilePart`), `chat.ts` (draft-form `send`, `siblings()`, resting-status
semantics, `'cancelled'` on abort), `session.ts`, `scroll.ts`, `combobox.ts`, `toast.ts`,
`form.ts`, `approvals.ts`, `index.ts` per §3.9. `store.ts`, `registry.ts`, `transports/sse.ts`
unchanged.
*Done:* `npm test -w @aicl/core` green with one test per row of the §3.3 table plus
stop-keeps-partial-output, edit-forks, selectBranch, and abort-marks-tools-cancelled;
`grep -RE "document\.|window\.|from 'react'" packages/core/src` returns nothing; the export list
equals §3.9.
**Stage 2 — tokens (`packages/styles`).** `tokens.css`, `components.css`, `reset.css`,
`index.css` per §5.
*Done:* a kitchen-sink fixture renders every §4 primitive in every documented state with the
theme and no consumer CSS; every `data-*` attribute named in §4 has a rule or an explicit
`/* unstyled by design */` note; no selector targets a bare tag or a class.
**Stage 3 — React adapter (`packages/react`), in dependency order.**
3a foundation: `useChat()`/`ChatContext`, `createPartRegistry` + `defaultRegistry`, the leaf
renderers (§4.5), `ReasoningDisclosure`, `ToolCallDisclosure`, `ArtifactCard`, `TerminalOutput`,
`SuggestionRows`. *Done:* every renderer mounts from a fixture part and emits its §4 attribute
set; the fallback path is covered by a test with an unregistered `data-*` part.
3b transcript: `Transcript`, `MessageItem`, `MessageActions`, day separators, `createScrollPin`
wiring. *Done:* pin/unpin works on a synthetic upward gesture; live-region node identity is stable
across token appends (asserted by identity, not snapshot); branch attributes appear only with
siblings.
3c composer: `Composer` + parts, `AttachmentDropzone`, `AttachmentChip`, `TriggerMenu` + presets,
`SuggestionChips`. *Done:* the four documented deltas against today's
`packages/react/src/Composer.tsx` are gone — one morphing send/stop node (`data-role` swaps),
`canSubmit` true for attachments-only, `data-state`/`data-placement`/`data-has-text`/
`data-has-attachments` emitted, `submitted` and `streaming` never collapsed — and the IME test
(composition start → Enter → no submit) passes.
3d execution: `PlanChecklist` + `data-plan` wiring. *Done:* standalone mixed-status render,
correct rollup, no interactive affordance, `aria-live` on the rollup only.
3e sessions: `SessionList`, `SessionListItem`, `SessionSearch`, `SidebarNav`. *Done:* listbox
traversal with a moving item window; empty/loading/loading-more states render; all four
`data-secondary` values asserted; collapse keeps every accessible name.
3f platform: `Field`, `Switch`, `Select`, `SegmentedControl`, `Dialog`, `AlertDialog`, `Drawer`,
`ToastRegion`/`Toast`. *Done:* focus trap, top-layer-only Escape, focus return; `AlertDialog`
refuses scrim dismissal and requires `consequence`; toast variants map to the right live regions;
every dismiss path fires `onDismissRequest` when dirty.
**Stage 4 — Svelte 5, then Vue (`packages/svelte`, `packages/vue`).** Same inventory, props,
events, attributes; runes and `shallowRef` bindings to `ReadableStore`.
*Done:* one shared conformance fixture renders a per-§4-state matrix in all three adapters and
produces identical `data-*` sets and DOM order; ports ship no CSS; no `className`/`class` prop in
adapter public types.
**Stage 5 — tests and docs.** Per-primitive docs (purpose, props, attributes, keyboard, states,
citation), `docs/recipes/*.md` (§6), the a11y suite, and the conformance fixture promoted to a
package script.
*Done:* every §4 section has a docs page whose attribute table equals the implementation; axe-core
passes on the kitchen-sink fixture in light and dark; the attribute list is machine-extracted from
the docs and diffed against the rendered fixture (fails on drift); no file in the repo contains
`TBD`.

---

## 9. Acceptance checklist (AICL-4 criteria)

| # | Criterion | Where satisfied | Verification |
|---|---|---|---|
| 1 | Every component has an API sketch | §4.1–§4.20, one TypeScript props block per primitive, and per-renderer signatures in §4.5 | every §4 section contains a ```ts fence and all 28 inventory rows map to one |
| 2 | Every component has a complete state set | per-section **States** lines plus the §4.11 status table | Stage 5 attribute-drift test; empty/loading/error in §4.1, §4.11, §4.14, §4.16, §4.20 |
| 3 | Every component has styling hooks | per-section **Attrs** lines plus the §5 coverage rule | Stage 2 kitchen-sink render; `components.css` selector audit |
| 4 | Every divergent choice has exactly one target behaviour with rationale | §2.3, per-section **Implements** lines, §10 | one `Implements` line per section; no section names two default behaviours |
| 5 | Open questions resolved citing comparative evidence | D12 (0 frames; Manus 165, Devin 28, Lovable 187), D13 (transcript §5 + navigation §4.3), D14 (agent-execution §3.7/§1, transcript §5, D9) | each §7 record states its falsifier |
| 6 | No TBDs, no placeholders | whole document; uncertain calls carry falsifiers | `grep -iE "tbd|todo|fixme" docs/BLUEPRINT.md` returns nothing beyond this row |
| 7 | Framework-free core preserved | §2.1 gates; Stage 1 done-definition | CI grep gate |
| 8 | One behaviour per evaluation verdict | per-section **Implements** lines cite exact evaluation sections | spot-check any `docs/evaluation/*` verdict against §4 by section number |
| 9 | Ship set matches D9/D10/D11 | §2.2; D9 refined in §2.3 (no `InterruptButton`, no `StepTimeline`), D10 intact, D11 in §3.6 + §4.14–§4.17 | inventory row count vs §3.9 export list |

---

## 10. Reconciliation log

Every disagreement between documents and the winner. Evaluations beat `ARCHITECTURE.md` and the
domain specs; between two evaluations the stronger evidence class wins.

| # | Conflict | Resolution (winner) |
|---|---|---|
| 10.1 | `ARCHITECTURE.md` lists `<Transcript>` as a "virtualised list"; transcript §5 and navigation §4.3 both decline internal windowing | D13: no windowing, published wrapper contract. `prior-art.md`'s "resolve, don't defer" is met by specifying the contract rather than shipping a virtualizer |
| 10.2 | `ARCHITECTURE.md`'s diagram draws `aborted ──> idle`; `chat.ts:222` leaves `aborted` set until the next command | Shipped behaviour wins and is made explicit: `aborted`/`error` are resting statuses. The transcript needs a persistent terminal status line on the interrupted turn (Devin 81) and core has no timer. Both are outside `BUSY`, so the composer is already send. `siblings()` is added in the same pass to make the branch switcher implementable (transcript §5) |
| 10.3 | D9 names `InterruptButton`; composer C3 and agent-execution §3.4 require one morphing button | Composer wins: `InterruptButton` dropped; its behaviour is `Composer.SendButton`'s `data-role="stop"`, and Cofounder-style external placement calls `controller.stop()`. D9's package split is unchanged |
| 10.4 | Domain spec `agent-execution.md` says completed steps auto-collapse everywhere; Manus 155 keeps them expanded | Evaluation wins: `defaultOpen:false` but settable, summary is a slot, `'error'` force-opens. 2/4 is not a convention, and Lovable's hide-entirely variant fails worse (an error with no surface) |
| 10.5 | Domain spec `transcript.md` calls day separators "the norm (70, 4/4)"; verification finds ~2/4 (chart axes, billing dates, poster times) | Evaluation wins: separators only at calendar-day boundaries, never above the first group, `<time datetime>` mandatory |
| 10.6 | agent-execution §3.4 has the composer accepting mid-run input for steering; composer §5.5 makes a mid-stream send a hard no-op | Both, scoped: the **field** stays editable (no product disables it; input is the one thing a user cannot work around), and the **send** action is unavailable while busy because the slot holds stop. No queueing in core (ADR-T5), because no queued-send UX is observed |
| 10.7 | Domain spec `composer.md` allows `state:'disabled'`; composer C8 finds no disabled composer in 1,262 screens | Evaluation wins: `disabledReason` disables the send control only, via `aria-describedby` + `data-disabled-reason`; the field is never disabled |
| 10.8 | Domain spec composer contract rule 5 attaches progress to attachment chips (Manus "4/4"); composer §1 correction 1 shows those are a task rollup | Evaluation wins: no attachment progress is observed; `Attachment.progress` survives as an `[adjusted]` extrapolation from Cofounder 29's upload grid, and Manus's fractions belong to `PlanChecklist`'s rollup |
| 10.9 | Domain spec `navigation.md` makes `session_list_item` 4/4 and nests it in a sidebar; navigation §1 correction 1 makes it 3/4 and §3.1 removes the host | Evaluation wins: `SessionList` is host-agnostic (listbox + grouping + keyboard, zero width/orientation/chrome) |
| 10.10 | Domain spec treats the workspace switcher as a primitive (205 labels, 4/4); navigation §3.7 collapses it to 1/4 | Evaluation wins: recipe over `Select` |
| 10.11 | transcript §3.6 renders follow-ups in-transcript by default; composer C7 places suggestion chips in `Composer.Above` | Both ship, because the inputs differ: a `data-suggested-followups` **part** renders in-transcript by default (the observed majority — Manus, OCR 54 screens), while consumer-supplied suggestion **strings** render as optional chips (Lovable, 1/4). transcript.md wins wherever a part exists, because the part is the transcript-native source of truth |
| 10.12 | transcript §3.3 resolves action-bar visibility to `'auto'`; domain spec contract rule 5 says persistent | Evaluation wins: accessibility breaks the tie — controls must be in the DOM either way, so only paint is at stake |
| 10.13 | `ARCHITECTURE.md` ships SSE + JSON + WebSocket transports; `transport.md` leaves WebSocket to consumers (open question 1) | Scope call: v1 ships `createSseTransport` only, with JSON-line and WebSocket transports documented as recipes over the same interface. No evaluation contradicts this; the interface is the contract (D3), and SSE is what the end-to-end fixture needs |
| 10.14 | `agent-execution.md` labels imply a Cofounder cost/token meter (6 frames); both inspected frames show none | Evaluation wins: no meter, no bar. `Usage.costUsd` stays for billing surfaces, not execution |
| 10.15 | `platform.md` counts 6 `toast` labels (all false positives on generated apps) and 7 `drawer` labels (all persistent rails); OCR finds ≥113 toast blocks 4/4 and zero overlay drawers | Evaluation wins: toasts are a real required primitive with queue + live-region mapping; `Drawer` ships flagged `[extrapolation]` for narrow-viewport chat need, falsifier recorded in §4.18 |
| 10.16 | transcript §5 ships no citation UI; `CitationPart` is in core and two products show source-ish affordances | Both: the type stays (cheap, forward-compatible), no default renderer ships, and a `CitationChip` joins the registry only if a capture shows inline source chips or a sources drawer |
| 10.17 | `ARCHITECTURE.md` lists `SlashMenu` and `MentionMenu` as two primitives; composer C6 finds one grammar with two trigger characters and zero observed menus | Evaluation wins: one `TriggerMenu` with two preset exports |
