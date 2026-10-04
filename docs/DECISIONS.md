# Decisions

Running log of architectural decisions, each with the reason and the alternative
that was rejected. Numbered for reference; newest last.

## D1 — Messages are ordered part arrays, not strings

**Decision.** `Message.parts: Part[]`, a discriminated union, instead of
`content: string` plus metadata.

**Why.** The corpus shows assistant turns interleaving prose, tool calls, tool
results, reasoning, and citations within a single message, and order matters. A
string field cannot represent that; products that started with one bolt on a
parallel channel to work around it.

**Rejected.** `content: string | ContentBlock[]` (the API-shaped compromise). It
preserves the two-channel problem for any consumer who reads `content` first.

## D2 — Rendering dispatches through a registry, not a switch

**Decision.** `PartRenderer` resolves part types through a runtime registry with
a fallback renderer.

**Why.** A `switch` in the library means a new part type requires a library
release and a major bump. A registry lets consumers register `data-*` parts at
runtime. The fallback matters independently: a server that ships a new part type
must not white-screen older clients.

**Rejected.** Union exhaustive matching with a compiler error on new types.
Compile-time safety, runtime brittleness.

## D3 — The library performs no I/O

**Decision.** Core consumes a `ChatTransport` interface; SSE is one adapter.

**Why.** "Pluggable" is the product. Tests drive components from in-memory
fakes, consumers from their own backends, and the components cannot tell the
difference. This also keeps `@aicl/core` runnable in plain Node, which is what
makes the state machine cheap to test.

**Rejected.** Built-in fetch with configurable URL. Every such kit grows auth
branches, retry policies, and provider special cases until the transport is the
hardest part to replace.

## D4 — `submitted` and `streaming` are distinct states

**Decision.** The status machine separates "request in flight, no events yet"
from "events arriving".

**Why.** Between submit and first token there is nothing to render and nothing
to abort, but further submits must still be rejected. Collapsing the two is the
usual cause of double-firing send buttons and stuck stop buttons.

**Rejected.** A single `loading` state. It is what most kits do and where the
bugs live.

## D5 — Abort preserves partial output

**Decision.** `stop()` flags the in-flight message `aborted` and keeps its parts.

**Why.** Every surveyed product retains partial output on interrupt; users rely
on it for long generations. It also makes abort idempotent from the UI's view.

**Rejected.** Discard on abort. Simpler reducer, worse product.

## D6 — Branching is a tree, rendered as a path

**Decision.** The transcript is stored as a normalised node map with parent/child
links; the visible conversation is the selected path through it. Editing forks
rather than overwrites.

**Why.** Message editing and regeneration both create siblings. Storing a flat
array destroys the original; storing a nested tree makes streaming appends
rebuild ancestor chains. A flat map plus a path array keeps appends O(1) and
branch switching cheap.

**Rejected.** Flat array with "edited" tombstones. Loses the sibling history
that branch switchers need.

## D7 — Headless primitives ship DOM semantics, not visuals

**Decision.** Adapters own ARIA roles, focus management, and keyboard behaviour;
styling arrives only through stable `data-*` attributes and the optional
`@aicl/styles` theme.

**Why.** Behaviour is what consumers cannot afford to rebuild correctly (IME-safe
Enter, live-region semantics during streaming, focus traps in modals). Visuals
are what they always replace. Coupling them guarantees replacement of both.

**Rejected.** Shipping styled components as the primary API. It is the norm and
the reason chat kits get forked instead of themed.

## D8 — npm workspaces, one tsconfig per package, project references avoided

**Decision.** Simple workspaces; adapters resolve `@aicl/core` through the
workspace symlink against built `dist` declarations.

**Why.** TypeScript project references are the textbook answer but force a
specific build orchestration on every contributor's editor. Building core first
and typechecking adapters against its declarations is dumber and works in every
tool. A `paths` mapping into core's `src` was tried first and broke `rootDir`
boundaries.

**Rejected.** Project references; `paths` into sibling sources.

## D9 — Agent execution surfaces ship in the chat packages

**Decision.** `ToolCallDisclosure`, `PlanChecklist`, `StepTimeline`, and
`InterruptButton` live in the main adapters, not a sibling `@aicl/agent` package.

**Why.** Resolved by the corpus once all four products were labelled:
`plan_checklist` is 4/4 universal (78 screens), progress indicators 4/4 (102),
tool cards 3/4. These are transcript-native conventions, not specialist
surfaces. Core already models the domain (`ToolCallPart`, `ToolResultPart`,
`Usage`, cooperative abort), and the domain analysis found **no new part types
were needed** — plans and diffs ride the `data-*` extension point, and terminal
output maps onto `ArtifactPart{kind:'terminal'}`. The sparse pane-level surfaces
(terminal streaming, 2 frames; diff viewer, 1 frame) fit the artifact/registry
escape hatch rather than a package.

**Rejected.** `@aicl/agent` sibling package. It would split a conversation that
the products themselves render as one transcript.

## D10 — Platform surfaces: primitives in, pages out

**Decision.** The library ships headless overlay and form primitives — `Dialog`/
`AlertDialog`, `Drawer`, `Toast`/`ToastRegion`, `Field`, `Switch`, `Select`,
`SegmentedControl` — because chat surfaces need them (delete-session confirm,
model picker, stream-error toasts). It does not ship `SettingsPage`,
integrations, secrets, automations, or billing components; those are app-level
concerns delivered as reference recipes.

**Why.** Settings/billing/integrations make up a large share of the corpus
(roughly a quarter of labelled screens) but none of it is chat-specific, and
every product's information architecture differs. Shipping pages would encode
one product's IA as the library's opinion, violating the headless contract.

**Rejected.** A `@aicl/platform` package. The domain analysis found no reusable
behaviour beyond the primitives.

## D11 — Session metadata is a separate model from the transcript

**Decision.** `@aicl/core` gains a `SessionMeta`/`SessionGroup` model with its
own `ReadableStore`, kept out of `ChatState`.

**Why.** The navigation analysis quantified the vocabulary divergence (Devin
"session" ×70, Lovable "project" ×74, Cofounder/Manus "task" ×90/63) — same
concept, four names — and the session list is sidebar-embedded with its own
lifecycle (pinning, grouping, search, unread) that has nothing to do with an
open transcript's streaming state. Coupling them would force session-list
consumers to construct chat controllers they don't need.

**Rejected.** Extending `ChatState` with session metadata. Two lifecycles, two
stores.

## D12 — No `CommandPalette` primitive; one combobox contract, Cmd-K as a recipe

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
`ARCHITECTURE.md` open question 3 and this file's paired open item.

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

## D13 — No windowing inside `Transcript` or `SessionList` in v1; both publish the wrapper contract

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

## D14 — Artifacts ship in v1 as data + a card renderer + `TerminalOutput`; no `@aicl/artifacts`

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

## Sign-off

**2026-10-04 — Go, slice 1 only.** Ameno authorized implementation of the first
vertical slice: one live turn. In scope: the status machine (`submitted` distinct
from `streaming`), one morphing send/stop control, a transcript with stick-to-bottom,
text / reasoning / tool-call / artifact parts, an unregistered `data-*` part that
falls back instead of blanking the thread, and abort that keeps partial output and
marks in-flight tools `cancelled`. The fixture is scripted and does not use the
network.

This is not a sign-off of the full 28-primitive inventory in `BLUEPRINT.md`.
Session list, platform primitives, Svelte/Vue, and the moi-style workspace stay
gated on a further Go. AICL-3 remains the review gate for that remainder.

**2026-10-04 — Go, React inventory (blueprint stages 3c, 3e, 3f).** Ameno asked for
"actual react components" from the library (AICL-20). Built in `@aicl/react`:
`TriggerMenu` + `SlashMenu`/`MentionMenu`, `SuggestionChips`, `AttachmentChip`,
`AttachmentDropzone`; `SessionList`, `SessionListItem`, `SessionSearch`, `SidebarNav`;
`Dialog`, `AlertDialog`, `Drawer`, `ToastRegion`/`Toast`, `Field`, `Switch`, `Select`,
`SegmentedControl`. Core gained `createComboboxModel` (@internal), `createSessionStore` +
`bucketByRecency`, `createToastQueue`, `Attachment`/`toFilePart`, `Mention`. Svelte/Vue stay
paused (AICL-9). Deviations from `BLUEPRINT.md`, each forced by the implementation:

- `SessionStore.meta(id)`, not `get(id)`: `get()` is already `ReadableStore.get`.
- `TriggerMenu` takes `inputRef`, `value`, `onValueChange`: the menu must read the caret and
  write the completion, and focus stays in the field, so it binds to the field it completes.
  `Composer` gained controlled `value`/`onChange` and `inputRef` for this.
- `ToastRegion` takes the `queue` it renders.
- `DismissReason` adds `'swipe'` for `Drawer`.
- `AlertDialog` takes a required `title`.
- `@aicl/styles` `reset.css` selectors are wrapped in `:where()`: at attribute-plus-tag
  specificity the reset beat every single-attribute component rule (it zeroed the borders and
  padding of every styled `button`). A reset should never win.

## Open questions

None open in the design. D12–D14 resolved the three Phase-1 questions. Still gated:
`Composer` compound parts and the `Draft` submit shape (§4.11), `createScrollPin`,
`createFormController`, `createApprovalsStore`, and the Svelte/Vue adapters.
