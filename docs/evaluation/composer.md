# Evaluation: Composer & input

Comparative evaluation of the composer surface across Cofounder, Devin, Lovable and
Manus, following the method in `docs/evaluation/CRITERIA.md`. Each divergent choice
resolves to exactly one target behavior for `@aicl/core` + adapters. Inputs:
`docs/domains/composer.md` (inventory and interaction contract), `_corpus/labels/*.json`,
`_corpus/analysis/capabilities.json`, `_corpus/ocr/*.json`, and the screenshots. Composes
with `docs/ARCHITECTURE.md` (headless primitives, `data-*` contract) and
`docs/DECISIONS.md` (D4 status machine, D11 registry).

## 1. Scope and data

The domain spec flags the label pipeline as under-detecting composers and estimates
"~200 screens, not 98". That was too conservative. Anchoring on OCR text — matching each
product's placeholder string in `_corpus/ocr/*.json` and taking the lowest-positioned
match as the composer anchor — finds a composer on **431 of 1,262 screens**, in all four
products:

| Product | Labelled composers | OCR-anchored composers | Docked (anchor y > 0.70) | Hero / other |
|---|---|---|---|---|
| Cofounder | 31 | 127 | 127 | 0 |
| Devin | 19 | 85 | 72 | 13 |
| Lovable | 20 | 146 | 113 | 33 |
| Manus | 28 | 73 | 71 | 2 |
| **Total** | **98** | **431** | **383** | **48** |

`[label-floor]` The 98 figure under-represents right rails and narrow chat columns. All
per-affordance counts below come from labels and inherit that floor; placement,
placeholder and toolbar counts come from OCR geometry and are far tighter. Zero counts
everywhere mean "not detected", never "absent". OCR's normalized coordinates make slot
classification deterministic: 374 of 431 anchors fall in `y ∈ [0.78, 0.88]`.

### Corrections to the domain spec

Five claims in `docs/domains/composer.md` did not survive verification; two drive API
shape.

1. **Manus `4/4` / `3/3` are not attachment chips.** `[observed]` They are a collapsed
   **step-progress rollup with an expand caret**, docked above the composer on 66 Manus
   screens: `Manus 130` pairs "Test and finalize file management dashboard" with "4/4 ^"
   at y≈0.761, placeholder at y≈0.812; `Manus 61` likewise with "3/3^". Contract rule 5's
   "progress fraction on attachment chips" should be withdrawn — the corpus shows **no**
   attachment progress anywhere.
2. **Cofounder 132 is not a landing hero with category chips.** `[observed]` It is an
   Agent Workspace whose right rail holds a compact composer with a `Sales Agent`
   recipient chip above the input. OCR finds zero occurrences of "SaaS Landing" or
   "Dashboard UI" in 1,262 screens.
3. **Devin 147's "Add a comment…" is in the main PR-review column**, not a right rail,
   and its submit control is a detached split button in the page header — a stronger case
   for the send-options slot than the spec's reading.
4. **Cofounder's `1/5`…`5/5` near the composer band are onboarding wizard step dots.**
   `[observed]` `Cofounder 29` shows them under a 5-step onboarding card in the main
   column while an unrelated rail composer sits to the right.
5. **Lovable's "Design / Cloud / Analytics / Code / Security / Speed" strings adjacent to
   the composer are a pinnable tool-menu overlay** (`Lovable 114`), not composer banners.
   Only "Security 1 Error" (4 screens, `Lovable 178`) is a real composer-docked banner.

## 2. Settled conventions (4/4, not matrixed)

| Convention | Evidence | Target behavior |
|---|---|---|
| Multi-line text field is the primary input | `text_entry` 77 screens, 29/19/9/20 `[label]` | Textarea-backed, `aria-multiline="true"` |
| File attach via a leading `+` / paperclip in the toolbar | `file_upload` 62 screens, 20/16/6/20 `[label]`; OCR `+` below the input on 93 Cofounder / 38 Manus / 8 Lovable / 9 Devin screens `[observed]` | Leading toolbar slot, first position |
| Image paste and drag-drop into the field | `image_paste` 29 screens, 12/6/3/8 `[label]` | Paste and drop handlers on the field |
| Staged attachments render as chips outside the field | `attachment_preview` 52 screens, 10/10/15/17 `[label]` | `<AttachmentChip>` row, each removable |
| Circular send button, trailing edge of the toolbar | `send` 21 `[label]`; visible in `Devin 214`, `Lovable 114`, `Manus 21/130`, `Cofounder 29` `[observed]` | Single button, trailing slot, last position |
| Composer is docked to the bottom of its column by default | 383 / 431 anchors `[observed]` | `data-placement="docked"` default |
| Toolbar splits into a leading and a trailing group | 4/4 in every spot-check `[observed]` | Two named slots, no fixed contents |
| Composer stays interactive while the agent streams | `interrupt_control` co-occurs on 15 composer screens `[label]`; `Manus 21` keeps the placeholder live mid-stream `[observed]` | Field never disabled by `streaming` |

## 3. Divergent choices

### C1. Which placement slots must one component serve?

| Product | Answer | Evidence |
|---|---|---|
| Cofounder | Docked only (127/127), in either the main column or a narrow right rail | `[observed]` OCR anchors; `Cofounder 29` rail composer |
| Devin | Docked (72) + hero (13) + a bare in-page comment variant | `[observed]` `Devin 214` hero, `Devin 147` comment field |
| Lovable | Docked (113) + hero (33) with rotating marketing placeholders | `[observed]` OCR anchors |
| Manus | Docked (71) + 2 hero screens (schedule-task dialog) | `[observed]` OCR anchors |

Criteria: convention strength, headless fit, ergonomics. Accessibility and portability
are neutral — placement is layout, not behavior. "One component, slot as a data
attribute" scores **strong** on headless fit (consumer owns positioning) and ergonomics;
"separate hero and docked components" scores **weak** on both (duplicate props and state
for the same visual grammar).

**Verdict.** Docked is a 4/4 convention and the only one all products ship. Hero is a 3/4
empty-state rendering of the *same* component, larger and with a different placeholder;
the rail variant is the same component in a narrower box with the toolbar chips dropped.
One component plus a placement hint covers all three; the trade is that the library ships
the hook, not the visual differences.

**Recommendation** `[observed-default]`: one `<Composer>` component; expose
`data-placement="docked | hero | rail"` (default `docked`) as a styling hook only, with
no behavioral difference other than the default placeholder. Styling of each slot is
`@aicl/styles` territory.

**Dissent:** Devin's bare comment field scores better on cognitive load — no toolbar,
submit moved to a page-level split button. The recommendation supports that only by
leaving the toolbar slots empty, which is weaker than a purpose-built inline variant.

### C2. What occupies the band between the transcript and the input?

All four products dock *something* in this band, and no two dock the same thing.

| Product | Answer | Evidence |
|---|---|---|
| Cofounder | Agent/recipient chip inside the composer card ("Cofounder" ×52, "Sales Agent" ×14, "Marketing Agent" ×4) | `[observed]` OCR, band `y ∈ [anchor−0.05, anchor)` |
| Devin | Essentially nothing; occasional onboarding nudge ("Set up your wiki" ×21) | `[observed]` OCR band scan |
| Lovable | Follow-up suggestion chips (143 blocks; 56 screens with ≥2 chips) plus a rare advisory banner ("Security 1 Error", 4 screens) | `[observed]` `Lovable 114`, `Lovable 178` |
| Manus | Collapsed step-progress rollup with expand caret (66 screens) plus a streaming status pill ("Manus is working • 0:03 Thinking") | `[observed]` `Manus 21/61/130` |

Criteria: headless fit, UX heuristics, ergonomics. Convention strength is 4/4 on *the
slot existing* and 0/4 on its contents. "Named slot, consumer-filled" scores **strong**
on headless fit (four payloads prove the library must not pick one); "ship a first-class
progress rollup" scores **weak** on headless fit but **strong** on status visibility.

**Verdict.** The clearest case in the domain of a slot whose contents are app-level
opinion. The library owes a stable, single, accessible region between transcript and
input; what goes in it — recipient chip, suggestion chips, error banner, progress rollup
— is the consumer's. One slot rather than three keeps focus order and live-region
semantics predictable.

**Recommendation** `[observed-default]`: add `<Composer.Above>` — one slot between the
transcript and the composer card, inside the composer's focus scope, carrying
`data-aicl="composer-above"`. Ship `<SuggestionChips>` and `<AttachmentChip>` as optional
children; do not ship a progress rollup here (that is `docs/domains/agent-execution.md`
territory, rendered into this slot by the consumer).

**Dissent:** Manus scores better on status visibility by owning this region outright, so
the rollup is always adjacent to the input; a consumer-filled slot can be left empty.

### C3. Send/stop morph, and where interrupt actually lives

| Product | Answer | Evidence |
|---|---|---|
| Manus | Send morphs in place into a filled stop square while streaming | `[observed]` `Manus 21` (stop square + status pill) vs `Manus 61` (up-arrow) |
| Cofounder | Interrupt lives outside the composer as "Stop task" in the agent/task panel (`x≈0.82, y≈0.36`) | `[observed]` `Cofounder 84` — the only literal "Stop" control in 1,262 screens |
| Devin | Not captured; no stop control text or icon in any Devin composer screenshot | `[label-floor]` |
| Lovable | Not captured | `[label-floor]` |

`stop_generation` has **0** labels corpus-wide `[label-floor]`; the morph is visible only
in pixels. Criteria: accessibility, UX heuristics, headless fit, ergonomics. In-place
morph scores **strong** on accessibility (the focused element survives idle→streaming;
two conditionally-rendered buttons destroy focus mid-stream) and ergonomics. The
out-of-composer interrupt scores **strong** on discoverability when the agent surface is
the visual center, **weak** on accessibility (far from the post-submit focus point).

**Verdict.** Only two products expose an interrupt and they disagree on where.
Accessibility breaks the tie: whatever the visual treatment, the control must be one
persistent DOM node so focus survives the state flip. Cofounder's placement is a
legitimate app choice, so interrupt must also be renderable elsewhere — but the default
belongs in the composer.

**Recommendation** `[adjusted]`: `<Composer.SendButton>` is **one** button that renders
send or stop from `ChatStatus`, never two toggled nodes; `data-role="send|stop"`,
`aria-label` swaps with the role. Adjusted from the corpus in that Cofounder's external
interrupt is supported by exposing `stop()` on the chat store rather than by moving the
default control.

**Dissent:** Cofounder scores better on cognitive load for long agent runs, where the
task panel is where the user is already looking.

### C4. What belongs in the toolbar groups?

| Product | Leading group | Trailing group | Evidence |
|---|---|---|---|
| Cofounder | `+` only (93 screens) | Send (no mic) | `[observed]` OCR + `Cofounder 29` |
| Devin | `+`, mode chip "Default"/"+ Default" (41), "Plan ⌄" (5) | Mic, send + chevron | `[observed]` `Devin 214`, OCR |
| Lovable | `+`, "Visual edits" tool chip (~60) | "Chat" mode chip (107), mic, send | `[observed]` `Lovable 114`, OCR |
| Manus | `+`, integration chips (Gmail/Calendar/Drive, ~30) | Send | `[observed]` `Manus 130`, OCR |

Voice: `voice_dictation` 17 screens, 0/1/11/5 `[label]` — 3/4, absent from every
Cofounder composer inspected. Mode/model selection: **0** labels `[label-floor]`, but
visible in 3/4 via OCR chips (Devin "Default", Lovable "Chat", Cofounder's recipient chip
in C2). Note Lovable puts its mode chip in the *trailing* group, Devin in the *leading*
group — the groups are not semantically stable across products.

Criteria: convention strength, headless fit, ergonomics. "Two unopinionated slots" scores
**strong** on headless fit and convention strength (the left/right split is 4/4; the
contents are not); "typed props for mode/model/voice" scores **weak** on both headless
fit and forward compatibility.

**Verdict.** The only cross-product invariant is the split itself plus `+` first and send
last. Everything between is product IA. Typed `modes` / `models` props would encode one
product's layout; slots do not.

**Recommendation** `[observed-default]`: `<Composer.Toolbar>` with
`<Composer.LeadingSlot>` and `<Composer.TrailingSlot>`; the library ships only
`<Composer.AttachButton>` (pinned first in leading) and `<Composer.SendButton>` (pinned
last in trailing). Mode, model, tool, integration and voice controls are consumer
children. `Draft.metadata?: Record<string, unknown>` carries whatever selection the
consumer wired, so the choice travels with the message.

**Dissent:** Devin scores better on API ergonomics for the common case — a typed `mode`
prop would give consumers a correct, accessible dropdown for free instead of requiring
them to build one.

### C5. Is the placeholder contextual or invariant?

| Product | Answer | Evidence |
|---|---|---|
| Cofounder | Contextual: 4 distinct strings, scoped to surface and agent | `[observed]` "Ask Cofounder anything about your company…" (61), "Ask for any changes and use @ to add context from other departments…" (46), "Ask for follow up changes…" (17) |
| Devin | Contextual: scoped to repo/feature | `[observed]` "Ask Devin to build features, fix bugs, or work on your code" (50), "Ask Devin about your codebase" (21), "Ask Devin about calendar-todo" (5) |
| Lovable | Invariant when docked (112/113 = "Ask Lovable…"), rotating marketing copy in hero | `[observed]` hero variants: "…to build your saas startup.", "…to build web apps.", "…to build dashboards." |
| Manus | Fully invariant: "Send message to Manus" on 71/71 docked screens | `[observed]` |

Criteria: convention strength, UX heuristics, ergonomics. Accessibility is
neutral-to-negative for all — placeholder text is not a label in any product. Contextual
scores **strong** on learnability (Cofounder's placeholder is the *only* place the
`@`-mention grammar is taught, on 46 screens); invariant scores **strong** on consistency
and cognitive load.

**Verdict.** 4/4 use a branded placeholder; 3/4 vary it by context (Cofounder, Devin, and
Lovable's hero). Since the string is always consumer-supplied, the library's only real
decision is whether the default differs by placement slot — and hero-vs-docked is the one
variation 2/4 products actually make.

**Recommendation** `[observed-default]`: `placeholder?: string` with a neutral default,
resolved per `data-placement` so hero and docked can differ without a second component.
Placeholder is never the accessible name — require `aria-label` or a visually-hidden
`<label>` regardless.

**Dissent:** Manus scores better on consistency; a single invariant string is the safer
default for consumers who will not curate per-surface copy.

### C6. Slash and mention grammar

| Product | Answer | Evidence |
|---|---|---|
| Manus | `/`-tokens as first-class skills, inlined into the sent message text | `[observed]` 25 screens with `/skill-creator`-style tokens; `slash_commands` 5 `[label]` |
| Cofounder | `@`-mentions for cross-department context, taught in the placeholder | `[observed]` 46 screens with "use @ to add context…" |
| Devin | `@devin` mentions inside review comments | `[observed]` 9 screens |
| Lovable | Not detected | `[label-floor]` (`slash_commands` 1) |

**Zero screens in the corpus show an open slash or mention menu.** `at_mentions` has 0
labels. Criteria: convention strength (3/4 for *some* trigger grammar, 0/4 for menu UX),
accessibility, ergonomics, portability. "One combobox primitive with configurable trigger
characters" scores **strong** on ergonomics (one concept covers both grammars) and
portability (a pure state machine over text + caret); two separate primitives score
**weak** on ergonomics with no compensating win.

**Verdict.** Three of four products ship a trigger grammar and none shows its menu, so
the behavior must be designed from convention. The grammars differ only in trigger
character and in what selection inserts: Manus's slash tokens serialize verbatim into
`Draft.text`, while mentions are entity references the consumer resolves.

**Recommendation** `[extrapolation]`: one `<TriggerMenu>` combobox primitive configured
by trigger character, surfaced as `<SlashMenu>` and `<MentionMenu>` presets.
`data-state="open|closed"`, `aria-activedescendant`, arrow keys to move, Enter/Tab to
accept, Escape to close *without* clearing the field, and the trigger only fires at a
word boundary. Slash selections insert verbatim text; mention selections insert text plus
a structured entry in `Draft.mentions`. *Falsified if* a later corpus shows a product
opening a menu with click-only selection, or slash commands that are stripped from the
message rather than sent verbatim.

**Dissent:** none — no product ships an observable alternative.

### C7. Suggestion chips: where, and insert or send?

| Product | Answer | Evidence |
|---|---|---|
| Lovable | Horizontally scrollable chip row directly above the composer card, clipped at the column edge | `[observed]` `Lovable 114` ("Add Project Images", "Add Contact Form", "Add Scroll Animatio…"); 56 screens with ≥2 chips |
| Cofounder | Rare; a "SUGGESTED NEXT" label with prompts near the composer (3 screens) | `[observed]` OCR |
| Devin | 2 screens | `[observed]` |
| Manus | Not detected | `[label-floor]` |

Criteria: convention strength (1.5/4 — one product's bet), headless fit, UX heuristics.
Click semantics (insert vs send) are unobservable in stills. Chips as a separate region
score **strong** on headless fit (no coupling to the field); chips inside the field score
**weak** — no product does it, and it complicates caret and autosize behavior.

**Verdict.** Effectively Lovable's convention, but its placement (outside the field,
adjacent to it) is the only one anyone uses, and it composes with C2's slot at zero extra
cost. Per the reconciliation rule a ≤2/4 convention ships opt-in — which a slot-rendered
child already is.

**Recommendation** `[adjusted]`: `<SuggestionChips>` ships as an optional child of
`<Composer.Above>`, never inside the field, with
`onSelect(suggestion, behavior: 'insert' | 'send')` defaulting to `'insert'`. Adjusted
because the corpus cannot show click semantics; `'insert'` is chosen because it is
recoverable — the user can edit before committing — whereas `'send'` is not.

**Dissent:** Lovable scores better on latency perception with send-on-click; one tap
starts the run.

### C8. Disabled, paywalled and error presentation

| Product | Answer | Evidence |
|---|---|---|
| Devin | Upsell chip adjacent to the composer: "1 Upgrade" on 55 screens, "Upgrade plan" copy on 24 | `[observed]` OCR band below anchor |
| Lovable | Plan/credit copy on 9 screens; advisory banner docked above the input ("Security 1 Error · Review") on 4 | `[observed]` `Lovable 178` |
| Cofounder | Neither detected near the composer | `[label-floor]` |
| Manus | Neither detected near the composer | `[label-floor]` |

**No screen in the corpus shows a fully disabled composer.** Criteria: UX heuristics
(error prevention and recovery), accessibility, headless fit. "Never disable, explain
adjacent" scores **strong** on user control (the draft survives, the field stays
focusable) and matches 2/4 observed behavior; "disable the field" scores **weak** on
accessibility — a disabled control leaves the tab order and announces nothing.

**Verdict.** The two products that hit limits both keep the field live and put the
explanation beside it. That is also the accessible answer: disable the *submit*, never
the field, and give the reason a programmatic association.

**Recommendation** `[adjusted]`: `disabledReason?: string` disables only the send control
and is exposed via `aria-describedby` on the field plus
`data-state="disabled"`+`data-disabled-reason` on the root; the textarea itself stays
enabled and editable. Error banners render into `<Composer.Above>` as a live region.
Adjusted because the corpus never shows the reason attached to the composer at all — it
sits in unrelated chrome.

**Dissent:** none — no product ships a better-scoring alternative.

## 4. Target-behavior summary

| Choice | Recommendation | Tag | Deciding criteria |
|---|---|---|---|
| C1 Placement | One component; `data-placement="docked\|hero\|rail"`, docked default | `[observed-default]` | Convention strength, headless fit |
| C2 Above-input band | One `<Composer.Above>` slot; consumer supplies contents | `[observed-default]` | Headless fit, ergonomics |
| C3 Send/stop | Single morphing `<Composer.SendButton>`; `stop()` also on the store | `[adjusted]` | Accessibility (focus preservation) |
| C4 Toolbar | Leading/trailing slots; only attach and send pinned; `Draft.metadata` carries selections | `[observed-default]` | Headless fit, convention strength |
| C5 Placeholder | `placeholder` prop, default resolved per placement; never the a11y name | `[observed-default]` | UX heuristics, accessibility |
| C6 Slash/mention | One `<TriggerMenu>` combobox, `/` and `@` presets, full keyboard model | `[extrapolation]` | Ergonomics, accessibility |
| C7 Suggestion chips | Optional child of `<Composer.Above>`; `onSelect` defaults to `'insert'` | `[adjusted]` | UX heuristics (recoverability) |
| C8 Disabled/error | Disable send only, never the field; reason via `aria-describedby` | `[adjusted]` | Accessibility, error recovery |

### Refinements to the domain spec's API sketch

The sketch in `docs/domains/composer.md` stands; four changes follow. (1) Add
`<Composer.Above>` as a named slot (C2) and render `<SuggestionChips>` and the attachment
chip row into it. (2) Replace `state: 'idle' | 'submitted' | ...` with D4's `ChatStatus`
plus derived attributes (`data-state="ready|submitted|streaming|error"`,
`data-disabled`), so the composer cannot drift from the conversation machine. (3) Confirm
`canSubmit = (hasText || hasAttachments) && status !== 'submitted' && !disabled` —
attachments-only sends are allowed by contract rule 3. (4) Keep `progress?: number` on
`Attachment` but relabel its justification as an extrapolation (§5.3), since the Manus
fractions were task progress.

### Deltas against the current `@aicl/react` implementation

`packages/react/src/Composer.tsx` diverges in four ways: it renders two separate buttons
(`composer-stop`, `composer-send`) chosen by `isBusy`, losing focus at the
idle→streaming boundary (C3); `canSubmit` requires non-empty trimmed text, so
attachments-only drafts cannot be sent (rule 3); it emits only `data-aicl="composer"` and
`data-busy`, missing `data-state`, `data-placement`, `data-has-text` and
`data-has-attachments` (C1, C5, C8); and it collapses `submitted` and `streaming` into
one `isBusy` boolean, so the stop control appears during `submitted` when there is
nothing to stop (D4). IME handling and Enter/Shift+Enter already match the contract.

## 5. Gaps and extrapolations

Each item states what the corpus cannot decide and what would falsify the position.

1. **IME safety.** Unobservable in pixels. Position: never submit while `isComposing`,
   guarding with both the composition events and the property. Not falsifiable from
   pixels — a correctness rule, not a design choice.
2. **Character/token counter.** Zero of 431 composers show one, yet three products build
   counters elsewhere: 15 screens carry `n/limit` counters in settings and knowledge
   forms (`Cofounder 350/369–371` "0/2000"; `Lovable 268/299–303` "0 / 500 characters";
   `Manus 234/259–262` "/2000"). They know how and choose not to. Position: opt-in only,
   off by default. *Falsified if* a composer screenshot shows a live counter.
3. **Per-file upload progress and retry.** Zero composer chips show progress (the Manus
   fractions were task rollups, §1). But `Cofounder 29` shows a six-slot upload grid in
   onboarding with per-file progress bars and "Uploading 25%" / "Finalizing" labels — the
   pattern exists in-product, just not in a composer. Position `[adjusted]`: keep
   `status: 'uploading' | 'ready' | 'error'` and `progress` on `Attachment`, borrowed
   from that adjacent surface. *Falsified if* a product blocks send until uploads finish.
4. **Draft persistence.** No evidence unsent drafts survive navigation; "draft" appears
   on 80 screens, all content drafts. Position: expose `value`/`onChange` for consumers
   to persist, ship no storage. *Falsified if* a restored-draft indicator is observed.
5. **Queued messages during streaming.** The field stays live mid-stream (`Manus 21`) but
   no screen shows a mid-stream send. Position: `submitted` is a hard no-op for send;
   queueing is transport-layer, out of scope for v1. *Falsified if* a queued-message chip
   or pending-send indicator is observed.
6. **Voice recording states.** `voice_dictation` on 17 screens (0/1/11/5) shows the mic
   button, never a recording or interim-transcript state. Position: ship the trailing
   slot and no voice primitive in v1. *Falsified if* a recording state with waveform or
   interim text is observed, which would justify a state machine.
7. **Autosize cap.** `multiline_expand` has 0 labels; `Lovable 18` shows a 4-line
   expanded hero input, every docked composer is single-line at rest. Position: `maxRows`
   default 10, then internal scroll. The measurement is DOM-bound, so it lives in
   adapters, not `@aicl/core`. *Falsified if* a composer grows past ~10 rows without
   internal scroll.
8. **Send-options menu contents.** The chevron beside send (`Devin 214`) and the detached
   "Comment ⌄" split button (`Devin 147`) prove the slot exists on 1/4 products; no
   screen shows it open. Position: expose the slot, ship no menu. *Falsified if* an
   opened menu reveals behavior the send button must coordinate with.
