# Evaluation: message transcript & rendering

Phase 1 comparative evaluation of how Cofounder, Devin, Lovable, and Manus
implement the transcript domain, following the method in
`docs/evaluation/CRITERIA.md`. Every divergent choice ends in exactly one
target behavior for the library. Input to `docs/BLUEPRINT.md`.

Related: `docs/domains/transcript.md` (inventory and contract),
`docs/DECISIONS.md` (D5 abort preserves partial output, D6 tree-as-path
branching), `docs/ARCHITECTURE.md` (registry dispatch, headless `data-*`).

## 1. Scope and data

| Source | Extent |
|---|---|
| `_corpus/labels/*.json` | 1,262 screens — Cofounder 385, Devin 250, Lovable 339, Manus 288 |
| Chat surfaces (`is_chat_surface`) | 196 — Cofounder 52, Devin 36, Lovable 41, Manus 67 |
| Transcript carriers | 497 — Cofounder 141, Devin 130, Lovable 115, Manus 111 |
| `_corpus/ocr/*.json` | Full-text phrase scan over all 1,262 screens |
| Screenshots read directly | 11 — Cofounder 44/139/182, Devin 89, Lovable 32/45/177, Manus 21/57/84/160 |

**Carrier count reconciliation.** The domain spec reports 414 carriers; this
evaluation counts 497. The difference is the inclusion rule, not the data:
414 counts the transcript-family component list in the spec's inventory table,
497 counts any screen with a non-`none` message part *or* any of 22
transcript-family components (adding `code_block`, `tool_call_collapsed`,
`typing_indicator`, `message_avatar`). 497 is used below; per-component counts
in the matrices match the spec exactly.

**Caveat 1 — labels are a floor `[label-floor]`.** `reasoning_block` has 1 label
corpus-wide, but OCR finds "Thought for" on 62 screens (Devin 41, Lovable 21)
and "Worked for" on 51 (Devin 50). Part-level counts are worse: `reasoning`,
`tool_call`, `citation`, and `suggested_followups` are 0 as message parts while
plainly visible in spot-checks.

**Caveat 2 — labels also over-detect.** New in this evaluation; the domain spec
does not record it. Three labels fail verification:

- `date_separator` (70, 4/4) mostly is not a transcript separator. OCR on the
  labeled screens shows chart axis ticks ("May 25", "Jun 4") in Devin, billing
  copy ("Renewal date Mar 9, 2026") in Manus, task timestamps ("Jun 20,
  10:59 AM") in Cofounder, poster times in Lovable. Only Lovable 178/179
  ("Dec 30 at 10:27 AM") and Manus 114 ("Today" / "Yesterday") are real.
- `rating_prompt` (11, 2/4) attributes 10 screens to Lovable; OCR on those
  screens contains no rating copy — the hits appear to be the model's own
  "Overall Rating: 7.5/10" prose. The rating prompt is **Manus-only**, and
  larger than labeled: OCR finds "How was this result" on 57 Manus screens.
- `message_actions_bar` (215, 4/4) sometimes points at non-transcript chrome:
  Cofounder 182 carries the label, but the only visible action row is an
  artifact card's "Edit | Jun 20, 10:59 AM" footer in the workspace canvas.

**Caveat 3 — one spec claim corrected.** The spec notes "message_list: 0 in
Devin labels". Devin actually has **46** labeled `message_list` screens
(including 89); the 155 / 4-of-4 spread needs no correction.

**Caveat 4.** Stills cannot show motion or pointer state. Hover-reveal,
auto-scroll thresholds, and keyboard behavior are `[inferred]` throughout.

## 2. Settled conventions (4/4, not matrixed)

| Convention | Evidence | Library consequence |
|---|---|---|
| Assistant turns are full-width, left-aligned rows — never bubbles | `[observed]` Cofounder 139/182, Devin 89, Lovable 32/45, Manus 84/160 | `alignment` defaults to `full` for assistant; no bubble in core |
| Rich markdown is the default assistant body | `[label]` `markdown_rich` 70 parts, 4/4 | `text` → markdown renderer in the registry, engine pluggable |
| Code renders as a distinct block, not inline prose | `[label]` `code_block` 159 components / 25 parts, 4/4 | Dedicated part renderer with `data-part="code"` |
| Images and files render as message parts | `[label]` `image_attachment` 40 (4/4), `file_attachment` 5 (2/4) | `file` renderer, role-agnostic |
| Per-message actions exist on assistant turns | `[label]` `message_actions_bar` 215, 4/4 (see Caveat 2); `[observed]` Devin 89, Lovable 32 | `<MessageActions>` ships; only placement diverges (§3.3) |
| A scroll-to-bottom affordance exists | `[label]` `scroll_to_bottom` 72, 4/4; `[observed]` Lovable 45, Manus 84 | Stick-to-bottom is default behavior (§3.8) |
| Progressive disclosure for process content | `[observed]` Devin 89 "Worked for 11s", Lovable 32 "Thought for 24s" / "2 edits made", Cofounder 182 "Ran 8 actions", Manus 84 "Deliver summary to user 3/3" | Disclosure primitives collapsed by default (§3.4) |
| Stop leaves partial output in place | `[observed]` Devin 89 ("Stopped working", "Devin went to sleep"); `[label-floor]` elsewhere | Confirms D5; aborted message stays on the path |

## 3. Divergent choices

### 3.1 How is a user message contained and aligned?

| Product | Answer | Evidence |
|---|---|---|
| Cofounder | Tinted bubble, hugged to the inline-end edge of a right-side chat rail | `[observed]` Cofounder 44, 182; `[label]` `message_bubble_user` 4, all Cofounder (1/4) |
| Lovable | Tinted bubble inset from the leading edge, flush to the trailing edge of a ~570px rail; user avatar above-trailing | `[observed]` Lovable 32, 45 |
| Manus | Full-width card for the user turn (slash-command chips inside), same column as assistant | `[observed]` Manus 21 |
| Devin | Full-width row for both roles; no bubble, no tint | `[observed]` Devin 89; 0 bubble labels in Devin |

Scores — convention strength: bubble 2/4, full-width 2/4, a genuine split.
UX heuristics: bubbles **strong** on role scanning, **weak** on very long user
input; full-width the reverse. Accessibility **neutral** either way — role must
come from semantics, not tint. Headless fit **strong** only if role and
alignment are data attributes and CSS decides; baking flexbox into a headless
package is **weak**. Ergonomics: a three-value union beats two booleans.
Portability not applicable — pure presentation.

**Verdict.** The split is 2/2 on containers but 4/4 on the underlying rule: the
*user* turn is the only one any product visually distinguishes, and no product
bubbles the assistant. Bubbles buy role scanning cheaply in narrow rails, which
is where three of four products put the transcript.

**Recommendation `[observed-default]`.** Emit `data-role` on every message row
and a role-derived `alignment` attribute — user `end`, assistant `full` — as
the default, with `alignment` overridable per message to `start | end | full`
so the Devin-style symmetric layout is a prop, not a fork. The library ships no
bubble geometry; `@aicl/styles` owns tint and radius.

**Dissent — Devin.** Symmetric rows are better for pasted long input (a 40-line
bubble is worse than a row) and remove an RTL/narrow-rail failure mode;
overriding `alignment` to `full` is supported, not a workaround.

### 3.2 Does each message carry an identity header?

| Product | Answer | Evidence |
|---|---|---|
| Cofounder | Per-turn identity row: agent icon + name ("Marketing Agent", "Sales Agent") above assistant content | `[observed]` Cofounder 139, 182 |
| Manus | Product wordmark in thread chrome ("manus Lite"), not per message | `[observed]` Manus 84 |
| Lovable | No assistant identity; a user avatar sits above the user bubble | `[observed]` Lovable 32, 45 |
| Devin | No per-message identity at all | `[observed]` Devin 89 |
| All | Avatars are near-absent as a labeled component | `[label]` `message_avatar` 2, 2/4 |

Scores — convention strength: per-message identity is 1/4, one product's bet.
UX heuristics **strong** for Cofounder, which runs *multiple named agents* in
one transcript where identity is load-bearing, and **weak** as a default in a
single-assistant product where a repeated name is noise. Accessibility:
identity belongs in the row's accessible name whether or not it is painted —
**strong** case for always exposing it structurally. Headless fit: a slot is
**strong**, a rendered avatar **weak** (branding is app-level).

**Verdict.** Identity is universal as *data* and rare as *pixels*. The one
product that paints it per turn has a reason no other has: more than one agent
speaks.

**Recommendation `[adjusted]`.** `<MessageItem>` always exposes identity to
assistive tech (role plus optional display name in the row's accessible name)
but paints none by default. Ship a `renderIdentity` slot that fires only when
the speaker changes from the previous message on the path. The adjustment:
Cofounder repeats identity on every agent turn, the library dedupes
consecutive turns from the same speaker.

**Dissent — Cofounder.** Where turns interleave between named agents, per-turn
identity beats grouping — a user landing mid-thread always sees who is talking.
Consumers that need it pass `identityMode: 'always'`.

### 3.3 Where do message actions live, and are they persistent?

| Product | Answer | Evidence |
|---|---|---|
| Devin | Persistent pill below assistant content: thumbs up/down, copy, share, with an inline timestamp in the same row | `[observed]` Devin 89; `[label]` 42 screens |
| Lovable | Persistent icon row below the assistant turn, leading-aligned: revert, thumbs up/down, copy, more | `[observed]` Lovable 32; `[label]` 34 screens |
| Manus | No action bar visible at rest on completed turns, despite the highest label count of any product | `[observed]` Manus 84, 160; `[label]` 85 screens, 4/4 leader → `[inferred]` hover-revealed |
| Cofounder | No action bar visible at rest in the chat rail; the labeled row on 182 is an artifact-card footer | `[observed]` Cofounder 139, 182; `[label]` 54 screens |

Scores — convention strength: presence 4/4, persistence 2/4 (Devin, Lovable)
versus not-at-rest 2/4 (Manus, Cofounder). UX heuristics: persistent is
**strong** on discoverability, **weak** on transcript noise at scroll scale;
hover-reveal inverts both and is **weak** on touch. Accessibility: hover-only
reveal is acceptable *only* if the controls are in the DOM and keyboard
reachable with focus-visible reveal — `display:none` until `:hover` is
disqualifying. Headless fit and portability **strong**: visibility is a data
attribute, no measurement needed. Ergonomics: one `visibility` union beats two
booleans.

**Verdict.** The corpus splits 2/2, and the split correlates with density — the
two products that hide actions at rest have the busiest transcripts (Manus
interleaves step rows and artifacts; Cofounder runs a narrow rail beside a
workspace canvas). Accessibility breaks the tie: controls must exist in the DOM
either way, so the only question is paint.

**Recommendation `[adjusted]`.** Message actions are always in the DOM and
keyboard-reachable; `visibility` defaults to `'auto'` — painted persistently on
coarse pointers and on the last assistant message, revealed on hover *or*
focus-within elsewhere — with `'persistent'` and `'hover'` as explicit values
and `data-visibility` carrying the resolved state. The adjustment: no product
does exactly this, and the default differs from the flat "persistent" reading
in the domain spec's contract rule 5.

**Dissent — Devin.** Unconditional persistence is the most discoverable and the
most testable, and Devin's inline timestamp shows the row can carry metadata,
not just buttons. Set `visibility: 'persistent'` to get it.

### 3.4 How is reasoning and tool work displayed?

| Product | Answer | Evidence |
|---|---|---|
| Devin | Duration rollup disclosure: "Worked for 11s" containing nested thought and step rows; "Thought for Ns" | `[observed]` Devin 89; OCR "Worked for" 50, "Thought for" 41 |
| Lovable | Collapsed "Thought for 24s" row plus collapsed tool summaries ("2 edits made / Show all", "6 tools used / Show all") | `[observed]` Lovable 32, 45; OCR "Thought for" 21, "Show all" 37 |
| Cofounder | Labeled disclosure rows without duration: "Ran 8 actions", "Running Tool: Ask User Question", "Thought through the next step" | `[observed]` Cofounder 139, 182 |
| Manus | Step rows with completion counters pinned above the composer ("Deliver summary to user 3/3"), plus in-transcript sub-steps | `[observed]` Manus 84, 21 |
| All | Reasoning is under-labeled as a component or part | `[label-floor]` `reasoning_block` 1; reasoning/tool parts 0 |

Scores — convention strength: collapsed-by-default disclosure 4/4; duration
labeling 2/4 (Devin, Lovable); pinned live status 1/4 (Manus). UX heuristics
**strong** on cognitive load (rollups beat raw streams) and visibility of
system status. Accessibility: a native disclosure (button + `aria-expanded`,
stable DOM order) is **strong**, and live-region churn from streaming reasoning
argues for announcing the summary, not the body. Headless fit **strong** —
behavior plus `data-collapsed`. Ergonomics: a distinct `ReasoningPart` keeps
copy semantics clean (spec contract rule 6).

**Verdict.** Every product collapses process content; they differ only in the
summary string and whether it counts seconds. The same row does double duty as
the pending indicator before any output exists, which is why `typing_indicator`
is nearly unlabeled (7 screens, 2/4) — the reasoning row *is* the typing
indicator.

**Recommendation `[observed-default]`.** Render `reasoning` and `tool-call`
parts as disclosures collapsed by default, summarised by a product-supplied
label falling back to a duration once the part completes. While the message is
streaming with no visible output parts, the same disclosure renders as the
pending row — no separate typing-indicator primitive. Expose `data-part`,
`data-collapsed`, `data-tool-status`; exclude both from `copy`.

**Dissent — Manus.** A pinned status row above the composer stays visible while
the user scrolls back, which an in-transcript disclosure cannot do. That is an
agent-execution surface, evaluated in `docs/evaluation/agent-execution.md`; the
transcript here only needs to not fight it.

### 3.5 What shape does feedback take?

| Product | Answer | Evidence |
|---|---|---|
| Devin | Thumbs up/down as buttons in the persistent action bar | `[observed]` Devin 89; `[label]` `feedback_thumbs` 2 |
| Manus | Both: per-message thumbs `[label]` 41 screens, and a post-completion star rating rendered as transcript content — "Task completed" + "How was this result? ★★★★★", expanding to a comment card with a "Help Manus improve with my feedback" checkbox and Skip comment / Submit | `[observed]` Manus 84 (inline row), 57 (expanded card), 160; OCR "How was this result" 57 screens |
| Cofounder | Thumbs labeled on 2 screens; not visible at rest in spot-checks | `[label]` 2; `[observed]` Cofounder 139 shows none painted |
| Lovable | No thumbs labeled; the spec's "Lovable uses rating_prompt" is unsupported — those 10 labels contain no rating UI | `[label]` `feedback_thumbs` 0; Caveat 2 |

Scores — convention strength: per-message thumbs 3/4 as labeled, 2/4 as
verified; the rating prompt 1/4. UX heuristics: thumbs **strong** on low cost
and immediacy; a rating card after a terminal state **strong** on relevance,
**weak** if it can interrupt an in-flight task. Accessibility: a star rating
must be a radio group, not five buttons. Headless fit is decisive — thumbs are
*chrome on a message*, a rating prompt is *content in the transcript*;
conflating them forces layout opinions into core.

**Verdict.** These are two features at different scopes, not two styles of one.
Thumbs attach to a message id and are always available; the rating prompt
attaches to a task's terminal state, appears once, and can carry a comment.

**Recommendation `[observed-default]`.** Ship thumbs as role-scoped actions in
`<MessageActions>` (`thumbs-up` / `thumbs-down`, `data-feedback` holding the
selection), and the rating prompt as a registry-dispatched data part on the
final assistant message — never as transcript chrome. That renderer supports
the expand-to-comment flow (rating, optional comment, consent checkbox,
skip/submit) through slots; the library supplies state and events, not copy.

**Dissent — Manus.** Manus proves richer feedback belongs where the outcome is;
a thumbs-only library would lose the comment and consent affordances. Shipping
the prompt as a part is what keeps them available.

### 3.6 Where do suggested follow-ups go?

| Product | Answer | Evidence |
|---|---|---|
| Manus | Full-width in-transcript rows under a "Suggested follow-ups" heading, each with a chevron, after the last assistant message | `[observed]` Manus 84, 160; OCR "Suggested follow" 54 screens, "Task completed" 54 |
| Lovable | Horizontally scrollable chip row pinned directly above the composer | `[observed]` Lovable 32 |
| Cofounder | In-transcript action cards with explicit Approve / Reject buttons — approval requests, not suggestions | `[observed]` Cofounder 44, 139 |
| Devin | Not observed | `[label]` 0; OCR: no follow-up phrasing |
| All | Zero as a labeled message part | `[label-floor]` `suggested_followups` 0 |

Scores — convention strength: 2/4 for follow-ups as a feature, split 1/1 on
placement. UX heuristics: in-transcript rows **strong** on relevance (they sit
where the answer ended), **weak** on reachability once the user scrolls;
composer chips invert that and compete with the composer's own affordances.
Accessibility: in-transcript rows keep DOM order matching reading order; a
pinned chip row must not be announced as part of the last message. Headless fit
**strong** only if placement is the consumer's call. Portability **strong** —
it is data on a message either way.

**Verdict.** The disagreement is about placement, and placement is app-level IA
— exactly what criterion 4 excludes from the library.

**Recommendation `[observed-default]`.** Model follow-ups as a
`data-suggested-followups` part on the final assistant message. The default
renderer draws in-transcript rows after that message (the observed majority
shape); the composer region can subscribe to the same part and render chips
instead. Selecting one submits its text through the normal send path, so the
transcript stays the single source of truth.

**Dissent — Lovable.** Chips above the composer stay reachable after the user
scrolls up and cost no transcript height. Consumers preferring that set the
transcript renderer to `none` and mount the composer subscriber.

### 3.7 How is time shown?

| Product | Answer | Evidence |
|---|---|---|
| Lovable | Centered in-transcript separator, "Dec 29 at 9:46 AM" / "Dec 30 at 10:27 AM" | `[observed]` Lovable 32, 45, 178/179 |
| Manus | Relative day separators ("Today" / "Yesterday") | `[observed]` Manus 114 via OCR; `[label]` 9 |
| Devin | No transcript separator observed; per-message time inline in the action bar ("2:23 PM") | `[observed]` Devin 89; `[label]` `message_timestamp` 2 |
| Cofounder | No transcript separator observed; timestamps sit on artifact cards ("Jun 20, 10:59 AM") | `[observed]` Cofounder 182 |
| All | The 70-screen 4/4 spread does not survive verification | Caveat 2 |

Scores — convention strength: the labeled 4/4 collapses to roughly 2/4 once
verified, so this is not a solved convention. UX heuristics: separators
**strong** for threads spanning days, **weak** as noise in the single-session
task threads these products mostly are; per-message timestamps **weak** on
repetition. Accessibility: `<time datetime>` is **strong**, a bare "Today"
**weak**. Ergonomics: a slot plus a grouping predicate is two concepts.

**Verdict.** The spec calls day separators "the norm (70 screens, 4/4)"; that
number does not hold up. Two products show them, two do not, and per-message
time is rare everywhere (5 labels corpus-wide, never more than 2 per product).

**Recommendation `[adjusted]`.** Group by calendar day and render a separator
only at a day boundary — never above the first group, so single-day threads
(the common case) show none. The slot receives a `Date` and renders
`<time datetime>` with relative phrasing for today/yesterday. Per-message
timestamps are off by default, available as metadata in the action-bar slot
where Devin puts them. Adjustment: the spec's "groups by calendar day by
default" becomes "day boundaries only, suppressed for a single group", because
the 4/4 evidence for always-on separators is label noise.

**Dissent — Lovable.** Lovable prints a timestamped separator at essentially
every session-resume point, which makes reverts and version history readable
after the fact. Consumers wanting that pass a custom grouping predicate.

### 3.8 How does the transcript handle scroll position?

| Product | Answer | Evidence |
|---|---|---|
| Lovable | Floating chevron above the composer; labeled on 63 screens — far beyond what an occasional state would produce | `[observed]` Lovable 45; `[label]` 63 |
| Manus | Floating circular chevron over the transcript, present on completed-task screens | `[observed]` Manus 84, 160; `[label]` 2 |
| Devin | Labeled twice; not visible in the spot-checked screen | `[label]` 2; `[label-floor]` |
| Cofounder | Labeled 5 times; the rail shows up/down chevrons beside the canvas rather than a transcript button | `[observed]` Cofounder 182; `[label]` 5 |

Scores — convention strength 4/4 as labeled, and the affordance only makes
sense if auto-scroll exists, so the behavior is 4/4 by implication. UX
heuristics **strong**: user control (scrolling up must not be fought) plus
visibility of system status. Accessibility **strong** if the control is a real
button and the log container is a stable `role="log"` / `aria-live="polite"`
never re-created per token. Portability is the weak spot — bottom-proximity
detection needs DOM measurement, so it belongs in adapters, with core owning
only the `atBottom` boolean and the pin/unpin machine.

**Verdict.** No product disagrees about the behavior; they disagree about
whether the button is state-dependent or effectively always present, and stills
cannot settle that (Lovable's 63 labels suggest near-always, but the corpus is
biased toward mid-scroll captures).

**Recommendation `[observed-default]` with `[inferred]` thresholds.** Pin to
bottom while the viewport is within ~1 viewport height of the end; any upward
wheel, touch, or keyboard scroll unpins; while unpinned, `data-at-bottom` flips
and the scroll-to-bottom slot renders; clicking it re-pins and scrolls. Growth
while pinned scrolls without animation. The threshold and re-engagement rule
are `[inferred]` — no still can show them.

**Dissent — Lovable.** An always-visible jump-to-latest control is more
discoverable and removes a state the user must notice; render the slot
unconditionally and ignore `data-at-bottom` to get it.

## 4. Target-behavior summary

| Choice | Target behavior | Tag | Deciding criteria |
|---|---|---|---|
| User container & alignment | `data-role` + role-derived `alignment` (user `end`, assistant `full`), overridable to `start \| end \| full`; no bubble geometry in core | `[observed-default]` | Convention strength; headless fit |
| Identity | Always exposed to assistive tech; painted only on speaker change via `renderIdentity` | `[adjusted]` | Accessibility; headless fit |
| Action bar | Always in the DOM and keyboard-reachable; `visibility: 'auto'` paints persistently on coarse pointers and on the last assistant message, hover/focus-within elsewhere | `[adjusted]` | Accessibility (veto); UX heuristics |
| Reasoning & tool work | Collapsed disclosures with label-or-duration summary; doubles as the pending row; excluded from `copy` | `[observed-default]` | Convention strength; UX heuristics |
| Feedback | Thumbs as message actions; rating prompt as a data part with slots for comment/consent/submit | `[observed-default]` | Headless fit; convention strength |
| Follow-ups | `data-suggested-followups` part on the final assistant message; transcript renders rows by default, composer may subscribe instead | `[observed-default]` | Headless fit; UX heuristics |
| Time | Day-boundary separators only, suppressed for single-group threads; `<time datetime>`; per-message timestamps off by default | `[adjusted]` | Convention strength (label noise); accessibility |
| Scroll position | Stick-to-bottom with unpin on upward gesture; slot renders while unpinned; measurement in adapters | `[observed-default]` + `[inferred]` thresholds | UX heuristics; portability |

All eight compose with the parts-array message model (every divergence above is
either a row-level attribute or a part type), with `MessageNode` tree branching
(nothing above assumes a flat array; separators and follow-ups key off the
selected path), with registry dispatch (reasoning, tool-call, rating prompt, and
follow-ups are all registry entries with an unknown-type fallback), and with the
headless `data-*` contract (no recommendation prescribes layout).

## 5. Gaps and extrapolations

Each `[extrapolation]` states what would falsify it.

- **Branch switcher — 0 labels.** Editing exists (`message_edit_inline` 11, 3/4)
  and Lovable visibly forks ("4 messages reverted" + "Previewing latest
  version", Lovable 32), so branching is real but its navigation UI was never
  captured. `[extrapolation]` Ship the primitive: `<MessageItem>` receives
  `branch: { index, count, onSelect }` when the node has siblings and emits
  `data-branch-index` / `data-branch-count`; D6 requires the data regardless.
  *Falsified if* a capture shows a product rewriting a user message in place
  with no route back to the prior version — then the switcher stops being a
  default-rendered control.
- **Streaming cursor — 0 labels.** Status is carried by pending rows, step
  counters, and disclosures instead. `[extrapolation]` Ship a cursor opt-in,
  off by default. *Falsified if* any screenshot shows a caret trailing streamed
  text — then it becomes a default with an opt-out.
- **Citations and source lists — 0 labels.** No surveyed product surfaces
  web-search-style citations. `[extrapolation]` The `citation` part type stays
  in core (cheap, forward-compatible), no citation UI in v1. *Falsified if* a
  product ships inline source chips or a sources drawer — then a `CitationChip`
  renderer joins the default registry.
- **Code copy button — 0 labels despite 159 code-block screens.** Copy-on-code
  is table stakes and almost certainly hover-revealed, which stills cannot
  show. `[extrapolation]` Ship it, flagged unobserved, resolving visibility the
  same way as §3.3. *Falsified if* zoomed re-inspection of a sample of those 159
  screens finds no copy control in any product — then it becomes opt-in.
- **Retry — 0 OCR hits for "Retry" corpus-wide.** "Regenerate" appears on 10
  screens (Devin 8, Cofounder 2), and on Cofounder 182 it labels an *image*
  regenerate control, not a message one, so the affordance is icon-only or
  buried in a "more" menu. `[inferred]` Ship `retry` as a role-scoped assistant
  action, icon default, no text label. *Falsified if* a capture shows a
  text-labeled retry on an assistant message.
- **Artifact cards — 0 labels despite being visible** in Lovable 32
  ("Previewing latest version", bookmark + Code chip) and Manus 57/84/160 (deck
  preview, "Meeting Summary" document card). `[observed]` Ship the `artifact`
  renderer with `data-artifact-kind`; the zero is a vocabulary artifact, not
  evidence of absence.
- **Hover versus persistent is unprovable from stills.** §3.3 resolves it on
  accessibility grounds rather than evidence. *Falsified by* a capture showing
  actions painted only under the cursor — which would not overturn the `'auto'`
  default but would make `'hover'` the documented majority.
- **Virtualisation is out of scope** (CRITERIA.md excludes performance
  benchmarking). One transcript-side constraint stands: the `role="log"`
  container must survive re-renders, so any virtualisation strategy has to keep
  the live region stable.
