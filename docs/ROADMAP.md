# The roadmap

What to create, what to expose, and what to refactor, so AICL's own
components carry the shapes LooseLeaf and Fluid Functionalism established.

The vocabulary is the shape table in [`INVENTORY.md`](INVENTORY.md) — S1
through S15. The reference for *what* to build is
[`docs/BLUEPRINT.md`](BLUEPRINT.md) and the corpus; the reference for *what
shape* to build it in is the two libraries.

**The rule for all of it: AICL's behaviour does not change.** The corpus
decisions (D1–D18) hold. The components get new shapes, new subparts, and
new siblings — not new behaviour.

---

## The three buckets

| | What it means | Who it is for |
|---|---|---|
| **CREATE** | A primitive AICL does not have and a chat app needs | the consumer |
| **EXPOSE** | Something AICL already has, in `@aicl/fx` or `apps/workspace`, that the library should own | the consumer, and AICL itself |
| **REFACTOR** | An existing primitive whose *shape* should change | the consumer, and the contract |

---

## Wave 1 — Refactor: the shapes we owe our own components

These four are the highest-leverage changes in the whole plan, because they
change the components a consumer already uses, and because they establish
the compound pattern everything else follows.

### R1. `Composer` → compound (S2, S6)

**Today.** One flat component. The default markup hard-codes the field, the
submit button, the attach button and the disabled reason. A consumer who
wants a different arrangement uses the `children` render prop, which throws
away the entire default and has to re-implement the keyboard semantics.

**Target.** LooseLeaf's `PromptInput` shape and Fluid's `InputMessage`
slots, fused:

```tsx
<Composer value={draft} onChange={setDraft} onSubmit={send} status={status}>
  <Composer.Attach onClick={pick} />
  <Composer.Input placeholder="Ask the agent…" />
  <Composer.Submit />
</Composer>
```

- **S2** — named subparts: `Composer.Body`, `Composer.Input`,
  `Composer.Submit`, `Composer.Attach`, `Composer.Attachments`,
  `Composer.Suggestions`, `Composer.Hint`, `Composer.DisabledReason`.
- **S6** — `leftSlot` / `rightSlot`, each accepting `ReactNode` or a
  render prop, so a consumer can add a toolbar without rebuilding the
  composer.
- The parts that are *always* present stay always present: the submit
  action, the disabled reason, the live region. LooseLeaf's
  `PromptInputStatus` (`ready | submitted | streaming | error`) and AICL's
  `ChatStatus` already agree.

**Do not break:** `Composer` with no children keeps rendering exactly what
it renders today. The compound form is additive.

### R2. `Transcript` → a scroller plus a message (S2, S3)

**Today.** `Transcript` is one component that owns the scroll container, the
stick-to-bottom behaviour, the day separators, the branch switcher and the
message rows.

**Target.** LooseLeaf splits it: `MessageScroller` (the scroll mechanics)
and `Message` (the row). AICL should split it the same way, because the
scroll mechanics and the row are genuinely different concerns — a consumer
who wants their own row should not have to re-implement stick-to-bottom.

- `Transcript.Scroller`, `Transcript.Content`, `Transcript.Item`
  (the row), `Transcript.JumpToLatest`.
- **S3** — a `TranscriptProvider` and `useTranscript()` so a row rendered
  outside the tree can still register with the scroller.
- The live region stays exactly where it is: one `role="log"
  aria-live="polite"` node for the whole thread, created once.

### R3. `MessageItem` → compound, with a size (S2, S8)

**Today.** `MessageItem` renders the row, the parts, the branch switcher and
the action row. Fluid's `ChatMessage` takes `from`, `files`, `time`,
`actions` and `size`; LooseLeaf's `Message` splits into
`MessageHeader` / `MessageContent` / `MessageFooter` / `MessageText`.

**Target.** `MessageItem` keeps its behaviour and gains subparts:
`MessageItem.Header`, `MessageItem.Body`, `MessageItem.Footer`. The action
row moves to `MessageItem.Footer` so a consumer can put the timestamp
before the actions, which is Fluid's arrangement.

### R4. `Dialog` → the full compound (S2)

**Today.** `Dialog`, `Dialog.Title`, `Dialog.Description`, `Dialog.Close`.

**Target.** Add `Dialog.Header`, `Dialog.Footer`, `Dialog.Trigger`,
`Dialog.Body`. LooseLeaf and Fluid both ship the full set, and both use the
same `data-slot` names, so the naming is free.

### R5. Controlled *and* uncontrolled, everywhere (S4)

**Today.** `Composer` supports both. `Switch`, `Select`, `SegmentedControl`
and `Field` are controlled-only, so a consumer must hold state for a
toggle they never read.

**Target.** Every stateful primitive takes `value` / `defaultValue` /
`onValueChange` (and `checked` / `defaultChecked` / `onCheckedChange` for
the binary ones), following the shape both libraries use.

---

## Wave 2 — Create: the primitives AICL is missing

### C1. `Button` — the biggest single gap

AICL has **no button primitive**. Every button in the library and in the
reference app is a raw `<button>` styled by whatever CSS happens to be
around. Both libraries ship one, and every other component they have
depends on it.

- **S1** flat, with `variant` and `size` axes, a `loading` state, and
  **icon slots** through the existing `IconProvider`.
- `Button.Icon` for the leading and trailing glyphs, so the slot names are
  the same ones the whole library uses.
- The variants both libraries converge on: `default`, `secondary`,
  `destructive`, `ghost`, `outline`, `link`.

### C2. The overlay set

`Tooltip`, `Popover`, `DropdownMenu`, `HoverCard`.

LooseLeaf and Fluid both ship all four; Fluid's `popup` lib shows the
shape — **one shared popup chrome** for dropdown, select and combobox, so
the three behave identically. AICL should build one popup primitive and
compose the three from it, rather than three separate ones.

### C3. The form set

`Input`, `Textarea`, `InputGroup`, `Checkbox`, `RadioGroup`, `Slider`,
`Combobox`.

`InputGroup` is Fluid's: an input with a leading icon, a trailing button,
addons either side. `Combobox` is the type-ahead over a list, which AICL
already has internally as `createComboboxModel` in `@aicl/core` — it needs
to become a primitive.

### C4. The content set

`Badge`, `Card`, `Separator`, `Progress`, `Kbd`, `Empty`, `Skeleton`,
`Alert`, `Tabs`, `Accordion`, `Collapsible`.

`Tabs` is Fluid's, with a travelling pill indicator and the spring
system's `moderate` tier — a good showcase for the motion work.
`Accordion` / `Collapsible` generalise AICL's `ReasoningDisclosure`, which
is currently a bespoke disclosure.

### C5. `CommandMenu`

Fluid's, and the shape is good: compound (`Input`, `Tabs`, `Filters`,
`List`, `Empty`), plus the shortcut helpers (`parseShortcut`,
`matchesShortcut`, `formatShortcut`, `useIsMac`). AICL's `@aicl/fx` has a
Tailwind-coupled `CommandMenu` already; it should move into the library
and shed the Tailwind.

---

## Wave 3 — Expose: AICL's own distinctive features

This is the wave that answers "we're missing the more powerful and exciting
AICL features". The answer is that **they exist, but they live in the app
and in `fx`, not in the library.**

### E1. The surface contract

`apps/workspace/web/surfaces/` has seven live surfaces — `terminal`,
`diff`, `file`, `browser`, `process`, `review`, `sideshow`. They are the
most distinctive thing AICL has, and neither reference library has anything
like them. They are also a *shape*, not a set of pixels: each one is a
document or canvas surface with a lifecycle, a streaming mode and a set of
actions.

**Target.** A **surface** shape — S2 compound, S4 controlled and
uncontrolled, S5 an imperative handle, and a named model:

```tsx
<Surface value={surface} onAction={handle} status="live">
  <Surface.Header />
  <Surface.Body />
  <Surface.Footer />
</Surface>
```

The seven workspace surfaces conform to it, and a consumer can build their
own. This is AICL's sketchpad.

### E2. The thinking family

`@aicl/fx` has `ThinkingIndicator` and `AnimatedPlan`; Fluid has
`thinking-indicator` and `thinking-steps`. AICL's `ReasoningDisclosure` is
the third member of the same family and is currently the odd one out.

**Target.** One family, in the library: `ThinkingIndicator` (the animated
status), `ThinkingSteps` (a collapsible chain with a sequential reveal),
and `ReasoningDisclosure` renamed or aligned to sit beside them.

### E3. The question flow

Fluid's `ask-user-questions` is a **structured question flow** — a list of
questions, each with single or multi select, an inline "other" input,
skip, and multi-question navigation. `@aicl/fx` has `QuestionCard` and
`ApprovalCard`, which are two narrow versions of it.

**Target.** One `QuestionFlow` primitive in the library, with
`Question`, `Option`, and an `Answer` type — the shape Fluid uses, and the
shape AICL's `data-*` parts can carry (a question flow is a
`data-question-flow` part).

### E4. The queued stack

Fluid's `queued-stack` block: messages queued while a turn streams, fanning
out on hover, reordering by drag, and morphing into the sent message.
`@aicl/fx` has `SuggestionStack`, which is the same idea without the queue
semantics.

**Target.** A `QueuedMessage` model in the library — the messages, their
order, and their state — plus the composer's queue action, which Fluid's
`InputMessage` already models (the send button becomes a Queue action when
the draft is non-empty).

### E5. The applets and the agentic surfaces

`apps/workspace/web/applets/` and `web/agentic/` — `hitl`, `live`,
`toolRenderers`. The tool renderers in particular: AICL's
`createPartRegistry` is the extension point, but the *default* tool
renderers that ship in the workspace are richer than the library's.

**Target.** Decide what stays an app concern and what is library. The
`data-*` part extension mechanism is already library. The workspace's
default renderers should become the library's defaults where they are
generic.

### E6. `@aicl/ink` — the art layer

LooseLeaf's structural signature: 70 components ship `x.tsx` + `x-ink.ts`,
and the drawing never mixes with the DOM. AICL's icon slots already give
the *icon* layer a home; the next layer is the *chrome* — the drawn paper,
the pen stroke around a card, the drawn checkbox.

**Target.** `@aicl/ink` as an optional package that renders AICL's own
primitives in a drawn style, by seeding SVG behind the same slots. The
`x.tsx` + `x-ink.ts` pairing is the structural rule.

---

## Wave 4 — Ship

Not new components — the machinery that makes them installable.

| | What | Reference | Status |
|---|---|---|---|
| **Registry** | `npx aicl add <item>`, source-in, with a manifest carrying the component contract | Fluid's registry, LooseLeaf's | Shipped (AICL-144) |
| **Docs per item** | one brief, the install command, slots, states, a usage snippet | Fluid's llms.txt | Shipped |
| **`aicl doctor`** | reads the consumer's stack fresh; never caches a verdict | Fluid's `stack.mjs` | Shipped |
| **`llms.txt`** | done, and it grows | Fluid's | Shipped, now lists every item |
| **Blocks** | the shells a chat app needs: the assistant shell, the work panel, the settings surface | Fluid's 7, LooseLeaf's 62 | Not yet |
| **Presets** | a skin + a density + an icon set, chosen once | Fluid's presets | Not yet |
| **The agent skill** | the library teaches itself to code against | Fluid's | Not yet |

---

## What we are not doing

- **We are not copying a component.** Neither library's components become
  AICL's. AICL's come from the corpus.
- **We are not adding a Radix/Base UI flavour axis.** Fluid's flavour axis
  is which primitive library; ours is which framework (React, then Svelte
  and Vue). Two axes is one too many.
- **We are not chasing their UX.** AICL's look, its behaviour, and its
  decisions stand. What is borrowed is structure.
- **We are not building 123 components.** AICL is a chat library. The
  inventory is a reference for shape, not a shopping list. Sixty of
  LooseLeaf's components are marketing and auth pages, and AICL will never
  ship those.

---

## The order, and why

1. **Wave 1 first.** It changes the components a consumer already uses, and
   it establishes the compound pattern that Wave 2 and 3 follow. Doing
   Wave 2 first would mean building `Button` and then rewriting it.
2. **`Button` before the rest of Wave 2.** Everything else composes it.
3. **Wave 3 alongside Wave 2**, because it is where AICL's distinctive
   value lives, and because the surface contract is a *shape* question, not
   an inventory question.
4. **Wave 4 last**, because a registry with three items is worse than no
   registry. AICL-144 inverted the last step: the catalog now covers every
   existing primitive and every `@aicl/fx` component, so a new item has a
   gate to pass through rather than a three-item advertisement to join.

### The one thing that would change this plan

If the answer to "what is AICL for?" is "a chat UI", then Wave 3 is the
point and Waves 1–2 are maintenance. If the answer is "the components
every chat app rebuilds", then Wave 2 is the point. **The registry is
what settles it**, because it is the difference between shipping a library
and shipping a kit.
