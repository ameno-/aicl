# Domain: Message transcript & rendering

The scrollback: message rows and bubbles, part rendering, message actions,
feedback, suggested follow-ups, and streaming affordances. Grounded in the
1,262-screenshot corpus (`ai-chat/_corpus`). Consistent with
`docs/ARCHITECTURE.md` and `packages/core/src/types.ts`.

Counts below come from `_corpus/labels/*.json`. A screen "has" a component or
part if the labeler listed it; counts are lower bounds (see Gaps). 414 of 1,262
screens carry transcript content (message parts other than `none`, or a
transcript-family component).

## Inventory

### Message parts (screens where part appears)

| Part type | Screens | Product spread |
|---|---:|---|
| markdown_rich | 70 | 4/4 |
| image_attachment | 40 | 4/4 |
| code_block | 25 | 4/4 |
| plain_text | 6 | 2/4 |
| list | 6 | 3/4 |
| file_attachment | 5 | 2/4 |
| link_preview | 4 | 2/4 |
| inline_code | 2 | 1/4 |
| table | 2 | 2/4 |
| reasoning_trace | 0* | — |
| tool_invocation / tool_result | 0* | — |
| citation | 0* | — |
| suggested_followups | 0* | — |

\* Zero as *labeled message parts*, but visible in screenshots: "Thought for
24s" reasoning blocks (Lovable), "Worked for 11s" collapsible work summaries
(Devin), "Loading skill …" step rows (Manus). See Gaps.

### Transcript components (screens where component appears, corpus-wide)

| Component | Screens | Product spread | Notes |
|---|---:|---|---|
| message_actions_bar | 215 | 4/4 | The most-detected transcript component. |
| code_block | 159 | 4/4 | Part-level code, detected as component too. |
| message_list | 155 | 4/4 | 0 in Devin labels despite visible transcripts — under-detection. |
| scroll_to_bottom | 72 | 4/4 | Lovable 63, others 2–5. |
| date_separator | 70 | 4/4 | "Dec 29 at 1:35 PM" style. |
| feedback_thumbs | 45 | 3/4 | Manus 41, Devin 2, Cofounder 2; 0 Lovable (uses rating_prompt). |
| tool_call_card | 13 | 3/4 | Plus tool_call_collapsed: 4 (2/4). |
| message_edit_inline | 11 | 3/4 | Cofounder 6, Devin 4, Lovable 1. |
| rating_prompt | 11 | 2/4 | Lovable 10, Manus 1 ("How was this result? ★★★★★"). |
| typing_indicator | 7 | 2/4 | Cofounder "Writing…", Lovable "Thinking". |
| message_timestamp | 5 | 4/4 | Per-message time is rare; date separators dominate. |
| message_bubble_user | 4 | 1/4 | Bubbles are user-side only; assistant is full-width rows. |
| message_bubble_assistant | 5 | 2/4 | |
| message_avatar | 2 | 2/4 | Avatars are near-absent as labeled components. |
| reasoning_block | 1 | 1/4 | Under-detected (see Gaps). |
| streaming_cursor | 0 | — | |
| message_branch_switcher | 0 | — | |
| citation_chip / source_list | 0 | — | |
| code_copy_button | 0 | — | |
| artifact_card | 0 | — | Artifact/version cards visible in screenshots instead (Lovable 32, Manus 160). |

## Observed conventions (spot-check, 8 screenshots, 4 products)

- **Alignment.** User messages are right-aligned tinted bubbles (Cofounder 44,
  Lovable 32/45, Manus 21). Assistant turns are full-width left-aligned rows in
  all four products. Devin uses full-width rows for *both* roles (no bubbles).
  Bubble styling is a per-role, per-product variant, not a universal.
- **Identity.** Assistant turns carry an icon + display name above the row
  ("Cofounder", "manus"); user turns have no avatar. Per-message avatars are
  essentially absent (2/1,262).
- **Time.** Day/time separators between groups ("Dec 29 at 1:35 PM") are the
  norm (70 screens, 4/4). Per-message timestamps appear inline in the action
  bar (Devin: "2:23 PM"), not under the bubble.
- **Action bar.** Persistent, right-aligned icon row below an assistant
  message: thumbs up/down, copy, share/link, more (Devin 89); revert, copy,
  more (Lovable 32). Nothing in stills shows hover-reveal; persistent placement
  is the observed pattern. (Hover vs. persistent cannot be fully settled from
  screenshots — inference noted in the contract.)
- **Reasoning.** Collapsible "Thought for 24s" / "Thinking" blocks with dimmed
  gray content (Lovable 45, Cofounder 20). During a pending turn, the same
  reasoning-style row doubles as the waiting indicator (Lovable 177: bare
  "Thinking" under the user bubble; Manus 21: "Thinking" with a status dot
  inside a "Manus is working" disclosure).
- **Tool/work parts.** Interleaved inline with prose in one assistant turn:
  prose → "6 tools used / Show all" → prose → "Screenshot taken" chip → prose
  (Lovable 45); "Worked for 11s" disclosure containing nested thought and step
  rows (Devin 89); "Loading skill …" sub-steps (Manus 21).
- **Feedback.** Two shapes: persistent thumbs in the action bar (Devin, and
  Manus's 41 labeled thumbs screens), and a post-completion rating prompt —
  "How was this result? ★★★★★" rendered in-transcript after "Task completed"
  (Manus 160, Manus 98).
- **Suggested follow-ups.** Two placements: in-transcript full-width rows with
  chevrons after the final assistant message (Manus 160), and a chip row pinned
  above the composer (Lovable 32). Both must be representable.
- **Attachments.** File chips render above the user bubble text
  ("AS_Mobbin_About_Com… 1.5 MB", Cofounder 20); image attachments render
  inside the user bubble (Lovable 32); generated-file cards render as assistant
  parts ("test-report.md 2.3 KB", Devin 89).
- **Streaming controls.** Stop button replaces send in the composer while
  generating (Cofounder 44, Lovable 45/177, Manus 21). Cofounder shows an
  in-transcript "✍ Writing…" typing indicator.
- **Scroll affordances.** Floating scroll-to-bottom chevron over the transcript
  (Lovable 45) and a floating download/chevron button (Manus 160).
- **Editing/versioning.** Editing reverts and forks: Lovable shows a
  "4 messages reverted" banner with a "Show" affordance, and per-message
  "Previewing latest version" cards — edit creates a new branch/version, it
  does not rewrite history.

## Interaction contract

Rules marked **[observed]** appear in spot-checked screenshots or labels;
**[inferred]** are extrapolations a library should ship but the corpus cannot
prove from stills.

1. **Streaming updates in place. [observed]** A turn grows within its row:
   reasoning row first ("Thinking"), then prose, then tool/step rows
   interleaved (Lovable 45/177, Manus 21). The transcript must not re-create
   the message element per token — indexed part deltas (`part-delta` in
   `types.ts`) exist for exactly this.
2. **Pending ≠ streaming. [observed]** Between submit and first output the UI
   shows a reasoning-style pending row ("Thinking") and a stop affordance
   (Lovable 177). This maps to the `submitted` vs `streaming` split in core's
   state machine.
3. **Stick-to-bottom with user-scroll override. [inferred, partially
   observed]** `scroll_to_bottom` buttons appear in 72 screens across all four
   products, which only makes sense if (a) new content auto-scrolls while the
   user is at the bottom and (b) scrolling up suspends auto-scroll and surfaces
   the button. The stills cannot show motion, so the exact threshold and
   re-engagement rule are the library's to define: pin to bottom while within
   ~1 viewport of the end; any upward wheel/touch gesture unpins; the button
   appears while unpinned and re-pins on click.
4. **Stop preserves partial output. [observed]** Partial assistant content
   stays in the transcript after interrupt, with a terminal status
   ("Stopped working", Devin 89; "Devin went to sleep"). Core keeps the partial
   message flagged `aborted` rather than discarding it.
5. **Message actions are per-message and role-scoped. [observed]** Assistant
   rows carry copy / feedback / share / more; user rows carry edit
   (`message_edit_inline`, 11 screens, 3 products). Retry/revert lives on the
   assistant turn it regenerates (Lovable's revert icon + "messages reverted"
   banner). Actions bar is **persistent in the observed screens**; hover-reveal
   may exist but is unprovable from stills, so adapters should support both via
   a prop, defaulting to persistent-on-touch / hover-on-desktop. **[hover:
   inferred]**
6. **Copy semantics exclude reasoning. [inferred from structure]** "Thought
   for 24s" blocks are visually distinct, collapsed, and labeled as process,
   not answer. `ReasoningPart` is a separate type in core precisely so that
   "copy message" concatenates text/code parts only, skipping reasoning,
   tool-call, and error parts. Tool results and citations are included only if
   the consumer opts in.
7. **Edit forks; it never rewrites. [observed]** Lovable's "4 messages
   reverted" + version cards mean the transcript is a tree rendered as the
   selected path (see `MessageNode` in core). A branch switcher ("‹ 2/3 ›")
   should appear on user messages with siblings — see Gaps.
8. **Feedback is two distinct widgets. [observed]** Thumbs on the action bar
   (quick, per-message) and a rating prompt rendered as transcript content
   after a terminal state ("How was this result? ★★★★★" after "Task
   completed"). They are not interchangeable: one is chrome, one is a part.
9. **Suggested follow-ups are a part, placed by the consumer. [observed]**
   Manus renders them in-transcript; Lovable renders chips above the composer.
   Model as a `suggested-followups` data part on the final assistant message;
   the transcript renderer and the composer region can both subscribe.
10. **Unknown parts must not crash the transcript. [inferred, architectural]**
    Registry dispatch with an unregistered-type fallback (ARCHITECTURE.md) —
    a server adding a part type cannot white-screen an older client.

## Component API sketch

Headless primitives, consistent with `docs/ARCHITECTURE.md` and
`packages/core/src/types.ts`. Framework adapters (React/Svelte/Vue) bind these
to native reactivity; core stays DOM-free.

### `<Transcript>`

Virtualised scroll container over the selected branch path.

| Prop | Type | Notes |
|---|---|---|
| `path` | `string[]` | Message ids along the active branch (from `ChatState.path`). |
| `streamingId` | `string \| undefined` | Drives per-message `data-state="streaming"`. |
| `stickToBottom` | `boolean \| { thresholdPx?: number }` | Default `true`, threshold ~1 viewport. |
| `onAtBottomChange` | `(atBottom: boolean) => void` | Consumer shows/hides its own scroll-to-bottom button, or uses the shipped one. |
| `renderScrollToBottom` | `slot` | Defaults to a floating chevron button (observed in Lovable/Manus). |
| `renderDateSeparator` | `slot` | Groups by calendar day by default; 70/4-product convention. |

Attributes: `role="log"`, `aria-live="polite"` on a stable container (never
re-created per token — screen readers re-announce the whole conversation
otherwise), `data-state="idle|submitted|streaming|error"`.

### `<MessageItem>`

One message row; provides message context to children.

| Prop | Type | Notes |
|---|---|---|
| `message` | `Message` | From core. |
| `isStreaming` | `boolean` | `message.id === streamingId`. |
| `branch` | `{ index: number; count: number; onSelect(i): void } \| undefined` | Present when the node has siblings; renders the branch switcher. |
| `alignment` | `'start' \| 'end' \| 'full'` | Default derived from role: user `end`, assistant `full`. Devin-style = override user to `full`. |
| `onEdit` | `(newText: string) => void` | User messages; forks the branch. |
| `onRetry` | `() => void` | Assistant messages; regenerates from parent. |

Attributes: `data-role`, `data-state="streaming|aborted|error"`,
`data-branch-index`, `data-branch-count`. Pending indicator ("Thinking") is
rendered by the assistant `MessageItem` when `isStreaming && parts.length === 0`
— the observed convention, not a separate typing-indicator primitive
(`typing_indicator` was labeled in only 7 screens, always adjacent to a
pending turn).

### `<PartRenderer>`

Registry dispatch, per ARCHITECTURE.md:

```ts
const registry = createRendererRegistry({
  text: MarkdownPart,                 // markdown engine is pluggable
  reasoning: ReasoningDisclosure,     // "Thought for 24s", collapsed by default
  'tool-call': ToolCallDisclosure,    // "Worked for 11s" / "Loading skill …"
  file: FileChip,                     // upload chip above/in bubble
  citation: CitationChip,
  artifact: ArtifactCard,             // versioned; "Previewing latest version"
  error: ErrorNotice,                 // with retry affordance if retryable
  'data-suggested-followups': FollowupRows,  // consumer-registered
});
```

Each rendered part carries `data-part="<type>"` and, where relevant,
`data-tool-status`, `data-collapsed`, `data-artifact-kind`,
`data-error-retryable`. Unknown types hit a registered fallback.

### `<MessageActions>`

Persistent or hover-revealed icon bar below a message.

| Prop | Type | Notes |
|---|---|---|
| `message` | `Message` | |
| `actions` | `('copy' \| 'thumbs-up' \| 'thumbs-down' \| 'retry' \| 'edit' \| 'share' \| 'branch' \| 'more')[]` | Role-scoped defaults: assistant gets copy/feedback/retry/share; user gets edit/copy. |
| `visibility` | `'persistent' \| 'hover'` | Default `persistent` (observed); `hover` is a supported variant. |
| `onAction` | `(action, message) => void` | Library implements `copy` itself (text/code parts only; reasoning, tool, and error parts excluded — see rule 6). |

Attribute: `data-visibility`, plus `data-message-id` for styling hooks.

## Variants & states

**Per-product layout variants** (all expressible via props, not forks):

| | User row | Assistant row | Identity | Follow-ups | Feedback |
|---|---|---|---|---|---|
| Cofounder | right bubble, right-rail chat | full-width | icon + "Cofounder" | action cards in-transcript | thumbs (2 screens) |
| Lovable | right bubble | full-width | none | chips above composer | rating_prompt |
| Manus | right card w/ chips | full-width | icon + "manus" | rows in-transcript | thumbs + ★ rating prompt |
| Devin | full-width row | full-width row | none | — | thumbs in action bar |

**States** (`data-state` on Transcript / MessageItem):

- **empty** — no messages; transcript renders the empty slot, not the composer
  (4 labeled screens).
- **submitted / pending** — pending "Thinking" row + stop in composer
  (Lovable 177).
- **streaming** — parts append in place; reasoning disclosure streams then
  collapses with a duration label ("Thought for 24s").
- **aborted** — partial content retained, terminal status line ("Stopped
  working").
- **success / complete** — terminal status part ("Task completed") often paired
  with a rating prompt and follow-ups (Manus 160).
- **error** — inline `error` part with retry affordance; 12 loading + 4 error
  dominant-state screens in the transcript subset.

## Gaps

- **message_branch_switcher: 0 labels despite universal edit support.**
  Editing exists in 3 of 4 products (`message_edit_inline`, 11 screens) and
  Lovable visibly versions/reverts ("4 messages reverted", "Previewing latest
  version"), so branching is real — but no screenshot was labeled with a
  "‹ 1/2 ›" switcher. Either it is hover-only (invisible to stills) or products
  bury branch navigation in menus. The library ships the primitive anyway;
  branch data is already in `MessageNode`.
- **streaming_cursor: 0 labels.** No blinking-caret cursor was detected in any
  product. Streaming state is communicated through pending rows, status dots,
  and disclosures instead. Ship a cursor as opt-in, off by default.
- **reasoning_trace / tool_invocation / citation / suggested_followups: 0 as
  message parts,** yet reasoning blocks, tool summaries, and follow-up rows are
  plainly visible in spot-checked screenshots. The labeler filed these under
  components (`tool_call_card` 13, `reasoning_block` 1) or not at all — treat
  part-level counts as severe under-counts and do not conclude rarity.
- **citation_chip / source_list: 0 labels, corpus-wide.** No surveyed product
  surfaces web-search-style citations. The `citation` part type stays in core
  (cheap) but citation UI is not corpus-justified for v1.
- **code_copy_button: 0 labels.** Code blocks are everywhere (`code_block`
  159/4 products) but a copy affordance on them was never labeled. Copy-on-code
  is table stakes; ship it, flagged as unobserved.
- **artifact_card: 0 labels** despite visible artifact/version cards (Lovable
  32, Manus 160). The artifact surface exists; the enum term didn't match how
  the labeler described it.
- **message_list in Devin: 0 labels** although Devin transcripts are visible
  (e.g. screenshot 89) — a labeling artifact of Devin's full-width, bubble-less
  layout. Spread numbers for message_list should read as 4/4.

## Reference screenshots

- `/Users/ameno/dev/ai-chat/Cofounder web Aug 2026/Cofounder web Aug 2026 44.png` — right-rail transcript, user bubbles, streaming "Writing…", suggested action cards.
- `/Users/ameno/dev/ai-chat/Cofounder web Aug 2026/Cofounder web Aug 2026 20.png` — file chip above user bubble, expanded "Thinking" reasoning block.
- `/Users/ameno/dev/ai-chat/Lovable web Jan 2026/Lovable web Jan 2026 32.png` — date separator, "Thought for 24s", "2 edits made / Show all", version card, persistent action bar, follow-up chips, "4 messages reverted" banner.
- `/Users/ameno/dev/ai-chat/Lovable web Jan 2026/Lovable web Jan 2026 45.png` — interleaved prose/tool parts, scroll-to-bottom chevron, markdown bold.
- `/Users/ameno/dev/ai-chat/Lovable web Jan 2026/Lovable web Jan 2026 177.png` — pending "Thinking" row, stop button, empty streaming state.
- `/Users/ameno/dev/ai-chat/Manus web Mar 2026/Manus web Mar 2026 160.png` — artifact card, embedded table, "Task completed" + "How was this result? ★", suggested follow-up rows, collapsed step card.
- `/Users/ameno/dev/ai-chat/Manus web Mar 2026/Manus web Mar 2026 21.png` — user card with slash-command chips, "Manus is working" disclosure with sub-steps, pinned status mini-card.
- `/Users/ameno/dev/ai-chat/Manus web Mar 2026/Manus web Mar 2026 98.png` — split chat/artifact, rating prompt and follow-ups in-transcript.
- `/Users/ameno/dev/ai-chat/Devin web Aug 2026 (1)/Devin web Aug 2026 89.png` — full-width rows, browser-preview embed, file card, action bar with inline timestamp, "Worked for 11s" disclosure, "Stopped working" / "Devin went to sleep" terminal states.
