# Domain: Agentic execution surfaces

Plan display and approval, step progress, tool-call cards, terminal/log output,
file changes and diffs, live previews, cost/token meters, interrupt controls.

Grounded in 1,262 labeled screenshots across Cofounder, Devin, Lovable, Manus.
Method: labels filtered where `agent_surfaces != ["none"]`, or
`screen_archetype` starts with `agent_`, or `components` includes
`tool_call_card / plan_checklist / step_timeline / terminal_output /
diff_viewer / tool_call_collapsed`. That yields **205 frames** (16% of corpus):
Cofounder 75, Manus 45, Lovable 43, Devin 42.

## Inventory

### Agent surfaces (from `agent_surfaces` labels)

| Surface | Frames | Products | Notes |
|---|---|---|---|
| `interrupt_control` | 15 | 3 (Cofounder, Devin, Manus) | Stop button; most often inside/replacing the composer send button |
| `step_progress` | 11 | 4 (all) | "Step 1/2", "4 of 6" counters, step checklists with checkmarks |
| `cost_tokens_meter` | 6 | 1 (Cofounder only) | Credit/usage surfacing; others gate it in settings_billing |
| `live_tool_log` | 3 | 2 (Devin, Manus) | Scrolling agent activity log |
| `terminal_stream` | 2 | 2 (Devin, Manus) | Live stdout |
| `plan_display` | 1 | 1 (Devin) | Pre-execution plan panel |
| `file_changes` | 1 | 1 (Cofounder) | |

### Execution components (from `components` labels, corpus-wide)

| Component | Frames | Products |
|---|---|---|
| `progress_bar` | 102 | 4 |
| `plan_checklist` | 78 | 4 (Cofounder 21, Devin 12, Lovable 37, Manus 8) |
| `tool_call_card` | 13 | 3 (Cofounder 8, Manus 4, Lovable 1) |
| `terminal_output` | 12 | 2 (Devin 10, Cofounder 2) |
| `step_timeline` | 10 | 2 (Cofounder 9, Devin 1) |
| `tool_call_collapsed` | 4 | 2 (Lovable 3, Manus 1) |
| `diff_viewer` | 1 | 1 (Devin) |

Note the honest tension: dedicated `agent_surfaces` tags are sparse (39 tagged
frames), but the *components* that render execution — plan checklists, progress
bars, tool-call cards — are common. `plan_checklist` at 78 frames in all four
products is the single most universal execution surface in the corpus.

### Where they cluster

Of the 205 selected frames: `agent_tool_output` 43, `code_editor` 17,
`agent_task_running` 12, `agent_task_complete` 10, `agent_task_failed` 8,
`agent_plan_review` 2, `agent_step_detail` 1. The remainder ride on general
archetypes (`workspace_home` 38, `settings_billing` 25 — mostly the cost meter,
`onboarding_welcome` 22). 62 of 205 are flagged `is_chat_surface`; execution
surfaces live both inline in the transcript (tool calls, plans, steps) and in
adjacent panes (Devin's editor/terminal/preview tabs, Lovable's preview panel,
Manus's side panel).

## Observed behaviors (spot-checked frames)

- **Manus `155` (verified):** an "Accepted" banner pinned above the
  transcript, completed steps rendered as collapsible cards with check
  icons ("Create scheduled task…", "Confirm task scheduling to user"), each
  with a collapse chevron, and a bottom-right collapsed step chip showing
  the counter "2/2". Completed steps collapse; the counter survives.
- **Cofounder `199` (verified):** task-run view with a right transcript
  panel showing a collapsed "Ran 3 actions" rollup, an expanded running
  row "Running Tool: Ask User Question", a "Waited for the user's answer"
  status row, and an inline decision card with radio options, a
  "Recommended" badge, and "Decide all / Decide this one / Submit"
  buttons. A persistent bottom-left pill reads "1 agent update — Review".
- **Cofounder `88` (verified):** collapsed aggregate row "Ran 2 actions", a
  "Thought through the next step" reasoning block, the same "2 agent
  updates — Review" batch-approval pill, and numbered "You say go / Agent
  builds it" approval-flow copy.
- **Cofounder `53` (verified):** task list items carry a "Requires Approval"
  badge — approval is a first-class step state, surfaced outside the chat
  pane.
- **Lovable `44` (verified):** chat on the left with a "Thought for 27s"
  reasoning row (frozen duration after completion), a collapsed "2 edits
  made — Show all" rollup, and an inline artifact card ("Add gradient
  accent to hero / Previewing latest version"); a live preview iframe fills
  the right pane with its own Publish action.
- **Cofounder `20` (verified):** a "Thinking" collapsible disclosure
  streaming above the answer; composer present but inert during work.
- **Devin `37` (verified):** session list carries per-session status text
  ("PR is ready", "2 hours ago") — execution outcomes are visible outside
  the conversation, and an onboarding checklist shows a "4 of 6" progress
  bar with completed checkmarks.
- **Devin `239` (verified):** scheduled-automation instruction preview —
  numbered plan steps shown as a document with Edit/Preview tabs; plan
  content is editable text in Devin's automation surface.
- Failure frames (`agent_task_failed`, 8 across 3 products) pair with
  `error_banner` (24 frames, 4 apps).

## Interaction contract

Rules grounded in observation are marked **[obs]**; extrapolations **[inf]**.

### Tool-call lifecycle

1. States are exactly the core `ToolStatus` union: `pending → running →
   success | error | cancelled`. **[obs]** Devin shows pending rows with a
   spinner affordance, completed rows with a check, and interrupt produces
   cancelled work rather than deletion.
2. A running tool call shows its in-flight state inline; while args are
   incomplete the card shows a shimmer (`argsText` exists on `ToolCallPart`
   for this). **[obs/inf]** Cofounder `199` shows an expanded "Running Tool:"
   row mid-run; per-token arg streaming is inferred from the type model.
3. Completed tool calls **auto-collapse** to a one-line summary
   (`tool_call_collapsed` in Lovable/Manus; "Ran 2 actions" rollup in
   Cofounder). **[obs]**
4. A contiguous run of ≥2 completed calls MAY collapse into an aggregate row
   ("Ran N actions") that expands to the individual cards. **[obs/inf]** —
   observed in Cofounder; the ≥2 batching threshold is inferred.
5. Error calls stay expanded by default and surface a retry affordance when
   `tool-result.isError` and the part is `retryable`. **[inf]** from
   error-banner pairing.

### Plan approval

6. When a plan exists, execution does not start until approval. **[obs]**
   Cofounder's numbered "You say go → agent builds it" copy, "Requires
   Approval" task badges, and Manus's "Accepted" banner bracket execution.
7. Approval and rejection are message-level events, so they appear in the
   transcript and survive reload; approval UI is not a transient modal.
   **[obs]** Cofounder `199` renders the pending decision as an inline card
   with "Decide all / Decide this one / Submit" inside the run transcript.
8. Plans are editable pre-approval only; after approval the checklist becomes
   a live progress tracker (same component, different mode). **[inf]** from
   `plan_checklist` appearing in both planning (Lovable) and tracking (Manus
   step checkmarks) contexts.
9. Batch approval: multiple pending items may be approved from one entry
   point (Cofounder's "2 agent updates — Review" pill). **[obs]**

### Interrupt semantics

10. The interrupt control takes the composer's action slot while
    `status === 'streaming'` rather than floating as an overlay.
    **[inf]** — `interrupt_control` is labeled in 15 frames (3 products) and
    in verified frames the composer is the only persistent action surface
    during a run; exact placement frames were not captured at high enough
    fidelity to call this observed.
11. Interrupt is cooperative and preserves partial output, flagged as
    aborted (`Message.aborted` already exists in core). **[obs]** — matches
    the architecture note that every surveyed product keeps partial output.
12. After interrupt, in-flight tool calls transition to `cancelled` and their
    partial results remain visible. **[inf]**
13. Duration labels freeze on completion rather than disappearing.
    **[obs]** Lovable's "Thought for 27s" persists on a finished turn; by
    analogy, step timers freeze on completion/cancel. **[inf]** for steps.

### Terminal / live logs

14. While running, terminal output live-streams with stick-to-bottom
    (same semantics as `<Transcript>`); once the command exits, the pane
    becomes a static, scrollable log with the exit status shown. **[inf]** —
    `terminal_stream` frames are rare (2); behavior extrapolated from
    Devin's editor/terminal tabs and standard practice.
15. Terminal output is an artifact, not a message part: Devin and Manus put
    it in an adjacent pane/tab, never inline in prose. **[obs]** Map to
    `ArtifactPart { kind: 'terminal' }` rather than a new part type.

### Progress & cost

16. Step progress is shown as both a counter ("2/2", "4 of 6") and per-step
    checkmarks; completed steps collapse. **[obs]**
17. Cost/token meters, when shown, are ambient header/billing-adjacent UI,
    not per-message chrome. Only Cofounder surfaces them in-session (6
    frames); treat `Usage.costUsd` display as opt-in. **[obs]**

## Component API sketch

Headless primitives in the adapters (React/Svelte/Vue), state owned by
`@aicl/core`. All expose stable `data-*` attributes; none ship CSS. These
compose with the existing `Part` union — no new core part types are required
except the plan/data parts noted below.

### `ToolCallDisclosure`

Renders a `tool-call` part plus its matching `tool-result` (joined by
`toolCallId`).

```ts
interface ToolCallDisclosureProps {
  toolCallId: string;
  /** Default expansion; completed calls default to collapsed. */
  defaultOpen?: boolean;
  /** Aggregate mode: render N calls as "Ran N actions" rollup. */
  calls?: ToolCallPart[];            // alternative to single toolCallId
  onRetry?(toolCallId: string): void;
}
// data-*:
// data-part="tool-call"
// data-status="pending|running|success|error|cancelled"
// data-open="true|false"
// aria-expanded on the trigger; region role for the body
```

Rules 3–5 are implemented here: auto-collapse on `success`, stay-open on
`error`, aggregate rendering for consecutive completed calls.

### `PlanChecklist`

```ts
interface PlanStep {
  id: string;
  title: string;
  status: 'pending' | 'running' | 'done' | 'failed' | 'skipped';
}
interface PlanChecklistProps {
  steps: PlanStep[];
  mode: 'proposal' | 'tracking';     // rule 8: same component, two modes
  onApprove?(): void;                // proposal mode only
  onReject?(reason?: string): void;
  onEditStep?(id: string, title: string): void;   // proposal mode only
  onReorder?(ids: string[]): void;                // optional; not observed
}
// data-mode="proposal|tracking"
// data-step-status per item; progress counter rendered as "n/m"
```

Transport mapping: a plan arrives as a `data-plan` part (using the existing
`data-${string}` extension point); approval is sent back as a user message or
a transport `body` field — core stays ignorant of the payload. `onReorder` is
included but flagged: no corpus frame shows drag-reordering of plan steps.

### `StepTimeline`

Vertical timeline of run phases (distinct from PlanChecklist: timeline =
what happened, checklist = what was planned).

```ts
interface StepTimelineProps {
  events: Array<{
    id: string;
    label: string;
    status: 'done' | 'running' | 'failed';
    startedAt?: number;
    endedAt?: number;   // drives frozen duration labels (rule 13)
  }>;
  showDurations?: boolean;  // e.g. Lovable's "Thought for 27s"
}
// data-state per event; aria-live="polite" on the list, not per item
```

### `TerminalOutput`

```ts
interface TerminalOutputProps {
  artifactId: string;                  // ArtifactPart { kind: 'terminal' }
  streaming: boolean;                  // live vs static (rule 14)
  followOutput?: boolean;              // stick-to-bottom while streaming
  maxLines?: number;                   // ring buffer for long runs
  onExit?(code: number): void;
}
// data-streaming="true|false"; role="log"; aria-live off when static
```

### `InterruptButton`

```ts
interface InterruptButtonProps {
  status: ChatStatus;                  // visible only when 'streaming'
  onInterrupt(): void;                 // aborts via transport AbortSignal
  confirmAfterMs?: number;             // optional double-press guard
}
// data-status mirrors ChatStatus
// Renders into the composer's action slot (rule 10), replacing send.
```

### File changes / diff / preview / cost

- **File changes and diffs** render as `ArtifactPart { kind: 'diff' }`; a
  full `DiffViewer` is a registry-rendered artifact component, not a core
  primitive (`diff_viewer` appears in only 1 frame, Devin).
- **Live preview** is `ArtifactPart { kind: 'preview' }` in an aside pane
  (Lovable pattern); the primitive is just a sandboxed-iframe host with
  reload-on-version.
- **Cost meter** consumes `Message.usage` / `Usage.costUsd`; ship a
  `UsageBadge` style helper in `@aicl/styles` only — 1 of 4 products shows it
  inline, so it is not a core primitive (rule 17).

## Package boundary recommendation (open question #3)

**Call: keep the execution primitives in the chat packages; do not create
`@aicl/agent` in v1.**

Justification from the counts:

- The execution surfaces that are *common* are chat-native: `plan_checklist`
  is 78 frames / 4-of-4 products and appears inside the message list;
  `progress_bar` is 102 / 4-of-4; tool-call cards and collapsed rollups live
  in the transcript in every product. Splitting these out would force every
  chat consumer to install a second package for a baseline experience.
- Core already models the domain: `ToolCallPart`, `ToolResultPart`,
  `ReasoningPart`, `ToolStatus` with `cancelled`, `Message.aborted`,
  `Usage.costUsd`, and `ArtifactKind` already includes `terminal`, `diff`,
  and `preview`. A sibling package would duplicate or re-export all of it.
- The surfaces that would justify `@aicl/agent` — terminal streams (2 frames),
  live tool logs (3), diff viewer (1), cost meters (1 product) — are the
  *sparse* ones. They fit the existing escape hatches: artifact parts plus
  the renderer registry. If a future artifact-heavy package lands (open
  question #1), `TerminalOutput`, `DiffViewer`, and `PreviewPane` are
  candidates to move there, since they are pane-level, not transcript-level.
- 62/205 selected frames are chat surfaces, but the inverse matters more:
  the most frequent execution component (`plan_checklist`) appears
  overwhelmingly in chat contexts. The transcript, not the IDE pane, is the
  primary execution surface in 3 of 4 products (Devin is the exception).

Revisit when a fifth corpus product shows pane-level execution (editor,
terminal, preview) as its dominant pattern, or when artifact surfaces ship.

## Variants & states

| Primitive | Variants / states |
|---|---|
| ToolCallDisclosure | pending (shimmer args) · running (spinner, streaming output) · success (collapsed, check) · error (expanded, retry) · cancelled (greyed, "Stopped") · aggregate "Ran N actions" |
| PlanChecklist | proposal (approve/reject/edit) · tracking (live checkmarks, n/m counter) · approved banner · rejected (with reason) |
| StepTimeline | running (active pulse, ticking timer) · done (check, frozen duration) · failed (red marker, inline error) |
| TerminalOutput | streaming (stick-to-bottom, follow toggle) · exited (static, exit-code badge) · truncated (maxLines ring buffer note) |
| InterruptButton | idle-hidden · streaming-visible · confirming (optional second press) · disabled while `submitted` (nothing to abort yet) |
| Banners | completion ("Accepted"/"Done") · failure (error_banner, 24 frames/4 apps) · awaiting-approval ("Requires Approval") |

## Gaps

- **No observed plan-editing or reordering UI.** `onEditStep`/`onReorder` are
  speculative API surface, flagged in the sketch.
- **Approval rejection path** is implied (decide buttons, "Requires Approval")
  but no corpus frame captures a rejected plan's aftermath.
- **Terminal streaming behavior** rests on 2 frames; live-scroll vs
  static-on-exit semantics are inferred.
- **Cost meters are single-product** (Cofounder, 6 frames); no token-level
  breakdown observed anywhere.
- **Multi-agent fan-out** (Cofounder's workspace wheel hints at delegated
  agents) has no in-transcript representation in the labels.
- `agent_plan_review` archetype has only 2 frames (both Manus) and one was
  mislabeled (rating UI); pre-execution review UX is under-sampled.

## Reference screenshots

- `/Users/ameno/dev/ai-chat/Manus web Mar 2026/Manus web Mar 2026 155.png` — "Accepted" banner, collapsible checked step cards, 2/2 progress chip (verified)
- `/Users/ameno/dev/ai-chat/Cofounder web Aug 2026/Cofounder web Aug 2026 199.png` — "Ran 3 actions" rollup, running tool row, inline decision card with Decide/Submit (verified)
- `/Users/ameno/dev/ai-chat/Cofounder web Aug 2026/Cofounder web Aug 2026 88.png` — "Ran 2 actions" rollup, reasoning block, batch "Review" pill (verified)
- `/Users/ameno/dev/ai-chat/Cofounder web Aug 2026/Cofounder web Aug 2026 53.png` — "Requires Approval" task badges (verified)
- `/Users/ameno/dev/ai-chat/Cofounder web Aug 2026/Cofounder web Aug 2026 20.png` — streaming "Thinking" disclosure (verified)
- `/Users/ameno/dev/ai-chat/Lovable web Jan 2026/Lovable web Jan 2026 44.png` — "Thought for 27s", "2 edits made" rollup, artifact card, live preview pane (verified)
- `/Users/ameno/dev/ai-chat/Devin web Aug 2026 (1)/Devin web Aug 2026 37.png` — session status in list, "4 of 6" progress (verified)
- `/Users/ameno/dev/ai-chat/Devin web Aug 2026 (1)/Devin web Aug 2026 239.png` — automation plan as editable numbered steps, Edit/Preview tabs (verified)
