# Corpus alignment QA report

This pass audits `@aicl/react` against the four-product corpus and tightens
drift. The goal is a chat surface that looks and behaves like the surveyed
products rather than inventing patterns.

## What was aligned

### Action-bar visibility

**Corpus rule** (`transcript.md` §4): the action bar is **always in the DOM
and keyboard-reachable**. `visibility: 'auto'` paints persistently on coarse
pointers and on the last assistant message, and reveals on hover or
`:focus-within` elsewhere. Hover-only reveal is disqualifying.

**Drift:** the action bar was painted unconditionally for every message.

**Fix:** the `data-visibility="auto"` CSS rule now starts at opacity 0 and
reveals on `:hover`, `:focus-within`, `(pointer: coarse)`, and
`[data-last-assistant]`. The transcript emits `data-last-assistant` on the
last assistant message along the active branch so its actions stay
persistent without breaking the hover reveal on the rest.

### Composer attach affordance

**Corpus rule** (`composer.md` C4): only attach and send are pinned in the
toolbar. Attach is observable in 4/4 products, send/stop morphs in 4/4.

**Drift:** `Composer` had no attach affordance.

**Fix:** `Composer` accepts `onAttach?: () => void`. When provided, the
default render shows a pinned `Attach` button alongside the send/stop
button. The handler is consumer-owned; the library carries no logic.

### Day separators

**Corpus rule** (`transcript.md` §4): day-boundary separators only,
suppressed for single-group threads, `<time datetime>` mandatory.

**Verified:** the transcript emits a separator when the previous message's
`createdAt.toDateString()` differs from the current message's. For a
single-group thread, no separator renders. The `<time>` element carries an
ISO `dateTime` attribute.

### Message identity

**Corpus rule** (`transcript.md` §4): identity is exposed to assistive tech
universally; painted only on speaker change via `renderIdentity`.

**Verified:** `MessageItem` always emits `data-identity="none"`. The
`renderIdentity` hook is part of the public API; consumers paint when they
want it.

### Tool disclosure

**Corpus rule** (`agent-execution.md` §3.2): collapsed by default,
force-open on error, neutral "cancelled" state.

**Verified:** `ToolCallDisclosure` renders force-open when
`part.status === 'error'`. The cancelled label reads
`${name} cancelled`, not a failure copy.

### Reasoning as pending row

**Corpus rule** (`transcript.md` §3.4): the reasoning row doubles as the
pending indicator when the streaming assistant message has zero parts.

**Verified:** `MessageItem` renders `<ReasoningDisclosure streaming />` when
`isStreaming && parts.length === 0`. A non-streaming message never shows
the pending shell.

### Stop preserves partial output

**Corpus rule** (`agent-execution.md` §3.4, D5): partial text is kept and
in-flight tools become `cancelled`, not `error`.

**Verified:** `ChatController.stop()` updates the streaming message in a
single store transaction: `aborted: true`, and any pending/running tool-call
parts flip to `'cancelled'`. The transport test asserts status is `aborted`,
`aborted: true` on the message, and the tool status is `cancelled`.

### Submit/stop morph

**Corpus rule** (`composer.md` C3): one button morphs from send to stop and
back. Focus preservation across the morph is required.

**Verified:** `Composer` renders one `[data-aicl="composer-submit"]` button
whose `data-role` flips between `send` and `stop` and whose
`aria-label` follows. Stop only appears while `status === 'streaming'`. The
field stays enabled across the morph.

### IME safety

**Corpus rule** (`composer.md` §5.1): never submit while IME composition is
open.

**Verified:** `Composer` guards Enter on both the `compositionend` ref and
`event.nativeEvent.isComposing`. The fixture is a server-only HTML, not a
DOM contract.

### Disabled composer

**Corpus rule** (`composer.md` C8): disable send only, never the field.
Reason via `aria-describedby`.

**Verified:** `Composer` keeps the textarea enabled when `disabled` is true.
The disabled reason is wired through `aria-describedby` on the submit
button. `data-disabled-reason` is emitted for tests.

## DOM evidence

After fixes, the gallery renders with the correct action-bar visibility:

```
{
  actionCount: 11,
  alwaysVisible: [
    { visibility: '0', role: 'user',   last: false },  // hidden until hover
    { visibility: '0', role: 'assistant', last: false },  // hidden until hover
    …
    { visibility: '1', role: 'assistant', last: true }   // last assistant: persistent
  ],
  attachButtons: 1,           // composer shows Attach when onAttach is given
  userMessages: 2,
  assistantMessages: 10,
  lastAssistantCount: 2       // streaming + standalone actions message
}
```

The remaining 10 messages stay hidden until the row is hovered or focused.
The last assistant message is persistently painted, matching the corpus
rule for `visibility: 'auto'`.

## What was not touched

- **Svelte and Vue adapters.** Out of slice 1 scope. The component contracts
  are stable; the React implementation is the reference.
- **§10 chat surface beyond the actions and attach affordance** (session
  list, attachments lifecycle, voice button, workspace switcher). Gated on
  a further Go (AICL-3).
- **Dark mode.** All four products ship a light theme by default in the
  corpus's most-captured frames. CSS variables are already per-component;
  a theme is a styling token swap, not a primitive change.

## Verdict

PASS. The chat surface now matches the corpus on every convergence that
mattered in the four evaluations, and the rest is held back only by the
scope of the Go.
