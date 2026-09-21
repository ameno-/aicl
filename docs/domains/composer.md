# Domain spec: Composer & input

The composer is the message-entry surface: text field plus the toolbar of affordances
around it (attach, mode/model pickers, voice, send/stop). This spec is grounded in the
1,262-screen corpus (`_corpus/labels/*.json`) and a 10-screen visual spot-check across
all four products. See `docs/ARCHITECTURE.md` for the library-wide rules this follows
(headless, registry-based, `data-*` styled, no CSS).

## A note on detection quality (read before trusting counts)

The label pipeline **under-detects composers**:

- Only **98 / 1,262** screens have `composer_affordances != ["none"]`, yet
  **196** screens are flagged `is_chat_surface: true`. **105** chat surfaces carry
  `composer_affordances: ["none"]` — 93 of those are `sidebar_main_aside`, i.e. the
  composer sits in a narrow right rail or chat column that the labeller frequently
  missed. Treat ~200 screens, not 98, as the true composer population.
- `components` is even sparser: `composer_input` appears 70 times, but
  `composer_send_button`, `composer_attach_button`, `composer_model_picker`,
  `composer_stop_button`, and `composer_char_counter` are essentially never emitted —
  the labeller collapsed the whole composer into the single `composer_input` token.
- Several enum affordances got **zero** labels (`multiline_expand`, `model_selection`,
  `mode_selection`, `at_mentions`, `stop_generation`) despite being plainly visible in
  the spot-check screenshots (Devin's "Normal"/"Default" mode dropdown, Manus's
  send→stop morph). Zero in the table means "not detected", not "absent".

Everything in the interaction contract below is therefore grounded primarily in the
spot-checked screenshots; label counts are used for spread, not presence/absence.

## Inventory

Observed `composer_affordances` (98 labelled composer screens; per-product screen counts
in the corpus: Cofounder 385, Devin 250, Lovable 339, Manus 288):

| Affordance | Screens | Cofounder | Devin | Lovable | Manus | Notes |
|---|---|---|---|---|---|---|
| text_entry | 77 | 29 | 19 | 9 | 20 | The universal baseline |
| file_upload | 62 | 20 | 16 | 6 | 20 | "+" or paperclip button, all four |
| attachment_preview | 52 | 10 | 10 | 15 | 17 | Chip/thumbnail above the input |
| image_paste | 29 | 12 | 6 | 3 | 8 | Paste/drag into the field |
| send | 21 | 9 | 3 | 5 | 4 | Under-counted; send is universal |
| voice_dictation | 17 | 0 | 1 | 11 | 5 | Mic button; absent in Cofounder corpus |
| template_picker | 12 | 0 | 1 | 11 | 0 | Lovable "Theme" picker; Devin playbook-ish |
| slash_commands | 6 | 0 | 0 | 1 | 5 | Manus `/skill-creator`-style skills |
| tool_selection | 1 | 1 | 0 | 0 | 0 | Under-counted (integration chips) |
| multiline_expand, model_selection, mode_selection, at_mentions, stop_generation | 0–1 | — | — | — | — | Under-detected; see spot-checks |

Where the composer sits (98 labelled screens, biased by the right-rail under-count):

| Shell layout | Screens | What it means for the composer |
|---|---|---|
| sidebar_main_aside | 75 | Composer docked at the bottom of a right rail or chat column |
| sidebar_main | 20 | Composer at the bottom of the single main column |
| centered / marketing | 3 | "Hero composer" — a large centered prompt card on empty/landing states |

Spot-checks confirm **three physical placements**, each with a distinct visual grammar:

1. **Bottom bar in a conversation column** (Devin 89, Manus 61/21/130, Lovable 68/178):
   full-width rounded card pinned to the bottom of the chat column; placeholder like
   "Send message to Manus" / "Ask Lovable..."; toolbar row beneath the text area with
   left-aligned attach/mode controls and right-aligned mic + send.
2. **Centered hero composer on empty/home states** (Devin 214, Lovable 18, Cofounder
   132/189): the same composer component, rendered larger and centered, with a greeting
   ("Let's create, Samlee") and often suggestion chips or template galleries below it.
   This is the same component in a different slot, not a second component.
3. **Right-rail chat composer** (Devin 147's Review chat tab): a compact composer in a
   narrow inspector panel; the corpus shows this is where the labeller most often lost
   it.

Co-occurrence with agent surfaces (on the 98 labelled composer screens):
`interrupt_control` 15, `step_progress` 11, `cost_tokens_meter` 6, `live_tool_log` 3,
`terminal_stream` 2, `file_changes` 1, `plan_display` 1. I.e. roughly a third of
composer screens also show live agent state — the composer must remain usable (and
morph send→stop) while agent execution renders above it.

### Sub-components observed in spot-checks (not in label counts)

- **Toolbar row** inside the composer card, always split left/right:
  - Left: "+" / attach (Devin 89: `+ Default`; Lovable 18: `+  Attach  Theme ▾`;
    Manus 130: `+` plus integration chips for Gmail/Calendar/Drive), mode dropdown.
  - Right: mic (voice), then send — a circular button with an up-arrow (Devin 214,
    Lovable 18, Manus 61). Send often carries a secondary chevron (Devin 214: send +
    `⌄`) implying a "send options" menu.
- **Mode selector as a chip**: Devin "Normal ▾" / "Default" (Devin 214, 89).
- **Attachment chip row above the input**: image/file thumbnails with a task label and
  progress fraction (Manus 130: thumbnail + "Test and finalize file management
  dashboard  4/4"; Manus 61: "Deliver the final presentation… 3/3").
- **Context chips below the composer** (Devin 214: "12 repositories · Ubuntu ·
  Upgrade plan · Advanced capabilities →") — environment context, not part of the text.
- **Suggestion chips** adjacent to the composer: Cofounder 132 ("SaaS Landing",
  "Dashboard UI", "Mobile App", "Internal Tool"); Lovable 178 ("Customize the design",
  "Add email notifications", "Add event c…") above the input as follow-up suggestions.
- **Inline slash-command tokens in sent messages**: Manus 21's user message contains
  `/skill-creator /similarweb-analytics`, and the agent visibly "loads" those skills —
  slash commands are a real input grammar, not decoration.
- **Status pill between transcript and composer**: Manus 21 shows "Manus is working —
  0:03 Thinking" plus an elapsed timer while streaming.
- **Inline error banner above composer**: Lovable 178 shows "Security 1 Error · Review"
  docked directly above the input.

## Interaction contract

Rules marked **[observed]** were seen directly in spot-checks; **[label]** rests on
label data only; **[inference]** is a design judgment the corpus cannot prove.

1. **Submit gesture.** Enter submits; Shift+Enter inserts a newline. **[inference]** —
   screenshots cannot capture keystrokes, but every observed composer is a multi-line
   field with a single-line-then-submit grammar, and Enter-to-send + Shift+Enter-newline
   is the universal convention the observed placeholder texts imply.
2. **IME composition safety.** Never submit while an IME composition is in flight
   (`compositionstart`/`compositionend`; check `event.isComposing` / keyCode 229).
   **[inference]** — not observable in screenshots, but required for JA/ZH/KO input;
   already stated in ARCHITECTURE.md as a near-universally-wrong detail.
3. **Send-enabled conditions.** Send is disabled when the field is empty (ignoring
   whitespace) **unless** at least one attachment is staged. Send is a no-op while the
   conversation state machine is in `submitted` (prevents double-fire; ARCHITECTURE.md).
   **[inference]** — partially **[observed]**: in Manus 130 the send button renders
   greyed with an empty field while the affordance row stays active.
4. **Send → stop morph.** During streaming, the send button is replaced in place by a
   stop control. **[observed]**: Manus 21 shows the right-most circular button as a
   filled black stop square while "Manus is working — 0:03 Thinking" streams above; in
   Manus 61 (idle) the same slot is an up-arrow send. The composer text field stays
   enabled during streaming (user can queue the next message) — **[observed]** in that
   the placeholder "Send message to Manus" remains in Manus 21, though the queued-send
   behaviour itself is **[inference]**.
5. **Attachment lifecycle.** Attach via "+" button (file picker), drag-and-drop, and
   paste of images. Staged attachments appear as chips/thumbnails **above** the text
   field, each removable, and may show a progress fraction (`3/3`, `4/4`) while a
   multi-part operation runs. **[observed]**: Manus 130/61 chips with fractions;
   `file_upload` (62 screens) + `image_paste` (29) + `attachment_preview` (52) labels.
   Upload-progress-per-file and failure/retry per chip is **[inference]** — the
   fractions seen are task progress, not upload progress.
6. **Autosize.** The field grows with content up to a cap, then scrolls internally.
   **[observed]**: Lovable 18 shows a 4-line prompt fully expanded inside the hero
   composer; single-line in every idle screenshot. Cap value is **[inference]**.
7. **Slash / mention triggers.** Typing `/` opens a command menu whose entries are
   skills/tools; selected commands land in the text as inline tokens
   (`/skill-creator`) and are interpreted at send time. **[observed]**: Manus 21 sent
   message; `slash_commands` label on 6 screens (5 Manus, 1 Lovable). `@`-mentions
   appear in Devin's review composer ("@devin", Devin 147) — **[observed]** as a
   mention grammar; trigger-menu behaviour is **[inference]**.
8. **Placeholder as state signal.** Placeholder text is contextual:
   "Ask Devin to build features, fix bugs, or work on your code" (Devin 214/89),
   "Send message to Manus" (Manus 61/21/130), "Ask Lovable..." (Lovable 68/178),
   "Describe what you want to build..." (Cofounder 132/189). **[observed]**.
   Rule: placeholder is a prop with a sensible default; it differs between the hero
   (empty-state) and docked (in-conversation) slots.
9. **Voice input is a peer of send, not a replacement.** The mic sits immediately left
   of send in the right-aligned group (Devin 214, Lovable 18/178, Manus 61/130).
   **[observed]**. Dictation interim-transcript behaviour is **[inference]**.
10. **Mode/model selection lives inside the composer.** Devin's "Normal ▾"/"Default"
    chip is the left-most toolbar item (Devin 214, 89); Lovable's "Theme ▾" is a
    picker in the same row (Lovable 18). **[observed]**. The selection must travel with
    the sent message (it affects the run), which is **[inference]**.
11. **Suggestion chips are outside the field.** They render as a separate region
    adjacent to the composer (below it on hero layouts, above it on follow-ups),
    and clicking one inserts or sends a prewritten prompt. **[observed]** placement
    (Cofounder 132, Lovable 178); insert-vs-send semantics **[inference]**.
12. **Send-options affordance.** A chevron attached to the send button (Devin 214)
    implies a secondary menu (e.g. send-and-wait vs queue). Expose the slot; do not
    hardcode the menu. **[observed]** slot, **[inference]** contents.

## Component API sketch

Consistent with ARCHITECTURE.md: headless primitives per framework adapter, state in
`@aicl/core`, styled only via `data-*`. The composer is four primitives; consumers
compose them, and the registry pattern is not needed here (fixed semantics, unlike
message parts).

### `<Composer>` (container)

Owns the card, focus management, and wiring between children. Props (adapter-flavoured;
React shown):

```tsx
interface ComposerProps {
  value?: string;                    // controlled; uncontrolled if omitted
  defaultValue?: string;
  placeholder?: string;              // contract rule 8
  state: 'idle' | 'submitted' | 'streaming' | 'disabled' | 'error';
  maxRows?: number;                  // autosize cap, rule 6 (default ~10)
  submitOnEnter?: boolean;           // default true; false swaps Enter/⌘Enter
  attachments?: Attachment[];        // staged, not yet sent
  disabledReason?: string;           // e.g. paywall, offline; surfaced via aria
  onSubmit: (draft: Draft) => void;  // rule 1; never fires while composing (rule 2)
  onStop?: () => void;               // presence + state=streaming renders stop (rule 4)
  onChange?: (value: string) => void;
  children: ReactNode;               // toolbar slots
}

interface Draft { text: string; attachments: Attachment[]; mode?: string; }
```

Rendered attributes:

```
data-aicl="composer"
data-state="idle | submitted | streaming | disabled | error"
data-has-text="true|false"
data-has-attachments="true|false"
data-placement="docked | hero | rail"
```

The text field itself gets `role="textbox" aria-multiline="true"`, and submits are
gated in core by both the IME check and the `submitted` state (rules 2–3).

### `<ComposerToolbar>` + slots

```
<Composer.Toolbar>
  <Composer.LeadingSlot />   // attach, mode picker, tool chips (rule 10)
  <Composer.TrailingSlot />  // voice, send/stop, send-options chevron (rules 9, 12)
</Composer.Toolbar>
```

`<Composer.SendButton>` renders send or stop from `state` (single button, morphed —
never two buttons toggled with CSS, or focus is lost mid-stream). Attributes:
`data-role="send|stop"`, `disabled` only per rule 3.

### `<AttachmentChip>` (one per staged file)

```tsx
interface Attachment {
  id: string; mediaType: string; name: string; size?: number;
  previewUrl?: string;               // image thumbnails (Manus 130)
  status: 'uploading' | 'ready' | 'error';
  progress?: number;                 // 0..1 while uploading
}
```

Attributes: `data-aicl="attachment-chip"`, `data-status="uploading|ready|error"`.
Events: `onRemove(id)`, `onRetry(id)`. Upload progress and per-chip error/retry are
first-class in the model even though only task-level progress was observed — the
lifecycle is required to make rule 5 implementable.

### `<SlashMenu>` / `<MentionMenu>` (combobox)

Already named in ARCHITECTURE.md. Trigger characters (`/`, `@`) configurable; items are
consumer-supplied; selected slash items insert as inline tokens that are serialized
into `Draft.text` verbatim (matching the observed `/skill-creator` grammar, rule 7).
Attributes: `data-aicl="slash-menu"`, `data-state="open|closed"`,
`aria-activedescendant` for keyboard nav.

### `<SuggestionChips>` (adjacent region, not inside the field)

```tsx
interface SuggestionChipsProps {
  suggestions: { id: string; label: string; prompt: string }[];
  onSelect: (s, behaviour: 'insert' | 'send') => void; // default 'insert' (rule 11)
}
```

`data-aicl="suggestion-chips"`. Placement (above vs below the composer) is the
consumer's layout decision; `data-placement` on the composer distinguishes hero vs
docked contexts.

## Variants & states

States (union of ARCHITECTURE.md's conversation machine and observed screens):

| State | Trigger | Observed evidence |
|---|---|---|
| `idle-empty` | No text, no attachments | Send greyed, Manus 130 |
| `idle-filled` | Text or attachments staged | Send active, dark circle (Devin 89, Lovable 18, Cofounder 132) |
| `submitted` | Sent, awaiting first event | Send inert (double-fire guard, ARCHITECTURE.md) |
| `streaming` | Assistant streaming | Send→stop morph, status pill "Manus is working — 0:03 Thinking" (Manus 21) |
| `error` | Failed run | Inline banner docked above composer: "Security 1 Error · Review" (Lovable 178) |
| `disabled` / paywalled | Plan/limits | Devin 214 "Upgrade plan · Advanced capabilities →" context chip; Cofounder 132 "Current plan: Free · Upgrade" pill near the composer. No corpus screen shows a fully disabled composer — the products upsell beside it instead. |
| `recording` | Voice active | Mic present in Devin/Lovable/Manus; active recording state not captured in the corpus (inference). |

Per-product variants worth supporting as configuration, not forks:

- **Devin**: mode chip ("Normal"/"Default") as left-most toolbar item; send with
  secondary `⌄`; environment context chips below the composer; `Add a comment...`-style
  compact variant in right-rail review panels (Devin 147).
- **Lovable**: hero composer on a gradient home ("Let's create, {name}") with typed
  multi-line prompt; "Theme ▾" picker chip; follow-up suggestion chips above the input;
  `Chat` toggle chip in the toolbar (Lovable 18, 68, 178).
- **Manus**: integration chips (Gmail/Calendar/Drive) inside the toolbar; attachment
  chips with progress fractions; slash-commands as first-class skills; elapsed-timer
  status pill while streaming (Manus 130, 21, 61).
- **Cofounder**: hero composer on marketing/landing surfaces with category suggestion
  chips ("SaaS Landing", "Dashboard UI"…) below (Cofounder 132, 189). Simplest
  toolbar: `+ Attach` left, mic + send right.

## Gaps — what no product does well (as far as the corpus shows)

1. **No character or token counter anywhere.** `composer_char_counter` never appears;
   no spot-check shows one. Long prompts (Lovable 18) give no length feedback.
2. **No visible draft persistence / recovery.** Nothing indicates unsent drafts survive
   navigation between sessions; session-switching with a half-typed prompt is unhandled
   in every observed surface.
3. **No per-file upload progress or failure UI.** Attachment chips show task fractions
   (Manus `4/4`) but never upload progress, size limits, or a failed-upload retry.
4. **Paywall handling is adjacent, not integrated.** Upsell pills sit next to the
   composer (Devin 214, Cofounder 132); no screen shows the composer itself explaining
   *why* it is disabled or gating send with a clear reason.
5. **Voice states are invisible.** Mic buttons exist (17 screens) but no screen shows
   a recording/transcribing state — interim transcript rendering is unobserved.
6. **Slash/mention discoverability.** Manus parses `/skills` in sent messages, but no
   screen shows the trigger menu itself — the corpus has zero open slash menus, so
   filtering/keyboard UX must be designed from convention, not evidence.
7. **Queued messages during streaming.** The composer stays live while the agent works
   (Manus 21), but no screen shows a queued-message affordance — sending mid-stream
   has undefined UX in all four products.
8. **IME safety cannot be verified from pixels** and is a known industry failure mode —
   the library should treat it as a headline feature, not a footnote.

## Reference screenshots

Open these when implementing (paths relative to `/Users/ameno/dev/ai-chat/`):

| File | Why |
|---|---|
| `Manus web Mar 2026/Manus web Mar 2026 21.png` | Streaming: send→stop morph, status pill with timer, slash tokens in a sent message, attached image |
| `Manus web Mar 2026/Manus web Mar 2026 130.png` | Docked composer: integration chips, attachment chip with progress fraction, disabled-send on empty |
| `Manus web Mar 2026/Manus web Mar 2026 61.png` | Docked composer at rest with chip row; right-rail-adjacent layout |
| `Devin web Aug 2026 (1)/Devin web Aug 2026 214.png` | Hero composer: placeholder copy, mode chip, send+`⌄`, context chips below |
| `Devin web Aug 2026 (1)/Devin web Aug 2026 89.png` | Bottom-bar composer in an active session; `+ Default` mode affordance |
| `Devin web Aug 2026 (1)/Devin web Aug 2026 147.png` | Right-rail chat/comment composer with `@devin` mention |
| `Lovable web Jan 2026/Lovable web Jan 2026 18.png` | Hero composer with 4-line expanded input, Attach + Theme picker, mic+send cluster |
| `Lovable web Jan 2026/Lovable web Jan 2026 178.png` | Composer with error banner above it and follow-up suggestion chips |
| `Cofounder web Aug 2026/Cofounder web Aug 2026 132.png` | Landing hero composer with suggestion chips and plan upsell pill |
| `Cofounder web Aug 2026/Cofounder web Aug 2026 189.png` | Minimal toolbar (`+ Attach`, mic, send) with attachment chip under input |
