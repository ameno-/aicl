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

## Open questions

1. **Artifacts in v1?** Canvas/preview surfaces appear in three of four products
   but carry the most surface area. Candidate split: `@aicl/artifacts`. The
   execution analysis weakens the case for v1 — live preview frames are rare
   (preview_live 13, 2/4) — but the split-chat-artifact layout is common.
2. **Virtualisation location.** In `<Transcript>` directly (complicated
   stick-to-bottom) or as an opt-in wrapper?
3. **Command palette.** Zero occurrences in the corpus; `navigation.md` ships a
   spec marked as extrapolation. Decide whether to implement it in v1 at all.
