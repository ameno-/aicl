# Agent execution — comparative evaluation

Applies `docs/evaluation/CRITERIA.md` to the agent-execution surfaces
inventoried in `docs/domains/agent-execution.md`, and resolves each divergent
choice into exactly one target behavior for `docs/BLUEPRINT.md`.

Constraints this analysis works inside: **D5** (abort is cooperative and
preserves partial output) and **D9** (execution surfaces live in the chat
packages; no new core part types). Recommendations therefore compose with the
existing `Part` union in `packages/core/src/types.ts:120`.

## 1. Scope and data

205 frames selected from 1,262 labelled screens, by the domain spec's filter
(agent-execution archetypes, or any agent surface / execution component).
Counts below were re-derived from `_corpus/labels/*.json` rather than copied
from the domain spec; all matched.

| Product | Frames |
|---|---|
| Cofounder | 75 |
| Devin | 42 |
| Lovable | 43 |
| Manus | 45 |
| **Total** | **205** (62 flagged `is_chat_surface`) |

Agent-surface labels `[label]`: `interrupt_control` 15 (C3 D9 M3),
`step_progress` 11 (C2 D5 L2 M2), `cost_tokens_meter` 6 (Cofounder only),
`live_tool_log` 3 (D1 M2), `terminal_stream` 2 (D1 M1), `file_changes` 1,
`plan_display` 1.

Component labels `[label]`: `progress_bar` 102 (C38 D27 L21 M16),
`plan_checklist` 78 (C21 D12 L37 M8), `error_banner` 24 (4/4),
`tool_call_card` 13 (C8 L1 M4), `terminal_output` 12 (C2 D10),
`step_timeline` 10 (C9 D1), `tool_call_collapsed` 4 (L3 M1),
`diff_viewer` 1, `reasoning_block` 1.

**Four label-accuracy caveats found by spot-check, which change conclusions:**

- `cost_tokens_meter` is uncorroborated. Both frames inspected — Cofounder 89
  and 20 — render **no cost or token meter of any kind** `[observed]`. Treat
  "Cofounder has a cost meter" as withdrawn, not as weak evidence.
- `file_changes` (Cofounder 20) is a **file upload chip** in a user message
  ("AS_Mobbin_About_Com… 1.5 MB"), not a changed-files surface `[observed]`.
- `plan_display` (Devin 84) is an **on-demand usage-limit billing modal**, per
  its own note — a pricing "plan", not an agent plan `[label]`. The count is
  effectively zero for this domain.
- 7 of Devin's 9 `interrupt_control` labels (144–150) are false positives;
  frame 144 is a **PR review screen** with a "Checks 0/0" counter and no stop
  control `[observed]`. Real interrupt evidence is frames 20 and 83–84.

Spot-checked screenshots: Cofounder 20, 89, 199; Devin 20, 81, 144;
Lovable 44; Manus 21, 155.

## 2. Settled conventions (4/4, not matrixed)

| Convention | Evidence |
|---|---|
| Execution is narrated **inline in the transcript**, not quarantined in a separate run console | `[observed]` all four (Cofounder 89, Devin 81, Lovable 44, Manus 155) |
| A **plan or checklist** structures multi-step work | `plan_checklist` 78, 4/4 `[label]` |
| Work in flight is **visibly distinguished** from work finished | `progress_bar` 102, 4/4; `step_progress` 11, 4/4 `[label]` |
| Completed steps carry a **check affordance** | `[observed]` Devin 81 ("✓ 5/5 …"), Manus 155, Cofounder 199, Lovable 44 |
| **Errors surface as banners**, not silent failure | `error_banner` 24, 4/4 `[label]` |
| Terminal status is **announced in the transcript** ("Devin went to sleep", "Stopped working", "Accepted") | `[observed]` Devin 81, Manus 155 |

One correction to the domain spec: `plan_checklist` is flagged
`is_chat_surface` on only **2 of 78** frames. The component is real and 4/4,
but the spec's claim that it appears "overwhelmingly in chat contexts" is not
supported — most instances sit in workspace and task views. The checklist must
therefore be usable **outside** a transcript, not only as a message part.

## 3. Divergent choices

### 3.1 How is the plan displayed?

| Product | Answer | Evidence |
|---|---|---|
| Lovable | Heaviest checklist use (37); presented as outcome lists, not a standing plan panel | `[label]` 37; `[observed]` 44 |
| Cofounder | Checklist plus a **numbered narrative plan** written into prose ("1. You say go — … 2. Agent builds it — …") | `[observed]` 89; `[label]` 21 |
| Devin | Plan appears as **inline step counters with labels** ("✓ 5/5 Share findings and recommendations with user") | `[observed]` 81; `[label]` 12 |
| Manus | Plan as **collapsible step cards** in the transcript, plus a pinned "2/2" chip | `[observed]` 155; `[label]` 8 |

Applicable criteria: convention strength, headless fit, API ergonomics.
Accessibility applies weakly (list semantics); portability is neutral, since
all four are plain list state.

**Scores.** Checklist-as-list: strong on convention (4/4) and headless fit
(pure state, no layout opinion). Dedicated plan *panel*: weak — zero
corroborated instances once Devin 84 is reclassified as billing. Plan-as-prose
(Cofounder): weak on headless fit, being model output rather than a component.

**Verdict.** The corpus agrees a plan exists and disagrees only on chrome. No
product shows an editable or reorderable plan, and no product shows a
plan-approval gate distinct from the general approval surface
(`agent_plan_review` is 2 frames total). Building an edit/reorder API would be
inventing behavior; building a render-only checklist matches every product.

**Recommendation `[observed-default]`.** Ship `PlanChecklist` as a render-only,
ordered list of `{ id, label, status: 'pending' | 'running' | 'done' | 'failed' }`
with a derived `{ completed, total }` rollup. It must work standalone (78
frames, mostly non-chat) *and* embedded, so it takes items as a prop rather
than reading from a message. No edit, reorder, or approve affordance ships in
v1. Per D9 it lives in the chat package; if a consumer persists a plan in the
transcript it rides a `data-plan` part, not a new core type.

**Dissent:** Cofounder's prose plan reads better for non-technical users and
needs no component at all; it is simply out of scope for a component library.

### 3.2 How much tool-call detail is disclosed by default?

| Product | Answer | Evidence |
|---|---|---|
| Cofounder | **Collapsed count rollup** — "› Ran 2 actions", "Ran 3 actions", "Ran 10 actions", expandable | `[observed]` 89, 199; OCR 88, 169, 179–189 |
| Lovable | **Semantic outcome rollup with no tool cards at all** — "2 edits made" + "Show all" | `[observed]` 44; OCR 51, 114–130 |
| Manus | **Expanded collapsible step cards** with check icons and up-chevrons; not auto-collapsed | `[observed]` 155 |
| Devin | Narrative summary in transcript; raw calls relegated to a side pane | `[observed]` 81 |

Applicable criteria: UX heuristics (cognitive load vs. visibility of system
status), headless fit, API ergonomics, accessibility (disclosure semantics).

**Scores.** Collapse-by-default: strong on cognitive load and headless fit
(one boolean plus a slot), neutral on status — the count still proves work
happened. Expanded-by-default (Manus): strong on status, weak on cognitive
load at 10+ calls. Hide-entirely (Lovable): strongest on cognitive load, weak
on trust and error visibility — a failed edit has nowhere to appear.

**Verdict.** The domain spec claims completed steps auto-collapse everywhere.
Manus 155 falsifies that: its finished steps stay expanded with a collapse
chevron. So collapse-by-default is 2 of 4 at best, and the honest common
denominator is weaker — *summarise by count or outcome, keep details one click
away*. Collapse is still the right default because it degrades better at high
call counts and because the failure mode of Lovable's approach (an error with
no surface) is worse than the failure mode of collapsing (an extra click).

**Recommendation `[adjusted]`.** `ToolCallDisclosure` renders a summary row
plus a details region, `defaultOpen: false`. Adjustments over the raw
convention, and why: (a) the summary label is a **slot**, not a hardcoded "Ran
N actions", so Lovable-style semantic rollups ("2 edits made") and
Cofounder-style counts are both expressible; (b) a group whose status is
`'error'` **force-opens**, overriding the default, because no product
demonstrates recovery from a silently collapsed failure; (c) `defaultOpen` is
settable to `true` for Manus-style surfaces. State is exposed as
`data-state="collapsed|expanded"` and `data-status` from `ToolStatus`
(`packages/core/src/types.ts:12`), so styling needs no class API. Grouping is
driven by consecutive `ToolCallPart`/`ToolResultPart` pairs; no new part type.

**Dissent:** Manus scores better on visibility of system status, and Lovable
better on cognitive load for non-technical users. Both are reachable via
`defaultOpen` and the label slot, so neither is foreclosed.

### 3.3 Where does approval live?

| Product | Answer | Evidence |
|---|---|---|
| Cofounder | **Inline decision card** in the transcript: options, a "Recommended" badge, and "Decide all / Decide this one / Submit"; plus "Requires Approval" badges and a floating "N agent updates — Review" batch pill | `[observed]` 199, 89; OCR 46–52, 97, 155–156, 342–348 |
| Manus | Post-hoc **"Accepted" pill** top-center; no pre-approval gate observed | `[observed]` 155; OCR 158, 159 |
| Devin | None observed in execution; approval is external (PR review) | `[observed]` 81, 144 |
| Lovable | None observed; edits apply immediately, reversible via undo in the action bar | `[observed]` 44 |

Applicable criteria: convention strength, UX heuristics (error prevention,
user control), headless fit, API ergonomics.

**Scores.** Inline blocking decision card: weak on convention (1 of 4), strong
on error prevention and user control. Apply-then-undo (Lovable/Manus): strong
on latency perception, weak on error prevention for irreversible actions.
Externalised approval (Devin): strong for code, not generalisable — it
presumes a PR.

**Verdict.** Approval is genuinely one product's bet, so by the reconciliation
rule it ships **opt-in, never as a default**. But it is not optional
*capability*: an agent that can take irreversible action needs a gate, and
Cofounder is the only product that shows one working — including the
non-obvious "Decide all" batch affordance, which is the answer to approval
fatigue across many pending decisions.

**Recommendation `[observed-default]`, opt-in.** Model approval as a
`ToolCallPart` whose `status` is `'pending'` — the status value already exists
(`packages/core/src/types.ts:12`) and is otherwise unused, so no new part type
is needed (D9). The chat package exposes a resolver: the host supplies
`onApprove(toolCallId)` / `onReject(toolCallId)`, and when no resolver is
supplied, `'pending'` renders as plain in-flight and nothing blocks. Ship the
batch case Cofounder proves: an `approvals` store exposing all pending calls
with `approveAll()` / `approveOne()`, so a "Decide all" control is buildable
without the host correlating IDs by hand. Do **not** ship the floating
"N updates — Review" pill itself — placement over a canvas is app-level IA.

**Dissent:** Lovable's apply-then-undo is lower friction and, for reversible
edits, plainly better; the recommendation preserves it by making approval
opt-in and the non-resolver path non-blocking.

### 3.4 What does interrupt mean?

| Product | Answer | Evidence |
|---|---|---|
| Manus | Composer send button **morphs into a stop button** mid-run; composer stays enabled | `[observed]` 21 |
| Devin | Same morph; composer stays enabled and is explicitly steerable — "Guide Devin while it works" | `[observed]` 20 |
| Cofounder | Composer **inert** during work (placeholder present, send dimmed); no stop observed | `[observed]` 20 |
| Lovable | No interrupt observed; undo in the message action bar is the recovery path | `[observed]` 44 |

Applicable criteria: convention strength, UX heuristics (user control),
accessibility (focus preservation), API ergonomics. Headless fit is strong for
all — this is pure state.

**Scores.** Stop-in-send-slot: 2 of 4 `[observed]`, and the other two lack the
control rather than placing it elsewhere, so nothing contradicts it. Strong on
user control and accessibility — focus never leaves the composer and no tab
stop appears or disappears. Inert composer: weak on user control, since the
user can neither stop nor steer.

**Verdict.** The domain spec rated the send/stop morph `[inferred]`. Two
direct observations upgrade it to `[observed]` and make it the default. The
sharper divergence is whether the composer accepts input *during* a run: Devin
and Manus say yes (mid-run steering), Cofounder says no. Blocking input is the
conservative choice but forfeits Devin's best property, and there is no
evidence that concurrent input breaks anything.

**Recommendation `[observed-default]`.** The composer's primary action is a
single button that swaps affordance by `ChatStatus`
(`packages/core/src/types.ts:172`): send when idle, stop when
`streaming`/`submitted`. One DOM node, one tab stop, label swapped — never two
buttons toggled by visibility, which churns focus. The composer's text input
stays **enabled** during a run (Devin/Manus), since disabling it destroys the
steering use case and is the one behavior a user cannot work around. Abort is
cooperative and keeps partial output per D5; the aborted message is marked via
`Message.aborted` (`packages/core/src/types.ts:146`) and in-flight tool calls
resolve to `'cancelled'`, not `'error'` — the distinction already exists in
`ToolStatus` and should be honoured so aborts do not render as failures.

**Dissent:** Cofounder's inert composer removes any ambiguity about whether a
mid-run message queues or interleaves. That ambiguity is real and is pushed to
the host, which owns send semantics.

### 3.5 What shape does progress take?

| Product | Answer | Evidence |
|---|---|---|
| Devin | `n/m` counter with a step label, inline, check-marked ("✓ 5/5 Share findings…") | `[observed]` 81; OCR "1/2", "2/2", "1/1" |
| Manus | Pinned floating status card: live elapsed timer plus `n/m` ("0:03 Thinking", "1/1"); "2/2" chip when idle | `[observed]` 21, 155 |
| Cofounder | `n/m` plus percentage and a bar ("3/7 Setup", "40%"); heaviest `step_timeline` use (9) | OCR 88 `[label]` |
| Lovable | Progress implied by the artifact card's state ("Previewing latest version"); no numeric counter observed | `[observed]` 44 |

Applicable criteria: convention strength, UX heuristics (system status),
accessibility (live regions), API ergonomics.

**Scores.** `n/m` counter: 3 of 4 `[observed]`, strong on status and trivially
announceable. Determinate percentage bar: 1 of 4, and meaningful only when the
denominator is known in advance, which agent work usually does not supply.
Pinned floating card (Manus): strong on status during long runs, weak on
headless fit — pinning is layout, i.e. app-level.

**Verdict.** `progress_bar` carries the largest component count (102, 4/4), but
the label conflates determinate bars with indeterminate spinners, and the
frames actually inspected show counters and spinners rather than determinate
bars. The defensible common behavior is a **derived `{ completed, total }`
rollup** that a host may render as a counter, a bar, or a chip. The cost/token
meter is withdrawn entirely — neither labelled frame shows one. Note that
`Usage.costUsd` (`packages/core/src/types.ts:35`) remains justified by
**billing** surfaces (25 `settings_billing` frames; Devin 84's usage-limit
modal), not by a live execution meter; nothing here argues for removing it,
only against rendering it during a run.

**Recommendation `[observed-default]`.** Progress is a derived value on the
plan/step store — `{ completed, total, current }` — exposed as data, plus
`data-progress` attributes for styling. Ship no determinate progress bar
component and no cost meter. The rollup region is an `aria-live="polite"`
status so step transitions are announced without announcing every token.
Elapsed-time display is a host concern given a `startedAt` timestamp; the
library does not own a ticking timer.

**Dissent:** Manus's pinned card is the best answer for long runs where the
transcript has scrolled away, and Cofounder's percentage reads friendlier.
Both are compositions over the same rollup; neither needs library layout.

### 3.6 How are reasoning and duration labelled?

| Product | Answer | Evidence |
|---|---|---|
| Lovable | **Frozen duration**, no chevron — "Thought for 27s" with a lightbulb icon | `[observed]` 44; OCR 51 "Thought for 21s" |
| Devin | Frozen duration, two verbs — "Thought for 9s", "Worked for 14s" | OCR 15, 21–24, 40, 45–49 `[label]` |
| Manus | **Live ticking** counter during the run — "0:03 Thinking" | `[observed]` 21 |
| Cofounder | Live "⌄ Thinking" expanded with streaming text, resolving to a **semantic, duration-free** label — "Thought through the next step" | `[observed]` 20, 89 |

Applicable criteria: UX heuristics, accessibility, API ergonomics. Convention
strength applies but splits three ways.

**Scores.** Frozen duration: 2 of 4, strong on API ergonomics (`durationMs`
already exists at `packages/core/src/types.ts:58`). Live ticking: strong on
status during long thinks, weak on accessibility — a per-second live region is
noise for screen readers. Semantic label (Cofounder): strong on comprehension,
but the text is model-authored, not derivable.

**Verdict.** The core type already anticipates the majority case. The gap is
that `durationMs` is the *only* label input, which forces the frozen-duration
rendering and cannot express Manus's live counter or Cofounder's semantic
summary.

**Recommendation `[adjusted]`.** Keep `ReasoningPart` as-is — no core change —
and have the chat package's `ReasoningDisclosure` accept a **label slot** that
receives `{ durationMs, startedAt, isStreaming }`. Default rendering: a live
elapsed indicator while streaming, freezing to "Thought for Ns" on completion
when `durationMs` is present, and to a neutral "Thought" when it is not.
Collapsed by default per the existing `collapsed` field, and excluded from
copy. The ticking element carries `aria-live="off"` with the completion
transition announced once — this deviates from Manus deliberately, on the
accessibility veto in the reconciliation rule.

**Dissent:** Cofounder's semantic label is the most informative of the four;
it stays available through the slot but cannot be the default, since no
transport reliably supplies such a summary.

### 3.7 Where do terminal output and live logs render?

| Product | Answer | Evidence |
|---|---|---|
| Devin | **Side pane** ("Worklog"): line-numbered event log, file path header, copy, prev/next, and a red "• Live" pill; events like `shell_process_completed (shell): exit_code=0` | `[observed]` 81; `terminal_output` 10 `[label]` |
| Cofounder | Inline in the transcript | `terminal_output` 2 `[label-floor]` |
| Manus | Live tool log with skill-loading chips inside the run card | `[observed]` 21 |
| Lovable | None — no terminal surface | `[label]` 0 |

Applicable criteria: headless fit, API ergonomics, accessibility.

**Scores.** Evidence here is thin — `terminal_stream` is 2 frames and
`diff_viewer` is 1 (Devin 151, never spot-checked). Everything in this section
is `[label-floor]`: a zero means "not detected".

**Verdict.** Pane-versus-inline is an IA decision, which criterion 4 places
outside a headless library. What the library owes is a component that behaves
correctly in either position: append-only, follows the tail until the user
scrolls up, then stops and offers a resume affordance — Devin's "• Live" pill
is exactly that state made visible.

**Recommendation `[observed-default]` for behavior, `[extrapolation]` for
placement.** Terminal output maps to `ArtifactPart { kind: 'terminal' }`,
which already exists (`packages/core/src/types.ts:14`) — no new part type, per
D9. `TerminalOutput` owns append-only buffering, tail-follow with
scroll-to-break and a `data-following` attribute, and a bounded line cap.
Placement is the host's. The `diff` artifact kind likewise covers Devin's diff
viewer; at one frame, no diff-specific behavior beyond artifact versioning is
specified. **Falsifier for the placement extrapolation:** a product showing
terminal output that is *only* legible inline (for example, interleaved with
per-step tool cards such that extraction loses meaning) would force the
component to own placement.

## 4. Target-behavior summary

| Choice | Recommendation | Mark | Deciding criteria |
|---|---|---|---|
| Plan display | Render-only `PlanChecklist` with derived rollup; standalone-capable; no edit/reorder | `[observed-default]` | Convention 4/4; headless fit |
| Tool-call disclosure | Summary row + details, `defaultOpen: false`, label slot, force-open on error | `[adjusted]` | UX (cognitive load vs. error visibility) |
| Approval surface | `ToolStatus: 'pending'` + host resolver + batch store; opt-in, non-blocking without a resolver | `[observed-default]` (opt-in) | Convention 1/4 → opt-in; error prevention |
| Interrupt | Send/stop morph in one button by `ChatStatus`; input stays enabled; cooperative abort → `'cancelled'` | `[observed-default]` | User control; a11y focus preservation; D5 |
| Progress | Derived `{ completed, total, current }` + `data-progress`; no bar, no cost meter | `[observed-default]` | Convention 3/4 for `n/m`; evidence withdrawal for meters |
| Reasoning label | `ReasoningPart` unchanged + label slot; live while streaming, frozen on completion; `aria-live="off"` | `[adjusted]` | A11y veto on ticking live regions |
| Terminal / logs | `ArtifactPart { kind: 'terminal' }` + tail-follow with `data-following`; placement host-owned | `[observed-default]` / `[extrapolation]` | Headless fit (IA is app-level) |

No recommendation adds a core part type; all ride `ToolCallPart`,
`ToolResultPart`, `ReasoningPart`, `ArtifactPart`, or `data-*`. This satisfies
D9 and leaves `packages/core/src/types.ts` unchanged.

## 5. Gaps and extrapolations

Ordered by how much they would change the above.

1. **Plan editing and reordering — corpus-silent.** No frame shows a user
   modifying a plan. Shipping render-only is an extrapolation.
   *Falsifier:* any frame showing a draggable, editable, or rejectable plan
   step would require a mutable plan store and step-level approval.
2. **Rejection aftermath — corpus-silent.** Cofounder shows the decision card
   and shows "Accepted"/"Business Plan Accepted" states, but no frame shows
   what the transcript looks like after a *rejection*.
   *Falsifier:* a post-rejection frame showing a retry, an alternative
   proposal, or a rolled-back step would add states to the approval store.
3. **Cost and token meters — evidence withdrawn.** All 6 `cost_tokens_meter`
   labels are Cofounder-only, and both inspected frames show no meter. The
   library ships none. *Falsifier:* a frame with a visible live token or cost
   readout during a run.
4. **Terminal and diff — `[label-floor]`, 2 and 1 frames.** Tail-follow
   behavior is extrapolated from Devin's "• Live" pill alone.
   *Falsifier:* a terminal surface that does not auto-follow, or one whose
   scroll state is not user-breakable.
5. **Multi-agent fan-out — corpus-silent for concurrency.** Cofounder names
   distinct agents (Engineering, Marketing) and batches "2 agent updates", but
   no frame shows two agents running *simultaneously* in one transcript.
   *Falsifier:* interleaved concurrent agent output would require per-agent
   lanes, which none of the recommendations currently support.
6. **Plan approval as a distinct gate.** `agent_plan_review` is 2 frames; the
   sole `plan_display` label is a billing modal. Plan approval is folded into
   the general approval surface. *Falsifier:* a dedicated
   approve/reject-the-plan-before-execution screen.
7. **Keyboard behavior throughout — `[inferred]`.** The corpus is pixels. Stop
   via Escape, expand/collapse via Enter/Space on the summary row, and focus
   retention across the send/stop morph are conventional inferences only.
8. **Label reliability.** Three label classes proved unreliable here
   (`cost_tokens_meter`, `file_changes`, `plan_display`) and 7 of 9 Devin
   `interrupt_control` labels were false positives. Any future claim resting
   on a single-digit label count in this domain should be spot-checked before
   it reaches the blueprint.
