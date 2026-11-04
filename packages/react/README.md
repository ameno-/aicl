# `@aicl/react`

The React adapter for `@aicl/core`: hooks plus unstyled, accessible primitives. The primitives
own DOM structure, ARIA, focus and keyboard behaviour, and expose state as `data-*` attributes.
They have no visual design. Add `@aicl/styles` for the default theme.

Peer deps: `react`/`react-dom` ≥ 18. Wiring it to a backend: `docs/ADOPTION.md`.

## Entry points

- `@aicl/react`: everything below.
- `@aicl/react/markdown`: `Markdown`, `MarkdownTextPart`, `markdownRenderers` (react-markdown
  + GFM, raw HTML never rendered). Kept off the main entry so the base adapter ships no parser.
  Register it with `createPartRegistry({ ...markdownRenderers })`.

## Inventory (`src/index.ts`)

| Area | Exports | File |
|---|---|---|
| State | `useChat`, `useReadable` | `useChat.ts`, `useReadable.ts` |
| Transcript | `Transcript` (+ `.Scroller`, `.Content`, `.Item`, `.JumpToLatest`), `TranscriptProvider`, `useTranscript`, `MessageItem`, `MessageActions`, `PlanChecklist` | `Transcript.tsx`, `MessageActions.tsx`, `PlanChecklist.tsx` |
| Parts | `PartRenderer`, `createPartRegistry`, `defaultRegistry`, `TextPartView`, `ReasoningDisclosure`, `ToolCallDisclosure`, `ToolResultView`, `ArtifactCard`, `CodeBlock`, `FileChip`, `ErrorNotice`, `SuggestionRows`, `TerminalOutput`, `UnknownPart` | `parts.tsx` |
| Composer | `Composer` (+ `ComposerHandle` ref: `focus`, `clear`), `TriggerMenu`, `SlashMenu`, `MentionMenu`, `findTrigger`, `SuggestionChips`, `AttachmentChip`, `AttachmentDropzone`, `useAttachmentPicker`, `matchesAccept` | `Composer.tsx`, `composer-surface.tsx` |
| Sessions | `SessionList`, `SessionListItem`, `SessionSearch`, `SidebarNav`, `relativeTime`, `resolveSecondary` | `sessions.tsx` |
| Platform | `Dialog` (+ `.Title`, `.Description`, `.Close`), `AlertDialog`, `Drawer`, `Toast`, `ToastRegion`, `Field`, `Switch`, `Select`, `SegmentedControl` | `platform.tsx` |
| Button | `Button` (+ `.Icon`) | `Button.tsx` |
| Icons | `Icon`, `IconProvider`, `useIcon`, `useIcons`, `iconDefaults` | `icons.tsx` |
| Contract | `primitives`, `sharedSlots`, `allSlots`, `primitivesForSlot`, `iconRoles` | `contract.ts` |

Working examples of nearly every primitive in every state: `examples/slice-1/Components.tsx`
and `examples/slice-1/Gallery.tsx` (`cd examples/slice-1 && npm install && npm run dev`).

## Known sharp edges

These are verified against the current source. Work around them, or fix them with a test.

1. **`useChat` reads options once.** Changing `transport`, `body` or `headers` after mount has
   no effect. Use a custom `fetch` in the transport, or remount.
2. **`<Transcript>` doesn't pass `onAction` or `branch` to `MessageItem`.** Retry and Edit
   buttons render but do nothing, and the branch switcher never appears. Render
   `Transcript.Item` (or `MessageItem`) yourself when you need them (see `docs/ADOPTION.md`).
3. **`<PartRenderer>` uses a custom registry only for exact type names.** It checks
   `registry.has(part.type)`, so a `'data-'` wildcard or a custom fallback passed to
   `createPartRegistry` is ignored, and the built-in `UnknownPart` renders instead.
4. **Renderer typing.** The registry holds `ComponentType<PartProps>`. Write renderers against
   `PartProps` and narrow inside, or cast. `{ text: MarkdownTextPart }` doesn't compile, but
   `{ ...markdownRenderers }` does.
5. **`ToolResultView` doesn't render the result payload**, only "Result" or "Error".
6. **The default `artifact` renderer for `kind: 'terminal'`** shows a placeholder
   `TerminalOutput` with the line `ready`.
7. **`Composer` passes only text to `onSubmit`.** Attachments shown via `attachments` are
   display state. Send them yourself as `file` parts with `chat.send(text, parts)`.
8. **`TriggerMenu` needs a controlled composer.** Pass the same `value`, `onChange`/`onValueChange`
   and `inputRef` to both. It filters `items` by label unless you pass `onQueryChange`, in which
   case you filter.

## Behaviour worth knowing

- `Composer` checks IME composition before treating Enter as submit. Shift+Enter inserts a
  newline. The textarea autosizes up to `maxRows`.
- `Transcript` keeps one `role="log" aria-live="polite"` node for its whole life, so token
  updates aren't re-announced. It sticks to the bottom until the user scrolls up more than 24 px,
  then shows a "Jump to latest" button. With no children it renders `Scroller`, `Content` and
  `JumpToLatest`. Arrange those parts yourself, or render `Transcript.Item` outside that list
  under `TranscriptProvider`; a row registers with the scroller either way.
- `ToolCallDisclosure` force-opens on `status: 'error'` and shows `argsText` while args stream.
- Every primitive marks itself with `data-aicl="<name>"`. Treat the attribute names as public
  API, because `@aicl/styles` and consumer CSS select on them. The full list, with every state
  a primitive exposes, is the **component contract**: `docs/components.md`, generated from
  `src/contract.ts`. A test fails when the contract and the implementation drift apart.

## Buttons

AICL had no button primitive: every button was a raw `<button>` styled by
whatever CSS happened to be around. `Button` is a flat primitive with three
axes — `variant`, `size`, `loading` — and the glyphs are **icon slots**, so
an app that swaps the icon set gets its buttons swapped too.

```tsx
<Button variant="secondary" icon="plus">New task</Button>
<Button loading>Working</Button>
<Button icon="plus" aria-label="Add" />
```

`type` defaults to `button`: a button inside a form that submits it must
say so, because an implicit submit is the most common way a chat app sends
a message twice. A `loading` button is `aria-busy` but **not** `disabled` —
a disabled button cannot be found by a screen reader in a busy state.

## The composer is compound

The composer is a compound component, so a consumer can arrange it without
re-implementing the keyboard semantics, the autosizing or the submission
guards.

```tsx
<Composer value={draft} onChange={setDraft} onSubmit={send} status={status}>
  <Composer.Body>
    <Composer.Attach onClick={pick} />
    <Composer.Input placeholder="Ask the agent…" />
  </Composer.Body>
  <Composer.Suggestions />
  <Composer.Submit />
</Composer>
```

The subparts: `Composer.Body`, `Composer.Input`, `Composer.Submit`,
`Composer.Attach`, `Composer.Attachments`, `Composer.Suggestions`,
`Composer.Hint`, `Composer.DisabledReason`. `useComposer()` reads the live
state from inside one.

**Children replace the default arrangement.** With no children, the
composer renders exactly what it always rendered. A **function** child
behaves as it always has: it receives the live state and owns *everything*,
including the wrapper.

## Icons

A primitive never imports an icon. It asks for the *role* the icon plays — `close`, `spinner`,
`send`, `retry` — and the role resolves through `IconProvider`. The default set is Lucide; an
app that wants another set wraps its tree once and every primitive follows.

```tsx
import { IconProvider } from '@aicl/react';

<IconProvider icons={{ spinner: () => <MySpinner /> }}>
  <App />
</IconProvider>
```

An override is a diff, not a replacement: a slot the provider does not name keeps its default.
Icons are decoration — the control's accessible name lives on the control, never on the icon —
so a slot can be swapped for anything, including a drawn glyph, without touching an accessible
name.

## Develop

```bash
npm run build
npm test        # react-test-renderer; src/*.test.tsx

node scripts/generate-component-docs.mjs   # rewrites docs/components.md and docs/llms.txt
```

The generated docs are committed so they can be read without running anything, and a test fails
when they drift from the contract.
